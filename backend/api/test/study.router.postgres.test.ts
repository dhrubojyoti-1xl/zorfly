import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseApiEnvironment } from '@zorfly/config';
import { createPrismaClient, type ZorflyPrismaClient } from '@zorfly/database';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { passwordHasher } from '../src/modules/auth/password.js';
import { PrismaAuthRepository } from '../src/modules/auth/prisma-auth.repository.js';
import { createTokenService } from '../src/modules/auth/tokens.js';

const connectionString = process.env.TEST_DATABASE_URL;
const integration = describe.runIf(Boolean(connectionString));
const prisma: ZorflyPrismaClient | null = connectionString
  ? createPrismaClient(connectionString)
  : null;

afterAll(async () => {
  await prisma?.$disconnect();
});

integration('Study Library HTTP routes (PostgreSQL-backed)', () => {
  const context = { requestId: randomUUID(), ip: '127.0.0.1', userAgent: 'vitest' };

  let authService: AuthService;
  let app: Express;
  let adminAuthorization: string;
  let categoryId: string;

  beforeAll(async () => {
    if (!prisma) throw new Error('TEST_DATABASE_URL is required.');
    const db = prisma;
    const suffix = randomUUID().slice(0, 8);

    const hashKey = 'integration-hash-key-with-at-least-32-characters';
    const signingKey = 'integration-signing-key-with-at-least-32-characters';
    const tokens = createTokenService({ signingKey, hashKey, accessTokenTtlSeconds: 900 });
    authService = new AuthService({
      repository: new PrismaAuthRepository(db, hashKey),
      passwordHasher,
      tokens,
      mailer: { send: () => Promise.resolve() },
      refreshTokenTtlSeconds: 604_800,
      appUrl: 'http://localhost:5173'
    });
    const environment = parseApiEnvironment({
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL: connectionString,
      SESSION_SIGNING_KEY: signingKey,
      SESSION_HASH_KEY: hashKey
    });
    app = createApp({
      environment,
      version: 'test',
      auth: { service: authService, tokens },
      organization: { prisma: db }
    });

    const admin = await authService.registerCompany(
      {
        companyName: `Study Co ${suffix}`,
        fullName: 'Tenant Admin',
        email: `study-${suffix}@example.com`,
        password: 'correct-password',
        referralCode: ''
      },
      context
    );
    if (!admin.company) throw new Error('Expected a company.');
    adminAuthorization = `Bearer ${admin.accessToken}`;

    const category = await request(app)
      .post('/api/v1/categories')
      .set('authorization', adminAuthorization)
      .send({ name: `Study Category ${suffix}` })
      .expect(201);
    categoryId = (category.body as { data: { id: string } }).data.id;
  }, 30_000);

  it('rejects unauthenticated requests', async () => {
    await request(app).get('/api/v1/study').expect(401);
  });

  it('creates, lists, filters by difficulty, reads, and deletes study material', async () => {
    const created = await request(app)
      .post('/api/v1/study')
      .set('authorization', adminAuthorization)
      .send({
        title: 'Handling difficult customers',
        categoryId,
        difficulty: 'senior',
        contentType: 'practice_quiz',
        body: { overview: 'A short guide.', sections: [], keyPoints: ['Stay calm'] },
        questions: [
          {
            prompt: 'What is the first step?',
            options: ['Listen', 'Argue'],
            correctIndex: 0,
            explanation: 'Listening builds trust.'
          }
        ]
      })
      .expect(201);
    const materialId = (created.body as { data: { id: string } }).data.id;

    const list = await request(app)
      .get('/api/v1/study')
      .set('authorization', adminAuthorization)
      .query({ difficulty: 'senior' })
      .expect(200);
    const listBody = list.body as {
      data: {
        rows: Array<{ id: string; contentType: string; difficulty: string; questionCount: number }>;
      };
    };
    const row = listBody.data.rows.find((entry) => entry.id === materialId);
    expect(row).toBeDefined();
    expect(row?.contentType).toBe('practice_quiz');
    expect(row?.difficulty).toBe('senior');
    expect(row?.questionCount).toBe(1);

    const filteredOut = await request(app)
      .get('/api/v1/study')
      .set('authorization', adminAuthorization)
      .query({ difficulty: 'fresher' })
      .expect(200);
    const filteredBody = filteredOut.body as { data: { rows: Array<{ id: string }> } };
    expect(filteredBody.data.rows.some((entry) => entry.id === materialId)).toBe(false);

    const detail = await request(app)
      .get(`/api/v1/study/${materialId}`)
      .set('authorization', adminAuthorization)
      .expect(200);
    const detailBody = detail.body as {
      data: {
        title: string;
        difficulty: string;
        body: { keyPoints: string[] };
        questions: unknown[];
      };
    };
    expect(detailBody.data.title).toBe('Handling difficult customers');
    expect(detailBody.data.difficulty).toBe('senior');
    expect(detailBody.data.body.keyPoints).toEqual(['Stay calm']);
    expect(detailBody.data.questions).toHaveLength(1);

    const practiceCategories = await request(app)
      .get('/api/v1/study/practice-categories')
      .set('authorization', adminAuthorization)
      .expect(200);
    const practiceBody = practiceCategories.body as {
      data: { rows: Array<{ id: string; questionCount: number }> };
    };
    expect(practiceBody.data.rows.some((entry) => entry.id === categoryId)).toBe(true);

    await request(app)
      .delete(`/api/v1/study/${materialId}`)
      .set('authorization', adminAuthorization)
      .expect(200);

    await request(app)
      .get(`/api/v1/study/${materialId}`)
      .set('authorization', adminAuthorization)
      .expect(404);
  });

  it('rejects invalid study material payloads', async () => {
    const response = await request(app)
      .post('/api/v1/study')
      .set('authorization', adminAuthorization)
      .send({ title: 'x', contentType: 'summary' })
      .expect(422);
    expect((response.body as { success: boolean }).success).toBe(false);
  });
});

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

integration('Learning library HTTP routes (PostgreSQL-backed)', () => {
  const context = { requestId: randomUUID(), ip: '127.0.0.1', userAgent: 'vitest' };

  let authService: AuthService;
  let app: Express;
  let tenantAAuthorization: string;
  let employeeAuthorization: string;
  let tenantACategoryId: string;
  let tenantBAuthorization: string;
  let tenantBCategoryId: string;

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

    const adminA = await authService.registerCompany(
      {
        companyName: `Learning Co ${suffix}`,
        fullName: 'Tenant A Admin',
        email: `learning-a-${suffix}@example.com`,
        password: 'correct-password',
        referralCode: ''
      },
      context
    );
    if (!adminA.company) throw new Error('Expected a company for tenant A.');
    tenantAAuthorization = `Bearer ${adminA.accessToken}`;

    const categoryA = await request(app)
      .post('/api/v1/categories')
      .set('authorization', tenantAAuthorization)
      .send({ name: `Learning Category ${suffix}` })
      .expect(201);
    tenantACategoryId = (categoryA.body as { data: { id: string } }).data.id;

    const employeeEmail = `learning-employee-${suffix}@example.com`;
    const employeeResponse = await request(app)
      .post('/api/v1/employees')
      .set('authorization', tenantAAuthorization)
      .send({
        fullName: 'No Permission Employee',
        email: employeeEmail,
        role: 'employee',
        difficultyLevel: 'fresher'
      })
      .expect(201);
    const employeeBody = employeeResponse.body as { data: { temporaryPassword: string | null } };
    const temporaryPassword = employeeBody.data.temporaryPassword;
    if (!temporaryPassword) throw new Error('Expected a temporary employee password.');
    const employeeLogin = await authService.logIn(
      { email: employeeEmail, password: temporaryPassword },
      { requestId: randomUUID(), ip: '127.0.0.1', userAgent: 'vitest-employee' }
    );
    if (!('accessToken' in employeeLogin)) throw new Error('Expected an employee session.');
    employeeAuthorization = `Bearer ${employeeLogin.accessToken}`;

    const adminB = await authService.registerCompany(
      {
        companyName: `Learning Foreign Co ${suffix}`,
        fullName: 'Tenant B Admin',
        email: `learning-b-${suffix}@example.com`,
        password: 'correct-password',
        referralCode: ''
      },
      context
    );
    if (!adminB.company) throw new Error('Expected a company for tenant B.');
    tenantBAuthorization = `Bearer ${adminB.accessToken}`;
    const categoryB = await request(app)
      .post('/api/v1/categories')
      .set('authorization', tenantBAuthorization)
      .send({ name: `Learning Foreign Category ${suffix}` })
      .expect(201);
    tenantBCategoryId = (categoryB.body as { data: { id: string } }).data.id;
  }, 30_000);

  it('rejects unauthenticated requests', async () => {
    await request(app).get('/api/v1/learning').expect(401);
  });

  it('rejects creation for users without learning:manage', async () => {
    await request(app)
      .post('/api/v1/learning')
      .set('authorization', employeeAuthorization)
      .send({ title: 'Onboarding video', type: 'video', url: 'https://example.com/v.mp4' })
      .expect(403);
  });

  it('allows read-only listing for an employee without learning:manage', async () => {
    await request(app)
      .get('/api/v1/learning')
      .set('authorization', employeeAuthorization)
      .expect(200);
  });

  it('rejects a link-like material with no URL', async () => {
    const response = await request(app)
      .post('/api/v1/learning')
      .set('authorization', tenantAAuthorization)
      .send({ title: 'Missing link', type: 'link' })
      .expect(422);
    expect((response.body as { success: boolean }).success).toBe(false);
  });

  it('creates, lists, reads, updates and soft-deletes a learning material', async () => {
    if (!prisma) throw new Error('TEST_DATABASE_URL is required.');
    const created = await request(app)
      .post('/api/v1/learning')
      .set('authorization', tenantAAuthorization)
      .send({
        title: 'Customer service basics',
        description: 'A short primer.',
        categoryId: tenantACategoryId,
        type: 'article',
        url: 'https://example.com/article',
        tags: ['onboarding']
      })
      .expect(201);
    const materialId = (created.body as { data: { id: string } }).data.id;

    const list = await request(app)
      .get('/api/v1/learning')
      .set('authorization', tenantAAuthorization)
      .expect(200);
    const listBody = list.body as { data: { rows: Array<{ id: string; type: string }> } };
    expect(listBody.data.rows.some((row) => row.id === materialId)).toBe(true);

    const detail = await request(app)
      .get(`/api/v1/learning/${materialId}`)
      .set('authorization', tenantAAuthorization)
      .expect(200);
    const detailBody = detail.body as {
      data: { title: string; url: string; source: string; description: string };
    };
    expect(detailBody.data.title).toBe('Customer service basics');
    expect(detailBody.data.url).toBe('https://example.com/article');
    expect(detailBody.data.source).toBe('manual');

    await request(app)
      .put(`/api/v1/learning/${materialId}`)
      .set('authorization', tenantAAuthorization)
      .send({
        title: 'Customer service basics (updated)',
        categoryId: tenantACategoryId,
        type: 'article',
        url: 'https://example.com/article-v2'
      })
      .expect(200);

    const updated = await request(app)
      .get(`/api/v1/learning/${materialId}`)
      .set('authorization', tenantAAuthorization)
      .expect(200);
    const updatedBody = updated.body as { data: { title: string; url: string } };
    expect(updatedBody.data.title).toBe('Customer service basics (updated)');
    expect(updatedBody.data.url).toBe('https://example.com/article-v2');

    const versions = await prisma.learningMaterialVersion.findMany({
      where: { materialId },
      orderBy: { versionNumber: 'asc' }
    });
    expect(versions).toHaveLength(2);
    expect(versions[0]?.status).toBe('SUPERSEDED');
    expect(versions[1]?.status).toBe('PUBLISHED');

    await request(app)
      .delete(`/api/v1/learning/${materialId}`)
      .set('authorization', tenantAAuthorization)
      .expect(200);

    await request(app)
      .get(`/api/v1/learning/${materialId}`)
      .set('authorization', tenantAAuthorization)
      .expect(404);
  });

  it('never returns another tenant material', async () => {
    const created = await request(app)
      .post('/api/v1/learning')
      .set('authorization', tenantBAuthorization)
      .send({ title: 'Tenant B only material', type: 'link', url: 'https://example.com/b' })
      .expect(201);
    const materialId = (created.body as { data: { id: string } }).data.id;

    await request(app)
      .get(`/api/v1/learning/${materialId}`)
      .set('authorization', tenantAAuthorization)
      .expect(404);

    const list = await request(app)
      .get('/api/v1/learning')
      .set('authorization', tenantAAuthorization)
      .expect(200);
    const listBody = list.body as { data: { rows: Array<{ id: string }> } };
    expect(listBody.data.rows.some((row) => row.id === materialId)).toBe(false);
  });

  it('rejects a category from another tenant', async () => {
    await request(app)
      .post('/api/v1/learning')
      .set('authorization', tenantAAuthorization)
      .send({
        title: 'Cross-tenant category',
        type: 'link',
        url: 'https://example.com/x',
        categoryId: tenantBCategoryId
      })
      .expect(422);
  });
});

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

integration('Manual review queue HTTP routes (PostgreSQL-backed)', () => {
  const context = { requestId: randomUUID(), ip: '127.0.0.1', userAgent: 'vitest' };

  let app: Express;
  let adminAuthorization: string;
  let employeeAuthorization: string;
  let attemptId: string;
  let questionId: string;
  let testTitle: string;

  beforeAll(async () => {
    if (!prisma) throw new Error('TEST_DATABASE_URL is required.');
    const db = prisma;
    const suffix = randomUUID().slice(0, 8);

    const hashKey = 'integration-hash-key-with-at-least-32-characters';
    const signingKey = 'integration-signing-key-with-at-least-32-characters';
    const tokens = createTokenService({ signingKey, hashKey, accessTokenTtlSeconds: 900 });
    const authService = new AuthService({
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
        companyName: `Review Co ${suffix}`,
        fullName: 'Tenant Admin',
        email: `review-${suffix}@example.com`,
        password: 'correct-password',
        referralCode: ''
      },
      context
    );
    if (!admin.company) throw new Error('Expected a company.');
    adminAuthorization = `Bearer ${admin.accessToken}`;

    const employeeEmail = `review-employee-${suffix}@example.com`;
    const employeeResponse = await request(app)
      .post('/api/v1/employees')
      .set('authorization', adminAuthorization)
      .send({
        fullName: 'Review Employee',
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

    const category = await request(app)
      .post('/api/v1/categories')
      .set('authorization', adminAuthorization)
      .send({ name: `Review Category ${suffix}` })
      .expect(201);
    const categoryId = (category.body as { data: { id: string } }).data.id;

    const question = await request(app)
      .post('/api/v1/questions')
      .set('authorization', adminAuthorization)
      .send({
        title: `Spot the mistakes ${suffix}`,
        type: 'find_mistakes',
        categoryId,
        difficulty: 'junior',
        marks: 10,
        negativeMarks: 0,
        content: {
          imageUrl: 'https://example.com/screenshot.png',
          mode: 'typed',
          mistakes: [{ id: 'm1', label: 'Missing semicolon' }],
          distractors: []
        }
      })
      .expect(201);
    questionId = (question.body as { data: { id: string } }).data.id;

    testTitle = `Typed Review Test ${suffix}`;
    const test = await request(app)
      .post('/api/v1/tests')
      .set('authorization', adminAuthorization)
      .send({
        title: testTitle,
        categoryId,
        difficulty: 'junior',
        mode: 'fixed',
        questionIds: [questionId],
        randomConfig: null,
        settings: {
          passingPercentage: 50,
          timeLimitMin: 30,
          timeLimitPerQuestionSec: 0,
          attemptsAllowed: 2,
          negativeMarking: false,
          shuffleQuestions: false,
          shuffleOptions: false,
          antiCheat: {
            fullScreen: false,
            tabSwitchDetection: false,
            tabSwitchLimit: 3,
            disableCopyPaste: false,
            webcamCapture: false
          }
        }
      })
      .expect(201);
    const testId = (test.body as { data: { id: string } }).data.id;
    await request(app)
      .post(`/api/v1/tests/${testId}/publish`)
      .set('authorization', adminAuthorization)
      .expect(200);
    await request(app)
      .post(`/api/v1/tests/${testId}/assign`)
      .set('authorization', adminAuthorization)
      .send({ targetType: 'company', targetIds: [], targetKeys: [], dueAt: null })
      .expect(201);

    const started = await request(app)
      .post('/api/v1/attempts/start')
      .set('authorization', employeeAuthorization)
      .send({ testId })
      .expect(201);
    attemptId = (started.body as { data: { id: string } }).data.id;

    await request(app)
      .patch(`/api/v1/attempts/${attemptId}/answers`)
      .set('authorization', employeeAuthorization)
      .send({
        questionId,
        answer: { typedAnswers: ['Missing semicolon'] },
        sequence: 1
      })
      .expect(200);

    const submitted = await request(app)
      .post(`/api/v1/attempts/${attemptId}/submit`)
      .set('authorization', employeeAuthorization)
      .expect(200);
    expect((submitted.body as { data: { pendingReview: boolean } }).data.pendingReview).toBe(true);
  }, 30_000);

  it('rejects unauthenticated requests', async () => {
    await request(app).get('/api/v1/reviews').expect(401);
  });

  it('lists, details and scores the pending attempt', async () => {
    const list = await request(app)
      .get('/api/v1/reviews')
      .set('authorization', adminAuthorization)
      .expect(200);
    const listBody = list.body as {
      data: {
        rows: Array<{ id: string; testTitle: string; pendingCount: number }>;
        totalCount: number;
      };
    };
    const row = listBody.data.rows.find((entry) => entry.id === attemptId);
    expect(row).toBeDefined();
    expect(row?.testTitle).toBe(testTitle);
    expect(row?.pendingCount).toBe(1);

    const detail = await request(app)
      .get(`/api/v1/reviews/${attemptId}`)
      .set('authorization', adminAuthorization)
      .expect(200);
    const detailBody = detail.body as {
      data: {
        id: string;
        rows: Array<{
          questionId: string;
          typedAnswers: string[];
          mistakes: string[];
          suggestedObtained: number;
          max: number;
        }>;
      };
    };
    expect(detailBody.data.id).toBe(attemptId);
    const entry = detailBody.data.rows.find((row_) => row_.questionId === questionId);
    expect(entry).toBeDefined();
    expect(entry?.typedAnswers).toEqual(['Missing semicolon']);
    expect(entry?.mistakes).toEqual(['Missing semicolon']);
    expect(entry?.max).toBe(10);
    expect(entry?.suggestedObtained).toBeGreaterThan(0);

    const scored = await request(app)
      .post(`/api/v1/reviews/${attemptId}/${questionId}`)
      .set('authorization', adminAuthorization)
      .send({ obtained: 10 })
      .expect(200);
    const scoredBody = scored.body as {
      data: { obtained: number; percentage: number; pendingReview: boolean; message: string };
    };
    expect(scoredBody.data.pendingReview).toBe(false);
    expect(scoredBody.data.obtained).toBe(10);
    expect(scoredBody.data.percentage).toBe(100);

    if (!prisma) throw new Error('TEST_DATABASE_URL is required.');
    const publicId = attemptId;
    const attempt = await prisma.assessmentAttempt.findFirstOrThrow({
      where: { publicId }
    });
    expect(attempt.status).toBe('PUBLISHED');
    expect(attempt.passed).toBe(true);

    const listAfter = await request(app)
      .get('/api/v1/reviews')
      .set('authorization', adminAuthorization)
      .expect(200);
    const listAfterBody = listAfter.body as { data: { rows: Array<{ id: string }> } };
    expect(listAfterBody.data.rows.some((entry_) => entry_.id === attemptId)).toBe(false);
  });

  it('rejects scoring a question that is not awaiting review', async () => {
    await request(app)
      .post(`/api/v1/reviews/${attemptId}/${questionId}`)
      .set('authorization', adminAuthorization)
      .send({ obtained: 5 })
      .expect(404);
  });
});

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

integration('Learning path HTTP routes (PostgreSQL-backed)', () => {
  const context = { requestId: randomUUID(), ip: '127.0.0.1', userAgent: 'vitest' };

  let app: Express;
  let adminAuthorization: string;
  let employeeAuthorization: string;
  let categoryId: string;
  let materialId: string;
  let testId: string;

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
        companyName: `Paths Co ${suffix}`,
        fullName: 'Tenant Admin',
        email: `paths-${suffix}@example.com`,
        password: 'correct-password',
        referralCode: ''
      },
      context
    );
    if (!admin.company) throw new Error('Expected a company.');
    adminAuthorization = `Bearer ${admin.accessToken}`;

    const employeeEmail = `paths-employee-${suffix}@example.com`;
    const employeeResponse = await request(app)
      .post('/api/v1/employees')
      .set('authorization', adminAuthorization)
      .send({
        fullName: 'Paths Employee',
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
      .send({ name: `Paths Category ${suffix}` })
      .expect(201);
    categoryId = (category.body as { data: { id: string } }).data.id;

    const material = await request(app)
      .post('/api/v1/learning')
      .set('authorization', adminAuthorization)
      .send({
        title: `Onboarding Reading ${suffix}`,
        categoryId,
        type: 'article',
        url: 'https://example.com/onboarding'
      })
      .expect(201);
    materialId = (material.body as { data: { id: string } }).data.id;

    const question = await request(app)
      .post('/api/v1/questions')
      .set('authorization', adminAuthorization)
      .send({
        title: `Path Question ${suffix}?`,
        type: 'mcq',
        categoryId,
        difficulty: 'junior',
        marks: 10,
        negativeMarks: 0,
        content: {
          options: [
            { id: 'a', text: 'Wrong' },
            { id: 'b', text: 'Right' }
          ],
          correctOptionIds: ['b'],
          multiple: false,
          partialCredit: false
        }
      })
      .expect(201);
    const questionId = (question.body as { data: { id: string } }).data.id;

    const test = await request(app)
      .post('/api/v1/tests')
      .set('authorization', adminAuthorization)
      .send({
        title: `Path Final Test ${suffix}`,
        categoryId,
        difficulty: 'junior',
        mode: 'fixed',
        questionIds: [questionId],
        randomConfig: null,
        settings: {
          passingPercentage: 60,
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
    testId = (test.body as { data: { id: string } }).data.id;
    await request(app)
      .post(`/api/v1/tests/${testId}/publish`)
      .set('authorization', adminAuthorization)
      .expect(200);
  }, 30_000);

  it('rejects unauthenticated requests', async () => {
    await request(app).get('/api/v1/paths').expect(401);
  });

  it('creates, lists, assigns, tracks progress and deletes a learning path', async () => {
    const created = await request(app)
      .post('/api/v1/paths')
      .set('authorization', adminAuthorization)
      .send({
        title: 'Fresher Onboarding',
        description: 'Read, practise, then pass the final test.',
        steps: [
          { kind: 'material', title: 'Read the handbook', materialId },
          {
            kind: 'practice',
            title: 'Practise the basics',
            practice: { categoryId, difficulty: 'junior', count: 5 }
          },
          { kind: 'test', title: 'Pass the final test', testId }
        ]
      })
      .expect(201);
    const pathId = (created.body as { data: { id: string } }).data.id;

    const list = await request(app)
      .get('/api/v1/paths')
      .set('authorization', adminAuthorization)
      .expect(200);
    const listBody = list.body as {
      data: { rows: Array<{ id: string; stepCount: number }> };
    };
    const row = listBody.data.rows.find((entry) => entry.id === pathId);
    expect(row).toBeDefined();
    expect(row?.stepCount).toBe(3);

    const assign = await request(app)
      .post(`/api/v1/paths/${pathId}/assign`)
      .set('authorization', adminAuthorization)
      .send({ targetType: 'company' })
      .expect(201);
    expect((assign.body as { data: { message: string } }).data.message).toContain('assigned');

    const mineBefore = await request(app)
      .get('/api/v1/paths/mine')
      .set('authorization', employeeAuthorization)
      .expect(200);
    const mineBeforeBody = mineBefore.body as {
      data: {
        rows: Array<{
          id: string;
          totalSteps: number;
          completedCount: number;
          steps: Array<{ index: number; kind: string; completed: boolean }>;
        }>;
      };
    };
    const mineRow = mineBeforeBody.data.rows.find((entry) => entry.id === pathId);
    expect(mineRow).toBeDefined();
    expect(mineRow?.totalSteps).toBe(3);
    expect(mineRow?.completedCount).toBe(0);
    expect(mineRow?.steps.every((step) => !step.completed)).toBe(true);

    await request(app)
      .post(`/api/v1/paths/${pathId}/steps/1/complete`)
      .set('authorization', employeeAuthorization)
      .expect(422);

    await request(app)
      .post(`/api/v1/paths/${pathId}/steps/0/complete`)
      .set('authorization', employeeAuthorization)
      .expect(200);

    const mineAfter = await request(app)
      .get('/api/v1/paths/mine')
      .set('authorization', employeeAuthorization)
      .expect(200);
    const mineAfterBody = mineAfter.body as {
      data: {
        rows: Array<{
          id: string;
          completedCount: number;
          steps: Array<{ index: number; completed: boolean }>;
        }>;
      };
    };
    const mineRowAfter = mineAfterBody.data.rows.find((entry) => entry.id === pathId);
    expect(mineRowAfter?.completedCount).toBe(1);
    expect(mineRowAfter?.steps.find((step) => step.index === 0)?.completed).toBe(true);

    await request(app)
      .delete(`/api/v1/paths/${pathId}`)
      .set('authorization', adminAuthorization)
      .expect(200);

    const listAfterDelete = await request(app)
      .get('/api/v1/paths')
      .set('authorization', adminAuthorization)
      .expect(200);
    const listAfterDeleteBody = listAfterDelete.body as { data: { rows: Array<{ id: string }> } };
    expect(listAfterDeleteBody.data.rows.some((entry) => entry.id === pathId)).toBe(false);
  });

  it('rejects invalid path payloads', async () => {
    const response = await request(app)
      .post('/api/v1/paths')
      .set('authorization', adminAuthorization)
      .send({ title: 'x', steps: [] })
      .expect(422);
    expect((response.body as { success: boolean }).success).toBe(false);
  });
});

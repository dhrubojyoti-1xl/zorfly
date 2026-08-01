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

integration('Recruitment HTTP routes (PostgreSQL-backed)', () => {
  const context = { requestId: randomUUID(), ip: '127.0.0.1', userAgent: 'vitest' };

  let app: Express;
  let adminAuthorization: string;
  let testTitle: string;
  let publishedTestId: string;

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
        companyName: `Recruit Co ${suffix}`,
        fullName: 'Tenant Admin',
        email: `recruit-${suffix}@example.com`,
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
      .send({ name: `Recruit Category ${suffix}` })
      .expect(201);
    const categoryId = (category.body as { data: { id: string } }).data.id;

    const question = await request(app)
      .post('/api/v1/questions')
      .set('authorization', adminAuthorization)
      .send({
        title: `Recruit Question ${suffix}?`,
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

    testTitle = `Recruitment Test ${suffix}`;
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
    publishedTestId = (test.body as { data: { id: string } }).data.id;
    await request(app)
      .post(`/api/v1/tests/${publishedTestId}/publish`)
      .set('authorization', adminAuthorization)
      .expect(200);
  }, 30_000);

  it('rejects unauthenticated requests', async () => {
    await request(app).get('/api/v1/drives').expect(401);
  });

  it('runs the full drive → public apply → decision workflow', async () => {
    const testId = publishedTestId;
    const suffix = randomUUID().slice(0, 8);

    const created = await request(app)
      .post('/api/v1/drives')
      .set('authorization', adminAuthorization)
      .send({
        title: `Frontend Engineer ${suffix}`,
        description: 'Pre-hire screening.',
        testId,
        showResultToCandidate: true
      })
      .expect(201);
    const createdBody = created.body as { data: { id: string; token: string } };
    const driveId = createdBody.data.id;
    const token = createdBody.data.token;
    expect(token).toMatch(/^[a-f0-9]{32}$/);

    const list = await request(app)
      .get('/api/v1/drives')
      .set('authorization', adminAuthorization)
      .expect(200);
    const listBody = list.body as {
      data: { rows: Array<{ id: string; testTitle: string; status: string }> };
    };
    const row = listBody.data.rows.find((entry) => entry.id === driveId);
    expect(row).toBeDefined();
    expect(row?.testTitle).toBe(testTitle);
    expect(row?.status).toBe('active');

    const info = await request(app).get(`/api/v1/public/drives/${token}`).expect(200);
    const infoBody = info.body as { data: { title: string; testTitle: string; open: boolean } };
    expect(infoBody.data.testTitle).toBe(testTitle);
    expect(infoBody.data.open).toBe(true);

    const registered = await request(app)
      .post(`/api/v1/public/drives/${token}/register`)
      .send({
        fullName: 'Candidate One',
        email: `candidate-${suffix}@example.com`,
        contactNumber: '9876543210'
      })
      .expect(201);
    const registeredBody = registered.body as {
      data: { candidateToken: string; candidateName: string };
    };
    expect(registeredBody.data.candidateName).toBe('Candidate One');
    const candidateAuthorization = `Bearer ${registeredBody.data.candidateToken}`;

    await request(app)
      .post(`/api/v1/public/drives/${token}/register`)
      .send({
        fullName: 'Candidate One',
        email: `candidate-${suffix}@example.com`,
        contactNumber: '9876543210'
      })
      .expect(201);

    const started = await request(app)
      .post('/api/v1/candidate/attempts/start')
      .set('authorization', candidateAuthorization)
      .expect(201);
    const startedBody = started.body as {
      data: { id: string; questions: Array<{ id: string }> };
    };
    const attemptId = startedBody.data.id;
    const questionId = startedBody.data.questions[0]?.id;
    if (!questionId) throw new Error('Expected a question in the candidate attempt.');

    await request(app)
      .patch(`/api/v1/candidate/attempts/${attemptId}/answers`)
      .set('authorization', candidateAuthorization)
      .send({ questionId, answer: { selectedIds: ['b'] } })
      .expect(200);

    const submitted = await request(app)
      .post(`/api/v1/candidate/attempts/${attemptId}/submit`)
      .set('authorization', candidateAuthorization)
      .expect(200);
    const submittedBody = submitted.body as {
      data: { message: string; obtained?: number; percentage?: number };
    };
    expect(submittedBody.data.message).toContain('Thank you');
    expect(submittedBody.data.percentage).toBe(100);

    await request(app)
      .post('/api/v1/candidate/attempts/start')
      .set('authorization', candidateAuthorization)
      .expect(422);

    const detail = await request(app)
      .get(`/api/v1/drives/${driveId}`)
      .set('authorization', adminAuthorization)
      .expect(200);
    const detailBody = detail.body as {
      data: {
        candidates: Array<{
          id: string;
          rank: number | null;
          fullName: string;
          email: string;
          status: string;
          result: { percentage: number } | null;
        }>;
      };
    };
    const candidateRow = detailBody.data.candidates.find(
      (entry) => entry.email === `candidate-${suffix}@example.com`
    );
    expect(candidateRow).toBeDefined();
    expect(candidateRow?.fullName).toBe('Candidate One');
    expect(candidateRow?.rank).toBe(1);
    expect(candidateRow?.result?.percentage).toBe(100);
    expect(candidateRow?.status).toBe('completed');
    const candidateId = candidateRow?.id;
    if (!candidateId) throw new Error('Expected a candidate row.');

    const decided = await request(app)
      .patch(`/api/v1/drives/${driveId}/candidates/${candidateId}`)
      .set('authorization', adminAuthorization)
      .send({ status: 'shortlisted', notes: 'Strong candidate.' })
      .expect(200);
    expect((decided.body as { data: { message: string } }).data.message).toContain(
      'updated successfully'
    );

    const afterDecision = await request(app)
      .get(`/api/v1/drives/${driveId}`)
      .set('authorization', adminAuthorization)
      .expect(200);
    const afterDecisionBody = afterDecision.body as {
      data: { candidates: Array<{ id: string; status: string }> };
    };
    expect(
      afterDecisionBody.data.candidates.find((entry) => entry.id === candidateId)?.status
    ).toBe('shortlisted');

    await request(app)
      .patch(`/api/v1/drives/${driveId}/close`)
      .set('authorization', adminAuthorization)
      .expect(200);
    const afterClose = await request(app)
      .get('/api/v1/drives')
      .set('authorization', adminAuthorization)
      .expect(200);
    const afterCloseBody = afterClose.body as { data: { rows: Array<{ id: string; status: string }> } };
    expect(afterCloseBody.data.rows.find((entry) => entry.id === driveId)?.status).toBe('closed');
  });

  it('rejects an unknown public drive token', async () => {
    await request(app).get('/api/v1/public/drives/does-not-exist').expect(404);
  });
});

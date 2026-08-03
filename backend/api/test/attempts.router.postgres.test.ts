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

integration('Attempt lifecycle HTTP routes (PostgreSQL-backed)', () => {
  const context = { requestId: randomUUID(), ip: '127.0.0.1', userAgent: 'vitest' };

  let app: Express;
  let adminAuthorization: string;
  let employeeAuthorization: string;
  let expiryOnResumeAuthorization: string;
  let expiryOnSaveAuthorization: string;
  let concurrentSubmitAuthorization: string;
  let testId: string;
  let questionId: string;

  async function createLoggedInEmployee(
    authService: AuthService,
    adminAuth: string,
    label: string,
    suffix: string
  ): Promise<string> {
    const email = `attempt-${label}-${suffix}@example.com`;
    const created = await request(app)
      .post('/api/v1/employees')
      .set('authorization', adminAuth)
      .send({ fullName: `Attempt ${label}`, email, role: 'employee', difficultyLevel: 'fresher' })
      .expect(201);
    const temporaryPassword = (created.body as { data: { temporaryPassword: string | null } }).data
      .temporaryPassword;
    if (!temporaryPassword) throw new Error('Expected a temporary employee password.');
    const login = await authService.logIn(
      { email, password: temporaryPassword },
      { requestId: randomUUID(), ip: '127.0.0.1', userAgent: `vitest-${label}` }
    );
    if (!('accessToken' in login)) throw new Error('Expected an employee session.');
    return `Bearer ${login.accessToken}`;
  }

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
        companyName: `Attempt Co ${suffix}`,
        fullName: 'Tenant Admin',
        email: `attempt-${suffix}@example.com`,
        password: 'correct-password',
        referralCode: ''
      },
      context
    );
    if (!admin.company) throw new Error('Expected a company.');
    adminAuthorization = `Bearer ${admin.accessToken}`;

    // Three separate employees: each `/start` call only succeeds while its
    // company-wide assignment is still PENDING/AVAILABLE, and submitting
    // (including the auto-submit paths under test) flips it to COMPLETED —
    // so each scenario below needs its own employee/assignment, not a
    // second attempt from the same one.
    employeeAuthorization = await createLoggedInEmployee(
      authService,
      adminAuthorization,
      'employee',
      suffix
    );
    expiryOnResumeAuthorization = await createLoggedInEmployee(
      authService,
      adminAuthorization,
      'expiry-resume',
      suffix
    );
    expiryOnSaveAuthorization = await createLoggedInEmployee(
      authService,
      adminAuthorization,
      'expiry-save',
      suffix
    );
    concurrentSubmitAuthorization = await createLoggedInEmployee(
      authService,
      adminAuthorization,
      'concurrent-submit',
      suffix
    );

    const category = await request(app)
      .post('/api/v1/categories')
      .set('authorization', adminAuthorization)
      .send({ name: `Attempt Category ${suffix}` })
      .expect(201);
    const categoryId = (category.body as { data: { id: string } }).data.id;

    const question = await request(app)
      .post('/api/v1/questions')
      .set('authorization', adminAuthorization)
      .send({
        title: `Attempt MCQ ${suffix}`,
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
    questionId = (question.body as { data: { id: string } }).data.id;

    const test = await request(app)
      .post('/api/v1/tests')
      .set('authorization', adminAuthorization)
      .send({
        title: `Attempt Test ${suffix}`,
        categoryId,
        difficulty: 'junior',
        mode: 'fixed',
        questionIds: [questionId],
        randomConfig: null,
        settings: {
          passingPercentage: 50,
          timeLimitMin: 30,
          timeLimitPerQuestionSec: 0,
          attemptsAllowed: 3,
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
    await request(app)
      .post(`/api/v1/tests/${testId}/assign`)
      .set('authorization', adminAuthorization)
      .send({ targetType: 'company', targetIds: [], targetKeys: [], dueAt: null })
      .expect(201);
  }, 30_000);

  it('rejects unauthenticated requests', async () => {
    await request(app).get('/api/v1/attempts/does-not-exist').expect(401);
  });

  it('starts, autosaves, resumes, and submits an attempt exactly once', async () => {
    const started = await request(app)
      .post('/api/v1/attempts/start')
      .set('authorization', employeeAuthorization)
      .send({ testId })
      .expect(201);
    const attemptId = (started.body as { data: { id: string } }).data.id;

    await request(app)
      .patch(`/api/v1/attempts/${attemptId}/answers`)
      .set('authorization', employeeAuthorization)
      .send({ questionId, answer: { selectedIds: ['b'] }, sequence: 1 })
      .expect(200);

    const resumed = await request(app)
      .get(`/api/v1/attempts/${attemptId}`)
      .set('authorization', employeeAuthorization)
      .expect(200);
    const resumedBody = resumed.body as { data: { answers: Record<string, unknown> } };
    expect(resumedBody.data.answers[questionId]).toEqual({ selectedIds: ['b'] });

    const submitted = await request(app)
      .post(`/api/v1/attempts/${attemptId}/submit`)
      .set('authorization', employeeAuthorization)
      .expect(200);
    const submittedBody = submitted.body as {
      data: { percentage: number; passed: boolean; late: boolean };
    };
    expect(submittedBody.data.percentage).toBe(100);
    expect(submittedBody.data.passed).toBe(true);
    expect(submittedBody.data.late).toBe(false);

    await request(app)
      .post(`/api/v1/attempts/${attemptId}/submit`)
      .set('authorization', employeeAuthorization)
      .expect(404);

    await request(app)
      .get(`/api/v1/attempts/${attemptId}`)
      .set('authorization', employeeAuthorization)
      .expect(422);
  });

  it('scores exactly once when two /submit requests race each other', async () => {
    const started = await request(app)
      .post('/api/v1/attempts/start')
      .set('authorization', concurrentSubmitAuthorization)
      .send({ testId })
      .expect(201);
    const attemptId = (started.body as { data: { id: string } }).data.id;

    await request(app)
      .patch(`/api/v1/attempts/${attemptId}/answers`)
      .set('authorization', concurrentSubmitAuthorization)
      .send({ questionId, answer: { selectedIds: ['b'] }, sequence: 1 })
      .expect(200);

    const [first, second] = await Promise.all([
      request(app)
        .post(`/api/v1/attempts/${attemptId}/submit`)
        .set('authorization', concurrentSubmitAuthorization),
      request(app)
        .post(`/api/v1/attempts/${attemptId}/submit`)
        .set('authorization', concurrentSubmitAuthorization)
    ]);
    const statuses = [first.status, second.status].sort();
    // Exactly one of the two racing requests wins (200); the loser gets a
    // 409 (raced) or 404 (the winner had already flipped attempt status by
    // the time the loser's initial lookup ran) — never two 200s.
    expect(statuses[0]).toBe(200);
    expect([404, 409]).toContain(statuses[1]);

    if (!prisma) throw new Error('TEST_DATABASE_URL is required.');
    const attempt = await prisma.assessmentAttempt.findFirstOrThrow({
      where: { publicId: attemptId }
    });
    expect(attempt.percentage?.toNumber()).toBe(100);
  });

  it('auto-submits an attempt whose time limit has already passed when the client resumes it', async () => {
    if (!prisma) throw new Error('TEST_DATABASE_URL is required.');
    const started = await request(app)
      .post('/api/v1/attempts/start')
      .set('authorization', expiryOnResumeAuthorization)
      .send({ testId })
      .expect(201);
    const attemptId = (started.body as { data: { id: string } }).data.id;

    await request(app)
      .patch(`/api/v1/attempts/${attemptId}/answers`)
      .set('authorization', expiryOnResumeAuthorization)
      .send({ questionId, answer: { selectedIds: ['b'] }, sequence: 1 })
      .expect(200);

    // Simulate the client never calling /submit before time ran out: push
    // expiresAt into the past directly, the way an abandoned browser tab
    // would leave it.
    await prisma.assessmentAttempt.update({
      where: { publicId: attemptId },
      data: { expiresAt: new Date(Date.now() - 5 * 60_000) }
    });

    const resumeAttempt = await request(app)
      .get(`/api/v1/attempts/${attemptId}`)
      .set('authorization', expiryOnResumeAuthorization)
      .expect(422);
    expect((resumeAttempt.body as { message: string }).message).toMatch(/timed out/i);

    const attempt = await prisma.assessmentAttempt.findFirstOrThrow({
      where: { publicId: attemptId }
    });
    expect(attempt.status).not.toBe('IN_PROGRESS');
    expect(attempt.submittedAt).not.toBeNull();
    expect(attempt.passed).toBe(true);
    const summary = attempt.resultSummary as { late?: boolean } | null;
    expect(summary?.late).toBe(true);

    // Resuming again must not re-score or throw a different error — the
    // attempt is already terminal.
    await request(app)
      .get(`/api/v1/attempts/${attemptId}`)
      .set('authorization', expiryOnResumeAuthorization)
      .expect(422);
  });

  it('auto-submits an expired attempt when the client tries to save one more answer', async () => {
    if (!prisma) throw new Error('TEST_DATABASE_URL is required.');
    const started = await request(app)
      .post('/api/v1/attempts/start')
      .set('authorization', expiryOnSaveAuthorization)
      .send({ testId })
      .expect(201);
    const attemptId = (started.body as { data: { id: string } }).data.id;

    await prisma.assessmentAttempt.update({
      where: { publicId: attemptId },
      data: { expiresAt: new Date(Date.now() - 5 * 60_000) }
    });

    const lateSave = await request(app)
      .patch(`/api/v1/attempts/${attemptId}/answers`)
      .set('authorization', expiryOnSaveAuthorization)
      .send({ questionId, answer: { selectedIds: ['a'] }, sequence: 1 })
      .expect(422);
    expect((lateSave.body as { message: string }).message).toMatch(/submitted automatically/i);

    const attempt = await prisma.assessmentAttempt.findFirstOrThrow({
      where: { publicId: attemptId }
    });
    expect(attempt.status).not.toBe('IN_PROGRESS');
    // The late answer must never have been recorded.
    expect(attempt.percentage?.toNumber() ?? 0).toBe(0);
  });
});

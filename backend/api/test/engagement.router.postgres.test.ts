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

integration('Engagement HTTP routes (PostgreSQL-backed)', () => {
  const context = { requestId: randomUUID(), ip: '127.0.0.1', userAgent: 'vitest' };

  let app: Express;
  let adminAuthorization: string;
  let employeeAuthorization: string;
  let employeeUserId: string;
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
        companyName: `Engage Co ${suffix}`,
        fullName: 'Tenant Admin',
        email: `engage-${suffix}@example.com`,
        password: 'correct-password',
        referralCode: ''
      },
      context
    );
    if (!admin.company) throw new Error('Expected a company.');
    adminAuthorization = `Bearer ${admin.accessToken}`;

    const employeeEmail = `engage-employee-${suffix}@example.com`;
    const employeeResponse = await request(app)
      .post('/api/v1/employees')
      .set('authorization', adminAuthorization)
      .send({
        fullName: 'Engage Employee',
        email: employeeEmail,
        role: 'employee',
        difficultyLevel: 'fresher'
      })
      .expect(201);
    const employeeBody = employeeResponse.body as {
      data: { id: string; temporaryPassword: string | null };
    };
    const temporaryPassword = employeeBody.data.temporaryPassword;
    if (!temporaryPassword) throw new Error('Expected a temporary employee password.');
    const employeeLogin = await authService.logIn(
      { email: employeeEmail, password: temporaryPassword },
      { requestId: randomUUID(), ip: '127.0.0.1', userAgent: 'vitest-employee' }
    );
    if (!('accessToken' in employeeLogin)) throw new Error('Expected an employee session.');
    employeeAuthorization = `Bearer ${employeeLogin.accessToken}`;
    employeeUserId = employeeLogin.user.id;

    const category = await request(app)
      .post('/api/v1/categories')
      .set('authorization', adminAuthorization)
      .send({ name: `Engage Category ${suffix}` })
      .expect(201);
    const categoryId = (category.body as { data: { id: string } }).data.id;

    const question = await request(app)
      .post('/api/v1/questions')
      .set('authorization', adminAuthorization)
      .send({
        title: `Engage Question ${suffix}?`,
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

    testTitle = `Engagement Test ${suffix}`;
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

    const badge = await request(app)
      .post('/api/v1/badges')
      .set('authorization', adminAuthorization)
      .send({
        name: 'Perfect Score',
        description: 'Scored 100% on an assessment.',
        icon: '💯',
        ruleType: 'perfect',
        threshold: 100,
        points: 50
      })
      .expect(201);
    expect((badge.body as { data: { message: string } }).data.message).toContain(
      'created successfully'
    );

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

    const submitted = await request(app)
      .post(`/api/v1/attempts/${attemptId}/submit`)
      .set('authorization', employeeAuthorization)
      .expect(200);
    expect(
      (submitted.body as { data: { percentage: number; passed: boolean } }).data
    ).toMatchObject({ percentage: 100, passed: true });
  }, 30_000);

  it('rejects unauthenticated requests', async () => {
    await request(app).get('/api/v1/badges').expect(401);
    await request(app).get('/api/v1/leaderboard').expect(401);
    await request(app).get('/api/v1/certificates/mine').expect(401);
  });

  it('lists the badge catalogue and toggles a badge', async () => {
    const list = await request(app)
      .get('/api/v1/badges')
      .set('authorization', employeeAuthorization)
      .expect(200);
    const listBody = list.body as {
      data: { rows: Array<{ id: string; name: string; active: boolean }> };
    };
    const badgeRow = listBody.data.rows.find((row) => row.name === 'Perfect Score');
    expect(badgeRow).toBeDefined();
    expect(badgeRow?.active).toBe(true);

    const toggled = await request(app)
      .patch(`/api/v1/badges/${badgeRow?.id}/toggle`)
      .set('authorization', adminAuthorization)
      .expect(200);
    expect((toggled.body as { data: { active: boolean } }).data.active).toBe(false);

    await request(app)
      .patch(`/api/v1/badges/${badgeRow?.id}/toggle`)
      .set('authorization', employeeAuthorization)
      .expect(403);

    await request(app)
      .patch(`/api/v1/badges/${badgeRow?.id}/toggle`)
      .set('authorization', adminAuthorization)
      .expect(200);
  });

  it('awards points and the earned badge for a perfect submission', async () => {
    const mine = await request(app)
      .get('/api/v1/badges/mine')
      .set('authorization', employeeAuthorization)
      .expect(200);
    const mineBody = mine.body as {
      data: { totalPoints: number; badges: Array<{ name: string }> };
    };
    expect(mineBody.data.totalPoints).toBeGreaterThan(0);
    expect(mineBody.data.badges.some((entry) => entry.name === 'Perfect Score')).toBe(true);
  });

  it('auto-issues a certificate for the passing attempt', async () => {
    const mine = await request(app)
      .get('/api/v1/certificates/mine')
      .set('authorization', employeeAuthorization)
      .expect(200);
    const mineBody = mine.body as {
      data: { rows: Array<{ id: string; title: string; percentage: number }> };
    };
    expect(mineBody.data.rows).toHaveLength(1);
    const certificate = mineBody.data.rows[0];
    expect(certificate?.title).toBe(testTitle);
    expect(certificate?.percentage).toBe(100);

    const detail = await request(app)
      .get(`/api/v1/certificates/${certificate?.id}`)
      .set('authorization', employeeAuthorization)
      .expect(200);
    expect((detail.body as { data: { serial: string; companyName: string } }).data.serial).toMatch(
      /^ZF-/
    );

    await request(app)
      .get(`/api/v1/certificates/${certificate?.id}`)
      .set('authorization', adminAuthorization)
      .expect(200);
  });

  it('ranks the employee on the leaderboard', async () => {
    const leaderboard = await request(app)
      .get('/api/v1/leaderboard')
      .set('authorization', adminAuthorization)
      .query({ scope: 'company', period: 'all' })
      .expect(200);
    const leaderboardBody = leaderboard.body as {
      data: { rows: Array<{ userId: string; scorePercentage: number; points: number }> };
    };
    const row = leaderboardBody.data.rows.find((entry) => entry.userId === employeeUserId);
    expect(row).toBeDefined();
    expect(row?.scorePercentage).toBe(100);
    expect(row?.points).toBeGreaterThan(0);
  });
});

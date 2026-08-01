import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseApiEnvironment } from '@zorfly/config';
import {
  AssignmentStatus,
  CycleStatus,
  createPrismaClient,
  type ZorflyPrismaClient
} from '@zorfly/database';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { runSchedulerTick } from '../src/modules/assessment/scheduler.js';
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

function dateKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${String(date.getUTCFullYear())}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

integration('Recurring schedule HTTP routes and tick (PostgreSQL-backed)', () => {
  const context = { requestId: randomUUID(), ip: '127.0.0.1', userAgent: 'vitest' };

  let authService: AuthService;
  let app: Express;
  let adminAuthorization: string;
  let testId: string;
  const openHour = new Date().getUTCHours();

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
        companyName: `Schedules Co ${suffix}`,
        fullName: 'Tenant Admin',
        email: `schedules-${suffix}@example.com`,
        password: 'correct-password',
        referralCode: ''
      },
      context
    );
    if (!admin.company) throw new Error('Expected a company.');
    adminAuthorization = `Bearer ${admin.accessToken}`;

    await request(app)
      .post('/api/v1/employees')
      .set('authorization', adminAuthorization)
      .send({
        fullName: 'Schedules Employee',
        email: `schedules-employee-${suffix}@example.com`,
        role: 'employee',
        difficultyLevel: 'fresher'
      })
      .expect(201);

    const category = await request(app)
      .post('/api/v1/categories')
      .set('authorization', adminAuthorization)
      .send({ name: `Schedules Category ${suffix}` })
      .expect(201);
    const categoryId = (category.body as { data: { id: string } }).data.id;

    const question = await request(app)
      .post('/api/v1/questions')
      .set('authorization', adminAuthorization)
      .send({
        title: `Schedule Question ${suffix}?`,
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
        title: `Recurring Test ${suffix}`,
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
    await request(app).get('/api/v1/schedules').expect(401);
  });

  it('rejects invalid schedule payloads', async () => {
    const response = await request(app)
      .post('/api/v1/schedules')
      .set('authorization', adminAuthorization)
      .send({ testId, frequency: 'weekly' })
      .expect(422);
    expect((response.body as { success: boolean }).success).toBe(false);
  });

  it('creates, lists, toggles, sets blackout dates, ticks and deletes a schedule', async () => {
    const created = await request(app)
      .post('/api/v1/schedules')
      .set('authorization', adminAuthorization)
      .send({
        testId,
        frequency: 'daily',
        openHour,
        windowHours: 1,
        targetType: 'company',
        blackoutDates: []
      })
      .expect(201);
    const scheduleId = (created.body as { data: { id: string } }).data.id;

    const list = await request(app)
      .get('/api/v1/schedules')
      .set('authorization', adminAuthorization)
      .expect(200);
    const listBody = list.body as {
      data: {
        rows: Array<{
          id: string;
          testTitle: string;
          frequency: string;
          windowHours: number;
          targetType: string;
          active: boolean;
        }>;
      };
    };
    const row = listBody.data.rows.find((entry) => entry.id === scheduleId);
    expect(row).toBeDefined();
    expect(row?.frequency).toBe('daily');
    expect(row?.windowHours).toBe(1);
    expect(row?.targetType).toBe('company');
    expect(row?.active).toBe(true);

    const toggled = await request(app)
      .patch(`/api/v1/schedules/${scheduleId}/toggle`)
      .set('authorization', adminAuthorization)
      .expect(200);
    expect((toggled.body as { data: { active: boolean } }).data.active).toBe(false);

    await request(app)
      .patch(`/api/v1/schedules/${scheduleId}/toggle`)
      .set('authorization', adminAuthorization)
      .expect(200);

    const now = new Date();
    now.setUTCHours(openHour, 0, 0, 0);
    const todayKey = dateKey(now);

    const blackout = await request(app)
      .patch(`/api/v1/schedules/${scheduleId}/blackout-dates`)
      .set('authorization', adminAuthorization)
      .send({ blackoutDates: [todayKey] })
      .expect(200);
    expect((blackout.body as { data: { blackoutDates: string[] } }).data.blackoutDates).toEqual([
      todayKey
    ]);

    if (!prisma) throw new Error('TEST_DATABASE_URL is required.');
    const skipped = await runSchedulerTick(prisma, authService, now);
    expect(skipped.cyclesOpened).toBe(0);
    const cyclesAfterBlackout = await prisma.assessmentCycle.findMany({ where: { scheduleId } });
    expect(cyclesAfterBlackout).toHaveLength(0);

    await request(app)
      .patch(`/api/v1/schedules/${scheduleId}/blackout-dates`)
      .set('authorization', adminAuthorization)
      .send({ blackoutDates: [] })
      .expect(200);

    const opened = await runSchedulerTick(prisma, authService, now);
    expect(opened.cyclesOpened).toBeGreaterThanOrEqual(1);
    const cycle = await prisma.assessmentCycle.findFirstOrThrow({ where: { scheduleId } });
    expect(cycle.status).toBe(CycleStatus.OPEN);
    expect(cycle.cycleKey).toBe(todayKey);
    const campaign = await prisma.assignmentCampaign.findFirstOrThrow({
      where: { cycleId: cycle.id }
    });
    const assignments = await prisma.assessmentAssignment.findMany({
      where: { campaignId: campaign.id }
    });
    expect(assignments.length).toBeGreaterThanOrEqual(1);
    const [assignment] = assignments;
    if (!assignment) throw new Error('Expected at least one assignment.');
    expect(assignment.status).toBe(AssignmentStatus.AVAILABLE);

    const rerun = await runSchedulerTick(prisma, authService, now);
    expect(rerun.cyclesOpened).toBe(0);
    const cyclesAfterRerun = await prisma.assessmentCycle.findMany({ where: { scheduleId } });
    expect(cyclesAfterRerun).toHaveLength(1);

    const past = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const closed = await runSchedulerTick(prisma, authService, past);
    expect(closed.assignmentsClosed).toBeGreaterThanOrEqual(1);
    const expiredAssignment = await prisma.assessmentAssignment.findUniqueOrThrow({
      where: { id: assignment.id }
    });
    expect(expiredAssignment.status).toBe(AssignmentStatus.EXPIRED);

    await request(app)
      .delete(`/api/v1/schedules/${scheduleId}`)
      .set('authorization', adminAuthorization)
      .expect(200);

    const listAfterDelete = await request(app)
      .get('/api/v1/schedules')
      .set('authorization', adminAuthorization)
      .expect(200);
    const listAfterDeleteBody = listAfterDelete.body as { data: { rows: Array<{ id: string }> } };
    expect(listAfterDeleteBody.data.rows.some((entry) => entry.id === scheduleId)).toBe(false);
  });
});

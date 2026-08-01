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

integration('Reports HTTP routes (PostgreSQL-backed)', () => {
  const context = { requestId: randomUUID(), ip: '127.0.0.1', userAgent: 'vitest' };

  let app: Express;
  let adminAuthorization: string;
  let employeeAuthorization: string;
  let employeeMembershipId: string;
  let departmentId: string;
  let teamId: string;
  let driveId: string;
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
        companyName: `Report Co ${suffix}`,
        fullName: 'Tenant Admin',
        email: `report-${suffix}@example.com`,
        password: 'correct-password',
        referralCode: ''
      },
      context
    );
    if (!admin.company) throw new Error('Expected a company.');
    adminAuthorization = `Bearer ${admin.accessToken}`;

    const department = await request(app)
      .post('/api/v1/departments')
      .set('authorization', adminAuthorization)
      .send({ name: `Reporting Dept ${suffix}` })
      .expect(201);
    departmentId = (department.body as { data: { id: string } }).data.id;

    const team = await request(app)
      .post('/api/v1/teams')
      .set('authorization', adminAuthorization)
      .send({ name: `Reporting Team ${suffix}`, departmentId })
      .expect(201);
    teamId = (team.body as { data: { id: string } }).data.id;

    const employeeEmail = `report-employee-${suffix}@example.com`;
    const employeeResponse = await request(app)
      .post('/api/v1/employees')
      .set('authorization', adminAuthorization)
      .send({
        fullName: 'Report Employee',
        email: employeeEmail,
        role: 'employee',
        departmentId,
        teamId,
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
    const employeeMembership = await db.tenantMembership.findFirstOrThrow({
      where: { tenantId: admin.company.id, userId: employeeLogin.user.id }
    });
    employeeMembershipId = employeeMembership.id;

    const category = await request(app)
      .post('/api/v1/categories')
      .set('authorization', adminAuthorization)
      .send({ name: `Report Category ${suffix}` })
      .expect(201);
    const categoryId = (category.body as { data: { id: string } }).data.id;

    const question = await request(app)
      .post('/api/v1/questions')
      .set('authorization', adminAuthorization)
      .send({
        title: `Report Question ${suffix}?`,
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

    testTitle = `Report Test ${suffix}`;
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
    const attemptId = (started.body as { data: { id: string } }).data.id;
    await request(app)
      .patch(`/api/v1/attempts/${attemptId}/answers`)
      .set('authorization', employeeAuthorization)
      .send({ questionId, answer: { selectedIds: ['b'] }, sequence: 1 })
      .expect(200);
    await request(app)
      .post(`/api/v1/attempts/${attemptId}/submit`)
      .set('authorization', employeeAuthorization)
      .expect(200);

    const driveCreated = await request(app)
      .post('/api/v1/drives')
      .set('authorization', adminAuthorization)
      .send({
        title: `Report Drive ${suffix}`,
        description: '',
        testId,
        showResultToCandidate: false
      })
      .expect(201);
    const driveBody = driveCreated.body as { data: { id: string; token: string } };
    driveId = driveBody.data.id;
    const registered = await request(app)
      .post(`/api/v1/public/drives/${driveBody.data.token}/register`)
      .send({ fullName: 'Report Candidate', email: `report-candidate-${suffix}@example.com` })
      .expect(201);
    const candidateAuthorization = `Bearer ${(registered.body as { data: { candidateToken: string } }).data.candidateToken}`;
    const candidateStarted = await request(app)
      .post('/api/v1/candidate/attempts/start')
      .set('authorization', candidateAuthorization)
      .expect(201);
    const candidateAttemptId = (candidateStarted.body as { data: { id: string } }).data.id;
    await request(app)
      .patch(`/api/v1/candidate/attempts/${candidateAttemptId}/answers`)
      .set('authorization', candidateAuthorization)
      .send({ questionId, answer: { selectedIds: ['b'] } })
      .expect(200);
    await request(app)
      .post(`/api/v1/candidate/attempts/${candidateAttemptId}/submit`)
      .set('authorization', candidateAuthorization)
      .expect(200);
  }, 30_000);

  it('rejects unauthenticated requests', async () => {
    await request(app).get('/api/v1/reports/leaderboard').expect(401);
  });

  it('returns the individual report for the employee', async () => {
    const response = await request(app)
      .get('/api/v1/reports/individual')
      .set('authorization', adminAuthorization)
      .query({ userId: employeeMembershipId })
      .expect(200);
    const body = response.body as {
      data: { fullName: string; testsAttempted: number; avgPercentage: number };
    };
    expect(body.data.fullName).toBe('Report Employee');
    expect(body.data.testsAttempted).toBe(1);
    expect(body.data.avgPercentage).toBe(100);
  });

  it('rejects individual report without a userId', async () => {
    await request(app)
      .get('/api/v1/reports/individual')
      .set('authorization', adminAuthorization)
      .expect(422);
  });

  it('returns the team and department reports', async () => {
    const team = await request(app)
      .get('/api/v1/reports/team')
      .set('authorization', adminAuthorization)
      .query({ teamId })
      .expect(200);
    const teamBody = team.body as { data: { teamSize: number; totalAttempts: number } };
    expect(teamBody.data.teamSize).toBe(1);
    expect(teamBody.data.totalAttempts).toBe(1);

    const department = await request(app)
      .get('/api/v1/reports/department')
      .set('authorization', adminAuthorization)
      .query({ departmentId })
      .expect(200);
    const departmentBody = department.body as { data: { totalEmployees: number } };
    expect(departmentBody.data.totalEmployees).toBe(1);
  });

  it('returns the company performance and leaderboard reports', async () => {
    const company = await request(app)
      .get('/api/v1/reports/company_performance')
      .set('authorization', adminAuthorization)
      .expect(200);
    const companyBody = company.body as { data: { totalAttempts: number } };
    expect(companyBody.data.totalAttempts).toBe(1);

    const leaderboard = await request(app)
      .get('/api/v1/reports/leaderboard')
      .set('authorization', adminAuthorization)
      .expect(200);
    const leaderboardBody = leaderboard.body as { data: { rows: Array<{ userId: string }> } };
    expect(leaderboardBody.data.rows.length).toBeGreaterThanOrEqual(1);
  });

  it('returns the recruitment drive report', async () => {
    const response = await request(app)
      .get('/api/v1/reports/recruitment_drive')
      .set('authorization', adminAuthorization)
      .query({ driveId })
      .expect(200);
    const body = response.body as {
      data: { driveTitle: string; totalCandidates: number; completed: number };
    };
    expect(body.data.totalCandidates).toBe(1);
    expect(body.data.completed).toBe(1);
  });

  it('exports a CSV for the leaderboard report', async () => {
    const response = await request(app)
      .get('/api/v1/reports/leaderboard/export')
      .set('authorization', adminAuthorization)
      .query({ format: 'csv' })
      .expect(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.text).toContain('fullName');
  });

  it('rejects xlsx/pdf export as not yet available', async () => {
    await request(app)
      .get('/api/v1/reports/leaderboard/export')
      .set('authorization', adminAuthorization)
      .query({ format: 'pdf' })
      .expect(422);
  });

  it('manages report recipients and schedule (Company Admin only)', async () => {
    await request(app)
      .get('/api/v1/reports/settings/recipients')
      .set('authorization', employeeAuthorization)
      .expect(403);

    const list = await request(app)
      .get('/api/v1/reports/settings/recipients')
      .set('authorization', adminAuthorization)
      .expect(200);
    const listBody = list.body as {
      data: { companyAdmins: Array<{ email: string }>; recipients: unknown[] };
    };
    expect(listBody.data.companyAdmins.length).toBeGreaterThanOrEqual(1);
    expect(listBody.data.recipients).toEqual([]);

    const created = await request(app)
      .post('/api/v1/reports/settings/recipients')
      .set('authorization', adminAuthorization)
      .send({ email: 'ops@example.com', reportTypes: ['leaderboard'] })
      .expect(201);
    const recipientId = (created.body as { data: { id: string } }).data.id;

    await request(app)
      .post('/api/v1/reports/settings/recipients')
      .set('authorization', adminAuthorization)
      .send({ email: 'ops@example.com', reportTypes: [] })
      .expect(409);

    const afterAdd = await request(app)
      .get('/api/v1/reports/settings/recipients')
      .set('authorization', adminAuthorization)
      .expect(200);
    expect(
      (afterAdd.body as { data: { recipients: Array<{ id: string }> } }).data.recipients
    ).toHaveLength(1);

    await request(app)
      .patch(`/api/v1/reports/settings/recipients/${recipientId}`)
      .set('authorization', adminAuthorization)
      .send({ active: false })
      .expect(200);

    await request(app)
      .delete(`/api/v1/reports/settings/recipients/${recipientId}`)
      .set('authorization', adminAuthorization)
      .expect(200);

    const afterDelete = await request(app)
      .get('/api/v1/reports/settings/recipients')
      .set('authorization', adminAuthorization)
      .expect(200);
    expect((afterDelete.body as { data: { recipients: unknown[] } }).data.recipients).toHaveLength(
      0
    );

    const schedule = await request(app)
      .patch('/api/v1/reports/settings/schedule')
      .set('authorization', adminAuthorization)
      .send({ frequency: 'weekly', dayOfWeek: 1, sendHour: 8, sendMinute: 0, active: true })
      .expect(200);
    expect((schedule.body as { data: { message: string; frequency: string } }).data.frequency).toBe(
      'weekly'
    );

    const getSchedule = await request(app)
      .get('/api/v1/reports/settings/schedule')
      .set('authorization', adminAuthorization)
      .expect(200);
    expect((getSchedule.body as { data: { frequency: string } }).data.frequency).toBe('weekly');
  });
});

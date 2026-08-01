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

integration('Notifications HTTP routes (PostgreSQL-backed)', () => {
  const context = { requestId: randomUUID(), ip: '127.0.0.1', userAgent: 'vitest' };

  let app: Express;
  let adminAuthorization: string;
  let employeeAuthorization: string;
  let employeeFullName: string;

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
        companyName: `Notify Co ${suffix}`,
        fullName: 'Tenant Admin',
        email: `notify-${suffix}@example.com`,
        password: 'correct-password',
        referralCode: ''
      },
      context
    );
    if (!admin.company) throw new Error('Expected a company.');
    adminAuthorization = `Bearer ${admin.accessToken}`;

    employeeFullName = 'Notify Employee';
    const employeeEmail = `notify-employee-${suffix}@example.com`;
    const employeeResponse = await request(app)
      .post('/api/v1/employees')
      .set('authorization', adminAuthorization)
      .send({
        fullName: employeeFullName,
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
  }, 30_000);

  it('rejects unauthenticated requests', async () => {
    await request(app).get('/api/v1/notifications').expect(401);
  });

  it('lists the welcome notification, marks it read, marks all read, then deletes it', async () => {
    const list = await request(app)
      .get('/api/v1/notifications')
      .set('authorization', employeeAuthorization)
      .expect(200);
    const listBody = list.body as {
      data: {
        rows: Array<{ id: string; type: string; title: string; body: string; read: boolean }>;
        totalCount: number;
        unreadCount: number;
      };
    };
    expect(listBody.data.totalCount).toBeGreaterThanOrEqual(1);
    expect(listBody.data.unreadCount).toBeGreaterThanOrEqual(1);
    const welcome = listBody.data.rows.find((row) => row.type === 'employee_added');
    expect(welcome).toBeDefined();
    expect(welcome?.read).toBe(false);
    const notificationId = welcome?.id;
    if (!notificationId) throw new Error('Expected a welcome notification.');

    const unreadOnly = await request(app)
      .get('/api/v1/notifications')
      .set('authorization', employeeAuthorization)
      .query({ status: 'unread' })
      .expect(200);
    const unreadBody = unreadOnly.body as { data: { rows: Array<{ id: string }> } };
    expect(unreadBody.data.rows.some((row) => row.id === notificationId)).toBe(true);

    await request(app)
      .patch(`/api/v1/notifications/${notificationId}/read`)
      .set('authorization', employeeAuthorization)
      .expect(200);

    const afterRead = await request(app)
      .get('/api/v1/notifications')
      .set('authorization', employeeAuthorization)
      .expect(200);
    const afterReadBody = afterRead.body as {
      data: { rows: Array<{ id: string; read: boolean }> };
    };
    expect(afterReadBody.data.rows.find((row) => row.id === notificationId)?.read).toBe(true);

    await request(app)
      .patch('/api/v1/notifications/read-all')
      .set('authorization', employeeAuthorization)
      .expect(200);

    const afterMarkAll = await request(app)
      .get('/api/v1/notifications')
      .set('authorization', employeeAuthorization)
      .expect(200);
    expect((afterMarkAll.body as { data: { unreadCount: number } }).data.unreadCount).toBe(0);

    await request(app)
      .delete(`/api/v1/notifications/${notificationId}`)
      .set('authorization', employeeAuthorization)
      .expect(200);

    const afterDelete = await request(app)
      .get('/api/v1/notifications')
      .set('authorization', employeeAuthorization)
      .expect(200);
    const afterDeleteBody = afterDelete.body as { data: { rows: Array<{ id: string }> } };
    expect(afterDeleteBody.data.rows.some((row) => row.id === notificationId)).toBe(false);
  });

  it('rejects reading a notification that does not belong to the caller', async () => {
    await request(app)
      .patch('/api/v1/notifications/999999999/read')
      .set('authorization', adminAuthorization)
      .expect(404);
  });
});

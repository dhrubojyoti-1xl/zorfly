import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { createPrismaClient } from '@zorfly/database';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { passwordHasher } from '../src/modules/auth/password.js';
import { PrismaAuthRepository } from '../src/modules/auth/prisma-auth.repository.js';
import { createTokenService } from '../src/modules/auth/tokens.js';

const connectionString = process.env.TEST_DATABASE_URL;
const integration = describe.runIf(Boolean(connectionString));
const prisma = connectionString ? createPrismaClient(connectionString) : null;

afterAll(async () => {
  await prisma?.$disconnect();
});

integration('Prisma/PostgreSQL authentication repository', () => {
  it('registers, logs in, selects a tenant, and rotates a persisted session', async () => {
    if (!prisma) throw new Error('TEST_DATABASE_URL is required.');
    const hashKey = 'integration-hash-key-with-at-least-32-characters';
    const tokens = createTokenService({
      signingKey: 'integration-signing-key-with-at-least-32-characters',
      hashKey,
      accessTokenTtlSeconds: 900
    });
    const service = new AuthService({
      repository: new PrismaAuthRepository(prisma, hashKey),
      passwordHasher,
      tokens,
      mailer: { send: () => Promise.resolve() },
      refreshTokenTtlSeconds: 604_800,
      appUrl: 'http://localhost:5173'
    });
    const email = `auth-${randomUUID()}@example.com`;
    const password = 'correct-password';
    const context = { requestId: randomUUID(), ip: '127.0.0.1', userAgent: 'vitest' };

    const first = await service.registerCompany(
      {
        companyName: 'First Company',
        fullName: 'Integration User',
        email,
        password,
        referralCode: ''
      },
      context
    );
    const second = await service.registerCompany(
      {
        companyName: 'Second Company',
        fullName: 'Integration User',
        email,
        password,
        referralCode: ''
      },
      context
    );

    expect(first.company?.id).not.toBe(second.company?.id);
    const login = await service.logIn({ email, password }, context);
    if (!('preAuthToken' in login) || !login.preAuthToken || !login.companies || !first.company) {
      throw new Error('Expected a multi-company login response.');
    }
    const companyIds = login.companies.map((company) => company.id);
    expect(login.requiresCompanySelection).toBe(true);
    expect(companyIds).toContain(first.company.id);
    expect(companyIds).toContain(second.company?.id);

    const selected = await service.selectCompany(
      { preAuthToken: login.preAuthToken, companyId: first.company.id },
      context
    );
    const refreshed = await service.refreshSession(selected.refreshToken, context);

    expect(refreshed.company?.id).toBe(first.company.id);
    expect(refreshed.refreshToken).not.toBe(selected.refreshToken);
    await expect(service.refreshSession(selected.refreshToken, context)).rejects.toMatchObject({
      statusCode: 401
    });
  }, 15_000);
});

import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { parseApiEnvironment } from '@zorfly/config';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import type {
  AuthRepository,
  AuthUser,
  CompanyMembership
} from '../src/modules/auth/auth.types.js';
import type { PasswordHasher } from '../src/modules/auth/password.js';
import { createTokenService } from '../src/modules/auth/tokens.js';

const environment = parseApiEnvironment({
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  SESSION_SIGNING_KEY: 'test-signing-key-with-at-least-32-characters',
  SESSION_HASH_KEY: 'test-hash-key-with-at-least-32-characters'
});

const user: AuthUser = {
  id: '10000000-0000-4000-8000-000000000001',
  fullName: 'Test User',
  email: 'user@example.com',
  contactNumber: '',
  platformRole: null,
  status: 'ACTIVE',
  passwordHash: 'hash:correct-password'
};

const membership: CompanyMembership = {
  membershipId: '20000000-0000-4000-8000-000000000001',
  userId: user.id,
  company: {
    id: '30000000-0000-4000-8000-000000000001',
    name: 'Example Company',
    slug: 'example-company',
    logoUrl: '',
    timeZone: 'Asia/Kolkata'
  },
  role: 'company_admin'
};

const passwordHasher: PasswordHasher = {
  hash: (password) => Promise.resolve(`hash:${password}`),
  verify: (hash, password) => Promise.resolve(hash === `hash:${password}`)
};

function createRepository(overrides: Partial<AuthRepository> = {}): AuthRepository {
  return {
    findUserByEmail: vi.fn(() => Promise.resolve(user)),
    findUserById: vi.fn(() => Promise.resolve(user)),
    registerTenant: vi.fn(() => Promise.resolve(membership)),
    listActiveMemberships: vi.fn(() => Promise.resolve([membership])),
    findActiveMembership: vi.fn(() => Promise.resolve(membership)),
    markAuthenticated: vi.fn(() => Promise.resolve()),
    updateProfile: vi.fn(() => Promise.resolve(user)),
    updatePassword: vi.fn(() => Promise.resolve(true)),
    createPasswordResetToken: vi.fn(() => Promise.resolve(user.id)),
    consumePasswordResetToken: vi.fn(() => Promise.resolve(user.id)),
    createSession: vi.fn(() => Promise.resolve()),
    findSession: vi.fn(() => Promise.resolve(null)),
    rotateSession: vi.fn(() => Promise.resolve()),
    revokeSession: vi.fn(() => Promise.resolve()),
    resolvePermissions: vi.fn(() => Promise.resolve(['tests:read'])),
    audit: vi.fn(() => Promise.resolve()),
    createNotification: vi.fn(() => Promise.resolve()),
    ...overrides
  };
}

function createAuthApp(repository: AuthRepository) {
  const tokens = createTokenService({
    signingKey: environment.SESSION_SIGNING_KEY,
    hashKey: environment.SESSION_HASH_KEY,
    accessTokenTtlSeconds: environment.ACCESS_TOKEN_TTL_SECONDS
  });
  const service = new AuthService({
    repository,
    passwordHasher,
    tokens,
    mailer: { send: vi.fn(() => Promise.resolve()) },
    refreshTokenTtlSeconds: environment.REFRESH_TOKEN_TTL_SECONDS,
    appUrl: environment.APP_URL
  });
  return {
    app: createApp({ environment, version: 'test', auth: { service, tokens } }),
    tokens
  };
}

describe('OneXL-compatible authentication API', () => {
  it('preserves field-level validation messages and the legacy error envelope', async () => {
    const { app } = createAuthApp(createRepository());
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: '' })
      .expect(422);
    const body = response.body as Record<string, unknown>;

    expect(body).toEqual({
      success: false,
      message: 'Enter a valid Email ID.',
      errors: {
        email: 'Enter a valid Email ID.',
        password: 'Password is required.'
      }
    });
  });

  it('logs a single-company user straight in and sets the refresh cookie', async () => {
    const createSession = vi.fn(() => Promise.resolve());
    const repository = createRepository({ createSession });
    const { app } = createAuthApp(repository);
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'correct-password' })
      .expect(200);
    const body = response.body as {
      data: { accessToken: unknown };
    };

    expect(body).toMatchObject({
      success: true,
      data: {
        requiresCompanySelection: false,
        user: { id: user.id, email: user.email },
        company: { id: membership.company.id },
        role: 'company_admin'
      }
    });
    expect(body.data.accessToken).toEqual(expect.any(String));
    expect(response.headers['set-cookie']?.[0]).toContain('zorfly_refresh=');
    expect(createSession).toHaveBeenCalledOnce();
  });

  it('returns a pre-auth token and company list when selection is required', async () => {
    const secondMembership: CompanyMembership = {
      ...membership,
      membershipId: '20000000-0000-4000-8000-000000000002',
      company: {
        ...membership.company,
        id: '30000000-0000-4000-8000-000000000002',
        name: 'Second Company',
        slug: 'second-company'
      }
    };
    const repository = createRepository({
      listActiveMemberships: vi.fn(() => Promise.resolve([membership, secondMembership]))
    });
    const { app } = createAuthApp(repository);
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'correct-password' })
      .expect(200);
    const body = response.body as {
      data: { preAuthToken: unknown };
    };

    expect(body.data).toMatchObject({
      requiresCompanySelection: true,
      companies: [
        { id: membership.company.id, role: 'company_admin' },
        { id: secondMembership.company.id, role: 'company_admin' }
      ]
    });
    expect(body.data.preAuthToken).toEqual(expect.any(String));
  });

  it('rechecks tenant membership when exchanging a company-selection token', async () => {
    const repository = createRepository({
      findActiveMembership: vi.fn(() => Promise.resolve(null))
    });
    const { app, tokens } = createAuthApp(repository);
    const response = await request(app)
      .post('/api/v1/auth/select-company')
      .send({
        preAuthToken: tokens.signPreAuthToken(user.id),
        companyId: membership.company.id
      })
      .expect(403);
    const body = response.body as Record<string, unknown>;

    expect(body).toEqual({
      success: false,
      message: 'You do not have access to the selected company.'
    });
  });
});

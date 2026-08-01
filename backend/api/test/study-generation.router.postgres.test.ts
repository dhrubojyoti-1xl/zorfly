import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { parseApiEnvironment } from '@zorfly/config';
import { createPrismaClient, type ZorflyPrismaClient } from '@zorfly/database';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { passwordHasher } from '../src/modules/auth/password.js';
import { PrismaAuthRepository } from '../src/modules/auth/prisma-auth.repository.js';
import { createTokenService } from '../src/modules/auth/tokens.js';
import {
  ensureModelConfiguration,
  ensureProviderCatalog,
  ensureTenantProviderConfiguration
} from '../src/modules/ai/ai.repository.js';
import { AiExecutionService } from '../src/modules/ai/ai.service.js';
import { InMemorySecretResolver } from '../src/modules/ai/secret-resolver.js';
import type { HttpTransport } from '../src/modules/ai/providers/http-transport.js';

const connectionString = process.env.TEST_DATABASE_URL;
const integration = describe.runIf(Boolean(connectionString));
const prisma: ZorflyPrismaClient | null = connectionString
  ? createPrismaClient(connectionString)
  : null;

afterAll(async () => {
  await prisma?.$disconnect();
});

const pricedCatalog = [
  {
    providerKey: 'claude',
    providerName: 'Anthropic Claude',
    modelKey: 'claude-sonnet-5',
    modelDisplayName: 'Claude Sonnet 5',
    capabilities: ['text', 'structured_output'],
    // AIProvider/AIModel are a global (not per-test) catalog and
    // ensureProviderCatalog only sets pricing on first insert - keep this in
    // sync with every other *.postgres.test.ts file's pricedCatalog so
    // whichever test file's seed call wins the race still leaves the shared
    // 'claude' model priced the same way everywhere.
    inputPricePerMillion: 3,
    outputPricePerMillion: 15
  }
] as const;

function claudeStudyResponse(): Response {
  return new Response(
    JSON.stringify({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            title: 'Customer Service Fundamentals',
            overview: 'A short primer on customer service best practices.',
            sections: [
              { heading: 'Active listening', body: 'Repeat back what the customer said.' },
              { heading: 'Tone', body: 'Stay warm and professional.' }
            ],
            keyPoints: ['Listen first', 'Stay calm', 'Follow up'],
            practiceQuestions: [
              {
                question: 'What should you do first when a customer complains?',
                options: ['Interrupt', 'Listen actively', 'Hang up'],
                correctIndex: 1,
                explanation: 'Active listening builds trust before proposing a solution.'
              }
            ]
          })
        }
      ],
      model: 'claude-sonnet-5',
      stop_reason: 'end_turn',
      usage: { input_tokens: 140, output_tokens: 90, cache_read_input_tokens: 0 }
    }),
    { status: 200, headers: { 'content-type': 'application/json', 'request-id': 'req_study' } }
  );
}

integration('AI study-generation HTTP routes (PostgreSQL-backed)', () => {
  const context = { requestId: randomUUID(), ip: '127.0.0.1', userAgent: 'vitest' };

  let authService: AuthService;
  let app: Express;
  let tenantId: string;
  let adminAuthorization: string;
  let employeeAuthorization: string;

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
    const transport: HttpTransport = { fetch: vi.fn(() => Promise.resolve(claudeStudyResponse())) };
    const aiService = new AiExecutionService({
      prisma: db,
      secretResolver: new InMemorySecretResolver({ TEST_CLAUDE_KEY: 'sk-test' }),
      transport
    });
    app = createApp({
      environment,
      version: 'test',
      auth: { service: authService, tokens },
      organization: { prisma: db },
      ai: { service: aiService }
    });

    await ensureProviderCatalog(db, pricedCatalog);

    const admin = await authService.registerCompany(
      {
        companyName: `Study Gen Co ${suffix}`,
        fullName: 'Tenant Admin',
        email: `study-gen-${suffix}@example.com`,
        password: 'correct-password',
        referralCode: ''
      },
      context
    );
    if (!admin.company) throw new Error('Expected a company.');
    tenantId = admin.company.id;
    adminAuthorization = `Bearer ${admin.accessToken}`;

    await ensureTenantProviderConfiguration(db, tenantId, 'claude', 'TEST_CLAUDE_KEY');
    await ensureModelConfiguration(db, {
      tenantId,
      key: 'question-generation.default',
      purpose: 'QUESTION_GENERATION',
      providerKey: 'claude',
      modelKey: 'claude-sonnet-5'
    });

    const employeeEmail = `study-gen-employee-${suffix}@example.com`;
    const employeeResponse = await request(app)
      .post('/api/v1/employees')
      .set('authorization', adminAuthorization)
      .send({
        fullName: 'No Permission Employee',
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
    await request(app).post('/api/v1/ai/study/generate').send({}).expect(401);
  });

  it('rejects users without learning:manage', async () => {
    await request(app)
      .post('/api/v1/ai/study/generate')
      .set('authorization', employeeAuthorization)
      .send({ topic: 'Customer service tone', contentType: 'study_guide' })
      .expect(403);
  });

  it('generates and persists study material with a self-check practice question', async () => {
    if (!prisma) throw new Error('TEST_DATABASE_URL is required.');
    const response = await request(app)
      .post('/api/v1/ai/study/generate')
      .set('authorization', adminAuthorization)
      .set('idempotency-key', `study-generate-${randomUUID()}`)
      .send({
        topic: 'Customer service tone and etiquette',
        contentType: 'study_guide',
        questionCount: 3
      })
      .expect(201);
    const body = response.body as { data: { id: string; title: string; message: string } };
    expect(body.data.title).toBe('Customer Service Fundamentals');

    const material = await prisma.learningMaterial.findUniqueOrThrow({
      where: { id: body.data.id },
      include: { currentVersion: true }
    });
    expect(material.tenantId).toBe(tenantId);
    expect(material.contentType).toBe('STUDY_GUIDE');
    expect(material.status).toBe('ACTIVE');

    const versionBody = material.currentVersion?.body as {
      body: { overview: string; sections: unknown[]; keyPoints: string[] };
      questions: unknown[];
      source: string;
    };
    expect(versionBody.source).toBe('ai');
    expect(versionBody.body.sections).toHaveLength(2);
    expect(versionBody.questions).toHaveLength(1);

    const detail = await request(app)
      .get(`/api/v1/learning/${body.data.id}`)
      .set('authorization', adminAuthorization)
      .expect(200);
    const detailBody = detail.body as { data: { source: string; type: string } };
    expect(detailBody.data.source).toBe('ai');
    expect(detailBody.data.type).toBe('study_guide');
  });
});

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
    inputPricePerMillion: 3,
    outputPricePerMillion: 15
  }
] as const;

function claudeQuestionsResponse(): Response {
  return new Response(
    JSON.stringify({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            questions: [
              {
                type: 'mcq',
                title: 'Which greeting best reflects customer-service tone?',
                options: [
                  { text: 'Friendly, clear, and professional', correct: true },
                  { text: 'Curt and dismissive', correct: false }
                ],
                multiple: false,
                explanation: 'Friendly, clear communication builds trust with customers.'
              }
            ]
          })
        }
      ],
      model: 'claude-sonnet-5',
      stop_reason: 'end_turn',
      usage: { input_tokens: 120, output_tokens: 60, cache_read_input_tokens: 0 }
    }),
    { status: 200, headers: { 'content-type': 'application/json', 'request-id': 'req_ai_router' } }
  );
}

integration('AI question-generation HTTP routes (PostgreSQL-backed)', () => {
  const context = { requestId: randomUUID(), ip: '127.0.0.1', userAgent: 'vitest' };
  const fetchImpl = vi.fn(() => Promise.resolve(claudeQuestionsResponse()));

  let authService: AuthService;
  let app: Express;
  let tenantAId: string;
  let tenantAAuthorization: string;
  let tenantAAdminUserId: string;
  let employeeAuthorization: string;
  let tenantACategoryId: string;
  let tenantBAuthorization: string;
  let tenantBCategoryId: string;

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
    const transport: HttpTransport = { fetch: fetchImpl };
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

    const adminA = await authService.registerCompany(
      {
        companyName: `AI Router Co ${suffix}`,
        fullName: 'Tenant A Admin',
        email: `ai-router-a-${suffix}@example.com`,
        password: 'correct-password',
        referralCode: ''
      },
      context
    );
    if (!adminA.company) throw new Error('Expected a company for tenant A.');
    tenantAId = adminA.company.id;
    tenantAAuthorization = `Bearer ${adminA.accessToken}`;
    tenantAAdminUserId = adminA.user.id;

    await ensureTenantProviderConfiguration(db, tenantAId, 'claude', 'TEST_CLAUDE_KEY');
    await ensureModelConfiguration(db, {
      tenantId: tenantAId,
      key: 'question-generation.default',
      purpose: 'QUESTION_GENERATION',
      providerKey: 'claude',
      modelKey: 'claude-sonnet-5'
    });

    const categoryA = await request(app)
      .post('/api/v1/categories')
      .set('authorization', tenantAAuthorization)
      .send({ name: `AI Category ${suffix}` })
      .expect(201);
    tenantACategoryId = (categoryA.body as { data: { id: string } }).data.id;

    const employeeEmail = `ai-router-employee-${suffix}@example.com`;
    const employeeResponse = await request(app)
      .post('/api/v1/employees')
      .set('authorization', tenantAAuthorization)
      .send({
        fullName: 'No Permission Employee',
        email: employeeEmail,
        role: 'employee',
        difficultyLevel: 'fresher'
      })
      .expect(201);
    const employeeBody = employeeResponse.body as {
      data: { temporaryPassword: string | null };
    };
    const temporaryPassword = employeeBody.data.temporaryPassword;
    if (!temporaryPassword) throw new Error('Expected a temporary employee password.');
    const employeeLogin = await authService.logIn(
      { email: employeeEmail, password: temporaryPassword },
      { requestId: randomUUID(), ip: '127.0.0.1', userAgent: 'vitest-employee' }
    );
    if (!('accessToken' in employeeLogin)) throw new Error('Expected an employee session.');
    employeeAuthorization = `Bearer ${employeeLogin.accessToken}`;

    const adminB = await authService.registerCompany(
      {
        companyName: `AI Router Foreign Co ${suffix}`,
        fullName: 'Tenant B Admin',
        email: `ai-router-b-${suffix}@example.com`,
        password: 'correct-password',
        referralCode: ''
      },
      context
    );
    if (!adminB.company) throw new Error('Expected a company for tenant B.');
    tenantBAuthorization = `Bearer ${adminB.accessToken}`;
    const categoryB = await request(app)
      .post('/api/v1/categories')
      .set('authorization', tenantBAuthorization)
      .send({ name: `AI Foreign Category ${suffix}` })
      .expect(201);
    tenantBCategoryId = (categoryB.body as { data: { id: string } }).data.id;
  }, 30_000);

  it('rejects unauthenticated requests', async () => {
    await request(app).post('/api/v1/ai/questions/generate').send({}).expect(401);
  });

  it('rejects users without the questions:manage permission', async () => {
    await request(app)
      .post('/api/v1/ai/questions/generate')
      .set('authorization', employeeAuthorization)
      .send({
        topic: 'Customer service basics',
        types: ['mcq'],
        count: 1,
        categoryId: tenantACategoryId,
        difficulty: 'fresher'
      })
      .expect(403);
  });

  it('rejects invalid generation input', async () => {
    const response = await request(app)
      .post('/api/v1/ai/questions/generate')
      .set('authorization', tenantAAuthorization)
      .send({ topic: 'ab', categoryId: tenantACategoryId, difficulty: 'fresher' })
      .expect(422);
    expect((response.body as { success: boolean }).success).toBe(false);
  });

  it(
    'generates preview-only drafts idempotently, then saves a reviewed draft with full provenance, ' +
      'and rejects cross-tenant references',
    async () => {
      if (!prisma) throw new Error('TEST_DATABASE_URL is required.');
      const idempotencyKey = `router-test-${randomUUID()}`;
      const generateBody = {
        topic: 'Customer service tone and etiquette',
        types: ['mcq'],
        count: 1,
        categoryId: tenantACategoryId,
        difficulty: 'fresher',
        marks: 2,
        negativeMarks: 0
      };

      const before = await prisma.question.count({ where: { tenantId: tenantAId } });

      const first = await request(app)
        .post('/api/v1/ai/questions/generate')
        .set('authorization', tenantAAuthorization)
        .set('idempotency-key', idempotencyKey)
        .send(generateBody)
        .expect(200);
      const firstBody = first.body as {
        data: {
          drafts: Array<Record<string, unknown> & { historyId: string; type: string }>;
          generated: number;
          valid: number;
        };
      };
      expect(firstBody.data.valid).toBe(1);
      expect(firstBody.data.drafts).toHaveLength(1);
      const draft = firstBody.data.drafts[0]!;
      expect(draft.type).toBe('mcq');
      expect(typeof draft.historyId).toBe('string');
      expect(draft.historyId.length).toBeGreaterThan(0);
      expect(fetchImpl).toHaveBeenCalledTimes(1);

      // Preview-only: generation must never persist a Question.
      const afterGenerate = await prisma.question.count({ where: { tenantId: tenantAId } });
      expect(afterGenerate).toBe(before);

      const historyRow = await prisma.questionGenerationHistory.findUniqueOrThrow({
        where: { id: BigInt(draft.historyId) }
      });
      expect(historyRow.tenantId).toBe(tenantAId);
      expect(historyRow.humanDecision).toBeNull();
      expect(historyRow.generatedQuestionVersionId).toBeNull();

      // Idempotent replay: same Idempotency-Key must not re-call the provider
      // or create duplicate QuestionGenerationHistory rows.
      const second = await request(app)
        .post('/api/v1/ai/questions/generate')
        .set('authorization', tenantAAuthorization)
        .set('idempotency-key', idempotencyKey)
        .send(generateBody)
        .expect(200);
      const secondBody = second.body as { data: { drafts: Array<{ historyId: string }> } };
      expect(secondBody.data.drafts[0]?.historyId).toBe(draft.historyId);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      const historyCount = await prisma.questionGenerationHistory.count({
        where: { tenantId: tenantAId }
      });
      expect(historyCount).toBe(1);

      // Cross-tenant category reference must be rejected, not silently accepted.
      const crossTenantSave = await request(app)
        .post('/api/v1/ai/questions/save')
        .set('authorization', tenantAAuthorization)
        .send({
          questions: [
            {
              ...draft,
              categoryId: tenantBCategoryId,
              subCategoryId: null,
              trainingLink: '',
              tags: []
            }
          ]
        })
        .expect(201);
      const crossTenantBody = crossTenantSave.body as {
        data: { created: number; errors: Array<{ message: string }> };
      };
      expect(crossTenantBody.data.created).toBe(0);
      expect(crossTenantBody.data.errors).toHaveLength(1);

      // A foreign tenant attempting to redeem tenant A's historyId must not
      // link to (or corrupt) tenant A's provenance trail — tenant isolation.
      await request(app)
        .post('/api/v1/ai/questions/save')
        .set('authorization', tenantBAuthorization)
        .send({
          questions: [
            {
              historyId: draft.historyId,
              title: 'Foreign tenant reusing another tenant history id',
              type: 'true_false',
              categoryId: tenantBCategoryId,
              subCategoryId: null,
              difficulty: 'fresher',
              marks: 1,
              negativeMarks: 0,
              explanation: '',
              trainingLink: '',
              tags: [],
              content: { correctAnswer: true }
            }
          ]
        })
        .expect(201);
      const untouchedHistory = await prisma.questionGenerationHistory.findUniqueOrThrow({
        where: { id: BigInt(draft.historyId) }
      });
      expect(untouchedHistory.tenantId).toBe(tenantAId);
      expect(untouchedHistory.humanDecision).toBeNull();
      expect(untouchedHistory.generatedQuestionVersionId).toBeNull();

      // Successful reviewed-draft persistence: valid, same-tenant save links provenance.
      const save = await request(app)
        .post('/api/v1/ai/questions/save')
        .set('authorization', tenantAAuthorization)
        .send({
          questions: [
            {
              ...draft,
              subCategoryId: null,
              trainingLink: '',
              tags: ['ai-generated']
            }
          ]
        })
        .expect(201);
      const saveBody = save.body as {
        data: { created: number; errors: unknown[]; message: string };
      };
      expect(saveBody.data.created).toBe(1);
      expect(saveBody.data.errors).toHaveLength(0);

      const savedQuestion = await prisma.question.findFirstOrThrow({
        where: { tenantId: tenantAId, title: draft.title as string },
        include: { currentVersion: true }
      });
      expect(savedQuestion.tenantId).toBe(tenantAId);

      const decided = await prisma.questionGenerationHistory.findUniqueOrThrow({
        where: { id: BigInt(draft.historyId) }
      });
      expect(decided.humanDecision).toBe('accepted');
      expect(decided.generatedQuestionVersionId).toBe(savedQuestion.currentVersionId);
      expect(decided.decidedById).toBe(tenantAAdminUserId);
      expect(decided.decidedAt).not.toBeNull();
      expect(decided.executionId).not.toBeNull();
    },
    30_000
  );
});

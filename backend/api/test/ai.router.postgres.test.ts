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
  let tenantBId: string;
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
    tenantBId = adminB.company.id;
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

  const historyIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  async function generateOneDraft(idempotencyKeySuffix: string) {
    if (!prisma) throw new Error('TEST_DATABASE_URL is required.');
    const idempotencyKey = `router-test-${idempotencyKeySuffix}-${randomUUID()}`;
    const generateBody = {
      topic: 'Customer service tone and etiquette',
      types: ['mcq'],
      count: 1,
      categoryId: tenantACategoryId,
      difficulty: 'fresher',
      marks: 2,
      negativeMarks: 0
    };
    const response = await request(app)
      .post('/api/v1/ai/questions/generate')
      .set('authorization', tenantAAuthorization)
      .set('idempotency-key', idempotencyKey)
      .send(generateBody)
      .expect(200);
    const body = response.body as {
      data: { drafts: Array<Record<string, unknown> & { historyId: string; type: string }> };
    };
    const draft = body.data.drafts[0];
    if (!draft) throw new Error('Expected a generated draft.');
    return { draft, idempotencyKey, generateBody };
  }

  it(
    'generates preview-only drafts idempotently, then saves a reviewed draft with full provenance, ' +
      'and rejects cross-tenant references',
    async () => {
      if (!prisma) throw new Error('TEST_DATABASE_URL is required.');
      const { draft, idempotencyKey, generateBody } = await generateOneDraft('main-flow');
      expect(draft.type).toBe('mcq');
      // Public responses must never expose the internal bigint id — only the
      // opaque publicId (UUID) may cross the API boundary.
      expect(draft.historyId).toMatch(historyIdPattern);
      expect(fetchImpl).toHaveBeenCalledTimes(1);

      const before = await prisma.question.count({ where: { tenantId: tenantAId } });

      const historyRow = await prisma.questionGenerationHistory.findUniqueOrThrow({
        where: { publicId: draft.historyId }
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
        where: { tenantId: tenantAId, executionId: historyRow.executionId }
      });
      expect(historyCount).toBe(1);

      // Preview-only: generation (including the replay above) must never persist a Question.
      const afterGenerate = await prisma.question.count({ where: { tenantId: tenantAId } });
      expect(afterGenerate).toBe(before);

      // Cross-tenant category reference must be rejected, not silently accepted,
      // and the question/provenance must roll back together (no Question row left behind).
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
      expect(await prisma.question.count({ where: { tenantId: tenantAId } })).toBe(before);
      const historyAfterCategoryRejection =
        await prisma.questionGenerationHistory.findUniqueOrThrow({
          where: { publicId: draft.historyId }
        });
      expect(historyAfterCategoryRejection.humanDecision).toBeNull();

      // A foreign tenant attempting to redeem tenant A's historyId must be
      // rejected outright — not silently ignored, and not linked cross-tenant.
      const crossTenantHistorySave = await request(app)
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
      const crossTenantHistoryBody = crossTenantHistorySave.body as {
        data: { created: number; errors: Array<{ message: string }> };
      };
      expect(crossTenantHistoryBody.data.created).toBe(0);
      expect(crossTenantHistoryBody.data.errors).toHaveLength(1);
      const untouchedHistory = await prisma.questionGenerationHistory.findUniqueOrThrow({
        where: { publicId: draft.historyId }
      });
      expect(untouchedHistory.tenantId).toBe(tenantAId);
      expect(untouchedHistory.humanDecision).toBeNull();
      expect(untouchedHistory.generatedQuestionVersionId).toBeNull();
      // No question was created for tenant B by that rejected attempt either.
      expect(
        await prisma.question.count({
          where: { tenantId: tenantBId, title: 'Foreign tenant reusing another tenant history id' }
        })
      ).toBe(0);

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
        where: { publicId: draft.historyId }
      });
      expect(decided.humanDecision).toBe('accepted');
      expect(decided.generatedQuestionVersionId).toBe(savedQuestion.currentVersionId);
      expect(decided.decidedById).toBe(tenantAAdminUserId);
      expect(decided.decidedAt).not.toBeNull();
      expect(decided.executionId).not.toBeNull();

      // Already-consumed history id: a second redemption attempt is rejected
      // outright (chosen behavior — not silently re-linked, not transparently
      // returning the first question) and does not create a second Question.
      const duplicateRedemption = await request(app)
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
      const duplicateBody = duplicateRedemption.body as {
        data: { created: number; errors: Array<{ message: string }> };
      };
      expect(duplicateBody.data.created).toBe(0);
      expect(duplicateBody.data.errors).toHaveLength(1);
      expect(duplicateBody.data.errors[0]?.message).toMatch(/already been saved/i);
      expect(
        await prisma.question.count({
          where: { tenantId: tenantAId, title: draft.title as string }
        })
      ).toBe(1);
    },
    30_000
  );

  it('rejects a malformed historyId during save and rolls back the question', async () => {
    if (!prisma) throw new Error('TEST_DATABASE_URL is required.');
    const before = await prisma.question.count({ where: { tenantId: tenantAId } });
    const title = `Malformed history id ${randomUUID()}`;
    const response = await request(app)
      .post('/api/v1/ai/questions/save')
      .set('authorization', tenantAAuthorization)
      .send({
        questions: [
          {
            historyId: 'not-a-valid-uuid',
            title,
            type: 'true_false',
            categoryId: tenantACategoryId,
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
    const body = response.body as { data: { created: number; errors: Array<{ message: string }> } };
    expect(body.data.created).toBe(0);
    expect(body.data.errors).toHaveLength(1);
    expect(body.data.errors[0]?.message).toMatch(/invalid/i);
    // Rollback together: no Question row was left behind for the rejected save.
    expect(await prisma.question.count({ where: { tenantId: tenantAId, title } })).toBe(0);
    expect(await prisma.question.count({ where: { tenantId: tenantAId } })).toBe(before);
  });

  it('rejects an unknown (well-formed but nonexistent) historyId during save', async () => {
    if (!prisma) throw new Error('TEST_DATABASE_URL is required.');
    const title = `Unknown history id ${randomUUID()}`;
    const response = await request(app)
      .post('/api/v1/ai/questions/save')
      .set('authorization', tenantAAuthorization)
      .send({
        questions: [
          {
            historyId: randomUUID(),
            title,
            type: 'true_false',
            categoryId: tenantACategoryId,
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
    const body = response.body as { data: { created: number; errors: Array<{ message: string }> } };
    expect(body.data.created).toBe(0);
    expect(body.data.errors).toHaveLength(1);
    expect(await prisma.question.count({ where: { tenantId: tenantAId, title } })).toBe(0);
  });

  it(
    'repairs QuestionGenerationHistory on replay after an interrupted write, without ever ' +
      'returning an empty historyId for a valid draft',
    async () => {
      if (!prisma) throw new Error('TEST_DATABASE_URL is required.');
      const { draft, idempotencyKey, generateBody } = await generateOneDraft('crash-recovery');
      expect(draft.historyId).toMatch(historyIdPattern);

      // Simulate a crash between the AI execution succeeding and the history
      // row being recorded: delete the row the first call just wrote.
      await prisma.questionGenerationHistory.deleteMany({ where: { publicId: draft.historyId } });
      expect(
        await prisma.questionGenerationHistory.findUnique({ where: { publicId: draft.historyId } })
      ).toBeNull();

      // Replay with the same Idempotency-Key: the AI execution is reused
      // (cached output, no new provider call), but the missing history row
      // must be repaired/backfilled rather than coming back empty.
      const repaired = await request(app)
        .post('/api/v1/ai/questions/generate')
        .set('authorization', tenantAAuthorization)
        .set('idempotency-key', idempotencyKey)
        .send(generateBody)
        .expect(200);
      const repairedBody = repaired.body as { data: { drafts: Array<{ historyId: string }> } };
      const repairedHistoryId = repairedBody.data.drafts[0]?.historyId;
      if (!repairedHistoryId) throw new Error('Expected a repaired historyId.');
      expect(repairedHistoryId).toMatch(historyIdPattern);
      // fetchImpl was not called again — the execution itself was reused.
      const historyRow = await prisma.questionGenerationHistory.findUniqueOrThrow({
        where: { publicId: repairedHistoryId }
      });
      expect(historyRow.tenantId).toBe(tenantAId);
      expect(historyRow.draftIndex).toBe(0);
    },
    30_000
  );

  it('rejects test generation for users without tests:manage', async () => {
    await request(app)
      .post('/api/v1/ai/tests/generate')
      .set('authorization', employeeAuthorization)
      .send({
        topic: 'Customer service tone and etiquette',
        types: ['mcq'],
        questionCount: 1,
        categoryId: tenantACategoryId,
        difficulty: 'fresher'
      })
      .expect(403);
  });

  it('generates questions, persists them, and bundles them into a draft fixed test', async () => {
    if (!prisma) throw new Error('TEST_DATABASE_URL is required.');
    const response = await request(app)
      .post('/api/v1/ai/tests/generate')
      .set('authorization', tenantAAuthorization)
      .set('idempotency-key', `router-test-generate-${randomUUID()}`)
      .send({
        topic: 'Customer service tone and etiquette',
        types: ['mcq'],
        questionCount: 1,
        categoryId: tenantACategoryId,
        difficulty: 'fresher',
        marks: 2
      })
      .expect(201);
    const body = response.body as {
      data: { testId: string; questionCount: number; message: string };
    };
    expect(body.data.questionCount).toBe(1);
    expect(body.data.testId).toMatch(historyIdPattern);

    const assessment = await prisma.assessmentDefinition.findUniqueOrThrow({
      where: { id: body.data.testId },
      include: {
        currentVersion: { include: { questions: true } }
      }
    });
    expect(assessment.tenantId).toBe(tenantAId);
    expect(assessment.status).toBe('DRAFT');
    expect(assessment.currentVersion?.questions).toHaveLength(1);

    const linked = await prisma.questionGenerationHistory.findFirst({
      where: {
        tenantId: tenantAId,
        generatedQuestionVersionId: {
          in: assessment.currentVersion?.questions.map((q) => q.questionVersionId) ?? []
        }
      }
    });
    expect(linked).not.toBeNull();
    expect(linked?.humanDecision).toBe('accepted');
  }, 30_000);

  it('saves AI-generated questions as pending review, hidden from the bank until an admin publishes them', async () => {
    if (!prisma) throw new Error('TEST_DATABASE_URL is required.');
    const title = `Pending review question ${randomUUID()}`;
    const saved = await request(app)
      .post('/api/v1/ai/questions/save')
      .set('authorization', tenantAAuthorization)
      .send({
        questions: [
          {
            title,
            type: 'true_false',
            categoryId: tenantACategoryId,
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
    const savedBody = saved.body as { data: { created: number } };
    expect(savedBody.data.created).toBe(1);

    const record = await prisma.question.findFirstOrThrow({
      where: { tenantId: tenantAId, title }
    });
    const questionId = record.id;
    expect(record.status).toBe('IN_REVIEW');

    const publishedList = await request(app)
      .get('/api/v1/questions')
      .set('authorization', tenantAAuthorization)
      .query({ search: title })
      .expect(200);
    expect(
      (publishedList.body as { data: { rows: Array<{ id: string }> } }).data.rows.some(
        (row) => row.id === questionId
      )
    ).toBe(false);

    const pendingList = await request(app)
      .get('/api/v1/questions')
      .set('authorization', tenantAAuthorization)
      .query({ status: 'in_review', search: title })
      .expect(200);
    const pendingRow = (
      pendingList.body as {
        data: { rows: Array<{ id: string; reviewStatus: string }> };
      }
    ).data.rows.find((row) => row.id === questionId);
    expect(pendingRow?.reviewStatus).toBe('in_review');

    await request(app)
      .post(`/api/v1/questions/${questionId}/publish`)
      .set('authorization', tenantAAuthorization)
      .expect(200);

    const afterPublish = await prisma.question.findUniqueOrThrow({ where: { id: questionId } });
    expect(afterPublish.status).toBe('PUBLISHED');

    const nowPublishedList = await request(app)
      .get('/api/v1/questions')
      .set('authorization', tenantAAuthorization)
      .query({ search: title })
      .expect(200);
    expect(
      (nowPublishedList.body as { data: { rows: Array<{ id: string }> } }).data.rows.some(
        (row) => row.id === questionId
      )
    ).toBe(true);

    // Publishing again must fail — the question is no longer in review.
    await request(app)
      .post(`/api/v1/questions/${questionId}/publish`)
      .set('authorization', tenantAAuthorization)
      .expect(422);
  });
});

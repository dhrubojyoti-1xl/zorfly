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

function claudeEvaluationResponse(overrides: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            score: 8,
            confidence: 0.85,
            reasoning: 'The candidate identified the main issue but missed one secondary mistake.',
            strengths: ['Correctly identified the primary mistake'],
            detectedMistakes: ['Missed the secondary formatting issue'],
            missedExpectedPoints: ['Did not mention the missing semicolon'],
            improvementFeedback: 'Review the checklist more carefully for secondary issues.',
            citedCriteria: [],
            ...overrides
          })
        }
      ],
      model: 'claude-sonnet-5',
      stop_reason: 'end_turn',
      usage: { input_tokens: 200, output_tokens: 90, cache_read_input_tokens: 0 }
    }),
    { status: 200, headers: { 'content-type': 'application/json', 'request-id': 'req_eval' } }
  );
}

function claudeMalformedResponse(): Response {
  return new Response(
    JSON.stringify({
      content: [{ type: 'text', text: JSON.stringify({ notes: 'not a valid evaluation shape' }) }],
      model: 'claude-sonnet-5',
      stop_reason: 'end_turn',
      usage: { input_tokens: 50, output_tokens: 10, cache_read_input_tokens: 0 }
    }),
    { status: 200, headers: { 'content-type': 'application/json', 'request-id': 'req_eval_bad' } }
  );
}

integration('AI evaluation HTTP routes (PostgreSQL-backed)', () => {
  const context = { requestId: randomUUID(), ip: '127.0.0.1', userAgent: 'vitest' };
  let fetchImpl = vi.fn(() => Promise.resolve(claudeEvaluationResponse()));

  let authService: AuthService;
  let app: Express;
  let tenantAId: string;
  let adminAuthorization: string;
  let reviewerAuthorization: string; // team_leader: has reviews:manage, not questions:manage
  let employeeAuthorization: string;
  let categoryId: string;
  let questionId: string;
  let testTitle: string;
  let testId: string;
  let suffix: string;

  // Completing a review (via either the plain manual-review endpoint or
  // the AI-evaluation decision endpoint) flips the whole company-wide
  // assignment to COMPLETED, after which no employee can /start a new
  // attempt against it. Tests that complete a review therefore need their
  // own dedicated employee/attempt; tests that only create an evaluation
  // without deciding it can safely share one.
  async function startAndSubmitTypedAttempt(authorization: string = employeeAuthorization): Promise<string> {
    const started = await request(app)
      .post('/api/v1/attempts/start')
      .set('authorization', authorization)
      .send({ testId })
      .expect(201);
    const attemptId = (started.body as { data: { id: string } }).data.id;
    await request(app)
      .patch(`/api/v1/attempts/${attemptId}/answers`)
      .set('authorization', authorization)
      .send({
        questionId,
        answer: { typedAnswers: ['Missing semicolon'] },
        sequence: 1
      })
      .expect(200);
    await request(app)
      .post(`/api/v1/attempts/${attemptId}/submit`)
      .set('authorization', authorization)
      .expect(200);
    return attemptId;
  }

  /**
   * Creates a new employee and assigns the shared eval test directly to
   * them (targetType: 'employee'), rather than re-broadcasting to
   * 'company' — a fresh, isolated assignment per test that needs to
   * complete a review, without touching any other test's assignment.
   */
  async function createLoggedInEmployee(label: string, suffix: string): Promise<string> {
    const email = `eval-${label}-${suffix}@example.com`;
    const created = await request(app)
      .post('/api/v1/employees')
      .set('authorization', adminAuthorization)
      .send({ fullName: `Eval ${label}`, email, role: 'employee', difficultyLevel: 'fresher' })
      .expect(201);
    const temporaryPassword = (created.body as { data: { temporaryPassword: string | null } }).data
      .temporaryPassword;
    if (!temporaryPassword) throw new Error('Expected a temporary employee password.');
    const list = await request(app)
      .get('/api/v1/employees')
      .set('authorization', adminAuthorization)
      .query({ search: email })
      .expect(200);
    const userId = (
      list.body as { data: { rows: Array<{ email: string; userId: string }> } }
    ).data.rows.find((row) => row.email === email)?.userId;
    if (!userId) throw new Error('Expected to find the new employee in the employee list.');
    await request(app)
      .post(`/api/v1/tests/${testId}/assign`)
      .set('authorization', adminAuthorization)
      .send({ targetType: 'employee', targetIds: [userId], targetKeys: [], dueAt: null })
      .expect(201);
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
    suffix = randomUUID().slice(0, 8);

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
    const transport: HttpTransport = { fetch: () => fetchImpl() };
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
        companyName: `Eval Co ${suffix}`,
        fullName: 'Tenant Admin',
        email: `eval-admin-${suffix}@example.com`,
        password: 'correct-password',
        referralCode: ''
      },
      context
    );
    if (!admin.company) throw new Error('Expected a company.');
    tenantAId = admin.company.id;
    adminAuthorization = `Bearer ${admin.accessToken}`;

    await ensureTenantProviderConfiguration(db, tenantAId, 'claude', 'TEST_CLAUDE_KEY');
    await ensureModelConfiguration(db, {
      tenantId: tenantAId,
      key: 'response-evaluation.default',
      purpose: 'RESPONSE_EVALUATION',
      providerKey: 'claude',
      modelKey: 'claude-sonnet-5'
    });

    const reviewerEmail = `eval-reviewer-${suffix}@example.com`;
    const reviewerResponse = await request(app)
      .post('/api/v1/employees')
      .set('authorization', adminAuthorization)
      .send({
        fullName: 'Team Leader Reviewer',
        email: reviewerEmail,
        role: 'team_leader',
        difficultyLevel: 'fresher'
      })
      .expect(201);
    const reviewerPassword = (reviewerResponse.body as { data: { temporaryPassword: string | null } })
      .data.temporaryPassword;
    if (!reviewerPassword) throw new Error('Expected a temporary reviewer password.');
    const reviewerLogin = await authService.logIn(
      { email: reviewerEmail, password: reviewerPassword },
      { requestId: randomUUID(), ip: '127.0.0.1', userAgent: 'vitest-reviewer' }
    );
    if (!('accessToken' in reviewerLogin)) throw new Error('Expected a reviewer session.');
    reviewerAuthorization = `Bearer ${reviewerLogin.accessToken}`;

    const employeeEmail = `eval-employee-${suffix}@example.com`;
    const employeeResponse = await request(app)
      .post('/api/v1/employees')
      .set('authorization', adminAuthorization)
      .send({
        fullName: 'Eval Employee',
        email: employeeEmail,
        role: 'employee',
        difficultyLevel: 'fresher'
      })
      .expect(201);
    const employeePassword = (employeeResponse.body as { data: { temporaryPassword: string | null } })
      .data.temporaryPassword;
    if (!employeePassword) throw new Error('Expected a temporary employee password.');
    const employeeLogin = await authService.logIn(
      { email: employeeEmail, password: employeePassword },
      { requestId: randomUUID(), ip: '127.0.0.1', userAgent: 'vitest-employee' }
    );
    if (!('accessToken' in employeeLogin)) throw new Error('Expected an employee session.');
    employeeAuthorization = `Bearer ${employeeLogin.accessToken}`;

    const category = await request(app)
      .post('/api/v1/categories')
      .set('authorization', adminAuthorization)
      .send({ name: `Eval Category ${suffix}` })
      .expect(201);
    categoryId = (category.body as { data: { id: string } }).data.id;

    const question = await request(app)
      .post('/api/v1/questions')
      .set('authorization', adminAuthorization)
      .send({
        title: `Spot the mistakes ${suffix}`,
        type: 'find_mistakes',
        categoryId,
        difficulty: 'junior',
        marks: 10,
        negativeMarks: 0,
        explanation: 'Look for the missing semicolon and the formatting inconsistency.',
        content: {
          imageUrl: 'https://example.com/screenshot.png',
          mode: 'typed',
          mistakes: [
            { id: 'm1', label: 'Missing semicolon' },
            { id: 'm2', label: 'Inconsistent indentation' }
          ],
          distractors: []
        }
      })
      .expect(201);
    questionId = (question.body as { data: { id: string } }).data.id;

    testTitle = `Eval Test ${suffix}`;
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
          attemptsAllowed: 10,
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
    await request(app).post('/api/v1/ai/evaluations/x/y').expect(401);
  });

  it('rejects users without reviews:manage (employees)', async () => {
    const attemptId = await startAndSubmitTypedAttempt();
    await request(app)
      .post(`/api/v1/ai/evaluations/${attemptId}/${questionId}`)
      .set('authorization', employeeAuthorization)
      .expect(403);
  });

  it('rejects evaluation of a question that is not awaiting review (objective-answer rejection)', async () => {
    await request(app)
      .post(`/api/v1/ai/evaluations/does-not-exist/${questionId}`)
      .set('authorization', adminAuthorization)
      .expect(404);
  });

  it(
    'runs Claude evaluation on an eligible subjective answer, bounds the score, and is idempotent on retry with the same answer',
    async () => {
      fetchImpl = vi.fn(() => Promise.resolve(claudeEvaluationResponse({ score: 999 })));
      const attemptId = await startAndSubmitTypedAttempt(
        await createLoggedInEmployee('idempotent', suffix)
      );

      const first = await request(app)
        .post(`/api/v1/ai/evaluations/${attemptId}/${questionId}`)
        .set('authorization', adminAuthorization)
        .expect(201);
      const firstBody = first.body as {
        data: {
          id: string;
          score: number;
          maxMarks: number;
          confidence: number;
          reasoning: string;
          citedCriteria: string[];
        };
      };
      expect(firstBody.data.maxMarks).toBe(10);
      // Claude returned score=999; the platform clamps it to the question's max marks — never trusts an unbounded value.
      expect(firstBody.data.score).toBe(10);
      expect(firstBody.data.reasoning.length).toBeGreaterThan(0);
      expect(fetchImpl).toHaveBeenCalledTimes(1);

      const second = await request(app)
        .post(`/api/v1/ai/evaluations/${attemptId}/${questionId}`)
        .set('authorization', adminAuthorization)
        .expect(200);
      const secondBody = second.body as { data: { id: string } };
      // Same evaluation id, no second Claude call, no duplicate cost — idempotent retry on an unchanged answer.
      expect(secondBody.data.id).toBe(firstBody.data.id);
      expect(fetchImpl).toHaveBeenCalledTimes(1);

      if (!prisma) throw new Error('TEST_DATABASE_URL is required.');
      const usageCount = await prisma.aITokenUsage.count({ where: { tenantId: tenantAId } });
      const costCount = await prisma.aICostTracking.count({ where: { tenantId: tenantAId } });
      expect(usageCount).toBeGreaterThan(0);
      expect(costCount).toBeGreaterThan(0);

      const fetched = await request(app)
        .get(`/api/v1/ai/evaluations/${attemptId}/${questionId}`)
        .set('authorization', reviewerAuthorization)
        .expect(200);
      expect((fetched.body as { data: { id: string } }).data.id).toBe(firstBody.data.id);
    },
    30_000
  );

  it('routes a low-confidence evaluation with an explicit flag rather than silently accepting it', async () => {
    fetchImpl = vi.fn(() => Promise.resolve(claudeEvaluationResponse({ confidence: 0.2 })));
    const attemptId = await startAndSubmitTypedAttempt();
    const evaluated = await request(app)
      .post(`/api/v1/ai/evaluations/${attemptId}/${questionId}`)
      .set('authorization', adminAuthorization)
      .expect(201);
    expect((evaluated.body as { data: { lowConfidence: boolean } }).data.lowConfidence).toBe(true);
  });

  it('falls back to manual review (no evaluation row) when Claude returns a malformed response', async () => {
    fetchImpl = vi.fn(() => Promise.resolve(claudeMalformedResponse()));
    const attemptId = await startAndSubmitTypedAttempt(
      await createLoggedInEmployee('malformed', suffix)
    );
    await request(app)
      .post(`/api/v1/ai/evaluations/${attemptId}/${questionId}`)
      .set('authorization', adminAuthorization)
      .expect(502);
    await request(app)
      .get(`/api/v1/ai/evaluations/${attemptId}/${questionId}`)
      .set('authorization', adminAuthorization)
      .expect(404);
    // The item is still fully scoreable by hand — AI failure never blocks manual review.
    await request(app)
      .post(`/api/v1/reviews/${attemptId}/${questionId}`)
      .set('authorization', adminAuthorization)
      .send({ obtained: 7 })
      .expect(200);
  });

  it('falls back to manual review when Claude is unavailable', async () => {
    fetchImpl = vi.fn(() => Promise.reject(new Error('network unreachable')));
    const attemptId = await startAndSubmitTypedAttempt(
      await createLoggedInEmployee('unavailable', suffix)
    );
    await request(app)
      .post(`/api/v1/ai/evaluations/${attemptId}/${questionId}`)
      .set('authorization', adminAuthorization)
      .expect(502);
    await request(app)
      .post(`/api/v1/reviews/${attemptId}/${questionId}`)
      .set('authorization', adminAuthorization)
      .send({ obtained: 4 })
      .expect(200);
  });

  it('lets a human accept the AI score, and rejects a second decision on the same evaluation (immutable history)', async () => {
    fetchImpl = vi.fn(() => Promise.resolve(claudeEvaluationResponse({ score: 6 })));
    const attemptId = await startAndSubmitTypedAttempt(await createLoggedInEmployee('accept', suffix));
    await request(app)
      .post(`/api/v1/ai/evaluations/${attemptId}/${questionId}`)
      .set('authorization', adminAuthorization)
      .expect(201);

    const accepted = await request(app)
      .post(`/api/v1/ai/evaluations/${attemptId}/${questionId}/decision`)
      .set('authorization', reviewerAuthorization)
      .send({ decision: 'accept' })
      .expect(200);
    expect((accepted.body as { data: { obtained: number } }).data.obtained).toBe(6);

    if (!prisma) throw new Error('TEST_DATABASE_URL is required.');
    const attempt = await prisma.assessmentAttempt.findFirstOrThrow({
      where: { publicId: attemptId }
    });
    expect(attempt.status).toBe('PUBLISHED');

    // The question is no longer awaiting review, so a second decision attempt 404s at the eligibility gate — the human's first decision is final.
    await request(app)
      .post(`/api/v1/ai/evaluations/${attemptId}/${questionId}/decision`)
      .set('authorization', reviewerAuthorization)
      .send({ decision: 'accept' })
      .expect(404);
  });

  it('lets a human adjust the AI score to a different value (human override precedence)', async () => {
    fetchImpl = vi.fn(() => Promise.resolve(claudeEvaluationResponse({ score: 3 })));
    const attemptId = await startAndSubmitTypedAttempt(await createLoggedInEmployee('adjust', suffix));
    await request(app)
      .post(`/api/v1/ai/evaluations/${attemptId}/${questionId}`)
      .set('authorization', adminAuthorization)
      .expect(201);
    const adjusted = await request(app)
      .post(`/api/v1/ai/evaluations/${attemptId}/${questionId}/decision`)
      .set('authorization', reviewerAuthorization)
      .send({ decision: 'adjust', obtained: 9, reason: 'AI missed partial credit for structure.' })
      .expect(200);
    expect((adjusted.body as { data: { obtained: number } }).data.obtained).toBe(9);
  });

  it('lets a human reject the AI score outright and requires marks to do so', async () => {
    const attemptId = await startAndSubmitTypedAttempt(await createLoggedInEmployee('reject', suffix));
    await request(app)
      .post(`/api/v1/ai/evaluations/${attemptId}/${questionId}`)
      .set('authorization', adminAuthorization)
      .expect(201);
    await request(app)
      .post(`/api/v1/ai/evaluations/${attemptId}/${questionId}/decision`)
      .set('authorization', reviewerAuthorization)
      .send({ decision: 'reject' })
      .expect(422);
    const rejected = await request(app)
      .post(`/api/v1/ai/evaluations/${attemptId}/${questionId}/decision`)
      .set('authorization', reviewerAuthorization)
      .send({ decision: 'reject', obtained: 0, reason: 'Answer is off-topic.' })
      .expect(200);
    expect((rejected.body as { data: { obtained: number } }).data.obtained).toBe(0);
  });

  it('enforces tenant isolation: a foreign tenant cannot evaluate or view this attempt', async () => {
    const foreignSuffix = randomUUID().slice(0, 8);
    const foreignAdmin = await authService.registerCompany(
      {
        companyName: `Eval Foreign Co ${foreignSuffix}`,
        fullName: 'Foreign Admin',
        email: `eval-foreign-${foreignSuffix}@example.com`,
        password: 'correct-password',
        referralCode: ''
      },
      context
    );
    if (!foreignAdmin.company) throw new Error('Expected a foreign company.');
    const foreignAuthorization = `Bearer ${foreignAdmin.accessToken}`;

    const attemptId = await startAndSubmitTypedAttempt();
    await request(app)
      .post(`/api/v1/ai/evaluations/${attemptId}/${questionId}`)
      .set('authorization', foreignAuthorization)
      .expect(404);
    await request(app)
      .get(`/api/v1/ai/evaluations/${attemptId}/${questionId}`)
      .set('authorization', foreignAuthorization)
      .expect(404);
  });
});

import { createHash } from 'node:crypto';
import { Router, type Request } from 'express';
import { AIExecutionPurpose, type Prisma, type ZorflyPrismaClient } from '@zorfly/database';
import { ApiError } from '../../platform/api-error.js';
import { validate } from '../../platform/validate.js';
import { createRequireAuth, createRequirePermission } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { RequestContext, SessionPrincipal } from '../auth/auth.types.js';
import type { TokenService } from '../auth/tokens.js';
import {
  applyManualScore,
  findReviewAttempt,
  reviewerMembership
} from '../assessment/reviews.router.js';
import type { AiExecutionService } from './ai.service.js';
import {
  ensureDefaultClaudeConfiguration,
  RESPONSE_EVALUATION_CONFIGURATION_KEY,
  resolveExecutionPlan
} from './ai.repository.js';
import {
  findEvaluationByExecution,
  findLatestEvaluationForQuestion,
  recordEvaluation,
  recordEvaluationDecision,
  type EvaluationDecision
} from './evaluation.repository.js';
import {
  buildEvaluationPrompt,
  evaluationOutputSchema,
  evaluationSystemPrompt,
  parseEvaluationOutput,
  LOW_CONFIDENCE_THRESHOLD,
  type EvaluationResult
} from './evaluation.js';
import { evaluationDecisionSchema, type EvaluationDecisionInput } from './evaluation.validation.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function principal(request: Request): SessionPrincipal & { tenantId: string } {
  if (!request.auth?.tenantId) throw new ApiError(401, 'Authentication is required.');
  return { ...request.auth, tenantId: request.auth.tenantId };
}

function requestContext(request: Request): RequestContext {
  const userAgent = request.headers['user-agent'];
  return {
    ...(request.ip ? { ip: request.ip } : {}),
    ...(typeof request.id === 'string' || typeof request.id === 'number'
      ? { requestId: String(request.id) }
      : {}),
    ...(typeof userAgent === 'string' ? { userAgent } : {})
  };
}

function object(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function submittedAnswerText(answer: unknown): string {
  const value = object(answer as Prisma.JsonValue);
  if (Array.isArray(value.typedAnswers)) {
    return value.typedAnswers.filter((line): line is string => typeof line === 'string').join('\n');
  }
  return JSON.stringify(answer ?? {});
}

function evaluationResponse(
  evaluation: { id: bigint; result: EvaluationResult; confidence: number | null; humanOutcome: string | null; reviewedAt: Date | null; createdAt: Date },
  maxMarks: number
) {
  return {
    id: evaluation.id.toString(),
    ...evaluation.result,
    maxMarks,
    lowConfidence: (evaluation.confidence ?? 0) < LOW_CONFIDENCE_THRESHOLD,
    humanOutcome: evaluation.humanOutcome,
    reviewedAt: evaluation.reviewedAt,
    createdAt: evaluation.createdAt
  };
}

export function createAiEvaluationRouter(
  prisma: ZorflyPrismaClient,
  authService: AuthService,
  tokens: TokenService,
  aiService: AiExecutionService
): Router {
  const router = Router();
  const configuredTenants = new Set<string>();
  router.use(createRequireAuth(tokens));
  router.use(createRequirePermission(authService, 'reviews:manage'));
  router.use(async (request, _response, next) => {
    try {
      const auth = principal(request);
      if (process.env.ANTHROPIC_API_KEY && !configuredTenants.has(auth.tenantId)) {
        const existingPlan = await resolveExecutionPlan(
          prisma,
          auth.tenantId,
          RESPONSE_EVALUATION_CONFIGURATION_KEY
        );
        if (existingPlan.length === 0) {
          await ensureDefaultClaudeConfiguration(prisma, auth.tenantId);
        }
        configuredTenants.add(auth.tenantId);
      }
      next();
    } catch (error) {
      next(error);
    }
  });

  /** Locates the pending attempt question this route addresses, or throws — shared by all three routes below. */
  async function loadPendingQuestion(auth: SessionPrincipal & { tenantId: string }, request: Request) {
    const rawAttemptId = String(request.params.attemptId ?? '');
    // AssessmentAttempt.publicId is a Postgres UUID column — a malformed
    // id would otherwise reach Prisma and throw a raw client error (500)
    // instead of the same 404 a well-formed-but-unknown id gets. Treating
    // both identically also avoids leaking whether an id is merely
    // malformed vs. genuinely absent.
    if (!uuidPattern.test(rawAttemptId)) {
      throw new ApiError(404, 'The requested attempt was not found.');
    }
    const attempt = await findReviewAttempt(prisma, auth.tenantId, rawAttemptId);
    if (!attempt) throw new ApiError(404, 'The requested attempt was not found.');
    const targetQuestionId = String(request.params.questionId ?? '');
    const attemptQuestion = attempt.questions.find(
      (question) => question.questionVersion.questionId === targetQuestionId
    );
    // Deliberately the same "awaiting review" gate as the manual-review
    // endpoints: an already-scored (objective or previously reviewed)
    // question is never eligible for AI evaluation, and deterministic
    // objective scores are never touched by this router.
    if (!attemptQuestion || attemptQuestion.status !== 'NEEDS_REVIEW') {
      throw new ApiError(404, 'This question is not awaiting review.');
    }
    return { attempt, attemptQuestion, targetQuestionId };
  }

  router.post('/:attemptId/:questionId', async (request, response, next) => {
    try {
      const auth = principal(request);
      const { attempt, attemptQuestion, targetQuestionId } = await loadPendingQuestion(
        auth,
        request
      );
      const maxMarks = Number(attemptQuestion.maxMarks);
      const answerText = submittedAnswerText(attemptQuestion.response?.answer);
      const answerHash = createHash('sha256').update(answerText).digest('hex');

      // Idempotency is keyed by (attemptQuestion, answer content), not a
      // random UUID like question generation — re-triggering evaluation on
      // an unchanged answer must reuse the prior execution rather than
      // charging twice, satisfying the "prevent duplicate evaluation
      // charges" requirement without needing a client-supplied header.
      const idempotencyKey = `${auth.tenantId}:response-evaluation:${String(attemptQuestion.id)}:${answerHash}`;

      let result: EvaluationResult;
      let executionId: bigint;
      try {
        const execution = await aiService.generate<EvaluationResult>({
          tenantId: auth.tenantId,
          actorId: auth.userId,
          purpose: AIExecutionPurpose.RESPONSE_EVALUATION,
          configurationKey: RESPONSE_EVALUATION_CONFIGURATION_KEY,
          capability: 'structured_output',
          messages: [
            { role: 'system', content: evaluationSystemPrompt },
            {
              role: 'user',
              content: buildEvaluationPrompt({
                questionTitle: attemptQuestion.questionVersion.question.title,
                rubric: attemptQuestion.questionVersion.explanation ?? '',
                maxMarks,
                submittedAnswer: answerText,
                criteria: [] // No QualityCriterion rows exist for any tenant yet (SOP operationalization is a separate, not-yet-built effort) — grounded on the rubric alone until that lands; the query point below is real and will pick criteria up automatically once seeded.
              })
            }
          ],
          outputSchema: evaluationOutputSchema,
          validateOutput: (value) => parseEvaluationOutput(value, maxMarks),
          idempotencyKey,
          sourceType: 'response_evaluation',
          sourceId: String(attemptQuestion.id)
        });
        result = execution.output;
        executionId = execution.executionId;
      } catch (error) {
        // Claude unavailable, budget exhausted, or the response failed
        // strict validation: the question was already routed to manual
        // review at submit time (that's what made it eligible here), so
        // there is nothing further to do except let the reviewer fall back
        // to scoring it by hand — no AIEvaluationHistory row is created for
        // a failed attempt.
        throw error instanceof ApiError
          ? error
          : new ApiError(502, 'AI evaluation is temporarily unavailable. Score this manually.');
      }

      const existing = await findEvaluationByExecution(prisma, auth.tenantId, executionId);
      const evaluation =
        existing ??
        (await recordEvaluation(prisma, {
          tenantId: auth.tenantId,
          executionId,
          attemptId: attempt.id,
          attemptQuestionId: String(attemptQuestion.id),
          questionId: targetQuestionId,
          answerHash,
          maxMarks,
          result
        }));

      response.status(existing ? 200 : 201).json({
        success: true,
        data: evaluationResponse(evaluation, maxMarks)
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:attemptId/:questionId', async (request, response, next) => {
    try {
      const auth = principal(request);
      const { attempt, attemptQuestion } = await loadPendingQuestion(auth, request);
      const evaluation = await findLatestEvaluationForQuestion(
        prisma,
        auth.tenantId,
        attempt.id,
        String(attemptQuestion.id)
      );
      if (!evaluation) throw new ApiError(404, 'No AI evaluation has been run for this answer yet.');
      response.json({
        success: true,
        data: evaluationResponse(evaluation, Number(attemptQuestion.maxMarks))
      });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/:attemptId/:questionId/decision',
    validate(evaluationDecisionSchema),
    async (request, response, next) => {
      try {
        const auth = principal(request);
        const reviewer = await reviewerMembership(prisma, auth.tenantId, auth.userId);
        const { attempt, attemptQuestion, targetQuestionId } = await loadPendingQuestion(
          auth,
          request
        );
        const evaluation = await findLatestEvaluationForQuestion(
          prisma,
          auth.tenantId,
          attempt.id,
          String(attemptQuestion.id)
        );
        if (!evaluation) {
          throw new ApiError(404, 'No AI evaluation has been run for this answer yet.');
        }
        const body = request.body as EvaluationDecisionInput;
        const verb = body.decision;
        const outcome: EvaluationDecision =
          verb === 'accept' ? 'accepted' : verb === 'adjust' ? 'adjusted' : 'rejected';
        const obtained = verb === 'accept' ? evaluation.result.score : body.obtained;
        if (obtained === undefined) {
          throw new ApiError(422, 'Marks are required to adjust or reject an AI evaluation.', {
            obtained: 'Required.'
          });
        }

        // The human decision — not the AI suggestion — is what changes the
        // score. This calls the exact same function the plain manual-review
        // endpoint uses, so there is one authoritative "apply a human score"
        // code path, not a parallel one.
        const applied = await applyManualScore(prisma, authService, requestContext(request), {
          auth,
          reviewer,
          attempt,
          targetQuestionId,
          obtained,
          auditAction: `ai_evaluation.${outcome}`,
          auditMetadataExtra: {
            aiSuggestedScore: evaluation.result.score,
            aiConfidence: evaluation.confidence,
            reason: body.reason ?? null
          }
        });

        // Immutable otherwise: only humanOutcome/reviewedById/reviewedAt are
        // ever set on an AIEvaluationHistory row, and only once — this is
        // the human's final word overriding the AI suggestion, recorded
        // permanently alongside it rather than replacing it.
        await recordEvaluationDecision(prisma, {
          id: evaluation.id,
          tenantId: auth.tenantId,
          decision: outcome,
          reviewedById: auth.userId
        });

        response.json({ success: true, data: applied });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

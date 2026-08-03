import { randomUUID } from 'node:crypto';
import { Router, type Request } from 'express';
import {
  AIExecutionPurpose,
  QuestionStatus,
  type Prisma,
  type ZorflyPrismaClient
} from '@zorfly/database';
import { ApiError } from '../../platform/api-error.js';
import { validate } from '../../platform/validate.js';
import { questionSchema, type QuestionInput } from '../assessment/question.validation.js';
import { createQuestion } from '../assessment/questions.router.js';
import { testSchema } from '../assessment/test.validation.js';
import { createDraftTest } from '../assessment/tests.router.js';
import { createRequireAuth, createRequirePermission } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { RequestContext, SessionPrincipal } from '../auth/auth.types.js';
import type { TokenService } from '../auth/tokens.js';
import { learningMaterialSchema } from '../learning/learning-material.validation.js';
import { createLearningMaterial } from '../learning/learning.router.js';
import {
  generateQuestionsSchema,
  generateStudySchema,
  generateTestSchema,
  saveQuestionsSchema,
  type GenerateQuestionsInput,
  type GenerateStudyInput,
  type GenerateTestInput
} from './ai.validation.js';
import type { AiExecutionService } from './ai.service.js';
import {
  ensureDefaultClaudeConfiguration,
  linkGenerationDecision,
  resolveExecutionPlan,
  upsertGenerationDrafts
} from './ai.repository.js';
import {
  aiQuestionTypes,
  buildQuestionGenerationPrompt,
  draftToQuestionCore,
  questionGenerationOutputSchema,
  questionGenerationSystemPrompt,
  type AiQuestionType,
  type QuestionDraft
} from './question-generation.js';
import {
  buildStudyGenerationPrompt,
  draftToStudyMaterial,
  studyContentTypeKeys,
  studyGenerationOutputSchema,
  studyGenerationSystemPrompt
} from './study-generation.js';

const QUESTION_GENERATION_CONFIGURATION_KEY = 'question-generation.default';

function principal(request: Request): SessionPrincipal & { tenantId: string } {
  if (!request.auth?.tenantId) throw new ApiError(401, 'Authentication is required.');
  return { ...request.auth, tenantId: request.auth.tenantId };
}

function context(request: Request): RequestContext {
  const userAgent = request.headers['user-agent'];
  return {
    ...(request.ip ? { ip: request.ip } : {}),
    ...(typeof request.id === 'string' || typeof request.id === 'number'
      ? { requestId: String(request.id) }
      : {}),
    ...(typeof userAgent === 'string' ? { userAgent } : {})
  };
}

function idempotencyKey(request: Request, scope: string, tenantId: string): string {
  const header = request.headers['idempotency-key'];
  const client = typeof header === 'string' && header.trim() ? header.trim() : randomUUID();
  return `${tenantId}:${scope}:${client}`;
}

interface AiQuestionOutput {
  questions: unknown[];
}

function validateGenerationOutput(value: unknown): AiQuestionOutput {
  if (
    typeof value !== 'object' ||
    value === null ||
    !Array.isArray((value as { questions?: unknown }).questions)
  ) {
    throw new Error('The AI response did not include a questions array.');
  }
  return value as AiQuestionOutput;
}

function validateStudyOutput(value: unknown): Record<string, unknown> {
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof (value as { title?: unknown }).title !== 'string' ||
    !Array.isArray((value as { sections?: unknown }).sections)
  ) {
    throw new Error('The AI response did not include valid study material.');
  }
  return value as Record<string, unknown>;
}

export function createAiRouter(
  prisma: ZorflyPrismaClient,
  authService: AuthService,
  tokens: TokenService,
  aiService: AiExecutionService
): Router {
  const router = Router();
  const configuredTenants = new Set<string>();
  router.use(createRequireAuth(tokens));
  router.use(createRequirePermission(authService, 'questions:manage'));
  router.use(async (request, _response, next) => {
    try {
      const auth = principal(request);
      if (process.env.ANTHROPIC_API_KEY && !configuredTenants.has(auth.tenantId)) {
        const existingPlan = await resolveExecutionPlan(
          prisma,
          auth.tenantId,
          QUESTION_GENERATION_CONFIGURATION_KEY
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

  router.get('/status', async (request, response) => {
    const auth = principal(request);
    const plan = await resolveExecutionPlan(
      prisma,
      auth.tenantId,
      QUESTION_GENERATION_CONFIGURATION_KEY
    );
    response.json({
      success: true,
      data: {
        configured: plan.length > 0,
        questionTypes: aiQuestionTypes,
        studyContentTypes: studyContentTypeKeys
      }
    });
  });

  router.post(
    '/questions/generate',
    validate(generateQuestionsSchema),
    async (request, response, next) => {
      try {
        const auth = principal(request);
        const body = request.body as GenerateQuestionsInput;

        const result = await aiService.generate<AiQuestionOutput>({
          tenantId: auth.tenantId,
          actorId: auth.userId,
          purpose: AIExecutionPurpose.QUESTION_GENERATION,
          configurationKey: QUESTION_GENERATION_CONFIGURATION_KEY,
          capability: 'structured_output',
          messages: [
            { role: 'system', content: questionGenerationSystemPrompt },
            {
              role: 'user',
              content: buildQuestionGenerationPrompt({
                topic: body.topic,
                count: body.count,
                difficulty: body.difficulty,
                ...(body.types ? { types: body.types } : {}),
                ...(body.instructions ? { instructions: body.instructions } : {})
              })
            }
          ],
          outputSchema: questionGenerationOutputSchema,
          validateOutput: validateGenerationOutput,
          idempotencyKey: idempotencyKey(request, 'question-generation', auth.tenantId),
          sourceType: 'question_generation_preview'
        });

        const allowed: readonly AiQuestionType[] = body.types?.length ? body.types : ['mcq'];
        const rawItems = result.output.questions;
        const parsed = rawItems.map((item) => draftToQuestionCore(item));

        // Idempotent and crash-safe: existing rows for this execution are left
        // untouched, and any missing (e.g. a prior request that succeeded at
        // the AI call but was interrupted before history was recorded) are
        // backfilled here — this always runs, whether or not the execution
        // itself was reused, so a valid draft never comes back without a
        // historyId.
        const historyRows = await upsertGenerationDrafts(
          prisma,
          auth.tenantId,
          result.executionId,
          parsed.map((draft, index) => ({
            draftIndex: index,
            request: {
              topic: body.topic,
              difficulty: body.difficulty,
              count: body.count,
              types: body.types ?? null,
              instructions: body.instructions ?? null
            } as Prisma.InputJsonValue,
            validationResult: (draft
              ? { valid: true, type: draft.type }
              : { valid: false }) as Prisma.InputJsonValue
          }))
        );

        const drafts: Array<QuestionDraft & { historyId: string }> = [];
        parsed.forEach((draft, index) => {
          if (draft && allowed.includes(draft.type)) {
            drafts.push({ ...draft, historyId: historyRows[index]?.historyId ?? '' });
          }
        });

        response.json({
          success: true,
          data: {
            drafts: drafts.map((draft) => ({
              ...draft,
              categoryId: body.categoryId,
              subCategoryId: body.subCategoryId ?? null,
              difficulty: body.difficulty,
              marks: body.marks,
              negativeMarks: body.negativeMarks,
              trainingLink: '',
              tags: ['ai-generated']
            })),
            generated: rawItems.length,
            valid: drafts.length,
            message: `${drafts.length} question(s) generated.`
          }
        });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post('/questions/save', validate(saveQuestionsSchema), async (request, response, next) => {
    try {
      const auth = principal(request);
      const body = request.body as ReturnType<typeof saveQuestionsSchema.parse>;
      const created: string[] = [];
      const errors: Array<{ index: number; message: string }> = [];
      for (const [index, question] of body.questions.entries()) {
        try {
          const record = await createQuestion(
            prisma,
            auth.tenantId,
            auth.userId,
            question,
            async (transaction, _createdQuestion, version) => {
              if (!question.historyId) return;
              await linkGenerationDecision(transaction, {
                tenantId: auth.tenantId,
                historyId: question.historyId,
                generatedQuestionVersionId: version.id,
                decidedById: auth.userId
              });
            },
            QuestionStatus.IN_REVIEW
          );
          created.push(record.id);
        } catch (error) {
          errors.push({
            index,
            message: error instanceof ApiError ? error.message : 'Failed to save question.'
          });
        }
      }
      response.status(201).json({
        success: true,
        data: {
          created: created.length,
          errors,
          message: `${created.length} question(s) added to the bank.`
        }
      });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/tests/generate',
    createRequirePermission(authService, 'tests:manage'),
    validate(generateTestSchema),
    async (request, response, next) => {
      try {
        const auth = principal(request);
        const body = request.body as GenerateTestInput;

        const result = await aiService.generate<AiQuestionOutput>({
          tenantId: auth.tenantId,
          actorId: auth.userId,
          purpose: AIExecutionPurpose.QUESTION_GENERATION,
          configurationKey: QUESTION_GENERATION_CONFIGURATION_KEY,
          capability: 'structured_output',
          messages: [
            { role: 'system', content: questionGenerationSystemPrompt },
            {
              role: 'user',
              content: buildQuestionGenerationPrompt({
                topic: body.topic,
                count: body.questionCount,
                difficulty: body.difficulty,
                ...(body.types ? { types: body.types } : {}),
                ...(body.instructions ? { instructions: body.instructions } : {})
              })
            }
          ],
          outputSchema: questionGenerationOutputSchema,
          validateOutput: validateGenerationOutput,
          idempotencyKey: idempotencyKey(request, 'test-generation', auth.tenantId),
          sourceType: 'test_generation'
        });

        const allowed: readonly AiQuestionType[] = body.types?.length ? body.types : ['mcq'];
        const rawItems = result.output.questions;
        const parsed = rawItems.map((item) => draftToQuestionCore(item));

        const historyRows = await upsertGenerationDrafts(
          prisma,
          auth.tenantId,
          result.executionId,
          parsed.map((draft, index) => ({
            draftIndex: index,
            request: {
              topic: body.topic,
              difficulty: body.difficulty,
              count: body.questionCount,
              types: body.types ?? null,
              instructions: body.instructions ?? null
            } as Prisma.InputJsonValue,
            validationResult: (draft
              ? { valid: true, type: draft.type }
              : { valid: false }) as Prisma.InputJsonValue
          }))
        );

        const questionInputs: Array<{ input: QuestionInput; historyId: string }> = [];
        parsed.forEach((draft, index) => {
          if (!draft || !allowed.includes(draft.type)) return;
          const candidate = questionSchema.safeParse({
            title: draft.title,
            type: draft.type,
            categoryId: body.categoryId,
            subCategoryId: body.subCategoryId ?? null,
            difficulty: body.difficulty,
            marks: body.marks,
            negativeMarks: 0,
            explanation: draft.explanation,
            trainingLink: '',
            tags: ['ai-generated'],
            content: draft.content
          });
          if (candidate.success) {
            questionInputs.push({
              input: candidate.data,
              historyId: historyRows[index]?.historyId ?? ''
            });
          }
        });

        if (questionInputs.length === 0) {
          throw new ApiError(
            422,
            'The AI could not produce valid questions for this topic. Try rephrasing it or choosing a different question type.'
          );
        }

        const questionIds: string[] = [];
        for (const { input, historyId } of questionInputs) {
          const record = await createQuestion(
            prisma,
            auth.tenantId,
            auth.userId,
            input,
            async (transaction, _createdQuestion, version) => {
              if (!historyId) return;
              await linkGenerationDecision(transaction, {
                tenantId: auth.tenantId,
                historyId,
                generatedQuestionVersionId: version.id,
                decidedById: auth.userId
              });
            },
            QuestionStatus.IN_REVIEW
          );
          questionIds.push(record.id);
        }

        const testInput = testSchema.parse({
          title: (body.title || `AI Test: ${body.topic}`).slice(0, 200),
          description: `Auto-generated from the topic "${body.topic}".`.slice(0, 2000),
          categoryId: body.categoryId,
          subCategoryId: body.subCategoryId ?? null,
          difficulty: body.difficulty,
          mode: 'fixed',
          questionIds,
          settings: {
            ...(body.passingPercentage !== undefined
              ? { passingPercentage: body.passingPercentage }
              : {}),
            ...(body.timeLimitMin !== undefined ? { timeLimitMin: body.timeLimitMin } : {})
          }
        });
        const test = await createDraftTest(
          prisma,
          authService,
          auth.tenantId,
          auth.userId,
          testInput,
          context(request)
        );

        response.status(201).json({
          success: true,
          data: {
            testId: test.id,
            questionCount: questionIds.length,
            message: `Draft test created with ${questionIds.length} question(s).`
          }
        });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/study/generate',
    createRequirePermission(authService, 'learning:manage'),
    validate(generateStudySchema),
    async (request, response, next) => {
      try {
        const auth = principal(request);
        const body = request.body as GenerateStudyInput;

        const result = await aiService.generate<Record<string, unknown>>({
          tenantId: auth.tenantId,
          actorId: auth.userId,
          purpose: AIExecutionPurpose.QUESTION_GENERATION,
          configurationKey: QUESTION_GENERATION_CONFIGURATION_KEY,
          capability: 'structured_output',
          messages: [
            { role: 'system', content: studyGenerationSystemPrompt },
            {
              role: 'user',
              content: buildStudyGenerationPrompt({
                topic: body.topic,
                contentType: body.contentType,
                ...(body.difficulty ? { difficulty: body.difficulty } : {}),
                ...(body.instructions ? { instructions: body.instructions } : {}),
                ...(body.questionCount !== undefined ? { questionCount: body.questionCount } : {})
              })
            }
          ],
          outputSchema: studyGenerationOutputSchema,
          validateOutput: validateStudyOutput,
          idempotencyKey: idempotencyKey(request, 'study-generation', auth.tenantId),
          sourceType: 'study_generation'
        });

        const draft = draftToStudyMaterial(result.output, body.topic);
        const materialInput = learningMaterialSchema.parse({
          title: draft.title,
          categoryId: body.categoryId,
          subCategoryId: body.subCategoryId ?? null,
          difficulty: body.difficulty ?? null,
          type: body.contentType,
          body: { overview: draft.overview, sections: draft.sections, keyPoints: draft.keyPoints },
          questions: draft.questions,
          tags: ['ai-generated']
        });

        const material = await createLearningMaterial(
          prisma,
          auth.tenantId,
          auth.userId,
          materialInput,
          { source: 'ai' }
        );

        response.status(201).json({
          success: true,
          data: {
            id: material.id,
            title: draft.title,
            message: 'Study material generated successfully.'
          }
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

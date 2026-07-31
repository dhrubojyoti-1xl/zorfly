import { randomUUID } from 'node:crypto';
import { Router, type Request } from 'express';
import { AIExecutionPurpose, type ZorflyPrismaClient } from '@zorfly/database';
import { ApiError } from '../../platform/api-error.js';
import { validate } from '../../platform/validate.js';
import { createQuestion } from '../assessment/questions.router.js';
import { createRequireAuth, createRequirePermission } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { SessionPrincipal } from '../auth/auth.types.js';
import type { TokenService } from '../auth/tokens.js';
import {
  generateQuestionsSchema,
  saveQuestionsSchema,
  type GenerateQuestionsInput
} from './ai.validation.js';
import type { AiExecutionService } from './ai.service.js';
import { resolveExecutionPlan } from './ai.repository.js';
import {
  aiQuestionTypes,
  buildQuestionGenerationPrompt,
  draftToQuestionCore,
  questionGenerationOutputSchema,
  questionGenerationSystemPrompt,
  type AiQuestionType,
  type QuestionDraft
} from './question-generation.js';

const QUESTION_GENERATION_CONFIGURATION_KEY = 'question-generation.default';

function principal(request: Request): SessionPrincipal & { tenantId: string } {
  if (!request.auth?.tenantId) throw new ApiError(401, 'Authentication is required.');
  return { ...request.auth, tenantId: request.auth.tenantId };
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

export function createAiRouter(
  prisma: ZorflyPrismaClient,
  authService: AuthService,
  tokens: TokenService,
  aiService: AiExecutionService
): Router {
  const router = Router();
  router.use(createRequireAuth(tokens));
  router.use(createRequirePermission(authService, 'questions:manage'));

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
        studyContentTypes: []
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
        const drafts: QuestionDraft[] = result.output.questions
          .map((item) => draftToQuestionCore(item))
          .filter((draft): draft is QuestionDraft => draft !== null && allowed.includes(draft.type))
          .map((draft) => ({
            ...draft,
            explanation: draft.explanation
          }));

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
            generated: result.output.questions.length,
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
          const record = await createQuestion(prisma, auth.tenantId, auth.userId, question);
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

  return router;
}

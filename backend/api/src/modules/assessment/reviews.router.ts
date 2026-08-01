import { Router, type Request } from 'express';
import {
  AssignmentStatus,
  AttemptMode,
  AttemptStatus,
  EvaluationStatus,
  ManualReviewStatus,
  MembershipStatus,
  type Prisma,
  type ZorflyPrismaClient
} from '@zorfly/database';
import { ApiError } from '../../platform/api-error.js';
import { validate } from '../../platform/validate.js';
import { createRequireAuth, createRequirePermission } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { RequestContext, SessionPrincipal } from '../auth/auth.types.js';
import type { TokenService } from '../auth/tokens.js';
import { scoreSchema, type ScoreInput } from './review.validation.js';

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

function object(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function array(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          typeof item === 'object' && item !== null && !Array.isArray(item)
      )
    : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function number(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

const attemptInclude = {
  assignment: {
    include: {
      assessmentVersion: { include: { assessment: true } }
    }
  },
  membership: { include: { user: true } },
  questions: {
    orderBy: { questionOrder: 'asc' as const },
    include: {
      response: true,
      questionVersion: { include: { question: true } },
      manualReviews: { orderBy: { reviewRound: 'desc' as const }, take: 1 }
    }
  }
} satisfies Prisma.AssessmentAttemptInclude;

type ReviewAttempt = Prisma.AssessmentAttemptGetPayload<{ include: typeof attemptInclude }>;

async function reviewerMembership(prisma: ZorflyPrismaClient, tenantId: string, userId: string) {
  const membership = await prisma.tenantMembership.findFirst({
    where: { tenantId, userId, status: MembershipStatus.ACTIVE, deletedAt: null }
  });
  if (!membership) throw new ApiError(403, 'You are not an active member of this company.');
  return membership;
}

async function findReviewAttempt(
  prisma: ZorflyPrismaClient,
  tenantId: string,
  publicId: string
): Promise<ReviewAttempt | null> {
  return prisma.assessmentAttempt.findFirst({
    where: { tenantId, publicId, status: AttemptStatus.NEEDS_REVIEW },
    include: attemptInclude
  });
}

export function createReviewRouter(
  prisma: ZorflyPrismaClient,
  service: AuthService,
  tokens: TokenService
): Router {
  const router = Router();
  router.use(createRequireAuth(tokens));
  router.use(createRequirePermission(service, 'reviews:manage'));

  router.get('/', async (request, response) => {
    const auth = principal(request);
    const attempts = await prisma.assessmentAttempt.findMany({
      where: {
        tenantId: auth.tenantId,
        mode: AttemptMode.OFFICIAL,
        status: AttemptStatus.NEEDS_REVIEW
      },
      include: {
        assignment: { include: { assessmentVersion: { include: { assessment: true } } } },
        membership: { include: { user: true } },
        questions: { where: { status: EvaluationStatus.NEEDS_REVIEW }, select: { id: true } }
      },
      orderBy: { submittedAt: 'asc' }
    });
    response.json({
      success: true,
      data: {
        rows: attempts.map((attempt) => ({
          id: attempt.publicId,
          testTitle: attempt.assignment?.assessmentVersion.assessment.title ?? 'Test',
          employeeName: attempt.membership?.user.displayName ?? 'Employee',
          submittedAt: attempt.submittedAt,
          pendingCount: attempt.questions.length
        })),
        totalCount: attempts.length
      }
    });
  });

  router.get('/:attemptId', async (request, response) => {
    const auth = principal(request);
    const attempt = await findReviewAttempt(
      prisma,
      auth.tenantId,
      String(request.params.attemptId ?? '')
    );
    if (!attempt) throw new ApiError(404, 'The requested attempt was not found.');
    const summary = object(attempt.resultSummary);
    const perQuestion = array(summary.perQuestion);
    const suggestedByQuestion = new Map(
      perQuestion.map((entry) => [String(entry.questionId), number(entry.suggestedObtained)])
    );
    const pending = attempt.questions.filter(
      (question) => question.status === EvaluationStatus.NEEDS_REVIEW
    );
    response.json({
      success: true,
      data: {
        id: attempt.publicId,
        rows: pending.map((question) => {
          const questionId = question.questionVersion.questionId;
          const answerSchema = object(question.questionVersion.answerSchema);
          const answer = object(question.response?.answer);
          return {
            questionId,
            title: question.questionVersion.question.title,
            imageUrl: typeof answerSchema.imageUrl === 'string' ? answerSchema.imageUrl : '',
            max: Number(question.maxMarks),
            suggestedObtained: suggestedByQuestion.get(questionId) ?? 0,
            typedAnswers: strings(answer.typedAnswers),
            mistakes: array(answerSchema.mistakes).map((mistake) =>
              typeof mistake.label === 'string' ? mistake.label : ''
            )
          };
        })
      }
    });
  });

  router.post('/:attemptId/:questionId', validate(scoreSchema), async (request, response) => {
    const auth = principal(request);
    const reviewer = await reviewerMembership(prisma, auth.tenantId, auth.userId);
    const attempt = await findReviewAttempt(
      prisma,
      auth.tenantId,
      String(request.params.attemptId ?? '')
    );
    if (!attempt) throw new ApiError(404, 'The requested attempt was not found.');
    const input = request.body as ScoreInput;
    const targetQuestionId = String(request.params.questionId ?? '');
    const attemptQuestion = attempt.questions.find(
      (question) =>
        question.questionVersion.questionId === targetQuestionId &&
        question.status === EvaluationStatus.NEEDS_REVIEW
    );
    if (!attemptQuestion) throw new ApiError(404, 'This question is not awaiting review.');
    const max = Number(attemptQuestion.maxMarks);
    if (input.obtained > max) {
      throw new ApiError(422, `Marks must not exceed the question maximum of ${String(max)}.`, {
        obtained: `Marks must not exceed ${String(max)}.`
      });
    }
    const obtainedRounded = Math.round(input.obtained * 100) / 100;
    const reviewedAt = new Date();

    const summary = object(attempt.resultSummary);
    const perQuestion = array(summary.perQuestion);
    const updatedPerQuestion = perQuestion.map((entry) =>
      String(entry.questionId) === targetQuestionId
        ? {
            ...entry,
            obtained: obtainedRounded,
            pendingReview: false,
            fullMarks: obtainedRounded >= max,
            reviewedByMembershipId: reviewer.id
          }
        : entry
    );
    const obtained =
      Math.round(updatedPerQuestion.reduce((sum, entry) => sum + number(entry.obtained), 0) * 100) /
      100;
    const totalMax = updatedPerQuestion.reduce((sum, entry) => sum + number(entry.max), 0);
    const attempted = updatedPerQuestion.filter((entry) => entry.attempted === true).length;
    const fullMarksCount = updatedPerQuestion.filter((entry) => entry.fullMarks === true).length;
    const stillPending = updatedPerQuestion.some((entry) => entry.pendingReview === true);
    const percentage = totalMax > 0 ? Math.round((obtained / totalMax) * 10_000) / 100 : 0;
    const accuracy = attempted > 0 ? Math.round((fullMarksCount / attempted) * 10_000) / 100 : 0;
    const passingPercentage = number(
      object(attempt.assignment?.assessmentVersion.configuration).passingPercentage,
      50
    );
    const passed = percentage >= passingPercentage;
    const nextStatus = stillPending ? AttemptStatus.NEEDS_REVIEW : AttemptStatus.PUBLISHED;

    const latestReview = attemptQuestion.manualReviews[0];

    await prisma.$transaction(async (transaction) => {
      await transaction.attemptQuestion.update({
        where: { id: attemptQuestion.id },
        data: {
          score: obtainedRounded,
          status: EvaluationStatus.SCORED,
          rowVersion: { increment: 1 }
        }
      });
      if (latestReview) {
        await transaction.manualReview.update({
          where: { id: latestReview.id },
          data: {
            status: ManualReviewStatus.COMPLETED,
            score: obtainedRounded,
            reviewerMembershipId: reviewer.id,
            completedAt: reviewedAt,
            rowVersion: { increment: 1 }
          }
        });
      }
      await transaction.assessmentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: nextStatus,
          finalScore: obtained,
          rawScore: obtained,
          percentage,
          passed,
          publishedAt: stillPending ? null : reviewedAt,
          resultSummary: {
            ...summary,
            perQuestion: updatedPerQuestion,
            accuracy,
            pendingReview: stillPending,
            pendingReviewCount: updatedPerQuestion.filter((entry) => entry.pendingReview === true)
              .length
          } as unknown as Prisma.InputJsonObject,
          rowVersion: { increment: 1 }
        }
      });
      if (!stillPending && attempt.assignmentId) {
        await transaction.assessmentAssignment.update({
          where: { id: attempt.assignmentId },
          data: {
            status: AssignmentStatus.COMPLETED,
            completedAt: reviewedAt,
            rowVersion: { increment: 1 }
          }
        });
      }
    });

    if (!stillPending && attempt.membership) {
      const reviewedTitle = attempt.assignment?.assessmentVersion.assessment.title ?? 'Test';
      service.sendNotification({
        to: attempt.membership.user.emailCanonical,
        subject: `Result published: ${reviewedTitle}`,
        html: `<p>Your typed answers have been reviewed. Final score: ${String(obtained)}/${String(totalMax)} (${String(percentage)}%) — ${passed ? 'passed' : 'not passed'}.</p>`,
        type: 'result_published',
        tenantId: auth.tenantId,
        membershipId: attempt.membership.id,
        title: `Result published: ${reviewedTitle}`,
        body: `Your typed answers have been reviewed. Final score: ${String(obtained)}/${String(totalMax)} (${String(percentage)}%) — ${passed ? 'passed' : 'not passed'}.`,
        link: `/app/results/${attempt.publicId}`
      });
      await service.recordAudit(
        {
          action: 'attempt.reviewed',
          actorUserId: auth.userId,
          tenantId: auth.tenantId,
          entityType: 'assessment_attempt',
          entityId: attempt.publicId,
          metadata: { obtained, percentage, passed }
        },
        context(request)
      );
    }

    response.json({
      success: true,
      data: {
        obtained,
        percentage,
        pendingReview: stillPending,
        message: 'Marks saved successfully.'
      }
    });
  });

  return router;
}

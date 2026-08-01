import { createHash, randomUUID } from 'node:crypto';
import { Router, type Request } from 'express';
import { z } from 'zod';
import {
  AssignmentStatus,
  AttemptMode,
  AttemptStatus,
  EvaluationStatus,
  IntegrityEventType,
  MembershipStatus,
  QuestionStatus,
  Prisma,
  VersionStatus,
  type ZorflyPrismaClient
} from '@zorfly/database';
import { ApiError } from '../../platform/api-error.js';
import { validate } from '../../platform/validate.js';
import { createRequireAuth } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { RequestContext, SessionPrincipal } from '../auth/auth.types.js';
import type { TokenService } from '../auth/tokens.js';
import { scoreAttempt, type ScorableQuestion } from './scoring.js';
import { sanitizeQuestionContent } from './tests.router.js';

const startSchema = z.object({ testId: z.uuid() });
const answerSchema = z.object({
  questionId: z.uuid(),
  answer: z.unknown().refine((value) => value !== undefined, 'Answer is required.'),
  sequence: z.number().int().min(0).optional()
});
const snapshotSchema = z.object({ image: z.string().min(20).max(400_000) });
const graceMilliseconds = 60_000;

const attemptInclude = {
  assignment: {
    include: {
      assessmentVersion: { include: { assessment: true } }
    }
  },
  paper: {
    include: {
      questions: {
        orderBy: { questionOrder: 'asc' as const },
        include: {
          questionVersion: {
            include: {
              questionType: true,
              question: { include: { category: { include: { parent: true } } } }
            }
          }
        }
      }
    }
  },
  questions: {
    orderBy: { questionOrder: 'asc' as const },
    include: {
      response: true,
      paperQuestion: true,
      questionVersion: {
        include: {
          questionType: true,
          question: { include: { category: { include: { parent: true } } } }
        }
      }
    }
  }
} satisfies Prisma.AssessmentAttemptInclude;

type AttemptRecord = Prisma.AssessmentAttemptGetPayload<{ include: typeof attemptInclude }>;

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

function testConfiguration(value: Prisma.JsonValue | null) {
  const config = object(value);
  return {
    mode: config.mode === 'random' ? 'random' : 'fixed',
    passingPercentage: typeof config.passingPercentage === 'number' ? config.passingPercentage : 50,
    timeLimitMin: typeof config.timeLimitMin === 'number' ? config.timeLimitMin : 0,
    timeLimitPerQuestionSec:
      typeof config.timeLimitPerQuestionSec === 'number' ? config.timeLimitPerQuestionSec : 0
  } as const;
}

function queryString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function pageQuery(request: Request) {
  const page = Math.max(1, Number.parseInt(queryString(request.query.page), 10) || 1);
  const requested = Number.parseInt(queryString(request.query.limit), 10) || 10;
  const limit = [10, 20, 50, 100].includes(requested) ? requested : 10;
  return { page, limit, skip: (page - 1) * limit };
}

function deadline(attempt: Pick<AttemptRecord, 'expiresAt'>): number | null {
  return attempt.expiresAt ? attempt.expiresAt.getTime() + graceMilliseconds : null;
}

function timeIsOver(attempt: Pick<AttemptRecord, 'expiresAt'>): boolean {
  const value = deadline(attempt);
  return value !== null && Date.now() > value;
}

function answerMap(attempt: AttemptRecord): Record<string, unknown> {
  return Object.fromEntries(
    attempt.questions
      .filter((question) => question.response)
      .map((question) => [question.questionVersion.questionId, question.response?.answer ?? null])
  );
}

function clientView(attempt: AttemptRecord) {
  const version = attempt.assignment?.assessmentVersion;
  const config = testConfiguration(version?.configuration ?? null);
  return {
    id: attempt.publicId,
    testId: version?.assessmentId ?? null,
    testTitle: version?.assessment.title ?? 'Practice Test',
    mode: attempt.mode.toLowerCase(),
    timeLimitMin: config.timeLimitMin,
    perQuestionSec: config.timeLimitPerQuestionSec,
    antiCheat: version?.antiCheatingPolicy ?? null,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    answers: answerMap(attempt),
    questions: attempt.questions.map((question) => ({
      id: question.questionVersion.questionId,
      title: question.questionVersion.question.title,
      type: question.questionVersion.questionType.key,
      categoryId: question.questionVersion.question.category.parentId
        ? question.questionVersion.question.category.parentId
        : question.questionVersion.question.categoryId,
      subCategoryId: question.questionVersion.question.category.parentId
        ? question.questionVersion.question.categoryId
        : null,
      marks: Number(question.maxMarks),
      content: sanitizeQuestionContent(
        question.questionVersion.questionType.key,
        question.questionVersion.answerSchema
      )
    }))
  };
}

async function activeMembership(
  prisma: ZorflyPrismaClient,
  auth: SessionPrincipal & { tenantId: string }
) {
  const membership = await prisma.tenantMembership.findFirst({
    where: {
      tenantId: auth.tenantId,
      userId: auth.userId,
      status: MembershipStatus.ACTIVE,
      deletedAt: null
    },
    include: { user: true }
  });
  if (!membership) throw new ApiError(403, 'You are not an active member of this company.');
  return membership;
}

interface PaperSource {
  id: string;
  tenantId: string;
  assessmentVersionId: string;
  assessmentVersion: {
    id: string;
    configuration: Prisma.JsonValue | null;
    questions: Array<{
      questionVersionId: string;
      sortOrder: number;
      marksOverride: Prisma.Decimal | null;
      negativeMarksOverride: Prisma.Decimal | null;
      questionVersion: {
        defaultMarks: Prisma.Decimal;
        defaultNegativeMarks: Prisma.Decimal;
      };
    }>;
    poolRules: Array<{ selectionCount: number; filter: Prisma.JsonValue }>;
  };
}

async function createPaper(
  transaction: Prisma.TransactionClient,
  assignment: PaperSource
): Promise<string> {
  const config = testConfiguration(assignment.assessmentVersion.configuration);
  const seed = randomUUID();
  let selected = assignment.assessmentVersion.questions.map((entry) => ({
    questionVersionId: entry.questionVersionId,
    marks: entry.marksOverride ?? entry.questionVersion.defaultMarks,
    negativeMarks: entry.negativeMarksOverride ?? entry.questionVersion.defaultNegativeMarks
  }));
  if (config.mode === 'random') {
    const rule = assignment.assessmentVersion.poolRules[0];
    const filter = object(rule?.filter);
    const count =
      rule?.selectionCount ??
      (typeof object(assignment.assessmentVersion.configuration).randomConfig === 'object'
        ? Number(
            object(
              object(assignment.assessmentVersion.configuration).randomConfig as Prisma.JsonValue
            ).count ?? 0
          )
        : 0);
    const candidates = await transaction.question.findMany({
      where: {
        tenantId: assignment.tenantId,
        status: QuestionStatus.PUBLISHED,
        deletedAt: null,
        currentVersionId: { not: null },
        ...(typeof filter.categoryId === 'string' ? { categoryId: filter.categoryId } : {})
      },
      include: { currentVersion: true }
    });
    selected = candidates
      .filter((candidate) => candidate.currentVersion?.status === VersionStatus.PUBLISHED)
      .sort((left, right) =>
        createHash('sha256')
          .update(`${seed}:${left.id}`)
          .digest('hex')
          .localeCompare(createHash('sha256').update(`${seed}:${right.id}`).digest('hex'))
      )
      .slice(0, count)
      .flatMap((candidate) =>
        candidate.currentVersion
          ? [
              {
                questionVersionId: candidate.currentVersion.id,
                marks: candidate.currentVersion.defaultMarks,
                negativeMarks: candidate.currentVersion.defaultNegativeMarks
              }
            ]
          : []
      );
    if (selected.length < count) {
      throw new ApiError(422, 'Not enough questions are available for this test.');
    }
  }
  if (selected.length === 0) throw new ApiError(422, 'This test has no questions.');
  const contentHash = createHash('sha256')
    .update(`${seed}:${selected.map((question) => question.questionVersionId).join(':')}`)
    .digest('hex');
  const paper = await transaction.assessmentPaper.create({
    data: {
      tenantId: assignment.tenantId,
      assignmentId: assignment.id,
      assessmentVersionId: assignment.assessmentVersionId,
      randomSeed: seed,
      contentHash,
      totalMarks: selected.reduce((sum, question) => sum + Number(question.marks), 0),
      questions: {
        create: selected.map((question, index) => ({
          tenantId: assignment.tenantId,
          questionVersionId: question.questionVersionId,
          questionOrder: index + 1,
          maxMarks: question.marks,
          negativeMarks: question.negativeMarks
        }))
      }
    }
  });
  return paper.id;
}

async function findAttempt(
  prisma: ZorflyPrismaClient,
  publicId: string,
  tenantId: string,
  membershipId: string
): Promise<AttemptRecord | null> {
  return prisma.assessmentAttempt.findFirst({
    where: { publicId, tenantId, membershipId },
    include: attemptInclude
  });
}

export function createAttemptRouter(
  prisma: ZorflyPrismaClient,
  service: AuthService,
  tokens: TokenService
): Router {
  const router = Router();
  router.use(createRequireAuth(tokens));

  router.get('/my-tests', async (request, response) => {
    const auth = principal(request);
    const membership = await activeMembership(prisma, auth);
    const assignments = await prisma.assessmentAssignment.findMany({
      where: {
        tenantId: auth.tenantId,
        membershipId: membership.id,
        assessmentVersion: { assessment: { status: { not: 'ARCHIVED' }, deletedAt: null } }
      },
      include: {
        assessmentVersion: { include: { assessment: true } },
        attempts: {
          where: { mode: AttemptMode.OFFICIAL },
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    const seen = new Set<string>();
    const rows = assignments.flatMap((assignment) => {
      const testId = assignment.assessmentVersion.assessmentId;
      if (seen.has(testId)) return [];
      seen.add(testId);
      const inProgress = assignment.attempts.find(
        (attempt) => attempt.status === AttemptStatus.IN_PROGRESS
      );
      const submitted = assignment.attempts.filter(
        (attempt) =>
          attempt.status === AttemptStatus.PUBLISHED ||
          attempt.status === AttemptStatus.NEEDS_REVIEW ||
          attempt.status === AttemptStatus.EVALUATED ||
          attempt.status === AttemptStatus.SUBMITTED
      );
      const best = submitted.reduce<(typeof submitted)[number] | null>(
        (current, attempt) =>
          Number(attempt.percentage ?? -1) > Number(current?.percentage ?? -1) ? attempt : current,
        null
      );
      return [
        {
          testId,
          title: assignment.assessmentVersion.assessment.title,
          timeLimitMin: Math.round((assignment.assessmentVersion.durationSeconds ?? 0) / 60),
          attemptsAllowed: assignment.maxAttempts,
          attemptsUsed: submitted.length,
          dueAt: assignment.dueAt,
          inProgressAttemptId: inProgress?.publicId ?? null,
          bestPercentage: best?.percentage === null ? null : Number(best?.percentage),
          bestPassed: best?.passed ?? null,
          lastAttemptId: submitted[0]?.publicId ?? null,
          status: inProgress
            ? 'in_progress'
            : submitted.length > 0
              ? 'completed'
              : assignment.status === AssignmentStatus.CANCELLED
                ? 'cancelled'
                : assignment.dueAt && assignment.dueAt < new Date()
                  ? 'missed'
                  : 'pending'
        }
      ];
    });
    response.json({ success: true, data: { rows, totalCount: rows.length } });
  });

  router.post('/start', validate(startSchema), async (request, response) => {
    const auth = principal(request);
    const input = startSchema.parse(request.body);
    const membership = await activeMembership(prisma, auth);
    const existing = await prisma.assessmentAttempt.findFirst({
      where: {
        tenantId: auth.tenantId,
        membershipId: membership.id,
        mode: AttemptMode.OFFICIAL,
        status: AttemptStatus.IN_PROGRESS,
        assignment: { assessmentVersion: { assessmentId: input.testId } }
      },
      include: attemptInclude
    });
    if (existing) {
      response.json({ success: true, data: clientView(existing) });
      return;
    }

    let created: AttemptRecord | null = null;
    for (let tryNumber = 1; tryNumber <= 3 && !created; tryNumber += 1) {
      try {
        created = await prisma.$transaction(
          async (transaction) => {
            const assignment = await transaction.assessmentAssignment.findFirst({
              where: {
                tenantId: auth.tenantId,
                membershipId: membership.id,
                status: { in: [AssignmentStatus.PENDING, AssignmentStatus.AVAILABLE] },
                availableAt: { lte: new Date() },
                AND: [
                  { OR: [{ closesAt: null }, { closesAt: { gt: new Date() } }] },
                  { OR: [{ dueAt: null }, { dueAt: { gt: new Date() } }] }
                ],
                assessmentVersion: {
                  status: VersionStatus.PUBLISHED,
                  assessment: { id: input.testId, deletedAt: null }
                }
              },
              include: {
                retakeGrants: true,
                assessmentVersion: {
                  include: {
                    assessment: true,
                    questions: {
                      orderBy: { sortOrder: 'asc' },
                      include: { questionVersion: true }
                    },
                    poolRules: { orderBy: { sortOrder: 'asc' } }
                  }
                }
              },
              orderBy: { createdAt: 'desc' }
            });
            if (!assignment) throw new ApiError(403, 'This test has not been assigned to you.');
            const granted = assignment.retakeGrants
              .filter(
                (grant) =>
                  grant.revokedAt === null && (!grant.expiresAt || grant.expiresAt > new Date())
              )
              .reduce((sum, grant) => sum + grant.additionalAttempts, 0);
            if (assignment.attemptCount >= assignment.maxAttempts + granted) {
              throw new ApiError(422, 'You have used all attempts for this test.');
            }
            const paperId = await createPaper(transaction, assignment);
            const paperQuestions = await transaction.assessmentPaperQuestion.findMany({
              where: { tenantId: auth.tenantId, paperId },
              orderBy: { questionOrder: 'asc' }
            });
            const now = new Date();
            const durationSeconds = assignment.assessmentVersion.durationSeconds ?? 0;
            const attempt = await transaction.assessmentAttempt.create({
              data: {
                tenantId: auth.tenantId,
                assignmentId: assignment.id,
                paperId,
                membershipId: membership.id,
                mode: AttemptMode.OFFICIAL,
                status: AttemptStatus.IN_PROGRESS,
                attemptNumber: assignment.attemptCount + 1,
                startedAt: now,
                expiresAt:
                  durationSeconds > 0 ? new Date(now.getTime() + durationSeconds * 1000) : null,
                questions: {
                  create: paperQuestions.map((question) => ({
                    tenantId: auth.tenantId,
                    paperQuestionId: question.id,
                    questionVersionId: question.questionVersionId,
                    questionOrder: question.questionOrder,
                    maxMarks: question.maxMarks
                  }))
                }
              },
              include: attemptInclude
            });
            await transaction.assessmentAssignment.update({
              where: { id: assignment.id },
              data: {
                status: AssignmentStatus.IN_PROGRESS,
                attemptCount: { increment: 1 },
                rowVersion: { increment: 1 }
              }
            });
            return attempt;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034' &&
          tryNumber < 3
        ) {
          continue;
        }
        throw error;
      }
    }
    if (!created) throw new ApiError(409, 'Could not start the test. Please try again.');
    await service.recordAudit(
      {
        action: 'attempt.started',
        actorUserId: auth.userId,
        tenantId: auth.tenantId,
        entityType: 'assessment_attempt',
        entityId: created.publicId
      },
      context(request)
    );
    response.status(201).json({ success: true, data: clientView(created) });
  });

  router.post('/practice/start', (_request, _response, next) => {
    next(
      new ApiError(
        422,
        'No practice content is available yet. Ask an admin to add material with practice questions in the Study Library.'
      )
    );
  });

  router.post('/:id/proctor-snapshot', validate(snapshotSchema), async (request, response) => {
    const auth = principal(request);
    const input = snapshotSchema.parse(request.body);
    const membership = await activeMembership(prisma, auth);
    const attempt = await findAttempt(
      prisma,
      queryString(request.params.id),
      auth.tenantId,
      membership.id
    );
    if (!attempt || attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new ApiError(404, 'The requested attempt was not found.');
    }
    const decodedLength = Buffer.byteLength(input.image, 'utf8');
    await prisma.integrityEvent.create({
      data: {
        tenantId: auth.tenantId,
        attemptId: attempt.id,
        eventType: IntegrityEventType.OTHER,
        severity: 1,
        occurredAt: new Date(),
        clientData: {
          kind: 'webcam_snapshot',
          sha256: createHash('sha256').update(input.image).digest('hex'),
          byteLength: decodedLength
        }
      }
    });
    response.json({ success: true, data: { saved: true } });
  });

  router.patch('/:id/answers', validate(answerSchema), async (request, response) => {
    const auth = principal(request);
    const input = answerSchema.parse(request.body);
    const membership = await activeMembership(prisma, auth);
    const attempt = await findAttempt(
      prisma,
      queryString(request.params.id),
      auth.tenantId,
      membership.id
    );
    if (!attempt || attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new ApiError(404, 'The requested attempt was not found.');
    }
    if (timeIsOver(attempt)) {
      throw new ApiError(422, 'Time is over for this attempt. Please submit now.');
    }
    const attemptQuestion = attempt.questions.find(
      (question) => question.questionVersion.questionId === input.questionId
    );
    if (!attemptQuestion) {
      throw new ApiError(422, 'This question does not belong to the attempt.');
    }
    const savedAt = new Date();
    const answer = input.answer as Prisma.InputJsonValue;
    const answerHash = createHash('sha256').update(JSON.stringify(input.answer)).digest('hex');
    await prisma.$transaction([
      prisma.attemptResponse.upsert({
        where: { attemptQuestionId: attemptQuestion.id },
        create: {
          tenantId: auth.tenantId,
          attemptQuestionId: attemptQuestion.id,
          answer,
          answerHash,
          clientSequence: input.sequence ?? 0,
          savedAt
        },
        update: {
          answer,
          answerHash,
          clientSequence: input.sequence ?? { increment: 1 },
          savedAt,
          rowVersion: { increment: 1 }
        }
      }),
      prisma.attemptQuestion.update({
        where: { id: attemptQuestion.id },
        data: {
          answeredAt: savedAt,
          firstViewedAt: attemptQuestion.firstViewedAt ?? savedAt,
          rowVersion: { increment: 1 }
        }
      }),
      prisma.assessmentAttempt.update({
        where: { id: attempt.id },
        data: { lastSavedAt: savedAt, rowVersion: { increment: 1 } }
      })
    ]);
    response.json({ success: true, data: { saved: true } });
  });

  router.post('/:id/submit', async (request, response) => {
    const auth = principal(request);
    const membership = await activeMembership(prisma, auth);
    const attempt = await findAttempt(
      prisma,
      queryString(request.params.id),
      auth.tenantId,
      membership.id
    );
    if (!attempt || attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new ApiError(404, 'The requested attempt was not found.');
    }
    const submittedAt = new Date();
    const version = attempt.assignment?.assessmentVersion;
    if (!version) throw new ApiError(422, 'This attempt is not linked to an assessment.');
    const config = testConfiguration(version.configuration);
    const scorable: ScorableQuestion[] = attempt.questions.map((question) => ({
      id: question.questionVersion.questionId,
      categoryId: question.questionVersion.question.category.parentId
        ? question.questionVersion.question.category.parentId
        : question.questionVersion.question.categoryId,
      subCategoryId: question.questionVersion.question.category.parentId
        ? question.questionVersion.question.categoryId
        : null,
      type: question.questionVersion.questionType.key,
      marks: Number(question.maxMarks),
      negativeMarks: Number(
        question.paperQuestion?.negativeMarks ?? question.questionVersion.defaultNegativeMarks
      ),
      content: question.questionVersion.answerSchema
    }));
    const scores = scoreAttempt(scorable, answerMap(attempt));
    const passed = scores.percentage >= config.passingPercentage;
    const durationSeconds = attempt.startedAt
      ? Math.max(0, Math.round((submittedAt.getTime() - attempt.startedAt.getTime()) / 1000))
      : 0;
    const late = timeIsOver(attempt);
    const status =
      scores.pendingReviewCount > 0 ? AttemptStatus.NEEDS_REVIEW : AttemptStatus.PUBLISHED;
    const scoreByQuestion = new Map(scores.perQuestion.map((score) => [score.questionId, score]));
    const categoryCounts = new Map<string, { correct: number; incorrect: number }>();
    for (const question of scorable) {
      const result = scoreByQuestion.get(question.id);
      const key = question.categoryId ?? 'uncategorised';
      const counts = categoryCounts.get(key) ?? { correct: 0, incorrect: 0 };
      if (result?.fullMarks) counts.correct += 1;
      else if (result?.attempted) counts.incorrect += 1;
      categoryCounts.set(key, counts);
    }
    const resultSummary = {
      accuracy: scores.accuracy,
      detectionRate: scores.detectionRate,
      pendingReview: scores.pendingReviewCount > 0,
      pendingReviewCount: scores.pendingReviewCount,
      late,
      timeTakenSec: durationSeconds,
      perQuestion: scores.perQuestion as unknown as Prisma.InputJsonArray,
      perCategory: scores.perCategory
    } as unknown as Prisma.InputJsonObject;
    await prisma.$transaction(async (transaction) => {
      for (const question of attempt.questions) {
        const result = scoreByQuestion.get(question.questionVersion.questionId);
        if (!result) continue;
        await transaction.attemptQuestion.update({
          where: { id: question.id },
          data: {
            status: result.pendingReview ? EvaluationStatus.NEEDS_REVIEW : EvaluationStatus.SCORED,
            score: result.obtained,
            penalty: result.obtained < 0 ? Math.abs(result.obtained) : 0,
            rowVersion: { increment: 1 },
            ...(result.pendingReview
              ? {
                  manualReviews: {
                    create: {
                      tenantId: auth.tenantId,
                      rubric: {
                        suggestedObtained: result.suggestedObtained ?? 0,
                        source: 'one-xl-compatible-scorer'
                      }
                    }
                  }
                }
              : {})
          }
        });
        if (question.response) {
          await transaction.attemptResponse.update({
            where: { id: question.response.id },
            data: { submittedAt }
          });
        }
      }
      for (const category of scores.perCategory) {
        if (category.categoryId === 'uncategorised') continue;
        const counts = categoryCounts.get(category.categoryId) ?? {
          correct: 0,
          incorrect: 0
        };
        await transaction.attemptCategoryResult.create({
          data: {
            tenantId: auth.tenantId,
            attemptId: attempt.id,
            categoryId: category.categoryId,
            possible: category.max,
            scored: category.obtained,
            percentage: category.percentage,
            correctCount: counts.correct,
            incorrectCount: counts.incorrect
          }
        });
      }
      await transaction.assessmentAttempt.update({
        where: { id: attempt.id },
        data: {
          status,
          submittedAt,
          evaluatedAt: submittedAt,
          publishedAt: status === AttemptStatus.PUBLISHED ? submittedAt : null,
          durationSeconds,
          rawScore: scores.obtained,
          finalScore: scores.obtained,
          percentage: scores.percentage,
          passed,
          resultSummary,
          rowVersion: { increment: 1 }
        }
      });
      if (attempt.assignmentId) {
        await transaction.assessmentAssignment.update({
          where: { id: attempt.assignmentId },
          data: {
            status:
              status === AttemptStatus.NEEDS_REVIEW
                ? AssignmentStatus.SUBMITTED
                : AssignmentStatus.COMPLETED,
            completedAt: status === AttemptStatus.PUBLISHED ? submittedAt : null,
            rowVersion: { increment: 1 }
          }
        });
      }
    });
    service.sendNotification({
      to: membership.user.emailCanonical,
      subject: `Result published: ${version.assessment.title}`,
      html: `<p>You scored ${String(scores.obtained)}/${String(scores.max)} (${String(scores.percentage)}%) — ${passed ? 'passed' : 'not passed'}.</p>`,
      type: 'result_published',
      tenantId: auth.tenantId,
      membershipId: membership.id,
      title: `Result published: ${version.assessment.title}`,
      body: `You scored ${String(scores.obtained)}/${String(scores.max)} (${String(scores.percentage)}%) — ${passed ? 'passed' : 'not passed'}.`,
      link: `/app/results/${attempt.publicId}`
    });
    await service.recordAudit(
      {
        action: 'attempt.submitted',
        actorUserId: auth.userId,
        tenantId: auth.tenantId,
        entityType: 'assessment_attempt',
        entityId: attempt.publicId,
        metadata: { score: scores.obtained, percentage: scores.percentage, passed, late }
      },
      context(request)
    );
    response.json({
      success: true,
      data: {
        id: attempt.publicId,
        obtained: scores.obtained,
        max: scores.max,
        percentage: scores.percentage,
        passed,
        accuracy: scores.accuracy,
        detectionRate: scores.detectionRate,
        pendingReview: scores.pendingReviewCount > 0,
        timeTakenSec: durationSeconds,
        perQuestion: scores.perQuestion,
        perCategory: scores.perCategory,
        message: 'Test submitted successfully.'
      }
    });
  });

  router.get('/:id/review', async (request, response) => {
    const auth = principal(request);
    const membership = await activeMembership(prisma, auth);
    const attempt = await findAttempt(
      prisma,
      queryString(request.params.id),
      auth.tenantId,
      membership.id
    );
    if (
      !attempt ||
      (attempt.status !== AttemptStatus.PUBLISHED &&
        attempt.status !== AttemptStatus.NEEDS_REVIEW &&
        attempt.status !== AttemptStatus.EVALUATED)
    ) {
      throw new ApiError(404, 'The requested result was not found.');
    }
    const summary = object(attempt.resultSummary);
    const perQuestion = Array.isArray(summary.perQuestion) ? summary.perQuestion : [];
    const scoreByQuestion = new Map(
      perQuestion.flatMap((entry) => {
        const value =
          entry && typeof entry === 'object' && !Array.isArray(entry)
            ? (entry as Record<string, unknown>)
            : null;
        return value && typeof value.questionId === 'string' ? [[value.questionId, value]] : [];
      })
    );
    response.json({
      success: true,
      data: {
        id: attempt.publicId,
        testTitle: attempt.assignment?.assessmentVersion.assessment.title ?? 'Practice Test',
        mode: attempt.mode.toLowerCase(),
        result: {
          obtained: Number(attempt.finalScore ?? 0),
          max: Number(attempt.paper?.totalMarks ?? 0),
          percentage: Number(attempt.percentage ?? 0),
          passed: attempt.passed ?? false,
          accuracy: summary.accuracy ?? 0,
          detectionRate: summary.detectionRate ?? null,
          pendingReview: summary.pendingReview === true,
          timeTakenSec: attempt.durationSeconds ?? 0,
          perCategory: summary.perCategory ?? []
        },
        questions: attempt.questions.map((question) => {
          const questionId = question.questionVersion.questionId;
          const score = scoreByQuestion.get(questionId);
          return {
            id: questionId,
            title: question.questionVersion.question.title,
            type: question.questionVersion.questionType.key,
            marks: Number(question.maxMarks),
            obtained: typeof score?.obtained === 'number' ? score.obtained : 0,
            attempted: score?.attempted === true,
            fullMarks: score?.fullMarks === true,
            detection: score?.detection ?? null,
            content: question.questionVersion.answerSchema,
            explanation: question.questionVersion.explanation ?? '',
            trainingLink: '',
            yourAnswer: question.response?.answer ?? null
          };
        })
      }
    });
  });

  router.get('/:id', async (request, response) => {
    const auth = principal(request);
    const membership = await activeMembership(prisma, auth);
    const attempt = await findAttempt(
      prisma,
      queryString(request.params.id),
      auth.tenantId,
      membership.id
    );
    if (!attempt) throw new ApiError(404, 'The requested attempt was not found.');
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new ApiError(422, 'This attempt has already been submitted.');
    }
    response.json({ success: true, data: clientView(attempt) });
  });

  router.get('/', async (request, response) => {
    const auth = principal(request);
    const membership = await activeMembership(prisma, auth);
    const { limit, skip } = pageQuery(request);
    const mode =
      queryString(request.query.mode) === 'practice' ? AttemptMode.PRACTICE : AttemptMode.OFFICIAL;
    const where: Prisma.AssessmentAttemptWhereInput = {
      tenantId: auth.tenantId,
      membershipId: membership.id,
      mode,
      status: {
        in: [AttemptStatus.PUBLISHED, AttemptStatus.NEEDS_REVIEW, AttemptStatus.EVALUATED]
      }
    };
    const [rows, totalCount] = await Promise.all([
      prisma.assessmentAttempt.findMany({
        where,
        include: {
          assignment: {
            include: { assessmentVersion: { include: { assessment: true } } }
          },
          paper: true
        },
        orderBy: { submittedAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.assessmentAttempt.count({ where })
    ]);
    response.json({
      success: true,
      data: {
        rows: rows.map((attempt) => ({
          id: attempt.publicId,
          testTitle: attempt.assignment?.assessmentVersion.assessment.title ?? 'Practice Test',
          obtained: Number(attempt.finalScore ?? 0),
          max: Number(attempt.paper?.totalMarks ?? 0),
          percentage: Number(attempt.percentage ?? 0),
          passed: attempt.passed ?? false,
          pendingReview: object(attempt.resultSummary).pendingReview === true,
          submittedAt: attempt.submittedAt
        })),
        totalCount
      }
    });
  });

  return router;
}

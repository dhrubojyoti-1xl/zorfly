import { createHash } from 'node:crypto';
import { Router, type Request } from 'express';
import { z } from 'zod';
import type { Prisma } from '@zorfly/database';
import {
  ApplicationStatus,
  AssignmentSource,
  AssignmentStatus,
  AttemptMode,
  AttemptStatus,
  CandidateStatus,
  EvaluationStatus,
  type ZorflyPrismaClient
} from '@zorfly/database';
import { ApiError } from '../../platform/api-error.js';
import { validate } from '../../platform/validate.js';
import { createRequireAuth, requireRole } from '../auth/auth.middleware.js';
import type { TokenService } from '../auth/tokens.js';
import {
  answerMap,
  attemptInclude,
  clientView,
  createPaper,
  testConfiguration
} from '../assessment/attempts.router.js';
import { scoreAttempt, type ScorableQuestion } from '../assessment/scoring.js';
import { encryptPii, hashEmail } from './pii.js';
import { registerSchema, type RegisterInput } from './drive.validation.js';

const answerSchema = z.object({
  questionId: z.uuid(),
  answer: z.unknown().refine((value) => value !== undefined, 'Answer is required.')
});

interface DriveWithStage {
  id: string;
  tenantId: string;
  title: string;
  status: string;
  opensAt: Date | null;
  closesAt: Date | null;
  settings: Prisma.JsonValue;
  stages: Array<{
    assessmentVersionId: string;
    assessmentVersion: {
      id: string;
      configuration: Prisma.JsonValue | null;
      assessment: { title: string };
    };
  }>;
}

function driveIsOpen(drive: Pick<DriveWithStage, 'status' | 'opensAt' | 'closesAt'>): boolean {
  const now = new Date();
  if (drive.status !== 'OPEN') return false;
  if (drive.opensAt && now < drive.opensAt) return false;
  if (drive.closesAt && now > drive.closesAt) return false;
  return true;
}

function settingsOf(value: Prisma.JsonValue): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

const driveWithStageInclude = {
  stages: {
    orderBy: { stageOrder: 'asc' as const },
    take: 1,
    include: { assessmentVersion: { include: { assessment: true } } }
  }
} satisfies Prisma.RecruitmentDriveInclude;

async function findDriveByToken(
  prisma: ZorflyPrismaClient,
  token: string
): Promise<DriveWithStage | null> {
  return prisma.recruitmentDrive.findFirst({
    where: { settings: { path: ['token'], equals: token }, deletedAt: null },
    include: driveWithStageInclude
  });
}

export function createPublicDriveRouter(
  prisma: ZorflyPrismaClient,
  tokens: TokenService,
  piiHashKey: string
): Router {
  const router = Router();

  router.get('/:token', async (request, response) => {
    const drive = await findDriveByToken(prisma, String(request.params.token ?? ''));
    if (!drive) throw new ApiError(404, 'This recruitment link is not valid.');
    const tenant = await prisma.tenant.findUnique({ where: { id: drive.tenantId } });
    const stage = drive.stages[0];
    const config = testConfiguration(stage?.assessmentVersion.configuration ?? null);
    const settings = settingsOf(drive.settings);
    response.json({
      success: true,
      data: {
        title: drive.title,
        description: typeof settings.description === 'string' ? settings.description : '',
        companyName: tenant?.name ?? '',
        testTitle: stage?.assessmentVersion.assessment.title ?? '',
        timeLimitMin: config.timeLimitMin,
        open: driveIsOpen(drive),
        openFrom: drive.opensAt,
        openTo: drive.closesAt
      }
    });
  });

  router.post('/:token/register', validate(registerSchema), async (request, response) => {
    const drive = await findDriveByToken(prisma, String(request.params.token ?? ''));
    if (!drive) throw new ApiError(404, 'This recruitment link is not valid.');
    if (!driveIsOpen(drive)) {
      throw new ApiError(422, 'This recruitment drive is not open at the moment.');
    }
    const stage = drive.stages[0];
    if (!stage) throw new ApiError(422, 'This assessment is not available.');
    const input = request.body as RegisterInput;
    const emailHash = hashEmail(input.email);
    const retentionUntil = new Date(Date.now() + 365 * 24 * 3600 * 1000);

    const result = await prisma.$transaction(async (transaction) => {
      let candidate = await transaction.candidateProfile.findFirst({
        where: { tenantId: drive.tenantId, emailHash }
      });
      if (!candidate) {
        candidate = await transaction.candidateProfile.create({
          data: {
            tenantId: drive.tenantId,
            emailCiphertext: encryptPii(piiHashKey, input.email),
            emailHash,
            fullNameCiphertext: encryptPii(piiHashKey, input.fullName),
            phoneCiphertext: input.contactNumber
              ? encryptPii(piiHashKey, input.contactNumber)
              : null,
            status: CandidateStatus.ACTIVE,
            retentionUntil
          }
        });
      }
      let application = await transaction.candidateApplication.findFirst({
        where: { candidateId: candidate.id, driveId: drive.id }
      });
      if (application?.completedAt) {
        throw new ApiError(422, 'You have already completed this assessment.');
      }
      if (!application) {
        application = await transaction.candidateApplication.create({
          data: {
            tenantId: drive.tenantId,
            candidateId: candidate.id,
            driveId: drive.id,
            status: ApplicationStatus.APPLIED,
            retentionUntil
          }
        });
      }
      const existingAssignment = await transaction.assessmentAssignment.findFirst({
        where: { tenantId: drive.tenantId, candidateApplicationId: application.id }
      });
      if (!existingAssignment) {
        await transaction.assessmentAssignment.create({
          data: {
            tenantId: drive.tenantId,
            assessmentVersionId: stage.assessmentVersionId,
            candidateApplicationId: application.id,
            source: AssignmentSource.RECRUITMENT,
            status: AssignmentStatus.AVAILABLE,
            availableAt: new Date(),
            dueAt: drive.closesAt,
            maxAttempts: 1
          }
        });
      }
      return application;
    });

    const candidateToken = tokens.signAccessToken({
      userId: result.id,
      tenantId: drive.tenantId,
      role: 'candidate'
    });
    response
      .status(201)
      .json({ success: true, data: { candidateToken, candidateName: input.fullName } });
  });

  return router;
}

async function findApplication(prisma: ZorflyPrismaClient, request: Request) {
  const auth = request.auth;
  if (!auth?.tenantId) throw new ApiError(401, 'Your session has expired. Please register again.');
  const application = await prisma.candidateApplication.findFirst({
    where: { id: auth.userId, tenantId: auth.tenantId }
  });
  if (!application) throw new ApiError(401, 'Your session has expired. Please register again.');
  return application;
}

export function createCandidateAttemptRouter(
  prisma: ZorflyPrismaClient,
  tokens: TokenService
): Router {
  const router = Router();
  router.use(createRequireAuth(tokens));
  router.use(requireRole('candidate'));

  router.post('/attempts/start', async (request, response) => {
    const application = await findApplication(prisma, request);
    const drive = await prisma.recruitmentDrive.findFirst({
      where: { id: application.driveId },
      include: driveWithStageInclude
    });
    if (!drive || !driveIsOpen(drive)) {
      throw new ApiError(422, 'This recruitment drive is not open at the moment.');
    }
    if (application.completedAt) {
      throw new ApiError(422, 'You have already completed this assessment.');
    }

    const existing = await prisma.assessmentAttempt.findFirst({
      where: {
        tenantId: drive.tenantId,
        candidateApplicationId: application.id,
        mode: AttemptMode.RECRUITMENT,
        status: AttemptStatus.IN_PROGRESS
      },
      include: attemptInclude
    });
    if (existing) {
      response.json({ success: true, data: { ...clientView(existing), testTitle: drive.title } });
      return;
    }

    const assignment = await prisma.assessmentAssignment.findFirst({
      where: {
        tenantId: drive.tenantId,
        candidateApplicationId: application.id,
        status: { in: [AssignmentStatus.PENDING, AssignmentStatus.AVAILABLE] }
      },
      include: {
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
      }
    });
    if (!assignment) throw new ApiError(422, 'This assessment is not available.');

    const attempt = await prisma.$transaction(async (transaction) => {
      const paperId = await createPaper(transaction, assignment);
      const paperQuestions = await transaction.assessmentPaperQuestion.findMany({
        where: { tenantId: drive.tenantId, paperId },
        orderBy: { questionOrder: 'asc' }
      });
      const now = new Date();
      const durationSeconds = assignment.assessmentVersion.durationSeconds ?? 0;
      const created = await transaction.assessmentAttempt.create({
        data: {
          tenantId: drive.tenantId,
          assignmentId: assignment.id,
          paperId,
          candidateApplicationId: application.id,
          mode: AttemptMode.RECRUITMENT,
          status: AttemptStatus.IN_PROGRESS,
          attemptNumber: assignment.attemptCount + 1,
          startedAt: now,
          expiresAt: durationSeconds > 0 ? new Date(now.getTime() + durationSeconds * 1000) : null,
          questions: {
            create: paperQuestions.map((question) => ({
              tenantId: drive.tenantId,
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
      await transaction.candidateApplication.update({
        where: { id: application.id },
        data: { status: ApplicationStatus.ASSESSING }
      });
      return created;
    });
    response
      .status(201)
      .json({ success: true, data: { ...clientView(attempt), testTitle: drive.title } });
  });

  router.patch('/attempts/:id/answers', validate(answerSchema), async (request, response) => {
    const application = await findApplication(prisma, request);
    const attempt = await prisma.assessmentAttempt.findFirst({
      where: {
        publicId: String(request.params.id ?? ''),
        candidateApplicationId: application.id,
        status: AttemptStatus.IN_PROGRESS
      },
      include: attemptInclude
    });
    if (!attempt) throw new ApiError(404, 'The requested attempt was not found.');
    const input = request.body as { questionId: string; answer: unknown };
    const attemptQuestion = attempt.questions.find(
      (question) => question.questionVersion.questionId === input.questionId
    );
    if (!attemptQuestion) throw new ApiError(422, 'This question does not belong to the attempt.');
    const savedAt = new Date();
    const answer = input.answer as Prisma.InputJsonValue;
    const answerHash = createHash('sha256').update(JSON.stringify(input.answer)).digest('hex');
    await prisma.$transaction([
      prisma.attemptResponse.upsert({
        where: { attemptQuestionId: attemptQuestion.id },
        create: {
          tenantId: attempt.tenantId,
          attemptQuestionId: attemptQuestion.id,
          answer,
          answerHash,
          clientSequence: 0,
          savedAt
        },
        update: {
          answer,
          answerHash,
          clientSequence: { increment: 1 },
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
      })
    ]);
    response.json({ success: true, data: { saved: true } });
  });

  router.post('/attempts/:id/submit', async (request, response) => {
    const application = await findApplication(prisma, request);
    const attempt = await prisma.assessmentAttempt.findFirst({
      where: {
        publicId: String(request.params.id ?? ''),
        candidateApplicationId: application.id,
        status: AttemptStatus.IN_PROGRESS
      },
      include: attemptInclude
    });
    if (!attempt) throw new ApiError(404, 'The requested attempt was not found.');
    const drive = await prisma.recruitmentDrive.findFirst({ where: { id: application.driveId } });
    const reveal = settingsOf(drive?.settings ?? null).showResultToCandidate === true;

    const version = attempt.assignment?.assessmentVersion;
    if (!version) throw new ApiError(422, 'This attempt is not linked to an assessment.');
    const submittedAt = new Date();
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
    const durationSeconds = attempt.startedAt
      ? Math.max(0, Math.round((submittedAt.getTime() - attempt.startedAt.getTime()) / 1000))
      : 0;
    const status =
      scores.pendingReviewCount > 0 ? AttemptStatus.NEEDS_REVIEW : AttemptStatus.PUBLISHED;
    const scoreByQuestion = new Map(scores.perQuestion.map((score) => [score.questionId, score]));
    const resultSummary = {
      accuracy: scores.accuracy,
      detectionRate: scores.detectionRate,
      pendingReview: scores.pendingReviewCount > 0,
      pendingReviewCount: scores.pendingReviewCount,
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
                      tenantId: attempt.tenantId,
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
          passed: false,
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
      await transaction.candidateApplication.update({
        where: { id: application.id },
        data: {
          status: ApplicationStatus.UNDER_REVIEW,
          completedAt: submittedAt,
          aggregateScore: scores.percentage,
          rowVersion: { increment: 1 }
        }
      });
    });

    response.json({
      success: true,
      data: {
        message: 'Assessment submitted successfully. Thank you for applying.',
        ...(reveal
          ? { obtained: scores.obtained, max: scores.max, percentage: scores.percentage }
          : {})
      }
    });
  });

  return router;
}

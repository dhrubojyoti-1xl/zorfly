import { randomBytes } from 'node:crypto';
import { Router, type Request } from 'express';
import { z } from 'zod';
import type { Prisma } from '@zorfly/database';
import {
  ApplicationStatus,
  AssessmentStatus,
  AttemptMode,
  AttemptStatus,
  RecordStatus,
  RecruitmentDecision,
  RecruitmentDriveStatus,
  type ZorflyPrismaClient
} from '@zorfly/database';
import { ApiError } from '../../platform/api-error.js';
import { validate } from '../../platform/validate.js';
import { createRequireAuth, createRequirePermission } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { SessionPrincipal } from '../auth/auth.types.js';
import type { TokenService } from '../auth/tokens.js';
import { decryptPii } from './pii.js';
import {
  decisionSchema,
  driveSchema,
  type DecisionInput,
  type DriveInput
} from './drive.validation.js';

const uuid = z.uuid();

function principal(request: Request): SessionPrincipal & { tenantId: string } {
  if (!request.auth?.tenantId) throw new ApiError(401, 'Authentication is required.');
  return { ...request.auth, tenantId: request.auth.tenantId };
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

function driveCode(): string {
  return `DRV_${randomBytes(6).toString('hex').toUpperCase()}`;
}

function positionCode(): string {
  return `POS_${randomBytes(6).toString('hex').toUpperCase()}`;
}

function driveToken(): string {
  return randomBytes(16).toString('hex');
}

const decisionCodes: Record<DecisionInput['status'], ApplicationStatus> = {
  shortlisted: ApplicationStatus.SHORTLISTED,
  hold: ApplicationStatus.ON_HOLD,
  rejected: ApplicationStatus.REJECTED
};
const decisionEvents: Record<DecisionInput['status'], RecruitmentDecision> = {
  shortlisted: RecruitmentDecision.SHORTLIST,
  hold: RecruitmentDecision.HOLD,
  rejected: RecruitmentDecision.REJECT
};
const codeToStatus = new Map<ApplicationStatus, string>([
  [ApplicationStatus.APPLIED, 'applied'],
  [ApplicationStatus.INVITED, 'applied'],
  [ApplicationStatus.ASSESSING, 'applied'],
  [ApplicationStatus.UNDER_REVIEW, 'completed'],
  [ApplicationStatus.SHORTLISTED, 'shortlisted'],
  [ApplicationStatus.ON_HOLD, 'hold'],
  [ApplicationStatus.REJECTED, 'rejected'],
  [ApplicationStatus.HIRED, 'shortlisted'],
  [ApplicationStatus.WITHDRAWN, 'rejected']
]);

const driveInclude = {
  position: true,
  stages: {
    orderBy: { stageOrder: 'asc' as const },
    include: { assessmentVersion: { include: { assessment: true } } }
  }
} satisfies Prisma.RecruitmentDriveInclude;

type DriveRecord = Prisma.RecruitmentDriveGetPayload<{ include: typeof driveInclude }>;

function driveTestTitle(drive: DriveRecord): string {
  return drive.stages[0]?.assessmentVersion.assessment.title ?? '';
}

function driveStatusLabel(status: RecruitmentDriveStatus): 'active' | 'closed' {
  return status === RecruitmentDriveStatus.OPEN ? 'active' : 'closed';
}

export function createDriveRouter(
  prisma: ZorflyPrismaClient,
  service: AuthService,
  tokens: TokenService,
  piiHashKey: string
): Router {
  const router = Router();
  router.use(createRequireAuth(tokens));
  router.use(createRequirePermission(service, 'drives:manage'));

  router.get('/', async (request, response) => {
    const auth = principal(request);
    const { page, limit, skip } = pageQuery(request);
    const search = queryString(request.query.search).trim();
    const status = queryString(request.query.status);
    const where = {
      tenantId: auth.tenantId,
      deletedAt: null,
      ...(search ? { title: { contains: search, mode: 'insensitive' as const } } : {}),
      ...(status === 'active' ? { status: RecruitmentDriveStatus.OPEN } : {}),
      ...(status === 'closed' ? { status: { not: RecruitmentDriveStatus.OPEN } } : {})
    };
    const [rows, totalCount] = await prisma.$transaction([
      prisma.recruitmentDrive.findMany({
        where,
        include: driveInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.recruitmentDrive.count({ where })
    ]);
    const counts = await prisma.candidateApplication.groupBy({
      by: ['driveId', 'status'],
      where: { tenantId: auth.tenantId, driveId: { in: rows.map((row) => row.id) } },
      _count: { _all: true }
    });
    const countsByDrive = new Map<string, { total: number; completed: number }>();
    for (const entry of counts) {
      const current = countsByDrive.get(entry.driveId) ?? { total: 0, completed: 0 };
      current.total += entry._count._all;
      if (
        entry.status !== ApplicationStatus.APPLIED &&
        entry.status !== ApplicationStatus.INVITED
      ) {
        current.completed += entry._count._all;
      }
      countsByDrive.set(entry.driveId, current);
    }
    response.json({
      success: true,
      data: {
        rows: rows.map((drive) => ({
          id: drive.id,
          title: drive.title,
          testTitle: driveTestTitle(drive),
          token: (drive.settings as { token?: string } | null)?.token ?? '',
          status: driveStatusLabel(drive.status),
          openFrom: drive.opensAt,
          openTo: drive.closesAt,
          candidates: countsByDrive.get(drive.id)?.total ?? 0,
          completed: countsByDrive.get(drive.id)?.completed ?? 0,
          createdAt: drive.createdAt
        })),
        totalCount,
        page,
        limit
      }
    });
  });

  router.post('/', validate(driveSchema), async (request, response) => {
    const auth = principal(request);
    const input = request.body as DriveInput;
    const test = await prisma.assessmentDefinition.findFirst({
      where: { id: input.testId, tenantId: auth.tenantId, deletedAt: null },
      include: { currentVersion: true }
    });
    if (!test?.currentVersion || test.status !== AssessmentStatus.PUBLISHED) {
      throw new ApiError(422, 'Publish the test before attaching it to a drive.');
    }
    const token = driveToken();
    const drive = await prisma.$transaction(async (transaction) => {
      const position = await transaction.jobPosition.create({
        data: {
          tenantId: auth.tenantId,
          code: positionCode(),
          title: input.title,
          status: RecordStatus.ACTIVE,
          createdById: auth.userId
        }
      });
      const created = await transaction.recruitmentDrive.create({
        data: {
          tenantId: auth.tenantId,
          positionId: position.id,
          code: driveCode(),
          title: input.title,
          status: RecruitmentDriveStatus.OPEN,
          opensAt: input.openFrom ? new Date(input.openFrom) : null,
          closesAt: input.openTo ? new Date(input.openTo) : null,
          settings: {
            token,
            description: input.description,
            showResultToCandidate: input.showResultToCandidate
          },
          createdById: auth.userId
        }
      });
      await transaction.recruitmentDriveAssessment.create({
        data: {
          tenantId: auth.tenantId,
          driveId: created.id,
          assessmentVersionId: test.currentVersion!.id,
          stageOrder: 1,
          stageName: 'Assessment',
          required: true
        }
      });
      return created;
    });
    response.status(201).json({
      success: true,
      data: { id: drive.id, token, message: 'Recruitment drive created successfully.' }
    });
  });

  router.get('/:id', async (request, response) => {
    const auth = principal(request);
    const id = uuid.parse(request.params.id);
    const drive = await prisma.recruitmentDrive.findFirst({
      where: { id, tenantId: auth.tenantId, deletedAt: null },
      include: driveInclude
    });
    if (!drive) throw new ApiError(404, 'The requested drive was not found.');
    const applications = await prisma.candidateApplication.findMany({
      where: { tenantId: auth.tenantId, driveId: drive.id },
      include: {
        candidate: true,
        attempts: {
          where: { mode: AttemptMode.RECRUITMENT },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });
    const settings = (drive.settings as Record<string, unknown> | null) ?? {};
    const shaped = applications.map((application) => {
      const attempt = application.attempts[0];
      const submittedStatuses: AttemptStatus[] = [
        AttemptStatus.SUBMITTED,
        AttemptStatus.EVALUATED,
        AttemptStatus.PUBLISHED
      ];
      const submitted = attempt && submittedStatuses.includes(attempt.status);
      return {
        id: application.id,
        fullName: decryptPii(piiHashKey, application.candidate.fullNameCiphertext),
        email: decryptPii(piiHashKey, application.candidate.emailCiphertext),
        contactNumber: application.candidate.phoneCiphertext
          ? decryptPii(piiHashKey, application.candidate.phoneCiphertext)
          : '',
        status: codeToStatus.get(application.status) ?? 'applied',
        notes: '',
        result: submitted
          ? {
              obtained: attempt ? Number(attempt.finalScore ?? 0) : 0,
              max: 0,
              percentage: attempt ? Number(attempt.percentage ?? 0) : 0,
              accuracy: 0,
              timeTakenSec: attempt?.durationSeconds ?? 0,
              submittedAt: attempt?.submittedAt ?? null
            }
          : null
      };
    });
    const ranked = shaped
      .filter((row) => row.result !== null)
      .sort(
        (a, b) =>
          (b.result?.percentage ?? 0) - (a.result?.percentage ?? 0) ||
          (a.result?.timeTakenSec ?? Number.POSITIVE_INFINITY) -
            (b.result?.timeTakenSec ?? Number.POSITIVE_INFINITY)
      )
      .map((row, index) => ({ rank: index + 1, ...row }));
    const pending = shaped
      .filter((row) => row.result === null)
      .map((row) => ({ rank: null, ...row }));

    response.json({
      success: true,
      data: {
        id: drive.id,
        title: drive.title,
        description: typeof settings.description === 'string' ? settings.description : '',
        testTitle: driveTestTitle(drive),
        token: typeof settings.token === 'string' ? settings.token : '',
        status: driveStatusLabel(drive.status),
        openFrom: drive.opensAt,
        openTo: drive.closesAt,
        showResultToCandidate: settings.showResultToCandidate === true,
        candidates: [...ranked, ...pending],
        totalCount: shaped.length
      }
    });
  });

  router.patch(
    '/:id/candidates/:candidateId',
    validate(decisionSchema),
    async (request, response) => {
      const auth = principal(request);
      const id = uuid.parse(request.params.id);
      const candidateId = uuid.parse(request.params.candidateId);
      const input = request.body as DecisionInput;
      const application = await prisma.candidateApplication.findFirst({
        where: { id: candidateId, driveId: id, tenantId: auth.tenantId }
      });
      if (!application) throw new ApiError(404, 'The requested candidate was not found.');
      await prisma.$transaction([
        prisma.candidateApplication.update({
          where: { id: application.id },
          data: { status: decisionCodes[input.status], rowVersion: { increment: 1 } }
        }),
        prisma.candidateDecisionHistory.create({
          data: {
            tenantId: auth.tenantId,
            applicationId: application.id,
            decision: decisionEvents[input.status],
            reason: input.notes || null,
            decidedById: auth.userId
          }
        })
      ]);
      response.json({ success: true, data: { message: 'Candidate updated successfully.' } });
    }
  );

  router.patch('/:id/close', async (request, response) => {
    const auth = principal(request);
    const id = uuid.parse(request.params.id);
    const drive = await prisma.recruitmentDrive.findFirst({
      where: { id, tenantId: auth.tenantId, deletedAt: null }
    });
    if (!drive) throw new ApiError(404, 'The requested drive was not found.');
    await prisma.recruitmentDrive.update({
      where: { id: drive.id },
      data: { status: RecruitmentDriveStatus.CLOSED, rowVersion: { increment: 1 } }
    });
    response.json({ success: true, data: { message: 'Drive closed successfully.' } });
  });

  return router;
}

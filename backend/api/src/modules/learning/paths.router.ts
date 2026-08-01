import { createHash, randomUUID } from 'node:crypto';
import { Router, type Request } from 'express';
import { z } from 'zod';
import {
  AttemptMode,
  AttemptStatus,
  MembershipStatus,
  ProgressStatus,
  RecordStatus,
  VersionStatus,
  Prisma,
  type ZorflyPrismaClient
} from '@zorfly/database';
import { ApiError } from '../../platform/api-error.js';
import { validate } from '../../platform/validate.js';
import { createRequireAuth, createRequirePermission } from '../auth/auth.middleware.js';
import { resolveAssignmentTarget, type AssignmentTargetType } from '../assessment/tests.router.js';
import type { AuthService } from '../auth/auth.service.js';
import type { RequestContext } from '../auth/auth.types.js';
import type { TokenService } from '../auth/tokens.js';
import { principal, queryString, pageQuery } from './learning.router.js';
import {
  pathAssignSchema,
  pathSchema,
  type PathAssignInput,
  type PathInput,
  type PathStepInput
} from './paths.validation.js';

const uuid = z.uuid();

const PASSING_ATTEMPT_STATUSES = [
  AttemptStatus.SUBMITTED,
  AttemptStatus.EVALUATED,
  AttemptStatus.NEEDS_REVIEW,
  AttemptStatus.PUBLISHED
];

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

async function activeMembership(prisma: ZorflyPrismaClient, tenantId: string, userId: string) {
  const membership = await prisma.tenantMembership.findFirst({
    where: { tenantId, userId, status: MembershipStatus.ACTIVE, deletedAt: null },
    include: { user: true }
  });
  if (!membership) throw new ApiError(403, 'You are not an active member of this company.');
  return membership;
}

function pathCode(): string {
  return `LP_${randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase()}`;
}

interface ResolvedStep {
  itemType: 'material' | 'test' | 'practice';
  title: string;
  materialVersionId: string | null;
  assessmentVersionId: string | null;
  completionRule: Prisma.InputJsonValue | typeof Prisma.DbNull;
}

async function resolveStep(
  prisma: ZorflyPrismaClient,
  tenantId: string,
  step: PathStepInput
): Promise<ResolvedStep> {
  if (step.kind === 'material') {
    const material = await prisma.learningMaterial.findFirst({
      where: { id: step.materialId, tenantId, status: RecordStatus.ACTIVE, deletedAt: null },
      select: { currentVersionId: true }
    });
    if (!material?.currentVersionId) {
      throw new ApiError(422, 'Invalid value.', { materialId: 'Invalid value.' });
    }
    return {
      itemType: 'material',
      title: step.title,
      materialVersionId: material.currentVersionId,
      assessmentVersionId: null,
      completionRule: Prisma.DbNull
    };
  }
  if (step.kind === 'test') {
    const test = await prisma.assessmentDefinition.findFirst({
      where: { id: step.testId, tenantId, deletedAt: null },
      select: { currentVersionId: true }
    });
    if (!test?.currentVersionId) {
      throw new ApiError(422, 'Invalid value.', { testId: 'Invalid value.' });
    }
    return {
      itemType: 'test',
      title: step.title,
      materialVersionId: null,
      assessmentVersionId: test.currentVersionId,
      completionRule: Prisma.DbNull
    };
  }
  if (step.practice.categoryId) {
    const category = await prisma.assessmentCategory.findFirst({
      where: {
        id: step.practice.categoryId,
        tenantId,
        status: RecordStatus.ACTIVE,
        deletedAt: null
      }
    });
    if (!category) throw new ApiError(422, 'Invalid value.', { categoryId: 'Invalid value.' });
  }
  return {
    itemType: 'practice',
    title: step.title,
    materialVersionId: null,
    assessmentVersionId: null,
    completionRule: {
      categoryId: step.practice.categoryId ?? null,
      difficulty: step.practice.difficulty ?? null,
      count: step.practice.count
    }
  };
}

async function createPath(
  prisma: ZorflyPrismaClient,
  tenantId: string,
  userId: string,
  input: PathInput
) {
  const resolvedSteps = await Promise.all(
    input.steps.map((step) => resolveStep(prisma, tenantId, step))
  );
  return prisma.$transaction(async (transaction) => {
    const path = await transaction.learningPath.create({
      data: {
        tenantId,
        code: pathCode(),
        title: input.title,
        description: input.description,
        status: RecordStatus.ACTIVE,
        createdById: userId
      }
    });
    const contentHash = createHash('sha256')
      .update(JSON.stringify({ pathId: path.id, version: 1, steps: resolvedSteps }))
      .digest('hex');
    const version = await transaction.learningPathVersion.create({
      data: {
        tenantId,
        learningPathId: path.id,
        versionNumber: 1,
        status: VersionStatus.PUBLISHED,
        title: input.title,
        completionRule: {},
        contentHash,
        publishedAt: new Date(),
        createdById: userId
      }
    });
    await transaction.learningPathItem.createMany({
      data: resolvedSteps.map((step, index) => ({
        tenantId,
        learningPathVersionId: version.id,
        materialVersionId: step.materialVersionId,
        assessmentVersionId: step.assessmentVersionId,
        itemType: step.itemType,
        title: step.title,
        sortOrder: index,
        completionRule: step.completionRule
      }))
    });
    await transaction.learningPath.update({
      where: { id: path.id },
      data: { currentVersionId: version.id }
    });
    return path;
  });
}

const pathListInclude = {
  currentVersion: { include: { items: true } }
} satisfies Prisma.LearningPathInclude;

type PathListRecord = Prisma.LearningPathGetPayload<{ include: typeof pathListInclude }>;

function pathSummary(path: PathListRecord) {
  return {
    id: path.id,
    title: path.title,
    description: path.description ?? '',
    stepCount: path.currentVersion?.items.length ?? 0,
    createdAt: path.createdAt
  };
}

const assignmentInclude = {
  learningPathVersion: {
    include: {
      learningPath: true,
      items: {
        orderBy: { sortOrder: 'asc' },
        include: {
          materialVersion: { select: { materialId: true } },
          assessmentVersion: { select: { assessmentId: true } }
        }
      }
    }
  }
} satisfies Prisma.LearningPathAssignmentInclude;

type AssignmentRecord = Prisma.LearningPathAssignmentGetPayload<{
  include: typeof assignmentInclude;
}>;
type PathItemRecord = AssignmentRecord['learningPathVersion']['items'][number];

async function isStepComplete(
  prisma: ZorflyPrismaClient,
  tenantId: string,
  membershipId: string,
  item: PathItemRecord,
  materialCompletions: Set<string>
): Promise<boolean> {
  if (materialCompletions.has(item.id)) return true;
  if (item.itemType === 'test' && item.assessmentVersion) {
    const passed = await prisma.assessmentAttempt.findFirst({
      where: {
        tenantId,
        membershipId,
        mode: AttemptMode.OFFICIAL,
        status: { in: PASSING_ATTEMPT_STATUSES },
        passed: true,
        assignment: { assessmentVersion: { assessmentId: item.assessmentVersion.assessmentId } }
      },
      select: { id: true }
    });
    return Boolean(passed);
  }
  if (item.itemType === 'practice') {
    const practiced = await prisma.assessmentAttempt.findFirst({
      where: {
        tenantId,
        membershipId,
        mode: AttemptMode.PRACTICE,
        status: { in: PASSING_ATTEMPT_STATUSES }
      },
      select: { id: true }
    });
    return Boolean(practiced);
  }
  return false;
}

export function createPathsRouter(
  prisma: ZorflyPrismaClient,
  service: AuthService,
  tokens: TokenService
): Router {
  const router = Router();
  router.use(createRequireAuth(tokens));
  router.use(createRequirePermission(service, 'learning:read'));

  router.get('/mine', async (request, response) => {
    const auth = principal(request);
    const membership = await activeMembership(prisma, auth.tenantId, auth.userId);
    const assignments = await prisma.learningPathAssignment.findMany({
      where: {
        tenantId: auth.tenantId,
        membershipId: membership.id,
        learningPathVersion: { learningPath: { status: RecordStatus.ACTIVE, deletedAt: null } }
      },
      include: assignmentInclude,
      orderBy: { assignedAt: 'desc' }
    });
    const progressRows = await prisma.learningProgress.findMany({
      where: {
        tenantId: auth.tenantId,
        learningPathAssignmentId: { in: assignments.map((assignment) => assignment.id) }
      },
      include: {
        items: { where: { status: ProgressStatus.COMPLETED }, select: { pathItemId: true } }
      }
    });
    const completionsByAssignment = new Map(
      progressRows.map((progress) => [
        progress.learningPathAssignmentId,
        new Set(progress.items.map((item) => item.pathItemId))
      ])
    );

    const seen = new Set<string>();
    const rows: unknown[] = [];
    for (const assignment of assignments) {
      const path = assignment.learningPathVersion.learningPath;
      if (seen.has(path.id)) continue;
      seen.add(path.id);
      const items = assignment.learningPathVersion.items;
      const materialCompletions = completionsByAssignment.get(assignment.id) ?? new Set<string>();
      const statuses = await Promise.all(
        items.map((item) =>
          isStepComplete(prisma, auth.tenantId, membership.id, item, materialCompletions)
        )
      );
      rows.push({
        id: path.id,
        title: path.title,
        description: path.description ?? '',
        steps: items.map((item, index) => ({
          index,
          kind: item.itemType,
          title: item.title,
          materialId: item.materialVersion?.materialId ?? null,
          testId: item.assessmentVersion?.assessmentId ?? null,
          practice: item.itemType === 'practice' ? item.completionRule : null,
          completed: statuses[index]
        })),
        completedCount: statuses.filter(Boolean).length,
        totalSteps: items.length
      });
    }
    response.json({ success: true, data: { rows, totalCount: rows.length } });
  });

  router.post('/:id/steps/:index/complete', async (request, response) => {
    const auth = principal(request);
    const membership = await activeMembership(prisma, auth.tenantId, auth.userId);
    const id = uuid.parse(request.params.id);
    const index = Number.parseInt(request.params.index ?? '', 10);
    if (!Number.isInteger(index) || index < 0) {
      throw new ApiError(404, 'The requested step was not found.');
    }
    const assignment = await prisma.learningPathAssignment.findFirst({
      where: {
        tenantId: auth.tenantId,
        membershipId: membership.id,
        learningPathVersion: { learningPath: { id, status: RecordStatus.ACTIVE, deletedAt: null } }
      },
      include: {
        learningPathVersion: {
          include: {
            items: {
              orderBy: { sortOrder: 'asc' },
              include: {
                materialVersion: { select: { materialId: true } },
                assessmentVersion: { select: { assessmentId: true } }
              }
            }
          }
        }
      }
    });
    if (!assignment) throw new ApiError(404, 'The requested learning path was not found.');
    const step = assignment.learningPathVersion.items[index];
    if (!step) throw new ApiError(404, 'The requested step was not found.');
    if (step.itemType !== 'material') {
      throw new ApiError(422, 'Test and practice steps complete automatically.');
    }

    const progress = await prisma.$transaction(async (transaction) => {
      const progressRecord = await transaction.learningProgress.upsert({
        where: { learningPathAssignmentId: assignment.id },
        create: {
          tenantId: auth.tenantId,
          learningPathAssignmentId: assignment.id,
          membershipId: membership.id,
          status: ProgressStatus.IN_PROGRESS,
          startedAt: new Date(),
          lastActivityAt: new Date()
        },
        update: { lastActivityAt: new Date() }
      });
      await transaction.learningItemProgress.upsert({
        where: {
          learningProgressId_pathItemId: {
            learningProgressId: progressRecord.id,
            pathItemId: step.id
          }
        },
        create: {
          tenantId: auth.tenantId,
          learningProgressId: progressRecord.id,
          pathItemId: step.id,
          status: ProgressStatus.COMPLETED,
          progressPercent: 100,
          startedAt: new Date(),
          completedAt: new Date()
        },
        update: { status: ProgressStatus.COMPLETED, progressPercent: 100, completedAt: new Date() }
      });
      return progressRecord;
    });

    const persisted = await prisma.learningItemProgress.findMany({
      where: { learningProgressId: progress.id, status: ProgressStatus.COMPLETED },
      select: { pathItemId: true }
    });
    const materialCompletions = new Set(persisted.map((row) => row.pathItemId));
    const items = assignment.learningPathVersion.items;
    const statuses = await Promise.all(
      items.map((item) =>
        isStepComplete(prisma, auth.tenantId, membership.id, item, materialCompletions)
      )
    );
    const completionPercent =
      items.length === 0 ? 0 : (statuses.filter(Boolean).length / items.length) * 100;
    await prisma.learningProgress.update({
      where: { id: progress.id },
      data: {
        completionPercent,
        status: completionPercent >= 100 ? ProgressStatus.COMPLETED : ProgressStatus.IN_PROGRESS,
        completedAt: completionPercent >= 100 ? new Date() : null
      }
    });

    response.json({ success: true, data: { message: 'Step marked as complete.' } });
  });

  router.get('/', createRequirePermission(service, 'paths:manage'), async (request, response) => {
    const auth = principal(request);
    const { page, limit, skip } = pageQuery(request);
    const search = queryString(request.query.search).trim();
    const where = {
      tenantId: auth.tenantId,
      status: RecordStatus.ACTIVE,
      deletedAt: null,
      ...(search ? { title: { contains: search, mode: 'insensitive' as const } } : {})
    };
    const [rows, totalCount] = await prisma.$transaction([
      prisma.learningPath.findMany({
        where,
        include: pathListInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.learningPath.count({ where })
    ]);
    response.json({
      success: true,
      data: { rows: rows.map(pathSummary), totalCount, page, limit }
    });
  });

  router.post(
    '/',
    createRequirePermission(service, 'paths:manage'),
    validate(pathSchema),
    async (request, response) => {
      const auth = principal(request);
      const input = request.body as PathInput;
      const path = await createPath(prisma, auth.tenantId, auth.userId, input);
      response.status(201).json({
        success: true,
        data: { id: path.id, message: 'Learning path created successfully.' }
      });
    }
  );

  router.post(
    '/:id/assign',
    createRequirePermission(service, 'paths:manage'),
    validate(pathAssignSchema),
    async (request, response) => {
      const auth = principal(request);
      const id = uuid.parse(request.params.id);
      const input = request.body as PathAssignInput;
      const path = await prisma.learningPath.findFirst({
        where: { id, tenantId: auth.tenantId, status: RecordStatus.ACTIVE, deletedAt: null },
        include: { currentVersion: { include: { items: true } } }
      });
      if (!path?.currentVersion)
        throw new ApiError(404, 'The requested learning path was not found.');
      if (input.targetType !== 'company' && !input.targetId) {
        throw new ApiError(422, 'Select who to assign the path to.');
      }
      const versionId = path.currentVersion.id;
      const stepCount = path.currentVersion.items.length;
      const targetType: AssignmentTargetType = input.targetType;
      const target = await prisma.$transaction(async (transaction) => {
        const resolved = await resolveAssignmentTarget(
          transaction,
          auth.tenantId,
          targetType,
          input.targetId ?? null
        );
        if (resolved.audience.length > 0) {
          await transaction.learningPathAssignment.createMany({
            data: resolved.audience.map((membership) => ({
              tenantId: auth.tenantId,
              learningPathVersionId: versionId,
              membershipId: membership.id,
              source: 'MANUAL',
              sourceRef: input.targetType,
              createdById: auth.userId
            })),
            skipDuplicates: true
          });
        }
        return resolved;
      });
      for (const membership of target.audience) {
        service.sendNotification({
          to: membership.user.emailCanonical,
          subject: `New learning path assigned: ${path.title}`,
          html: `<p>Hello ${membership.user.displayName ?? 'there'}, the learning path <strong>${path.title}</strong> (${String(stepCount)} steps) has been assigned to you. Open the Learning page to begin.</p>`,
          type: 'learning_path_assigned',
          tenantId: auth.tenantId
        });
      }
      await service.recordAudit(
        {
          action: 'learning_path.assigned',
          actorUserId: auth.userId,
          tenantId: auth.tenantId,
          entityType: 'learning_path',
          entityId: id,
          metadata: { targetType: input.targetType, employeeCount: target.audience.length }
        },
        context(request)
      );
      response.status(201).json({
        success: true,
        data: {
          message: `Learning path assigned successfully. ${String(target.audience.length)} employee${target.audience.length === 1 ? '' : 's'} notified.`
        }
      });
    }
  );

  router.delete(
    '/:id',
    createRequirePermission(service, 'paths:manage'),
    async (request, response) => {
      const auth = principal(request);
      const id = uuid.parse(request.params.id);
      const path = await prisma.learningPath.findFirst({
        where: { id, tenantId: auth.tenantId, status: RecordStatus.ACTIVE, deletedAt: null }
      });
      if (!path) throw new ApiError(404, 'The requested learning path was not found.');
      await prisma.learningPath.update({
        where: { id: path.id },
        data: { status: RecordStatus.ARCHIVED, updatedById: auth.userId }
      });
      response.json({ success: true, data: { message: 'Learning path deleted successfully.' } });
    }
  );

  return router;
}

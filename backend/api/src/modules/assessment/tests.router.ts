import { createHash, randomUUID } from 'node:crypto';
import { Router, type Request } from 'express';
import { z } from 'zod';
import {
  AssessmentStatus,
  AssignmentStatus,
  RecordStatus,
  SubscriptionStatus,
  VersionStatus,
  type Prisma,
  type ZorflyPrismaClient
} from '@zorfly/database';
import { roles } from '../../domain/access-control.js';
import { ApiError } from '../../platform/api-error.js';
import { validate } from '../../platform/validate.js';
import { createRequireAuth, createRequirePermission } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { RequestContext, SessionPrincipal } from '../auth/auth.types.js';
import type { TokenService } from '../auth/tokens.js';
import type { difficultyKeys } from './question.validation.js';
import { testSchema, type TestInput } from './test.validation.js';

const uuid = z.uuid();
const difficultyCodes: Record<(typeof difficultyKeys)[number], string> = {
  fresher: 'FRESHER',
  junior: 'JUNIOR',
  mid_level: 'MID_LEVEL',
  senior: 'SENIOR',
  team_lead: 'TEAM_LEAD',
  manager: 'MANAGER',
  hod: 'HEAD_OF_DEPARTMENT',
  cxo: 'CEO_CXO'
};
const codeToDifficulty = new Map(
  Object.entries(difficultyCodes).map(([key, value]) => [value, key])
);

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

function queryString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function pageQuery(request: Request) {
  const page = Math.max(1, Number.parseInt(queryString(request.query.page), 10) || 1);
  const requested = Number.parseInt(queryString(request.query.limit), 10) || 10;
  const limit = [10, 20, 50, 100].includes(requested) ? requested : 10;
  return { page, limit, skip: (page - 1) * limit };
}

function assessmentCode(): string {
  return `T_${randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase()}`;
}

function statusKey(status: AssessmentStatus): string {
  return status.toLowerCase();
}

function configuration(input: TestInput): Prisma.InputJsonObject {
  return {
    compatibility: 'one-xl',
    mode: input.mode,
    passingPercentage: input.settings.passingPercentage,
    timeLimitMin: input.settings.timeLimitMin,
    timeLimitPerQuestionSec: input.settings.timeLimitPerQuestionSec,
    attemptsAllowed: input.settings.attemptsAllowed,
    negativeMarking: input.settings.negativeMarking,
    shuffleQuestions: input.settings.shuffleQuestions,
    shuffleOptions: input.settings.shuffleOptions,
    ...(input.randomConfig
      ? {
          randomConfig: {
            count: input.randomConfig.count,
            categoryId: input.randomConfig.categoryId ?? null,
            difficulty: input.randomConfig.difficulty ?? null
          }
        }
      : {})
  };
}

function parseConfiguration(value: Prisma.JsonValue | null) {
  const object =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const random =
    object.randomConfig &&
    typeof object.randomConfig === 'object' &&
    !Array.isArray(object.randomConfig)
      ? (object.randomConfig as Record<string, unknown>)
      : null;
  return {
    mode: object.mode === 'random' ? 'random' : 'fixed',
    passingPercentage: typeof object.passingPercentage === 'number' ? object.passingPercentage : 50,
    timeLimitMin: typeof object.timeLimitMin === 'number' ? object.timeLimitMin : 0,
    timeLimitPerQuestionSec:
      typeof object.timeLimitPerQuestionSec === 'number' ? object.timeLimitPerQuestionSec : 0,
    attemptsAllowed: typeof object.attemptsAllowed === 'number' ? object.attemptsAllowed : 1,
    negativeMarking: object.negativeMarking === true,
    shuffleQuestions: object.shuffleQuestions === true,
    shuffleOptions: object.shuffleOptions === true,
    randomConfig: random
      ? {
          count: typeof random.count === 'number' ? random.count : 0,
          categoryId: typeof random.categoryId === 'string' ? random.categoryId : null,
          difficulty: typeof random.difficulty === 'string' ? random.difficulty : null
        }
      : null
  } as const;
}

function antiCheat(value: Prisma.JsonValue | null) {
  const object =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    fullScreen: object.fullScreen === true,
    tabSwitchDetection: object.tabSwitchDetection === true,
    tabSwitchLimit: typeof object.tabSwitchLimit === 'number' ? object.tabSwitchLimit : 3,
    disableCopyPaste: object.disableCopyPaste === true,
    webcamCapture: object.webcamCapture === true
  };
}

async function resolveTaxonomy(prisma: ZorflyPrismaClient, tenantId: string, input: TestInput) {
  const storedCategoryId = input.subCategoryId ?? input.categoryId ?? null;
  const [category, difficulty] = await Promise.all([
    storedCategoryId
      ? prisma.assessmentCategory.findFirst({
          where: {
            id: storedCategoryId,
            tenantId,
            status: RecordStatus.ACTIVE,
            deletedAt: null,
            ...(input.subCategoryId && input.categoryId ? { parentId: input.categoryId } : {})
          }
        })
      : null,
    input.difficulty
      ? prisma.difficultyLevel.findFirst({
          where: {
            tenantId,
            code: difficultyCodes[input.difficulty],
            status: RecordStatus.ACTIVE,
            deletedAt: null
          }
        })
      : null
  ]);
  if (storedCategoryId && !category) {
    throw new ApiError(422, 'Invalid value.', {
      [input.subCategoryId ? 'subCategoryId' : 'categoryId']: 'Invalid value.'
    });
  }
  if (input.difficulty && !difficulty) {
    throw new ApiError(422, 'Invalid value.', { difficulty: 'Invalid value.' });
  }
  if (input.randomConfig?.categoryId) {
    const randomCategory = await prisma.assessmentCategory.findFirst({
      where: {
        id: input.randomConfig.categoryId,
        tenantId,
        status: RecordStatus.ACTIVE,
        deletedAt: null
      }
    });
    if (!randomCategory) {
      throw new ApiError(422, 'Invalid value.', {
        'randomConfig.categoryId': 'Invalid value.'
      });
    }
  }
  return {
    categoryId: category?.id ?? null,
    difficultyLevelId: difficulty?.id ?? null
  };
}

async function resolveQuestions(
  prisma: ZorflyPrismaClient,
  tenantId: string,
  questionIds: readonly string[]
) {
  if (questionIds.length === 0) return [];
  const rows = await prisma.question.findMany({
    where: {
      tenantId,
      id: { in: [...new Set(questionIds)] },
      status: { not: 'ARCHIVED' },
      deletedAt: null,
      currentVersionId: { not: null }
    },
    include: { currentVersion: true }
  });
  if (
    rows.length !== new Set(questionIds).size ||
    rows.some((question) => !question.currentVersion)
  ) {
    throw new ApiError(422, 'Some selected questions no longer exist. Review the question list.');
  }
  const byId = new Map(rows.map((question) => [question.id, question]));
  return questionIds.map((id) => {
    const question = byId.get(id);
    if (!question?.currentVersion) {
      throw new ApiError(422, 'Some selected questions no longer exist. Review the question list.');
    }
    return { ...question, currentVersion: question.currentVersion };
  });
}

async function enforceTestLimit(prisma: ZorflyPrismaClient, tenantId: string): Promise<void> {
  const subscription = await prisma.tenantSubscription.findFirst({
    where: {
      tenantId,
      status: { in: [SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE] }
    },
    include: { plan: { include: { entitlements: true } } },
    orderBy: { createdAt: 'desc' }
  });
  const entitlement = subscription?.plan.entitlements.find((candidate) =>
    ['tests', 'tests.max', 'max_tests'].includes(candidate.featureKey)
  );
  if (!entitlement?.enabled || entitlement.limitValue === null) return;
  const count = await prisma.assessmentDefinition.count({
    where: { tenantId, deletedAt: null }
  });
  if (BigInt(count) >= entitlement.limitValue) {
    throw new ApiError(
      422,
      `Your ${subscription?.plan.name ?? 'current'} plan test limit has been reached. Upgrade your plan to create more tests.`
    );
  }
}

async function writeDraftContent(
  transaction: Prisma.TransactionClient,
  tenantId: string,
  versionId: string,
  input: TestInput,
  questions: Awaited<ReturnType<typeof resolveQuestions>>
): Promise<void> {
  await transaction.assessmentQuestion.deleteMany({
    where: { assessmentVersionId: versionId }
  });
  await transaction.questionPoolRule.deleteMany({
    where: { assessmentVersionId: versionId }
  });
  if (input.mode === 'fixed') {
    await transaction.assessmentQuestion.createMany({
      data: questions.map((question, index) => ({
        tenantId,
        assessmentVersionId: versionId,
        questionVersionId: question.currentVersionId ?? '',
        sortOrder: index,
        marksOverride: question.currentVersion.defaultMarks,
        negativeMarksOverride: question.currentVersion.defaultNegativeMarks
      }))
    });
  } else if (input.randomConfig) {
    await transaction.questionPoolRule.create({
      data: {
        tenantId,
        assessmentVersionId: versionId,
        name: 'OneXL random paper',
        selectionCount: input.randomConfig.count,
        filter: {
          categoryId: input.randomConfig.categoryId ?? null,
          difficulty: input.randomConfig.difficulty ?? null
        },
        seedStrategy: 'PER_ASSIGNMENT'
      }
    });
  }
}

const assessmentInclude = {
  category: { include: { parent: true } },
  difficultyLevel: true,
  currentVersion: {
    include: {
      questions: {
        orderBy: { sortOrder: 'asc' },
        include: {
          questionVersion: {
            include: {
              question: { include: { difficultyLevel: true } },
              questionType: true
            }
          }
        }
      },
      poolRules: true,
      assignments: true
    }
  },
  schedules: true
} satisfies Prisma.AssessmentDefinitionInclude;

type AssessmentRecord = Prisma.AssessmentDefinitionGetPayload<{
  include: typeof assessmentInclude;
}>;

function categoryCompatibility(record: AssessmentRecord) {
  if (!record.category) return { categoryId: null, subCategoryId: null };
  return record.category.parent
    ? {
        categoryId: {
          _id: record.category.parent.id,
          id: record.category.parent.id,
          name: record.category.parent.name
        },
        subCategoryId: {
          _id: record.category.id,
          id: record.category.id,
          name: record.category.name
        }
      }
    : {
        categoryId: {
          _id: record.category.id,
          id: record.category.id,
          name: record.category.name
        },
        subCategoryId: null
      };
}

function assignmentCounts(record: AssessmentRecord) {
  const assignments = record.currentVersion?.assignments ?? [];
  const activeStatuses: AssignmentStatus[] = [
    AssignmentStatus.PENDING,
    AssignmentStatus.AVAILABLE,
    AssignmentStatus.IN_PROGRESS
  ];
  return {
    total: assignments.length,
    active: assignments.filter((assignment) => activeStatuses.includes(assignment.status)).length
  };
}

function lifecycle(record: AssessmentRecord) {
  const counts = assignmentCounts(record);
  if (record.status !== AssessmentStatus.PUBLISHED) {
    return { status: statusKey(record.status), scheduleText: '' };
  }
  const schedules = record.schedules.filter(
    (schedule) => schedule.status === RecordStatus.ACTIVE && !schedule.deletedAt
  );
  if (schedules.length > 0) return { status: 'scheduled', scheduleText: 'Recurring schedule' };
  if (counts.active > 0) return { status: 'active', scheduleText: 'Assigned' };
  return { status: 'published', scheduleText: '' };
}

function questionCompatibility(
  link: NonNullable<AssessmentRecord['currentVersion']>['questions'][number]
) {
  const version = link.questionVersion;
  return {
    _id: version.question.id,
    id: version.question.id,
    title: version.prompt,
    type: version.questionType.key,
    difficulty:
      codeToDifficulty.get(version.question.difficultyLevel.code) ??
      version.question.difficultyLevel.code.toLowerCase(),
    marks: Number(link.marksOverride ?? version.defaultMarks),
    negativeMarks: Number(link.negativeMarksOverride ?? version.defaultNegativeMarks)
  };
}

function detail(record: AssessmentRecord) {
  const version = record.currentVersion;
  if (!version) throw new ApiError(500, 'The test has no current version.');
  const config = parseConfiguration(version.configuration);
  const categories = categoryCompatibility(record);
  const counts = assignmentCounts(record);
  const life = lifecycle(record);
  return {
    id: record.id,
    _id: record.id,
    title: record.title,
    description: record.description ?? '',
    ...categories,
    difficulty: record.difficultyLevel
      ? (codeToDifficulty.get(record.difficultyLevel.code) ??
        record.difficultyLevel.code.toLowerCase())
      : null,
    mode: config.mode,
    questionIds: version.questions.map(questionCompatibility),
    randomConfig: config.randomConfig,
    settings: {
      passingPercentage: config.passingPercentage,
      timeLimitMin: config.timeLimitMin,
      timeLimitPerQuestionSec: config.timeLimitPerQuestionSec,
      attemptsAllowed: config.attemptsAllowed,
      negativeMarking: config.negativeMarking,
      shuffleQuestions: config.shuffleQuestions,
      shuffleOptions: config.shuffleOptions,
      antiCheat: antiCheat(version.antiCheatingPolicy)
    },
    state: statusKey(record.status),
    totalMarks: Number(version.totalMarks),
    publishedAt: version.publishedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    lifecycleStatus: life.status,
    scheduleText: life.scheduleText,
    assignmentsTotal: counts.total,
    assignmentsActive: counts.active,
    assignmentsScheduled: record.schedules.filter(
      (schedule) => schedule.status === RecordStatus.ACTIVE && !schedule.deletedAt
    ).length
  };
}

function sanitizeContent(type: string, value: Prisma.JsonValue): unknown {
  const content =
    typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  if (type === 'mcq') {
    return { options: content.options ?? [], multiple: content.multiple === true };
  }
  if (type === 'true_false') return {};
  if (type === 'image_comparison') return { images: content.images ?? [] };
  if (type === 'find_mistakes') {
    if (content.mode === 'typed') return { imageUrl: content.imageUrl, mode: 'typed' };
    const mistakes: unknown[] = Array.isArray(content.mistakes)
      ? (content.mistakes as unknown[])
      : [];
    const distractors: unknown[] = Array.isArray(content.distractors)
      ? (content.distractors as unknown[])
      : [];
    return {
      imageUrl: content.imageUrl,
      mode: 'checklist',
      options: [...mistakes, ...distractors]
    };
  }
  if (type === 'hotspot' || type === 'multiple_error_detection') {
    return {
      imageUrl: content.imageUrl,
      zonesCount: Array.isArray(content.zones) ? content.zones.length : 0
    };
  }
  if (type === 'content_review') return { text: content.text };
  if (type === 'video_review') {
    return { videoUrl: content.videoUrl, toleranceSec: content.toleranceSec ?? 2 };
  }
  if (type === 'drag_drop') {
    return content.mode === 'sequence'
      ? { mode: 'sequence', items: content.items ?? [] }
      : { mode: 'match', left: content.left ?? [], right: content.right ?? [] };
  }
  throw new ApiError(500, `Unknown question type: ${type}`);
}

export function createTestRouter(
  prisma: ZorflyPrismaClient,
  service: AuthService,
  tokens: TokenService
): Router {
  const router = Router();
  router.use(createRequireAuth(tokens));
  router.use(createRequirePermission(service, 'tests:read'));

  router.get('/', async (request, response) => {
    const auth = principal(request);
    const { page, limit, skip } = pageQuery(request);
    const state = queryString(request.query.state);
    const difficulty = queryString(request.query.difficulty);
    const categoryId = queryString(request.query.categoryId);
    const where = {
      tenantId: auth.tenantId,
      deletedAt: null,
      ...(auth.role === roles.teamLeader ? { createdById: auth.userId } : {}),
      ...(state && state !== 'active'
        ? { status: state.toUpperCase() as AssessmentStatus }
        : { status: { not: AssessmentStatus.ARCHIVED } }),
      ...(difficulty
        ? {
            difficultyLevel: {
              code: difficultyCodes[difficulty as keyof typeof difficultyCodes] ?? ''
            }
          }
        : {}),
      ...(categoryId ? { category: { OR: [{ id: categoryId }, { parentId: categoryId }] } } : {}),
      ...(queryString(request.query.search)
        ? {
            title: {
              contains: queryString(request.query.search).trim(),
              mode: 'insensitive' as const
            }
          }
        : {})
    };
    const allRows = await prisma.assessmentDefinition.findMany({
      where,
      include: assessmentInclude,
      orderBy: { createdAt: 'desc' }
    });
    const filtered =
      state === 'active' ? allRows.filter((row) => lifecycle(row).status === 'active') : allRows;
    const rows = filtered.slice(skip, skip + limit);
    response.json({
      success: true,
      data: {
        rows: rows.map((row) => {
          const value = detail(row);
          return {
            id: value.id,
            title: value.title,
            category: row.category?.parent?.name ?? row.category?.name ?? '',
            subCategory: row.category?.parent ? row.category.name : '',
            difficulty: value.difficulty ?? '',
            mode: value.mode,
            state: value.state,
            lifecycleStatus: value.lifecycleStatus,
            scheduleText: value.scheduleText,
            questionCount:
              value.mode === 'fixed' ? value.questionIds.length : (value.randomConfig?.count ?? 0),
            totalMarks: value.totalMarks,
            assignmentsTotal: value.assignmentsTotal,
            assignmentsActive: value.assignmentsActive,
            assignmentsScheduled: value.assignmentsScheduled,
            createdAt: value.createdAt
          };
        }),
        totalCount: filtered.length,
        page,
        limit
      }
    });
  });

  router.get('/:id', async (request, response) => {
    const auth = principal(request);
    const id = uuid.parse(request.params.id);
    const record = await prisma.assessmentDefinition.findFirst({
      where: {
        id,
        tenantId: auth.tenantId,
        deletedAt: null,
        ...(auth.role === roles.teamLeader ? { createdById: auth.userId } : {})
      },
      include: assessmentInclude
    });
    if (!record) throw new ApiError(404, 'The requested test was not found.');
    response.json({ success: true, data: detail(record) });
  });

  router.post(
    '/',
    createRequirePermission(service, 'tests:manage'),
    validate(testSchema),
    async (request, response) => {
      const auth = principal(request);
      const input = testSchema.parse(request.body);
      await enforceTestLimit(prisma, auth.tenantId);
      const [taxonomy, questions] = await Promise.all([
        resolveTaxonomy(prisma, auth.tenantId, input),
        resolveQuestions(prisma, auth.tenantId, input.mode === 'fixed' ? input.questionIds : [])
      ]);
      const record = await prisma.$transaction(async (transaction) => {
        const assessment = await transaction.assessmentDefinition.create({
          data: {
            tenantId: auth.tenantId,
            categoryId: taxonomy.categoryId,
            difficultyLevelId: taxonomy.difficultyLevelId,
            code: assessmentCode(),
            title: input.title,
            description: input.description,
            status: AssessmentStatus.DRAFT,
            createdById: auth.userId
          }
        });
        const version = await transaction.assessmentVersion.create({
          data: {
            tenantId: auth.tenantId,
            assessmentId: assessment.id,
            versionNumber: 1,
            status: VersionStatus.DRAFT,
            title: input.title,
            description: input.description,
            totalMarks: 0,
            passingMarks: 0,
            durationSeconds:
              input.settings.timeLimitMin > 0 ? input.settings.timeLimitMin * 60 : null,
            perQuestionTimeLimit:
              input.settings.timeLimitPerQuestionSec > 0
                ? input.settings.timeLimitPerQuestionSec
                : null,
            maxAttempts: input.settings.attemptsAllowed,
            negativeMarkingEnabled: input.settings.negativeMarking,
            shuffleQuestions: input.settings.shuffleQuestions,
            shuffleOptions: input.settings.shuffleOptions,
            antiCheatingPolicy: input.settings.antiCheat,
            configuration: configuration(input),
            contentHash: createHash('sha256')
              .update(JSON.stringify({ assessmentId: assessment.id, draft: 1, input }))
              .digest('hex'),
            createdById: auth.userId
          }
        });
        await writeDraftContent(transaction, auth.tenantId, version.id, input, questions);
        await transaction.assessmentDefinition.update({
          where: { id: assessment.id },
          data: { currentVersionId: version.id }
        });
        return assessment;
      });
      await service.recordAudit(
        {
          action: 'test.created',
          actorUserId: auth.userId,
          tenantId: auth.tenantId,
          entityType: 'assessment',
          entityId: record.id
        },
        context(request)
      );
      response.status(201).json({
        success: true,
        data: { id: record.id, message: 'Test created successfully.' }
      });
    }
  );

  router.put(
    '/:id',
    createRequirePermission(service, 'tests:manage'),
    validate(testSchema),
    async (request, response) => {
      const auth = principal(request);
      const id = uuid.parse(request.params.id);
      const input = testSchema.parse(request.body);
      const record = await prisma.assessmentDefinition.findFirst({
        where: {
          id,
          tenantId: auth.tenantId,
          deletedAt: null,
          ...(auth.role === roles.teamLeader ? { createdById: auth.userId } : {})
        },
        include: { currentVersion: true }
      });
      if (!record) throw new ApiError(404, 'The requested test was not found.');
      if (record.status !== AssessmentStatus.DRAFT || !record.currentVersion) {
        throw new ApiError(422, 'Only draft tests can be edited.');
      }
      const currentVersion = record.currentVersion;
      const [taxonomy, questions] = await Promise.all([
        resolveTaxonomy(prisma, auth.tenantId, input),
        resolveQuestions(prisma, auth.tenantId, input.mode === 'fixed' ? input.questionIds : [])
      ]);
      await prisma.$transaction(async (transaction) => {
        await transaction.assessmentDefinition.update({
          where: { id },
          data: {
            categoryId: taxonomy.categoryId,
            difficultyLevelId: taxonomy.difficultyLevelId,
            title: input.title,
            description: input.description,
            updatedById: auth.userId,
            rowVersion: { increment: 1 }
          }
        });
        await transaction.assessmentVersion.update({
          where: { id: currentVersion.id },
          data: {
            title: input.title,
            description: input.description,
            durationSeconds:
              input.settings.timeLimitMin > 0 ? input.settings.timeLimitMin * 60 : null,
            perQuestionTimeLimit:
              input.settings.timeLimitPerQuestionSec > 0
                ? input.settings.timeLimitPerQuestionSec
                : null,
            maxAttempts: input.settings.attemptsAllowed,
            negativeMarkingEnabled: input.settings.negativeMarking,
            shuffleQuestions: input.settings.shuffleQuestions,
            shuffleOptions: input.settings.shuffleOptions,
            antiCheatingPolicy: input.settings.antiCheat,
            configuration: configuration(input),
            contentHash: createHash('sha256')
              .update(JSON.stringify({ assessmentId: id, draft: Date.now(), input }))
              .digest('hex')
          }
        });
        await writeDraftContent(transaction, auth.tenantId, currentVersion.id, input, questions);
      });
      response.json({
        success: true,
        data: { id, message: 'Test updated successfully.' }
      });
    }
  );

  router.get('/:id/preview', async (request, response) => {
    const auth = principal(request);
    const id = uuid.parse(request.params.id);
    const record = await prisma.assessmentDefinition.findFirst({
      where: {
        id,
        tenantId: auth.tenantId,
        deletedAt: null,
        ...(auth.role === roles.teamLeader ? { createdById: auth.userId } : {})
      },
      include: assessmentInclude
    });
    if (!record?.currentVersion) {
      throw new ApiError(404, 'The requested test was not found.');
    }
    const compatible = detail(record);
    response.json({
      success: true,
      data: {
        title: compatible.title,
        settings: compatible.settings,
        questions: record.currentVersion.questions.map((link) => {
          const version = link.questionVersion;
          return {
            id: version.question.id,
            title: version.prompt,
            type: version.questionType.key,
            marks: Number(link.marksOverride ?? version.defaultMarks),
            negativeMarks: Number(link.negativeMarksOverride ?? version.defaultNegativeMarks),
            categoryId: version.question.categoryId,
            content: sanitizeContent(version.questionType.key, version.answerSchema)
          };
        })
      }
    });
  });

  router.post(
    '/:id/publish',
    createRequirePermission(service, 'tests:manage'),
    async (request, response) => {
      const auth = principal(request);
      const id = uuid.parse(request.params.id);
      const record = await prisma.assessmentDefinition.findFirst({
        where: {
          id,
          tenantId: auth.tenantId,
          deletedAt: null,
          ...(auth.role === roles.teamLeader ? { createdById: auth.userId } : {})
        },
        include: assessmentInclude
      });
      if (!record?.currentVersion) {
        throw new ApiError(404, 'The requested test was not found.');
      }
      if (record.status !== AssessmentStatus.DRAFT) {
        throw new ApiError(422, 'Only draft tests can be published.');
      }
      const currentVersion = record.currentVersion;
      const config = parseConfiguration(currentVersion.configuration);
      let totalMarks = 0;
      if (config.mode === 'fixed') {
        if (record.currentVersion.questions.length === 0) {
          throw new ApiError(422, 'Add at least one question before publishing.');
        }
        const questionIds = record.currentVersion.questions.map(
          (link) => link.questionVersion.questionId
        );
        const latest = await resolveQuestions(prisma, auth.tenantId, questionIds);
        totalMarks = latest.reduce(
          (sum, question) => sum + Number(question.currentVersion.defaultMarks),
          0
        );
        await prisma.$transaction(async (transaction) => {
          await writeDraftContent(
            transaction,
            auth.tenantId,
            currentVersion.id,
            {
              title: record.title,
              description: record.description ?? '',
              categoryId: record.category?.parentId ?? record.categoryId,
              subCategoryId: record.category?.parentId ? record.categoryId : null,
              difficulty: record.difficultyLevel
                ? ((codeToDifficulty.get(record.difficultyLevel.code) as
                    keyof typeof difficultyCodes | undefined) ?? null)
                : null,
              mode: 'fixed',
              questionIds,
              randomConfig: null,
              settings: {
                passingPercentage: config.passingPercentage,
                timeLimitMin: config.timeLimitMin,
                timeLimitPerQuestionSec: config.timeLimitPerQuestionSec,
                attemptsAllowed: config.attemptsAllowed,
                negativeMarking: config.negativeMarking,
                shuffleQuestions: config.shuffleQuestions,
                shuffleOptions: config.shuffleOptions,
                antiCheat: antiCheat(currentVersion.antiCheatingPolicy)
              }
            },
            latest
          );
          await transaction.assessmentVersion.update({
            where: { id: currentVersion.id },
            data: {
              status: VersionStatus.PUBLISHED,
              totalMarks,
              passingMarks: (totalMarks * config.passingPercentage) / 100,
              publishedAt: new Date()
            }
          });
          await transaction.assessmentDefinition.update({
            where: { id },
            data: { status: AssessmentStatus.PUBLISHED }
          });
        });
      } else {
        const rule = record.currentVersion.poolRules[0];
        if (!rule) {
          throw new ApiError(422, 'Set how many random questions the test should draw.');
        }
        const filter =
          typeof rule.filter === 'object' && rule.filter !== null && !Array.isArray(rule.filter)
            ? (rule.filter as Record<string, unknown>)
            : {};
        const categoryId = typeof filter.categoryId === 'string' ? filter.categoryId : null;
        const difficulty = typeof filter.difficulty === 'string' ? filter.difficulty : null;
        const available = await prisma.question.count({
          where: {
            tenantId: auth.tenantId,
            status: 'PUBLISHED',
            deletedAt: null,
            ...(categoryId
              ? { category: { OR: [{ id: categoryId }, { parentId: categoryId }] } }
              : {}),
            ...(difficulty
              ? {
                  difficultyLevel: {
                    code: difficultyCodes[difficulty as keyof typeof difficultyCodes] ?? ''
                  }
                }
              : {})
          }
        });
        if (available < rule.selectionCount) {
          throw new ApiError(
            422,
            `Only ${String(available)} matching questions exist in the bank; ${String(rule.selectionCount)} are needed.`
          );
        }
        await prisma.$transaction([
          prisma.assessmentVersion.update({
            where: { id: record.currentVersion.id },
            data: { status: VersionStatus.PUBLISHED, publishedAt: new Date() }
          }),
          prisma.assessmentDefinition.update({
            where: { id },
            data: { status: AssessmentStatus.PUBLISHED }
          })
        ]);
      }
      await service.recordAudit(
        {
          action: 'test.published',
          actorUserId: auth.userId,
          tenantId: auth.tenantId,
          entityType: 'assessment',
          entityId: id
        },
        context(request)
      );
      response.json({
        success: true,
        data: { id, state: 'published', message: 'Test published successfully.' }
      });
    }
  );

  for (const [path, from, to, message] of [
    [
      '/:id/close',
      AssessmentStatus.PUBLISHED,
      AssessmentStatus.CLOSED,
      'Test closed successfully.'
    ],
    ['/:id/archive', null, AssessmentStatus.ARCHIVED, 'Test archived successfully.']
  ] as const) {
    router.post(
      path,
      createRequirePermission(service, 'tests:manage'),
      async (request, response) => {
        const auth = principal(request);
        const id = uuid.parse(request.params.id);
        const record = await prisma.assessmentDefinition.findFirst({
          where: {
            id,
            tenantId: auth.tenantId,
            deletedAt: null,
            ...(from ? { status: from } : { status: { not: AssessmentStatus.ARCHIVED } }),
            ...(auth.role === roles.teamLeader ? { createdById: auth.userId } : {})
          }
        });
        if (!record) throw new ApiError(404, 'The requested test was not found.');
        await prisma.assessmentDefinition.update({
          where: { id },
          data: {
            status: to,
            ...(to === AssessmentStatus.ARCHIVED
              ? { deletedAt: new Date(), deletedById: auth.userId }
              : {}),
            rowVersion: { increment: 1 }
          }
        });
        response.json({ success: true, data: { message } });
      }
    );
  }

  router.delete(
    '/:id',
    createRequirePermission(service, 'tests:manage'),
    async (request, response) => {
      const auth = principal(request);
      const id = uuid.parse(request.params.id);
      const record = await prisma.assessmentDefinition.findFirst({
        where: {
          id,
          tenantId: auth.tenantId,
          status: AssessmentStatus.DRAFT,
          deletedAt: null,
          ...(auth.role === roles.teamLeader ? { createdById: auth.userId } : {})
        }
      });
      if (!record) {
        throw new ApiError(
          404,
          'Only draft tests can be deleted directly — archive this test first.'
        );
      }
      await prisma.assessmentDefinition.update({
        where: { id },
        data: {
          status: AssessmentStatus.ARCHIVED,
          deletedAt: new Date(),
          deletedById: auth.userId,
          rowVersion: { increment: 1 }
        }
      });
      response.json({
        success: true,
        data: { message: 'Test deleted successfully.' }
      });
    }
  );

  return router;
}

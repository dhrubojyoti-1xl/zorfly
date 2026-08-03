import { createHash, randomUUID } from 'node:crypto';
import { Router, type Request } from 'express';
import { z } from 'zod';
import {
  QuestionStatus,
  RecordStatus,
  VersionStatus,
  type Prisma,
  type ZorflyPrismaClient
} from '@zorfly/database';
import { ApiError } from '../../platform/api-error.js';
import { parseCsv, sendCsv, toCsv } from '../../platform/csv.js';
import { validate } from '../../platform/validate.js';
import { createRequireAuth, createRequirePermission } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { RequestContext, SessionPrincipal } from '../auth/auth.types.js';
import type { TokenService } from '../auth/tokens.js';
import { difficultyKeys, questionSchema, type QuestionInput } from './question.validation.js';

const uuid = z.uuid();
const importHeaders = [
  'type',
  'title',
  'category',
  'difficulty',
  'marks',
  'negativeMarks',
  'explanation',
  'optionA',
  'optionB',
  'optionC',
  'optionD',
  'correctOptions',
  'correctAnswer'
] as const;
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
const questionTypeNames: Record<QuestionInput['type'], string> = {
  image_comparison: 'Image Comparison',
  find_mistakes: 'Find the Mistakes',
  hotspot: 'Hotspot Selection',
  content_review: 'Content Review',
  video_review: 'Video Review',
  mcq: 'Multiple Choice',
  true_false: 'True / False',
  drag_drop: 'Drag and Drop',
  multiple_error_detection: 'Multiple Error Detection'
};

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

function tagKey(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 100) || randomUUID()
  );
}

function questionCode(): string {
  return `Q_${randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase()}`;
}

function versionMetadata(version: { scoringSchema: Prisma.JsonValue }): {
  trainingLink: string;
  tags: string[];
} {
  if (
    typeof version.scoringSchema !== 'object' ||
    version.scoringSchema === null ||
    Array.isArray(version.scoringSchema)
  ) {
    return { trainingLink: '', tags: [] };
  }
  const metadata = version.scoringSchema as Record<string, unknown>;
  return {
    trainingLink: typeof metadata.trainingLink === 'string' ? metadata.trainingLink : '',
    tags: Array.isArray(metadata.tags)
      ? metadata.tags.filter((tag): tag is string => typeof tag === 'string')
      : []
  };
}

function manualReview(input: QuestionInput): boolean {
  return (
    input.type === 'content_review' ||
    input.type === 'video_review' ||
    (input.type === 'find_mistakes' &&
      typeof input.content === 'object' &&
      input.content !== null &&
      'mode' in input.content &&
      input.content.mode === 'typed')
  );
}

async function resolveReferences(
  prisma: ZorflyPrismaClient,
  tenantId: string,
  input: QuestionInput
) {
  const [category, subCategory, difficulty, questionType] = await Promise.all([
    prisma.assessmentCategory.findFirst({
      where: {
        id: input.categoryId,
        tenantId,
        status: RecordStatus.ACTIVE,
        deletedAt: null
      }
    }),
    input.subCategoryId
      ? prisma.assessmentCategory.findFirst({
          where: {
            id: input.subCategoryId,
            tenantId,
            parentId: input.categoryId,
            status: RecordStatus.ACTIVE,
            deletedAt: null
          }
        })
      : Promise.resolve(null),
    prisma.difficultyLevel.findFirst({
      where: {
        tenantId,
        code: difficultyCodes[input.difficulty],
        status: RecordStatus.ACTIVE,
        deletedAt: null
      }
    }),
    prisma.questionType.upsert({
      where: { key: input.type },
      create: {
        key: input.type,
        name: questionTypeNames[input.type],
        answerSchema: { compatibility: 'one-xl', version: 1 },
        supportsAutoScore: !manualReview(input),
        supportsMedia: [
          'image_comparison',
          'find_mistakes',
          'hotspot',
          'video_review',
          'multiple_error_detection'
        ].includes(input.type),
        status: RecordStatus.ACTIVE
      },
      update: {}
    })
  ]);
  if (!category) {
    throw new ApiError(422, 'Invalid value.', { categoryId: 'Invalid value.' });
  }
  if (input.subCategoryId && !subCategory) {
    throw new ApiError(422, 'Invalid value.', { subCategoryId: 'Invalid value.' });
  }
  if (!difficulty) {
    throw new ApiError(422, 'Difficulty is required.', {
      difficulty: 'Difficulty is required.'
    });
  }
  return {
    categoryId: subCategory?.id ?? category.id,
    difficultyLevelId: difficulty.id,
    questionTypeId: questionType.id
  };
}

function optionData(input: QuestionInput, tenantId: string) {
  if (input.type !== 'mcq') return [];
  const content = input.content as {
    options: Array<{ id: string; text: string; imageUrl?: string }>;
    correctOptionIds: string[];
  };
  return content.options.map((option, index) => ({
    tenantId,
    optionKey: option.id,
    label: option.text,
    ...(option.imageUrl ? { answerValue: { imageUrl: option.imageUrl } } : {}),
    isCorrect: content.correctOptionIds.includes(option.id),
    scoreWeight: 1,
    sortOrder: index
  }));
}

async function syncTags(
  transaction: Prisma.TransactionClient,
  tenantId: string,
  questionId: string,
  userId: string,
  names: readonly string[]
): Promise<void> {
  await transaction.questionTag.deleteMany({ where: { questionId } });
  const tagsByKey = new Map(names.map((name) => [tagKey(name), name]));
  for (const [key, name] of tagsByKey) {
    const tag = await transaction.tag.upsert({
      where: { tenantId_key: { tenantId, key } },
      create: { tenantId, key, name, createdById: userId },
      update: { name, deletedAt: null, updatedById: userId }
    });
    await transaction.questionTag.create({
      data: { tenantId, questionId, tagId: tag.id }
    });
  }
}

export async function createQuestion(
  prisma: ZorflyPrismaClient,
  tenantId: string,
  userId: string,
  input: QuestionInput,
  onCreated?: (
    transaction: Prisma.TransactionClient,
    question: { id: string },
    version: { id: string }
  ) => Promise<void>,
  /**
   * Defaults to PUBLISHED (manual authoring is unchanged). AI-generated
   * questions are created IN_REVIEW instead — an admin must call
   * POST /questions/:id/publish before they appear in the question bank
   * or can be added to a test. The question's answer schema, scoring, and
   * every other field are unaffected either way.
   */
  status: (typeof QuestionStatus)[keyof typeof QuestionStatus] = QuestionStatus.PUBLISHED
) {
  const references = await resolveReferences(prisma, tenantId, input);
  return prisma.$transaction(async (transaction) => {
    const question = await transaction.question.create({
      data: {
        tenantId,
        categoryId: references.categoryId,
        difficultyLevelId: references.difficultyLevelId,
        code: questionCode(),
        title: input.title,
        status,
        createdById: userId
      }
    });
    const contentHash = createHash('sha256')
      .update(
        JSON.stringify({
          questionId: question.id,
          version: 1,
          input
        })
      )
      .digest('hex');
    const version = await transaction.questionVersion.create({
      data: {
        tenantId,
        questionId: question.id,
        questionTypeId: references.questionTypeId,
        versionNumber: 1,
        status: VersionStatus.PUBLISHED,
        prompt: input.title,
        answerSchema: input.content as Prisma.InputJsonValue,
        scoringSchema: {
          compatibility: 'one-xl',
          trainingLink: input.trainingLink,
          tags: input.tags
        },
        explanation: input.explanation,
        defaultMarks: input.marks,
        defaultNegativeMarks: input.negativeMarks,
        requiresManualReview: manualReview(input),
        publishedAt: new Date(),
        contentHash,
        createdById: userId,
        options: { create: optionData(input, tenantId) }
      }
    });
    await transaction.question.update({
      where: { id: question.id },
      data: { currentVersionId: version.id }
    });
    await syncTags(transaction, tenantId, question.id, userId, input.tags);
    if (onCreated) {
      await onCreated(transaction, question, version);
    }
    return { ...question, currentVersionId: version.id };
  });
}

const questionInclude = {
  category: { include: { parent: true } },
  difficultyLevel: true,
  currentVersion: { include: { questionType: true } },
  tags: { include: { tag: true } }
} satisfies Prisma.QuestionInclude;

function compatibilityQuestion(
  question: Prisma.QuestionGetPayload<{ include: typeof questionInclude }>
) {
  const version = question.currentVersion;
  if (!version) throw new ApiError(500, 'The question has no current version.');
  const metadata = versionMetadata(version);
  const isSubCategory = Boolean(question.category.parentId);
  return {
    id: question.id,
    title: question.title,
    type: version.questionType.key,
    categoryId: isSubCategory ? question.category.parentId : question.categoryId,
    subCategoryId: isSubCategory ? question.categoryId : null,
    difficulty:
      codeToDifficulty.get(question.difficultyLevel.code) ??
      question.difficultyLevel.code.toLowerCase(),
    marks: Number(version.defaultMarks),
    negativeMarks: Number(version.defaultNegativeMarks),
    explanation: version.explanation ?? '',
    trainingLink: metadata.trainingLink,
    tags: question.tags.map((link) => link.tag.name),
    content: version.answerSchema,
    status: question.status === QuestionStatus.ARCHIVED ? 'archived' : 'active',
    createdAt: question.createdAt,
    updatedAt: question.updatedAt
  };
}

export function createQuestionRouter(
  prisma: ZorflyPrismaClient,
  service: AuthService,
  tokens: TokenService
): Router {
  const router = Router();
  router.use(createRequireAuth(tokens));
  router.use(createRequirePermission(service, 'questions:read'));

  router.get('/', async (request, response) => {
    const auth = principal(request);
    const { page, limit, skip } = pageQuery(request);
    const search = queryString(request.query.search).trim();
    const type = queryString(request.query.type);
    const categoryId = queryString(request.query.categoryId);
    const difficulty = queryString(request.query.difficulty);
    const statusFilter =
      queryString(request.query.status) === 'in_review'
        ? QuestionStatus.IN_REVIEW
        : QuestionStatus.PUBLISHED;
    const where = {
      tenantId: auth.tenantId,
      status: statusFilter,
      deletedAt: null,
      ...(search ? { title: { contains: search, mode: 'insensitive' as const } } : {}),
      ...(type ? { currentVersion: { questionType: { key: type } } } : {}),
      ...(categoryId
        ? {
            category: {
              OR: [{ id: categoryId }, { parentId: categoryId }]
            }
          }
        : {}),
      ...(difficulty
        ? {
            difficultyLevel: {
              code: difficultyCodes[difficulty as keyof typeof difficultyCodes] ?? ''
            }
          }
        : {})
    };
    const [rows, totalCount] = await prisma.$transaction([
      prisma.question.findMany({
        where,
        include: questionInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.question.count({ where })
    ]);
    response.json({
      success: true,
      data: {
        rows: rows.map((question) => {
          const compatible = compatibilityQuestion(question);
          return {
            id: compatible.id,
            title: compatible.title,
            type: compatible.type,
            category: question.category.parent?.name ?? question.category.name,
            categoryId: compatible.categoryId,
            difficulty: compatible.difficulty,
            marks: compatible.marks,
            negativeMarks: compatible.negativeMarks,
            createdAt: compatible.createdAt,
            reviewStatus: question.status === QuestionStatus.IN_REVIEW ? 'in_review' : 'published'
          };
        }),
        totalCount,
        page,
        limit
      }
    });
  });

  router.get('/import/template', (_request, response) => {
    sendCsv(
      response,
      'zorfly-question-template.csv',
      toCsv(importHeaders, [
        {
          type: 'mcq',
          title: 'Which sentence is correct?',
          category: 'Content Writing',
          difficulty: 'junior',
          marks: 10,
          negativeMarks: 0,
          explanation: 'Option B uses the correct verb form.',
          optionA: 'He go to work.',
          optionB: 'He goes to work.',
          optionC: 'He going to work.',
          optionD: '',
          correctOptions: 'B',
          correctAnswer: ''
        }
      ])
    );
  });

  router.post(
    '/import',
    createRequirePermission(service, 'questions:manage'),
    async (request, response) => {
      const auth = principal(request);
      const body = z.object({ csv: z.string() }).safeParse(request.body as unknown);
      if (!body.success || !body.data.csv.trim()) {
        throw new ApiError(422, 'CSV content is required.');
      }
      const csv = body.data.csv;
      const rows = parseCsv(csv.replace(/^\uFEFF|^ï»¿/, ''));
      if (rows.length < 2) {
        throw new ApiError(422, 'The CSV file is empty. Download the template and add rows.');
      }
      const headers = (rows[0] ?? []).map((header) => header.replace(/^\uFEFF|^ï»¿/, '').trim());
      if (!headers.includes('type') || !headers.includes('title')) {
        throw new ApiError(
          422,
          'The CSV header row is invalid. Download the template and try again.'
        );
      }
      const categories = await prisma.assessmentCategory.findMany({
        where: { tenantId: auth.tenantId, status: RecordStatus.ACTIVE, deletedAt: null }
      });
      const categoryByName = new Map(
        categories.map((category) => [category.name.toLowerCase(), category])
      );
      const errors: string[] = [];
      let created = 0;
      for (let index = 1; index < rows.length; index += 1) {
        const row = rows[index] ?? [];
        const cell = (name: string) => {
          const column = headers.indexOf(name);
          return column < 0 ? '' : (row[column] ?? '').trim();
        };
        try {
          const type = cell('type').toLowerCase();
          if (type !== 'mcq' && type !== 'true_false') {
            throw new Error('type must be mcq or true_false');
          }
          const categoryName = cell('category');
          const category = categoryByName.get(categoryName.toLowerCase());
          if (!category) throw new Error(`category "${categoryName}" does not exist`);
          const difficulty = cell('difficulty').toLowerCase().replace(/[\s-]/g, '_');
          if (!difficultyKeys.includes(difficulty as never)) {
            throw new Error(`difficulty must be one of: ${difficultyKeys.join(', ')}`);
          }
          let content: unknown;
          if (type === 'mcq') {
            const options = ['A', 'B', 'C', 'D']
              .map((letter) => ({
                id: letter.toLowerCase(),
                text: cell(`option${letter}`)
              }))
              .filter((option) => option.text);
            const correctOptionIds = cell('correctOptions')
              .split('|')
              .map((letter) => letter.trim().toLowerCase())
              .filter(Boolean);
            content = {
              options,
              correctOptionIds,
              multiple: correctOptionIds.length > 1,
              partialCredit: correctOptionIds.length > 1
            };
          } else {
            const answer = cell('correctAnswer').toUpperCase();
            if (answer !== 'TRUE' && answer !== 'FALSE') {
              throw new Error('correctAnswer must be TRUE or FALSE');
            }
            content = { correctAnswer: answer === 'TRUE' };
          }
          const parsed = questionSchema.safeParse({
            title: cell('title'),
            type,
            categoryId: category.id,
            difficulty,
            marks: Number(cell('marks')) || 10,
            negativeMarks: Number(cell('negativeMarks')) || 0,
            explanation: cell('explanation'),
            trainingLink: '',
            tags: [],
            content
          });
          if (!parsed.success) {
            throw new Error(parsed.error.issues[0]?.message ?? 'invalid row');
          }
          await createQuestion(prisma, auth.tenantId, auth.userId, parsed.data);
          created += 1;
        } catch (error) {
          errors.push(
            `Row ${String(index + 1)}: ${error instanceof Error ? error.message : 'invalid row'}`
          );
        }
      }
      await service.recordAudit(
        {
          action: 'question.imported',
          actorUserId: auth.userId,
          tenantId: auth.tenantId,
          entityType: 'question_import',
          metadata: { created, rejected: errors.length }
        },
        context(request)
      );
      response.json({
        success: true,
        data: {
          created,
          errors,
          message: `${String(created)} question(s) imported successfully.`
        }
      });
    }
  );

  router.get('/export/csv', async (request, response) => {
    const auth = principal(request);
    const questions = await prisma.question.findMany({
      where: {
        tenantId: auth.tenantId,
        status: QuestionStatus.PUBLISHED,
        deletedAt: null
      },
      include: questionInclude
    });
    sendCsv(
      response,
      'zorfly-questions.csv',
      toCsv(
        ['type', 'title', 'category', 'difficulty', 'marks', 'negativeMarks', 'explanation'],
        questions.map((question) => {
          const compatible = compatibilityQuestion(question);
          return {
            type: compatible.type,
            title: compatible.title,
            category: question.category.parent?.name ?? question.category.name,
            difficulty: compatible.difficulty,
            marks: compatible.marks,
            negativeMarks: compatible.negativeMarks,
            explanation: compatible.explanation
          };
        })
      )
    );
  });

  router.get('/:id', async (request, response) => {
    const auth = principal(request);
    const id = uuid.parse(request.params.id);
    const question = await prisma.question.findFirst({
      where: { id, tenantId: auth.tenantId, deletedAt: null },
      include: questionInclude
    });
    if (!question) throw new ApiError(404, 'The requested question was not found.');
    response.json({ success: true, data: compatibilityQuestion(question) });
  });

  router.post(
    '/',
    createRequirePermission(service, 'questions:manage'),
    validate(questionSchema),
    async (request, response) => {
      const auth = principal(request);
      const input = questionSchema.parse(request.body);
      const question = await createQuestion(prisma, auth.tenantId, auth.userId, input);
      await service.recordAudit(
        {
          action: 'question.created',
          actorUserId: auth.userId,
          tenantId: auth.tenantId,
          entityType: 'question',
          entityId: question.id
        },
        context(request)
      );
      response.status(201).json({
        success: true,
        data: { id: question.id, message: 'Question created successfully.' }
      });
    }
  );

  router.put(
    '/:id',
    createRequirePermission(service, 'questions:manage'),
    validate(questionSchema),
    async (request, response) => {
      const auth = principal(request);
      const id = uuid.parse(request.params.id);
      const input = questionSchema.parse(request.body);
      const existing = await prisma.question.findFirst({
        where: { id, tenantId: auth.tenantId, deletedAt: null },
        include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } }
      });
      if (!existing) throw new ApiError(404, 'The requested question was not found.');
      const references = await resolveReferences(prisma, auth.tenantId, input);
      const versionNumber = (existing.versions[0]?.versionNumber ?? 0) + 1;
      await prisma.$transaction(async (transaction) => {
        if (existing.currentVersionId) {
          await transaction.questionVersion.update({
            where: { id: existing.currentVersionId },
            data: { status: VersionStatus.SUPERSEDED }
          });
        }
        const version = await transaction.questionVersion.create({
          data: {
            tenantId: auth.tenantId,
            questionId: id,
            questionTypeId: references.questionTypeId,
            versionNumber,
            status: VersionStatus.PUBLISHED,
            prompt: input.title,
            answerSchema: input.content as Prisma.InputJsonValue,
            scoringSchema: {
              compatibility: 'one-xl',
              trainingLink: input.trainingLink,
              tags: input.tags
            },
            explanation: input.explanation,
            defaultMarks: input.marks,
            defaultNegativeMarks: input.negativeMarks,
            requiresManualReview: manualReview(input),
            publishedAt: new Date(),
            contentHash: createHash('sha256')
              .update(JSON.stringify({ questionId: id, versionNumber, input }))
              .digest('hex'),
            createdById: auth.userId,
            options: { create: optionData(input, auth.tenantId) }
          }
        });
        await transaction.question.update({
          where: { id },
          data: {
            categoryId: references.categoryId,
            difficultyLevelId: references.difficultyLevelId,
            title: input.title,
            status: QuestionStatus.PUBLISHED,
            currentVersionId: version.id,
            updatedById: auth.userId,
            rowVersion: { increment: 1 }
          }
        });
        await syncTags(transaction, auth.tenantId, id, auth.userId, input.tags);
      });
      await service.recordAudit(
        {
          action: 'question.updated',
          actorUserId: auth.userId,
          tenantId: auth.tenantId,
          entityType: 'question',
          entityId: id,
          metadata: { versionNumber }
        },
        context(request)
      );
      response.json({
        success: true,
        data: { id, message: 'Question updated successfully.' }
      });
    }
  );

  router.delete(
    '/:id',
    createRequirePermission(service, 'questions:manage'),
    async (request, response) => {
      const auth = principal(request);
      const id = uuid.parse(request.params.id);
      const question = await prisma.question.findFirst({
        where: { id, tenantId: auth.tenantId, deletedAt: null }
      });
      if (!question) throw new ApiError(404, 'The requested question was not found.');
      await prisma.question.update({
        where: { id },
        data: {
          status: QuestionStatus.ARCHIVED,
          deletedAt: new Date(),
          deletedById: auth.userId,
          rowVersion: { increment: 1 }
        }
      });
      await service.recordAudit(
        {
          action: 'question.archived',
          actorUserId: auth.userId,
          tenantId: auth.tenantId,
          entityType: 'question',
          entityId: id
        },
        context(request)
      );
      response.json({
        success: true,
        data: { message: 'Question deleted successfully.' }
      });
    }
  );

  router.post(
    '/:id/publish',
    createRequirePermission(service, 'questions:manage'),
    async (request, response) => {
      const auth = principal(request);
      const id = uuid.parse(request.params.id);
      const question = await prisma.question.findFirst({
        where: { id, tenantId: auth.tenantId, deletedAt: null }
      });
      if (!question) throw new ApiError(404, 'The requested question was not found.');
      if (
        question.status !== QuestionStatus.IN_REVIEW &&
        question.status !== QuestionStatus.DRAFT
      ) {
        throw new ApiError(422, 'Only questions awaiting review can be published.');
      }
      await prisma.question.update({
        where: { id },
        data: {
          status: QuestionStatus.PUBLISHED,
          updatedById: auth.userId,
          rowVersion: { increment: 1 }
        }
      });
      await service.recordAudit(
        {
          action: 'question.published',
          actorUserId: auth.userId,
          tenantId: auth.tenantId,
          entityType: 'question',
          entityId: id
        },
        context(request)
      );
      response.json({
        success: true,
        data: { id, message: 'Question published to the question bank.' }
      });
    }
  );

  return router;
}

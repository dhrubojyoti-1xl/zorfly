import { createHash, randomUUID } from 'node:crypto';
import { Router, type Request } from 'express';
import { z } from 'zod';
import {
  LearningContentType,
  RecordStatus,
  VersionStatus,
  type Prisma,
  type ZorflyPrismaClient
} from '@zorfly/database';
import { ApiError } from '../../platform/api-error.js';
import { validate } from '../../platform/validate.js';
import { createRequireAuth, createRequirePermission } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { difficultyKeys } from '../assessment/question.validation.js';
import type { SessionPrincipal } from '../auth/auth.types.js';
import type { TokenService } from '../auth/tokens.js';
import {
  learningMaterialSchema,
  linkLikeTypes,
  type LearningMaterialInput,
  type LearningMaterialType
} from './learning-material.validation.js';

const uuid = z.uuid();

export const contentTypeCodes: Record<LearningMaterialType, LearningContentType> = {
  article: LearningContentType.ARTICLE,
  video: LearningContentType.VIDEO,
  pdf: LearningContentType.PDF,
  link: LearningContentType.EXTERNAL_LINK,
  study_guide: LearningContentType.STUDY_GUIDE,
  summary: LearningContentType.SUMMARY,
  flashcards: LearningContentType.FLASHCARDS,
  practice_quiz: LearningContentType.PRACTICE_QUIZ
};
export const codeToType = new Map(
  Object.entries(contentTypeCodes).map(([key, value]) => [value, key])
) as Map<LearningContentType, LearningMaterialType>;

export const difficultyCodes: Record<(typeof difficultyKeys)[number], string> = {
  fresher: 'FRESHER',
  junior: 'JUNIOR',
  mid_level: 'MID_LEVEL',
  senior: 'SENIOR',
  team_lead: 'TEAM_LEAD',
  manager: 'MANAGER',
  hod: 'HEAD_OF_DEPARTMENT',
  cxo: 'CEO_CXO'
};
export const codeToDifficulty = new Map(
  Object.entries(difficultyCodes).map(([key, value]) => [value, key])
);

export function principal(request: Request): SessionPrincipal & { tenantId: string } {
  if (!request.auth?.tenantId) throw new ApiError(401, 'Authentication is required.');
  return { ...request.auth, tenantId: request.auth.tenantId };
}

export function queryString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function pageQuery(request: Request) {
  const page = Math.max(1, Number.parseInt(queryString(request.query.page), 10) || 1);
  const requested = Number.parseInt(queryString(request.query.limit), 10) || 10;
  const limit = [10, 20, 50, 100].includes(requested) ? requested : 10;
  return { page, limit, skip: (page - 1) * limit };
}

function materialCode(): string {
  return `LM_${randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase()}`;
}

async function resolveCategory(
  prisma: ZorflyPrismaClient,
  tenantId: string,
  input: Pick<LearningMaterialInput, 'categoryId' | 'subCategoryId'>
): Promise<string | null> {
  const storedCategoryId = input.subCategoryId ?? input.categoryId ?? null;
  if (!storedCategoryId) return null;
  const category = await prisma.assessmentCategory.findFirst({
    where: {
      id: storedCategoryId,
      tenantId,
      status: RecordStatus.ACTIVE,
      deletedAt: null,
      ...(input.subCategoryId && input.categoryId ? { parentId: input.categoryId } : {})
    }
  });
  if (!category) {
    throw new ApiError(422, 'Invalid value.', {
      [input.subCategoryId ? 'subCategoryId' : 'categoryId']: 'Invalid value.'
    });
  }
  return category.id;
}

async function resolveDifficulty(
  prisma: ZorflyPrismaClient,
  tenantId: string,
  difficulty: LearningMaterialInput['difficulty']
): Promise<string | null> {
  if (!difficulty) return null;
  const level = await prisma.difficultyLevel.findFirst({
    where: {
      tenantId,
      code: difficultyCodes[difficulty],
      status: RecordStatus.ACTIVE,
      deletedAt: null
    }
  });
  if (!level) {
    throw new ApiError(422, 'Invalid value.', { difficulty: 'Invalid value.' });
  }
  return level.id;
}

function versionBody(input: LearningMaterialInput) {
  return {
    description: input.description,
    body: input.body,
    questions: input.questions,
    tags: input.tags
  };
}

export interface CreateMaterialOptions {
  source?: 'ai' | 'manual';
}

export async function createLearningMaterial(
  prisma: ZorflyPrismaClient,
  tenantId: string,
  userId: string,
  input: LearningMaterialInput,
  options: CreateMaterialOptions = {}
) {
  const [categoryId, difficultyLevelId] = await Promise.all([
    resolveCategory(prisma, tenantId, input),
    resolveDifficulty(prisma, tenantId, input.difficulty)
  ]);
  return prisma.$transaction(async (transaction) => {
    const material = await transaction.learningMaterial.create({
      data: {
        tenantId,
        categoryId,
        difficultyLevelId,
        code: materialCode(),
        title: input.title,
        contentType: contentTypeCodes[input.type],
        status: RecordStatus.ACTIVE,
        createdById: userId
      }
    });
    const body = {
      ...versionBody(input),
      source: options.source ?? 'manual'
    } as Prisma.InputJsonValue;
    const contentHash = createHash('sha256')
      .update(JSON.stringify({ materialId: material.id, version: 1, body }))
      .digest('hex');
    const version = await transaction.learningMaterialVersion.create({
      data: {
        tenantId,
        materialId: material.id,
        versionNumber: 1,
        status: VersionStatus.PUBLISHED,
        body,
        ...(input.url ? { sourceUrl: input.url } : {}),
        contentHash,
        publishedAt: new Date(),
        createdById: userId
      }
    });
    await transaction.learningMaterial.update({
      where: { id: material.id },
      data: { currentVersionId: version.id }
    });
    return material;
  });
}

export const materialInclude = {
  category: { include: { parent: true } },
  difficultyLevel: true,
  currentVersion: true
} satisfies Prisma.LearningMaterialInclude;

export type MaterialRecord = Prisma.LearningMaterialGetPayload<{ include: typeof materialInclude }>;

interface VersionBodyShape {
  description?: string;
  body?: { overview?: string; sections?: unknown[]; keyPoints?: string[] };
  questions?: unknown[];
  tags?: string[];
  source?: string;
}

function versionBodyOf(value: Prisma.JsonValue | null | undefined): VersionBodyShape {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return value as VersionBodyShape;
}

export function summary(material: MaterialRecord) {
  const version = material.currentVersion;
  const shape = versionBodyOf(version?.body);
  const isSubCategory = Boolean(material.category?.parentId);
  const type = codeToType.get(material.contentType) ?? 'link';
  return {
    id: material.id,
    title: material.title,
    description: shape.description ?? '',
    type,
    contentType: type,
    categoryId: isSubCategory ? material.category?.parentId : (material.categoryId ?? null),
    subCategoryId: isSubCategory ? material.categoryId : null,
    category: isSubCategory
      ? (material.category?.parent?.name ?? '')
      : (material.category?.name ?? ''),
    subCategory: isSubCategory ? (material.category?.name ?? '') : '',
    difficulty: material.difficultyLevel ? codeToDifficulty.get(material.difficultyLevel.code) : '',
    url: version?.sourceUrl ?? '',
    questionCount: Array.isArray(shape.questions) ? shape.questions.length : 0,
    source: shape.source ?? 'manual',
    status: material.status === 'ARCHIVED' ? 'archived' : 'active',
    createdAt: material.createdAt
  };
}

export function detail(material: MaterialRecord) {
  const version = material.currentVersion;
  const shape = versionBodyOf(version?.body);
  const isSubCategory = Boolean(material.category?.parentId);
  const type = codeToType.get(material.contentType) ?? 'link';
  return {
    id: material.id,
    title: material.title,
    description: shape.description ?? '',
    type,
    contentType: type,
    categoryId: isSubCategory ? material.category?.parentId : (material.categoryId ?? null),
    subCategoryId: isSubCategory ? material.categoryId : null,
    category: isSubCategory
      ? (material.category?.parent?.name ?? '')
      : (material.category?.name ?? ''),
    subCategory: isSubCategory ? (material.category?.name ?? '') : '',
    difficulty: material.difficultyLevel ? codeToDifficulty.get(material.difficultyLevel.code) : '',
    url: version?.sourceUrl ?? '',
    body: shape.body ?? { overview: '', sections: [], keyPoints: [] },
    questions: shape.questions ?? [],
    tags: shape.tags ?? [],
    source: shape.source ?? 'manual',
    status: material.status === 'ARCHIVED' ? 'archived' : 'active',
    createdAt: material.createdAt,
    updatedAt: material.updatedAt
  };
}

export function createLearningRouter(
  prisma: ZorflyPrismaClient,
  service: AuthService,
  tokens: TokenService
): Router {
  const router = Router();
  router.use(createRequireAuth(tokens));
  router.use(createRequirePermission(service, 'learning:read'));

  router.get('/', async (request, response) => {
    const auth = principal(request);
    const { page, limit, skip } = pageQuery(request);
    const search = queryString(request.query.search).trim();
    const type = queryString(request.query.type);
    const categoryId = queryString(request.query.categoryId);
    const difficulty = queryString(request.query.difficulty);
    const where = {
      tenantId: auth.tenantId,
      status: RecordStatus.ACTIVE,
      deletedAt: null,
      ...(search ? { title: { contains: search, mode: 'insensitive' as const } } : {}),
      ...(type ? { contentType: contentTypeCodes[type as LearningMaterialType] } : {}),
      ...(categoryId ? { category: { OR: [{ id: categoryId }, { parentId: categoryId }] } } : {}),
      ...(difficulty
        ? {
            difficultyLevel: {
              code: difficultyCodes[difficulty as keyof typeof difficultyCodes] ?? ''
            }
          }
        : {})
    };
    const [rows, totalCount] = await prisma.$transaction([
      prisma.learningMaterial.findMany({
        where,
        include: materialInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.learningMaterial.count({ where })
    ]);
    response.json({
      success: true,
      data: { rows: rows.map((row) => summary(row)), totalCount, page, limit }
    });
  });

  router.get('/:id', async (request, response) => {
    const auth = principal(request);
    const id = uuid.parse(request.params.id);
    const material = await prisma.learningMaterial.findFirst({
      where: { id, tenantId: auth.tenantId, status: RecordStatus.ACTIVE, deletedAt: null },
      include: materialInclude
    });
    if (!material) throw new ApiError(404, 'The requested learning material was not found.');
    response.json({ success: true, data: detail(material) });
  });

  router.post(
    '/',
    createRequirePermission(service, 'learning:manage'),
    validate(learningMaterialSchema),
    async (request, response) => {
      const auth = principal(request);
      const input = request.body as LearningMaterialInput;
      const material = await createLearningMaterial(prisma, auth.tenantId, auth.userId, input);
      response.status(201).json({
        success: true,
        data: { id: material.id, message: 'Learning material created successfully.' }
      });
    }
  );

  router.put(
    '/:id',
    createRequirePermission(service, 'learning:manage'),
    validate(learningMaterialSchema),
    async (request, response) => {
      const auth = principal(request);
      const id = uuid.parse(request.params.id);
      const input = request.body as LearningMaterialInput;
      const existing = await prisma.learningMaterial.findFirst({
        where: { id, tenantId: auth.tenantId, status: RecordStatus.ACTIVE, deletedAt: null },
        include: { currentVersion: true }
      });
      if (!existing) throw new ApiError(404, 'The requested learning material was not found.');
      const [categoryId, difficultyLevelId] = await Promise.all([
        resolveCategory(prisma, auth.tenantId, input),
        resolveDifficulty(prisma, auth.tenantId, input.difficulty)
      ]);
      await prisma.$transaction(async (transaction) => {
        const latestVersion = await transaction.learningMaterialVersion.findFirst({
          where: { materialId: existing.id },
          orderBy: { versionNumber: 'desc' }
        });
        if (latestVersion?.status === VersionStatus.PUBLISHED) {
          await transaction.learningMaterialVersion.update({
            where: { id: latestVersion.id },
            data: { status: VersionStatus.SUPERSEDED }
          });
        }
        const body = { ...versionBody(input), source: 'manual' } as Prisma.InputJsonValue;
        const contentHash = createHash('sha256')
          .update(
            JSON.stringify({
              materialId: existing.id,
              version: (latestVersion?.versionNumber ?? 0) + 1,
              body
            })
          )
          .digest('hex');
        const version = await transaction.learningMaterialVersion.create({
          data: {
            tenantId: auth.tenantId,
            materialId: existing.id,
            versionNumber: (latestVersion?.versionNumber ?? 0) + 1,
            status: VersionStatus.PUBLISHED,
            body,
            ...(input.url ? { sourceUrl: input.url } : {}),
            contentHash,
            publishedAt: new Date(),
            createdById: auth.userId
          }
        });
        await transaction.learningMaterial.update({
          where: { id: existing.id },
          data: {
            title: input.title,
            categoryId,
            difficultyLevelId,
            contentType: contentTypeCodes[input.type],
            currentVersionId: version.id,
            updatedById: auth.userId
          }
        });
      });
      response.json({
        success: true,
        data: { id: existing.id, message: 'Learning material updated successfully.' }
      });
    }
  );

  router.delete(
    '/:id',
    createRequirePermission(service, 'learning:manage'),
    async (request, response) => {
      const auth = principal(request);
      const id = uuid.parse(request.params.id);
      const material = await prisma.learningMaterial.findFirst({
        where: { id, tenantId: auth.tenantId, status: RecordStatus.ACTIVE, deletedAt: null }
      });
      if (!material) throw new ApiError(404, 'The requested learning material was not found.');
      await prisma.learningMaterial.update({
        where: { id: material.id },
        data: { status: RecordStatus.ARCHIVED, updatedById: auth.userId }
      });
      response.json({
        success: true,
        data: { message: 'Learning material deleted successfully.' }
      });
    }
  );

  return router;
}

export { linkLikeTypes };

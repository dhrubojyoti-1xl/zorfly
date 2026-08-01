import { Router } from 'express';
import { z } from 'zod';
import { RecordStatus, type ZorflyPrismaClient } from '@zorfly/database';
import { ApiError } from '../../platform/api-error.js';
import { validate } from '../../platform/validate.js';
import { createRequireAuth, createRequirePermission } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { TokenService } from '../auth/tokens.js';
import { learningMaterialSchema, studyContentTypes } from './learning-material.validation.js';
import {
  contentTypeCodes,
  createLearningMaterial,
  detail,
  difficultyCodes,
  materialInclude,
  pageQuery,
  principal,
  queryString,
  summary
} from './learning.router.js';

const uuid = z.uuid();

/**
 * Study Library authoring uses `contentType` as the field name (matching the
 * OneXL reference and the AI study-generation payload); the shared
 * LearningMaterial persistence layer calls the same concept `type`. Rename
 * before validating against the shared schema rather than forking it.
 */
const studyMaterialSchema = z.preprocess((value) => {
  if (typeof value !== 'object' || value === null) return value;
  const { contentType, ...rest } = value as Record<string, unknown>;
  return { ...rest, type: contentType };
}, learningMaterialSchema);

const studyContentTypeCodes = new Set(studyContentTypes.map((type) => contentTypeCodes[type]));

export function createStudyRouter(
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
    const contentType = queryString(request.query.contentType);
    const categoryId = queryString(request.query.categoryId);
    const difficulty = queryString(request.query.difficulty);
    const where = {
      tenantId: auth.tenantId,
      status: RecordStatus.ACTIVE,
      deletedAt: null,
      contentType: contentType
        ? contentTypeCodes[contentType as keyof typeof contentTypeCodes]
        : { in: [...studyContentTypeCodes] },
      ...(search ? { title: { contains: search, mode: 'insensitive' as const } } : {}),
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

  router.get('/practice-categories', async (request, response) => {
    const auth = principal(request);
    const rows = await prisma.learningMaterial.findMany({
      where: {
        tenantId: auth.tenantId,
        status: RecordStatus.ACTIVE,
        deletedAt: null,
        categoryId: { not: null },
        contentType: { in: [...studyContentTypeCodes] }
      },
      include: materialInclude
    });
    const grouped = new Map<
      string,
      {
        id: string;
        name: string;
        parentId: string | null;
        questionCount: number;
        materialCount: number;
      }
    >();
    for (const row of rows) {
      const shape = summary(row);
      const questionCount = shape.questionCount;
      if (questionCount === 0 || !shape.categoryId) continue;
      const key = shape.categoryId;
      const existing = grouped.get(key);
      if (existing) {
        existing.questionCount += questionCount;
        existing.materialCount += 1;
      } else {
        grouped.set(key, {
          id: key,
          name: shape.category || '',
          parentId: null,
          questionCount,
          materialCount: 1
        });
      }
    }
    const result = [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name));
    response.json({ success: true, data: { rows: result, totalCount: result.length } });
  });

  router.get('/:id', async (request, response) => {
    const auth = principal(request);
    const id = uuid.parse(request.params.id);
    const material = await prisma.learningMaterial.findFirst({
      where: {
        id,
        tenantId: auth.tenantId,
        status: RecordStatus.ACTIVE,
        deletedAt: null,
        contentType: { in: [...studyContentTypeCodes] }
      },
      include: materialInclude
    });
    if (!material) throw new ApiError(404, 'The requested study material was not found.');
    response.json({ success: true, data: detail(material) });
  });

  router.post(
    '/',
    createRequirePermission(service, 'learning:manage'),
    validate(studyMaterialSchema),
    async (request, response) => {
      const auth = principal(request);
      const input = request.body as z.output<typeof studyMaterialSchema>;
      const material = await createLearningMaterial(prisma, auth.tenantId, auth.userId, input, {
        source: 'manual'
      });
      response.status(201).json({
        success: true,
        data: { id: material.id, message: 'Study material created successfully.' }
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
        where: {
          id,
          tenantId: auth.tenantId,
          status: RecordStatus.ACTIVE,
          deletedAt: null,
          contentType: { in: [...studyContentTypeCodes] }
        }
      });
      if (!material) throw new ApiError(404, 'The requested study material was not found.');
      await prisma.learningMaterial.update({
        where: { id: material.id },
        data: { status: RecordStatus.ARCHIVED, updatedById: auth.userId }
      });
      response.json({ success: true, data: { message: 'Study material deleted successfully.' } });
    }
  );

  return router;
}

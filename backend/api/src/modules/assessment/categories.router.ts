import { randomUUID } from 'node:crypto';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { RecordStatus, type ZorflyPrismaClient } from '@zorfly/database';
import { roles } from '../../domain/access-control.js';
import { ApiError } from '../../platform/api-error.js';
import { validate } from '../../platform/validate.js';
import { createRequireAuth, requireRole } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { RequestContext, SessionPrincipal } from '../auth/auth.types.js';
import type { TokenService } from '../auth/tokens.js';

const uuid = z.uuid('Invalid value.');
const categorySchema = z.object({
  name: z
    .string({ error: 'Category Name is required.' })
    .trim()
    .min(2, 'Category Name must be at least 2 characters.')
    .max(100, 'Category Name must not exceed 100 characters.'),
  parentId: uuid.optional().nullable(),
  order: z.number().int().min(0).optional()
});
const updateCategorySchema = categorySchema
  .partial()
  .extend({ status: z.enum(['active', 'archived']).optional() });

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

function categoryCode(name: string): string {
  const stem =
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 64) || 'CATEGORY';
  return `${stem}_${randomUUID().slice(0, 8).toUpperCase()}`;
}

async function requireParent(
  prisma: ZorflyPrismaClient,
  tenantId: string,
  parentId: string | null | undefined,
  currentId?: string
): Promise<void> {
  if (!parentId) return;
  if (parentId === currentId) {
    throw new ApiError(422, 'Invalid value.', { parentId: 'Invalid value.' });
  }
  const parent = await prisma.assessmentCategory.findFirst({
    where: {
      id: parentId,
      tenantId,
      status: RecordStatus.ACTIVE,
      deletedAt: null,
      ...(currentId ? { parentId: { not: currentId } } : {})
    }
  });
  if (!parent) throw new ApiError(422, 'Invalid value.', { parentId: 'Invalid value.' });
}

export function createCategoryRouter(
  prisma: ZorflyPrismaClient,
  service: AuthService,
  tokens: TokenService
): Router {
  const router = Router();
  router.use(createRequireAuth(tokens));

  router.get(
    '/',
    requireRole(roles.companyAdmin, roles.hr, roles.teamLeader, roles.employee),
    async (request, response) => {
      const auth = principal(request);
      const rows = await prisma.assessmentCategory.findMany({
        where: { tenantId: auth.tenantId, status: RecordStatus.ACTIVE, deletedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
      });
      response.json({
        success: true,
        data: {
          rows: rows.map((category) => ({
            id: category.id,
            name: category.name,
            parentId: category.parentId,
            order: category.sortOrder
          })),
          totalCount: rows.length
        }
      });
    }
  );

  router.post(
    '/',
    requireRole(roles.companyAdmin),
    validate(categorySchema),
    async (request, response) => {
      const auth = principal(request);
      const input = categorySchema.parse(request.body);
      await requireParent(prisma, auth.tenantId, input.parentId);
      const duplicate = await prisma.assessmentCategory.findFirst({
        where: {
          tenantId: auth.tenantId,
          name: { equals: input.name, mode: 'insensitive' },
          parentId: input.parentId ?? null,
          deletedAt: null
        }
      });
      if (duplicate) throw new ApiError(409, 'A category with this name already exists.');
      const category = await prisma.assessmentCategory.create({
        data: {
          tenantId: auth.tenantId,
          parentId: input.parentId ?? null,
          code: categoryCode(input.name),
          name: input.name,
          sortOrder: input.order ?? 0,
          status: RecordStatus.ACTIVE,
          createdById: auth.userId
        }
      });
      await service.recordAudit(
        {
          action: 'category.created',
          actorUserId: auth.userId,
          tenantId: auth.tenantId,
          entityType: 'assessment_category',
          entityId: category.id
        },
        context(request)
      );
      response.status(201).json({
        success: true,
        data: {
          id: category.id,
          name: category.name,
          message: 'Category created successfully.'
        }
      });
    }
  );

  router.patch(
    '/:id',
    requireRole(roles.companyAdmin),
    validate(updateCategorySchema),
    async (request, response) => {
      const auth = principal(request);
      const id = uuid.parse(request.params.id);
      const input = updateCategorySchema.parse(request.body);
      const category = await prisma.assessmentCategory.findFirst({
        where: { id, tenantId: auth.tenantId, deletedAt: null }
      });
      if (!category) throw new ApiError(404, 'The requested category was not found.');
      await requireParent(prisma, auth.tenantId, input.parentId, id);
      if (input.name !== undefined || input.parentId !== undefined) {
        const duplicate = await prisma.assessmentCategory.findFirst({
          where: {
            tenantId: auth.tenantId,
            id: { not: id },
            name: { equals: input.name ?? category.name, mode: 'insensitive' },
            parentId: input.parentId === undefined ? category.parentId : input.parentId,
            deletedAt: null
          }
        });
        if (duplicate) throw new ApiError(409, 'A category with this name already exists.');
      }
      await prisma.assessmentCategory.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
          ...(input.order !== undefined ? { sortOrder: input.order } : {}),
          ...(input.status !== undefined
            ? {
                status: input.status === 'active' ? RecordStatus.ACTIVE : RecordStatus.ARCHIVED
              }
            : {}),
          updatedById: auth.userId,
          rowVersion: { increment: 1 }
        }
      });
      await service.recordAudit(
        {
          action: 'category.updated',
          actorUserId: auth.userId,
          tenantId: auth.tenantId,
          entityType: 'assessment_category',
          entityId: id
        },
        context(request)
      );
      response.json({
        success: true,
        data: { id, message: 'Category updated successfully.' }
      });
    }
  );

  return router;
}

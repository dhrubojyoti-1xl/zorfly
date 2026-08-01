import { Router, type Request } from 'express';
import { z } from 'zod';
import { MembershipStatus, Prisma, RecordStatus, type ZorflyPrismaClient } from '@zorfly/database';
import { roles } from '../../domain/access-control.js';
import { ApiError } from '../../platform/api-error.js';
import { validate } from '../../platform/validate.js';
import { createRequireAuth, createRequirePermission } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { SessionPrincipal } from '../auth/auth.types.js';
import type { TokenService } from '../auth/tokens.js';
import { ruleOf, rewardsSummary } from './rewards.service.js';
import { badgeSchema, type BadgeInput } from './rewards.validation.js';

const uuid = z.uuid();

function principal(request: Request): SessionPrincipal & { tenantId: string } {
  if (!request.auth?.tenantId) throw new ApiError(401, 'Authentication is required.');
  return { ...request.auth, tenantId: request.auth.tenantId };
}

async function activeMembership(prisma: ZorflyPrismaClient, tenantId: string, userId: string) {
  const membership = await prisma.tenantMembership.findFirst({
    where: { tenantId, userId, status: MembershipStatus.ACTIVE, deletedAt: null }
  });
  if (!membership) throw new ApiError(403, 'You are not an active member of this company.');
  return membership;
}

function requireCompanyAdmin(request: Request): void {
  if (request.auth?.role !== roles.companyAdmin) {
    throw new ApiError(403, 'Only the Company Admin can manage badges.');
  }
}

export function createBadgeRouter(
  prisma: ZorflyPrismaClient,
  service: AuthService,
  tokens: TokenService
): Router {
  const router = Router();
  router.use(createRequireAuth(tokens));
  router.use(createRequirePermission(service, 'badges:read'));

  router.get('/mine', async (request, response) => {
    const auth = principal(request);
    const membership = await activeMembership(prisma, auth.tenantId, auth.userId);
    const data = await rewardsSummary(prisma, auth.tenantId, membership.id);
    response.json({ success: true, data });
  });

  router.get('/', async (request, response) => {
    const auth = principal(request);
    const rows = await prisma.badgeDefinition.findMany({
      where: { tenantId: auth.tenantId, deletedAt: null },
      orderBy: { createdAt: 'asc' }
    });
    response.json({
      success: true,
      data: {
        rows: rows.map((badge) => {
          const rule = ruleOf(badge.rule);
          return {
            id: badge.id,
            name: badge.name,
            description: badge.description ?? '',
            icon: rule.icon,
            ruleType: rule.ruleType,
            threshold: rule.threshold,
            points: rule.points,
            active: badge.status === RecordStatus.ACTIVE
          };
        }),
        totalCount: rows.length
      }
    });
  });

  router.post('/', validate(badgeSchema), async (request, response) => {
    const auth = principal(request);
    requireCompanyAdmin(request);
    const input = request.body as BadgeInput;
    const existing = await prisma.badgeDefinition.findFirst({
      where: { tenantId: auth.tenantId, code: badgeCode(input.name), deletedAt: null }
    });
    if (existing) throw new ApiError(409, 'A badge with this name already exists.');
    let badge;
    try {
      badge = await prisma.badgeDefinition.create({
        data: {
          tenantId: auth.tenantId,
          code: badgeCode(input.name),
          name: input.name,
          description: input.description || null,
          rule: {
            ruleType: input.ruleType,
            threshold: input.threshold,
            points: input.points,
            icon: input.icon
          },
          status: RecordStatus.ACTIVE,
          createdById: auth.userId
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ApiError(409, 'A badge with this name already exists.');
      }
      throw error;
    }
    response.status(201).json({
      success: true,
      data: { id: badge.id, message: 'Badge created successfully.' }
    });
  });

  router.patch('/:id/toggle', async (request, response) => {
    const auth = principal(request);
    requireCompanyAdmin(request);
    const id = uuid.parse(request.params.id);
    const badge = await prisma.badgeDefinition.findFirst({
      where: { id, tenantId: auth.tenantId, deletedAt: null }
    });
    if (!badge) throw new ApiError(404, 'The requested badge was not found.');
    const nextStatus =
      badge.status === RecordStatus.ACTIVE ? RecordStatus.INACTIVE : RecordStatus.ACTIVE;
    const updated = await prisma.badgeDefinition.update({
      where: { id: badge.id },
      data: { status: nextStatus }
    });
    const active = updated.status === RecordStatus.ACTIVE;
    response.json({
      success: true,
      data: {
        active,
        message: active ? 'Badge activated successfully.' : 'Badge deactivated successfully.'
      }
    });
  });

  return router;
}

function badgeCode(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/(^-|-$)/g, '')
    .slice(0, 90);
}

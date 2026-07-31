import { Router, type Request } from 'express';
import { z } from 'zod';
import {
  RecordStatus,
  SubscriptionStatus,
  type Prisma,
  type ZorflyPrismaClient
} from '@zorfly/database';
import {
  builtInRoles,
  defaultRolePermissions,
  permissionCatalog,
  permissionCatalogView,
  roles
} from '../../domain/access-control.js';
import { ApiError } from '../../platform/api-error.js';
import { validate } from '../../platform/validate.js';
import {
  createRequireAuth,
  createRequirePermission,
  requireRole
} from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { RequestContext, SessionPrincipal } from '../auth/auth.types.js';
import type { TokenService } from '../auth/tokens.js';

const brandingSchema = z.object({
  logoUrl: z.string().trim().max(1000).optional(),
  primaryColour: z.string().trim().max(20).optional()
});

const permissionsSchema = z.array(z.string()).default([]);
const customRoleSchema = z.object({
  name: z
    .string({ error: 'Role name is required.' })
    .trim()
    .min(2, 'Role name must be at least 2 characters.')
    .max(60, 'Role name must not exceed 60 characters.'),
  key: z.string().trim().max(60).optional(),
  description: z.string().trim().max(200).optional().default(''),
  rank: z.coerce.number().int().min(1).max(9).optional().default(5),
  permissions: permissionsSchema
});
const updateCustomRoleSchema = customRoleSchema.partial();
const builtInPermissionsSchema = z.object({ permissions: permissionsSchema });

function principal(request: Request): SessionPrincipal & { tenantId: string } {
  if (!request.auth?.tenantId) throw new ApiError(401, 'Authentication is required.');
  return { ...request.auth, tenantId: request.auth.tenantId };
}

function requestContext(request: Request): RequestContext {
  const requestId =
    typeof request.id === 'string' || typeof request.id === 'number'
      ? String(request.id)
      : undefined;
  const userAgent = request.headers['user-agent'];
  return {
    ...(request.ip ? { ip: request.ip } : {}),
    ...(requestId ? { requestId } : {}),
    ...(typeof userAgent === 'string' ? { userAgent } : {})
  };
}

function roleKey(value: string | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function cleanPermissions(list: readonly string[]): string[] {
  const known = new Set<string>(permissionCatalog);
  return [...new Set(list.filter((permission) => known.has(permission)))];
}

function compatibilityLogoUrl(settings: Prisma.JsonValue | null): string {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return '';
  const candidate = (settings as Record<string, unknown>).brandingLogoUrl;
  return typeof candidate === 'string' ? candidate : '';
}

async function enforceBrandingEntitlement(
  prisma: ZorflyPrismaClient,
  tenantId: string
): Promise<void> {
  const subscription = await prisma.tenantSubscription.findFirst({
    where: {
      tenantId,
      status: { in: [SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE] }
    },
    include: { plan: { include: { entitlements: true } } },
    orderBy: { createdAt: 'desc' }
  });
  if (!subscription) return;
  const enabled = subscription.plan.entitlements.some(
    (entitlement) => entitlement.featureKey === 'custom_branding' && entitlement.enabled
  );
  if (!enabled) {
    throw new ApiError(
      422,
      `Custom Branding is not available on your ${subscription.plan.name} plan. Upgrade your plan to unlock this feature.`
    );
  }
}

export function createCompanyRouter(
  prisma: ZorflyPrismaClient,
  authService: AuthService,
  tokens: TokenService
): Router {
  const router = Router();
  const requireAuth = createRequireAuth(tokens);

  router.get(
    '/current',
    requireAuth,
    requireRole(roles.companyAdmin),
    async (request, response) => {
      const auth = principal(request);
      const company = await prisma.tenant.findFirst({
        where: { id: auth.tenantId, deletedAt: null },
        include: { branding: true }
      });
      if (!company) throw new ApiError(404, 'Company not found.');
      response.json({
        success: true,
        data: {
          id: company.id,
          name: company.name,
          slug: company.slug,
          logoUrl: compatibilityLogoUrl(company.settings),
          primaryColour: company.branding?.primaryColor ?? ''
        }
      });
    }
  );

  router.patch(
    '/branding',
    requireAuth,
    requireRole(roles.companyAdmin),
    validate(brandingSchema),
    async (request, response) => {
      const auth = principal(request);
      const input = brandingSchema.parse(request.body);
      await enforceBrandingEntitlement(prisma, auth.tenantId);
      const existing = await prisma.tenant.findFirst({
        where: { id: auth.tenantId, deletedAt: null }
      });
      if (!existing) throw new ApiError(404, 'Company not found.');
      const settings =
        existing.settings &&
        typeof existing.settings === 'object' &&
        !Array.isArray(existing.settings)
          ? { ...existing.settings }
          : {};

      await prisma.$transaction(async (transaction) => {
        if (input.logoUrl !== undefined) {
          await transaction.tenant.update({
            where: { id: auth.tenantId },
            data: {
              settings: { ...settings, brandingLogoUrl: input.logoUrl },
              updatedById: auth.userId,
              rowVersion: { increment: 1 }
            }
          });
        }
        if (input.primaryColour !== undefined) {
          await transaction.tenantBranding.upsert({
            where: { tenantId: auth.tenantId },
            create: {
              tenantId: auth.tenantId,
              primaryColor: input.primaryColour,
              createdById: auth.userId
            },
            update: {
              primaryColor: input.primaryColour,
              updatedById: auth.userId,
              rowVersion: { increment: 1 }
            }
          });
        }
      });
      await authService.recordAudit(
        {
          action: 'company.branding_updated',
          actorUserId: auth.userId,
          tenantId: auth.tenantId,
          entityType: 'tenant',
          entityId: auth.tenantId
        },
        requestContext(request)
      );
      response.json({
        success: true,
        data: {
          logoUrl: input.logoUrl ?? compatibilityLogoUrl(existing.settings),
          message: 'Company branding updated successfully.'
        }
      });
    }
  );

  router.get('/mine', requireAuth, async (request, response) => {
    if (!request.auth) throw new ApiError(401, 'Authentication is required.');
    const snapshot = await authService.me(request.auth);
    const rows = snapshot.companies.map((company) => ({
      ...company,
      isActive: company.id === request.auth?.tenantId
    }));
    response.json({ success: true, data: { rows, totalCount: rows.length } });
  });

  return router;
}

export function createRoleRouter(
  prisma: ZorflyPrismaClient,
  authService: AuthService,
  tokens: TokenService
): Router {
  const router = Router();
  const requireAuth = createRequireAuth(tokens);
  router.use(requireAuth);

  router.get(
    '/assignable',
    createRequirePermission(authService, 'employees:create'),
    async (request, response) => {
      const auth = principal(request);
      const custom = await prisma.tenantRole.findMany({
        where: {
          tenantId: auth.tenantId,
          isSystem: false,
          status: RecordStatus.ACTIVE,
          deletedAt: null
        },
        orderBy: [{ rank: 'desc' }, { name: 'asc' }]
      });
      response.json({
        success: true,
        data: {
          builtIn: [
            { key: roles.employee, name: 'Employee' },
            { key: roles.teamLeader, name: 'Team Leader' },
            { key: roles.hr, name: 'HR' }
          ],
          custom: custom.map((role) => ({
            key: role.key,
            name: role.name,
            description: role.description ?? ''
          }))
        }
      });
    }
  );

  router.use(requireRole(roles.companyAdmin));

  router.get('/', async (request, response) => {
    const auth = principal(request);
    const tenantRoles = await prisma.tenantRole.findMany({
      where: { tenantId: auth.tenantId, deletedAt: null },
      include: { permissions: { include: { permission: true } } },
      orderBy: [{ rank: 'desc' }, { createdAt: 'asc' }]
    });
    const byKey = new Map(tenantRoles.map((role) => [role.key, role]));
    const builtIn = builtInRoles.map((definition) => {
      const stored = byKey.get(definition.key);
      return {
        ...definition,
        permissions: definition.fixed
          ? [...permissionCatalog]
          : (stored?.permissions.map((link) => link.permission.key) ?? [
              ...defaultRolePermissions[definition.key]
            ]),
        customised: stored?.permissionsCustomized ?? false
      };
    });
    const custom = tenantRoles
      .filter((role) => !role.isSystem)
      .map((role) => ({
        id: role.id,
        key: role.key,
        name: role.name,
        description: role.description ?? '',
        rank: role.rank,
        permissions: role.permissions.map((link) => link.permission.key)
      }));
    response.json({
      success: true,
      data: { catalog: permissionCatalogView, builtIn, custom }
    });
  });

  router.post('/custom', validate(customRoleSchema), async (request, response) => {
    const auth = principal(request);
    const input = customRoleSchema.parse(request.body);
    const key = roleKey(input.key || input.name);
    if (key.length < 2) {
      throw new ApiError(422, 'A valid internal key is required.', {
        key: 'A valid internal key is required.'
      });
    }
    if (builtInRoles.some((role) => role.key === key)) {
      throw new ApiError(409, 'That key is reserved by a built-in role.', {
        key: 'That key is reserved by a built-in role.'
      });
    }
    const permissions = cleanPermissions(input.permissions);
    const role = await prisma.$transaction(async (transaction) => {
      const created = await transaction.tenantRole.create({
        data: {
          tenantId: auth.tenantId,
          key,
          name: input.name,
          description: input.description,
          rank: input.rank,
          isSystem: false,
          permissionsCustomized: true,
          status: RecordStatus.ACTIVE,
          createdById: auth.userId
        }
      });
      await setRolePermissions(transaction, auth.tenantId, created.id, permissions);
      return created;
    });
    await auditRole(authService, request, auth, 'role.custom_created', role.id);
    response.status(201).json({
      success: true,
      data: { id: role.id, key: role.key, message: 'Custom role created successfully.' }
    });
  });

  router.patch('/custom/:id', validate(updateCustomRoleSchema), async (request, response) => {
    const auth = principal(request);
    const id = z.uuid().parse(request.params.id);
    const input = updateCustomRoleSchema.parse(request.body);
    const role = await prisma.tenantRole.findFirst({
      where: { id, tenantId: auth.tenantId, isSystem: false, deletedAt: null }
    });
    if (!role) throw new ApiError(404, 'Custom role not found.');
    await prisma.$transaction(async (transaction) => {
      await transaction.tenantRole.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.rank !== undefined ? { rank: input.rank } : {}),
          updatedById: auth.userId,
          rowVersion: { increment: 1 }
        }
      });
      if (input.permissions !== undefined) {
        await setRolePermissions(
          transaction,
          auth.tenantId,
          id,
          cleanPermissions(input.permissions)
        );
      }
    });
    await auditRole(authService, request, auth, 'role.custom_updated', id);
    response.json({
      success: true,
      data: { id, message: 'Custom role updated successfully.' }
    });
  });

  router.delete('/custom/:id', async (request, response) => {
    const auth = principal(request);
    const id = z.uuid().parse(request.params.id);
    const role = await prisma.tenantRole.findFirst({
      where: { id, tenantId: auth.tenantId, isSystem: false, deletedAt: null },
      include: { _count: { select: { memberships: true } } }
    });
    if (!role) throw new ApiError(404, 'Custom role not found.');
    if (role._count.memberships > 0) {
      throw new ApiError(409, 'This role is assigned to employees and cannot be deleted.');
    }
    await prisma.tenantRole.update({
      where: { id },
      data: {
        status: RecordStatus.ARCHIVED,
        deletedAt: new Date(),
        deletedById: auth.userId,
        rowVersion: { increment: 1 }
      }
    });
    await auditRole(authService, request, auth, 'role.custom_deleted', id);
    response.json({
      success: true,
      data: { message: 'Custom role deleted successfully.' }
    });
  });

  router.put('/builtin/:key', validate(builtInPermissionsSchema), async (request, response) => {
    const auth = principal(request);
    const definition = builtInRoles.find((role) => role.key === request.params.key);
    if (!definition) throw new ApiError(404, 'Built-in role not found.');
    if (definition.fixed) {
      throw new ApiError(400, 'Company Admin permissions cannot be changed.');
    }
    const stored = await prisma.tenantRole.findUnique({
      where: { tenantId_key: { tenantId: auth.tenantId, key: definition.key } }
    });
    if (!stored) throw new ApiError(404, 'Built-in role not found.');
    const input = builtInPermissionsSchema.parse(request.body);
    await prisma.$transaction(async (transaction) => {
      await setRolePermissions(
        transaction,
        auth.tenantId,
        stored.id,
        cleanPermissions(input.permissions)
      );
      await transaction.tenantRole.update({
        where: { id: stored.id },
        data: {
          permissionsCustomized: true,
          updatedById: auth.userId,
          rowVersion: { increment: 1 }
        }
      });
    });
    await auditRole(authService, request, auth, 'role.builtin_updated', stored.id);
    response.json({
      success: true,
      data: { message: `${definition.name} permissions saved.` }
    });
  });

  router.delete('/builtin/:key', async (request, response) => {
    const auth = principal(request);
    const definition = builtInRoles.find((role) => role.key === request.params.key);
    if (!definition) throw new ApiError(404, 'Built-in role not found.');
    const stored = await prisma.tenantRole.findUnique({
      where: { tenantId_key: { tenantId: auth.tenantId, key: definition.key } }
    });
    if (!stored) throw new ApiError(404, 'Built-in role not found.');
    await prisma.$transaction(async (transaction) => {
      await setRolePermissions(transaction, auth.tenantId, stored.id, [
        ...defaultRolePermissions[definition.key]
      ]);
      await transaction.tenantRole.update({
        where: { id: stored.id },
        data: {
          permissionsCustomized: false,
          updatedById: auth.userId,
          rowVersion: { increment: 1 }
        }
      });
    });
    await auditRole(authService, request, auth, 'role.builtin_reverted', stored.id);
    response.json({
      success: true,
      data: { message: `${definition.name} reverted to defaults.` }
    });
  });

  return router;
}

async function setRolePermissions(
  transaction: Prisma.TransactionClient,
  tenantId: string,
  roleId: string,
  permissions: readonly string[]
): Promise<void> {
  const rows = await transaction.permission.findMany({
    where: { key: { in: [...permissions] } },
    select: { id: true }
  });
  await transaction.tenantRolePermission.deleteMany({ where: { roleId, tenantId } });
  if (rows.length > 0) {
    await transaction.tenantRolePermission.createMany({
      data: rows.map((permission) => ({
        tenantId,
        roleId,
        permissionId: permission.id
      }))
    });
  }
}

async function auditRole(
  service: AuthService,
  request: Request,
  auth: SessionPrincipal & { tenantId: string },
  action: string,
  roleId: string
): Promise<void> {
  await service.recordAudit(
    {
      action,
      actorUserId: auth.userId,
      tenantId: auth.tenantId,
      entityType: 'tenant_role',
      entityId: roleId
    },
    requestContext(request)
  );
}

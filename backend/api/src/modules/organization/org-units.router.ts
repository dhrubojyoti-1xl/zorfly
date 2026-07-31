import { Router, type Request } from 'express';
import { z } from 'zod';
import { MembershipStatus, RecordStatus, type ZorflyPrismaClient } from '@zorfly/database';
import { ApiError } from '../../platform/api-error.js';
import { validate } from '../../platform/validate.js';
import { createRequireAuth, createRequirePermission } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { RequestContext, SessionPrincipal } from '../auth/auth.types.js';
import type { TokenService } from '../auth/tokens.js';

const pageSizes = [10, 20, 50, 100];
const nameField = (label: string) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(2, `${label} must be at least 2 characters.`)
    .max(100, `${label} must not exceed 100 characters.`);
const departmentSchema = z.object({ name: nameField('Department Name') });
const branchSchema = z.object({ name: nameField('Branch Name') });
const optionalUuid = z.uuid('Invalid value.').optional().nullable();
const teamSchema = z.object({
  name: nameField('Team Name'),
  departmentId: optionalUuid,
  branchId: optionalUuid,
  leaderUserId: optionalUuid
});

function principal(request: Request): SessionPrincipal & { tenantId: string } {
  if (!request.auth?.tenantId) throw new ApiError(401, 'Authentication is required.');
  return { ...request.auth, tenantId: request.auth.tenantId };
}

function context(request: Request): RequestContext {
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

function queryString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function listQuery(request: Request, sortable: readonly string[]) {
  const page = Math.max(1, Number.parseInt(queryString(request.query.page), 10) || 1);
  const requestedLimit = Number.parseInt(queryString(request.query.limit), 10) || 10;
  const limit = pageSizes.includes(requestedLimit) ? requestedLimit : 10;
  const search = queryString(request.query.search).trim();
  const requestedSort = queryString(request.query.sortBy);
  const sortBy = sortable.includes(requestedSort) ? requestedSort : 'createdAt';
  const sortDir = request.query.sortDir === 'asc' ? 'asc' : 'desc';
  return { page, limit, skip: (page - 1) * limit, search, sortBy, sortDir } as const;
}

function baseCode(name: string): string {
  return (
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 32) || 'ORG'
  );
}

async function uniqueCode(
  prisma: ZorflyPrismaClient,
  kind: 'department' | 'branch' | 'team',
  tenantId: string,
  name: string,
  excludingId?: string
): Promise<string> {
  const base = baseCode(name);
  let code = base;
  let suffix = 1;
  const exists = async () => {
    const where = {
      tenantId,
      code,
      ...(excludingId ? { id: { not: excludingId } } : {})
    };
    if (kind === 'department') {
      return prisma.department.findFirst({ where, select: { id: true } });
    }
    if (kind === 'branch') {
      return prisma.branch.findFirst({ where, select: { id: true } });
    }
    return prisma.team.findFirst({ where, select: { id: true } });
  };
  while (await exists()) {
    suffix += 1;
    code = `${base.slice(0, 27)}_${String(suffix)}`;
  }
  return code;
}

async function audit(
  service: AuthService,
  request: Request,
  auth: SessionPrincipal & { tenantId: string },
  action: string,
  entityType: string,
  entityId: string
): Promise<void> {
  await service.recordAudit(
    {
      action,
      actorUserId: auth.userId,
      tenantId: auth.tenantId,
      entityType,
      entityId
    },
    context(request)
  );
}

export function createDepartmentRouter(
  prisma: ZorflyPrismaClient,
  service: AuthService,
  tokens: TokenService
): Router {
  const router = Router();
  router.use(createRequireAuth(tokens));

  router.get('/', async (request, response) => {
    const auth = principal(request);
    const query = listQuery(request, ['name', 'createdAt']);
    const where = {
      tenantId: auth.tenantId,
      status: RecordStatus.ACTIVE,
      deletedAt: null,
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {})
    };
    const [rows, totalCount] = await prisma.$transaction([
      prisma.department.findMany({
        where,
        orderBy: { [query.sortBy]: query.sortDir },
        skip: query.skip,
        take: query.limit
      }),
      prisma.department.count({ where })
    ]);
    response.json({
      success: true,
      data: {
        rows: rows.map((department) => ({
          id: department.id,
          name: department.name,
          createdAt: department.createdAt
        })),
        totalCount
      }
    });
  });

  router.post(
    '/',
    createRequirePermission(service, 'departments:manage'),
    validate(departmentSchema),
    async (request, response) => {
      const auth = principal(request);
      const input = departmentSchema.parse(request.body);
      const duplicate = await prisma.department.findFirst({
        where: {
          tenantId: auth.tenantId,
          name: { equals: input.name, mode: 'insensitive' },
          deletedAt: null
        }
      });
      if (duplicate) {
        throw new ApiError(409, 'A department with this name already exists.', {
          name: 'A department with this name already exists.'
        });
      }
      const department = await prisma.department.create({
        data: {
          tenantId: auth.tenantId,
          code: await uniqueCode(prisma, 'department', auth.tenantId, input.name),
          name: input.name,
          status: RecordStatus.ACTIVE,
          createdById: auth.userId
        }
      });
      await audit(service, request, auth, 'department.created', 'department', department.id);
      response.status(201).json({
        success: true,
        data: {
          id: department.id,
          name: department.name,
          createdAt: department.createdAt,
          message: 'Department created successfully.'
        }
      });
    }
  );

  router.delete(
    '/:id',
    createRequirePermission(service, 'departments:manage'),
    async (request, response) => {
      const auth = principal(request);
      const id = z.uuid().parse(request.params.id);
      const department = await prisma.department.findFirst({
        where: { id, tenantId: auth.tenantId, deletedAt: null },
        include: { _count: { select: { memberships: true, teams: true } } }
      });
      if (!department) throw new ApiError(404, 'The requested department was not found.');
      if (department._count.memberships > 0 || department._count.teams > 0) {
        throw new ApiError(
          409,
          'This department still has employees or teams and cannot be deleted.'
        );
      }
      await prisma.department.update({
        where: { id },
        data: {
          status: RecordStatus.ARCHIVED,
          deletedAt: new Date(),
          deletedById: auth.userId,
          rowVersion: { increment: 1 }
        }
      });
      await audit(service, request, auth, 'department.deleted', 'department', id);
      response.json({
        success: true,
        data: { id, message: 'Department deleted successfully.' }
      });
    }
  );
  return router;
}

export function createBranchRouter(
  prisma: ZorflyPrismaClient,
  service: AuthService,
  tokens: TokenService
): Router {
  const router = Router();
  router.use(createRequireAuth(tokens));

  router.get('/', createRequirePermission(service, 'branches:read'), async (request, response) => {
    const auth = principal(request);
    const query = listQuery(request, ['name', 'createdAt']);
    const where = {
      tenantId: auth.tenantId,
      status: RecordStatus.ACTIVE,
      deletedAt: null,
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {})
    };
    const [rows, totalCount] = await prisma.$transaction([
      prisma.branch.findMany({
        where,
        orderBy: { [query.sortBy]: query.sortDir },
        skip: query.skip,
        take: query.limit
      }),
      prisma.branch.count({ where })
    ]);
    response.json({
      success: true,
      data: { rows: rows.map((branch) => ({ id: branch.id, name: branch.name })), totalCount }
    });
  });

  router.post(
    '/',
    createRequirePermission(service, 'branches:manage'),
    validate(branchSchema),
    async (request, response) => {
      const auth = principal(request);
      const input = branchSchema.parse(request.body);
      if (
        await prisma.branch.findFirst({
          where: {
            tenantId: auth.tenantId,
            name: { equals: input.name, mode: 'insensitive' },
            deletedAt: null
          }
        })
      ) {
        throw new ApiError(409, 'A branch with this name already exists.');
      }
      const branch = await prisma.branch.create({
        data: {
          tenantId: auth.tenantId,
          code: await uniqueCode(prisma, 'branch', auth.tenantId, input.name),
          name: input.name,
          status: RecordStatus.ACTIVE,
          createdById: auth.userId
        }
      });
      await audit(service, request, auth, 'branch.created', 'branch', branch.id);
      response.status(201).json({
        success: true,
        data: { id: branch.id, name: branch.name, message: 'Branch created successfully.' }
      });
    }
  );

  router.delete(
    '/:id',
    createRequirePermission(service, 'branches:manage'),
    async (request, response) => {
      const auth = principal(request);
      const id = z.uuid().parse(request.params.id);
      const branch = await prisma.branch.findFirst({
        where: { id, tenantId: auth.tenantId, deletedAt: null },
        include: { _count: { select: { departments: true, memberships: true, teams: true } } }
      });
      if (!branch) throw new ApiError(404, 'The requested branch was not found.');
      if (
        branch._count.departments > 0 ||
        branch._count.memberships > 0 ||
        branch._count.teams > 0
      ) {
        throw new ApiError(
          409,
          'This branch still has departments, teams, or employees and cannot be deleted.'
        );
      }
      await prisma.branch.update({
        where: { id },
        data: {
          status: RecordStatus.ARCHIVED,
          deletedAt: new Date(),
          deletedById: auth.userId,
          rowVersion: { increment: 1 }
        }
      });
      await audit(service, request, auth, 'branch.deleted', 'branch', id);
      response.json({
        success: true,
        data: { message: 'Branch deleted successfully.' }
      });
    }
  );
  return router;
}

export function createTeamRouter(
  prisma: ZorflyPrismaClient,
  service: AuthService,
  tokens: TokenService
): Router {
  const router = Router();
  router.use(createRequireAuth(tokens));

  router.get('/', createRequirePermission(service, 'teams:read'), async (request, response) => {
    const auth = principal(request);
    const query = listQuery(request, ['name', 'createdAt']);
    const where = {
      tenantId: auth.tenantId,
      status: RecordStatus.ACTIVE,
      deletedAt: null,
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
      ...(auth.role === 'team_leader'
        ? {
            memberships: {
              some: {
                isLead: true,
                endsAt: null,
                membership: { userId: auth.userId, status: MembershipStatus.ACTIVE }
              }
            }
          }
        : {})
    };
    const [rows, totalCount] = await prisma.$transaction([
      prisma.team.findMany({
        where,
        include: {
          department: true,
          branch: true,
          memberships: {
            where: { isLead: true, endsAt: null },
            include: { membership: true },
            take: 1
          }
        },
        orderBy: { [query.sortBy]: query.sortDir },
        skip: query.skip,
        take: query.limit
      }),
      prisma.team.count({ where })
    ]);
    response.json({
      success: true,
      data: {
        rows: rows.map((team) => ({
          id: team.id,
          name: team.name,
          department: team.department?.name ?? '',
          branch: team.branch?.name ?? '',
          leaderUserId: team.memberships[0]?.membership.userId ?? null
        })),
        totalCount
      }
    });
  });

  router.post(
    '/',
    createRequirePermission(service, 'teams:manage'),
    validate(teamSchema),
    async (request, response) => {
      const auth = principal(request);
      const input = teamSchema.parse(request.body);
      await validateTeamReferences(prisma, auth.tenantId, input);
      if (
        await prisma.team.findFirst({
          where: {
            tenantId: auth.tenantId,
            name: { equals: input.name, mode: 'insensitive' },
            deletedAt: null
          }
        })
      ) {
        throw new ApiError(409, 'A team with this name already exists.');
      }
      const team = await prisma.$transaction(async (transaction) => {
        const created = await transaction.team.create({
          data: {
            tenantId: auth.tenantId,
            code: await uniqueCode(prisma, 'team', auth.tenantId, input.name),
            name: input.name,
            departmentId: input.departmentId ?? null,
            branchId: input.branchId ?? null,
            status: RecordStatus.ACTIVE,
            createdById: auth.userId
          }
        });
        if (input.leaderUserId) {
          const leader = await transaction.tenantMembership.findUniqueOrThrow({
            where: {
              tenantId_userId: { tenantId: auth.tenantId, userId: input.leaderUserId }
            }
          });
          await transaction.teamMembership.create({
            data: {
              tenantId: auth.tenantId,
              teamId: created.id,
              membershipId: leader.id,
              isLead: true
            }
          });
        }
        return created;
      });
      await audit(service, request, auth, 'team.created', 'team', team.id);
      response.status(201).json({
        success: true,
        data: { id: team.id, name: team.name, message: 'Team created successfully.' }
      });
    }
  );

  router.patch(
    '/:id',
    createRequirePermission(service, 'teams:manage'),
    validate(teamSchema.partial()),
    async (request, response) => {
      const auth = principal(request);
      const id = z.uuid().parse(request.params.id);
      const input = teamSchema.partial().parse(request.body);
      await validateTeamReferences(prisma, auth.tenantId, input);
      const existing = await prisma.team.findFirst({
        where: { id, tenantId: auth.tenantId, deletedAt: null }
      });
      if (!existing) throw new ApiError(404, 'The requested team was not found.');
      await prisma.$transaction(async (transaction) => {
        await transaction.team.update({
          where: { id },
          data: {
            ...(input.name !== undefined
              ? {
                  name: input.name,
                  code: await uniqueCode(prisma, 'team', auth.tenantId, input.name, id)
                }
              : {}),
            ...(input.departmentId !== undefined ? { departmentId: input.departmentId } : {}),
            ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
            updatedById: auth.userId,
            rowVersion: { increment: 1 }
          }
        });
        if (input.leaderUserId !== undefined) {
          await transaction.teamMembership.updateMany({
            where: { teamId: id, isLead: true, endsAt: null },
            data: { isLead: false }
          });
          if (input.leaderUserId) {
            const leader = await transaction.tenantMembership.findUniqueOrThrow({
              where: {
                tenantId_userId: {
                  tenantId: auth.tenantId,
                  userId: input.leaderUserId
                }
              }
            });
            await transaction.teamMembership.upsert({
              where: { teamId_membershipId: { teamId: id, membershipId: leader.id } },
              create: {
                tenantId: auth.tenantId,
                teamId: id,
                membershipId: leader.id,
                isLead: true
              },
              update: { isLead: true, endsAt: null }
            });
          }
        }
      });
      await audit(service, request, auth, 'team.updated', 'team', id);
      response.json({ success: true, data: { id, message: 'Team updated successfully.' } });
    }
  );

  router.delete(
    '/:id',
    createRequirePermission(service, 'teams:manage'),
    async (request, response) => {
      const auth = principal(request);
      const id = z.uuid().parse(request.params.id);
      const team = await prisma.team.findFirst({
        where: { id, tenantId: auth.tenantId, deletedAt: null },
        include: { _count: { select: { memberships: true } } }
      });
      if (!team) throw new ApiError(404, 'The requested team was not found.');
      if (team._count.memberships > 0) {
        throw new ApiError(409, 'This team still has employees and cannot be deleted.');
      }
      await prisma.team.update({
        where: { id },
        data: {
          status: RecordStatus.ARCHIVED,
          deletedAt: new Date(),
          deletedById: auth.userId,
          rowVersion: { increment: 1 }
        }
      });
      await audit(service, request, auth, 'team.deleted', 'team', id);
      response.json({ success: true, data: { message: 'Team deleted successfully.' } });
    }
  );
  return router;
}

async function validateTeamReferences(
  prisma: ZorflyPrismaClient,
  tenantId: string,
  input: {
    departmentId?: string | null | undefined;
    branchId?: string | null | undefined;
    leaderUserId?: string | null | undefined;
  }
): Promise<void> {
  if (
    input.departmentId &&
    !(await prisma.department.findFirst({
      where: { id: input.departmentId, tenantId, status: RecordStatus.ACTIVE, deletedAt: null }
    }))
  ) {
    throw new ApiError(422, 'Invalid value.', { departmentId: 'Invalid value.' });
  }
  if (
    input.branchId &&
    !(await prisma.branch.findFirst({
      where: { id: input.branchId, tenantId, status: RecordStatus.ACTIVE, deletedAt: null }
    }))
  ) {
    throw new ApiError(422, 'Invalid value.', { branchId: 'Invalid value.' });
  }
  if (
    input.leaderUserId &&
    !(await prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId, userId: input.leaderUserId } }
    }))
  ) {
    throw new ApiError(422, 'Invalid value.', { leaderUserId: 'Invalid value.' });
  }
}

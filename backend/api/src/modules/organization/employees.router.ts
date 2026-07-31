import { randomBytes } from 'node:crypto';
import { Router, type Request } from 'express';
import { z } from 'zod';
import {
  MembershipStatus,
  RecordStatus,
  SubscriptionStatus,
  UserStatus,
  type ZorflyPrismaClient
} from '@zorfly/database';
import { roles } from '../../domain/access-control.js';
import { ApiError } from '../../platform/api-error.js';
import { validate } from '../../platform/validate.js';
import { createRequireAuth, createRequirePermission } from '../auth/auth.middleware.js';
import { passwordHasher } from '../auth/password.js';
import type { AuthService } from '../auth/auth.service.js';
import type { RequestContext, SessionPrincipal } from '../auth/auth.types.js';
import type { TokenService } from '../auth/tokens.js';

const difficultyLevels = [
  'fresher',
  'junior',
  'mid_level',
  'senior',
  'team_lead',
  'manager',
  'hod',
  'cxo'
] as const;
const uuid = z.uuid('Invalid value.');
const optionalUuid = uuid.optional().nullable();
const createEmployeeSchema = z.object({
  fullName: z
    .string({ error: 'Full Name is required.' })
    .trim()
    .min(2, 'Full Name must be at least 2 characters.')
    .max(100, 'Full Name must not exceed 100 characters.'),
  email: z
    .string({ error: 'Email ID is required.' })
    .trim()
    .email('Enter a valid Email ID.')
    .transform((value) => value.toLowerCase()),
  contactNumber: z
    .string()
    .trim()
    .regex(/^\d{10,15}$/, 'Enter a valid Contact Number.')
    .optional()
    .or(z.literal('')),
  role: z.string({ error: 'Role is required.' }).trim().min(1, 'Role is required.'),
  departmentId: optionalUuid,
  teamId: optionalUuid,
  branchId: optionalUuid,
  difficultyLevel: z.enum(difficultyLevels).default('fresher')
});
const updateEmployeeSchema = createEmployeeSchema
  .omit({ email: true })
  .partial()
  .extend({ status: z.enum(['active', 'suspended']).optional() });

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

function pagination(request: Request) {
  const page = Math.max(1, Number.parseInt(queryString(request.query.page), 10) || 1);
  const requestedLimit = Number.parseInt(queryString(request.query.limit), 10) || 10;
  const limit = [10, 20, 50, 100].includes(requestedLimit) ? requestedLimit : 10;
  return { page, limit, skip: (page - 1) * limit };
}

async function assignableRole(prisma: ZorflyPrismaClient, tenantId: string, key: string) {
  if ([roles.employee, roles.teamLeader, roles.hr].includes(key as never)) {
    return prisma.tenantRole.findFirst({
      where: { tenantId, key, status: RecordStatus.ACTIVE, deletedAt: null }
    });
  }
  return prisma.tenantRole.findFirst({
    where: {
      tenantId,
      key,
      isSystem: false,
      status: RecordStatus.ACTIVE,
      deletedAt: null
    }
  });
}

async function validateReferences(
  prisma: ZorflyPrismaClient,
  tenantId: string,
  input: {
    departmentId?: string | null | undefined;
    teamId?: string | null | undefined;
    branchId?: string | null | undefined;
  }
): Promise<void> {
  const checks = await Promise.all([
    input.departmentId
      ? prisma.department.findFirst({
          where: {
            id: input.departmentId,
            tenantId,
            status: RecordStatus.ACTIVE,
            deletedAt: null
          }
        })
      : true,
    input.teamId
      ? prisma.team.findFirst({
          where: { id: input.teamId, tenantId, status: RecordStatus.ACTIVE, deletedAt: null }
        })
      : true,
    input.branchId
      ? prisma.branch.findFirst({
          where: { id: input.branchId, tenantId, status: RecordStatus.ACTIVE, deletedAt: null }
        })
      : true
  ]);
  if (!checks[0]) throw new ApiError(422, 'Invalid value.', { departmentId: 'Invalid value.' });
  if (!checks[1]) throw new ApiError(422, 'Invalid value.', { teamId: 'Invalid value.' });
  if (!checks[2]) throw new ApiError(422, 'Invalid value.', { branchId: 'Invalid value.' });
}

async function enforceEmployeeLimit(prisma: ZorflyPrismaClient, tenantId: string): Promise<void> {
  const subscription = await prisma.tenantSubscription.findFirst({
    where: {
      tenantId,
      status: { in: [SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE] }
    },
    include: { plan: { include: { entitlements: true } } },
    orderBy: { createdAt: 'desc' }
  });
  const entitlement = subscription?.plan.entitlements.find((candidate) =>
    ['employees', 'employees.max', 'max_employees'].includes(candidate.featureKey)
  );
  if (!entitlement?.enabled || entitlement.limitValue === null) return;
  const count = await prisma.tenantMembership.count({
    where: { tenantId, status: MembershipStatus.ACTIVE, deletedAt: null }
  });
  if (BigInt(count) >= entitlement.limitValue) {
    throw new ApiError(
      422,
      `Your ${subscription?.plan.name ?? 'current'} plan employee limit has been reached. Upgrade your plan to add more employees.`
    );
  }
}

export function createEmployeeRouter(
  prisma: ZorflyPrismaClient,
  service: AuthService,
  tokens: TokenService
): Router {
  const router = Router();
  router.use(createRequireAuth(tokens));

  router.get('/', createRequirePermission(service, 'employees:read'), async (request, response) => {
    const auth = principal(request);
    const { page, limit, skip } = pagination(request);
    const search = queryString(request.query.search).trim();
    const requestedStatus = queryString(request.query.status, 'active').toLowerCase();
    const status =
      requestedStatus === 'suspended' ? MembershipStatus.SUSPENDED : MembershipStatus.ACTIVE;
    let ledTeamIds: string[] | undefined;
    if (auth.role === roles.teamLeader) {
      const ledTeams = await prisma.teamMembership.findMany({
        where: {
          tenantId: auth.tenantId,
          isLead: true,
          endsAt: null,
          membership: { userId: auth.userId, status: MembershipStatus.ACTIVE }
        },
        select: { teamId: true }
      });
      ledTeamIds = ledTeams.map((team) => team.teamId);
    }
    const where = {
      tenantId: auth.tenantId,
      status,
      deletedAt: null,
      ...(search
        ? {
            user: {
              OR: [
                { displayName: { contains: search, mode: 'insensitive' as const } },
                { emailCanonical: { contains: search, mode: 'insensitive' as const } }
              ]
            }
          }
        : {}),
      ...(request.query.departmentId
        ? { departmentId: queryString(request.query.departmentId) }
        : {}),
      ...(request.query.difficultyLevel
        ? { employmentLevel: queryString(request.query.difficultyLevel) }
        : {}),
      ...(request.query.teamId || ledTeamIds
        ? {
            teams: {
              some: {
                endsAt: null,
                teamId: ledTeamIds ? { in: ledTeamIds } : queryString(request.query.teamId)
              }
            }
          }
        : {})
    };
    const orderBy =
      request.query.sortBy === 'fullName'
        ? {
            user: {
              displayName: request.query.sortDir === 'asc' ? ('asc' as const) : ('desc' as const)
            }
          }
        : { createdAt: request.query.sortDir === 'asc' ? ('asc' as const) : ('desc' as const) };
    const [rows, totalCount] = await prisma.$transaction([
      prisma.tenantMembership.findMany({
        where,
        include: {
          user: true,
          department: true,
          branch: true,
          teams: { where: { endsAt: null }, include: { team: true }, take: 1 },
          roles: {
            where: { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
            include: { role: true },
            take: 1
          }
        },
        orderBy,
        skip,
        take: limit
      }),
      prisma.tenantMembership.count({ where })
    ]);
    response.json({
      success: true,
      data: {
        rows: rows.map((membership) => ({
          id: membership.id,
          userId: membership.userId,
          fullName: membership.user.displayName ?? '',
          email: membership.user.emailCanonical,
          contactNumber: membership.user.contactNumber ?? '',
          department: membership.department?.name ?? '',
          team: membership.teams[0]?.team.name ?? '',
          branch: membership.branch?.name ?? '',
          departmentId: membership.departmentId,
          teamId: membership.teams[0]?.teamId ?? null,
          branchId: membership.branchId,
          difficultyLevel: membership.employmentLevel ?? 'fresher',
          role: membership.roles[0]?.role.key ?? roles.employee,
          status: membership.status.toLowerCase()
        })),
        totalCount,
        page,
        limit
      }
    });
  });

  router.post(
    '/',
    createRequirePermission(service, 'employees:create'),
    validate(createEmployeeSchema),
    async (request, response) => {
      const auth = principal(request);
      const input = createEmployeeSchema.parse(request.body);
      const role = await assignableRole(prisma, auth.tenantId, input.role);
      if (!role) throw new ApiError(422, 'Select a valid role.', { role: 'Select a valid role.' });
      await Promise.all([
        validateReferences(prisma, auth.tenantId, input),
        enforceEmployeeLimit(prisma, auth.tenantId)
      ]);

      const existingUser = await prisma.user.findUnique({
        where: { emailCanonical: input.email },
        include: { memberships: { where: { tenantId: auth.tenantId }, take: 1 } }
      });
      if (existingUser?.memberships.length) {
        throw new ApiError(409, 'This Email ID is already an employee of this company.', {
          email: 'This Email ID is already an employee of this company.'
        });
      }
      const temporaryPassword = existingUser ? null : `Zf@${randomBytes(6).toString('base64url')}`;
      const created = await prisma.$transaction(async (transaction) => {
        const user =
          existingUser ??
          (await transaction.user.create({
            data: {
              emailCanonical: input.email,
              displayName: input.fullName,
              contactNumber: input.contactNumber || null,
              status: UserStatus.ACTIVE,
              credential: {
                create: { passwordHash: await passwordHasher.hash(temporaryPassword ?? '') }
              }
            }
          }));
        const membership = await transaction.tenantMembership.create({
          data: {
            tenantId: auth.tenantId,
            userId: user.id,
            departmentId: input.departmentId ?? null,
            branchId: input.branchId ?? null,
            employmentLevel: input.difficultyLevel,
            status: MembershipStatus.ACTIVE,
            joinedAt: new Date(),
            createdById: auth.userId,
            roles: {
              create: {
                tenantId: auth.tenantId,
                roleId: role.id,
                grantedById: auth.userId
              }
            },
            ...(input.teamId
              ? {
                  teams: {
                    create: { tenantId: auth.tenantId, teamId: input.teamId }
                  }
                }
              : {})
          }
        });
        return { membership, user };
      });
      await service.recordAudit(
        {
          action: 'employee.created',
          actorUserId: auth.userId,
          tenantId: auth.tenantId,
          entityType: 'tenant_membership',
          entityId: created.membership.id,
          metadata: { email: input.email, role: input.role }
        },
        context(request)
      );
      const company = await prisma.tenant.findUnique({ where: { id: auth.tenantId } });
      service.sendNotification({
        to: input.email,
        subject: `You have been added to ${company?.name ?? 'Zorfly'}`,
        html: `<p>Hello ${input.fullName}, you have been added as ${input.role.replaceAll('_', ' ')}.</p>${temporaryPassword ? `<p>Your temporary password is <strong>${temporaryPassword}</strong>.</p>` : ''}`,
        type: 'employee_added',
        tenantId: auth.tenantId
      });
      response.status(201).json({
        success: true,
        data: {
          id: created.membership.id,
          fullName: input.fullName,
          email: input.email,
          role: input.role,
          temporaryPassword,
          message: 'Employee added successfully.'
        }
      });
    }
  );

  router.patch(
    '/:id',
    createRequirePermission(service, 'employees:update'),
    validate(updateEmployeeSchema),
    async (request, response) => {
      const auth = principal(request);
      const id = uuid.parse(request.params.id);
      const input = updateEmployeeSchema.parse(request.body);
      const existing = await prisma.tenantMembership.findFirst({
        where: { id, tenantId: auth.tenantId, deletedAt: null },
        include: { user: true }
      });
      if (!existing) throw new ApiError(404, 'The requested employee was not found.');
      const role = input.role ? await assignableRole(prisma, auth.tenantId, input.role) : undefined;
      if (input.role && !role) {
        throw new ApiError(422, 'Select a valid role.', { role: 'Select a valid role.' });
      }
      await validateReferences(prisma, auth.tenantId, input);
      await prisma.$transaction(async (transaction) => {
        if (input.fullName !== undefined || input.contactNumber !== undefined) {
          await transaction.user.update({
            where: { id: existing.userId },
            data: {
              ...(input.fullName !== undefined ? { displayName: input.fullName } : {}),
              ...(input.contactNumber !== undefined
                ? { contactNumber: input.contactNumber || null }
                : {}),
              rowVersion: { increment: 1 }
            }
          });
        }
        await transaction.tenantMembership.update({
          where: { id },
          data: {
            ...(input.departmentId !== undefined ? { departmentId: input.departmentId } : {}),
            ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
            ...(input.difficultyLevel !== undefined
              ? { employmentLevel: input.difficultyLevel }
              : {}),
            ...(input.status !== undefined
              ? {
                  status:
                    input.status === 'active' ? MembershipStatus.ACTIVE : MembershipStatus.SUSPENDED
                }
              : {}),
            updatedById: auth.userId,
            rowVersion: { increment: 1 }
          }
        });
        if (role) {
          await transaction.membershipRole.deleteMany({ where: { membershipId: id } });
          await transaction.membershipRole.create({
            data: {
              tenantId: auth.tenantId,
              membershipId: id,
              roleId: role.id,
              grantedById: auth.userId
            }
          });
        }
        if (input.teamId !== undefined) {
          await transaction.teamMembership.updateMany({
            where: { membershipId: id, endsAt: null },
            data: { endsAt: new Date(), isLead: false }
          });
          if (input.teamId) {
            await transaction.teamMembership.upsert({
              where: { teamId_membershipId: { teamId: input.teamId, membershipId: id } },
              create: {
                tenantId: auth.tenantId,
                teamId: input.teamId,
                membershipId: id
              },
              update: { endsAt: null }
            });
          }
        }
      });
      await service.recordAudit(
        {
          action: 'employee.updated',
          actorUserId: auth.userId,
          tenantId: auth.tenantId,
          entityType: 'tenant_membership',
          entityId: id
        },
        context(request)
      );
      response.json({ success: true, data: { id, message: 'Employee updated successfully.' } });
    }
  );

  router.delete(
    '/:id',
    createRequirePermission(service, 'employees:delete'),
    async (request, response) => {
      const auth = principal(request);
      const id = uuid.parse(request.params.id);
      const employee = await prisma.tenantMembership.findFirst({
        where: { id, tenantId: auth.tenantId, deletedAt: null },
        include: { user: true }
      });
      if (!employee) throw new ApiError(404, 'The requested employee was not found.');
      if (employee.userId === auth.userId) {
        throw new ApiError(409, 'You cannot remove your own company membership.');
      }
      const now = new Date();
      await prisma.$transaction([
        prisma.teamMembership.updateMany({
          where: { membershipId: id, endsAt: null },
          data: { endsAt: now, isLead: false }
        }),
        prisma.membershipRole.deleteMany({ where: { membershipId: id } }),
        prisma.tenantMembership.update({
          where: { id },
          data: {
            status: MembershipStatus.TERMINATED,
            leftAt: now,
            deletedAt: now,
            deletedById: auth.userId,
            rowVersion: { increment: 1 }
          }
        })
      ]);
      await service.recordAudit(
        {
          action: 'employee.removed',
          actorUserId: auth.userId,
          tenantId: auth.tenantId,
          entityType: 'tenant_membership',
          entityId: id,
          metadata: { email: employee.user.emailCanonical }
        },
        context(request)
      );
      response.json({ success: true, data: { message: 'Employee removed successfully.' } });
    }
  );

  return router;
}

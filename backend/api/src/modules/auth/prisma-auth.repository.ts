import { createHash, createHmac, randomBytes } from 'node:crypto';
import {
  AuditActorType,
  AuditOutcome,
  MembershipStatus,
  RecordStatus,
  SubscriptionStatus,
  TenantStatus,
  UserStatus,
  type Prisma,
  type ZorflyPrismaClient
} from '@zorfly/database';
import {
  defaultRolePermissions,
  permissionCatalog,
  roles,
  type TenantRoleKey
} from '../../domain/access-control.js';
import type {
  ActiveSession,
  AuthRepository,
  AuthUser,
  CompanyMembership,
  PublicCompany,
  PublicUser,
  RegistrationCommand,
  RequestContext,
  SessionPrincipal
} from './auth.types.js';

const roleDefinitions: ReadonlyArray<{ key: TenantRoleKey; name: string; isSystem: boolean }> = [
  { key: roles.companyAdmin, name: 'Company Admin', isSystem: true },
  { key: roles.hr, name: 'HR', isSystem: true },
  { key: roles.teamLeader, name: 'Team Leader', isSystem: true },
  { key: roles.employee, name: 'Employee', isSystem: true }
];

const templateCategories = [
  'Content Writing',
  'Graphic Design',
  'Video Editing',
  'Digital Marketing',
  'Website Team',
  'Quality Assurance',
  'Senior Management'
] as const;

const difficultyLevels = [
  'Fresher',
  'Junior',
  'Mid-Level',
  'Senior',
  'Team Lead',
  'Manager',
  'Head of Department',
  'CEO / CXO'
] as const;

const defaultBadges = [
  ['FIRST_ASSESSMENT', 'First Assessment'],
  ['PERFECT_SCORE', 'Perfect Score'],
  ['LEARNING_STREAK', 'Learning Streak'],
  ['QUALITY_CHAMPION', 'Quality Champion']
] as const;

type UserWithAuth = Prisma.UserGetPayload<{
  include: {
    credential: true;
    platformRoles: { include: { role: true } };
  };
}>;

type MembershipWithCompanyAndRoles = Prisma.TenantMembershipGetPayload<{
  include: {
    tenant: { include: { branding: true } };
    roles: { include: { role: true } };
  };
}>;

function codeFromName(name: string, fallback: string): string {
  return (
    name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60) || fallback
  );
}

function slugFromName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'company'
  );
}

function publicUser(user: UserWithAuth): AuthUser {
  const platformRole =
    user.platformRoles.find(
      (assignment) => !assignment.expiresAt || assignment.expiresAt > new Date()
    )?.role.key ?? (user.isPlatformOperator ? roles.masterAdmin : null);
  return {
    id: user.id,
    fullName: user.displayName ?? '',
    email: user.emailCanonical,
    contactNumber: user.contactNumber ?? '',
    platformRole,
    status: user.status,
    passwordHash: user.credential?.deletedAt ? null : (user.credential?.passwordHash ?? null)
  };
}

function companyFromMembership(membership: MembershipWithCompanyAndRoles): PublicCompany {
  return {
    id: membership.tenant.id,
    name: membership.tenant.name,
    slug: membership.tenant.slug,
    logoUrl: '',
    timeZone: membership.tenant.timeZone
  };
}

function activeRole(membership: MembershipWithCompanyAndRoles): string | null {
  const now = new Date();
  return (
    membership.roles.find(
      (assignment) =>
        (!assignment.expiresAt || assignment.expiresAt > now) &&
        assignment.role.status === RecordStatus.ACTIVE &&
        !assignment.role.deletedAt
    )?.role.key ?? null
  );
}

function mappedMembership(membership: MembershipWithCompanyAndRoles): CompanyMembership | null {
  const role = activeRole(membership);
  if (!role) return null;
  return {
    membershipId: membership.id,
    userId: membership.userId,
    company: companyFromMembership(membership),
    role
  };
}

export class PrismaAuthRepository implements AuthRepository {
  public constructor(
    private readonly prisma: ZorflyPrismaClient,
    private readonly piiHashKey: string
  ) {}

  public async findUserByEmail(email: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { emailCanonical: email },
      include: { credential: true, platformRoles: { include: { role: true } } }
    });
    return user && !user.deletedAt ? publicUser(user) : null;
  }

  public async findUserById(userId: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { credential: true, platformRoles: { include: { role: true } } }
    });
    return user && !user.deletedAt ? publicUser(user) : null;
  }

  public async registerTenant(command: RegistrationCommand): Promise<CompanyMembership> {
    const slug = await this.uniqueSlug(command.companyName);
    const tenantCode = `${codeFromName(command.companyName, 'COMPANY').slice(0, 28)}_${randomBytes(4).toString('hex').toUpperCase()}`;
    const now = new Date();

    return this.prisma.$transaction(async (transaction) => {
      const user = command.existingUserId
        ? await transaction.user.findUniqueOrThrow({ where: { id: command.existingUserId } })
        : await transaction.user.create({
            data: {
              emailCanonical: command.email,
              displayName: command.fullName,
              contactNumber: command.contactNumber || null,
              status: UserStatus.ACTIVE,
              credential: {
                create: {
                  passwordHash: command.passwordHash ?? ''
                }
              }
            }
          });

      const tenant = await transaction.tenant.create({
        data: {
          code: tenantCode,
          slug,
          name: command.companyName,
          status: TenantStatus.ACTIVE,
          timeZone: 'Asia/Kolkata',
          createdById: user.id,
          settings: {
            country: command.country || 'IN',
            referralCode: command.referralCode || null
          }
        }
      });

      const permissions = await Promise.all(
        permissionCatalog.map((key) =>
          transaction.permission.upsert({
            where: { key },
            create: { key, description: key, riskLevel: key.includes('delete') ? 3 : 1 },
            update: {}
          })
        )
      );
      const permissionIdByKey = new Map(
        permissions.map((permission) => [permission.key, permission.id])
      );

      const createdRoles = new Map<string, string>();
      for (const definition of roleDefinitions) {
        const role = await transaction.tenantRole.create({
          data: {
            tenantId: tenant.id,
            key: definition.key,
            name: definition.name,
            isSystem: definition.isSystem,
            status: RecordStatus.ACTIVE,
            createdById: user.id
          }
        });
        createdRoles.set(role.key, role.id);
        await transaction.tenantRolePermission.createMany({
          data: defaultRolePermissions[definition.key].map((permissionKey) => ({
            tenantId: tenant.id,
            roleId: role.id,
            permissionId: permissionIdByKey.get(permissionKey) ?? ''
          }))
        });
      }

      const adminRoleId = createdRoles.get(roles.companyAdmin);
      if (!adminRoleId) throw new Error('Company Admin role provisioning failed.');
      const membership = await transaction.tenantMembership.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          status: MembershipStatus.ACTIVE,
          joinedAt: now,
          createdById: user.id,
          roles: {
            create: {
              tenantId: tenant.id,
              roleId: adminRoleId,
              grantedById: user.id
            }
          }
        },
        include: {
          tenant: { include: { branding: true } },
          roles: { include: { role: true } }
        }
      });

      await transaction.assessmentCategory.createMany({
        data: templateCategories.map((name, sortOrder) => ({
          tenantId: tenant.id,
          code: codeFromName(name, `CATEGORY_${sortOrder + 1}`),
          name,
          sortOrder,
          status: RecordStatus.ACTIVE,
          createdById: user.id
        }))
      });
      await transaction.difficultyLevel.createMany({
        data: difficultyLevels.map((name, index) => ({
          tenantId: tenant.id,
          code: codeFromName(name, `LEVEL_${index + 1}`),
          name,
          rank: index + 1,
          status: RecordStatus.ACTIVE,
          createdById: user.id
        }))
      });
      await transaction.badgeDefinition.createMany({
        data: defaultBadges.map(([code, name]) => ({
          tenantId: tenant.id,
          code,
          name,
          rule: { version: 1, type: code.toLowerCase() },
          status: RecordStatus.ACTIVE,
          createdById: user.id
        }))
      });

      const defaultPlan = await transaction.subscriptionPlan.findFirst({
        where: { status: RecordStatus.ACTIVE, deletedAt: null },
        orderBy: { monthlyAmount: 'asc' }
      });
      if (defaultPlan) {
        const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
        await transaction.tenantSubscription.create({
          data: {
            tenantId: tenant.id,
            planId: defaultPlan.id,
            status: SubscriptionStatus.TRIALING,
            startsAt: now,
            currentPeriodStart: now,
            currentPeriodEnd: trialEnd
          }
        });
      }

      const result = mappedMembership(membership);
      if (!result) throw new Error('Company Admin membership provisioning failed.');
      return result;
    });
  }

  public async listActiveMemberships(userId: string): Promise<CompanyMembership[]> {
    const memberships = await this.prisma.tenantMembership.findMany({
      where: {
        userId,
        status: MembershipStatus.ACTIVE,
        deletedAt: null,
        tenant: { status: TenantStatus.ACTIVE, deletedAt: null }
      },
      include: {
        tenant: { include: { branding: true } },
        roles: { include: { role: true } }
      },
      orderBy: { tenant: { name: 'asc' } }
    });
    return memberships
      .map(mappedMembership)
      .filter((membership): membership is CompanyMembership => Boolean(membership));
  }

  public async findActiveMembership(
    userId: string,
    tenantId: string
  ): Promise<CompanyMembership | null> {
    const membership = await this.prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
      include: {
        tenant: { include: { branding: true } },
        roles: { include: { role: true } }
      }
    });
    if (
      !membership ||
      membership.status !== MembershipStatus.ACTIVE ||
      membership.deletedAt ||
      membership.tenant.status !== TenantStatus.ACTIVE ||
      membership.tenant.deletedAt
    ) {
      return null;
    }
    return mappedMembership(membership);
  }

  public async markAuthenticated(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastAuthenticatedAt: new Date() }
    });
  }

  public async updateProfile(
    userId: string,
    profile: { fullName: string; contactNumber?: string }
  ): Promise<PublicUser | null> {
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing || existing.deletedAt) return null;
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: profile.fullName,
        ...(profile.contactNumber !== undefined
          ? { contactNumber: profile.contactNumber || null }
          : {}),
        rowVersion: { increment: 1 }
      },
      include: { credential: true, platformRoles: { include: { role: true } } }
    });
    return publicUser(user);
  }

  public async updatePassword(userId: string, passwordHash: string): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.userCredential.updateMany({
        where: { userId, deletedAt: null },
        data: {
          passwordHash,
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
          rowVersion: { increment: 1 }
        }
      });
      if (updated.count === 0) return false;
      await transaction.userSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'password_changed' }
      });
      return true;
    });
  }

  public async createPasswordResetToken(
    email: string,
    tokenHash: string,
    expiresAt: Date
  ): Promise<string | null> {
    const user = await this.prisma.user.findUnique({ where: { emailCanonical: email } });
    if (!user || user.status !== UserStatus.ACTIVE || user.deletedAt) return null;
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() }
      }),
      this.prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt }
      })
    ]);
    return user.id;
  }

  public async consumePasswordResetToken(
    tokenHash: string,
    passwordHash: string
  ): Promise<string | null> {
    return this.prisma.$transaction(async (transaction) => {
      const token = await transaction.passwordResetToken.findUnique({ where: { tokenHash } });
      if (!token || token.usedAt || token.expiresAt <= new Date()) return null;
      const consumed = await transaction.passwordResetToken.updateMany({
        where: { id: token.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() }
      });
      if (consumed.count !== 1) return null;
      await transaction.userCredential.update({
        where: { userId: token.userId },
        data: {
          passwordHash,
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
          rowVersion: { increment: 1 }
        }
      });
      await transaction.userSession.updateMany({
        where: { userId: token.userId, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'password_reset' }
      });
      return token.userId;
    });
  }

  public async createSession(
    principal: SessionPrincipal,
    refreshTokenHash: string,
    expiresAt: Date,
    context: RequestContext
  ): Promise<void> {
    await this.prisma.userSession.create({
      data: {
        userId: principal.userId,
        activeTenantId: principal.tenantId,
        refreshTokenHash,
        expiresAt,
        sourceIpHash: this.hashSensitive(context.ip),
        userAgentHash: this.hashSensitive(context.userAgent)
      }
    });
  }

  public async findSession(refreshTokenHash: string): Promise<ActiveSession | null> {
    const session = await this.prisma.userSession.findUnique({
      where: { refreshTokenHash },
      include: { user: { include: { platformRoles: { include: { role: true } } } } }
    });
    if (!session) return null;

    let role: string | null = null;
    if (session.activeTenantId) {
      role =
        (await this.findActiveMembership(session.userId, session.activeTenantId))?.role ?? null;
    } else {
      role =
        session.user.platformRoles.find(
          (assignment) => !assignment.expiresAt || assignment.expiresAt > new Date()
        )?.role.key ?? (session.user.isPlatformOperator ? roles.masterAdmin : null);
    }
    if (!role) return null;
    return {
      id: session.id,
      principal: {
        userId: session.userId,
        tenantId: session.activeTenantId,
        role
      },
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt
    };
  }

  public async rotateSession(
    sessionId: string,
    refreshTokenHash: string,
    expiresAt: Date,
    context: RequestContext
  ): Promise<void> {
    const result = await this.prisma.userSession.updateMany({
      where: { id: sessionId, revokedAt: null, expiresAt: { gt: new Date() } },
      data: {
        refreshTokenHash,
        expiresAt,
        lastUsedAt: new Date(),
        sourceIpHash: this.hashSensitive(context.ip),
        userAgentHash: this.hashSensitive(context.userAgent)
      }
    });
    if (result.count !== 1) throw new Error('Session rotation conflict.');
  }

  public async revokeSession(refreshTokenHash: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { refreshTokenHash, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: 'logout' }
    });
  }

  public async resolvePermissions(tenantId: string | null, role: string): Promise<string[]> {
    if (!tenantId || role === roles.masterAdmin) return [];
    if (role === roles.companyAdmin) return [...permissionCatalog];
    const tenantRole = await this.prisma.tenantRole.findUnique({
      where: { tenantId_key: { tenantId, key: role } },
      include: { permissions: { include: { permission: true } } }
    });
    if (tenantRole && !tenantRole.deletedAt && tenantRole.status === RecordStatus.ACTIVE) {
      return tenantRole.permissions.map((link) => link.permission.key);
    }
    return role in defaultRolePermissions ? [...defaultRolePermissions[role as TenantRoleKey]] : [];
  }

  public async audit(
    event: {
      action: string;
      actorUserId?: string;
      tenantId?: string;
      entityType?: string;
      entityId?: string;
      metadata?: Readonly<Record<string, unknown>>;
    },
    context: RequestContext
  ): Promise<void> {
    const occurredAt = new Date();
    const previous = await this.prisma.auditEvent.findFirst({
      where: event.tenantId ? { tenantId: event.tenantId } : { tenantId: null },
      orderBy: { id: 'desc' },
      select: { eventHash: true }
    });
    const eventMaterial = JSON.stringify({
      previousEventHash: previous?.eventHash ?? null,
      tenantId: event.tenantId ?? null,
      actorId: event.actorUserId ?? null,
      action: event.action,
      entityType: event.entityType ?? 'unknown',
      entityId: event.entityId ?? null,
      outcome: AuditOutcome.SUCCEEDED,
      requestId: context.requestId ?? null,
      occurredAt: occurredAt.toISOString(),
      metadata: event.metadata ?? null
    });
    const eventHash = createHash('sha256').update(eventMaterial).digest('hex');

    await this.prisma.auditEvent.create({
      data: {
        tenantId: event.tenantId ?? null,
        actorType: event.actorUserId ? AuditActorType.USER : AuditActorType.SYSTEM,
        actorId: event.actorUserId ?? null,
        action: event.action,
        entityType: event.entityType ?? 'unknown',
        entityId: event.entityId ?? null,
        outcome: AuditOutcome.SUCCEEDED,
        requestId: context.requestId ?? null,
        sourceIpHash: this.hashSensitive(context.ip),
        userAgentHash: this.hashSensitive(context.userAgent),
        ...(event.metadata ? { metadata: event.metadata as Prisma.InputJsonValue } : {}),
        previousEventHash: previous?.eventHash ?? null,
        eventHash,
        occurredAt
      }
    });
  }

  private hashSensitive(value: string | undefined): string | null {
    return value ? createHmac('sha256', this.piiHashKey).update(value).digest('hex') : null;
  }

  private async uniqueSlug(companyName: string): Promise<string> {
    const base = slugFromName(companyName);
    let slug = base;
    let suffix = 1;
    while (await this.prisma.tenant.findUnique({ where: { slug }, select: { id: true } })) {
      suffix += 1;
      slug = `${base}-${suffix}`;
    }
    return slug;
  }
}

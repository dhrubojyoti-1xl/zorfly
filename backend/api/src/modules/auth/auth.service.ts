import type {
  AuthMailer,
  AuthRepository,
  AuthUser,
  CompanyMembership,
  PublicCompany,
  PublicUser,
  RequestContext,
  SessionPrincipal
} from './auth.types.js';
import type { PasswordHasher } from './password.js';
import type {
  LogInInput,
  RegisterCompanyInput,
  SelectCompanyInput,
  UpdateProfileInput
} from './auth.validation.js';
import type { TokenService } from './tokens.js';
import { ApiError } from '../../platform/api-error.js';
import { roles } from '../../domain/access-control.js';

const expiredSessionMessage = 'Your session has expired. Please log in again.';
const resetRequestMessage =
  'If an account exists for that email, a password reset link has been sent.';

export interface AuthServiceOptions {
  repository: AuthRepository;
  passwordHasher: PasswordHasher;
  tokens: TokenService;
  mailer: AuthMailer;
  refreshTokenTtlSeconds: number;
  appUrl: string;
}

interface SessionResponse {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
  company: PublicCompany | null;
  role: string;
}

function activeUser(user: AuthUser | null): user is AuthUser {
  return Boolean(user && user.status === 'ACTIVE');
}

export class AuthService {
  public constructor(private readonly options: AuthServiceOptions) {}

  public async registerCompany(
    input: RegisterCompanyInput,
    context: RequestContext
  ): Promise<SessionResponse> {
    const existing = await this.options.repository.findUserByEmail(input.email);
    if (existing) {
      if (
        !existing.passwordHash ||
        !(await this.options.passwordHasher.verify(existing.passwordHash, input.password))
      ) {
        throw new ApiError(
          409,
          'An account with this Email ID already exists. Enter its password to add another company.',
          { password: 'Enter the password of your existing account.' }
        );
      }
      if (!activeUser(existing)) {
        throw new ApiError(403, 'This account is suspended. Please contact support.');
      }
    }

    const membership = await this.options.repository.registerTenant({
      ...(existing ? { existingUserId: existing.id } : {}),
      companyName: input.companyName,
      fullName: input.fullName,
      email: input.email,
      ...(input.contactNumber !== undefined ? { contactNumber: input.contactNumber } : {}),
      ...(input.country !== undefined ? { country: input.country } : {}),
      ...(input.referralCode !== undefined ? { referralCode: input.referralCode } : {}),
      ...(!existing ? { passwordHash: await this.options.passwordHasher.hash(input.password) } : {})
    });
    const user = existing ?? (await this.requireActiveUser(membership.userId));

    await this.options.repository.audit(
      {
        action: 'company.registered',
        actorUserId: user.id,
        tenantId: membership.company.id,
        entityType: 'tenant',
        entityId: membership.company.id,
        metadata: { companyName: membership.company.name, slug: membership.company.slug }
      },
      context
    );

    this.sendMail({
      to: user.email,
      subject: `Welcome to Zorfly — ${membership.company.name}`,
      html: `<p>Welcome ${user.fullName}. Your company <strong>${membership.company.name}</strong> is ready.</p>`,
      type: 'company_welcome',
      tenantId: membership.company.id
    });

    return this.issueSession(user, membership, context);
  }

  public async logIn(input: LogInInput, context: RequestContext) {
    const user = await this.options.repository.findUserByEmail(input.email);
    const invalidCredentials = new ApiError(401, 'Incorrect Email ID or Password.');
    if (!user?.passwordHash) throw invalidCredentials;
    if (!(await this.options.passwordHasher.verify(user.passwordHash, input.password))) {
      throw invalidCredentials;
    }
    if (!activeUser(user)) {
      throw new ApiError(403, 'This account is suspended. Please contact support.');
    }

    await this.options.repository.markAuthenticated(user.id);
    const memberships = await this.options.repository.listActiveMemberships(user.id);
    if (memberships.length === 0) {
      if (user.platformRole === roles.masterAdmin) {
        await this.options.repository.audit(
          { action: 'auth.master_admin_login', actorUserId: user.id, entityType: 'session' },
          context
        );
        return {
          requiresCompanySelection: false,
          ...(await this.issueSession(user, null, context, roles.masterAdmin))
        };
      }
      throw new ApiError(
        403,
        'Your account is not linked to any company. Please contact your Company Admin.'
      );
    }

    if (memberships.length === 1) {
      const membership = memberships[0];
      if (!membership) throw new ApiError(401, expiredSessionMessage);
      await this.auditMembership('auth.login', user.id, membership, context);
      return {
        requiresCompanySelection: false,
        ...(await this.issueSession(user, membership, context))
      };
    }

    await this.options.repository.audit(
      {
        action: 'auth.login_pending_company_selection',
        actorUserId: user.id,
        entityType: 'session'
      },
      context
    );
    return {
      requiresCompanySelection: true,
      preAuthToken: this.options.tokens.signPreAuthToken(user.id),
      companies: memberships.map((membership) => ({
        ...membership.company,
        role: membership.role
      }))
    };
  }

  public async selectCompany(
    input: SelectCompanyInput,
    context: RequestContext
  ): Promise<SessionResponse> {
    let userId: string;
    try {
      userId = this.options.tokens.verifyPreAuthToken(input.preAuthToken);
    } catch {
      throw new ApiError(401, expiredSessionMessage);
    }
    return this.sessionForMembership(userId, input.companyId, 'auth.company_selected', context);
  }

  public async switchCompany(
    userId: string,
    companyId: string,
    context: RequestContext
  ): Promise<SessionResponse> {
    return this.sessionForMembership(userId, companyId, 'auth.company_switched', context);
  }

  public async refreshSession(
    rawRefreshToken: string,
    context: RequestContext
  ): Promise<SessionResponse> {
    if (!rawRefreshToken) throw new ApiError(401, expiredSessionMessage);
    const oldHash = this.options.tokens.hashRefreshToken(rawRefreshToken);
    const stored = await this.options.repository.findSession(oldHash);
    if (!stored || stored.revokedAt || stored.expiresAt <= new Date()) {
      throw new ApiError(401, expiredSessionMessage);
    }

    const user = await this.requireActiveUser(stored.principal.userId);
    let membership: CompanyMembership | null = null;
    if (stored.principal.tenantId) {
      membership = await this.options.repository.findActiveMembership(
        user.id,
        stored.principal.tenantId
      );
      if (!membership) throw new ApiError(401, expiredSessionMessage);
    } else if (user.platformRole !== roles.masterAdmin) {
      throw new ApiError(401, expiredSessionMessage);
    }

    const refresh = this.options.tokens.createRefreshToken();
    const expiresAt = this.refreshExpiry();
    await this.options.repository.rotateSession(stored.id, refresh.hash, expiresAt, context);
    const principal = this.principal(user.id, membership, stored.principal.role);
    return {
      accessToken: this.options.tokens.signAccessToken(principal),
      refreshToken: refresh.raw,
      user,
      company: membership?.company ?? null,
      role: membership?.role ?? stored.principal.role
    };
  }

  public async logOut(rawRefreshToken: string): Promise<{ message: string }> {
    if (rawRefreshToken) {
      await this.options.repository.revokeSession(
        this.options.tokens.hashRefreshToken(rawRefreshToken)
      );
    }
    return { message: 'Logged out successfully.' };
  }

  public async me(principal: SessionPrincipal) {
    const user = await this.requireActiveUser(principal.userId);
    const memberships = await this.options.repository.listActiveMemberships(user.id);
    const companies = memberships.map((membership) => ({
      ...membership.company,
      role: membership.role
    }));
    const company = principal.tenantId
      ? (companies.find((candidate) => candidate.id === principal.tenantId) ?? null)
      : null;
    const permissions = await this.options.repository.resolvePermissions(
      principal.tenantId,
      principal.role
    );
    return { user, company, role: principal.role, companies, permissions };
  }

  public async hasAnyPermission(
    principal: SessionPrincipal,
    needed: readonly string[]
  ): Promise<boolean> {
    if (principal.role === roles.companyAdmin) return true;
    const permissions = await this.options.repository.resolvePermissions(
      principal.tenantId,
      principal.role
    );
    return needed.some((permission) => permissions.includes(permission));
  }

  public async recordAudit(
    event: Parameters<AuthRepository['audit']>[0],
    context: RequestContext
  ): Promise<void> {
    await this.options.repository.audit(event, context);
  }

  public sendNotification(message: Parameters<AuthMailer['send']>[0]): void {
    this.sendMail(message);
    if (message.membershipId && message.tenantId) {
      this.options.repository
        .createNotification({
          tenantId: message.tenantId,
          membershipId: message.membershipId,
          type: message.type,
          title: message.title ?? message.subject,
          body: message.body ?? '',
          link: message.link ?? ''
        })
        .catch(() => {});
    }
  }

  public async updateProfile(userId: string, input: UpdateProfileInput, context: RequestContext) {
    const user = await this.options.repository.updateProfile(userId, {
      fullName: input.fullName,
      ...(input.contactNumber !== undefined ? { contactNumber: input.contactNumber } : {})
    });
    if (!user) throw new ApiError(401, expiredSessionMessage);
    await this.options.repository.audit(
      {
        action: 'auth.profile_updated',
        actorUserId: userId,
        entityType: 'user',
        entityId: userId
      },
      context
    );
    return { user, message: 'Profile updated successfully.' };
  }

  public async changePassword(
    principal: SessionPrincipal,
    currentPassword: string,
    newPassword: string,
    context: RequestContext
  ) {
    if (principal.impersonatorId) {
      throw new ApiError(403, 'Password changes are not allowed while impersonating a user.');
    }
    const user = await this.requireActiveUser(principal.userId);
    if (
      !user.passwordHash ||
      !(await this.options.passwordHasher.verify(user.passwordHash, currentPassword))
    ) {
      throw new ApiError(422, 'Current Password is incorrect.', {
        currentPassword: 'Current Password is incorrect.'
      });
    }
    await this.options.repository.updatePassword(
      user.id,
      await this.options.passwordHasher.hash(newPassword)
    );
    await this.options.repository.audit(
      {
        action: 'auth.password_changed',
        actorUserId: user.id,
        entityType: 'user',
        entityId: user.id
      },
      context
    );
    return { message: 'Password changed successfully.' };
  }

  public async forgotPassword(email: string, context: RequestContext) {
    const reset = this.options.tokens.createRefreshToken();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const userId = await this.options.repository.createPasswordResetToken(
      email,
      reset.hash,
      expiresAt
    );
    if (userId) {
      const user = await this.options.repository.findUserById(userId);
      if (user) {
        const resetUrl = `${this.options.appUrl.replace(/\/+$/, '')}/reset-password?token=${encodeURIComponent(reset.raw)}`;
        this.sendMail({
          to: user.email,
          subject: 'Reset your Zorfly password',
          html: `<p>Hello ${user.fullName},</p><p><a href="${resetUrl}">Reset your password</a>. This link expires in 30 minutes.</p>`,
          type: 'password_reset'
        });
        await this.options.repository.audit(
          {
            action: 'auth.password_reset_requested',
            actorUserId: user.id,
            entityType: 'user',
            entityId: user.id
          },
          context
        );
      }
    }
    return { message: resetRequestMessage };
  }

  public async resetPassword(rawToken: string, newPassword: string, context: RequestContext) {
    const userId = await this.options.repository.consumePasswordResetToken(
      this.options.tokens.hashRefreshToken(rawToken),
      await this.options.passwordHasher.hash(newPassword)
    );
    if (!userId) {
      throw new ApiError(
        400,
        'This reset link is invalid or has expired. Please request a new one.'
      );
    }
    await this.options.repository.audit(
      {
        action: 'auth.password_reset',
        actorUserId: userId,
        entityType: 'user',
        entityId: userId
      },
      context
    );
    return {
      message: 'Your password has been reset. You can now log in with your new password.'
    };
  }

  private async sessionForMembership(
    userId: string,
    tenantId: string,
    auditAction: string,
    context: RequestContext
  ): Promise<SessionResponse> {
    const user = await this.requireActiveUser(userId);
    const membership = await this.options.repository.findActiveMembership(userId, tenantId);
    if (!membership) {
      throw new ApiError(403, 'You do not have access to the selected company.');
    }
    await this.auditMembership(auditAction, user.id, membership, context);
    return this.issueSession(user, membership, context);
  }

  private async requireActiveUser(userId: string): Promise<AuthUser> {
    const user = await this.options.repository.findUserById(userId);
    if (!activeUser(user)) throw new ApiError(401, expiredSessionMessage);
    return user;
  }

  private async issueSession(
    user: PublicUser,
    membership: CompanyMembership | null,
    context: RequestContext,
    fallbackRole = roles.masterAdmin
  ): Promise<SessionResponse> {
    const principal = this.principal(user.id, membership, fallbackRole);
    const refresh = this.options.tokens.createRefreshToken();
    await this.options.repository.createSession(
      principal,
      refresh.hash,
      this.refreshExpiry(),
      context
    );
    return {
      accessToken: this.options.tokens.signAccessToken(principal),
      refreshToken: refresh.raw,
      user,
      company: membership?.company ?? null,
      role: principal.role
    };
  }

  private principal(
    userId: string,
    membership: CompanyMembership | null,
    fallbackRole: string
  ): SessionPrincipal {
    return {
      userId,
      tenantId: membership?.company.id ?? null,
      role: membership?.role ?? fallbackRole
    };
  }

  private refreshExpiry(): Date {
    return new Date(Date.now() + this.options.refreshTokenTtlSeconds * 1000);
  }

  private sendMail(message: Parameters<AuthMailer['send']>[0]): void {
    void this.options.mailer.send(message).catch(() => {
      // Email delivery is moved to the durable communications outbox in the
      // notifications slice. Authentication responses must not leave a
      // committed registration or reset-token transaction looking failed.
    });
  }

  private async auditMembership(
    action: string,
    userId: string,
    membership: CompanyMembership,
    context: RequestContext
  ): Promise<void> {
    await this.options.repository.audit(
      {
        action,
        actorUserId: userId,
        tenantId: membership.company.id,
        entityType: 'session'
      },
      context
    );
  }
}

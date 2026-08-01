export interface PublicUser {
  id: string;
  fullName: string;
  email: string;
  contactNumber: string;
  platformRole: string | null;
}

export interface PublicCompany {
  id: string;
  name: string;
  slug: string;
  logoUrl: string;
  timeZone: string;
}

export interface AuthUser extends PublicUser {
  status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
  passwordHash: string | null;
}

export interface CompanyMembership {
  membershipId: string;
  userId: string;
  company: PublicCompany;
  role: string;
}

export interface SessionPrincipal {
  userId: string;
  tenantId: string | null;
  role: string;
  impersonatorId?: string;
}

export interface RequestContext {
  ip?: string;
  requestId?: string;
  userAgent?: string;
}

export interface RegistrationCommand {
  existingUserId?: string;
  companyName: string;
  fullName: string;
  email: string;
  contactNumber?: string;
  country?: string;
  referralCode?: string;
  passwordHash?: string;
}

export interface ActiveSession {
  id: string;
  principal: SessionPrincipal;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface AuthRepository {
  findUserByEmail(email: string): Promise<AuthUser | null>;
  findUserById(userId: string): Promise<AuthUser | null>;
  registerTenant(command: RegistrationCommand): Promise<CompanyMembership>;
  listActiveMemberships(userId: string): Promise<CompanyMembership[]>;
  findActiveMembership(userId: string, tenantId: string): Promise<CompanyMembership | null>;
  markAuthenticated(userId: string): Promise<void>;
  updateProfile(
    userId: string,
    profile: { fullName: string; contactNumber?: string }
  ): Promise<PublicUser | null>;
  updatePassword(userId: string, passwordHash: string): Promise<boolean>;
  createPasswordResetToken(
    email: string,
    tokenHash: string,
    expiresAt: Date
  ): Promise<string | null>;
  consumePasswordResetToken(tokenHash: string, passwordHash: string): Promise<string | null>;
  createSession(
    principal: SessionPrincipal,
    refreshTokenHash: string,
    expiresAt: Date,
    context: RequestContext
  ): Promise<void>;
  findSession(refreshTokenHash: string): Promise<ActiveSession | null>;
  rotateSession(
    sessionId: string,
    refreshTokenHash: string,
    expiresAt: Date,
    context: RequestContext
  ): Promise<void>;
  revokeSession(refreshTokenHash: string): Promise<void>;
  resolvePermissions(tenantId: string | null, role: string): Promise<string[]>;
  audit(
    event: {
      action: string;
      actorUserId?: string;
      tenantId?: string;
      entityType?: string;
      entityId?: string;
      metadata?: Readonly<Record<string, unknown>>;
    },
    context: RequestContext
  ): Promise<void>;
  createNotification(input: NotificationInput): Promise<void>;
}

export interface NotificationInput {
  tenantId: string;
  membershipId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
}

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  type: string;
  tenantId?: string;
  membershipId?: string;
  title?: string;
  body?: string;
  link?: string;
}

export interface AuthMailer {
  send(message: MailMessage): Promise<void>;
}

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "ai";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "assessment";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "communications";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "content";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "core";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "engagement";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "learning";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "operations";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "platform";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "recruitment";

-- CreateEnum
CREATE TYPE "core"."TenantStatus" AS ENUM ('PROVISIONING', 'ACTIVE', 'SUSPENDED', 'CLOSING', 'CLOSED');

-- CreateEnum
CREATE TYPE "core"."RecordStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "core"."MembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "platform"."IdentityProviderType" AS ENUM ('LOCAL', 'OIDC', 'SAML');

-- CreateEnum
CREATE TYPE "platform"."UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "core"."SupportAccessStatus" AS ENUM ('REQUESTED', 'APPROVED', 'ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "content"."AssetKind" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'SVG', 'OTHER');

-- CreateEnum
CREATE TYPE "content"."AssetStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'QUARANTINED', 'REJECTED', 'DELETED');

-- CreateEnum
CREATE TYPE "content"."QuestionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'RETIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "content"."VersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUPERSEDED', 'RETIRED');

-- CreateEnum
CREATE TYPE "assessment"."AssessmentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SCHEDULED', 'ACTIVE', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "assessment"."TargetScopeType" AS ENUM ('TENANT', 'BRANCH', 'DEPARTMENT', 'TEAM', 'ROLE', 'MEMBERSHIP', 'CANDIDATE');

-- CreateEnum
CREATE TYPE "assessment"."AssignmentSource" AS ENUM ('MANUAL', 'SCHEDULE', 'LEARNING_PATH', 'RECRUITMENT', 'RETAKE', 'API');

-- CreateEnum
CREATE TYPE "assessment"."AssignmentStatus" AS ENUM ('PENDING', 'AVAILABLE', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED', 'MISSED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "assessment"."AttemptMode" AS ENUM ('OFFICIAL', 'PRACTICE', 'RECRUITMENT', 'PREVIEW');

-- CreateEnum
CREATE TYPE "assessment"."AttemptStatus" AS ENUM ('CREATED', 'IN_PROGRESS', 'SUBMITTED', 'EVALUATING', 'NEEDS_REVIEW', 'EVALUATED', 'PUBLISHED', 'ABANDONED', 'INVALIDATED');

-- CreateEnum
CREATE TYPE "assessment"."EvaluationStatus" AS ENUM ('PENDING', 'SCORED', 'NEEDS_REVIEW', 'OVERRIDDEN', 'VOIDED');

-- CreateEnum
CREATE TYPE "assessment"."ManualReviewStatus" AS ENUM ('UNASSIGNED', 'ASSIGNED', 'IN_REVIEW', 'COMPLETED', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "assessment"."ScheduleFrequency" AS ENUM ('ONCE', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "assessment"."CycleStatus" AS ENUM ('PLANNED', 'OPEN', 'CLOSED', 'PROCESSING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "assessment"."MissedWorkPolicy" AS ENUM ('MARK_ABSENT', 'SCORE_ZERO', 'LATE_PENALTY', 'ALLOW_EXTENSION', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "assessment"."IntegrityEventType" AS ENUM ('FOCUS_LOST', 'WINDOW_HIDDEN', 'COPY_ATTEMPT', 'PASTE_ATTEMPT', 'FULLSCREEN_EXIT', 'NETWORK_CHANGE', 'DEVICE_CHANGE', 'TIME_ANOMALY', 'OTHER');

-- CreateEnum
CREATE TYPE "learning"."LearningContentType" AS ENUM ('ARTICLE', 'PDF', 'VIDEO', 'AUDIO', 'BRAND_GUIDE', 'CHECKLIST', 'EXTERNAL_LINK');

-- CreateEnum
CREATE TYPE "learning"."LearningAssignmentStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'WAIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "learning"."ProgressStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "learning"."CertificateStatus" AS ENUM ('ISSUED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "recruitment"."RecruitmentDriveStatus" AS ENUM ('DRAFT', 'OPEN', 'PAUSED', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "recruitment"."CandidateStatus" AS ENUM ('INVITED', 'ACTIVE', 'WITHDRAWN', 'ANONYMIZED', 'PURGED');

-- CreateEnum
CREATE TYPE "recruitment"."ApplicationStatus" AS ENUM ('APPLIED', 'INVITED', 'ASSESSING', 'UNDER_REVIEW', 'SHORTLISTED', 'ON_HOLD', 'REJECTED', 'HIRED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "recruitment"."RecruitmentDecision" AS ENUM ('SHORTLIST', 'HOLD', 'REJECT', 'HIRE', 'REOPEN');

-- CreateEnum
CREATE TYPE "engagement"."LeaderboardScope" AS ENUM ('TENANT', 'BRANCH', 'DEPARTMENT', 'TEAM');

-- CreateEnum
CREATE TYPE "engagement"."LedgerEntryType" AS ENUM ('EARN', 'ADJUST', 'RESERVE', 'RELEASE', 'REDEEM', 'EXPIRE');

-- CreateEnum
CREATE TYPE "engagement"."RedemptionStatus" AS ENUM ('REQUESTED', 'APPROVED', 'FULFILLED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "communications"."NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH', 'SMS', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "communications"."DeliveryStatus" AS ENUM ('PENDING', 'QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "communications"."ReportRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ai"."AIExecutionStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ai"."AIExecutionPurpose" AS ENUM ('QUESTION_GENERATION', 'RESPONSE_EVALUATION', 'FEEDBACK', 'RECOMMENDATION', 'IMAGE_GENERATION', 'SVG_GENERATION', 'MODERATION', 'AGENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ai"."AIRecommendationStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'DISMISSED', 'EXPIRED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ai"."AgentRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'WAITING_APPROVAL', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "operations"."AuditActorType" AS ENUM ('USER', 'CANDIDATE', 'SERVICE', 'SUPPORT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "operations"."AuditOutcome" AS ENUM ('SUCCEEDED', 'DENIED', 'FAILED');

-- CreateEnum
CREATE TYPE "operations"."OutboxStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED', 'DEAD_LETTERED');

-- CreateEnum
CREATE TYPE "operations"."DataRequestType" AS ENUM ('EXPORT', 'RECTIFICATION', 'DELETION', 'RESTRICTION');

-- CreateEnum
CREATE TYPE "operations"."DataRequestStatus" AS ENUM ('REQUESTED', 'VERIFIED', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "platform"."SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "platform"."InvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE');

-- CreateEnum
CREATE TYPE "platform"."PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateTable
CREATE TABLE "platform"."User" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "externalSubject" VARCHAR(255),
    "emailCanonical" VARCHAR(320) NOT NULL,
    "displayName" VARCHAR(200),
    "contactNumber" VARCHAR(32),
    "status" "platform"."UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "locale" VARCHAR(16) NOT NULL DEFAULT 'en',
    "timeZone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
    "isPlatformOperator" BOOLEAN NOT NULL DEFAULT false,
    "lastAuthenticatedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform"."UserCredential" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "passwordChangedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "UserCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform"."UserIdentity" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "providerType" "platform"."IdentityProviderType" NOT NULL,
    "providerKey" VARCHAR(120) NOT NULL,
    "providerSubject" VARCHAR(255) NOT NULL,
    "emailAtLink" VARCHAR(320),
    "metadata" JSONB,
    "lastUsedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "UserIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform"."UserSession" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "activeTenantId" UUID,
    "refreshTokenHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "lastUsedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(6),
    "revokeReason" VARCHAR(160),
    "sourceIpHash" CHAR(64),
    "userAgentHash" CHAR(64),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform"."PasswordResetToken" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "usedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform"."Permission" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(160) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "riskLevel" SMALLINT NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform"."PlatformRole" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PlatformRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform"."PlatformRolePermission" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PlatformRolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "platform"."PlatformUserRole" (
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "grantedById" UUID,
    "expiresAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PlatformUserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "platform"."SubscriptionPlan" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "monthlyAmount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "annualAmount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "status" "core"."RecordStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform"."PlanEntitlement" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "planId" UUID NOT NULL,
    "featureKey" VARCHAR(160) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "limitValue" BIGINT,
    "config" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PlanEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform"."QuestionType" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "answerSchema" JSONB NOT NULL,
    "supportsAutoScore" BOOLEAN NOT NULL DEFAULT false,
    "supportsMedia" BOOLEAN NOT NULL DEFAULT false,
    "status" "core"."RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "QuestionType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform"."RewardType" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "status" "core"."RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "RewardType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."Tenant" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(40) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "status" "core"."TenantStatus" NOT NULL DEFAULT 'PROVISIONING',
    "dataRegion" VARCHAR(32) NOT NULL DEFAULT 'ap-south-1',
    "locale" VARCHAR(16) NOT NULL DEFAULT 'en',
    "timeZone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
    "retentionDays" INTEGER NOT NULL DEFAULT 2555,
    "settings" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,
    "deletedAt" TIMESTAMPTZ(6),
    "deletedById" UUID,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."TenantDomain" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "hostname" VARCHAR(253) NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "TenantDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."TenantBranding" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "logoAssetVersionId" UUID,
    "primaryColor" VARCHAR(16),
    "secondaryColor" VARCHAR(16),
    "accentColor" VARCHAR(16),
    "customCss" TEXT,
    "emailFromName" VARCHAR(120),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,
    "deletedAt" TIMESTAMPTZ(6),
    "deletedById" UUID,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "TenantBranding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."Branch" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "timeZone" VARCHAR(64),
    "status" "core"."RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,
    "deletedAt" TIMESTAMPTZ(6),
    "deletedById" UUID,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."Department" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "branchId" UUID,
    "parentId" UUID,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "status" "core"."RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,
    "deletedAt" TIMESTAMPTZ(6),
    "deletedById" UUID,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."Team" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "departmentId" UUID,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "status" "core"."RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,
    "deletedAt" TIMESTAMPTZ(6),
    "deletedById" UUID,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."TenantMembership" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "branchId" UUID,
    "departmentId" UUID,
    "managerId" UUID,
    "employeeNumber" VARCHAR(80),
    "jobTitle" VARCHAR(160),
    "employmentLevel" VARCHAR(80),
    "status" "core"."MembershipStatus" NOT NULL DEFAULT 'INVITED',
    "joinedAt" DATE,
    "leftAt" DATE,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,
    "deletedAt" TIMESTAMPTZ(6),
    "deletedById" UUID,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "TenantMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."TeamMembership" (
    "tenantId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "isLead" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "TeamMembership_pkey" PRIMARY KEY ("teamId","membershipId")
);

-- CreateTable
CREATE TABLE "core"."TenantRole" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "key" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "status" "core"."RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,
    "deletedAt" TIMESTAMPTZ(6),
    "deletedById" UUID,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "TenantRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."TenantRolePermission" (
    "tenantId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "TenantRolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "core"."MembershipRole" (
    "tenantId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "grantedById" UUID,
    "expiresAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "MembershipRole_pkey" PRIMARY KEY ("membershipId","roleId")
);

-- CreateTable
CREATE TABLE "core"."SupportAccessGrant" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "granteeUserId" UUID NOT NULL,
    "approvedById" UUID,
    "status" "core"."SupportAccessStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" VARCHAR(1000) NOT NULL,
    "scope" JSONB NOT NULL,
    "startsAt" TIMESTAMPTZ(6),
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "revokedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "SupportAccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform"."TenantSubscription" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "externalSubscriptionId" VARCHAR(255),
    "status" "platform"."SubscriptionStatus" NOT NULL,
    "startsAt" TIMESTAMPTZ(6) NOT NULL,
    "currentPeriodStart" TIMESTAMPTZ(6) NOT NULL,
    "currentPeriodEnd" TIMESTAMPTZ(6) NOT NULL,
    "cancelAt" TIMESTAMPTZ(6),
    "endedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "TenantSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform"."Invoice" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "externalInvoiceId" VARCHAR(255),
    "number" VARCHAR(80) NOT NULL,
    "status" "platform"."InvoiceStatus" NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "subtotal" DECIMAL(19,4) NOT NULL,
    "tax" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(19,4) NOT NULL,
    "dueAt" TIMESTAMPTZ(6),
    "paidAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform"."Payment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "externalPaymentId" VARCHAR(255),
    "status" "platform"."PaymentStatus" NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "provider" VARCHAR(80) NOT NULL,
    "paidAt" TIMESTAMPTZ(6),
    "failureCode" VARCHAR(160),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content"."AssessmentCategory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "parentId" UUID,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "core"."RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,
    "deletedAt" TIMESTAMPTZ(6),
    "deletedById" UUID,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AssessmentCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content"."DifficultyLevel" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "rank" SMALLINT NOT NULL,
    "description" VARCHAR(500),
    "status" "core"."RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,
    "deletedAt" TIMESTAMPTZ(6),
    "deletedById" UUID,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "DifficultyLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content"."QualityCriterion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "categoryId" UUID,
    "parentId" UUID,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "defaultSeverity" SMALLINT,
    "defaultWeight" DECIMAL(9,4),
    "status" "core"."RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,
    "deletedAt" TIMESTAMPTZ(6),
    "deletedById" UUID,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "QualityCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content"."Tag" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "color" VARCHAR(16),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,
    "deletedAt" TIMESTAMPTZ(6),
    "deletedById" UUID,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content"."MediaAsset" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "kind" "content"."AssetKind" NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "source" VARCHAR(40) NOT NULL DEFAULT 'UPLOAD',
    "status" "content"."AssetStatus" NOT NULL DEFAULT 'PENDING',
    "currentVersionId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,
    "deletedAt" TIMESTAMPTZ(6),
    "deletedById" UUID,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content"."MediaAssetVersion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "storageProvider" VARCHAR(40) NOT NULL,
    "storageBucket" VARCHAR(255) NOT NULL,
    "storageKey" VARCHAR(1024) NOT NULL,
    "contentType" VARCHAR(160) NOT NULL,
    "byteSize" BIGINT NOT NULL,
    "checksumSha256" CHAR(64) NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "durationMs" INTEGER,
    "metadata" JSONB,
    "scanStatus" VARCHAR(40) NOT NULL DEFAULT 'PENDING',
    "moderationStatus" VARCHAR(40) NOT NULL DEFAULT 'PENDING',
    "provenance" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,

    CONSTRAINT "MediaAssetVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content"."AssetLineage" (
    "tenantId" UUID NOT NULL,
    "parentVersionId" UUID NOT NULL,
    "childVersionId" UUID NOT NULL,
    "operation" VARCHAR(80) NOT NULL,
    "parameters" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AssetLineage_pkey" PRIMARY KEY ("parentVersionId","childVersionId")
);

-- CreateTable
CREATE TABLE "content"."Question" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "difficultyLevelId" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "status" "content"."QuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersionId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,
    "deletedAt" TIMESTAMPTZ(6),
    "deletedById" UUID,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content"."QuestionVersion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "questionTypeId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "content"."VersionStatus" NOT NULL DEFAULT 'DRAFT',
    "prompt" TEXT NOT NULL,
    "instructions" TEXT,
    "answerSchema" JSONB NOT NULL,
    "scoringSchema" JSONB NOT NULL,
    "explanation" TEXT,
    "defaultMarks" DECIMAL(9,4) NOT NULL,
    "defaultNegativeMarks" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "requiresManualReview" BOOLEAN NOT NULL DEFAULT false,
    "estimatedSeconds" INTEGER,
    "publishedAt" TIMESTAMPTZ(6),
    "contentHash" CHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,

    CONSTRAINT "QuestionVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content"."QuestionOption" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "questionVersionId" UUID NOT NULL,
    "mediaAssetVersionId" UUID,
    "optionKey" VARCHAR(40) NOT NULL,
    "label" TEXT,
    "answerValue" JSONB,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "scoreWeight" DECIMAL(9,4) NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "QuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content"."QuestionAnswerTarget" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "questionVersionId" UUID NOT NULL,
    "qualityCriterionId" UUID,
    "targetKey" VARCHAR(80) NOT NULL,
    "targetType" VARCHAR(40) NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "targetData" JSONB NOT NULL,
    "marks" DECIMAL(9,4) NOT NULL,
    "negativeMarks" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "severity" SMALLINT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "QuestionAnswerTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content"."QuestionVersionMedia" (
    "tenantId" UUID NOT NULL,
    "questionVersionId" UUID NOT NULL,
    "mediaAssetVersionId" UUID NOT NULL,
    "role" VARCHAR(40) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "annotations" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "QuestionVersionMedia_pkey" PRIMARY KEY ("questionVersionId","mediaAssetVersionId","role")
);

-- CreateTable
CREATE TABLE "content"."QuestionTag" (
    "tenantId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "tagId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "QuestionTag_pkey" PRIMARY KEY ("questionId","tagId")
);

-- CreateTable
CREATE TABLE "learning"."LearningMaterial" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "categoryId" UUID,
    "code" VARCHAR(100) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "contentType" "learning"."LearningContentType" NOT NULL,
    "status" "core"."RecordStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersionId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,
    "deletedAt" TIMESTAMPTZ(6),
    "deletedById" UUID,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "LearningMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."LearningMaterialVersion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "materialId" UUID NOT NULL,
    "mediaAssetVersionId" UUID,
    "versionNumber" INTEGER NOT NULL,
    "status" "content"."VersionStatus" NOT NULL DEFAULT 'DRAFT',
    "body" JSONB NOT NULL,
    "sourceUrl" VARCHAR(2048),
    "durationSeconds" INTEGER,
    "contentHash" CHAR(64) NOT NULL,
    "publishedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,

    CONSTRAINT "LearningMaterialVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."QuestionLearningMaterial" (
    "tenantId" UUID NOT NULL,
    "questionVersionId" UUID NOT NULL,
    "learningMaterialVersionId" UUID NOT NULL,
    "relationType" VARCHAR(40) NOT NULL DEFAULT 'REMEDIATION',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "QuestionLearningMaterial_pkey" PRIMARY KEY ("questionVersionId","learningMaterialVersionId")
);

-- CreateTable
CREATE TABLE "assessment"."AssessmentDefinition" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "categoryId" UUID,
    "difficultyLevelId" UUID,
    "code" VARCHAR(100) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" "assessment"."AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersionId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,
    "deletedAt" TIMESTAMPTZ(6),
    "deletedById" UUID,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AssessmentDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment"."AssessmentVersion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "assessmentId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "content"."VersionStatus" NOT NULL DEFAULT 'DRAFT',
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "totalMarks" DECIMAL(12,4) NOT NULL,
    "passingMarks" DECIMAL(12,4) NOT NULL,
    "durationSeconds" INTEGER,
    "perQuestionTimeLimit" INTEGER,
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "negativeMarkingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "shuffleQuestions" BOOLEAN NOT NULL DEFAULT false,
    "shuffleOptions" BOOLEAN NOT NULL DEFAULT false,
    "autoSaveIntervalSeconds" INTEGER NOT NULL DEFAULT 15,
    "allowResume" BOOLEAN NOT NULL DEFAULT true,
    "resultVisibility" VARCHAR(40) NOT NULL DEFAULT 'AFTER_PUBLISH',
    "antiCheatingPolicy" JSONB,
    "retakePolicy" JSONB,
    "configuration" JSONB,
    "contentHash" CHAR(64) NOT NULL,
    "publishedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,

    CONSTRAINT "AssessmentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment"."AssessmentSection" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "assessmentVersionId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "instructions" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "durationSeconds" INTEGER,
    "questionCount" INTEGER,
    "marks" DECIMAL(12,4),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AssessmentSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment"."AssessmentQuestion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "assessmentVersionId" UUID NOT NULL,
    "sectionId" UUID,
    "questionVersionId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "marksOverride" DECIMAL(9,4),
    "negativeMarksOverride" DECIMAL(9,4),
    "required" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AssessmentQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment"."QuestionPoolRule" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "assessmentVersionId" UUID NOT NULL,
    "sectionId" UUID,
    "name" VARCHAR(160) NOT NULL,
    "selectionCount" INTEGER NOT NULL,
    "filter" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "seedStrategy" VARCHAR(40) NOT NULL DEFAULT 'PER_ASSIGNMENT',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "QuestionPoolRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment"."AssessmentSchedule" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "assessmentId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "frequency" "assessment"."ScheduleFrequency" NOT NULL,
    "recurrenceRule" VARCHAR(1000),
    "timeZone" VARCHAR(64) NOT NULL,
    "startsAt" TIMESTAMPTZ(6) NOT NULL,
    "endsAt" TIMESTAMPTZ(6),
    "openOffsetMinutes" INTEGER NOT NULL DEFAULT 0,
    "closeOffsetMinutes" INTEGER NOT NULL,
    "includeNewJoiners" BOOLEAN NOT NULL DEFAULT true,
    "missedWorkPolicy" "assessment"."MissedWorkPolicy" NOT NULL DEFAULT 'MARK_ABSENT',
    "reminderPolicy" JSONB,
    "escalationPolicy" JSONB,
    "status" "core"."RecordStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,
    "deletedAt" TIMESTAMPTZ(6),
    "deletedById" UUID,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AssessmentSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment"."ScheduleTarget" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "scheduleId" UUID NOT NULL,
    "scopeType" "assessment"."TargetScopeType" NOT NULL,
    "targetId" UUID,
    "filter" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ScheduleTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment"."ScheduleBlackoutDate" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "scheduleId" UUID NOT NULL,
    "localDate" DATE NOT NULL,
    "reason" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ScheduleBlackoutDate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment"."AssessmentCycle" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "scheduleId" UUID NOT NULL,
    "cycleKey" VARCHAR(100) NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "status" "assessment"."CycleStatus" NOT NULL DEFAULT 'PLANNED',
    "opensAt" TIMESTAMPTZ(6) NOT NULL,
    "closesAt" TIMESTAMPTZ(6) NOT NULL,
    "resultsAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,

    CONSTRAINT "AssessmentCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment"."AssignmentCampaign" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "assessmentVersionId" UUID NOT NULL,
    "cycleId" UUID,
    "source" "assessment"."AssignmentSource" NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "opensAt" TIMESTAMPTZ(6) NOT NULL,
    "dueAt" TIMESTAMPTZ(6) NOT NULL,
    "closesAt" TIMESTAMPTZ(6),
    "maxAttempts" INTEGER NOT NULL,
    "settings" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,

    CONSTRAINT "AssignmentCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment"."AssignmentTargetScope" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "scopeType" "assessment"."TargetScopeType" NOT NULL,
    "targetId" UUID,
    "filter" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AssignmentTargetScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment"."AssessmentAssignment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "campaignId" UUID,
    "assessmentVersionId" UUID NOT NULL,
    "membershipId" UUID,
    "candidateApplicationId" UUID,
    "source" "assessment"."AssignmentSource" NOT NULL,
    "status" "assessment"."AssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "availableAt" TIMESTAMPTZ(6) NOT NULL,
    "dueAt" TIMESTAMPTZ(6) NOT NULL,
    "closesAt" TIMESTAMPTZ(6),
    "maxAttempts" INTEGER NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AssessmentAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment"."AssessmentPaper" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "assignmentId" UUID NOT NULL,
    "assessmentVersionId" UUID NOT NULL,
    "randomSeed" VARCHAR(128),
    "contentHash" CHAR(64) NOT NULL,
    "totalMarks" DECIMAL(12,4) NOT NULL,
    "generatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AssessmentPaper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment"."AssessmentPaperQuestion" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" UUID NOT NULL,
    "paperId" UUID NOT NULL,
    "questionVersionId" UUID NOT NULL,
    "sectionOrder" INTEGER NOT NULL DEFAULT 0,
    "questionOrder" INTEGER NOT NULL,
    "optionOrder" JSONB,
    "maxMarks" DECIMAL(9,4) NOT NULL,
    "negativeMarks" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AssessmentPaperQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment"."AssessmentAttempt" (
    "id" BIGSERIAL NOT NULL,
    "publicId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "assignmentId" UUID,
    "paperId" UUID,
    "membershipId" UUID,
    "candidateApplicationId" UUID,
    "mode" "assessment"."AttemptMode" NOT NULL,
    "status" "assessment"."AttemptStatus" NOT NULL DEFAULT 'CREATED',
    "attemptNumber" INTEGER NOT NULL,
    "startedAt" TIMESTAMPTZ(6),
    "submittedAt" TIMESTAMPTZ(6),
    "evaluatedAt" TIMESTAMPTZ(6),
    "publishedAt" TIMESTAMPTZ(6),
    "expiresAt" TIMESTAMPTZ(6),
    "lastSavedAt" TIMESTAMPTZ(6),
    "durationSeconds" INTEGER,
    "rawScore" DECIMAL(12,4),
    "penaltyScore" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "finalScore" DECIMAL(12,4),
    "percentage" DECIMAL(7,4),
    "passed" BOOLEAN,
    "scoreVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AssessmentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment"."AttemptQuestion" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" UUID NOT NULL,
    "attemptId" BIGINT NOT NULL,
    "paperQuestionId" BIGINT,
    "questionVersionId" UUID NOT NULL,
    "questionOrder" INTEGER NOT NULL,
    "maxMarks" DECIMAL(9,4) NOT NULL,
    "status" "assessment"."EvaluationStatus" NOT NULL DEFAULT 'PENDING',
    "score" DECIMAL(9,4),
    "penalty" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "timeSpentSeconds" INTEGER NOT NULL DEFAULT 0,
    "firstViewedAt" TIMESTAMPTZ(6),
    "answeredAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AttemptQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment"."AttemptResponse" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" UUID NOT NULL,
    "attemptQuestionId" BIGINT NOT NULL,
    "answer" JSONB NOT NULL,
    "answerHash" CHAR(64) NOT NULL,
    "clientSequence" INTEGER NOT NULL DEFAULT 0,
    "savedAt" TIMESTAMPTZ(6) NOT NULL,
    "submittedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AttemptResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment"."ResponseEvaluation" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" UUID NOT NULL,
    "attemptQuestionId" BIGINT NOT NULL,
    "answerTargetId" UUID,
    "qualityCriterionId" UUID,
    "evaluationVersion" INTEGER NOT NULL,
    "evaluatorType" VARCHAR(40) NOT NULL,
    "evaluatorRef" VARCHAR(255),
    "status" "assessment"."EvaluationStatus" NOT NULL,
    "detected" BOOLEAN,
    "confidence" DECIMAL(7,6),
    "score" DECIMAL(9,4) NOT NULL,
    "penalty" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "evidence" JSONB,
    "rationale" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ResponseEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment"."ManualReview" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" UUID NOT NULL,
    "attemptQuestionId" BIGINT NOT NULL,
    "reviewerMembershipId" UUID,
    "status" "assessment"."ManualReviewStatus" NOT NULL DEFAULT 'UNASSIGNED',
    "reviewRound" INTEGER NOT NULL DEFAULT 1,
    "assignedAt" TIMESTAMPTZ(6),
    "dueAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "score" DECIMAL(9,4),
    "feedback" TEXT,
    "rubric" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ManualReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment"."AttemptCategoryResult" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" UUID NOT NULL,
    "attemptId" BIGINT NOT NULL,
    "categoryId" UUID NOT NULL,
    "possible" DECIMAL(12,4) NOT NULL,
    "scored" DECIMAL(12,4) NOT NULL,
    "percentage" DECIMAL(7,4) NOT NULL,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "incorrectCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AttemptCategoryResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment"."IntegrityEvent" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" UUID NOT NULL,
    "attemptId" BIGINT NOT NULL,
    "eventType" "assessment"."IntegrityEventType" NOT NULL,
    "severity" SMALLINT NOT NULL,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL,
    "clientData" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "IntegrityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment"."RetakeGrant" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "assignmentId" UUID NOT NULL,
    "additionalAttempts" INTEGER NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "grantedById" UUID,
    "expiresAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "revokedAt" TIMESTAMPTZ(6),

    CONSTRAINT "RetakeGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."LearningPath" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" "core"."RecordStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersionId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,
    "deletedAt" TIMESTAMPTZ(6),
    "deletedById" UUID,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "LearningPath_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."LearningPathVersion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "learningPathId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "content"."VersionStatus" NOT NULL DEFAULT 'DRAFT',
    "title" VARCHAR(255) NOT NULL,
    "completionRule" JSONB NOT NULL,
    "contentHash" CHAR(64) NOT NULL,
    "publishedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,

    CONSTRAINT "LearningPathVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."LearningPathItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "learningPathVersionId" UUID NOT NULL,
    "materialVersionId" UUID,
    "assessmentVersionId" UUID,
    "itemType" VARCHAR(40) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "completionRule" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "LearningPathItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."LearningPathAssignment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "learningPathVersionId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "status" "learning"."LearningAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "assignedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "source" VARCHAR(40) NOT NULL DEFAULT 'MANUAL',
    "sourceRef" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "LearningPathAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."LearningProgress" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" UUID NOT NULL,
    "learningPathAssignmentId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "status" "learning"."ProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "completionPercent" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "lastActivityAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "LearningProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."LearningItemProgress" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" UUID NOT NULL,
    "learningProgressId" BIGINT NOT NULL,
    "pathItemId" UUID NOT NULL,
    "status" "learning"."ProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "progressPercent" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "evidence" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "LearningItemProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."CertificateTemplate" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "template" JSONB NOT NULL,
    "validityDays" INTEGER,
    "status" "core"."RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,
    "deletedAt" TIMESTAMPTZ(6),
    "deletedById" UUID,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CertificateTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."Certificate" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "learningPathAssignmentId" UUID,
    "assessmentAttemptId" BIGINT,
    "verificationCode" VARCHAR(80) NOT NULL,
    "status" "learning"."CertificateStatus" NOT NULL DEFAULT 'ISSUED',
    "issuedAt" TIMESTAMPTZ(6) NOT NULL,
    "expiresAt" TIMESTAMPTZ(6),
    "revokedAt" TIMESTAMPTZ(6),
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruitment"."JobPosition" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "departmentId" UUID,
    "code" VARCHAR(100) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" "core"."RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,
    "deletedAt" TIMESTAMPTZ(6),
    "deletedById" UUID,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "JobPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruitment"."RecruitmentDrive" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "positionId" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "status" "recruitment"."RecruitmentDriveStatus" NOT NULL DEFAULT 'DRAFT',
    "opensAt" TIMESTAMPTZ(6),
    "closesAt" TIMESTAMPTZ(6),
    "retentionDays" INTEGER NOT NULL DEFAULT 365,
    "settings" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,
    "deletedAt" TIMESTAMPTZ(6),
    "deletedById" UUID,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "RecruitmentDrive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruitment"."RecruitmentDriveAssessment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "driveId" UUID NOT NULL,
    "assessmentVersionId" UUID NOT NULL,
    "stageOrder" INTEGER NOT NULL,
    "stageName" VARCHAR(160) NOT NULL,
    "passingMarksOverride" DECIMAL(12,4),
    "required" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "RecruitmentDriveAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruitment"."CandidateProfile" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "externalRef" VARCHAR(160),
    "emailCiphertext" BYTEA NOT NULL,
    "emailHash" CHAR(64) NOT NULL,
    "phoneCiphertext" BYTEA,
    "fullNameCiphertext" BYTEA NOT NULL,
    "status" "recruitment"."CandidateStatus" NOT NULL DEFAULT 'INVITED',
    "consentAt" TIMESTAMPTZ(6),
    "retentionUntil" TIMESTAMPTZ(6) NOT NULL,
    "anonymizedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,
    "deletedAt" TIMESTAMPTZ(6),
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CandidateProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruitment"."CandidateApplication" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "candidateId" UUID NOT NULL,
    "driveId" UUID NOT NULL,
    "status" "recruitment"."ApplicationStatus" NOT NULL DEFAULT 'APPLIED',
    "rank" INTEGER,
    "aggregateScore" DECIMAL(12,4),
    "appliedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(6),
    "retentionUntil" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CandidateApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruitment"."CandidateInvitation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "sentAt" TIMESTAMPTZ(6),
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "acceptedAt" TIMESTAMPTZ(6),
    "revokedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "CandidateInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruitment"."CandidateDecisionHistory" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "decision" "recruitment"."RecruitmentDecision" NOT NULL,
    "reason" TEXT,
    "evidence" JSONB,
    "decidedById" UUID,
    "decidedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "CandidateDecisionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagement"."LeaderboardDefinition" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "scope" "engagement"."LeaderboardScope" NOT NULL,
    "scoringConfiguration" JSONB NOT NULL,
    "exclusionConfiguration" JSONB,
    "anonymizeEntries" BOOLEAN NOT NULL DEFAULT false,
    "status" "core"."RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,
    "deletedAt" TIMESTAMPTZ(6),
    "deletedById" UUID,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "LeaderboardDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagement"."LeaderboardPeriod" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "leaderboardId" UUID NOT NULL,
    "periodKey" VARCHAR(100) NOT NULL,
    "startsAt" TIMESTAMPTZ(6) NOT NULL,
    "endsAt" TIMESTAMPTZ(6) NOT NULL,
    "finalizedAt" TIMESTAMPTZ(6),
    "sourceWatermark" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "LeaderboardPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagement"."LeaderboardEntry" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" UUID NOT NULL,
    "periodId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" DECIMAL(19,6) NOT NULL,
    "previousRank" INTEGER,
    "metrics" JSONB NOT NULL,
    "computedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "LeaderboardEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagement"."BadgeDefinition" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "iconAssetVersionId" UUID,
    "rule" JSONB NOT NULL,
    "status" "core"."RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,
    "deletedAt" TIMESTAMPTZ(6),
    "deletedById" UUID,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "BadgeDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagement"."BadgeAward" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "badgeId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "sourceType" VARCHAR(80) NOT NULL,
    "sourceId" VARCHAR(255),
    "evidence" JSONB,
    "awardedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "BadgeAward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagement"."RewardPointLedger" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "entryType" "engagement"."LedgerEntryType" NOT NULL,
    "points" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "sourceType" VARCHAR(80) NOT NULL,
    "sourceId" VARCHAR(255),
    "idempotencyKey" VARCHAR(255) NOT NULL,
    "expiresAt" TIMESTAMPTZ(6),
    "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "RewardPointLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagement"."RewardCatalogueItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "rewardTypeId" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "pointsCost" INTEGER NOT NULL,
    "inventory" INTEGER,
    "fulfillment" JSONB,
    "status" "core"."RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,
    "deletedAt" TIMESTAMPTZ(6),
    "deletedById" UUID,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "RewardCatalogueItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagement"."RewardRedemption" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "catalogueItemId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "status" "engagement"."RedemptionStatus" NOT NULL DEFAULT 'REQUESTED',
    "pointsReserved" INTEGER NOT NULL,
    "requestedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMPTZ(6),
    "fulfilledAt" TIMESTAMPTZ(6),
    "decisionReason" TEXT,
    "fulfillmentRef" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "RewardRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communications"."NotificationTemplate" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "channel" "communications"."NotificationChannel" NOT NULL,
    "locale" VARCHAR(16) NOT NULL DEFAULT 'en',
    "subject" VARCHAR(500),
    "bodyTemplate" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "core"."RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,
    "deletedAt" TIMESTAMPTZ(6),
    "deletedById" UUID,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communications"."NotificationPreference" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "preferences" JSONB NOT NULL,
    "quietHours" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communications"."NotificationDelivery" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" UUID NOT NULL,
    "templateId" UUID,
    "recipientMembershipId" UUID,
    "channel" "communications"."NotificationChannel" NOT NULL,
    "destinationHash" CHAR(64) NOT NULL,
    "deduplicationKey" VARCHAR(255) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "communications"."DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(6),
    "sentAt" TIMESTAMPTZ(6),
    "deliveredAt" TIMESTAMPTZ(6),
    "failureCode" VARCHAR(160),
    "providerMessageId" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communications"."ReportDefinition" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "reportType" VARCHAR(100) NOT NULL,
    "querySpec" JSONB NOT NULL,
    "schedule" JSONB,
    "recipients" JSONB,
    "status" "core"."RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,
    "deletedAt" TIMESTAMPTZ(6),
    "deletedById" UUID,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ReportDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communications"."ReportRun" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" UUID NOT NULL,
    "reportDefinitionId" UUID NOT NULL,
    "status" "communications"."ReportRunStatus" NOT NULL DEFAULT 'QUEUED',
    "parameters" JSONB NOT NULL,
    "sourceWatermark" TIMESTAMPTZ(6),
    "outputAssetVersionId" UUID,
    "requestedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "expiresAt" TIMESTAMPTZ(6),
    "failureCode" VARCHAR(160),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ReportRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communications"."EmployeeMetricPeriod" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "metricVersion" INTEGER NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "averageScore" DECIMAL(9,4),
    "passRate" DECIMAL(7,4),
    "trainingMinutes" INTEGER NOT NULL DEFAULT 0,
    "pointsEarned" INTEGER NOT NULL DEFAULT 0,
    "metrics" JSONB NOT NULL,
    "computedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "EmployeeMetricPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communications"."OrganizationMetricPeriod" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" UUID NOT NULL,
    "scopeType" "assessment"."TargetScopeType" NOT NULL,
    "scopeId" UUID,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "metricVersion" INTEGER NOT NULL,
    "metrics" JSONB NOT NULL,
    "computedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "OrganizationMetricPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communications"."QuestionMetricPeriod" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" UUID NOT NULL,
    "questionVersionId" UUID NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "metricVersion" INTEGER NOT NULL,
    "responseCount" BIGINT NOT NULL,
    "averageScore" DECIMAL(9,4),
    "difficultyIndex" DECIMAL(7,4),
    "discrimination" DECIMAL(7,4),
    "metrics" JSONB NOT NULL,
    "computedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "QuestionMetricPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai"."AIProvider" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(80) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "capabilities" JSONB NOT NULL,
    "status" "core"."RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AIProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai"."AIModel" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "providerId" UUID NOT NULL,
    "providerModelKey" VARCHAR(160) NOT NULL,
    "displayName" VARCHAR(160) NOT NULL,
    "capabilities" JSONB NOT NULL,
    "contextWindowTokens" INTEGER,
    "inputPricePerMillion" DECIMAL(19,8),
    "outputPricePerMillion" DECIMAL(19,8),
    "imagePriceConfig" JSONB,
    "pricingCurrency" CHAR(3) NOT NULL DEFAULT 'USD',
    "pricingEffectiveAt" TIMESTAMPTZ(6),
    "status" "core"."RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AIModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai"."TenantAIProviderConfiguration" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "secretReference" VARCHAR(512) NOT NULL,
    "endpointOverride" VARCHAR(2048),
    "organizationRef" VARCHAR(255),
    "quota" JSONB,
    "status" "core"."RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,
    "deletedAt" TIMESTAMPTZ(6),
    "deletedById" UUID,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "TenantAIProviderConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai"."AIModelConfiguration" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "modelId" UUID NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "purpose" "ai"."AIExecutionPurpose" NOT NULL,
    "parameters" JSONB NOT NULL,
    "fallbackChain" JSONB,
    "safetyPolicy" JSONB,
    "maxInputTokens" INTEGER,
    "maxOutputTokens" INTEGER,
    "dailyBudget" DECIMAL(19,4),
    "monthlyBudget" DECIMAL(19,4),
    "status" "core"."RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,
    "deletedAt" TIMESTAMPTZ(6),
    "deletedById" UUID,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AIModelConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai"."AIPrompt" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "purpose" "ai"."AIExecutionPurpose" NOT NULL,
    "description" TEXT,
    "status" "core"."RecordStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersionId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,
    "deletedAt" TIMESTAMPTZ(6),
    "deletedById" UUID,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AIPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai"."AIPromptTemplate" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "promptId" UUID NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "templateRole" VARCHAR(40) NOT NULL DEFAULT 'USER',
    "content" TEXT NOT NULL,
    "variableSchema" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,
    "deletedAt" TIMESTAMPTZ(6),
    "deletedById" UUID,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AIPromptTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai"."AIPromptVersion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "promptId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "content"."VersionStatus" NOT NULL DEFAULT 'DRAFT',
    "messages" JSONB NOT NULL,
    "variableSchema" JSONB NOT NULL,
    "outputSchema" JSONB,
    "safetyPolicy" JSONB,
    "evaluationConfig" JSONB,
    "contentHash" CHAR(64) NOT NULL,
    "publishedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,

    CONSTRAINT "AIPromptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai"."AIPromptExecution" (
    "id" BIGSERIAL NOT NULL,
    "publicId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "promptVersionId" UUID,
    "modelConfigurationId" UUID NOT NULL,
    "purpose" "ai"."AIExecutionPurpose" NOT NULL,
    "status" "ai"."AIExecutionStatus" NOT NULL DEFAULT 'QUEUED',
    "idempotencyKey" VARCHAR(255) NOT NULL,
    "traceId" VARCHAR(64),
    "correlationId" VARCHAR(128),
    "sourceType" VARCHAR(80),
    "sourceId" VARCHAR(255),
    "inputHash" CHAR(64) NOT NULL,
    "inputSnapshot" JSONB,
    "outputSnapshot" JSONB,
    "providerRequestId" VARCHAR(255),
    "startedAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "latencyMs" INTEGER,
    "failureCode" VARCHAR(160),
    "failureDetail" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AIPromptExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai"."AIPromptLog" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" UUID NOT NULL,
    "executionId" BIGINT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "level" VARCHAR(20) NOT NULL,
    "eventType" VARCHAR(80) NOT NULL,
    "message" TEXT,
    "attributes" JSONB,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AIPromptLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai"."AITokenUsage" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" UUID NOT NULL,
    "executionId" BIGINT NOT NULL,
    "providerModelKey" VARCHAR(160) NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "cachedInputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "reasoningTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "measuredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AITokenUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai"."AICostTracking" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" UUID NOT NULL,
    "executionId" BIGINT NOT NULL,
    "costType" VARCHAR(40) NOT NULL,
    "quantity" DECIMAL(19,6) NOT NULL,
    "unit" VARCHAR(40) NOT NULL,
    "unitPrice" DECIMAL(19,8) NOT NULL,
    "amount" DECIMAL(19,8) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "pricingVersion" VARCHAR(80) NOT NULL,
    "incurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AICostTracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai"."SVGAsset" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "mediaAssetVersionId" UUID NOT NULL,
    "sourceType" VARCHAR(40) NOT NULL,
    "sanitizerVersion" VARCHAR(80) NOT NULL,
    "rendererVersion" VARCHAR(80) NOT NULL,
    "viewBox" VARCHAR(120),
    "elementCount" INTEGER,
    "sanitizedHash" CHAR(64) NOT NULL,
    "safetyReport" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "SVGAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai"."GeneratedImage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "executionId" BIGINT NOT NULL,
    "mediaAssetVersionId" UUID NOT NULL,
    "providerImageId" VARCHAR(255),
    "revisedPrompt" TEXT,
    "generationParams" JSONB NOT NULL,
    "moderationResult" JSONB,
    "provenance" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "GeneratedImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai"."ImageCache" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "cacheKey" CHAR(64) NOT NULL,
    "generatedImageId" UUID NOT NULL,
    "policyVersion" VARCHAR(80) NOT NULL,
    "hitCount" BIGINT NOT NULL DEFAULT 0,
    "lastHitAt" TIMESTAMPTZ(6),
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ImageCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai"."QuestionGenerationHistory" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" UUID NOT NULL,
    "executionId" BIGINT NOT NULL,
    "sourceQuestionId" UUID,
    "generatedQuestionVersionId" UUID,
    "request" JSONB NOT NULL,
    "validationResult" JSONB,
    "humanDecision" VARCHAR(40),
    "decidedById" UUID,
    "decidedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "QuestionGenerationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai"."AIEvaluationHistory" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" UUID NOT NULL,
    "executionId" BIGINT NOT NULL,
    "attemptId" BIGINT,
    "evaluationType" VARCHAR(80) NOT NULL,
    "inputReference" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "confidence" DECIMAL(7,6),
    "humanOutcome" VARCHAR(40),
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AIEvaluationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai"."AIFeedbackHistory" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" UUID NOT NULL,
    "executionId" BIGINT NOT NULL,
    "subjectType" VARCHAR(80) NOT NULL,
    "subjectId" VARCHAR(255) NOT NULL,
    "feedback" JSONB NOT NULL,
    "publishedAt" TIMESTAMPTZ(6),
    "supersedesId" BIGINT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AIFeedbackHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai"."AIRecommendation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "executionId" BIGINT NOT NULL,
    "subjectType" VARCHAR(80) NOT NULL,
    "subjectId" VARCHAR(255) NOT NULL,
    "recommendationType" VARCHAR(80) NOT NULL,
    "recommendation" JSONB NOT NULL,
    "evidence" JSONB NOT NULL,
    "status" "ai"."AIRecommendationStatus" NOT NULL DEFAULT 'PROPOSED',
    "expiresAt" TIMESTAMPTZ(6),
    "decidedAt" TIMESTAMPTZ(6),
    "decidedById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AIRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai"."AgentRun" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "executionId" BIGINT,
    "modelConfigurationId" UUID NOT NULL,
    "agentKey" VARCHAR(120) NOT NULL,
    "agentVersion" VARCHAR(80) NOT NULL,
    "status" "ai"."AgentRunStatus" NOT NULL DEFAULT 'QUEUED',
    "objective" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "policySnapshot" JSONB NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai"."AgentRunStep" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" UUID NOT NULL,
    "agentRunId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "stepType" VARCHAR(80) NOT NULL,
    "toolName" VARCHAR(160),
    "status" "ai"."AgentRunStatus" NOT NULL,
    "input" JSONB,
    "output" JSONB,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvedById" UUID,
    "approvedAt" TIMESTAMPTZ(6),
    "startedAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AgentRunStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operations"."AuditEvent" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" UUID,
    "actorType" "operations"."AuditActorType" NOT NULL,
    "actorId" UUID,
    "supportGrantId" UUID,
    "action" VARCHAR(160) NOT NULL,
    "entityType" VARCHAR(160) NOT NULL,
    "entityId" VARCHAR(255),
    "outcome" "operations"."AuditOutcome" NOT NULL,
    "reasonCode" VARCHAR(160),
    "requestId" VARCHAR(128),
    "traceId" VARCHAR(64),
    "correlationId" VARCHAR(128),
    "sourceIpHash" CHAR(64),
    "userAgentHash" CHAR(64),
    "beforeState" JSONB,
    "afterState" JSONB,
    "metadata" JSONB,
    "previousEventHash" CHAR(64),
    "eventHash" CHAR(64) NOT NULL,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operations"."AuthorizationDecision" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" UUID,
    "actorType" "operations"."AuditActorType" NOT NULL,
    "actorId" UUID,
    "action" VARCHAR(160) NOT NULL,
    "resourceType" VARCHAR(160) NOT NULL,
    "resourceId" VARCHAR(255),
    "allowed" BOOLEAN NOT NULL,
    "policyVersion" VARCHAR(80) NOT NULL,
    "reasonCodes" JSONB NOT NULL,
    "requestId" VARCHAR(128),
    "traceId" VARCHAR(64),
    "evaluatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AuthorizationDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operations"."OutboxEvent" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" UUID,
    "aggregateType" VARCHAR(160) NOT NULL,
    "aggregateId" VARCHAR(255) NOT NULL,
    "eventType" VARCHAR(160) NOT NULL,
    "eventVersion" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "headers" JSONB,
    "idempotencyKey" VARCHAR(255) NOT NULL,
    "status" "operations"."OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "availableAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMPTZ(6),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operations"."IdempotencyRecord" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" UUID,
    "scope" VARCHAR(120) NOT NULL,
    "idempotencyKey" VARCHAR(255) NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "responseStatus" INTEGER,
    "responseBody" JSONB,
    "lockedUntil" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operations"."DataSubjectRequest" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "requestType" "operations"."DataRequestType" NOT NULL,
    "status" "operations"."DataRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "subjectType" VARCHAR(40) NOT NULL,
    "subjectId" VARCHAR(255) NOT NULL,
    "requestedById" UUID,
    "verifiedAt" TIMESTAMPTZ(6),
    "approvedById" UUID,
    "approvedAt" TIMESTAMPTZ(6),
    "dueAt" TIMESTAMPTZ(6) NOT NULL,
    "completedAt" TIMESTAMPTZ(6),
    "outputAssetVersionId" UUID,
    "purgeManifest" JSONB,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "DataSubjectRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_externalSubject_key" ON "platform"."User"("externalSubject");

-- CreateIndex
CREATE UNIQUE INDEX "User_emailCanonical_key" ON "platform"."User"("emailCanonical");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "platform"."User"("deletedAt");

-- CreateIndex
CREATE INDEX "User_status_deletedAt_idx" ON "platform"."User"("status", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserCredential_userId_key" ON "platform"."UserCredential"("userId");

-- CreateIndex
CREATE INDEX "UserCredential_lockedUntil_idx" ON "platform"."UserCredential"("lockedUntil");

-- CreateIndex
CREATE INDEX "UserCredential_deletedAt_idx" ON "platform"."UserCredential"("deletedAt");

-- CreateIndex
CREATE INDEX "UserIdentity_userId_providerType_deletedAt_idx" ON "platform"."UserIdentity"("userId", "providerType", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserIdentity_providerKey_providerSubject_key" ON "platform"."UserIdentity"("providerKey", "providerSubject");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_refreshTokenHash_key" ON "platform"."UserSession"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "UserSession_userId_revokedAt_expiresAt_idx" ON "platform"."UserSession"("userId", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "UserSession_activeTenantId_expiresAt_idx" ON "platform"."UserSession"("activeTenantId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "platform"."PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_usedAt_expiresAt_idx" ON "platform"."PasswordResetToken"("userId", "usedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "platform"."PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "platform"."Permission"("key");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformRole_key_key" ON "platform"."PlatformRole"("key");

-- CreateIndex
CREATE INDEX "PlatformUserRole_expiresAt_idx" ON "platform"."PlatformUserRole"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_code_key" ON "platform"."SubscriptionPlan"("code");

-- CreateIndex
CREATE INDEX "SubscriptionPlan_status_deletedAt_idx" ON "platform"."SubscriptionPlan"("status", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlanEntitlement_planId_featureKey_key" ON "platform"."PlanEntitlement"("planId", "featureKey");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionType_key_key" ON "platform"."QuestionType"("key");

-- CreateIndex
CREATE INDEX "QuestionType_status_idx" ON "platform"."QuestionType"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RewardType_key_key" ON "platform"."RewardType"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_code_key" ON "core"."Tenant"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "core"."Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_status_deletedAt_idx" ON "core"."Tenant"("status", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TenantDomain_hostname_key" ON "core"."TenantDomain"("hostname");

-- CreateIndex
CREATE INDEX "TenantDomain_tenantId_isPrimary_deletedAt_idx" ON "core"."TenantDomain"("tenantId", "isPrimary", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TenantBranding_tenantId_key" ON "core"."TenantBranding"("tenantId");

-- CreateIndex
CREATE INDEX "Branch_tenantId_status_deletedAt_idx" ON "core"."Branch"("tenantId", "status", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_tenantId_code_key" ON "core"."Branch"("tenantId", "code");

-- CreateIndex
CREATE INDEX "Department_tenantId_parentId_deletedAt_idx" ON "core"."Department"("tenantId", "parentId", "deletedAt");

-- CreateIndex
CREATE INDEX "Department_tenantId_branchId_status_idx" ON "core"."Department"("tenantId", "branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Department_tenantId_code_key" ON "core"."Department"("tenantId", "code");

-- CreateIndex
CREATE INDEX "Team_tenantId_departmentId_status_deletedAt_idx" ON "core"."Team"("tenantId", "departmentId", "status", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Team_tenantId_code_key" ON "core"."Team"("tenantId", "code");

-- CreateIndex
CREATE INDEX "TenantMembership_tenantId_status_deletedAt_idx" ON "core"."TenantMembership"("tenantId", "status", "deletedAt");

-- CreateIndex
CREATE INDEX "TenantMembership_tenantId_departmentId_managerId_idx" ON "core"."TenantMembership"("tenantId", "departmentId", "managerId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantMembership_tenantId_userId_key" ON "core"."TenantMembership"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantMembership_tenantId_employeeNumber_key" ON "core"."TenantMembership"("tenantId", "employeeNumber");

-- CreateIndex
CREATE INDEX "TeamMembership_tenantId_membershipId_endsAt_idx" ON "core"."TeamMembership"("tenantId", "membershipId", "endsAt");

-- CreateIndex
CREATE INDEX "TeamMembership_tenantId_teamId_isLead_idx" ON "core"."TeamMembership"("tenantId", "teamId", "isLead");

-- CreateIndex
CREATE INDEX "TenantRole_tenantId_status_deletedAt_idx" ON "core"."TenantRole"("tenantId", "status", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TenantRole_tenantId_key_key" ON "core"."TenantRole"("tenantId", "key");

-- CreateIndex
CREATE INDEX "TenantRolePermission_tenantId_permissionId_idx" ON "core"."TenantRolePermission"("tenantId", "permissionId");

-- CreateIndex
CREATE INDEX "MembershipRole_tenantId_roleId_expiresAt_idx" ON "core"."MembershipRole"("tenantId", "roleId", "expiresAt");

-- CreateIndex
CREATE INDEX "SupportAccessGrant_tenantId_status_expiresAt_idx" ON "core"."SupportAccessGrant"("tenantId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "SupportAccessGrant_granteeUserId_status_idx" ON "core"."SupportAccessGrant"("granteeUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TenantSubscription_externalSubscriptionId_key" ON "platform"."TenantSubscription"("externalSubscriptionId");

-- CreateIndex
CREATE INDEX "TenantSubscription_tenantId_status_currentPeriodEnd_idx" ON "platform"."TenantSubscription"("tenantId", "status", "currentPeriodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_externalInvoiceId_key" ON "platform"."Invoice"("externalInvoiceId");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_status_dueAt_idx" ON "platform"."Invoice"("tenantId", "status", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_tenantId_number_key" ON "platform"."Invoice"("tenantId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_externalPaymentId_key" ON "platform"."Payment"("externalPaymentId");

-- CreateIndex
CREATE INDEX "Payment_tenantId_status_createdAt_idx" ON "platform"."Payment"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_status_idx" ON "platform"."Payment"("invoiceId", "status");

-- CreateIndex
CREATE INDEX "AssessmentCategory_tenantId_parentId_sortOrder_deletedAt_idx" ON "content"."AssessmentCategory"("tenantId", "parentId", "sortOrder", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentCategory_tenantId_code_key" ON "content"."AssessmentCategory"("tenantId", "code");

-- CreateIndex
CREATE INDEX "DifficultyLevel_tenantId_status_deletedAt_idx" ON "content"."DifficultyLevel"("tenantId", "status", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DifficultyLevel_tenantId_code_key" ON "content"."DifficultyLevel"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "DifficultyLevel_tenantId_rank_key" ON "content"."DifficultyLevel"("tenantId", "rank");

-- CreateIndex
CREATE INDEX "QualityCriterion_tenantId_categoryId_status_deletedAt_idx" ON "content"."QualityCriterion"("tenantId", "categoryId", "status", "deletedAt");

-- CreateIndex
CREATE INDEX "QualityCriterion_tenantId_parentId_idx" ON "content"."QualityCriterion"("tenantId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "QualityCriterion_tenantId_code_key" ON "content"."QualityCriterion"("tenantId", "code");

-- CreateIndex
CREATE INDEX "Tag_tenantId_deletedAt_idx" ON "content"."Tag"("tenantId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_tenantId_key_key" ON "content"."Tag"("tenantId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_currentVersionId_key" ON "content"."MediaAsset"("currentVersionId");

-- CreateIndex
CREATE INDEX "MediaAsset_tenantId_kind_status_deletedAt_idx" ON "content"."MediaAsset"("tenantId", "kind", "status", "deletedAt");

-- CreateIndex
CREATE INDEX "MediaAsset_tenantId_createdAt_idx" ON "content"."MediaAsset"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "MediaAssetVersion_tenantId_checksumSha256_idx" ON "content"."MediaAssetVersion"("tenantId", "checksumSha256");

-- CreateIndex
CREATE INDEX "MediaAssetVersion_tenantId_createdAt_idx" ON "content"."MediaAssetVersion"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAssetVersion_assetId_versionNumber_key" ON "content"."MediaAssetVersion"("assetId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAssetVersion_tenantId_storageBucket_storageKey_key" ON "content"."MediaAssetVersion"("tenantId", "storageBucket", "storageKey");

-- CreateIndex
CREATE INDEX "AssetLineage_tenantId_childVersionId_idx" ON "content"."AssetLineage"("tenantId", "childVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "Question_currentVersionId_key" ON "content"."Question"("currentVersionId");

-- CreateIndex
CREATE INDEX "Question_tenantId_categoryId_difficultyLevelId_status_delet_idx" ON "content"."Question"("tenantId", "categoryId", "difficultyLevelId", "status", "deletedAt");

-- CreateIndex
CREATE INDEX "Question_tenantId_updatedAt_idx" ON "content"."Question"("tenantId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Question_tenantId_code_key" ON "content"."Question"("tenantId", "code");

-- CreateIndex
CREATE INDEX "QuestionVersion_tenantId_questionTypeId_status_publishedAt_idx" ON "content"."QuestionVersion"("tenantId", "questionTypeId", "status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionVersion_questionId_versionNumber_key" ON "content"."QuestionVersion"("questionId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionVersion_tenantId_contentHash_key" ON "content"."QuestionVersion"("tenantId", "contentHash");

-- CreateIndex
CREATE INDEX "QuestionOption_tenantId_questionVersionId_sortOrder_idx" ON "content"."QuestionOption"("tenantId", "questionVersionId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionOption_questionVersionId_optionKey_key" ON "content"."QuestionOption"("questionVersionId", "optionKey");

-- CreateIndex
CREATE INDEX "QuestionAnswerTarget_tenantId_qualityCriterionId_idx" ON "content"."QuestionAnswerTarget"("tenantId", "qualityCriterionId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionAnswerTarget_questionVersionId_targetKey_key" ON "content"."QuestionAnswerTarget"("questionVersionId", "targetKey");

-- CreateIndex
CREATE INDEX "QuestionVersionMedia_tenantId_mediaAssetVersionId_idx" ON "content"."QuestionVersionMedia"("tenantId", "mediaAssetVersionId");

-- CreateIndex
CREATE INDEX "QuestionTag_tenantId_tagId_idx" ON "content"."QuestionTag"("tenantId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningMaterial_currentVersionId_key" ON "learning"."LearningMaterial"("currentVersionId");

-- CreateIndex
CREATE INDEX "LearningMaterial_tenantId_categoryId_status_deletedAt_idx" ON "learning"."LearningMaterial"("tenantId", "categoryId", "status", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LearningMaterial_tenantId_code_key" ON "learning"."LearningMaterial"("tenantId", "code");

-- CreateIndex
CREATE INDEX "LearningMaterialVersion_tenantId_status_publishedAt_idx" ON "learning"."LearningMaterialVersion"("tenantId", "status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LearningMaterialVersion_materialId_versionNumber_key" ON "learning"."LearningMaterialVersion"("materialId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LearningMaterialVersion_tenantId_contentHash_key" ON "learning"."LearningMaterialVersion"("tenantId", "contentHash");

-- CreateIndex
CREATE INDEX "QuestionLearningMaterial_tenantId_learningMaterialVersionId_idx" ON "learning"."QuestionLearningMaterial"("tenantId", "learningMaterialVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentDefinition_currentVersionId_key" ON "assessment"."AssessmentDefinition"("currentVersionId");

-- CreateIndex
CREATE INDEX "AssessmentDefinition_tenantId_status_categoryId_deletedAt_idx" ON "assessment"."AssessmentDefinition"("tenantId", "status", "categoryId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentDefinition_tenantId_code_key" ON "assessment"."AssessmentDefinition"("tenantId", "code");

-- CreateIndex
CREATE INDEX "AssessmentVersion_tenantId_status_publishedAt_idx" ON "assessment"."AssessmentVersion"("tenantId", "status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentVersion_assessmentId_versionNumber_key" ON "assessment"."AssessmentVersion"("assessmentId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentVersion_tenantId_contentHash_key" ON "assessment"."AssessmentVersion"("tenantId", "contentHash");

-- CreateIndex
CREATE INDEX "AssessmentSection_tenantId_assessmentVersionId_idx" ON "assessment"."AssessmentSection"("tenantId", "assessmentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentSection_assessmentVersionId_sortOrder_key" ON "assessment"."AssessmentSection"("assessmentVersionId", "sortOrder");

-- CreateIndex
CREATE INDEX "AssessmentQuestion_tenantId_assessmentVersionId_sortOrder_idx" ON "assessment"."AssessmentQuestion"("tenantId", "assessmentVersionId", "sortOrder");

-- CreateIndex
CREATE INDEX "AssessmentQuestion_tenantId_questionVersionId_idx" ON "assessment"."AssessmentQuestion"("tenantId", "questionVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentQuestion_assessmentVersionId_questionVersionId_key" ON "assessment"."AssessmentQuestion"("assessmentVersionId", "questionVersionId");

-- CreateIndex
CREATE INDEX "QuestionPoolRule_tenantId_assessmentVersionId_idx" ON "assessment"."QuestionPoolRule"("tenantId", "assessmentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionPoolRule_assessmentVersionId_name_key" ON "assessment"."QuestionPoolRule"("assessmentVersionId", "name");

-- CreateIndex
CREATE INDEX "AssessmentSchedule_tenantId_status_startsAt_endsAt_idx" ON "assessment"."AssessmentSchedule"("tenantId", "status", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "AssessmentSchedule_tenantId_assessmentId_idx" ON "assessment"."AssessmentSchedule"("tenantId", "assessmentId");

-- CreateIndex
CREATE INDEX "ScheduleTarget_tenantId_scheduleId_scopeType_idx" ON "assessment"."ScheduleTarget"("tenantId", "scheduleId", "scopeType");

-- CreateIndex
CREATE INDEX "ScheduleTarget_tenantId_scopeType_targetId_idx" ON "assessment"."ScheduleTarget"("tenantId", "scopeType", "targetId");

-- CreateIndex
CREATE INDEX "ScheduleBlackoutDate_tenantId_localDate_idx" ON "assessment"."ScheduleBlackoutDate"("tenantId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleBlackoutDate_scheduleId_localDate_key" ON "assessment"."ScheduleBlackoutDate"("scheduleId", "localDate");

-- CreateIndex
CREATE INDEX "AssessmentCycle_tenantId_status_opensAt_closesAt_idx" ON "assessment"."AssessmentCycle"("tenantId", "status", "opensAt", "closesAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentCycle_scheduleId_cycleKey_key" ON "assessment"."AssessmentCycle"("scheduleId", "cycleKey");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentCycle_scheduleId_sequenceNumber_key" ON "assessment"."AssessmentCycle"("scheduleId", "sequenceNumber");

-- CreateIndex
CREATE INDEX "AssignmentCampaign_tenantId_source_opensAt_dueAt_idx" ON "assessment"."AssignmentCampaign"("tenantId", "source", "opensAt", "dueAt");

-- CreateIndex
CREATE INDEX "AssignmentCampaign_tenantId_cycleId_idx" ON "assessment"."AssignmentCampaign"("tenantId", "cycleId");

-- CreateIndex
CREATE INDEX "AssignmentTargetScope_tenantId_campaignId_scopeType_idx" ON "assessment"."AssignmentTargetScope"("tenantId", "campaignId", "scopeType");

-- CreateIndex
CREATE INDEX "AssignmentTargetScope_tenantId_scopeType_targetId_idx" ON "assessment"."AssignmentTargetScope"("tenantId", "scopeType", "targetId");

-- CreateIndex
CREATE INDEX "AssessmentAssignment_tenantId_membershipId_status_dueAt_idx" ON "assessment"."AssessmentAssignment"("tenantId", "membershipId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "AssessmentAssignment_tenantId_candidateApplicationId_status_idx" ON "assessment"."AssessmentAssignment"("tenantId", "candidateApplicationId", "status");

-- CreateIndex
CREATE INDEX "AssessmentAssignment_tenantId_campaignId_status_idx" ON "assessment"."AssessmentAssignment"("tenantId", "campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentPaper_assignmentId_key" ON "assessment"."AssessmentPaper"("assignmentId");

-- CreateIndex
CREATE INDEX "AssessmentPaper_tenantId_generatedAt_idx" ON "assessment"."AssessmentPaper"("tenantId", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentPaper_tenantId_contentHash_key" ON "assessment"."AssessmentPaper"("tenantId", "contentHash");

-- CreateIndex
CREATE INDEX "AssessmentPaperQuestion_tenantId_questionVersionId_idx" ON "assessment"."AssessmentPaperQuestion"("tenantId", "questionVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentPaperQuestion_paperId_questionOrder_key" ON "assessment"."AssessmentPaperQuestion"("paperId", "questionOrder");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentAttempt_publicId_key" ON "assessment"."AssessmentAttempt"("publicId");

-- CreateIndex
CREATE INDEX "AssessmentAttempt_tenantId_membershipId_createdAt_idx" ON "assessment"."AssessmentAttempt"("tenantId", "membershipId", "createdAt");

-- CreateIndex
CREATE INDEX "AssessmentAttempt_tenantId_candidateApplicationId_createdAt_idx" ON "assessment"."AssessmentAttempt"("tenantId", "candidateApplicationId", "createdAt");

-- CreateIndex
CREATE INDEX "AssessmentAttempt_tenantId_status_submittedAt_idx" ON "assessment"."AssessmentAttempt"("tenantId", "status", "submittedAt");

-- CreateIndex
CREATE INDEX "AssessmentAttempt_tenantId_assignmentId_status_idx" ON "assessment"."AssessmentAttempt"("tenantId", "assignmentId", "status");

-- CreateIndex
CREATE INDEX "AssessmentAttempt_createdAt_idx" ON "assessment"."AssessmentAttempt" USING BRIN ("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentAttempt_assignmentId_attemptNumber_key" ON "assessment"."AssessmentAttempt"("assignmentId", "attemptNumber");

-- CreateIndex
CREATE INDEX "AttemptQuestion_tenantId_questionVersionId_createdAt_idx" ON "assessment"."AttemptQuestion"("tenantId", "questionVersionId", "createdAt");

-- CreateIndex
CREATE INDEX "AttemptQuestion_tenantId_status_updatedAt_idx" ON "assessment"."AttemptQuestion"("tenantId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AttemptQuestion_attemptId_questionOrder_key" ON "assessment"."AttemptQuestion"("attemptId", "questionOrder");

-- CreateIndex
CREATE UNIQUE INDEX "AttemptResponse_attemptQuestionId_key" ON "assessment"."AttemptResponse"("attemptQuestionId");

-- CreateIndex
CREATE INDEX "AttemptResponse_tenantId_savedAt_idx" ON "assessment"."AttemptResponse"("tenantId", "savedAt");

-- CreateIndex
CREATE INDEX "AttemptResponse_createdAt_idx" ON "assessment"."AttemptResponse" USING BRIN ("createdAt");

-- CreateIndex
CREATE INDEX "ResponseEvaluation_tenantId_qualityCriterionId_createdAt_idx" ON "assessment"."ResponseEvaluation"("tenantId", "qualityCriterionId", "createdAt");

-- CreateIndex
CREATE INDEX "ResponseEvaluation_tenantId_status_createdAt_idx" ON "assessment"."ResponseEvaluation"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ResponseEvaluation_createdAt_idx" ON "assessment"."ResponseEvaluation" USING BRIN ("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ResponseEvaluation_attemptQuestionId_answerTargetId_evaluat_key" ON "assessment"."ResponseEvaluation"("attemptQuestionId", "answerTargetId", "evaluationVersion");

-- CreateIndex
CREATE INDEX "ManualReview_tenantId_reviewerMembershipId_status_dueAt_idx" ON "assessment"."ManualReview"("tenantId", "reviewerMembershipId", "status", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "ManualReview_attemptQuestionId_reviewRound_key" ON "assessment"."ManualReview"("attemptQuestionId", "reviewRound");

-- CreateIndex
CREATE INDEX "AttemptCategoryResult_tenantId_categoryId_createdAt_idx" ON "assessment"."AttemptCategoryResult"("tenantId", "categoryId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AttemptCategoryResult_attemptId_categoryId_key" ON "assessment"."AttemptCategoryResult"("attemptId", "categoryId");

-- CreateIndex
CREATE INDEX "IntegrityEvent_tenantId_attemptId_occurredAt_idx" ON "assessment"."IntegrityEvent"("tenantId", "attemptId", "occurredAt");

-- CreateIndex
CREATE INDEX "IntegrityEvent_occurredAt_idx" ON "assessment"."IntegrityEvent" USING BRIN ("occurredAt");

-- CreateIndex
CREATE INDEX "RetakeGrant_tenantId_assignmentId_expiresAt_idx" ON "assessment"."RetakeGrant"("tenantId", "assignmentId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "LearningPath_currentVersionId_key" ON "learning"."LearningPath"("currentVersionId");

-- CreateIndex
CREATE INDEX "LearningPath_tenantId_status_deletedAt_idx" ON "learning"."LearningPath"("tenantId", "status", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LearningPath_tenantId_code_key" ON "learning"."LearningPath"("tenantId", "code");

-- CreateIndex
CREATE INDEX "LearningPathVersion_tenantId_status_publishedAt_idx" ON "learning"."LearningPathVersion"("tenantId", "status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LearningPathVersion_learningPathId_versionNumber_key" ON "learning"."LearningPathVersion"("learningPathId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LearningPathVersion_tenantId_contentHash_key" ON "learning"."LearningPathVersion"("tenantId", "contentHash");

-- CreateIndex
CREATE INDEX "LearningPathItem_tenantId_materialVersionId_idx" ON "learning"."LearningPathItem"("tenantId", "materialVersionId");

-- CreateIndex
CREATE INDEX "LearningPathItem_tenantId_assessmentVersionId_idx" ON "learning"."LearningPathItem"("tenantId", "assessmentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningPathItem_learningPathVersionId_sortOrder_key" ON "learning"."LearningPathItem"("learningPathVersionId", "sortOrder");

-- CreateIndex
CREATE INDEX "LearningPathAssignment_tenantId_membershipId_status_dueAt_idx" ON "learning"."LearningPathAssignment"("tenantId", "membershipId", "status", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "LearningPathAssignment_learningPathVersionId_membershipId_a_key" ON "learning"."LearningPathAssignment"("learningPathVersionId", "membershipId", "assignedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LearningProgress_learningPathAssignmentId_key" ON "learning"."LearningProgress"("learningPathAssignmentId");

-- CreateIndex
CREATE INDEX "LearningProgress_tenantId_membershipId_status_lastActivityA_idx" ON "learning"."LearningProgress"("tenantId", "membershipId", "status", "lastActivityAt");

-- CreateIndex
CREATE INDEX "LearningItemProgress_tenantId_status_updatedAt_idx" ON "learning"."LearningItemProgress"("tenantId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LearningItemProgress_learningProgressId_pathItemId_key" ON "learning"."LearningItemProgress"("learningProgressId", "pathItemId");

-- CreateIndex
CREATE INDEX "CertificateTemplate_tenantId_status_deletedAt_idx" ON "learning"."CertificateTemplate"("tenantId", "status", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CertificateTemplate_tenantId_code_key" ON "learning"."CertificateTemplate"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_verificationCode_key" ON "learning"."Certificate"("verificationCode");

-- CreateIndex
CREATE INDEX "Certificate_tenantId_membershipId_status_issuedAt_idx" ON "learning"."Certificate"("tenantId", "membershipId", "status", "issuedAt");

-- CreateIndex
CREATE INDEX "Certificate_tenantId_expiresAt_idx" ON "learning"."Certificate"("tenantId", "expiresAt");

-- CreateIndex
CREATE INDEX "JobPosition_tenantId_departmentId_status_deletedAt_idx" ON "recruitment"."JobPosition"("tenantId", "departmentId", "status", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobPosition_tenantId_code_key" ON "recruitment"."JobPosition"("tenantId", "code");

-- CreateIndex
CREATE INDEX "RecruitmentDrive_tenantId_status_opensAt_closesAt_idx" ON "recruitment"."RecruitmentDrive"("tenantId", "status", "opensAt", "closesAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentDrive_tenantId_code_key" ON "recruitment"."RecruitmentDrive"("tenantId", "code");

-- CreateIndex
CREATE INDEX "RecruitmentDriveAssessment_tenantId_assessmentVersionId_idx" ON "recruitment"."RecruitmentDriveAssessment"("tenantId", "assessmentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentDriveAssessment_driveId_stageOrder_key" ON "recruitment"."RecruitmentDriveAssessment"("driveId", "stageOrder");

-- CreateIndex
CREATE INDEX "CandidateProfile_tenantId_status_retentionUntil_idx" ON "recruitment"."CandidateProfile"("tenantId", "status", "retentionUntil");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateProfile_tenantId_emailHash_key" ON "recruitment"."CandidateProfile"("tenantId", "emailHash");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateProfile_tenantId_externalRef_key" ON "recruitment"."CandidateProfile"("tenantId", "externalRef");

-- CreateIndex
CREATE INDEX "CandidateApplication_tenantId_driveId_status_rank_idx" ON "recruitment"."CandidateApplication"("tenantId", "driveId", "status", "rank");

-- CreateIndex
CREATE INDEX "CandidateApplication_tenantId_retentionUntil_idx" ON "recruitment"."CandidateApplication"("tenantId", "retentionUntil");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateApplication_candidateId_driveId_key" ON "recruitment"."CandidateApplication"("candidateId", "driveId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateInvitation_tokenHash_key" ON "recruitment"."CandidateInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "CandidateInvitation_tenantId_applicationId_expiresAt_idx" ON "recruitment"."CandidateInvitation"("tenantId", "applicationId", "expiresAt");

-- CreateIndex
CREATE INDEX "CandidateDecisionHistory_tenantId_applicationId_decidedAt_idx" ON "recruitment"."CandidateDecisionHistory"("tenantId", "applicationId", "decidedAt");

-- CreateIndex
CREATE INDEX "CandidateDecisionHistory_decidedAt_idx" ON "recruitment"."CandidateDecisionHistory" USING BRIN ("decidedAt");

-- CreateIndex
CREATE INDEX "LeaderboardDefinition_tenantId_status_scope_deletedAt_idx" ON "engagement"."LeaderboardDefinition"("tenantId", "status", "scope", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardDefinition_tenantId_code_key" ON "engagement"."LeaderboardDefinition"("tenantId", "code");

-- CreateIndex
CREATE INDEX "LeaderboardPeriod_tenantId_startsAt_endsAt_idx" ON "engagement"."LeaderboardPeriod"("tenantId", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardPeriod_leaderboardId_periodKey_key" ON "engagement"."LeaderboardPeriod"("leaderboardId", "periodKey");

-- CreateIndex
CREATE INDEX "LeaderboardEntry_tenantId_membershipId_computedAt_idx" ON "engagement"."LeaderboardEntry"("tenantId", "membershipId", "computedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardEntry_periodId_membershipId_key" ON "engagement"."LeaderboardEntry"("periodId", "membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardEntry_periodId_rank_key" ON "engagement"."LeaderboardEntry"("periodId", "rank");

-- CreateIndex
CREATE INDEX "BadgeDefinition_tenantId_status_deletedAt_idx" ON "engagement"."BadgeDefinition"("tenantId", "status", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BadgeDefinition_tenantId_code_key" ON "engagement"."BadgeDefinition"("tenantId", "code");

-- CreateIndex
CREATE INDEX "BadgeAward_tenantId_membershipId_awardedAt_idx" ON "engagement"."BadgeAward"("tenantId", "membershipId", "awardedAt");

-- CreateIndex
CREATE INDEX "BadgeAward_tenantId_badgeId_revokedAt_idx" ON "engagement"."BadgeAward"("tenantId", "badgeId", "revokedAt");

-- CreateIndex
CREATE INDEX "RewardPointLedger_tenantId_membershipId_occurredAt_idx" ON "engagement"."RewardPointLedger"("tenantId", "membershipId", "occurredAt");

-- CreateIndex
CREATE INDEX "RewardPointLedger_occurredAt_idx" ON "engagement"."RewardPointLedger" USING BRIN ("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "RewardPointLedger_tenantId_idempotencyKey_key" ON "engagement"."RewardPointLedger"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "RewardCatalogueItem_tenantId_status_deletedAt_idx" ON "engagement"."RewardCatalogueItem"("tenantId", "status", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RewardCatalogueItem_tenantId_code_key" ON "engagement"."RewardCatalogueItem"("tenantId", "code");

-- CreateIndex
CREATE INDEX "RewardRedemption_tenantId_membershipId_status_requestedAt_idx" ON "engagement"."RewardRedemption"("tenantId", "membershipId", "status", "requestedAt");

-- CreateIndex
CREATE INDEX "RewardRedemption_tenantId_catalogueItemId_status_idx" ON "engagement"."RewardRedemption"("tenantId", "catalogueItemId", "status");

-- CreateIndex
CREATE INDEX "NotificationTemplate_tenantId_status_key_idx" ON "communications"."NotificationTemplate"("tenantId", "status", "key");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_tenantId_key_channel_locale_version_key" ON "communications"."NotificationTemplate"("tenantId", "key", "channel", "locale", "version");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_membershipId_key" ON "communications"."NotificationPreference"("membershipId");

-- CreateIndex
CREATE INDEX "NotificationPreference_tenantId_updatedAt_idx" ON "communications"."NotificationPreference"("tenantId", "updatedAt");

-- CreateIndex
CREATE INDEX "NotificationDelivery_tenantId_status_nextAttemptAt_idx" ON "communications"."NotificationDelivery"("tenantId", "status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "NotificationDelivery_tenantId_recipientMembershipId_created_idx" ON "communications"."NotificationDelivery"("tenantId", "recipientMembershipId", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationDelivery_createdAt_idx" ON "communications"."NotificationDelivery" USING BRIN ("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDelivery_tenantId_deduplicationKey_key" ON "communications"."NotificationDelivery"("tenantId", "deduplicationKey");

-- CreateIndex
CREATE INDEX "ReportDefinition_tenantId_status_deletedAt_idx" ON "communications"."ReportDefinition"("tenantId", "status", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReportDefinition_tenantId_code_key" ON "communications"."ReportDefinition"("tenantId", "code");

-- CreateIndex
CREATE INDEX "ReportRun_tenantId_status_requestedAt_idx" ON "communications"."ReportRun"("tenantId", "status", "requestedAt");

-- CreateIndex
CREATE INDEX "ReportRun_requestedAt_idx" ON "communications"."ReportRun" USING BRIN ("requestedAt");

-- CreateIndex
CREATE INDEX "EmployeeMetricPeriod_tenantId_periodStart_periodEnd_idx" ON "communications"."EmployeeMetricPeriod"("tenantId", "periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeMetricPeriod_tenantId_membershipId_periodStart_peri_key" ON "communications"."EmployeeMetricPeriod"("tenantId", "membershipId", "periodStart", "periodEnd", "metricVersion");

-- CreateIndex
CREATE INDEX "OrganizationMetricPeriod_tenantId_periodStart_periodEnd_idx" ON "communications"."OrganizationMetricPeriod"("tenantId", "periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMetricPeriod_tenantId_scopeType_scopeId_periodS_key" ON "communications"."OrganizationMetricPeriod"("tenantId", "scopeType", "scopeId", "periodStart", "periodEnd", "metricVersion");

-- CreateIndex
CREATE INDEX "QuestionMetricPeriod_tenantId_periodStart_periodEnd_idx" ON "communications"."QuestionMetricPeriod"("tenantId", "periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionMetricPeriod_tenantId_questionVersionId_periodStart_key" ON "communications"."QuestionMetricPeriod"("tenantId", "questionVersionId", "periodStart", "periodEnd", "metricVersion");

-- CreateIndex
CREATE UNIQUE INDEX "AIProvider_key_key" ON "ai"."AIProvider"("key");

-- CreateIndex
CREATE INDEX "AIProvider_status_idx" ON "ai"."AIProvider"("status");

-- CreateIndex
CREATE INDEX "AIModel_status_idx" ON "ai"."AIModel"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AIModel_providerId_providerModelKey_key" ON "ai"."AIModel"("providerId", "providerModelKey");

-- CreateIndex
CREATE INDEX "TenantAIProviderConfiguration_tenantId_status_deletedAt_idx" ON "ai"."TenantAIProviderConfiguration"("tenantId", "status", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TenantAIProviderConfiguration_tenantId_providerId_key" ON "ai"."TenantAIProviderConfiguration"("tenantId", "providerId");

-- CreateIndex
CREATE INDEX "AIModelConfiguration_tenantId_purpose_status_deletedAt_idx" ON "ai"."AIModelConfiguration"("tenantId", "purpose", "status", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AIModelConfiguration_tenantId_key_key" ON "ai"."AIModelConfiguration"("tenantId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "AIPrompt_currentVersionId_key" ON "ai"."AIPrompt"("currentVersionId");

-- CreateIndex
CREATE INDEX "AIPrompt_tenantId_purpose_status_deletedAt_idx" ON "ai"."AIPrompt"("tenantId", "purpose", "status", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AIPrompt_tenantId_key_key" ON "ai"."AIPrompt"("tenantId", "key");

-- CreateIndex
CREATE INDEX "AIPromptTemplate_tenantId_promptId_sortOrder_idx" ON "ai"."AIPromptTemplate"("tenantId", "promptId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "AIPromptTemplate_promptId_key_key" ON "ai"."AIPromptTemplate"("promptId", "key");

-- CreateIndex
CREATE INDEX "AIPromptVersion_tenantId_status_publishedAt_idx" ON "ai"."AIPromptVersion"("tenantId", "status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AIPromptVersion_promptId_versionNumber_key" ON "ai"."AIPromptVersion"("promptId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AIPromptVersion_tenantId_contentHash_key" ON "ai"."AIPromptVersion"("tenantId", "contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "AIPromptExecution_publicId_key" ON "ai"."AIPromptExecution"("publicId");

-- CreateIndex
CREATE INDEX "AIPromptExecution_tenantId_purpose_status_createdAt_idx" ON "ai"."AIPromptExecution"("tenantId", "purpose", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AIPromptExecution_tenantId_sourceType_sourceId_idx" ON "ai"."AIPromptExecution"("tenantId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "AIPromptExecution_createdAt_idx" ON "ai"."AIPromptExecution" USING BRIN ("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AIPromptExecution_tenantId_idempotencyKey_key" ON "ai"."AIPromptExecution"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "AIPromptLog_tenantId_level_occurredAt_idx" ON "ai"."AIPromptLog"("tenantId", "level", "occurredAt");

-- CreateIndex
CREATE INDEX "AIPromptLog_occurredAt_idx" ON "ai"."AIPromptLog" USING BRIN ("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "AIPromptLog_executionId_sequence_key" ON "ai"."AIPromptLog"("executionId", "sequence");

-- CreateIndex
CREATE INDEX "AITokenUsage_tenantId_measuredAt_idx" ON "ai"."AITokenUsage"("tenantId", "measuredAt");

-- CreateIndex
CREATE INDEX "AITokenUsage_executionId_idx" ON "ai"."AITokenUsage"("executionId");

-- CreateIndex
CREATE INDEX "AITokenUsage_measuredAt_idx" ON "ai"."AITokenUsage" USING BRIN ("measuredAt");

-- CreateIndex
CREATE INDEX "AICostTracking_tenantId_incurredAt_idx" ON "ai"."AICostTracking"("tenantId", "incurredAt");

-- CreateIndex
CREATE INDEX "AICostTracking_executionId_idx" ON "ai"."AICostTracking"("executionId");

-- CreateIndex
CREATE INDEX "AICostTracking_incurredAt_idx" ON "ai"."AICostTracking" USING BRIN ("incurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "SVGAsset_mediaAssetVersionId_key" ON "ai"."SVGAsset"("mediaAssetVersionId");

-- CreateIndex
CREATE INDEX "SVGAsset_tenantId_createdAt_idx" ON "ai"."SVGAsset"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SVGAsset_tenantId_sanitizedHash_key" ON "ai"."SVGAsset"("tenantId", "sanitizedHash");

-- CreateIndex
CREATE INDEX "GeneratedImage_tenantId_createdAt_idx" ON "ai"."GeneratedImage"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "GeneratedImage_tenantId_executionId_idx" ON "ai"."GeneratedImage"("tenantId", "executionId");

-- CreateIndex
CREATE INDEX "ImageCache_tenantId_expiresAt_idx" ON "ai"."ImageCache"("tenantId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImageCache_tenantId_cacheKey_policyVersion_key" ON "ai"."ImageCache"("tenantId", "cacheKey", "policyVersion");

-- CreateIndex
CREATE INDEX "QuestionGenerationHistory_tenantId_createdAt_idx" ON "ai"."QuestionGenerationHistory"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "QuestionGenerationHistory_tenantId_generatedQuestionVersion_idx" ON "ai"."QuestionGenerationHistory"("tenantId", "generatedQuestionVersionId");

-- CreateIndex
CREATE INDEX "AIEvaluationHistory_tenantId_evaluationType_createdAt_idx" ON "ai"."AIEvaluationHistory"("tenantId", "evaluationType", "createdAt");

-- CreateIndex
CREATE INDEX "AIEvaluationHistory_tenantId_attemptId_idx" ON "ai"."AIEvaluationHistory"("tenantId", "attemptId");

-- CreateIndex
CREATE INDEX "AIFeedbackHistory_tenantId_subjectType_subjectId_createdAt_idx" ON "ai"."AIFeedbackHistory"("tenantId", "subjectType", "subjectId", "createdAt");

-- CreateIndex
CREATE INDEX "AIRecommendation_tenantId_subjectType_subjectId_status_idx" ON "ai"."AIRecommendation"("tenantId", "subjectType", "subjectId", "status");

-- CreateIndex
CREATE INDEX "AIRecommendation_tenantId_expiresAt_idx" ON "ai"."AIRecommendation"("tenantId", "expiresAt");

-- CreateIndex
CREATE INDEX "AgentRun_tenantId_status_createdAt_idx" ON "ai"."AgentRun"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AgentRun_tenantId_agentKey_agentVersion_idx" ON "ai"."AgentRun"("tenantId", "agentKey", "agentVersion");

-- CreateIndex
CREATE INDEX "AgentRunStep_tenantId_status_createdAt_idx" ON "ai"."AgentRunStep"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgentRunStep_agentRunId_sequence_key" ON "ai"."AgentRunStep"("agentRunId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvent_eventHash_key" ON "operations"."AuditEvent"("eventHash");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_entityType_entityId_occurredAt_idx" ON "operations"."AuditEvent"("tenantId", "entityType", "entityId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_actorId_occurredAt_idx" ON "operations"."AuditEvent"("tenantId", "actorId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_action_outcome_occurredAt_idx" ON "operations"."AuditEvent"("tenantId", "action", "outcome", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_occurredAt_idx" ON "operations"."AuditEvent" USING BRIN ("occurredAt");

-- CreateIndex
CREATE INDEX "AuthorizationDecision_tenantId_actorId_evaluatedAt_idx" ON "operations"."AuthorizationDecision"("tenantId", "actorId", "evaluatedAt");

-- CreateIndex
CREATE INDEX "AuthorizationDecision_tenantId_resourceType_resourceId_eval_idx" ON "operations"."AuthorizationDecision"("tenantId", "resourceType", "resourceId", "evaluatedAt");

-- CreateIndex
CREATE INDEX "AuthorizationDecision_evaluatedAt_idx" ON "operations"."AuthorizationDecision" USING BRIN ("evaluatedAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_availableAt_idx" ON "operations"."OutboxEvent"("status", "availableAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_tenantId_aggregateType_aggregateId_idx" ON "operations"."OutboxEvent"("tenantId", "aggregateType", "aggregateId");

-- CreateIndex
CREATE INDEX "OutboxEvent_createdAt_idx" ON "operations"."OutboxEvent" USING BRIN ("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_tenantId_idempotencyKey_key" ON "operations"."OutboxEvent"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "operations"."IdempotencyRecord"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_tenantId_scope_idempotencyKey_key" ON "operations"."IdempotencyRecord"("tenantId", "scope", "idempotencyKey");

-- CreateIndex
CREATE INDEX "DataSubjectRequest_tenantId_status_dueAt_idx" ON "operations"."DataSubjectRequest"("tenantId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "DataSubjectRequest_tenantId_subjectType_subjectId_createdAt_idx" ON "operations"."DataSubjectRequest"("tenantId", "subjectType", "subjectId", "createdAt");

-- AddForeignKey
ALTER TABLE "platform"."UserCredential" ADD CONSTRAINT "UserCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "platform"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."UserIdentity" ADD CONSTRAINT "UserIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "platform"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "platform"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."UserSession" ADD CONSTRAINT "UserSession_activeTenantId_fkey" FOREIGN KEY ("activeTenantId") REFERENCES "core"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "platform"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."PlatformRolePermission" ADD CONSTRAINT "PlatformRolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "platform"."PlatformRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."PlatformRolePermission" ADD CONSTRAINT "PlatformRolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "platform"."Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."PlatformUserRole" ADD CONSTRAINT "PlatformUserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "platform"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."PlatformUserRole" ADD CONSTRAINT "PlatformUserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "platform"."PlatformRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."PlanEntitlement" ADD CONSTRAINT "PlanEntitlement_planId_fkey" FOREIGN KEY ("planId") REFERENCES "platform"."SubscriptionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."TenantDomain" ADD CONSTRAINT "TenantDomain_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "core"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."TenantBranding" ADD CONSTRAINT "TenantBranding_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "core"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."TenantBranding" ADD CONSTRAINT "TenantBranding_logoAssetVersionId_fkey" FOREIGN KEY ("logoAssetVersionId") REFERENCES "content"."MediaAssetVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."Branch" ADD CONSTRAINT "Branch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "core"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."Department" ADD CONSTRAINT "Department_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "core"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."Department" ADD CONSTRAINT "Department_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "core"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."Department" ADD CONSTRAINT "Department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "core"."Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."Team" ADD CONSTRAINT "Team_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "core"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."Team" ADD CONSTRAINT "Team_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "core"."Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."TenantMembership" ADD CONSTRAINT "TenantMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "core"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."TenantMembership" ADD CONSTRAINT "TenantMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "platform"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."TenantMembership" ADD CONSTRAINT "TenantMembership_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "core"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."TenantMembership" ADD CONSTRAINT "TenantMembership_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "core"."Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."TenantMembership" ADD CONSTRAINT "TenantMembership_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "core"."TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."TeamMembership" ADD CONSTRAINT "TeamMembership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "core"."Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."TeamMembership" ADD CONSTRAINT "TeamMembership_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "core"."TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."TenantRole" ADD CONSTRAINT "TenantRole_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "core"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."TenantRolePermission" ADD CONSTRAINT "TenantRolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "core"."TenantRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."TenantRolePermission" ADD CONSTRAINT "TenantRolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "platform"."Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."MembershipRole" ADD CONSTRAINT "MembershipRole_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "core"."TenantMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."MembershipRole" ADD CONSTRAINT "MembershipRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "core"."TenantRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."SupportAccessGrant" ADD CONSTRAINT "SupportAccessGrant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "core"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."SupportAccessGrant" ADD CONSTRAINT "SupportAccessGrant_granteeUserId_fkey" FOREIGN KEY ("granteeUserId") REFERENCES "platform"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."SupportAccessGrant" ADD CONSTRAINT "SupportAccessGrant_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "platform"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."TenantSubscription" ADD CONSTRAINT "TenantSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "core"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."TenantSubscription" ADD CONSTRAINT "TenantSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "platform"."SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."Invoice" ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "core"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."Invoice" ADD CONSTRAINT "Invoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "platform"."TenantSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."Payment" ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "core"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "platform"."Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."AssessmentCategory" ADD CONSTRAINT "AssessmentCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "core"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."AssessmentCategory" ADD CONSTRAINT "AssessmentCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "content"."AssessmentCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."DifficultyLevel" ADD CONSTRAINT "DifficultyLevel_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "core"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."QualityCriterion" ADD CONSTRAINT "QualityCriterion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "core"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."QualityCriterion" ADD CONSTRAINT "QualityCriterion_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "content"."AssessmentCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."QualityCriterion" ADD CONSTRAINT "QualityCriterion_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "content"."QualityCriterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."Tag" ADD CONSTRAINT "Tag_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "core"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."MediaAsset" ADD CONSTRAINT "MediaAsset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "core"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."MediaAsset" ADD CONSTRAINT "MediaAsset_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "content"."MediaAssetVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."MediaAssetVersion" ADD CONSTRAINT "MediaAssetVersion_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "content"."MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."AssetLineage" ADD CONSTRAINT "AssetLineage_parentVersionId_fkey" FOREIGN KEY ("parentVersionId") REFERENCES "content"."MediaAssetVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."AssetLineage" ADD CONSTRAINT "AssetLineage_childVersionId_fkey" FOREIGN KEY ("childVersionId") REFERENCES "content"."MediaAssetVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."Question" ADD CONSTRAINT "Question_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "core"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."Question" ADD CONSTRAINT "Question_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "content"."AssessmentCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."Question" ADD CONSTRAINT "Question_difficultyLevelId_fkey" FOREIGN KEY ("difficultyLevelId") REFERENCES "content"."DifficultyLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."Question" ADD CONSTRAINT "Question_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "content"."QuestionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."QuestionVersion" ADD CONSTRAINT "QuestionVersion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "content"."Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."QuestionVersion" ADD CONSTRAINT "QuestionVersion_questionTypeId_fkey" FOREIGN KEY ("questionTypeId") REFERENCES "platform"."QuestionType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."QuestionOption" ADD CONSTRAINT "QuestionOption_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "content"."QuestionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."QuestionOption" ADD CONSTRAINT "QuestionOption_mediaAssetVersionId_fkey" FOREIGN KEY ("mediaAssetVersionId") REFERENCES "content"."MediaAssetVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."QuestionAnswerTarget" ADD CONSTRAINT "QuestionAnswerTarget_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "content"."QuestionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."QuestionAnswerTarget" ADD CONSTRAINT "QuestionAnswerTarget_qualityCriterionId_fkey" FOREIGN KEY ("qualityCriterionId") REFERENCES "content"."QualityCriterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."QuestionVersionMedia" ADD CONSTRAINT "QuestionVersionMedia_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "content"."QuestionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."QuestionVersionMedia" ADD CONSTRAINT "QuestionVersionMedia_mediaAssetVersionId_fkey" FOREIGN KEY ("mediaAssetVersionId") REFERENCES "content"."MediaAssetVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."QuestionTag" ADD CONSTRAINT "QuestionTag_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "content"."Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."QuestionTag" ADD CONSTRAINT "QuestionTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "content"."Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."LearningMaterial" ADD CONSTRAINT "LearningMaterial_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "core"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."LearningMaterial" ADD CONSTRAINT "LearningMaterial_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "content"."AssessmentCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."LearningMaterial" ADD CONSTRAINT "LearningMaterial_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "learning"."LearningMaterialVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."LearningMaterialVersion" ADD CONSTRAINT "LearningMaterialVersion_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "learning"."LearningMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."LearningMaterialVersion" ADD CONSTRAINT "LearningMaterialVersion_mediaAssetVersionId_fkey" FOREIGN KEY ("mediaAssetVersionId") REFERENCES "content"."MediaAssetVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."QuestionLearningMaterial" ADD CONSTRAINT "QuestionLearningMaterial_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "content"."QuestionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."QuestionLearningMaterial" ADD CONSTRAINT "QuestionLearningMaterial_learningMaterialVersionId_fkey" FOREIGN KEY ("learningMaterialVersionId") REFERENCES "learning"."LearningMaterialVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."AssessmentDefinition" ADD CONSTRAINT "AssessmentDefinition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "core"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."AssessmentDefinition" ADD CONSTRAINT "AssessmentDefinition_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "content"."AssessmentCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."AssessmentDefinition" ADD CONSTRAINT "AssessmentDefinition_difficultyLevelId_fkey" FOREIGN KEY ("difficultyLevelId") REFERENCES "content"."DifficultyLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."AssessmentDefinition" ADD CONSTRAINT "AssessmentDefinition_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "assessment"."AssessmentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."AssessmentVersion" ADD CONSTRAINT "AssessmentVersion_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessment"."AssessmentDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."AssessmentSection" ADD CONSTRAINT "AssessmentSection_assessmentVersionId_fkey" FOREIGN KEY ("assessmentVersionId") REFERENCES "assessment"."AssessmentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."AssessmentQuestion" ADD CONSTRAINT "AssessmentQuestion_assessmentVersionId_fkey" FOREIGN KEY ("assessmentVersionId") REFERENCES "assessment"."AssessmentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."AssessmentQuestion" ADD CONSTRAINT "AssessmentQuestion_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "assessment"."AssessmentSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."AssessmentQuestion" ADD CONSTRAINT "AssessmentQuestion_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "content"."QuestionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."QuestionPoolRule" ADD CONSTRAINT "QuestionPoolRule_assessmentVersionId_fkey" FOREIGN KEY ("assessmentVersionId") REFERENCES "assessment"."AssessmentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."QuestionPoolRule" ADD CONSTRAINT "QuestionPoolRule_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "assessment"."AssessmentSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."AssessmentSchedule" ADD CONSTRAINT "AssessmentSchedule_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessment"."AssessmentDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."ScheduleTarget" ADD CONSTRAINT "ScheduleTarget_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "assessment"."AssessmentSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."ScheduleBlackoutDate" ADD CONSTRAINT "ScheduleBlackoutDate_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "assessment"."AssessmentSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."AssessmentCycle" ADD CONSTRAINT "AssessmentCycle_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "assessment"."AssessmentSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."AssignmentCampaign" ADD CONSTRAINT "AssignmentCampaign_assessmentVersionId_fkey" FOREIGN KEY ("assessmentVersionId") REFERENCES "assessment"."AssessmentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."AssignmentCampaign" ADD CONSTRAINT "AssignmentCampaign_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "assessment"."AssessmentCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."AssignmentTargetScope" ADD CONSTRAINT "AssignmentTargetScope_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "assessment"."AssignmentCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."AssessmentAssignment" ADD CONSTRAINT "AssessmentAssignment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "assessment"."AssignmentCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."AssessmentAssignment" ADD CONSTRAINT "AssessmentAssignment_assessmentVersionId_fkey" FOREIGN KEY ("assessmentVersionId") REFERENCES "assessment"."AssessmentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."AssessmentAssignment" ADD CONSTRAINT "AssessmentAssignment_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "core"."TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."AssessmentAssignment" ADD CONSTRAINT "AssessmentAssignment_candidateApplicationId_fkey" FOREIGN KEY ("candidateApplicationId") REFERENCES "recruitment"."CandidateApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."AssessmentPaper" ADD CONSTRAINT "AssessmentPaper_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assessment"."AssessmentAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."AssessmentPaper" ADD CONSTRAINT "AssessmentPaper_assessmentVersionId_fkey" FOREIGN KEY ("assessmentVersionId") REFERENCES "assessment"."AssessmentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."AssessmentPaperQuestion" ADD CONSTRAINT "AssessmentPaperQuestion_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "assessment"."AssessmentPaper"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."AssessmentPaperQuestion" ADD CONSTRAINT "AssessmentPaperQuestion_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "content"."QuestionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assessment"."AssessmentAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "assessment"."AssessmentPaper"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "core"."TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_candidateApplicationId_fkey" FOREIGN KEY ("candidateApplicationId") REFERENCES "recruitment"."CandidateApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."AttemptQuestion" ADD CONSTRAINT "AttemptQuestion_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "assessment"."AssessmentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."AttemptQuestion" ADD CONSTRAINT "AttemptQuestion_paperQuestionId_fkey" FOREIGN KEY ("paperQuestionId") REFERENCES "assessment"."AssessmentPaperQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."AttemptQuestion" ADD CONSTRAINT "AttemptQuestion_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "content"."QuestionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."AttemptResponse" ADD CONSTRAINT "AttemptResponse_attemptQuestionId_fkey" FOREIGN KEY ("attemptQuestionId") REFERENCES "assessment"."AttemptQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."ResponseEvaluation" ADD CONSTRAINT "ResponseEvaluation_attemptQuestionId_fkey" FOREIGN KEY ("attemptQuestionId") REFERENCES "assessment"."AttemptQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."ResponseEvaluation" ADD CONSTRAINT "ResponseEvaluation_answerTargetId_fkey" FOREIGN KEY ("answerTargetId") REFERENCES "content"."QuestionAnswerTarget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."ResponseEvaluation" ADD CONSTRAINT "ResponseEvaluation_qualityCriterionId_fkey" FOREIGN KEY ("qualityCriterionId") REFERENCES "content"."QualityCriterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."ManualReview" ADD CONSTRAINT "ManualReview_attemptQuestionId_fkey" FOREIGN KEY ("attemptQuestionId") REFERENCES "assessment"."AttemptQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."ManualReview" ADD CONSTRAINT "ManualReview_reviewerMembershipId_fkey" FOREIGN KEY ("reviewerMembershipId") REFERENCES "core"."TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."AttemptCategoryResult" ADD CONSTRAINT "AttemptCategoryResult_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "assessment"."AssessmentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."AttemptCategoryResult" ADD CONSTRAINT "AttemptCategoryResult_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "content"."AssessmentCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."IntegrityEvent" ADD CONSTRAINT "IntegrityEvent_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "assessment"."AssessmentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."RetakeGrant" ADD CONSTRAINT "RetakeGrant_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assessment"."AssessmentAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."LearningPath" ADD CONSTRAINT "LearningPath_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "core"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."LearningPath" ADD CONSTRAINT "LearningPath_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "learning"."LearningPathVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."LearningPathVersion" ADD CONSTRAINT "LearningPathVersion_learningPathId_fkey" FOREIGN KEY ("learningPathId") REFERENCES "learning"."LearningPath"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."LearningPathItem" ADD CONSTRAINT "LearningPathItem_learningPathVersionId_fkey" FOREIGN KEY ("learningPathVersionId") REFERENCES "learning"."LearningPathVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."LearningPathItem" ADD CONSTRAINT "LearningPathItem_materialVersionId_fkey" FOREIGN KEY ("materialVersionId") REFERENCES "learning"."LearningMaterialVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."LearningPathItem" ADD CONSTRAINT "LearningPathItem_assessmentVersionId_fkey" FOREIGN KEY ("assessmentVersionId") REFERENCES "assessment"."AssessmentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."LearningPathAssignment" ADD CONSTRAINT "LearningPathAssignment_learningPathVersionId_fkey" FOREIGN KEY ("learningPathVersionId") REFERENCES "learning"."LearningPathVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."LearningPathAssignment" ADD CONSTRAINT "LearningPathAssignment_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "core"."TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."LearningProgress" ADD CONSTRAINT "LearningProgress_learningPathAssignmentId_fkey" FOREIGN KEY ("learningPathAssignmentId") REFERENCES "learning"."LearningPathAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."LearningProgress" ADD CONSTRAINT "LearningProgress_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "core"."TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."LearningItemProgress" ADD CONSTRAINT "LearningItemProgress_learningProgressId_fkey" FOREIGN KEY ("learningProgressId") REFERENCES "learning"."LearningProgress"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."LearningItemProgress" ADD CONSTRAINT "LearningItemProgress_pathItemId_fkey" FOREIGN KEY ("pathItemId") REFERENCES "learning"."LearningPathItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."Certificate" ADD CONSTRAINT "Certificate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "learning"."CertificateTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."Certificate" ADD CONSTRAINT "Certificate_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "core"."TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."Certificate" ADD CONSTRAINT "Certificate_learningPathAssignmentId_fkey" FOREIGN KEY ("learningPathAssignmentId") REFERENCES "learning"."LearningPathAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."Certificate" ADD CONSTRAINT "Certificate_assessmentAttemptId_fkey" FOREIGN KEY ("assessmentAttemptId") REFERENCES "assessment"."AssessmentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruitment"."RecruitmentDrive" ADD CONSTRAINT "RecruitmentDrive_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "core"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruitment"."RecruitmentDrive" ADD CONSTRAINT "RecruitmentDrive_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "recruitment"."JobPosition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruitment"."RecruitmentDriveAssessment" ADD CONSTRAINT "RecruitmentDriveAssessment_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "recruitment"."RecruitmentDrive"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruitment"."RecruitmentDriveAssessment" ADD CONSTRAINT "RecruitmentDriveAssessment_assessmentVersionId_fkey" FOREIGN KEY ("assessmentVersionId") REFERENCES "assessment"."AssessmentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruitment"."CandidateProfile" ADD CONSTRAINT "CandidateProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "core"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruitment"."CandidateApplication" ADD CONSTRAINT "CandidateApplication_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "recruitment"."CandidateProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruitment"."CandidateApplication" ADD CONSTRAINT "CandidateApplication_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "recruitment"."RecruitmentDrive"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruitment"."CandidateInvitation" ADD CONSTRAINT "CandidateInvitation_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "recruitment"."CandidateApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruitment"."CandidateDecisionHistory" ADD CONSTRAINT "CandidateDecisionHistory_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "recruitment"."CandidateApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement"."LeaderboardDefinition" ADD CONSTRAINT "LeaderboardDefinition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "core"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement"."LeaderboardPeriod" ADD CONSTRAINT "LeaderboardPeriod_leaderboardId_fkey" FOREIGN KEY ("leaderboardId") REFERENCES "engagement"."LeaderboardDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement"."LeaderboardEntry" ADD CONSTRAINT "LeaderboardEntry_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "engagement"."LeaderboardPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement"."LeaderboardEntry" ADD CONSTRAINT "LeaderboardEntry_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "core"."TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement"."BadgeDefinition" ADD CONSTRAINT "BadgeDefinition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "core"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement"."BadgeAward" ADD CONSTRAINT "BadgeAward_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "engagement"."BadgeDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement"."BadgeAward" ADD CONSTRAINT "BadgeAward_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "core"."TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement"."RewardPointLedger" ADD CONSTRAINT "RewardPointLedger_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "core"."TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement"."RewardCatalogueItem" ADD CONSTRAINT "RewardCatalogueItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "core"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement"."RewardCatalogueItem" ADD CONSTRAINT "RewardCatalogueItem_rewardTypeId_fkey" FOREIGN KEY ("rewardTypeId") REFERENCES "platform"."RewardType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement"."RewardRedemption" ADD CONSTRAINT "RewardRedemption_catalogueItemId_fkey" FOREIGN KEY ("catalogueItemId") REFERENCES "engagement"."RewardCatalogueItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement"."RewardRedemption" ADD CONSTRAINT "RewardRedemption_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "core"."TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications"."NotificationTemplate" ADD CONSTRAINT "NotificationTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "core"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications"."NotificationPreference" ADD CONSTRAINT "NotificationPreference_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "core"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications"."NotificationPreference" ADD CONSTRAINT "NotificationPreference_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "core"."TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications"."NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "communications"."NotificationTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications"."NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_recipientMembershipId_fkey" FOREIGN KEY ("recipientMembershipId") REFERENCES "core"."TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications"."ReportDefinition" ADD CONSTRAINT "ReportDefinition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "core"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications"."ReportRun" ADD CONSTRAINT "ReportRun_reportDefinitionId_fkey" FOREIGN KEY ("reportDefinitionId") REFERENCES "communications"."ReportDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications"."EmployeeMetricPeriod" ADD CONSTRAINT "EmployeeMetricPeriod_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "core"."TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai"."AIModel" ADD CONSTRAINT "AIModel_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ai"."AIProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai"."TenantAIProviderConfiguration" ADD CONSTRAINT "TenantAIProviderConfiguration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "core"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai"."TenantAIProviderConfiguration" ADD CONSTRAINT "TenantAIProviderConfiguration_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ai"."AIProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai"."AIModelConfiguration" ADD CONSTRAINT "AIModelConfiguration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "core"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai"."AIModelConfiguration" ADD CONSTRAINT "AIModelConfiguration_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ai"."AIModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai"."AIPrompt" ADD CONSTRAINT "AIPrompt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "core"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai"."AIPrompt" ADD CONSTRAINT "AIPrompt_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "ai"."AIPromptVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai"."AIPromptTemplate" ADD CONSTRAINT "AIPromptTemplate_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "ai"."AIPrompt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai"."AIPromptVersion" ADD CONSTRAINT "AIPromptVersion_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "ai"."AIPrompt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai"."AIPromptExecution" ADD CONSTRAINT "AIPromptExecution_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "ai"."AIPromptVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai"."AIPromptExecution" ADD CONSTRAINT "AIPromptExecution_modelConfigurationId_fkey" FOREIGN KEY ("modelConfigurationId") REFERENCES "ai"."AIModelConfiguration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai"."AIPromptLog" ADD CONSTRAINT "AIPromptLog_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "ai"."AIPromptExecution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai"."AITokenUsage" ADD CONSTRAINT "AITokenUsage_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "ai"."AIPromptExecution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai"."AICostTracking" ADD CONSTRAINT "AICostTracking_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "ai"."AIPromptExecution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai"."SVGAsset" ADD CONSTRAINT "SVGAsset_mediaAssetVersionId_fkey" FOREIGN KEY ("mediaAssetVersionId") REFERENCES "content"."MediaAssetVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai"."GeneratedImage" ADD CONSTRAINT "GeneratedImage_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "ai"."AIPromptExecution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai"."GeneratedImage" ADD CONSTRAINT "GeneratedImage_mediaAssetVersionId_fkey" FOREIGN KEY ("mediaAssetVersionId") REFERENCES "content"."MediaAssetVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai"."ImageCache" ADD CONSTRAINT "ImageCache_generatedImageId_fkey" FOREIGN KEY ("generatedImageId") REFERENCES "ai"."GeneratedImage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai"."QuestionGenerationHistory" ADD CONSTRAINT "QuestionGenerationHistory_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "ai"."AIPromptExecution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai"."QuestionGenerationHistory" ADD CONSTRAINT "QuestionGenerationHistory_sourceQuestionId_fkey" FOREIGN KEY ("sourceQuestionId") REFERENCES "content"."Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai"."QuestionGenerationHistory" ADD CONSTRAINT "QuestionGenerationHistory_generatedQuestionVersionId_fkey" FOREIGN KEY ("generatedQuestionVersionId") REFERENCES "content"."QuestionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai"."AIEvaluationHistory" ADD CONSTRAINT "AIEvaluationHistory_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "ai"."AIPromptExecution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai"."AIEvaluationHistory" ADD CONSTRAINT "AIEvaluationHistory_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "assessment"."AssessmentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai"."AIFeedbackHistory" ADD CONSTRAINT "AIFeedbackHistory_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "ai"."AIPromptExecution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai"."AIFeedbackHistory" ADD CONSTRAINT "AIFeedbackHistory_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "ai"."AIFeedbackHistory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai"."AIRecommendation" ADD CONSTRAINT "AIRecommendation_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "ai"."AIPromptExecution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai"."AgentRun" ADD CONSTRAINT "AgentRun_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "ai"."AIPromptExecution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai"."AgentRun" ADD CONSTRAINT "AgentRun_modelConfigurationId_fkey" FOREIGN KEY ("modelConfigurationId") REFERENCES "ai"."AIModelConfiguration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai"."AgentRunStep" ADD CONSTRAINT "AgentRunStep_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "ai"."AgentRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations"."AuditEvent" ADD CONSTRAINT "AuditEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "core"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations"."OutboxEvent" ADD CONSTRAINT "OutboxEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "core"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations"."DataSubjectRequest" ADD CONSTRAINT "DataSubjectRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "core"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

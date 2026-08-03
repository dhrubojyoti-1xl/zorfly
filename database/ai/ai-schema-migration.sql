-- =============================================================================
-- AI schema — isolated, additive migration (reference)
-- =============================================================================
-- Purpose: create the standalone `ai` Postgres schema and every table/enum/
--          index that belongs to it, extracted verbatim (statement-for-
--          statement) from the real, already-applied migration
--          database/migrations/20260731144500_initial_schema/migration.sql
--          in dhrubojyoti-1xl/zorfly. Nothing here was hand-written; every
--          statement below was mechanically selected because it references
--          the "ai" schema, then verified to still form complete, valid SQL
--          statements (see scripts used to produce this file in
--          integration/README.md's "database extraction" note).
--
-- Dependency: requires the following to already exist in the target
--             database before this file is applied:
--               * schemas:      core, content, assessment (already exist if
--                                you are running this against a checkout of
--                                dhrubojyoti-1xl/zorfly's own database)
--               * enum types:   "core"."RecordStatus", "content"."VersionStatus"
--               * tables:       "core"."Tenant", "content"."Question",
--                                "content"."QuestionVersion",
--                                "content"."MediaAssetVersion",
--                                "assessment"."AssessmentAttempt"
--             None of these are created by this file — this file only
--             creates objects inside the "ai" schema. See
--             database/ai/COMPATIBILITY.md for what a from-scratch adopter
--             (e.g. a MongoDB-based system with no such tables) would need
--             to stub or adapt instead.
--
-- Affected modules: none outside the "ai" schema. This migration does not
--                    ALTER any pre-existing table.
--
-- Schema impact: additive only — creates schema "ai", 4 enum types, 20
--                tables, 48 indexes, 29 foreign keys, all inside "ai".
--
-- Rollback: DROP SCHEMA "ai" CASCADE;
--           (irreversibly deletes all data in the ai schema; safe only
--           because nothing outside "ai" is created or modified here)
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS "ai";-- CreateEnum
CREATE TYPE "ai"."AIExecutionStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ai"."AIExecutionPurpose" AS ENUM ('QUESTION_GENERATION', 'RESPONSE_EVALUATION', 'FEEDBACK', 'RECOMMENDATION', 'IMAGE_GENERATION', 'SVG_GENERATION', 'MODERATION', 'AGENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ai"."AIRecommendationStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'DISMISSED', 'EXPIRED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ai"."AgentRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'WAITING_APPROVAL', 'SUCCEEDED', 'FAILED', 'CANCELLED');

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

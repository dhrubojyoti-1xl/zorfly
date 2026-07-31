# Zorfly Entity-Relationship Diagrams

## Reading the diagrams

The physical model is split into PostgreSQL schemas matching modular-monolith
ownership. Diagrams show logical cardinality; `schema.prisma` is authoritative
for columns, optionality, indexes, and referential actions. `tenantId` exists on
every tenant-owned entity even where it is omitted from the visual.

Polymorphic scope/source references are intentionally shown as values rather
than direct lines. Their allowed combinations and tenant checks are enforced by
custom migration constraints described in `MIGRATION_STRATEGY.md`.

## Platform, tenants, organization, RBAC, and billing

```mermaid
erDiagram
  User ||--o{ TenantMembership : joins
  User ||--o{ PlatformUserRole : receives
  PlatformRole ||--o{ PlatformUserRole : assigned
  PlatformRole ||--o{ PlatformRolePermission : grants
  Permission ||--o{ PlatformRolePermission : includes

  Tenant ||--o{ TenantDomain : verifies
  Tenant ||--o| TenantBranding : brands
  Tenant ||--o{ Branch : contains
  Tenant ||--o{ Department : contains
  Tenant ||--o{ Team : contains
  Tenant ||--o{ TenantMembership : employs
  Branch ||--o{ Department : groups
  Branch ||--o{ TenantMembership : locates
  Department ||--o{ Department : nests
  Department ||--o{ Team : groups
  Department ||--o{ TenantMembership : assigns
  TenantMembership ||--o{ TenantMembership : manages
  Team ||--o{ TeamMembership : contains
  TenantMembership ||--o{ TeamMembership : participates

  Tenant ||--o{ TenantRole : defines
  TenantRole ||--o{ TenantRolePermission : grants
  Permission ||--o{ TenantRolePermission : includes
  TenantMembership ||--o{ MembershipRole : receives
  TenantRole ||--o{ MembershipRole : assigned

  Tenant ||--o{ SupportAccessGrant : authorizes
  User ||--o{ SupportAccessGrant : receives
  SubscriptionPlan ||--o{ PlanEntitlement : includes
  SubscriptionPlan ||--o{ TenantSubscription : selected
  Tenant ||--o{ TenantSubscription : subscribes
  TenantSubscription ||--o{ Invoice : bills
  Invoice ||--o{ Payment : settles

  QuestionType {
    uuid id PK
    string key UK
  }
  RewardType {
    uuid id PK
    string key UK
  }
```

## Taxonomy, questions, and media

```mermaid
erDiagram
  Tenant ||--o{ AssessmentCategory : configures
  AssessmentCategory ||--o{ AssessmentCategory : nests
  Tenant ||--o{ DifficultyLevel : configures
  Tenant ||--o{ QualityCriterion : configures
  AssessmentCategory ||--o{ QualityCriterion : classifies
  QualityCriterion ||--o{ QualityCriterion : nests
  Tenant ||--o{ Tag : defines

  Tenant ||--o{ MediaAsset : owns
  MediaAsset ||--o{ MediaAssetVersion : versions
  MediaAsset ||--o| MediaAssetVersion : current
  MediaAssetVersion ||--o{ AssetLineage : parent
  MediaAssetVersion ||--o{ AssetLineage : child
  MediaAssetVersion ||--o{ TenantBranding : logo

  Tenant ||--o{ Question : owns
  AssessmentCategory ||--o{ Question : classifies
  DifficultyLevel ||--o{ Question : levels
  Question ||--o{ QuestionVersion : versions
  Question ||--o| QuestionVersion : current
  QuestionType ||--o{ QuestionVersion : types
  QuestionVersion ||--o{ QuestionOption : offers
  QuestionVersion ||--o{ QuestionAnswerTarget : defines
  QualityCriterion ||--o{ QuestionAnswerTarget : categorizes
  QuestionVersion ||--o{ QuestionVersionMedia : uses
  MediaAssetVersion ||--o{ QuestionVersionMedia : supplies
  Question ||--o{ QuestionTag : labels
  Tag ||--o{ QuestionTag : labels
  QuestionVersion ||--o{ QuestionLearningMaterial : remediates
  LearningMaterialVersion ||--o{ QuestionLearningMaterial : teaches
```

## Assessment authoring, scheduling, delivery, scoring, and review

```mermaid
erDiagram
  Tenant ||--o{ AssessmentDefinition : owns
  AssessmentCategory ||--o{ AssessmentDefinition : classifies
  DifficultyLevel ||--o{ AssessmentDefinition : levels
  AssessmentDefinition ||--o{ AssessmentVersion : versions
  AssessmentDefinition ||--o| AssessmentVersion : current
  AssessmentVersion ||--o{ AssessmentSection : sections
  AssessmentVersion ||--o{ AssessmentQuestion : fixes
  AssessmentSection ||--o{ AssessmentQuestion : groups
  QuestionVersion ||--o{ AssessmentQuestion : selected
  AssessmentVersion ||--o{ QuestionPoolRule : samples
  AssessmentSection ||--o{ QuestionPoolRule : scopes

  AssessmentDefinition ||--o{ AssessmentSchedule : schedules
  AssessmentSchedule ||--o{ ScheduleTarget : targets
  AssessmentSchedule ||--o{ ScheduleBlackoutDate : excludes
  AssessmentSchedule ||--o{ AssessmentCycle : creates
  AssessmentCycle ||--o{ AssignmentCampaign : produces
  AssessmentVersion ||--o{ AssignmentCampaign : delivers
  AssignmentCampaign ||--o{ AssignmentTargetScope : targets
  AssignmentCampaign ||--o{ AssessmentAssignment : issues
  AssessmentVersion ||--o{ AssessmentAssignment : pins
  TenantMembership ||--o{ AssessmentAssignment : receives
  CandidateApplication ||--o{ AssessmentAssignment : receives

  AssessmentAssignment ||--o| AssessmentPaper : materializes
  AssessmentVersion ||--o{ AssessmentPaper : snapshots
  AssessmentPaper ||--o{ AssessmentPaperQuestion : contains
  QuestionVersion ||--o{ AssessmentPaperQuestion : pins
  AssessmentAssignment ||--o{ AssessmentAttempt : allows
  AssessmentPaper ||--o{ AssessmentAttempt : serves
  TenantMembership ||--o{ AssessmentAttempt : completes
  CandidateApplication ||--o{ AssessmentAttempt : completes
  AssessmentAttempt ||--o{ AttemptQuestion : contains
  AssessmentPaperQuestion ||--o{ AttemptQuestion : instantiates
  QuestionVersion ||--o{ AttemptQuestion : answers
  AttemptQuestion ||--o| AttemptResponse : stores
  AttemptQuestion ||--o{ ResponseEvaluation : evaluates
  QuestionAnswerTarget ||--o{ ResponseEvaluation : checks
  QualityCriterion ||--o{ ResponseEvaluation : classifies
  AttemptQuestion ||--o{ ManualReview : reviews
  TenantMembership ||--o{ ManualReview : performs
  AssessmentAttempt ||--o{ AttemptCategoryResult : aggregates
  AssessmentCategory ||--o{ AttemptCategoryResult : groups
  AssessmentAttempt ||--o{ IntegrityEvent : records
  AssessmentAssignment ||--o{ RetakeGrant : extends
```

## Learning and certification

```mermaid
erDiagram
  Tenant ||--o{ LearningMaterial : owns
  AssessmentCategory ||--o{ LearningMaterial : classifies
  LearningMaterial ||--o{ LearningMaterialVersion : versions
  LearningMaterial ||--o| LearningMaterialVersion : current
  MediaAssetVersion ||--o{ LearningMaterialVersion : supplies

  Tenant ||--o{ LearningPath : owns
  LearningPath ||--o{ LearningPathVersion : versions
  LearningPath ||--o| LearningPathVersion : current
  LearningPathVersion ||--o{ LearningPathItem : orders
  LearningMaterialVersion ||--o{ LearningPathItem : teaches
  AssessmentVersion ||--o{ LearningPathItem : tests
  LearningPathVersion ||--o{ LearningPathAssignment : assigns
  TenantMembership ||--o{ LearningPathAssignment : learns
  LearningPathAssignment ||--o| LearningProgress : tracks
  LearningProgress ||--o{ LearningItemProgress : contains
  LearningPathItem ||--o{ LearningItemProgress : measures

  CertificateTemplate ||--o{ Certificate : formats
  TenantMembership ||--o{ Certificate : earns
  LearningPathAssignment ||--o{ Certificate : supports
  AssessmentAttempt ||--o{ Certificate : supports
```

## Recruitment

```mermaid
erDiagram
  JobPosition ||--o{ RecruitmentDrive : opens
  Tenant ||--o{ RecruitmentDrive : owns
  RecruitmentDrive ||--o{ RecruitmentDriveAssessment : stages
  AssessmentVersion ||--o{ RecruitmentDriveAssessment : uses
  Tenant ||--o{ CandidateProfile : controls
  CandidateProfile ||--o{ CandidateApplication : submits
  RecruitmentDrive ||--o{ CandidateApplication : receives
  CandidateApplication ||--o{ CandidateInvitation : authorizes
  CandidateApplication ||--o{ CandidateDecisionHistory : decides
```

## Engagement and rewards

```mermaid
erDiagram
  Tenant ||--o{ LeaderboardDefinition : configures
  LeaderboardDefinition ||--o{ LeaderboardPeriod : opens
  LeaderboardPeriod ||--o{ LeaderboardEntry : ranks
  TenantMembership ||--o{ LeaderboardEntry : appears

  Tenant ||--o{ BadgeDefinition : defines
  BadgeDefinition ||--o{ BadgeAward : awards
  TenantMembership ||--o{ BadgeAward : earns
  TenantMembership ||--o{ RewardPointLedger : owns
  RewardType ||--o{ RewardCatalogueItem : types
  Tenant ||--o{ RewardCatalogueItem : offers
  RewardCatalogueItem ||--o{ RewardRedemption : redeems
  TenantMembership ||--o{ RewardRedemption : requests
```

## Notifications, reports, and analytics projections

```mermaid
erDiagram
  Tenant ||--o{ NotificationTemplate : defines
  NotificationTemplate ||--o{ NotificationDelivery : renders
  Tenant ||--o{ NotificationPreference : controls
  TenantMembership ||--o| NotificationPreference : owns
  TenantMembership ||--o{ NotificationDelivery : receives

  Tenant ||--o{ ReportDefinition : defines
  ReportDefinition ||--o{ ReportRun : executes
  TenantMembership ||--o{ EmployeeMetricPeriod : summarizes

  OrganizationMetricPeriod {
    bigint id PK
    uuid tenantId
    string scopeType
    uuid scopeId
  }
  QuestionMetricPeriod {
    bigint id PK
    uuid tenantId
    uuid questionVersionId
  }
```

## AI, image, SVG, and agent control plane

```mermaid
erDiagram
  AIProvider ||--o{ AIModel : offers
  AIProvider ||--o{ TenantAIProviderConfiguration : enables
  Tenant ||--o{ TenantAIProviderConfiguration : configures
  AIModel ||--o{ AIModelConfiguration : routes
  Tenant ||--o{ AIModelConfiguration : owns

  Tenant ||--o{ AIPrompt : owns
  AIPrompt ||--o{ AIPromptTemplate : composes
  AIPrompt ||--o{ AIPromptVersion : versions
  AIPrompt ||--o| AIPromptVersion : current
  AIPromptVersion ||--o{ AIPromptExecution : executes
  AIModelConfiguration ||--o{ AIPromptExecution : configures
  AIPromptExecution ||--o{ AIPromptLog : logs
  AIPromptExecution ||--o{ AITokenUsage : meters
  AIPromptExecution ||--o{ AICostTracking : costs

  AIPromptExecution ||--o{ GeneratedImage : creates
  MediaAssetVersion ||--o{ GeneratedImage : stores
  GeneratedImage ||--o{ ImageCache : caches
  MediaAssetVersion ||--o| SVGAsset : sanitizes

  AIPromptExecution ||--o{ QuestionGenerationHistory : generates
  Question ||--o{ QuestionGenerationHistory : derives
  QuestionVersion ||--o{ QuestionGenerationHistory : outputs
  AIPromptExecution ||--o{ AIEvaluationHistory : evaluates
  AssessmentAttempt ||--o{ AIEvaluationHistory : considers
  AIPromptExecution ||--o{ AIFeedbackHistory : writes
  AIFeedbackHistory ||--o{ AIFeedbackHistory : supersedes
  AIPromptExecution ||--o{ AIRecommendation : recommends

  AIModelConfiguration ||--o{ AgentRun : powers
  AIPromptExecution ||--o{ AgentRun : invokes
  AgentRun ||--o{ AgentRunStep : contains
```

## Operations, authorization, governance, and messaging

```mermaid
erDiagram
  Tenant ||--o{ AuditEvent : scopes
  Tenant ||--o{ OutboxEvent : emits
  Tenant ||--o{ DataSubjectRequest : governs

  AuthorizationDecision {
    bigint id PK
    uuid tenantId
    string action
    boolean allowed
  }
  IdempotencyRecord {
    bigint id PK
    uuid tenantId
    string scope
    string idempotencyKey
  }
```

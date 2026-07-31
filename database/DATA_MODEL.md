# Zorfly Production Data Model

## 1. Conventions

This catalogue documents every model in `schema.prisma`. The schema file is
authoritative for exact types, nullability, indexes, uniqueness, and
referential actions.

### Common fields

Unless the entity is explicitly platform-global, each row includes mandatory
`tenantId`. Tenant-owned mutable definitions also include:

- UUID `id`;
- `createdAt`, `updatedAt`;
- `createdById`, `updatedById` where actor attribution is meaningful;
- `deletedAt`, `deletedById` for soft deletion;
- integer `rowVersion` for optimistic concurrency; and
- lifecycle/status fields where archival differs from deletion.

Actor audit IDs are stable UUID values without destructive foreign keys so
historical attribution survives identity anonymization/deletion. Important
changes are additionally written to append-only `AuditEvent`.

Published versions and evidence/ledger/history rows are immutable and use
append/supersede/correct patterns rather than soft delete. High-volume tables
use locality-friendly bigint IDs plus UUID public IDs where externally
addressable.

### Tenant safety

RLS is mandatory on every table with `tenantId`. Custom migration SQL adds
tenant-consistent composite foreign keys, checks for polymorphic targets, and
forced RLS. Platform-global exceptions are: `User`, `Permission`,
`PlatformRole`, `PlatformRolePermission`, `PlatformUserRole`,
`UserCredential`, `UserIdentity`, `UserSession`, `PasswordResetToken`,
`SubscriptionPlan`, `PlanEntitlement`, `QuestionType`, `RewardType`,
`AIProvider`, and `AIModel`.

## 2. Platform identity, reference data, and billing

| Entity | Purpose | Fields | Relationships | Business rules |
| --- | --- | --- | --- | --- |
| `User` | Global human identity, independent of any tenant | external subject, canonical email, display/contact/locale/time-zone data, status, operator flag, auth timestamp | Has credential, identities, sessions, reset tokens, tenant memberships, platform roles, support grants | Email is canonical and globally unique; suspension denies all new sessions; deletion anonymizes identity while evidence retains actor UUID |
| `UserCredential` | Local password authentication secret and lock state | Argon2id hash, password-change time, failed-attempt count, lock expiry, row version | One-to-one with user | Hash only, never plaintext; password changes revoke active sessions; provider identities do not require a local credential |
| `UserIdentity` | Link from a user to an external OIDC or SAML subject | provider type/key/subject, email-at-link, metadata, last-used time | Belongs to user | Provider key and subject globally unique; linking requires verified provider proof and account-takeover controls |
| `UserSession` | Revocable browser/device refresh session | active tenant, HMAC refresh-token hash, expiry/use/revoke data, hashed IP/user agent | Belongs to user and optional active tenant | Raw refresh token exists only in an HTTP-only cookie; rotate on every refresh; membership and user status rechecked; password change/reset revokes all sessions |
| `PasswordResetToken` | Single-use password-recovery proof | HMAC token hash, expiry and used time | Belongs to user | Raw token is sent only to the verified email; previous outstanding tokens invalidated; consumption and credential update are atomic |
| `Permission` | Atomic authorization action catalogue | immutable key, description, risk level | Used by tenant and platform role-permission joins | Keys are global, stable, deny-by-default, and never wildcard grants |
| `PlatformRole` | Platform operator responsibility | key, name, description | Has permissions and user assignments | Does not grant tenant-content access; support grant is separate |
| `PlatformRolePermission` | Platform role-to-permission join | role ID, permission ID, timestamps | Belongs to role and permission | Composite unique primary key; changes audited |
| `PlatformUserRole` | Time-bound platform role assignment | user ID, role ID, grant actor, expiry | Belongs to user and platform role | Expired assignment conveys no authority |
| `SubscriptionPlan` | Commercial plan catalogue | code, name, currency, monthly/annual amount, status | Has entitlements and subscriptions | Global soft-deletable reference; financial changes use new effective plan/version operationally |
| `PlanEntitlement` | Feature/limit within a plan | feature key, enabled flag, numeric limit, JSON config | Belongs to subscription plan | Unique feature per plan; absence means not entitled |
| `QuestionType` | Global interaction/answer schema | key, name, JSON answer schema, auto-score/media flags, status | Used by question versions | Stable keys; incompatible answer formats require new type/schema version |
| `RewardType` | Global reward classification | key, name, description, status | Types tenant catalogue items | No fulfillment secrets or tenant-specific policy |
| `TenantSubscription` | Tenant's plan contract period | external subscription ID, status, period dates, cancellation/end | Belongs to tenant and plan; has invoices | One active effective subscription is enforced by partial unique migration/index |
| `Invoice` | Immutable tenant billing obligation snapshot | external ID, number, status, currency, subtotal/tax/total, due/paid times | Belongs to tenant/subscription; has payments | Tenant invoice number unique; paid financial facts corrected with adjustments |
| `Payment` | Payment-provider transaction evidence | external ID, status, amount/currency, provider, paid/failure data | Belongs to tenant and invoice | Append/reconcile; total successful payments may not exceed invoice plus approved adjustments |

## 3. Tenant, organization, and RBAC

| Entity | Purpose | Fields | Relationships | Business rules |
| --- | --- | --- | --- | --- |
| `Tenant` | Company isolation and lifecycle root | code, slug, name, status, region, locale, time zone, retention, settings | Parent of all tenant aggregates | Code/slug globally unique; closing follows export/retention workflow, never cascading business-data delete |
| `TenantDomain` | Verified custom/company hostname | hostname, primary flag, verification time | Belongs to tenant | Hostname globally unique; at most one active primary domain per tenant |
| `TenantBranding` | Tenant visual/email branding | logo version, colors, custom CSS, sender name | One per tenant; references media version | CSS/SVG processed by safety pipeline; logo reference must be same tenant |
| `Branch` | Geographic/business organization unit | code, name, time zone, status | Tenant parent; has departments/members | Code unique in tenant; soft delete blocked while active dependants exist |
| `Department` | Hierarchical functional unit | branch/parent IDs, code, name, status | Tenant/branch; self tree; teams/members | Code unique per tenant; no cycles; parent belongs to same tenant/branch policy |
| `Team` | Work group | department ID, code, name, status | Tenant/department; team memberships | Code unique per tenant; department optional for flat organizations |
| `TenantMembership` | User's employee membership in a company | user/org/manager IDs, employee number, title/level, status, employment dates | Tenant/user/org; roles, teams, assignments, results, learning/rewards | User unique per tenant; employee number tenant-unique; manager same tenant; status controls access |
| `TeamMembership` | Time-bounded team participation | team/member IDs, lead flag, start/end | Joins team and membership | Team/member same tenant; one active row per pair; lead status auditable |
| `TenantRole` | Tenant-owned RBAC role | key, name, description, rank, system/customization flags, status | Tenant; permissions and membership assignments | Key unique per tenant; system roles cannot be deleted, only superseded/deactivated; customization flag distinguishes defaults from tenant overrides |
| `TenantRolePermission` | Tenant role permission join | tenant, role, permission IDs | Role to global permission | Role tenant must match row tenant; composite uniqueness |
| `MembershipRole` | Time-bounded role grant | tenant/member/role IDs, grant actor, expiry | Membership to tenant role | Member/role same tenant; expired grants ignored |
| `SupportAccessGrant` | Explicit platform support access to a tenant | grantee/approver, reason, JSON scope, state, start/expiry/revoke | Tenant and two platform users | Approval, bounded scope, reason and expiry required; every use audited; self-approval prohibited |

## 4. Taxonomy and media

| Entity | Purpose | Fields | Relationships | Business rules |
| --- | --- | --- | --- | --- |
| `AssessmentCategory` | Tenant assessment/content taxonomy | parent, code, name, description, order, status | Tenant/self tree; questions, assessments, materials, criteria | Code tenant-unique; acyclic; published references prevent destructive removal |
| `DifficultyLevel` | Tenant-configurable proficiency band | code, name, rank, description, status | Tenant; questions and assessments | Code and rank tenant-unique; rank meaning cannot change retroactively |
| `QualityCriterion` | SOP-derived quality/mistake taxonomy | category/parent, code, name, default severity/weight, status | Tenant/category/self tree; answer targets/evaluations | Code tenant-unique; criteria are data, not enum; no cycles |
| `Tag` | Tenant search/classification label | key, name, color | Tenant; question tags | Key tenant-unique; soft delete hides from new authoring only |
| `MediaAsset` | Mutable logical media identity | kind, name, description, source, state, current version | Tenant; owns immutable versions | Object bytes are not in DB; current version must belong to asset/tenant |
| `MediaAssetVersion` | Immutable object-store version | bucket/key, MIME, size, checksum, dimensions/duration, scan/moderation/provenance | Asset; question/material/generated/SVG/lineage references | Bucket/key and asset/version unique; ready only after scan/moderation policy |
| `AssetLineage` | Parent-child derivative provenance | parent/child version, operation, parameters | Joins media versions | Same tenant, no self-link/cycles; immutable |

## 5. Question bank

| Entity | Purpose | Fields | Relationships | Business rules |
| --- | --- | --- | --- | --- |
| `Question` | Stable tenant question identity | category/difficulty, code, title, status, current version | Tenant/taxonomy; versions, tags, generation history | Code tenant-unique; published content changes only through new version |
| `QuestionVersion` | Immutable executable question snapshot | type, version/status, prompt/instructions, answer/scoring schemas, marks, explanation, review flag, hash | Question/type; options, targets, media, assessment/paper/attempt references | Version unique per question; hash indexed for deduplication checks; published row immutable |
| `QuestionOption` | Choice/order/match option | option key, label/value, media, correctness, weight, order | Question version and optional media version | Key unique per question version; media same tenant; scoring totals validated |
| `QuestionAnswerTarget` | Scored mistake/hotspot/text/timestamp target | key/type/label, JSON geometry/range/value, criterion, marks/penalty/severity/order | Question version/criterion; response evaluations | Key version-unique; target JSON validated by question type; bounds and marks checked |
| `QuestionVersionMedia` | Ordered media attachment with semantic role | question/media IDs, role, order, annotations | Joins question and media versions | Composite uniqueness; same tenant; immutable after publication |
| `QuestionTag` | Question-to-tag classification | question/tag IDs | Joins question and tag | Same tenant and unique pair |
| `QuestionLearningMaterial` | Corrective learning link | question/material-version IDs, relation type, order | Question version and learning material/version | Same tenant; published links pin material version; relation type controlled |

## 6. Assessment authoring and delivery

| Entity | Purpose | Fields | Relationships | Business rules |
| --- | --- | --- | --- | --- |
| `AssessmentDefinition` | Stable assessment identity | taxonomy, code, title/description, lifecycle, current version | Tenant/category/difficulty; versions/schedules | Code tenant-unique; state machine enforced; edits create versions |
| `AssessmentVersion` | Immutable assessment settings/content contract | version, title, marks, limits, attempts, shuffle, autosave/resume, policies, hash | Definition; sections/questions/pools/campaigns/papers | Published row immutable; pass <= total; references published question versions |
| `AssessmentSection` | Ordered section in a version | title/instructions, order, optional time/count/marks | Assessment version; questions/pools | Order unique in version; totals consistent with parent |
| `AssessmentQuestion` | Fixed question selection | assessment/section/question versions, order, mark overrides, required | Assessment version/section/question version | Same tenant; question unique per version unless explicit future duplicate policy |
| `QuestionPoolRule` | Random question-selection rule | name, section, count, JSON filter, order, seed strategy | Assessment version/section | Deterministic paper generation; pool must have enough eligible published questions |
| `AssessmentSchedule` | Recurring program definition | assessment, frequency/RRULE, time zone, range/windows, joiner/missed/reminder policies, status | Assessment; targets, blackouts, cycles | RRULE/time zone validated; cycle creation idempotent |
| `ScheduleTarget` | Schedule audience rule | scope type, target ID, JSON filter | Assessment schedule | Target type/ID combination checked; resolved only inside tenant |
| `ScheduleBlackoutDate` | Tenant-local excluded date | date, reason | Assessment schedule | Date unique per schedule; local time-zone interpretation |
| `AssessmentCycle` | One recurring occurrence | key/sequence, state, open/close/result times | Schedule; assignment campaigns | Key/sequence schedule-unique; windows immutable after opening except audited extension |
| `AssignmentCampaign` | Batch assignment envelope | version/cycle, source, name, availability/due/close, attempts, settings | Version/cycle; target scopes and assignments | Pins assessment version; generation idempotent |
| `AssignmentTargetScope` | Campaign audience declaration | scope type, target ID, filter | Campaign | Same polymorphic validation as schedule targets; historical scope retained |
| `AssessmentAssignment` | Individual deliverable | campaign/version, employee or candidate, source/state, windows, attempt limits/count | Campaign/version/recipient; paper, attempts, grants | Exactly one recipient; tenant-consistent; state/windows monotonic; count maintained transactionally |
| `AssessmentPaper` | Immutable delivered paper snapshot | assignment/version, random seed, hash, total marks, generation time | Assignment/version; paper questions/attempts | One per assignment; immutable; deterministic hash |
| `AssessmentPaperQuestion` | Exact ordered question on a paper | paper/question versions, section/order, option order, marks/penalty | Paper/question version; attempt questions | Order paper-unique; immutable; high-volume bigint ID |

## 7. Attempts, scoring, and integrity

| Entity | Purpose | Fields | Relationships | Business rules |
| --- | --- | --- | --- | --- |
| `AssessmentAttempt` | Official/practice/recruitment attempt header and result | public UUID, assignment/paper/actor, mode/state/number, times, scores/pass, versions | Assignment/paper/member/candidate; questions, breakdowns, integrity, certificates, AI history | Exactly one actor; official attempts require assignment/paper; number unique per assignment; state monotonic |
| `AttemptQuestion` | Per-question attempt state/result | paper/question, order, max marks, evaluation state, score/penalty/time/view/answer times | Attempt/paper question/question version; response/evaluations/reviews | Order unique per attempt; pinned version; score within configured bounds |
| `AttemptResponse` | Latest durable answer and optimistic save position | answer JSON/hash, client sequence, save/submit time, row version | One-to-one attempt question | Answer validates against type schema; lower client sequence cannot overwrite; submitted answer frozen |
| `ResponseEvaluation` | Append-only scored target/evaluation pass | target/criterion, version, evaluator, state, detected/confidence, score/penalty, evidence/rationale | Attempt question, answer target, criterion | Evaluation version unique per target; official correction appends override; evidence tenant-safe |
| `ManualReview` | Human review work item/result | reviewer, state/round, assigned/due/completed, score, feedback/rubric | Attempt question and reviewer membership | Round unique; reviewer authorized and same tenant; completed review immutable |
| `AttemptCategoryResult` | Persisted category score breakdown | attempt/category, possible/scored/percentage/counts | Attempt and category | One per attempt/category; derived from authoritative evaluations |
| `IntegrityEvent` | Append-only anti-cheating signal | attempt, event type, severity, occurrence, client data | Assessment attempt | Signal is not automatic guilt; client data minimized; time partitioned |
| `RetakeGrant` | Auditable extra-attempt authorization | assignment, count, reason, grant actor, expiry/revoke | Assessment assignment | Positive count; cannot reduce consumed entitlement; expiry/revoke respected |

## 8. Learning and certification

| Entity | Purpose | Fields | Relationships | Business rules |
| --- | --- | --- | --- | --- |
| `LearningMaterial` | Stable tenant learning resource | category, code/title/type/state, current version | Tenant/category; versions/question links | Code tenant-unique; published changes versioned |
| `LearningMaterialVersion` | Immutable learning content snapshot | media, version/state, JSON body, URL/duration, hash/publish time | Material/media; path items/question links | Published row immutable; exactly appropriate body/media/URL combination |
| `LearningPath` | Stable ordered curriculum identity | code/title/description/state/current version | Tenant; versions | Code tenant-unique; edits create version |
| `LearningPathVersion` | Immutable curriculum snapshot | version/state/title/completion rule/hash | Path; items and assignments | Published row immutable; completion rule schema validated |
| `LearningPathItem` | Ordered lesson/practice/final item | material or assessment, type/title/order/required/rule | Path version; material/assessment; progress | Exactly one content target matching type; order unique |
| `LearningPathAssignment` | Individual curriculum assignment | path version/member, state, dates, source | Path version/member; progress/certificates | Pinned version; duplicate assignment controlled by assignment date/source |
| `LearningProgress` | Path-level learner projection | assignment/member, state, percentage, activity dates | One assignment/member; item progress | One per assignment; percentage derived from required items |
| `LearningItemProgress` | Item-level learner progress/evidence | progress/item, state, percentage, dates, evidence | Learning progress/path item | Unique pair; status transitions validated |
| `CertificateTemplate` | Tenant certificate rendering definition | code/name, template JSON, validity, status | Has certificates | Code tenant-unique; template sanitized/versioned operationally before issue |
| `Certificate` | Verifiable issued credential | template/member, source assignment/attempt, verification code, state/dates, snapshot | Template/member and optional learning/attempt source | Verification globally unique; issuance snapshot immutable; revoke rather than delete |

## 9. Recruitment

| Entity | Purpose | Fields | Relationships | Business rules |
| --- | --- | --- | --- | --- |
| `JobPosition` | Tenant hiring position | department, code/title/description, status | Has recruitment drives | Code tenant-unique; department same tenant |
| `RecruitmentDrive` | Hiring campaign | position, code/title/state, windows, retention, settings | Tenant/position; stages/applications | Code tenant-unique; retention explicit; closed drives stop new applications |
| `RecruitmentDriveAssessment` | Ordered assessment stage | drive/version, order/name, pass override, required | Drive and assessment version | Stage order unique; pins published version |
| `CandidateProfile` | Purpose-limited encrypted candidate identity | external ref, encrypted contact/name, email hash, state, consent/retention/anonymization | Tenant; applications | PII encrypted; tenant/email hash unique; purge/anonymize on retention |
| `CandidateApplication` | Candidate's drive participation | candidate/drive, state, rank/score, dates/retention | Candidate/drive; invites, decisions, assignments, attempts | One per candidate/drive; rank is derived; decisions append history |
| `CandidateInvitation` | Single-purpose candidate access token metadata | application, token hash, send/expiry/accept/revoke times | Candidate application | Raw token never stored; expiry and one-time use enforced |
| `CandidateDecisionHistory` | Append-only hiring decision evidence | application, decision, reason/evidence, actor/time | Candidate application | Never overwritten; current state derives from latest valid decision |

## 10. Engagement and rewards

| Entity | Purpose | Fields | Relationships | Business rules |
| --- | --- | --- | --- | --- |
| `LeaderboardDefinition` | Tenant ranking configuration | code/name/scope, scoring/exclusions, anonymity, state | Tenant; periods | Code tenant-unique; policy version captured in finalized period |
| `LeaderboardPeriod` | Time-bounded leaderboard snapshot | period key/range, finalization and source watermark | Definition; entries | Key definition-unique; finalized period immutable |
| `LeaderboardEntry` | Ranked member projection | period/member, rank, score, previous rank, metrics | Period and membership | Member/rank unique per period; excluded/practice data omitted |
| `BadgeDefinition` | Tenant achievement rule | code/name/description/icon/rule/state | Tenant; awards | Code tenant-unique; rule changes versioned operationally |
| `BadgeAward` | Badge grant evidence | badge/member, source/evidence, award/revoke time | Badge and membership | Append award; revoke rather than delete; dedupe by rule/source policy |
| `RewardPointLedger` | Append-only points balance ledger | member, entry type, points/balance, source, idempotency, expiry/time | Tenant membership | Tenant idempotency unique; balance arithmetic serialized; corrections compensate |
| `RewardCatalogueItem` | Redeemable tenant reward | global type, code/name/description, cost/inventory, fulfillment/state | Tenant/reward type; redemptions | Code tenant-unique; non-negative cost/inventory; secrets excluded |
| `RewardRedemption` | Reward request and fulfillment state | item/member, state, reserved points, decision/fulfillment data | Catalogue item/member | Reserve points atomically; terminal transitions audited; no silent deletion |

## 11. Communications, reports, and analytics

| Entity | Purpose | Fields | Relationships | Business rules |
| --- | --- | --- | --- | --- |
| `NotificationTemplate` | Tenant/channel/locale message template version | key/channel/locale, subject/body, version/state | Tenant; deliveries | Version tuple unique; rendered payload pins template version |
| `NotificationPreference` | Member channel/topic preferences | member, preferences JSON, quiet hours | Tenant/member one-to-one | Mandatory/security notices cannot be disabled; time zone honored |
| `NotificationDelivery` | Durable delivery attempt envelope | template/recipient, channel, destination hash, dedupe, payload/state/retry/provider data | Template and optional member | Dedupe tenant-unique; no plaintext destination in logs; retry bounded |
| `ReportDefinition` | Saved/scheduled report specification | code/name/type, query spec, schedule, recipients, state | Tenant; runs | Code tenant-unique; query spec allowlisted and scope checked |
| `ReportRun` | Report generation evidence | definition, state, parameters, watermark, output asset, times/failure | Report definition | Output private and expiring; source watermark makes report reproducible |
| `EmployeeMetricPeriod` | Per-member analytics projection | member/period/version, attempts/score/pass/training/points, JSON metrics | Membership | Unique period/version; rebuildable, never authoritative score |
| `OrganizationMetricPeriod` | Organization-scope analytics projection | scope type/ID, period/version, metrics | Polymorphic org scope | Same-tenant target; rebuildable; no direct authorization |
| `QuestionMetricPeriod` | Question quality/psychometric projection | question version, period/version, response count and metrics | Logical question-version reference | Rebuildable; minimum cohort/privacy threshold before reporting |

## 12. AI provider, prompt, and execution control plane

| Entity | Purpose | Fields | Relationships | Business rules |
| --- | --- | --- | --- | --- |
| `AIProvider` | Global provider adapter catalogue | key/name, capabilities, status | Models and tenant configs | No credentials; key stable |
| `AIModel` | Provider model/SKU catalogue | provider key, capabilities/context, effective prices/currency, status | Provider; tenant model configurations | Model key unique per provider; historical cost pins price version |
| `TenantAIProviderConfiguration` | Tenant provider enablement | provider, secret reference, endpoint/org/quota, state | Tenant and provider | Secret reference only; tenant/provider unique; least-privilege readers |
| `AIModelConfiguration` | Tenant routing/model policy | key/purpose, params/fallback/safety, token/budget limits, state | Tenant/model; executions/agents | Key tenant-unique; policy snapshot retained by executions |
| `AIPrompt` | Logical tenant AI use case | key/name/purpose/description/state/current version | Tenant; templates/versions | Key tenant-unique; publication chooses immutable version |
| `AIPromptTemplate` | Reusable prompt authoring component | prompt, key/role/content, variable schema/order | AIPrompt | Key prompt-unique; mutable draft input, never historical execution source |
| `AIPromptVersion` | Immutable executable prompt | prompt/version/state, messages, variable/output/safety/eval schemas, hash | Prompt; executions | Version unique per prompt; hash indexed for comparison; published rows immutable |
| `AIPromptExecution` | Provider-neutral model invocation | public ID, prompt/config, purpose/state/idempotency, trace/source, hashes/snapshots, provider/timing/failure | Prompt version/config; logs/usage/cost/output histories/agents | Tenant idempotency unique; state monotonic; payload retention/classification enforced |
| `AIPromptLog` | Ordered sanitized execution log | execution, sequence, level/type/message/attributes/time | Prompt execution | Append-only; sequence unique; secrets/unsafe PII prohibited |
| `AITokenUsage` | Token-meter evidence | execution/model key, input/cache/output/reasoning/total, measured time | Prompt execution | Append-only; provider totals reconciled |
| `AICostTracking` | AI financial cost ledger | execution, cost type, quantity/unit/price/amount/currency/version/time | Prompt execution | Append-only exact decimal values; correction compensates |

## 13. AI media, generation, evaluation, recommendations, and agents

| Entity | Purpose | Fields | Relationships | Business rules |
| --- | --- | --- | --- | --- |
| `SVGAsset` | Sanitized SVG security/render metadata | media version, source, sanitizer/renderer versions, view box/count/hash/report | One media version | Only sanitized version renderable; hash indexed for deduplication; policy change creates new version |
| `GeneratedImage` | Generated-image provenance | execution/media version, provider ID, revised prompt, params, moderation/provenance | Prompt execution/media; cache entries | Provider URL not retained as storage; accepted bytes immutable/private |
| `ImageCache` | Tenant image-generation cache | key, image, policy version, hits/expiry | Generated image | Key/policy tenant-unique; never cross-tenant reuse |
| `QuestionGenerationHistory` | Generated question provenance/decision | execution, source question, generated version, request/validation, human decision | Execution/question/question version | Output remains draft until normal review; history append-only |
| `AIEvaluationHistory` | AI evaluation evidence | execution, optional attempt, type/input/result/confidence/human review | Execution and attempt | Does not itself set official score; human outcome retained |
| `AIFeedbackHistory` | Generated feedback version chain | execution, subject, structured feedback, publish, supersedes | Execution; self revisions | Append/supersede; published feedback not silently edited |
| `AIRecommendation` | Evidence-backed proposed action | execution, subject/type, recommendation/evidence, state/expiry/decision | Prompt execution | Advisory; acceptance creates normal domain command and audit |
| `AgentRun` | Durable provider-neutral agent workflow | execution/config, agent/version, state, objective, input/output, policy, step/times | Model config/execution; steps | Idempotent/resumable; policy snapshot; high-impact actions pause |
| `AgentRunStep` | Ordered model/tool/approval activity | run/sequence/type/tool/state, safe I/O, approval and timing | Agent run | Sequence unique; approval reauthorizes actor; secrets excluded |

## 14. Operations, audit, and governance

| Entity | Purpose | Fields | Relationships | Business rules |
| --- | --- | --- | --- | --- |
| `AuditEvent` | Tamper-evident important-action evidence | optional tenant, actor/support, action/entity/outcome, request/trace, redacted state, hash chain/time | Optional tenant | Append-only; platform null-tenant events use platform policy; hashes and periodic external export |
| `AuthorizationDecision` | Security policy allow/deny evidence | tenant/actor, action/resource, allow flag, policy/reasons, request/trace/time | Logical resource reference | Append-only; sensitive high-volume retention; deny decisions observable |
| `OutboxEvent` | Transactional integration event | tenant/aggregate/type/version, payload/headers, idempotency, state/times/retries | Optional tenant | Inserted with domain transaction; at-least-once publish; consumer dedupe required |
| `IdempotencyRecord` | Request replay/concurrency guard | tenant/scope/key, request hash, response, lock/completion/expiry | Logical request scope | Tuple unique; same key with different hash rejected; bounded retention |
| `DataSubjectRequest` | Export/rectify/delete/restrict workflow | tenant/type/state/subject, request/verification/approval/due/completion, output/purge/rejection | Tenant | Identity verification and separation of duties; legal holds override purge; full audit trail |

## 15. Cross-entity business invariants

1. Published content is immutable and every delivered paper pins exact versions.
2. Official score is derived only from authoritative evaluations and manual
   review decisions, not directly from mutable content or AI history.
3. Candidate and employee principals are distinct; conversion to employment
   creates a membership through an audited workflow.
4. Object bytes live in private object storage; database rows retain immutable
   checksums, version, lineage, moderation, and provenance.
5. Analytics, leaderboard, and aggregate tables are rebuildable projections and
   never the authoritative evidence source.
6. Ledgers and histories append corrections; destructive delete is limited to
   approved retention/purge operations.
7. Every asynchronous side effect starts from `OutboxEvent`, and every external
   mutation uses an idempotency key.

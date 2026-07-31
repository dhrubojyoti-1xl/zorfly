# Seed Plan

## 1. Principles

Seed records use immutable, lowercase dot-separated or uppercase snake-case
keys. Display names are editable only on tenant-owned copies. Every operation
is idempotent and versioned. Production seeds contain no people, credentials,
PII, assessment attempts, or example scores.

Platform reference data is shared and read-only to tenants. Tenant bootstrap
data is copied into the tenant so administrators can adapt it without affecting
other companies.

## 2. Platform roles

| Key | Name | Scope and safeguards |
| --- | --- | --- |
| `platform.super_admin` | Platform Super Admin | Tenant lifecycle, plan, billing, and global configuration; tenant content requires a separate support grant |
| `platform.support_engineer` | Support Engineer | Diagnostic access only through an approved, expiring `SupportAccessGrant` |
| `platform.billing_admin` | Billing Administrator | Plans, subscriptions, invoices, and payments; no tenant assessment content |
| `platform.security_auditor` | Security Auditor | Read-only platform audit/security evidence; no mutation rights |

## 3. Tenant roles

| Key | Name | Default responsibility |
| --- | --- | --- |
| `company_admin` | Company Admin | Tenant configuration, organization, RBAC, content, programs, reporting |
| `hr_admin` | HR Administrator | Memberships, assignments, learning, recruitment, permitted reports |
| `assessment_author` | Assessment Author | Taxonomy, question bank, assessment drafts and publication workflow |
| `manager` | Team Leader / Manager | Assigned teams, assignments, review, coaching, team reports |
| `reviewer` | Assessment Reviewer | Manual-review queue and permitted evidence |
| `learning_manager` | Learning Manager | Materials, paths, learning assignments, certificates |
| `recruiter` | Recruiter | Positions, drives, candidates, recruitment decisions |
| `rewards_manager` | Rewards Manager | Badges, points adjustments, catalogue and redemption decisions |
| `employee` | Employee | Own assessments, learning, results, certificates, rewards |

Candidate authorization is invitation/application based and is not represented
as a tenant employee role.

## 4. Permissions

The initial permission catalogue is intentionally atomic. Wildcards are never
persisted as grants.

### Tenant and organization

- `tenant.read`, `tenant.settings.update`, `tenant.branding.update`
- `membership.read`, `membership.invite`, `membership.update`,
  `membership.suspend`, `membership.export`
- `organization.read`, `organization.manage`
- `role.read`, `role.manage`, `role.assign`
- `support_access.request`, `support_access.approve`

### Content and media

- `taxonomy.read`, `taxonomy.manage`
- `question.read`, `question.create`, `question.update`,
  `question.review`, `question.publish`, `question.retire`
- `media.read`, `media.upload`, `media.manage`, `media.delete`

### Assessments

- `assessment.read`, `assessment.create`, `assessment.update`,
  `assessment.publish`, `assessment.schedule`, `assessment.close`
- `assignment.create`, `assignment.read`, `assignment.cancel`
- `attempt.start`, `attempt.submit`, `attempt.read.own`,
  `attempt.read.team`, `attempt.read.all`, `attempt.invalidate`
- `review.claim`, `review.score`, `review.override`
- `result.publish`, `result.export`
- `retake.grant`

### Learning and recruitment

- `learning_material.read`, `learning_material.manage`
- `learning_path.read`, `learning_path.manage`, `learning.assign`
- `certificate.issue`, `certificate.revoke`
- `recruitment.read`, `recruitment.manage`, `candidate.invite`,
  `candidate.decide`, `candidate.export`

### Engagement, communications, and reporting

- `leaderboard.read`, `leaderboard.manage`
- `badge.manage`, `points.adjust`, `reward.manage`,
  `redemption.decide`
- `notification_template.manage`, `notification.send`
- `report.read`, `report.create`, `report.schedule`, `report.export`

### AI, audit, and data governance

- `ai.use`, `ai.prompt.manage`, `ai.model.configure`,
  `ai.execution.read`, `ai.cost.read`, `ai.recommendation.decide`,
  `ai.agent.approve`
- `audit.read`, `authorization_decision.read`
- `data_request.create`, `data_request.approve`, `data_request.process`

Role-to-permission matrices are reviewed separately in authorization tests.
The bootstrap grants Company Admin all tenant permissions except restricted
support/platform capabilities; other roles receive the minimum subset for
their responsibility.

## 5. Question types

| Key | Auto-score | Media | Answer definition |
| --- | --- | --- | --- |
| `MCQ_SINGLE` | Yes | Optional | one option key |
| `MCQ_MULTIPLE` | Yes | Optional | option keys with partial/penalty weights |
| `TRUE_FALSE` | Yes | Optional | boolean |
| `IMAGE_COMPARISON` | Yes/Review | Required | expected differences or decision |
| `FIND_MISTAKES` | Yes/Review | Required | scored error targets |
| `HOTSPOT` | Yes | Required | point(s) intersecting polygon/shape targets |
| `CONTENT_REVIEW` | Review/Hybrid | Optional | text ranges, categories, corrections |
| `VIDEO_REVIEW` | Review/Hybrid | Required | timestamps/ranges and observations |
| `DRAG_DROP_ORDER` | Yes | Optional | ordered keys |
| `DRAG_DROP_MATCH` | Yes | Optional | keyed pairs |
| `MULTIPLE_ERROR_DETECTION` | Yes/Review | Optional | composite target set |
| `FREE_TEXT` | Review/AI assist | Optional | rubric and reference answer |
| `AUDIO_REVIEW` | Review/Hybrid | Required | future-compatible timestamps and rubric |

The JSON schemas stored on `QuestionType` validate authoring input and submitted
answers. Type keys are permanent; incompatible schema changes require a new
type/version rather than reinterpreting historical data.

## 6. Difficulty levels

Tenant bootstrap order:

1. `FRESHER` — Fresher
2. `JUNIOR` — Junior
3. `MID_LEVEL` — Mid-Level
4. `SENIOR` — Senior
5. `TEAM_LEAD` — Team Lead
6. `MANAGER` — Manager
7. `HEAD_OF_DEPARTMENT` — Head of Department
8. `CEO_CXO` — CEO / CXO

Ranks are tenant-local and may be renamed or extended, but a rank already used
by published content cannot be repurposed.

## 7. Departments

Bootstrap organization units are suggestions, not mandatory structure:

- `CONTENT` — Content Writing
- `GRAPHIC_DESIGN` — Graphic Design
- `VIDEO` — Video Editing
- `DIGITAL_MARKETING` — Digital Marketing
- `WEBSITE` — Website / Engineering
- `QUALITY_ASSURANCE` — Quality Assurance
- `SENIOR_MANAGEMENT` — Senior Management
- `HUMAN_RESOURCES` — Human Resources

Provisioning may omit or rename these based on tenant onboarding input.
Departments are never global rows.

## 8. Assessment categories

Top-level tenant categories mirror the work domains:

- Content Writing
- Graphic Design
- Video Editing
- Digital Marketing
- Website Team
- Quality Assurance
- Senior Management
- Recruitment
- Compliance and Policy
- General Aptitude

Recommended nested categories derived from the supplied SOPs:

| Domain | Initial subcategories |
| --- | --- |
| Content Writing | Audience & Purpose; Research & Accuracy; Grammar; Spelling; Punctuation; Structure & Clarity; Formatting; Links & References; Brand Voice; Safety & Prohibited Content; Originality |
| Graphic Design | Brief & Audience; Brand & Logo; Color & Contrast; Typography; Alignment & Spacing; Hierarchy & Readability; Image Quality; Platform & Dimensions; CTA & Contact Details; Licensing & Originality |
| Video Editing | Brief & Audience; Branding; On-screen Text; Footage Quality; Pacing & Transitions; Color & Keying; Flicker & Edge Quality; Subtitles; CTA; Copyright & Provenance |

## 9. Quality criteria and mistake types

`QualityCriterion` is tenant data, not an enum, so criteria can evolve without
schema releases. Bootstrap criteria include:

- spelling, capitalization, grammar, punctuation, repetition, text accuracy;
- alignment, spacing, typography, hierarchy, readability;
- brand color, logo treatment, tagline, CTA, contact details;
- contrast, opacity, color grading, green-screen spill, flicker, rough edges;
- pacing, transitions, subtitles, footage/image resolution, export format;
- broken links, factual accuracy, citation, audience/tone mismatch;
- copyright, watermark, licensing, plagiarism, confidentiality; and
- prohibited or unsafe content.

Each criterion receives a stable code, domain/category, description, default
severity, and optional weight. Questions may override marks/severity per answer
target.

## 10. Reward types

Platform reference keys:

- `POINTS` — non-cash recognition points;
- `BADGE` — digital achievement;
- `CERTIFICATE` — verifiable completion/achievement;
- `VOUCHER` — externally fulfilled voucher;
- `GIFT` — physical or digital item;
- `TIME_OFF` — policy-controlled leave benefit;
- `RECOGNITION` — public or private recognition;
- `CUSTOM` — tenant-defined fulfillment.

Cash-equivalent types must be disabled by default and require tenant policy,
tax, approval, and fulfillment configuration.

## 11. Notification defaults

Tenant bootstrap templates cover invitation, assessment available, due-soon,
overdue/escalation, submission, result publication, manual-review assignment,
learning assignment, certificate issue, badge award, reward redemption, and
candidate decision. Templates are channel- and locale-versioned.

## 12. AI provider/model catalogue

Provider records are capability metadata only. Tenant credentials are stored as
secret-manager references in `TenantAIProviderConfiguration`; seed data never
contains secret values. Initial catalogue entries may include OpenAI and
Anthropic after legal/vendor review. Model keys, capabilities, and price
versions must be sourced from provider configuration at deployment time rather
than assumed in this document.

## 13. Seed execution and verification

1. Apply platform reference seeds during controlled release deployment.
2. Verify immutable key uniqueness and expected counts.
3. On tenant provisioning, create tenant roles and bootstrap copies in one
   transaction with an outbox event.
4. Replay the seed against the same tenant; assert no duplicate or customized
   value changes.
5. Record seed bundle version and checksums in deployment evidence.
6. Run authorization tests against the generated role matrix.

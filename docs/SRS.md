# Zorfly Software Requirements Specification

## 1. Purpose

Zorfly is a multi-tenant enterprise SaaS for workforce quality assessment,
employee training, continuous evaluation, recruitment screening, and
performance recognition. The product must support media-rich assessments,
repeatable learning workflows, auditable scoring, and tenant-specific
configuration without exposing one company's data to another.

This document is the repository baseline distilled from the supplied Zorfly
requirements. Detailed implementation decisions belong in the architecture and
database documents.

## 2. Actors and access boundaries

| Actor | Primary responsibilities | Boundary |
| --- | --- | --- |
| Platform Super Admin | Tenant lifecycle, plans, billing, global templates, platform analytics | No tenant content access without explicit, time-bound support access |
| Company Admin | Company configuration, users, organization, assessments, reporting | One tenant |
| HR Team | Employee lifecycle, assignments, learning programs, reports | Permissions granted by the tenant |
| Team Leader / Manager | Team assignment, review, coaching, team analytics | Assigned teams and reporting hierarchy |
| Employee | Complete assessments and training, view permitted results and rewards | Own records and published tenant content |
| Job Candidate | Complete recruitment assessments | Invited application and limited profile only |

Access must be deny-by-default, tenant-scoped, role- and permission-based, and
auditable. Authentication is intentionally outside the database-design phase.

## 3. Tenant and organization management

- Each company is an isolated tenant identified by a company code, slug, and
  optional verified domains.
- Tenants have status, subscription, regional/data-retention settings,
  time zone, locale, branding, and feature/limit entitlements.
- Organization structures include branches, departments, teams, positions,
  reporting managers, and memberships.
- Tenant lifecycle includes activation, suspension, export, retention-aware
  deletion, and recovery procedures.
- Platform operators may access a tenant only through an approved,
  purpose-bound, time-limited support grant.

## 4. Taxonomy and question bank

Tenants configure assessment categories, nested subcategories, quality
criteria, mistake types, tags, and difficulty levels. Initial content domains
include Content Writing, Graphic Design, Video Editing, Digital Marketing,
Website, Quality Assurance, and Senior Management.

Supported question/interaction types:

- image comparison;
- find-the-mistakes and multiple-error detection;
- image or video hotspot selection;
- content review;
- video review with time-coded observations;
- single- and multiple-select MCQ;
- true/false;
- drag-and-drop ordering or matching;
- free-text/manual-review responses; and
- future audio review.

Every question has a category, optional subcategory, difficulty, marks,
optional negative marks, explanation, learning links, tags, reusable media,
and an immutable published version. Answer definitions may contain options,
polygons, text ranges, timestamps, ordering/matching pairs, or multiple scored
error targets.

## 5. Assessment authoring and delivery

Assessments may mix question types and media. Configuration includes title,
description, taxonomy, difficulty, total and passing marks, whole-test and
per-question limits, permitted attempts, negative marking, shuffle rules,
random pools, result visibility, review workflow, and anti-cheating policy.

Lifecycle states are Draft, Published, Scheduled, Active, Closed, and Archived.
Authors need preview/dry-run capability. Assignments may target individuals,
teams, departments, roles, difficulty bands, the whole tenant, or candidates.
The system must auto-save answers, resume eligible attempts, preserve the exact
assessment/question versions delivered, and never change historical scores
when source content changes.

## 6. Evaluation and review

- Objective responses are scored deterministically from the published answer
  definition.
- Subjective responses may require one or more manual reviewers.
- Results retain raw score, normalized score, accuracy, detected/missed
  mistakes, category breakdown, pass state, duration, penalties, evaluator,
  and publication state.
- Integrity events such as focus loss, prohibited navigation, or unusual
  timing are retained independently of score.
- Practice attempts are distinguishable from official records and do not
  affect official leaderboards unless configured.
- Retakes may be limited, manually granted, or gated by training completion.

## 7. Learning and remediation

Learning materials include articles, PDFs, videos, brand guides, and
checklists. Materials are categorized and versioned. Questions and mistake
types can link directly to corrective material.

Learning paths contain ordered lessons, practice activities, and final
assessments. Assignments and progress must be tracked per learner. Completion
may issue a verifiable certificate. Rule-based and AI-assisted recommendations
may use assessment evidence, but must record their basis and never silently
change an official score.

## 8. Recurring programs

Assessment programs may recur daily, weekly, monthly, quarterly, or annually,
with a time zone, start/end dates, availability window, targets, reminders,
escalations, and holiday/blackout rules. Each occurrence is a separate cycle.
New joiners can be included from the next eligible cycle. Missed work can be
marked absent/zero, penalized as late, or extended according to policy.

## 9. Recruitment

Recruitment includes positions, drives, staged assessments, candidates,
applications, invitations, results, ranking, and decision history
(shortlist/hold/reject). Candidate data is tenant-isolated, purpose-limited,
and subject to explicit retention and purge dates. Candidate access does not
create employee privileges.

## 10. Engagement, reporting, and communication

- Leaderboards can operate by company, branch, department, or team and use
  configurable weights, exclusions, periods, and anonymity.
- Recognition includes badges, points, reward catalogue items, redemptions,
  and certificates.
- Dashboards and exports cover individuals, organization units, questions,
  mistakes, assessment cycles, training, candidates, and trends.
- Scheduled reports and notifications must record generation and delivery
  outcomes.
- Notifications support in-app, email, and future channels, with templates,
  preferences, retries, and deduplication.

## 11. AI and media requirements

AI capabilities include provider-neutral question generation, evaluation
assistance, feedback, recommendations, prompt/version management, cost and
token accounting, safety logs, model configuration, and agent execution
history. Claude-compatible orchestration and OpenAI image generation must be
possible without coupling core records to one vendor.

Original media and immutable derivatives are object-store assets. The database
stores metadata, versions, lineage, checksums, moderation/provenance data, and
signed-access policy inputs. SVG is stored and rendered through a sanitized,
versioned pipeline. Generated-image cache entries are tenant-scoped.

## 12. Non-functional requirements

- Scale baseline: at least 1,000 tenants, 1 million users, and 100 million
  assessment records.
- Strong tenant isolation at application and PostgreSQL row-policy layers.
- Immutable evidence for published content, delivered papers, evaluations,
  billing, AI usage, and audit events.
- Encryption in transit and at rest, secrets kept outside database rows,
  least privilege, data minimization, and retention-aware purge workflows.
- Idempotent asynchronous processing through an outbox and durable queues.
- Observable operations with structured logs, metrics, traces, alerts,
  correlation IDs, backups, point-in-time recovery, and tested disaster
  recovery.
- Web APIs must remain compatible with future native mobile clients and
  external automation without requiring database access.

## 13. Database design invariants

1. Every tenant-owned row carries `tenantId`; high-value relationships also
   enforce tenant-consistent composite foreign keys.
2. Mutable business records use optimistic versioning, audit actor fields, and
   soft deletion where legal retention permits.
3. Published definitions are immutable versions; assignments and attempts
   reference those versions.
4. High-volume evidence is append-only, time-partitionable, and removed only
   through approved retention workflows.
5. Platform-global reference data is explicitly separated from tenant-owned
   data and cannot be mistaken for an unscoped tenant row.

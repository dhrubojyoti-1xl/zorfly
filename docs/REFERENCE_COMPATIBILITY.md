# OneXL Reference Compatibility Assessment

## Status and scope

This assessment records the read-only study of the supplied
`zorfly-api-main` and `zorfly-app-main` reference snapshots. The snapshots are
product and interaction references; this repository is the only implementation
target. The production database baseline in `database/schema.prisma` remains
authoritative and is not replaced by the reference MongoDB models.

## Reference product map

The OneXL product is a multi-tenant workforce quality platform with these
established journeys:

- company registration, multi-company login, company switching, password
  recovery, profile management, and master-admin support impersonation;
- company, department, branch, team, employee, role, permission, category, and
  branding administration;
- a media-rich question bank, fixed and random tests, publication snapshots,
  assignments, recurring schedules, autosaved attempts, proctor evidence,
  deterministic scoring, manual review, results, and certificates;
- practice material, a study library, learning materials, learning paths, and
  automatic progress;
- recruitment drives, a public candidate portal, candidate assessment, ranking,
  and HR decisions;
- points, badges, leaderboards, dashboards, analytics, six standard report
  families, exports, recipients, and scheduled report mail;
- plans, country pricing, subscriptions, coupons, referrals, usage limits,
  notifications, email logs, recycle-bin behavior, global settings, and
  maintenance mode;
- Claude-backed question, test, and study-material generation with preview and
  validation before persistence.

The web reference is a React single-page application using React Router, Vite,
Axios, Lucide, Tailwind utilities, and a substantial CSS-token design system.
The API reference is an Express modular monolith using Zod validation,
Mongoose, JWTs, role/permission middleware, an in-process scheduler, SMTP,
S3-specific uploads, and a single Anthropic adapter.

## Decisions

| Concern | Preserve | Production change |
| --- | --- | --- |
| Web | React SPA, React Router route semantics, role-aware shell, established workflows, theme/accent/font preferences | TypeScript, feature packages, generated contracts, TanStack Query, accessible primitives, component tests, route-level code splitting |
| API | Express middleware and modular route lineage, `/api/v1`, REST resources, Zod validation, response compatibility | Express 5, TypeScript, controllers separated from application/domain code, RFC 9457 errors, OpenAPI, idempotency, structured logging |
| Persistence | Product entities, publication snapshots, attempt snapshots, deterministic scoring inputs | Prisma/PostgreSQL baseline, transactions, optimistic concurrency, soft deletion, partition-ready high-volume tables, tenant RLS |
| Tenancy | Tenant derived from authenticated membership and fail-closed tenant context | Request-scoped context plus transaction-scoped PostgreSQL tenant variables and RLS; explicit audited platform scope |
| Authorization | Built-in roles, custom roles, permission catalogue, manager/team scope | Deny-by-default policy service at route and application boundaries; no role-only authorization drift |
| Jobs | Recurring assessments, expiry, scheduled reports, notification side effects | Separate BullMQ worker, Redis-backed repeatable jobs, transactional outbox, idempotent consumers, retries and dead-letter handling |
| Storage | Media upload and protected delivery workflows | S3-compatible storage port; MinIO locally; AWS S3, Azure-compatible gateway, GCS interoperability layer, or other supported object store by configuration |
| Email | SMTP templates and email logs | Provider-neutral mail port with SMTP default, queue delivery, idempotency, webhook status updates, and secret-managed credentials |
| AI | Generate-preview-review-save workflow and strict schema validation | Capability-based provider gateway for Claude, OpenAI, Gemini, and OpenAI-compatible local models; versioned prompts, budgets, usage, cost, cache, evaluation, rate limits, and failover |
| Reporting | Existing report families and PDF/XLSX export expectations | Read models and asynchronous exports for large data sets; stored artifacts and expiring download links |
| Deployment | Containerized web delivery and environment configuration | Cloud-agnostic OCI images and Docker Compose reference topology; no cloud SDK in domain code and no mandatory managed vendor |

## Compatibility invariants

Implementation must preserve:

1. the established role-visible journeys and public candidate isolation;
2. published question content as an immutable assessment snapshot;
3. server-authoritative timing, scoring, review, and result publication;
4. practice and recruitment data separation from official employee metrics;
5. tenant context derived server-side, never accepted as a trusted body or
   query field;
6. `/api/v1` as the initial compatibility surface, with documented additive
   evolution;
7. dark/light behavior and the information architecture represented by the
   existing application shell;
8. preview and deterministic validation before AI-generated content becomes
   publishable.

## Reference risks that must not be copied

- refresh tokens without rotation, reuse detection, or a revocable session
  record;
- browser access tokens persisted in local storage;
- partial multi-record writes without database transactions;
- fire-and-forget audit, reward, or notification writes;
- in-memory rate limiting and a process-local minute scheduler;
- base64 proctor images stored in transactional records;
- direct S3 coupling and uploads without content sniffing, malware scanning,
  quarantine, or media normalization;
- hard deletion of organization data and inconsistent archive semantics;
- role checks where permission checks are required;
- unseeded random selection or shuffling that cannot be reproduced;
- non-atomic attempt-limit checks and final submission;
- raw access-token persistence in browser local storage;
- AI provider keys and SDK behavior exposed beyond an adapter;
- reporting scans that cannot remain bounded at the target record volume;
- absence of frontend, API integration, tenant-isolation, accessibility, and
  end-to-end test suites.

## Target module boundaries

The API and worker share domain/application packages organized by capability:

- identity, access, tenants, organization, settings, audit, and platform admin;
- questions, assessments, assignments, scheduling, attempts, scoring, review,
  results, certificates, and proctoring;
- learning library, study, practice, learning paths, and progress;
- recruitment drives, candidates, candidate sessions, ranking, and decisions;
- rewards, leaderboards, notifications, email, calendar, analytics, reports,
  subscriptions, plans, coupons, and referrals;
- AI control plane, prompt management, generation, evaluation,
  recommendations, assistant conversations, image generation, SVG assets, and
  model configuration.

Each capability owns its application services and repositories. Cross-capability
effects are committed through the outbox and processed by workers. Direct
cross-module table writes are prohibited.

## Delivery order

The implementation sequence is:

1. compatible workspace, contracts, local services, telemetry, and CI;
2. sessions, tenant context, organization, RBAC, settings, audit, and master
   administration;
3. questions through results, including deterministic scoring and review;
4. learning, recruitment, rewards, billing, notifications, reports, and
   analytics;
5. provider-neutral AI, image, assistant, evaluation, and SVG pipelines;
6. complete responsive web journeys and production hardening.

Every slice includes authorization, tenant isolation, audit behavior,
observability, tests, API documentation, migrations if required, and a verified
commit.

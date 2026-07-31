# Implementation Plan

## Purpose

This plan delivers the complete SRS in reference-compatible vertical slices.
Each phase ends with measurable exit criteria, tests, documentation, and a
verified commit.

## Phase 0 — Product and risk discovery

### Outcomes

- Define Zorfly's target users, core workflows, and domain language.
- Classify data and identify regulatory, residency, retention, and deletion
  requirements.
- Define tenant, organization, user, membership, and role semantics.
- Classify AI inputs, outputs, prompts, embeddings, generated media, and agent
  tool actions before selecting capabilities.
- Produce initial threat model, abuse cases, availability targets, recovery
  objectives, and cost guardrails.
- Record build-versus-buy decisions and vendor due diligence.

### Exit criteria

- Approved product brief and domain glossary.
- Approved data-classification and retention matrix.
- Initial threat model with owned mitigations.
- Draft service-level objectives, RTO, and RPO.
- ADRs for tenancy, identity, authorization, API contracts, AI provider
  boundaries, recovery, cloud, and repository strategy.

## Phase 1 — Engineering workspace bootstrap

### Outcomes

- Initialize pnpm workspaces and Turborepo.
- Pin Node.js, pnpm, TypeScript, formatting, and linting versions.
- Bootstrap React/Vite web, Express API, and BullMQ worker shells.
- Establish platform-neutral contract, AI, design-token, security,
  observability, and testing packages.
- Add local PostgreSQL and service emulation through Docker.
- Document one-command setup and troubleshooting.

### Exit criteria

- A new engineer can validate the workspace from a clean clone.
- Formatting, linting, type-checking, unit tests, and builds run consistently.
- No secrets or machine-specific assumptions are required.
- Dependency boundaries are enforced automatically.

## Phase 2 — Portable delivery foundation

### Outcomes

- Define the Docker Compose reference topology and optional isolated provider
  templates.
- Establish OCI images, PostgreSQL, Redis, S3-compatible storage, SMTP,
  secrets, telemetry, edge-proxy, and DNS contracts.
- Establish GitHub Actions quality, security, build, signing, and promotion
  workflows using OIDC.
- Implement rolling or blue/green deployments and automated rollback signals.
- Define backup, restore, incident, and access-management runbooks.
- Provision or prove the documented recovery-region path and required quotas.

### Exit criteria

- A minimal container deploys through the same promotion path used later.
- No long-lived production credentials exist in GitHub.
- Infrastructure changes produce reviewable plans.
- Restore and rollback procedures are tested.
- Cost, security, and operational dashboards exist.

## Phase 3 — Platform security and tenancy

### Outcomes

- Implement rotated Zorfly sessions and standards-based enterprise identity
  adapters.
- Implement organization membership, roles, permissions, and tenant context.
- Implement versioned policy decisions, enforcement points, separation of duty,
  delegated agent authority, and prompt revocation.
- Establish PostgreSQL tenant constraints and row-level security.
- Add audit-event schema and tamper-evident export strategy.
- Add rate limiting, request validation, security headers, CSRF strategy, and
  secret rotation.
- Automate negative cross-tenant and authorization tests.
- Threat-model support access, AI tools, uploads, and SVG trust boundaries.

### Exit criteria

- Authentication, authorization, and tenant threat models are reviewed.
- Automated tests prove representative cross-tenant access is denied.
- Privileged actions are attributable and auditable.
- SSO, MFA, session expiry, and lifecycle-provisioning paths are tested.
- Security review has no unresolved launch-blocking findings.

## Phase 4 — Application platform capabilities

### Outcomes

- Define REST/OpenAPI conventions and generated contract workflow.
- Establish client-neutral contracts, mobile compatibility policy, and OAuth
  authorization-code-with-PKCE design.
- Add transactional outbox, idempotency, BullMQ consumers, retry policies, and
  dead-letter handling.
- Add tenant-fair admission, queue concurrency, and distributed cache patterns.
- Add S3 signed-upload and download patterns with malware-scanning hooks.
- Integrate SMTP and notification channels behind provider-neutral interfaces.
- Establish feature flags and safe configuration delivery.
- Define privacy export and deletion foundations.

### Exit criteria

- Failure and replay scenarios are tested.
- External provider timeouts and degradation behavior are documented.
- API and event compatibility checks run in CI.
- Queue, storage, email, and notification operations are observable.
- Cache failures preserve correctness and public contracts pass compatibility
  checks for web and future mobile clients.

## Phase 5 — AI, agent, and media platform readiness

This phase is required only before an AI or advanced media capability is used by
a product feature.

### Outcomes

- Implement provider-neutral AI contracts, capability registry, routing policy,
  prompt registry, budgets, and provider adapters.
- Implement durable agent-run state, typed tool gateway, execution-time
  authorization, approval binding, and kill switches.
- Add representative offline evaluations and controlled human-review workflow.
- Add dedicated AI queues, rate/concurrency controls, cost accounting, provider
  circuit breakers, and degradation modes.
- Implement quarantine, scanning, normalization, provenance, and immutable asset
  storage.
- Implement the constrained scene graph, deterministic SVG serializer,
  sanitizer, sandboxed raster preview, and malicious-content tests.

### Exit criteria

- Model, prompt, and tool releases are blocked without evaluation evidence.
- Cross-tenant prompts, memory, retrieval, tools, and assets are denied in
  automated tests.
- Consequential tools cannot execute without current authorization and required
  human approval.
- Provider outage, retry, budget, cancellation, and duplicate-delivery behavior
  is tested.
- Generated images and imported SVG cannot bypass quarantine and validation.

## Phase 6 — Observability and operational readiness

### Outcomes

- Instrument web, API, workers, database access, and external calls with
  OpenTelemetry.
- Define dashboards, SLOs, error budgets, alerts, and runbooks.
- Exercise dependency failures, queue backlogs, deployment failures, and
  database restore.
- Add synthetic checks and release health comparison.
- Establish incident roles, severity model, communications, and review process.

### Exit criteria

- Every page-worthy alert is actionable and linked to a runbook.
- Traces connect browser, API, queue, and worker operations.
- AI traces connect capability, provider, model/prompt version, agent run, tool,
  approval, usage, and cost without exposing raw sensitive content.
- Recovery objectives are demonstrated in an exercise.
- On-call ownership and escalation are documented before production traffic.

## Phase 7 — SRS product capabilities

Deliver in dependency order:

1. tenants, organization, RBAC, settings, audit, and platform administration;
2. questions, assessments, assignments, schedules, attempts, scoring, review,
   results, certificates, and proctoring;
3. study, practice, learning content, paths, progress, and recommendations;
4. recruitment drives, public candidate sessions, assessment, ranking, and
   decisions;
5. rewards, leaderboards, calendar, notifications, mail, billing, coupons,
   referrals, dashboards, analytics, exports, and scheduled reports;
6. AI generation, improvement, translation, evaluation, recommendations,
   insights, assistant conversations, image generation, and SVG asset flows;
7. the complete responsive, accessible React product surface.

Each capability includes tenant and permission enforcement, audit behavior,
API/OpenAPI contracts, migrations where required, unit/integration/E2E tests,
telemetry, error states, and operational documentation.

## Phase 8 — Production readiness

### Outcomes

- Complete performance, capacity, security, accessibility, privacy, and
  resilience reviews.
- Validate backup restoration and disaster recovery.
- Exercise regional recovery in dependency order and record actual RTO/RPO.
- Complete vendor, data-processing, subprocessor, and support documentation.
- Define vulnerability management and patch service levels.
- Run a production launch rehearsal and rollback.

### Exit criteria

- Launch checklist is approved by product, engineering, security, and
  operations owners.
- Error budgets, capacity limits, and cost alarms are active.
- Critical runbooks have been exercised.
- No unresolved critical or high-severity security findings remain.

## Phase 9 — Evolution based on evidence

After launch, use telemetry and team constraints to decide whether to:

- extract modules into services;
- introduce dedicated tenant infrastructure;
- add search, analytics, or warehouse systems;
- adopt regional deployments;
- add Kubernetes or a streaming platform.
- add vector search, an AI gateway, or provider-hosted agent orchestration.

Each change requires measurable need, an ADR, an operating model, a migration
plan, and a rollback strategy.

## Cross-cutting quality gates

Every phase considers:

- security and privacy;
- tenant isolation;
- accessibility;
- reliability and recovery;
- observability;
- performance and cost;
- test strategy;
- documentation and ownership;
- deployment and rollback.

## Explicit constraints

- Do not redesign the approved database baseline without an implementation
  finding, migration impact assessment, and ADR.
- Do not copy MongoDB-specific persistence or process-local scheduling from the
  reference.
- Do not add mandatory cloud-vendor dependencies.
- Do not ship placeholder routes, fabricated data, disabled validation, or
  unresolved `TODO` behavior.

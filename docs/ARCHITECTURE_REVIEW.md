# Principal Architecture Review

## Review status

**Decision:** approved as an implementation foundation with mandatory gates.

The architecture foundation, database baseline, workspace, API/worker shells,
and reference web application are implemented. Approval does not yet certify
the complete SRS, production readiness, compliance, or service-level attainment.

## Review method

The review examined every tracked file and evaluated the foundation against:

- cloud-agnostic well-architected and SaaS isolation principles;
- zero-trust and least-privilege design;
- NIST RBAC concepts;
- current OpenAI image, Responses API, agent, webhook, and safety guidance;
- current Anthropic Messages API, tool-use, prompt-caching, and batch guidance;
- operational requirements for a multi-tenant enterprise SaaS.

## Executive findings

The initial foundation correctly chose a modular monolith, explicit tenant
context, PostgreSQL row-level security, portable infrastructure, asynchronous
work, OpenTelemetry, and enterprise identity. The review identified six
foundation-level gaps and corrected them:

1. Shared contracts were planned inside `backend/`, creating an invalid
   dependency direction for web and mobile clients.
2. Mobile was not represented as a first-class client.
3. RBAC lacked a formal policy model, decision/enforcement boundaries,
   separation-of-duty rules, and delegated agent authority.
4. AI providers lacked a governed, provider-neutral control plane and durable
   agent execution model.
5. Raster generation, SVG rendering, provenance, moderation, and sanitization
   were undefined.
6. Disaster recovery lacked service tiers, recovery objectives, dependency
   ordering, and evidence requirements.

The repository now includes structural seams and decision documents for each.

## Dimension-by-dimension assessment

| # | Dimension | Assessment | Required architecture |
| --- | --- | --- | --- |
| 1 | Folder structure scalability | Ready | Web, mobile, API, worker, cross-platform packages, infrastructure, database policies, test types, ADRs, threat models, and runbooks have independent boundaries. |
| 2 | Multi-tenant readiness | Ready with gates | Tenant context is derived from verified membership and enforced in API, domain, database RLS, storage, cache, queue, telemetry, cost, and AI policy. Isolation tests are launch-blocking. |
| 3 | Enterprise SaaS readiness | Ready with gates | SSO, SCIM, MFA, audit, data lifecycle, support access, tenant tiers, noisy-neighbor controls, compliance evidence, and operational ownership are specified. |
| 4 | AI architecture readiness | Ready | A provider-neutral AI control plane, model registry, policy engine, prompt registry, evaluation gates, cost accounting, safety pipeline, and durable run state are defined. |
| 5 | Security architecture | Ready with gates | Trust boundaries, least privilege, secrets, egress, data classification, supply-chain controls, AI prompt-injection defense, media sanitization, and threat-model requirements are explicit. |
| 6 | RBAC architecture | Ready | Organization-scoped users, roles, permissions, role versions, policy decisions, resource attributes, separation of duty, support access, and delegated agent authority are defined. |
| 7 | Database scalability | Ready | Connection control, tenant-first keys, index policy, RLS, partition and shard triggers, read replicas, archival, online migration, and pooled-to-silo evolution are covered. |
| 8 | API scalability | Ready | Stateless REST, OpenAPI, cursor pagination, idempotency, conditional requests, quotas, asynchronous operations, compatibility policy, and client-neutral contracts are defined. |
| 9 | Microservice boundaries | Ready | The modular monolith remains intentional. Extraction criteria use data ownership, load/isolation profile, failure domain, team ownership, and deployment cadence—not technical layers. |
| 10 | Future mobile compatibility | Ready | Mobile has a first-class folder; public API contracts are browser-independent; OAuth authorization code with PKCE, deep links, push tokens, offline synchronization, and version policy are planned. |
| 11 | Future AI Agent compatibility | Ready | Agent runs are durable state machines with typed tools, authorization at execution time, human approval, budgets, recursion/turn limits, idempotency, tracing, and replay-safe events. |
| 12 | Future OpenAI Image API integration | Ready | Single-shot generation/editing uses the Image API; conversational editing can use the Responses API. Provider adapters, async jobs, safety, provenance, object storage, quotas, and model/version metadata are specified. |
| 13 | SVG-based rendering architecture | Ready | SVG is produced from a validated internal scene graph by a deterministic renderer. Imported or model-supplied SVG is untrusted, sanitized, canonicalized, raster-previewed, and isolated. |
| 14 | Claude API orchestration | Ready | Claude Messages and tool-use blocks are isolated behind a provider adapter with bounded tool loops, typed schemas, prompt caching, batch routing, request IDs, and provider-specific continuation state. |
| 15 | Caching strategy | Ready | CDN, web, API, distributed Redis, prompt caching, and client caches have ownership, tenant-safe keys, TTLs, invalidation, stampede protection, and data-class restrictions. |
| 16 | Queue architecture | Ready | BullMQ, transactional outbox, idempotent consumers, ordering only when required, dead-letter policies, tenant fairness, AI workload isolation, replay, and poison-message handling are defined. |
| 17 | Logging | Ready | Structured logs, correlation, safe tenant identifiers, audit separation, redaction, sampling, retention, access control, and provider request identifiers are specified. |
| 18 | Monitoring | Ready | OpenTelemetry signals, golden signals, tenant-aware views, AI quality/cost/safety metrics, queue and cache health, SLOs, actionable alerts, synthetic probes, and runbooks are defined. |
| 19 | Deployment | Ready | Immutable signed images, OIDC, policy-as-code, separated accounts, progressive deployment, schema compatibility, migration jobs, feature flags, rollback, and artifact promotion are specified. |
| 20 | Disaster recovery | Ready with gates | Tiered RTO/RPO targets, multi-AZ baseline, cross-region recovery path, backups, restore tests, dependency order, DNS/failback, regional provider degradation, and exercise evidence are defined. |

## Non-negotiable implementation gates

Implementation may begin only when each relevant gate has an owner and evidence:

### Before platform bootstrap

- Accept ADRs for tenancy, authorization, API contracts, AI provider boundary,
  data residency, and disaster recovery.
- Approve data classification and threat-model templates.
- Define supported regions and initial service tiers.

### Before the first product feature

- Automated tenant-isolation tests pass at API and database layers.
- Authorization decision logs are safe and auditable.
- Schema and event compatibility checks run in CI.
- AI capabilities, if enabled, have evaluation datasets, cost limits, safety
  controls, and kill switches.
- Upload and SVG pipelines pass malicious-content tests.

### Before production traffic

- RTO and RPO are demonstrated by restore and regional recovery exercises.
- SLOs, error budgets, dashboards, alerts, and owned runbooks are active.
- Security, privacy, accessibility, load, noisy-neighbor, and resilience reviews
  have no unresolved launch blockers.
- Key rotation, support access, customer export/deletion, and incident response
  have been exercised.
- Every external provider has timeout, retry, circuit-breaker, quota, and
  degradation behavior.

## Architectural risks retained intentionally

| Risk | Reason retained | Control |
| --- | --- | --- |
| Modular monolith may become too coupled | Domain boundaries are not yet proven. | Enforced imports, module contracts, data ownership, architecture tests, extraction criteria. |
| Shared PostgreSQL increases blast radius | It provides efficient transactions and operations at initial scale. | RLS, tenant-first keys, quotas, PITR, load tests, premium silo path. |
| Managed identity and AI vendors create dependency | Building equivalent secure capability is higher risk. | Provider adapters, internal IDs, exportable state, contract tests, exit plans. |
| Multi-region active-active is deferred | Complexity is not justified before recovery targets and traffic patterns are known. | Warm-standby design, cross-region data copies, tested promotion, explicit RTO/RPO. |
| AI behavior is nondeterministic | AI capability is valuable but cannot be treated as conventional code. | Evaluations, structured outputs, tool controls, human approvals, lineage, monitoring, fallbacks. |

## Review cadence

Repeat this review:

- at the end of every implementation phase;
- before adding a new persistent store or external AI provider;
- before extracting a service;
- before entering a regulated market or new data region;
- after a severity-one incident;
- at least twice per year.

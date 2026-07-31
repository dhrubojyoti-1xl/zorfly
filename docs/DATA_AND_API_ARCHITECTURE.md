# Data and API Architecture

The production logical model is defined in
[`database/schema.prisma`](../database/schema.prisma) and documented in the
[data model](../database/DATA_MODEL.md), [ERD](../database/ERD.md), and
[migration strategy](../database/MIGRATION_STRATEGY.md). This document governs
the surrounding data-access and API boundaries.

## Data ownership

Domain modules own their tables and publish contracts for access. A module must
not query or mutate another module's tables directly. Cross-module transactions
are allowed only inside the modular monolith through owned application
interfaces; extracted services use events or APIs.

## Tenant data model

Tenant-owned rows include a non-null `tenant_id`. Design rules:

- derive tenant context from verified membership or workload identity;
- include `tenant_id` in unique constraints and leading index columns when query
  patterns support it;
- include tenant scope in foreign keys where practical;
- use opaque globally unique IDs while still constraining tenant ownership;
- prevent updates that move a row between tenants;
- use transaction-local database tenant context;
- enable and force row-level security on tenant tables;
- separate migration/administration roles from application runtime roles;
- test with a runtime role that cannot bypass RLS.

Global reference data and platform administration data use separate schemas and
explicit access paths.

## PostgreSQL scaling path

### Initial

- Amazon RDS PostgreSQL Multi-AZ in private subnets.
- Connection pooling and bounded per-process pools; evaluate RDS Proxy or
  PgBouncer based on workload and transaction semantics.
- Query timeouts, lock timeouts, slow-query capture, and connection budgets.
- Tenant-aware indexes and query-plan review.
- Point-in-time recovery and encrypted snapshots.

### Growth

- Read replicas for safe read-only workloads with explicit staleness tolerance.
- Partition only tables with measured size, retention, or maintenance pressure.
- Move analytics and long-running exports off the transactional primary.
- Archive cold immutable data to governed object storage.
- Use per-tenant quotas and workload admission to prevent noisy neighbors.

### Sharding or silo triggers

Adopt a tenant placement service before sharding. It maps a tenant to a logical
data cell without clients knowing the physical topology.

Shard or silo when evidence shows:

- primary write or storage limits;
- unacceptable maintenance or recovery time;
- regional residency requirements;
- premium isolation commitments;
- repeated noisy-neighbor impact that quotas cannot control;
- blast-radius or compliance requirements.

Cells preserve the same schema, contracts, migrations, and operational plane.
Cross-cell transactions are prohibited. Cross-tenant analytics uses a separate
governed pipeline.

## Migration safety

- Forward-only migrations run as dedicated deployment jobs.
- Use expand, migrate, contract for breaking changes.
- Application releases remain compatible with old and new schema during rollout.
- Backfills are resumable, rate-limited, observable, and tenant-fair.
- Destructive contraction requires usage evidence and a rollback window.
- Migration roles do not become application credentials.
- Schema and RLS drift fail CI and deployment checks.

## Public API boundary

Zorfly exposes a client-neutral REST/JSON API described by OpenAPI. The web
application may have server-side adapters, but product capability cannot exist
only in Next.js Server Actions or browser-specific endpoints.

This boundary supports web, mobile, integrations, and future agent clients.

## API scalability rules

- Stateless API instances with no local session or job state.
- Cursor pagination with bounded page sizes.
- Idempotency keys for retried mutations and asynchronous job creation.
- ETags and conditional requests for cacheable resources.
- Bulk endpoints with explicit limits rather than client request storms.
- Long-running work returns an operation resource and executes through a queue.
- Rate limits and concurrency budgets by tenant, actor, capability, and risk.
- Backpressure returns stable retry guidance.
- Request and response size limits are explicit.
- Sparse fields or purpose-built projections prevent over-fetching.
- OpenAPI and event schemas are compatibility-checked in CI.

## Versioning

- Prefer backward-compatible additive evolution.
- Version the public API at the major contract boundary.
- Mobile compatibility policy defines a minimum supported client version and
  deprecation window before launch.
- Breaking changes require parallel support, migration guidance, adoption
  telemetry, and a sunset date.
- Events include schema name and version; consumers ignore unknown fields.
- Error responses use RFC 9457 with stable application error codes.

## Mobile compatibility

Future mobile applications use the same public capability contracts with:

- OAuth 2.0 authorization code flow with PKCE and system browser;
- secure OS credential storage and refresh-token rotation;
- universal/app links with verified domains;
- push-notification tokens treated as secrets and scoped to user/device/tenant;
- idempotent mutations and client-generated operation IDs;
- ETag-based synchronization, tombstones, and explicit conflict policy;
- resumable uploads using signed URLs;
- bounded offline data encrypted on device;
- remote minimum-version and kill-switch policy;
- API responses that do not assume browser cookies, HTML, or web navigation.

Device trust or attestation may increase assurance but does not replace user
authorization.

## Caching architecture

| Layer | Purpose | Rules |
| --- | --- | --- |
| Browser/mobile | Static assets and explicitly cacheable API reads | Honor tenant/user scope, ETags, offline sensitivity, and logout clearing. |
| CloudFront | Immutable assets, public content, safe edge responses | Never cache authenticated responses without an explicit reviewed key and policy. |
| Next.js | Render and fetch caching | Tenant/user identity must participate in scope; private pages default to no shared cache. |
| API process | Tiny immutable reference data | No correctness-critical mutable state. |
| ElastiCache Serverless for Valkey | Distributed cache, rate-limit counters, short-lived coordination | Tenant-prefixed keys, TTL on every entry, encryption, no source-of-truth data. |
| Provider prompt cache | Stable AI prompt/tool prefixes | Governed by AI data policy; measured separately from application cache. |

Cache key composition includes environment, schema version, tenant, resource,
authorization-relevant scope, locale, representation, and version.

Invalidation uses:

- immutable content-addressed keys where possible;
- version tokens for aggregate/reference data;
- domain events for targeted eviction;
- short TTLs as a safety net;
- single-flight or leases to prevent stampedes;
- jittered expiry for large key populations.

Never cache credentials, raw authorization tokens, secrets, sensitive AI
transcripts, or mutable authorization decisions without a dedicated review.
Degraded cache behavior must preserve correctness by falling back to the source
of truth or failing closed for security controls.

## Queue and event architecture

### SQS

- Standard queues are default.
- FIFO queues are used only when a documented business invariant requires
  ordering or deduplication within a message group.
- Separate queues by workload isolation and operational policy, not by every
  event type.
- AI image, interactive agent, bulk AI, email, notification, export, and
  maintenance work receive distinct concurrency and cost controls where needed.

### EventBridge

EventBridge routes domain events to multiple consumers and external integrations.
Events are immutable facts, not remote procedure calls.

### Delivery guarantees

- Transactional outbox connects committed PostgreSQL state to publication.
- Consumers are idempotent because delivery is at least once.
- Messages contain identifiers and minimal classified metadata.
- Payloads too large or sensitive for the queue use an encrypted S3 claim-check.
- Retry policy distinguishes transient, throttling, permanent, and policy errors.
- Dead-letter queues have alarms, ownership, triage SLA, and replay tooling.
- Replay preserves original identity, tenant, schema, correlation, and
  idempotency metadata.
- Poison messages cannot block an entire tenant or queue.

### Tenant fairness

- Carry a signed or server-derived tenant context envelope.
- Enforce per-tenant admission, concurrency, and cost budgets.
- Detect hot tenants and isolate high-cost workloads.
- Avoid high-cardinality per-tenant infrastructure unless a tier requires it.
- Track queue age and consumption by tenant tier without exposing tenant names.

## API and event security

- Authenticate public callers and workload identities separately.
- Authorize every resource operation.
- Validate inputs against schemas and business-independent safety limits.
- Sign outbound webhooks; verify replay windows and delivery IDs inbound.
- Apply SSRF-safe egress through approved connector adapters.
- Redact secrets and sensitive values from errors and telemetry.
- Treat generated SDKs as clients, never as authorization controls.

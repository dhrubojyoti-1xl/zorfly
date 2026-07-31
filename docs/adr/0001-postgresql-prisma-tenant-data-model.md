# ADR 0001: PostgreSQL and Prisma Tenant Data Model

- Status: Accepted
- Date: 2026-07-31
- Decision owners: Architecture, Data, Security

## Context

Zorfly must support at least 1,000 companies, 1 million users, and 100 million
assessment records. Published assessment content and historical results must
remain reproducible. Tenant isolation, auditability, media provenance, AI cost
governance, recruitment privacy, and future mobile/agent clients must be
supported without prematurely splitting the system into microservices.

## Decision

1. Use PostgreSQL as the transactional system of record and Prisma as the
   logical schema/migration interface.
2. Organize tables into bounded PostgreSQL schemas while retaining one modular
   monolith database initially.
3. Put mandatory `tenantId` on every tenant-owned row and enforce tenant
   isolation with forced PostgreSQL RLS plus tenant-consistent foreign keys.
4. Separate platform-global reference/identity rows from tenant-owned rows.
5. Model authored content as stable logical identities plus immutable published
   versions. Delivered assessment papers pin those exact versions.
6. Keep scores, audit, billing, rewards, AI usage, and decision evidence as
   append-only histories/ledgers.
7. Store media bytes in private object storage and retain immutable metadata,
   checksum, lineage, moderation, and provenance in PostgreSQL.
8. Use tenant-leading B-tree and time-oriented BRIN indexes, rebuildable
   analytics projections, and a load-tested partition evolution path for
   high-volume evidence.
9. Use custom migration SQL for RLS, checks, triggers, partial/concurrent
   indexes, and partitioning that Prisma cannot fully express.

## Consequences

### Positive

- Historical assessment and AI decisions remain explainable.
- Database-enforced tenant isolation provides defense in depth.
- Provider-neutral AI and media records avoid vendor lock-in.
- Domain schemas establish extraction boundaries without distributed-system
  cost during initial delivery.
- Operational projections prevent dashboards from repeatedly scanning raw
  assessment evidence.

### Costs and risks

- The logical Prisma schema is large and requires strict ownership.
- Custom PostgreSQL SQL must be tested alongside generated migrations.
- Versioned records increase storage and require retention governance.
- RLS requires transaction-scoped tenant context and connection-pool tests.
- Partition shape must be chosen from representative load tests and cannot be
  changed casually after high-volume ingestion.

## Rejected alternatives

- **Separate database per tenant:** stronger physical isolation but excessive
  operational cost for the initial 1,000-tenant target.
- **Application-only tenant filters:** insufficient defense against query bugs
  and privileged data paths.
- **Mutable questions and assessment definitions:** breaks historical
  reproducibility.
- **Store all media/SVG in PostgreSQL:** poor fit for large immutable objects,
  CDN delivery, scanning, and rendering pipelines.
- **Immediate microservices/databases per domain:** adds distributed
  transactions and operational burden before independent scaling evidence.

## Verification

- Prisma format/validation and migration replay in CI.
- Two-tenant and missing-context RLS tests.
- Immutable-version and ledger trigger tests.
- Representative 100-million-record query/load tests before production scale.
- Backup/PITR restore drills with tenant-policy and checksum verification.

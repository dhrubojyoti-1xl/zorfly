# Database Migration Strategy

## 1. Scope and authority

`database/schema.prisma` is the logical data-model source of truth. Checked-in
SQL migrations are the physical database source of truth because PostgreSQL
features such as forced row-level security (RLS), declarative partitioning,
partial indexes, check constraints, immutable-row triggers, and concurrent
indexes are not fully represented by Prisma schema syntax.

Production changes are forward-only. A deployed migration is never edited,
reordered, or deleted.

## 2. Versioning

Migration directories use UTC timestamp plus a descriptive name:

```text
database/migrations/
  20260801090000_initial_namespaces/
  20260801090500_initial_tables/
  20260801091000_tenant_rls/
  20260801091500_assessment_partitions/
```

Each directory eventually contains:

- `migration.sql` — reviewed, deterministic DDL/DML;
- `README.md` — intent, risk, lock expectations, rollback/roll-forward plan,
  observability, and owner for non-trivial changes; and
- optional verification SQL with read-only assertions.

Schema changes use semantic release labels in the change record:

- **compatible** — additive objects, nullable columns, new indexes;
- **transitional** — expand/backfill/contract across releases; or
- **breaking** — approved exception requiring a maintenance plan.

The migration checksum and deployed Git commit are recorded in the release
system. Prisma's migration history table remains enabled; a separate
`operations.schema_release` table may be introduced with the first deployment
automation to record application compatibility windows.

## 3. Required custom PostgreSQL migration

The initial generated migration must be created with
`prisma migrate dev --create-only`, reviewed, and extended with the following
physical controls before it is applied.

### 3.1 Namespaces and privileges

- Create `platform`, `core`, `content`, `assessment`, `learning`,
  `recruitment`, `engagement`, `communications`, `ai`, and `operations`.
- Revoke create privileges on `public`.
- Separate owner, migration, runtime, read-replica/reporting, and break-glass
  roles. Runtime roles never own tables and do not receive `BYPASSRLS`.
- Grant only the schemas and operations each runtime component needs.

### 3.2 Tenant row-level security

For every table containing `tenantId`:

```sql
ALTER TABLE ... ENABLE ROW LEVEL SECURITY;
ALTER TABLE ... FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON ...
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true)::uuid);
```

The request transaction sets `SET LOCAL app.tenant_id = '<uuid>'`. A missing
or invalid tenant context fails closed. Platform-wide jobs use a separate
least-privileged role and explicit tenant iteration; they do not disable RLS.
Connection-pool reset tests must prove that tenant context cannot leak between
transactions.

Platform-global tables are the explicit exceptions listed in
`DATA_MODEL.md`; they have no `tenantId` and are not queried through tenant
repositories.

### 3.3 Tenant-consistent relationships

Every tenant table receives `UNIQUE ("tenantId", "id")` when it is the parent
of another tenant table. Cross-entity foreign keys use
`("tenantId", "<parentId>") REFERENCES parent("tenantId", "id")`.

Where Prisma currently models a polymorphic target (`scopeType`, `targetId`),
check constraints restrict valid nullability and database triggers validate
the target tenant. These tables are:

- `assessment.ScheduleTarget`;
- `assessment.AssignmentTargetScope`;
- `communications.OrganizationMetricPeriod`;
- subject/source references in AI, audit, and ledger evidence.

The application must never infer authorization from a polymorphic reference.

### 3.4 Check constraints

The initial migration adds, at minimum:

- non-negative money, token, duration, count, inventory, marks, and point
  constraints where negative values are not meaningful;
- percentages and confidence values in `[0, 100]` and `[0, 1]` respectively;
- `passingMarks <= totalMarks`, `opensAt < dueAt <= closesAt` when present,
  and valid start/end/expiry ranges;
- exactly one recipient on an assessment assignment: employee membership or
  candidate application;
- exactly one content reference on a learning-path item: material or
  assessment, matching `itemType`;
- valid source/target combinations for practice and official attempts;
- `parentVersionId <> childVersionId` for asset lineage;
- points-ledger arithmetic consistent with entry type; and
- candidate retention dates no earlier than creation.
- session and password-reset expiry later than creation, one-way token hashes,
  and non-negative authentication failure counters.

### 3.5 Immutable rows and append-only evidence

Database triggers reject `UPDATE` and `DELETE` on published or historical
evidence except through a narrowly granted maintenance function:

- published `QuestionVersion`, `AssessmentVersion`,
  `LearningMaterialVersion`, `LearningPathVersion`, and `AIPromptVersion`;
- `AssessmentPaper` and `AssessmentPaperQuestion`;
- `ResponseEvaluation`, `CandidateDecisionHistory`, `RewardPointLedger`,
  `AIPromptLog`, `AITokenUsage`, `AICostTracking`, `AuditEvent`, and
  `AuthorizationDecision`.

Refresh-token rotation and password-reset consumption use conditional updates
inside transactions. A concurrent replay can update zero rows and is rejected;
password changes and successful resets revoke every outstanding user session.

Corrections append a superseding version or compensating ledger event. The
`updatedAt` field on append-only rows exists for storage consistency and is
equal to `createdAt` during normal operation.

Audit events use a tenant-local hash chain. Hashes make later alteration
detectable; they do not replace access control or external immutable exports.

### 3.6 Partitioning for scale

The 100-million-record path is handled with native PostgreSQL partitions.
Because a partitioned table's primary/unique constraint must contain its
partition key, final partition DDL and IDs must be proven in load-test
migrations before production.

| Table family | Initial strategy | Retention unit |
| --- | --- | --- |
| `AssessmentAttempt`, `AttemptQuestion`, `AttemptResponse` | Range by `createdAt` month, then hash by `tenantId` for hot months if load requires | Monthly partition |
| `ResponseEvaluation`, `IntegrityEvent` | Range by `createdAt`/`occurredAt` month | Monthly partition |
| AI execution/log/token/cost history | Range by month | Monthly partition |
| Audit and authorization decisions | Range by `occurredAt`/`evaluatedAt` month | Monthly partition |
| Notification deliveries and outbox | Range by creation month after volume threshold | Monthly partition |
| Reward and candidate decision ledgers | Range by occurrence month | Monthly partition |

Create current and next three monthly partitions in advance. Alert at 30 days
before the final available partition. A default partition is permitted only as
a monitored safety net and must remain empty.

BRIN indexes support broad time scans. Tenant-leading B-tree indexes support
interactive access. JSONB GIN indexes are added only for measured predicates;
unbounded indexing of payload/evidence JSON is prohibited.

### 3.7 Soft-delete uniqueness

The Prisma schema keeps conservative tenant/key uniqueness even after soft
deletion. If a domain explicitly permits identifier reuse, replace the
constraint with a custom partial unique index:

```sql
CREATE UNIQUE INDEX CONCURRENTLY ...
ON ... ("tenantId", "code")
WHERE "deletedAt" IS NULL;
```

Identifier reuse is not the default because it complicates audit
interpretation and external integrations.

## 4. Development workflow

1. Update the Prisma schema and related data-model documents in one change.
2. Run `prisma format` and `prisma validate`.
3. Create a migration with `prisma migrate dev --create-only`.
4. Inspect generated SQL for destructive operations and lock duration.
5. Add required RLS, constraints, partitioning, triggers, and indexes.
6. Apply to a disposable database seeded with representative data.
7. Run schema, RLS, migration, query-plan, and rollback/roll-forward tests.
8. Review by application owner, database owner, and security owner.
9. Apply in a staging clone through the production deployment mechanism.
10. Deploy with metrics, lock monitoring, replication-lag alarms, and an
    explicit abort threshold.

Developers must not use `db push` on shared or production databases. Production
deployments use `prisma migrate deploy` through CI with a dedicated migration
role.

## 5. Zero-downtime changes

Use expand/backfill/contract:

1. **Expand:** add nullable columns/tables/indexes without changing existing
   readers.
2. **Dual compatible:** deploy code able to read old and new forms; dual-write
   only when an idempotent reconciliation job exists.
3. **Backfill:** update bounded primary-key ranges with throttling, checkpoints,
   lag monitoring, and resumability.
4. **Constrain:** validate new checks and foreign keys after backfill. Add large
   indexes concurrently outside a transaction.
5. **Switch:** move reads to the new representation.
6. **Contract:** remove old objects in a later release after the compatibility
   window and rollback window close.

Large table rewrites, blocking type changes, and unbounded updates are rejected
from normal deployment windows.

## 6. Rollback and recovery

Rollback means one of:

- **application rollback** while additive schema remains;
- **roll-forward migration** that corrects a faulty schema or data change;
- **compensating data change** for ledger/history records; or
- **point-in-time recovery (PITR)** into a new cluster for catastrophic loss.

Down migrations are documented but are not automatically executed in
production. Destructive reversal is unsafe after new-version writes occur.
Every transitional migration states the last compatible application version
and the point after which application rollback is no longer safe.

For a failed migration:

1. stop deployment traffic if integrity may be affected;
2. capture database state and migration logs;
3. use Prisma's supported migration-resolution workflow only after the actual
   DDL state is verified;
4. apply the reviewed repair/roll-forward migration; and
5. reconcile data and audit the incident.

## 7. Seed strategy

Seeds are divided into:

- **platform reference seeds:** stable keys for permissions, question types,
  reward types, platform roles, plans, and AI provider/model catalogue;
- **tenant bootstrap seeds:** roles, difficulty levels, departments,
  assessment categories, quality criteria, and notification defaults copied
  into each new tenant; and
- **test fixtures:** synthetic, deterministic, non-production-only data.

All seeds are idempotent upserts by immutable business key. Seed scripts never
update a record whose tenant administrator has customized it; bootstrap rows
carry a seed version/provenance in the deployment manifest until those fields
are added in the implementation phase. Production seeds contain no users,
candidate PII, questions, scores, tokens, or secrets.

See `SEED_PLAN.md` for the catalogue.

## 8. Verification gates

CI must fail unless all of the following pass:

- Prisma format and validation;
- migration replay from empty database;
- upgrade from the previous supported release;
- schema drift detection;
- RLS isolation tests across two tenants and absent tenant context;
- permission tests for migration/runtime/reporting roles;
- immutable-row and check-constraint tests;
- partition-routing and missing-future-partition tests;
- query-plan budgets on representative high-volume queries;
- idempotent seed replay; and
- backup restore plus migration replay in scheduled resilience exercises.

## 9. Backup and disaster recovery

- Managed PostgreSQL Multi-AZ with continuous WAL archiving and PITR.
- Encrypted automated backups copied to a second region/account according to
  retention policy.
- Quarterly full restore exercises and monthly sampled restore verification.
- Documented target of RPO <= 5 minutes and RTO <= 4 hours for the initial
  production tier; higher tiers may tighten these targets.
- Object-store versions, media manifests, secrets configuration, and
  infrastructure definitions are recovered alongside PostgreSQL.
- Disaster recovery restores into a new environment, verifies checksums/RLS,
  rotates credentials, then performs controlled traffic cutover.

## 10. References

- [Prisma: customizing migrations](https://www.prisma.io/docs/orm/prisma-migrate/workflows/customizing-migrations)
- [Prisma Migrate](https://docs.prisma.io/docs/orm/prisma-migrate)
- [PostgreSQL row security policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [PostgreSQL table partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html)
- [PostgreSQL continuous archiving and PITR](https://www.postgresql.org/docs/current/continuous-archiving.html)

# Initial Logical Schema

## Purpose

This migration materializes the complete Prisma model across the ten Zorfly
PostgreSQL namespaces. It includes the identity/session extension required by
the first OneXL-compatible backend migration.

## Compatibility

- Change class: additive initial deployment.
- Application baseline: `feat/reference-compatible-platform`.
- PostgreSQL: 17 target; PostgreSQL 16 is used for local compatibility checks.

## Operational notes

- Apply only to an empty Zorfly database.
- Expected lock risk is limited to namespace and object creation.
- The runtime application must not receive owner or superuser credentials.
- PostgreSQL RLS, tenant-consistent composite foreign keys, append-only
  triggers, partition conversion, and advanced check constraints are delivered
  as reviewed hardening migrations before production traffic is enabled, as
  specified in `database/MIGRATION_STRATEGY.md`.

## Verification

Run:

```bash
prisma migrate deploy
prisma migrate status
prisma validate --schema database/schema.prisma
```

Then execute tenant-isolation, schema-introspection, and application repository
tests against a disposable database.

## Recovery

Before production traffic exists, recovery is to drop and recreate the empty
database, then reapply the migration. After any application data exists,
rollback is forward-only through a reviewed corrective migration or
point-in-time recovery into a new cluster.

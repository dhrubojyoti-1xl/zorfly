# Deployment runbook

## Scope

This runbook covers building and releasing the three portable OCI images
(`docker/api.Dockerfile`, `docker/worker.Dockerfile`, `docker/web.Dockerfile`)
against an already-provisioned PostgreSQL, Redis, S3-compatible object
storage, and SMTP endpoint. It does not cover provisioning that
infrastructure — the `infrastructure/` directory is a scaffold for that work
and is not yet built out. See [Not yet implemented](#not-yet-implemented)
below for the exact gap between this runbook and Phase 2 of
[docs/IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md), and see
[docs/OPERATIONS_AND_RESILIENCE.md](./OPERATIONS_AND_RESILIENCE.md) for the
target operating model these steps will eventually satisfy.

## Images

| Image | Dockerfile | Exposes | Entry point |
| --- | --- | --- | --- |
| API | `docker/api.Dockerfile` | `5000` (HTTP) | `node dist/src/server.js` |
| Worker | `docker/worker.Dockerfile` | none (BullMQ consumer) | `node dist/src/main.js` |
| Web | `docker/web.Dockerfile` | `8080` (HTTP, nginx) | static build served by `nginx-unprivileged` |

All three build from the repository root as the Docker build context (they
`COPY` specific workspace subdirectories, so the build command must be run
from the repo root):

```bash
docker build -f docker/api.Dockerfile -t zorfly-api:<tag> .
docker build -f docker/worker.Dockerfile -t zorfly-worker:<tag> .
docker build -f docker/web.Dockerfile --build-arg VITE_API_BASE_URL=<public-api-base-url> -t zorfly-web:<tag> .
```

Every pull request builds all three images (without pushing) via the
`docker-build` job in `.github/workflows/ci.yml`, so a broken Dockerfile
fails CI before merge. Pushing built images to a registry is not yet wired
up — see [Not yet implemented](#not-yet-implemented).

Both backend images run as a non-root `zorfly` user; the web image runs on
`nginxinc/nginx-unprivileged`. Neither requires elevated container
privileges.

## Required configuration

Copy `.env.example` and fill in real values per environment — never reuse
example values in a non-local environment. At minimum:

- `DATABASE_URL` / `DATABASE_DIRECT_URL` — PostgreSQL connection strings (the
  API and the Prisma CLI use these; the worker does not need direct DB
  access today).
- `REDIS_URL` — BullMQ connection for the worker.
- `OBJECT_STORAGE_*` — S3-compatible endpoint, bucket, and credentials.
- `SMTP_*` — outbound mail for auth/notification emails.
- `SESSION_SIGNING_KEY`, `SESSION_HASH_KEY` — generate unique, high-entropy
  values per environment (`openssl rand -hex 32`). These sign access tokens
  and hash PII (including candidate PII encryption in the recruitment
  module) — rotating them invalidates every active session and makes
  previously-encrypted candidate records unreadable, so treat them as
  long-lived secrets, not routinely rotated ones, unless a rotation plan for
  re-encrypting existing ciphertext is in place first.
- `WEB_ORIGIN` — the API's CORS allow-origin; must match where the web image
  is actually served from.
- `VITE_API_BASE_URL` — baked into the web image at build time (Vite inlines
  it), so it must be set as a Docker build arg, not a runtime env var.
- AI provider keys (`ANTHROPIC_API_KEY`, etc.) are optional; only configure
  the providers actually approved for use.

## Release sequence

1. Build all three images from the commit being released, tagged with the
   commit SHA (or a release tag).
2. Run database migrations against the target database **before** deploying
   any new API/worker instance:

   ```bash
   DATABASE_URL=<target> pnpm exec prisma migrate deploy
   ```

   Every migration added so far in this project is additive (new
   tables/columns/enum values, new indexes and constraints) — none drop or
   rename existing structures. This means `migrate deploy` is safe to run
   ahead of the new code going live: old code keeps working against the
   post-migration schema. Confirm this invariant holds for any new migration
   before deploying it the same way.
3. Deploy the worker first, then the API, then the web image. Order matters
   less here than it does for the migration step, but the worker has no
   inbound dependents, so rolling it first minimizes the blast radius if its
   image is bad.
4. Health-check the API at `GET /api/v1/health` (returns
   `{ data: { service: 'zorfly-api', status: 'ok', version } }`). The worker
   has no HTTP surface; verify it by confirming Redis shows an active
   consumer on the platform queue and that queued jobs are draining.
5. Smoke-test the web image by loading it and confirming it can reach the
   API through the configured `VITE_API_BASE_URL`.

## Rollback

Because migrations are additive-only, rolling back is redeploying the
previous image tags — there is no corresponding "down" migration to run, and
none should be written for already-applied migrations. If a new migration
ever needs to be additive-but-not-yet-backward-compatible (for example,
making a new column required), that must ship as two separate deploys: add
the nullable column first, backfill and switch reads/writes over, then a
later migration tightens the constraint — never a single migration that both
adds and requires a column in the same release the code starts depending on
it.

## First boot

No manual seed step is required. Tenant-scoped catalogs (the permission
catalog, per-tenant defaults) are created during company registration
(`POST /api/v1/companies` / the registration flow), not via a global seed
script. A fresh database only needs migrations applied.

## Not yet implemented

This runbook covers what's actually buildable and testable today. The
following are real gaps against Phase 2 of
[docs/IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) and are explicitly
out of scope until a concrete cloud target and account are chosen:

- **Image publishing and promotion.** CI builds images to catch Dockerfile
  breakage but does not push to a registry or promote a build through
  environments. There is no OIDC-federated deploy credential in GitHub
  Actions yet (by design — none should be added without a real target).
- **Rolling/blue-green deployment and automated rollback signals.** Nothing
  today orchestrates a multi-instance rollout or watches health signals to
  trigger an automatic rollback.
- **Infrastructure as code.** `infrastructure/cdk`, `infrastructure/environments`,
  `infrastructure/providers`, and `infrastructure/policies` are empty
  scaffolding directories. No VPC, database, cache, object storage, or
  edge/CDN resources are provisioned by code anywhere in this repository.
- **Backup/restore and incident runbooks.** [docs/OPERATIONS_AND_RESILIENCE.md](./OPERATIONS_AND_RESILIENCE.md)
  defines the target reliability model, service tiers, and logging/alerting
  requirements, but no concrete, exercised backup/restore or incident
  runbook exists yet for a specific provider.
- **Cost, security, and operational dashboards.** Not built; depend on the
  provider chosen in the infrastructure-as-code work above.

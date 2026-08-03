# AI Integration Export

## Purpose

Automatically export the reusable AI-integration components built in this
repository into a separate, private distribution repository, so the OneXL
engineering team can review and optionally adopt them in their own
production repositories without ever giving them write access to this
monorepo, and without this monorepo ever writing to theirs.

## Source and destination

- **Source (canonical development):** `dhrubojyoti-1xl/zorfly`, branch `main`
- **Destination (generated distribution):** `dhrubojyoti-1xl/zorfly-enterprise-integration-` (private)
- **Consumed by:** `ankit1xl/zorfly-api` and `ankit1xl/zorfly-app` — this
  workflow never reads from, writes to, or opens PRs against either of
  those repositories directly. The private destination is the only handoff
  point; OneXL engineers apply from there manually, on their own schedule.

Synchronization is **one-way**: source → destination. The destination is
generated content — do not hand-edit `packages/`, `backend/api/ai/`,
`database/ai/`, or `tests/` there; edits belong in this source repo. The
sync workflow only ever touches those specific generated paths in the
destination — anything else the OneXL team adds there (their own
`docs/`, `patches/`, notes, etc.) is left alone.

## Exported scope

See `integration/ai-export-manifest.json` for the authoritative list. As of
this writing it covers:

- the AI gateway/orchestration layer (`packages/ai-core`)
- Claude and OpenAI provider adapters and the provider factory
- the AI execution service, repository, router, types, and validation
- the secret-reference indirection pattern (API keys are never stored in
  the database, only an env-var/secret-manager reference name)
- AI-assisted question generation and study-content generation
- AI-specific tests (gateway, execution service, router, OpenAI adapter)
- AI-specific database schema: a Prisma excerpt, an equivalent verified
  raw-SQL migration, and PostgreSQL/MongoDB compatibility documentation

## Excluded scope (never exported)

- `.env` files, credentials, API keys, tokens
- `node_modules`, build output, logs, `.turbo` caches, coverage
- customer/tenant data
- any business module unrelated to AI (assessments, learning, billing,
  recruitment, notifications, reports, etc.) — see the main
  `zorfly-enterprise-integration-` package built in an earlier engagement
  for why those are **not** additive: the OneXL repos already implement
  equivalent functionality natively
- the full `database/schema.prisma` (only the curated `database/ai/*`
  excerpt is exported)
- frontend AI components/pages — none exist in this repo at the current
  manifest version (verified by inspection: no AI-specific pages or
  components were found under `frontend/web/src`), so none are claimed or
  exported

## How the sync works

`.github/workflows/sync-ai-integration.yml` runs on every push to `main`
that touches an AI/export-relevant path (see the workflow's `paths:`
filter), or on manual `workflow_dispatch`. It:

1. Validates the manifest and scans every exported file for secret
   patterns (`scripts/export-ai-integration.mjs --check`) — fails closed.
2. Runs the AI-specific test suites and typechecks against a real
   PostgreSQL service container.
3. Exports the allowlisted files into a clean temp directory with a
   checksummed inventory (`--export`).
4. Clones the private destination with `INTEGRATION_REPO_TOKEN`, rebuilds
   the `automation/zorfly-ai-sync` branch from the destination's current
   `main`, replaces only the generated directories, and commits **only if
   content actually changed** (the source commit SHA is in the commit
   message).
5. Pushes that branch and opens or updates a single pull request into the
   destination's `main`. **It never pushes directly to the destination's
   `main`,** and it never force-pushes anything except the bot-owned
   automation branch (which is fully regenerated every run by design).

## How OneXL engineers consume the package

1. Watch for PRs from `automation/zorfly-ai-sync` in
   `dhrubojyoti-1xl/zorfly-enterprise-integration-` (you'll need read
   access to that private repo — ask to be added as a collaborator).
2. Read `docs/BREAKING_CHANGES.md` and `docs/MERGE_GUIDE.md` in that repo
   before applying anything.
3. This package is **additive/optional** — it is not a replacement for
   your existing `src/ai/*` (Claude client, firewall, question/study
   generation). Nothing here requires you to change what's already in
   production. Adopt individual pieces (provider abstraction, cost
   tracking, prompt versioning, etc.) only where you see value.
4. Any `patches/` in the destination were verified against a real clone of
   your repository (`git apply --check`, plus applicable install/test/build
   commands) before being included — see that repo's
   `docs/VALIDATION_REPORT.md` for exactly what was run. If no patches are
   present for a given capability, that means it could not be reduced to a
   verified, safe patch (usually a language/framework/ORM mismatch) — the
   corresponding code and docs are there for you to adapt manually instead.

## Compatibility expectations

- This is a **Prisma/PostgreSQL/TypeScript/Express 5** implementation.
  `ankit1xl/zorfly-api` is **Mongoose/MongoDB/plain-JS/Express 4**. Nothing
  here will run unmodified against your stack — the gateway/adapter/service
  *design* is reusable; the literal files under `backend/api/ai/` are a
  reference implementation, not a drop-in module, unless a specific
  `patches/` entry says otherwise for a verified, isolated file.
- `packages/ai-core` (the gateway) has zero runtime dependencies beyond
  TypeScript itself and is the most directly portable piece — it doesn't
  touch Mongoose or Prisma at all, only `AiProviderAdapter` interfaces.

## Installation / apply sequence

See the destination repository's own `README.md` and `scripts/` once
generated (`verify-upstreams.sh`, `check-patches.sh`, `apply-*.sh`) — they
follow the same pattern as this team's earlier general integration package.

## Rollback procedure

- **In the destination repo:** revert the merge commit of the sync PR, or
  simply don't merge it — the automation branch is disposable and gets
  rebuilt from `main` on the next sync regardless.
- **In your own repo, after applying a patch:** `git apply -R <patch>`
  before committing, or `git revert` the commit you made after applying.
- **This source repo:** the export tooling itself
  (`integration/`, `scripts/export-ai-integration.mjs`,
  `.github/workflows/sync-ai-integration.yml`) can be reverted like any
  other commit; it has no effect on this repo's own runtime behavior.

## Conflict-resolution rules

- The sync workflow only ever deletes-and-replaces the specific generated
  paths listed in the workflow (`packages/`, `backend/api/ai/`,
  `database/ai/`, `tests/ai-core/`, `tests/api/`, `manifest/`). It never
  touches anything else in the destination, so OneXL-authored content
  there (their own docs, notes, additional patches) is never at risk of
  being silently overwritten.
- If the destination's `main` has moved since the last sync, the next run
  simply rebuilds the automation branch from the new `main` and reopens/
  updates the PR — there is no merge step to conflict.
- The commit is a no-op (nothing pushed, no PR touched) whenever the new
  export is byte-identical to what's already on the automation branch.

## How to add a new AI file to the allowlist

1. Add a `{ "source": "...", "dest": "..." }` pair to the relevant entry
   (or a new entry) in `integration/ai-export-manifest.json`. `source` is
   this repo's path; `dest` is the path inside the destination package.
2. Run `node scripts/export-ai-integration.mjs --check` locally — it
   validates the file exists, contains no detected secrets, and (for
   `package.json` files) that every external dependency is on
   `requiredExternalDependenciesAllowlist`.
3. Run `node scripts/export-ai-integration.mjs --export /tmp/ai-export`
   and inspect the output tree and `export-inventory.json`.
4. Commit the manifest change on `main` — the next sync run will pick it
   up automatically (the workflow's `paths:` filter already includes
   `integration/ai-export-manifest.json`).

## How to run export validation locally

```bash
node scripts/export-ai-integration.mjs --check
node scripts/export-ai-integration.mjs --export /tmp/ai-export
cat /tmp/ai-export/export-inventory.json
```

Neither command touches network, git remotes, or anything outside the
directory you pass to `--export` (which must not already exist or must be
empty — the script never deletes existing content).

## Creating `INTEGRATION_REPO_TOKEN`

This must be created by a human with admin access to
`dhrubojyoti-1xl/zorfly-enterprise-integration-` — no automation can do
this for you, and no token pasted into chat during this project was ever
used:

1. GitHub → Settings → Developer settings → Fine-grained personal access
   tokens → Generate new token.
2. **Repository access:** "Only select repositories" →
   `dhrubojyoti-1xl/zorfly-enterprise-integration-` only.
3. **Permissions:** Contents (Read and write), Pull requests
   (Read and write). Nothing else.
4. Set an expiration and rotate it before it lapses.
5. Add it as a repository secret named `INTEGRATION_REPO_TOKEN` on
   `dhrubojyoti-1xl/zorfly` (Settings → Secrets and variables → Actions).
   Never commit it, paste it in a PR, or put it in `.env`.

# AI Schema Compatibility

This documents the `ai` Postgres schema from `dhrubojyoti-1xl/zorfly` — a
design reference for the AI capability described in `integration/README.md`,
not a live migration target for either upstream repo.

## Contents

- `ai-schema-excerpt.prisma` — the Prisma models/enums, verbatim
- `ai-schema-migration.sql` — the equivalent raw SQL, verbatim-extracted from
  the real, already-applied initial migration, and independently validated
  by applying it end-to-end against a live PostgreSQL 17 instance under a
  scratch schema name (`ai_validate_test`), then rolling it back with
  `DROP SCHEMA ... CASCADE`. Both succeeded with no errors.

## Tables (20) and what they're for

| Table | Purpose |
| --- | --- |
| `AIProvider` | registry of provider integrations (e.g. "claude", "openai") |
| `AIModel` | specific models per provider, with pricing metadata |
| `TenantAIProviderConfiguration` | per-tenant secret reference + quota for a provider |
| `AIModelConfiguration` | per-tenant, per-purpose model selection, budgets, fallback chain |
| `AIPrompt` / `AIPromptTemplate` / `AIPromptVersion` | prompt management and versioning, with content-hash-based dedup |
| `AIPromptExecution` | one row per AI call: status, idempotency key, input/output snapshot, timing |
| `AIPromptLog` | structured execution event log |
| `AITokenUsage` | per-execution token accounting |
| `AICostTracking` | per-execution cost accounting (currency, unit price, pricing version) |
| `SVGAsset` / `GeneratedImage` / `ImageCache` | AI image generation outputs and caching |
| `QuestionGenerationHistory` | AI-drafted questions and human accept/reject decisions |
| `AIEvaluationHistory` | AI-assisted response evaluation |
| `AIFeedbackHistory` | AI-generated feedback, versioned |
| `AIRecommendation` | AI recommendations with lifecycle status |
| `AgentRun` / `AgentRunStep` | multi-step AI agent execution tracking |

## Required prerequisites (external to the `ai` schema)

The `ai` schema is additive but not fully self-contained — it has foreign
keys into other schemas:

| Referenced object | Referenced by | Kind |
| --- | --- | --- |
| `core.Tenant` | almost every `ai` table | table |
| `content.Question`, `content.QuestionVersion` | `QuestionGenerationHistory` | table |
| `content.MediaAssetVersion` | `GeneratedImage` | table |
| `assessment.AssessmentAttempt` | `AIEvaluationHistory` | table |
| `core.RecordStatus` | `AIProvider`, `AIModel`, `TenantAIProviderConfiguration`, `AIModelConfiguration` | enum type |
| `content.VersionStatus` | `AIPromptVersion` | enum type |

## MongoDB/Mongoose mapping guidance (`ankit1xl/zorfly-api`)

This schema will **not** migrate as-is onto MongoDB — Mongoose has no
concept of foreign keys, `JSONB`, decimals, or Postgres-native UUID
generation. If OneXL wants the equivalent capability on Mongoose, the
practical mapping is:

| Postgres concept here | Mongoose equivalent |
| --- | --- |
| `AIPromptExecution` table with FKs to logs/usage/cost | one `AiExecution` document with logs/usage/cost as embedded sub-documents (this repo already has `AiEvent`/`AiUsageLog` models close to this) |
| `Decimal(19,8)` cost/pricing columns | store as `Number` (cents/micros) or a `Decimal128` field |
| `@@unique([tenantId, idempotencyKey])` | a compound unique index on the same two fields |
| `secretReference` indirection (`TenantAIProviderConfiguration`) | same pattern is directly reusable — store only an env-var name or secret-manager reference, never the key itself |
| Prompt versioning (`AIPrompt`→`AIPromptVersion` with `contentHash`) | a `prompts` collection with an embedded `versions` array, deduped by the same SHA-256 content hash approach |

None of this is scripted automatically — OneXL's `AiEvent`/`AiUsageLog`
models already exist and cover part of this; a MongoDB migration would be a
manual modeling exercise using the table above as a checklist, not a
generated patch.

## PostgreSQL/Prisma mapping guidance (a future OneXL Postgres migration)

If OneXL ever moves off MongoDB, `ai-schema-migration.sql` can be applied
as-is (it only needs `core.Tenant`, `content.Question`,
`content.QuestionVersion`, `content.MediaAssetVersion`,
`assessment.AssessmentAttempt`, and the two enum types listed above to
exist first) or adapted by re-pointing the five foreign keys at whatever
the target schema's equivalent tables are named.

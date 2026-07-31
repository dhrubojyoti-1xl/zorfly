# AI, Agent, Image, and SVG Data Architecture

## 1. Design goals

The AI control plane is provider-neutral, tenant-isolated, reproducible,
cost-accountable, safe, and independently auditable. OpenAI image generation,
Claude-compatible text/tool orchestration, and future providers are adapters
around the same persisted contracts.

AI output is advisory until a domain workflow explicitly accepts it. AI may
propose questions, evaluations, feedback, recommendations, images, or SVG
assets; it does not silently publish content, alter official results, assign
permissions, or execute high-impact tools.

Secrets are never stored in this schema. A tenant provider configuration stores
only the secret-manager reference and non-secret endpoint/quota metadata.

## 2. Provider and model catalogue

| Table | Purpose | Important fields and rules |
| --- | --- | --- |
| `AIProvider` | Platform catalogue of provider adapters | Immutable `key`, capabilities, operational status; no credentials |
| `AIModel` | Versioned provider model/SKU metadata | Provider model key, capabilities, context window, effective price metadata; unique per provider |
| `TenantAIProviderConfiguration` | Tenant enablement and secret indirection | Tenant/provider unique; secret reference only; soft-deletable and RLS protected |
| `AIModelConfiguration` | Tenant routing policy for a capability | Purpose, parameters, budgets, safety policy, fallback chain; executions retain the exact configuration reference |

Provider prices change. `AIModel` holds the current/effective catalogue while
each `AICostTracking` entry stores the price and pricing version actually used.
Historical costs are therefore reproducible after catalogue changes.

## 3. Prompt lifecycle

| Table | Purpose | Important fields and rules |
| --- | --- | --- |
| `AIPrompt` | Tenant-owned logical prompt/use case | Stable key, purpose, lifecycle, pointer to current published version |
| `AIPromptTemplate` | Reusable authoring component | Role, ordered template text, variable JSON Schema; soft-deletable |
| `AIPromptVersion` | Immutable executable prompt snapshot | Rendered message set, variable/output schemas, safety/evaluation configuration, content hash |

Draft components may change. On publication, the complete executable prompt is
materialized into `AIPromptVersion.messages`; executions never reconstruct an
old prompt from mutable templates. Publication validates variables, output
schema, injection boundaries, content hash, and model capability compatibility.

## 4. Execution, logs, tokens, and cost

| Table | Purpose | Important fields and rules |
| --- | --- | --- |
| `AIPromptExecution` | One provider-neutral invocation envelope | Tenant idempotency key, purpose, prompt/config references, source reference, hashes, status, latency, provider request ID |
| `AIPromptLog` | Ordered sanitized execution events | Append-only sequence, level/type, safe attributes; no raw secret or unrestricted PII logging |
| `AITokenUsage` | Provider usage measurements | Input/cached/output/reasoning/total tokens; append-only and independently reconcilable |
| `AICostTracking` | Financial usage ledger | Quantity, unit, price, amount, currency, pricing version, incurred time; append-only |

Raw inputs/outputs are stored only when the use case and retention policy allow
it. Otherwise `inputHash`, source references, redacted snapshots, and
object-store evidence provide reproducibility. Logs and payloads are classified
and redacted before persistence.

Execution state transitions are monotonic. Retry creates a new execution with a
new public ID and links through correlation/source metadata; provider retries
cannot duplicate accepted domain output because the tenant idempotency key and
domain acceptance transaction are unique.

## 5. Question generation and evaluation

| Table | Purpose | Important fields and rules |
| --- | --- | --- |
| `QuestionGenerationHistory` | Provenance from generation request to proposed question | Source question, request, validation, generated immutable version, human accept/reject decision |
| `AIEvaluationHistory` | AI evaluation/adjudication evidence | Attempt reference when relevant, evaluation type, result, confidence, human outcome/reviewer |
| `AIFeedbackHistory` | Version chain of generated coaching feedback | Subject reference, structured feedback, publish time, superseded version |
| `AIRecommendation` | Actionable but non-authoritative proposal | Subject, recommendation/evidence, state, expiry, human decision |

Generated questions enter the normal draft/review/publication workflow.
`QuestionGenerationHistory` is provenance, not the question source of truth.

AI-assisted response scoring is recorded separately from the authoritative
`ResponseEvaluation`. Promotion into official scoring requires the configured
confidence/risk policy and, where required, a manual reviewer. Overrides append
new evaluation evidence; they do not erase AI output.

Recommendations always include evidence and an expiry. Accepted training or
retake recommendations create normal domain records through a future
application service and outbox transaction.

## 6. OpenAI image integration

| Table | Purpose | Important fields and rules |
| --- | --- | --- |
| `GeneratedImage` | Provenance for an accepted image-generation output | Prompt execution, immutable media version, provider image ID, revised prompt, parameters, moderation and provenance |
| `ImageCache` | Tenant-scoped deduplication/cache index | SHA-256 cache key plus policy version, generated image, expiry and hit metadata |
| `MediaAsset` / `MediaAssetVersion` | Durable object-store metadata | Logical asset plus immutable bytes/checksum/version |
| `AssetLineage` | Derivative graph | Parent/child versions and transformation parameters |

The cache key is calculated from tenant, provider/model configuration, exact
prompt version/rendered input hash, normalized generation parameters, safety
policy version, and output transformation version. Cross-tenant image reuse is
prohibited even when hashes match unless a separately governed platform asset
library is introduced.

Provider URLs are transient and never treated as storage. Accepted bytes are
virus-scanned/moderated, checksummed, written to private object storage, and
registered as an immutable `MediaAssetVersion`. Public delivery uses derived
assets and signed access/CDN controls.

## 7. SVG rendering

| Table | Purpose | Important fields and rules |
| --- | --- | --- |
| `SVGAsset` | Security and renderer metadata for a sanitized SVG version | Media version, source, sanitizer/renderer versions, view box, element count, sanitized hash, safety report |
| `MediaAssetVersion` | Immutable sanitized SVG bytes | Checksum and object-store location |
| `AssetLineage` | Original-to-sanitized-to-raster lineage | Transformation operation and parameters |

Original SVG uploads/generated output are quarantined. The pipeline:

1. parses with external entity and network access disabled;
2. rejects scripts, event handlers, embedded foreign content, unsafe links,
   excessive complexity, and unsupported filters;
3. normalizes and sanitizes into a new immutable version;
4. records sanitizer policy/version and safety report;
5. renders in an isolated, resource-limited worker; and
6. produces raster/vector derivatives linked through `AssetLineage`.

The browser never renders unsanitized tenant SVG. A sanitizer change produces a
new version and cache namespace, preserving historical evidence.

## 8. Agent orchestration

| Table | Purpose | Important fields and rules |
| --- | --- | --- |
| `AgentRun` | Durable orchestration envelope | Agent/version, objective, policy snapshot, input/output, model configuration, state |
| `AgentRunStep` | Ordered model/tool/approval step | Tool, safe input/output, state, timing, approval identity |
| `AIPromptExecution` | Model call within or initiating a run | Provider-neutral request, usage and cost |
| `AuthorizationDecision` / `AuditEvent` | Policy evidence | Allow/deny rationale and resulting action evidence |

Agent steps are resumable and idempotent. Tool capabilities use allowlists and
tenant-scoped credentials. Read and proposal tools are distinct from mutation
tools. High-impact actions pause in `WAITING_APPROVAL`; the approving actor must
be different from the agent identity and must still be authorized when approval
is consumed.

Claude, OpenAI, and future providers map their message/tool formats into the
same run/step/execution model. Provider-specific details remain in bounded JSON
snapshots and adapter logs, not in domain foreign keys.

## 9. Tenant isolation and security

- Every tenant-owned AI/media row has mandatory `tenantId` and forced RLS.
- Source/subject polymorphic references are validated against tenant ownership
  before use and are never authorization evidence.
- Provider credentials are secret-manager references; configuration readers do
  not receive secret write access.
- Prompts and retrieved content are treated as untrusted input. Tool
  instructions cannot be elevated by model output.
- Stored prompt/output/log fields use content classification, redaction,
  maximum size, and purpose-specific retention.
- Moderation decisions, human approvals, and official-domain acceptance are
  audit events.
- AI logs, tokens, costs, generation/evaluation histories, and agent steps are
  time-partitionable append-only evidence.

## 10. Performance and retention

- Tenant-and-time B-tree indexes serve execution lists, budgets, and evidence.
- BRIN indexes support time-range scans over append-only partitions.
- Daily/monthly cost summaries are built from the ledger rather than mutating
  it.
- Prompt/input hashes enable safe deduplication without indexing large payloads.
- JSONB GIN indexes are added only for stable, measured query paths.
- Execution/log payload retention is purpose-specific; financial usage and
  audit evidence may outlive prompt text. Partition detach/export/drop is the
  controlled purge mechanism.

## 11. Acceptance boundaries

The following constraints are non-negotiable:

1. no provider SDK identifier becomes a domain primary key;
2. no generated media remains available only at a provider URL;
3. no mutable prompt/template is used to explain a historical execution;
4. no AI result directly changes an official score or access grant;
5. no cross-tenant cache key or provider credential sharing;
6. no agent mutation without policy evaluation, idempotency, and audit; and
7. no secrets or unrestricted PII in prompt logs.

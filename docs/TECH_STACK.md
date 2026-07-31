# Technology Stack

## Decision criteria

The stack prioritizes compatibility with the OneXL reference product, tenant
safety, portability, operational maturity, developer productivity, and type
safety. Versions are pinned to supported stable releases in the workspace
lockfile and container definitions.

## Recommended stack

| Capability | Selection | Why |
| --- | --- | --- |
| Frontend | React, React Router, Vite, TypeScript, Tailwind CSS, Radix UI, TanStack Query | This preserves the reference application's route and interaction model. TypeScript and generated contracts add safety, Radix supplies accessible behavior, and TanStack Query provides consistent caching and mutation state. |
| Backend | Express 5 with TypeScript, Zod, and OpenAPI | Express preserves the reference API's middleware and route lineage. Express 5 handles rejected async handlers natively; layered modules keep HTTP, application, domain, and infrastructure responsibilities separate. |
| Database | PostgreSQL 17 with Prisma ORM | PostgreSQL provides transactions, constraints, indexing, JSONB, partitioning, and row-level security. Prisma provides typed access and reviewable migrations while allowing audited SQL for RLS, partitions, and high-volume reporting. Any supported self-hosted or managed PostgreSQL service can be used. |
| Authentication | Zorfly sessions plus OIDC/SAML/SCIM adapter ports | Password, MFA, recovery, session rotation, and membership authorization use Zorfly-owned records. Enterprise federation can use WorkOS, Auth0, Keycloak, Microsoft Entra ID, Okta, or another standards-compliant adapter without changing domain logic. |
| Object storage | S3-compatible storage port; MinIO locally | A standard object-storage boundary supports MinIO and S3-compatible providers. Cloud-specific adapters remain optional. Private buckets, quarantine, scanning, immutable originals, and signed access are invariant. |
| Distributed caching | Redis-compatible service | Redis supports bounded caches, rate-limit counters, locks, ephemeral coordination, and BullMQ. PostgreSQL remains authoritative and security decisions never rely only on cached state. |
| Queue and events | BullMQ on Redis plus PostgreSQL transactional outbox | BullMQ preserves a simple Node operational model while adding repeatable jobs, retries, concurrency controls, and dead-letter handling. The outbox prevents committed writes from losing required work. |
| Email | SMTP transport port with optional provider adapters | SMTP works locally and across hosting providers. Optional SES, Postmark, Resend, SendGrid, or Mailgun adapters add delivery webhooks without becoming domain dependencies. |
| Notifications | Zorfly notification orchestration with channel adapters | Templates, preferences, inbox delivery, digests, and routing remain owned by Zorfly. Email, web push, mobile push, SMS, WhatsApp, or an optional Novu adapter consume notification intents asynchronously. |
| Unit and integration testing | Vitest, React Testing Library, Supertest, Testcontainers | Vitest is fast and TypeScript-friendly. Testing Library encourages user-visible UI assertions. Supertest covers HTTP contracts. Testcontainers verifies real PostgreSQL and service behavior rather than inaccurate mocks. |
| End-to-end testing | Playwright | Playwright provides cross-browser automation, tracing, isolated contexts, reliable waiting, and useful CI artifacts for critical user journeys. |
| Contract and performance testing | Pact, OpenAPI validation, and k6 | Pact protects consumer/provider compatibility, OpenAPI validation prevents contract drift, and k6 turns capacity and latency assumptions into repeatable tests. |
| CI/CD | GitHub Actions, Dependabot, CodeQL, SBOMs, signatures, and artifact attestations | GitHub-native checks provide portable build artifacts. Deployment workflows use environment-specific OIDC or tokens and never embed one cloud's SDK in application code. |
| Deployment | OCI images and Docker Compose reference topology | The same web, API, worker, and migration images run on a VM, Kubernetes, or container platforms including AWS, Azure, GCP, DigitalOcean, Hetzner, Railway, Render, Coolify, and EasyPanel. Provider templates are optional adapters. |
| Observability | OpenTelemetry with OTLP export, Prometheus metrics, and structured logs | Vendor-neutral telemetry can target Grafana, Jaeger, Tempo, Loki, Datadog, New Relic, Elastic, CloudWatch, or another backend by configuration. |
| Package and repository management | pnpm workspaces and Turborepo | pnpm is space-efficient and strict about dependency declarations. Turborepo provides cached, dependency-aware tasks for the web, API, worker, contracts, and shared packages without requiring separate repositories. |
| AI orchestration | Zorfly-owned provider-neutral control plane with OpenAI Responses/Image adapters and a Claude Messages adapter | A capability registry, policy router, prompt registry, evaluation gates, budgets, and durable agent state prevent provider details from leaking into domain code. OpenAI supports conversational/tool and image workflows; Claude provides a separately evaluated text/tool provider. No AI provider is an authorization boundary. |
| AI evaluation | Versioned offline datasets and deterministic graders in `tests/evals`, plus controlled human review | Model behavior changes without source changes. Release gates must compare quality, safety, schema validity, latency, and normalized cost before model, prompt, or tool changes are promoted. |
| SVG and media | Versioned internal scene graph, deterministic SVG serializer, sandboxed rasterizer, and S3 asset pipeline | SVG is active content and cannot be trusted directly. A constrained scene graph supports safe, portable rendering, while quarantine, validation, provenance, immutable originals, and derivative versions support user uploads and AI-generated raster assets. |
| Future mobile | React Native with Expo, selected only when mobile discovery begins | React Native shares TypeScript expertise, while Expo reduces native build and update operations. Only design tokens and platform-neutral contracts are shared; web components and browser assumptions are not forced onto native clients. The final selection requires an ADR and product requirements. |

## Runtime topology

- React static assets, the Express API, and the BullMQ worker are separate OCI
  images; migrations run as a one-shot image command.
- PostgreSQL, Redis-compatible infrastructure, S3-compatible object storage,
  and SMTP are the only required service contracts.
- The local reference topology uses Docker Compose, PostgreSQL, Redis, MinIO,
  and Mailpit.
- Production uses redundant services, private data networks, TLS, automated
  backups, point-in-time recovery, secret management, and an edge
  proxy/load-balancer supplied by the selected platform.
- Development, staging, and production have independent credentials, storage,
  queues, and databases.

## Important trade-offs

### Modular monolith versus microservices

The modular monolith is the default because the domain and scaling boundaries
are not yet proven. Modules must still enforce ownership and contracts. A module
may become a service only when independent scale, failure isolation, team
ownership, compliance, or release cadence justifies the operational cost.

### Managed versus self-hosted identity

Enterprise federation is security-sensitive, so production customers should
use a proven OIDC/SAML/SCIM provider. Zorfly isolates provider identifiers behind
an adapter and owns users, tenants, memberships, sessions, and authorization.
This permits a managed provider or Keycloak without changing product rules.

### Portable baseline versus cloud optimization

The baseline favors universally available service contracts. A cloud-specific
queue, secret store, CDN, or mail adapter may reduce operations at scale, but it
must remain outside domain code and satisfy the same idempotency, security,
telemetry, and recovery contracts.

### Prisma versus direct SQL

Prisma accelerates safe CRUD and typed queries, but complex reporting and
PostgreSQL-specific capabilities may need SQL. Direct SQL is allowed behind
repositories when parameterized, tested, observable, and reviewed. Migrations
remain explicit rather than generated at application startup.

### Owned notification orchestration versus a notification vendor

Owning notification intents, preferences, and template versions preserves
product behavior and portability. A Novu adapter is allowed, but domain modules
only emit versioned intents and never call a delivery provider directly.

### Provider-neutral AI versus a generic proxy

Zorfly owns routing, authorization, policy, evaluations, and durable run state.
Adapters preserve provider-specific capabilities instead of assuming prompts,
tools, continuation state, safety behavior, or output semantics are
interchangeable. A third-party AI gateway may later provide telemetry or key
management, but it cannot replace product policy or evaluation.

### Redis versus using PostgreSQL for every transient read

Redis reduces repeated reads and supports distributed counters, but introduces
invalidation and another failure mode. It is used only when measurements justify
it. Correctness falls back to PostgreSQL, and security-sensitive decisions fail
closed rather than trusting stale cache state.

## Version and dependency policy

- Pin Node.js to the 24 Active LTS line and review the line before it enters
  Maintenance LTS.
- Pin the package manager and lockfile.
- Use exact versions for production dependencies unless automated update policy
  explicitly permits ranges.
- Review major upgrades through ADRs when behavior or architecture changes.
- Apply security updates according to severity-based service levels.
- Track runtime, framework, database, and vendor support windows.
- Generate and retain a software bill of materials for release artifacts.

## Technologies intentionally deferred

- Kubernetes: unnecessary control-plane and operations cost at the initial scale.
- GraphQL: no demonstrated query-shape requirement yet.
- Multiple transactional databases: ownership boundaries are not proven.
- Kafka: BullMQ and the transactional outbox cover the initial durability and
  routing needs.
- Elasticsearch/OpenSearch: introduce only when PostgreSQL search is
  demonstrably insufficient.
- A data warehouse: select after analytics requirements and governance exist.
- A vector database: select only after a retrieval use case, authorization
  design, deletion semantics, and representative evaluation demonstrate need.
- An AI agent framework: durable orchestration and policy requirements come
  first; a library is selected only if it conforms to Zorfly contracts.

## Official references

- [React documentation](https://react.dev/)
- [React Router documentation](https://reactrouter.com/)
- [Vite guide](https://vite.dev/guide/)
- [Express 5 migration guide](https://expressjs.com/en/guide/migrating-5.html)
- [PostgreSQL documentation](https://www.postgresql.org/docs/current/)
- [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Prisma documentation](https://www.prisma.io/docs/)
- [BullMQ documentation](https://docs.bullmq.io/)
- [MinIO documentation](https://min.io/docs/)
- [Docker Compose](https://docs.docker.com/compose/)
- [Vitest guide](https://vitest.dev/guide/)
- [Playwright documentation](https://playwright.dev/docs/intro)
- [GitHub Actions security hardening](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)
- [OpenTelemetry documentation](https://opentelemetry.io/docs/)
- [OpenAI Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses)
- [OpenAI image generation](https://developers.openai.com/api/docs/guides/image-generation)
- [Claude tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/how-tool-use-works)
- [Claude Message Batches](https://platform.claude.com/docs/en/api/messages/batches)
- [Node.js release policy](https://nodejs.org/en/about/previous-releases)

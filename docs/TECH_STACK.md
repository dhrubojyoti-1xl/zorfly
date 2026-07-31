# Technology Stack

## Decision criteria

The initial stack prioritizes enterprise identity, tenant safety, operational
maturity, developer productivity, type safety, managed infrastructure, and a
clear path from one product team to multiple teams. Versions will be pinned to
supported stable releases during implementation.

## Recommended stack

| Capability | Selection | Why |
| --- | --- | --- |
| Frontend | Next.js App Router, React, TypeScript, Tailwind CSS, Radix UI, TanStack Query | Next.js supports server rendering, Server Components, streaming, route-level composition, and mature production optimizations. TypeScript gives shared contract safety. Tailwind provides constrained styling primitives, Radix supplies accessible unstyled behavior, and TanStack Query handles client-owned server state where server rendering is not appropriate. |
| Backend | NestJS with the Fastify adapter and TypeScript | NestJS provides explicit modules, dependency injection, validation, testing seams, OpenAPI integration, and conventions that remain manageable as teams grow. Fastify provides a low-overhead HTTP runtime. A modular monolith avoids premature distributed-system complexity. |
| Database | PostgreSQL on Amazon RDS Multi-AZ, with Prisma ORM | PostgreSQL offers transactions, constraints, mature indexing, JSON support, extensions, and row-level security for defense-in-depth tenant isolation. RDS reduces backup, failover, patching, and monitoring burden. Prisma provides typed access and reviewable migrations while allowing audited SQL when needed. |
| Authentication | WorkOS AuthKit | Enterprise SaaS needs organizations, SAML/OIDC SSO, MFA, directory synchronization through SCIM, domain verification, and role mapping. WorkOS provides these as one managed identity layer and avoids building security-critical identity workflows in-house. Zorfly remains responsible for application authorization. |
| Object storage | Amazon S3 with KMS encryption and CloudFront | S3 is durable, scalable, lifecycle-aware, and integrates with IAM, audit logging, malware-scanning workflows, and short-lived signed URLs. CloudFront provides efficient edge delivery without making buckets public. |
| Queue and events | Amazon SQS with dead-letter queues; EventBridge for event routing | SQS offers durable, managed, at-least-once delivery without operating brokers. EventBridge decouples publishers from multiple consumers and SaaS integrations. Consumers remain idempotent because duplicates and reordering are expected. |
| Email | Amazon SES | SES provides scalable transactional email, domain authentication, reputation controls, event feedback, and native AWS IAM integration at predictable cost. Templates remain owned and versioned by Zorfly. |
| Notifications | Novu, with SES as the email provider | Novu centralizes templates, preferences, routing, digests, and multi-channel delivery. Its open-source option limits lock-in. Notification orchestration stays separate from domain events and transport providers. |
| Unit and integration testing | Vitest, React Testing Library, Supertest, Testcontainers | Vitest is fast and TypeScript-friendly. Testing Library encourages user-visible UI assertions. Supertest covers HTTP contracts. Testcontainers verifies real PostgreSQL and service behavior rather than inaccurate mocks. |
| End-to-end testing | Playwright | Playwright provides cross-browser automation, tracing, isolated contexts, reliable waiting, and useful CI artifacts for critical user journeys. |
| Contract and performance testing | Pact, OpenAPI validation, and k6 | Pact protects consumer/provider compatibility, OpenAPI validation prevents contract drift, and k6 turns capacity and latency assumptions into repeatable tests. |
| CI/CD | GitHub Actions with OIDC, Dependabot, CodeQL, and artifact attestations | GitHub-native checks simplify governance. OIDC exchanges workflow identity for short-lived AWS credentials instead of storing long-lived cloud keys. Security and provenance checks can block promotion. |
| Deployment | Docker images in Amazon ECR; Amazon ECS on AWS Fargate; infrastructure as code with AWS CDK | Fargate runs containers without managing EC2 hosts or a Kubernetes control plane. ECS supports rolling or blue/green deployments and service autoscaling. CDK keeps infrastructure reviewable in TypeScript while producing CloudFormation state and change sets. |
| Observability | OpenTelemetry with Amazon CloudWatch initially | OpenTelemetry prevents instrumentation lock-in and correlates traces, metrics, and logs. CloudWatch provides a managed starting point close to the AWS runtime; a specialized backend can be adopted later without rewriting instrumentation. |
| Package and repository management | pnpm workspaces and Turborepo | pnpm is space-efficient and strict about dependency declarations. Turborepo provides cached, dependency-aware tasks for the web, API, worker, contracts, and shared packages without requiring separate repositories. |

## Runtime topology

- Next.js web, NestJS API, and NestJS worker are separate containers.
- ECS services run across multiple Availability Zones behind an Application Load
  Balancer.
- PostgreSQL uses private subnets, Multi-AZ deployment, automated backups, and
  point-in-time recovery.
- S3, SQS, EventBridge, SES, KMS, Secrets Manager, and CloudWatch are accessed
  through least-privilege task roles.
- CloudFront and AWS WAF protect public entry points.
- Development, staging, and production use separate AWS accounts.

## Important trade-offs

### Modular monolith versus microservices

The modular monolith is the default because the domain and scaling boundaries
are not yet proven. Modules must still enforce ownership and contracts. A module
may become a service only when independent scale, failure isolation, team
ownership, compliance, or release cadence justifies the operational cost.

### WorkOS versus self-hosted identity

WorkOS introduces vendor cost and dependency, but avoids implementing and
maintaining high-risk SSO, MFA, SCIM, and identity-linking workflows. Identity
provider IDs are isolated behind an adapter, and Zorfly stores its own users,
organizations, memberships, and authorization model to preserve portability.

### AWS managed services versus portability

SQS, EventBridge, SES, and Fargate reduce operational load but create AWS
coupling. Domain code depends on internal ports, not AWS SDK types. Events and
commands use provider-neutral schemas so adapters can be replaced.

### Prisma versus direct SQL

Prisma accelerates safe CRUD and typed queries, but complex reporting and
PostgreSQL-specific capabilities may need SQL. Direct SQL is allowed behind
repositories when parameterized, tested, observable, and reviewed. Migrations
remain explicit rather than generated at application startup.

### Novu versus direct provider calls

Novu adds another component but prevents notification preferences, templates,
digests, and channel rules from spreading through domain code. Domain modules
emit notification intents; the orchestration layer decides delivery.

## Version and dependency policy

- Pin Node.js to an active LTS line at implementation time.
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
- Kafka: SQS and EventBridge cover the initial durability and routing needs.
- Elasticsearch/OpenSearch: introduce only when PostgreSQL search is
  demonstrably insufficient.
- A data warehouse: select after analytics requirements and governance exist.

## Official references

- [Next.js App Router](https://nextjs.org/docs/app)
- [Next.js production checklist](https://nextjs.org/docs/app/guides/production-checklist)
- [NestJS documentation](https://docs.nestjs.com/)
- [Fastify documentation](https://fastify.dev/docs/latest/)
- [PostgreSQL documentation](https://www.postgresql.org/docs/current/)
- [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Prisma documentation](https://www.prisma.io/docs/)
- [WorkOS AuthKit](https://workos.com/docs/authkit/overview)
- [WorkOS roles and permissions](https://workos.com/docs/authkit/roles-and-permissions)
- [Amazon S3 documentation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html)
- [Amazon SQS documentation](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html)
- [Amazon EventBridge documentation](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-what-is.html)
- [Amazon SES documentation](https://docs.aws.amazon.com/ses/latest/dg/Welcome.html)
- [Novu documentation](https://docs.novu.co/)
- [Vitest guide](https://vitest.dev/guide/)
- [Playwright documentation](https://playwright.dev/docs/intro)
- [GitHub Actions OIDC for AWS](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws)
- [Amazon ECS on Fargate](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html)
- [OpenTelemetry documentation](https://opentelemetry.io/docs/)

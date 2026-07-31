# Zorfly

Zorfly is an enterprise SaaS platform being designed for secure, reliable, and
scalable multi-tenant operation.

> **Project status:** foundation and architecture planning. No application
> features have been implemented.

## Vision

Zorfly will provide a dependable platform for business-critical workflows while
meeting the expectations of enterprise customers: strong tenant isolation,
single sign-on, auditable operations, predictable performance, and safe
continuous delivery.

The product domain will be refined through discovery. The technical foundation
therefore favors clear module boundaries and evolutionary architecture over
premature microservices.

## Engineering principles

- Security and privacy by design
- Explicit tenant context at every boundary
- Strong contracts and type safety
- Observable behavior in every environment
- Automated, reversible delivery
- Managed infrastructure where it reduces operational risk
- Architecture decisions recorded before they become accidental constraints
- Simple designs that can evolve as evidence changes

## Proposed architecture

Zorfly will begin as a modular monolith with independently deployable frontend,
API, and worker processes:

- **Web:** Next.js and React with TypeScript
- **API:** NestJS on Fastify with TypeScript
- **Data:** PostgreSQL with Prisma
- **Identity:** WorkOS AuthKit for enterprise authentication, SSO, SCIM, and RBAC
- **Object storage:** Amazon S3
- **Distributed cache:** Amazon ElastiCache Serverless for Valkey
- **Asynchronous work:** Amazon SQS and EventBridge
- **Email:** Amazon SES
- **Notifications:** Novu as the notification orchestration layer
- **AI integration:** provider-neutral orchestration with governed OpenAI and
  Claude adapters
- **Runtime:** Containers on Amazon ECS with AWS Fargate
- **Delivery:** GitHub Actions using OpenID Connect to AWS

See [Technology Stack](docs/TECH_STACK.md) for the complete recommendation and
trade-offs.

## Repository layout

```text
.
├── backend/        # API and asynchronous worker deployables
├── database/       # Schema, migrations, policies, seeds, and tooling
├── docker/         # Development and production container definitions
├── docs/           # Architecture, decisions, threat models, and runbooks
├── frontend/       # Independent web and future mobile clients
├── infrastructure/ # AWS CDK, environment topology, and policy-as-code
├── packages/       # Platform-neutral contracts and shared capabilities
├── scripts/        # CI, development, and operations automation
└── tests/          # Contract, E2E, security, resilience, performance, and AI evals
```

The directories are intentionally empty until their implementation phases begin.
See [Project Structure](docs/PROJECT_STRUCTURE.md) for ownership and dependency
rules.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Principal Architecture Review](docs/ARCHITECTURE_REVIEW.md)
- [Authorization Architecture](docs/AUTHORIZATION_ARCHITECTURE.md)
- [Security Architecture](docs/SECURITY_ARCHITECTURE.md)
- [AI and Agent Architecture](docs/AI_AND_AGENT_ARCHITECTURE.md)
- [Data and API Architecture](docs/DATA_AND_API_ARCHITECTURE.md)
- [Media and SVG Architecture](docs/MEDIA_AND_SVG_ARCHITECTURE.md)
- [Operations and Disaster Recovery](docs/OPERATIONS_AND_RESILIENCE.md)
- [Technology Stack](docs/TECH_STACK.md)
- [Coding Standards](docs/CODING_STANDARDS.md)
- [Project Structure](docs/PROJECT_STRUCTURE.md)
- [Implementation Plan](docs/IMPLEMENTATION_PLAN.md)
- [Contributing](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)

## Getting started

At this stage, no runtime dependencies or application commands exist. To review
the foundation:

1. Clone the repository.
2. Read the architecture and technology decisions in `docs/`.
3. Open a proposal or pull request for decisions that need refinement.

Application bootstrapping begins only after the foundation pull request is
approved.

## Governance

- Changes are made through pull requests.
- Architecture-impacting changes require an Architecture Decision Record (ADR).
- Secrets must never be committed.
- Production changes must be reviewed, tested, observable, and reversible.

## License

No license has been selected. All rights are reserved until the project owner
adds an explicit license.

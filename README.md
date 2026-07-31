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
- **Asynchronous work:** Amazon SQS and EventBridge
- **Email:** Amazon SES
- **Notifications:** Novu as the notification orchestration layer
- **Runtime:** Containers on Amazon ECS with AWS Fargate
- **Delivery:** GitHub Actions using OpenID Connect to AWS

See [Technology Stack](docs/TECH_STACK.md) for the complete recommendation and
trade-offs.

## Repository layout

```text
.
├── backend/     # API and asynchronous worker services
├── database/    # Schema, migrations, seeds, and database tooling
├── docker/      # Local and production container definitions
├── docs/        # Architecture and engineering documentation
├── frontend/    # Web application
├── scripts/     # Repository automation
└── tests/       # Cross-service integration, contract, and end-to-end tests
```

The directories are intentionally empty until their implementation phases begin.
See [Project Structure](docs/PROJECT_STRUCTURE.md) for ownership and dependency
rules.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
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

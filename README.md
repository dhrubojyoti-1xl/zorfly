# Zorfly

Zorfly is a secure, cloud-agnostic enterprise SaaS for workforce quality
assessment, learning, recruitment, recognition, analytics, and governed AI.

> **Project status:** the production data model and portable runtime foundation
> are implemented. The official OneXL React product is integrated as the web
> baseline; backend capabilities are being migrated from Mongoose to
> Prisma/PostgreSQL module by module.

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
- Portable service contracts with managed options where they reduce risk
- Architecture decisions recorded before they become accidental constraints
- Simple designs that can evolve as evidence changes

## Architecture

Zorfly will begin as a modular monolith with independently deployable frontend,
API, and worker processes:

- **Web:** React, React Router, Vite, and TypeScript
- **API:** Express 5 with TypeScript, Zod, and OpenAPI
- **Data:** PostgreSQL with Prisma
- **Identity:** Zorfly sessions with provider-neutral OIDC, SAML, and SCIM adapters
- **Object storage:** S3-compatible adapter with MinIO for local development
- **Distributed cache:** Redis-compatible service
- **Asynchronous work:** BullMQ with a PostgreSQL transactional outbox
- **Email:** SMTP baseline with optional provider adapters
- **Notifications:** Zorfly-owned orchestration with channel adapters
- **AI integration:** provider-neutral orchestration with governed OpenAI and
  Claude adapters
- **Runtime:** Cloud-agnostic OCI containers and Docker Compose
- **Delivery:** GitHub Actions with portable signed build artifacts

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
├── infrastructure/ # Optional provider templates and policy-as-code
├── packages/       # Platform-neutral contracts and shared capabilities
├── scripts/        # CI, development, and operations automation
└── tests/          # Contract, E2E, security, resilience, performance, and AI evals
```

See [Project Structure](docs/PROJECT_STRUCTURE.md) for ownership and dependency
rules and [OneXL Reference Compatibility](docs/REFERENCE_COMPATIBILITY.md) for
the migration contract.

## Documentation

- [Software Requirements Specification](docs/SRS.md)
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
- [OneXL Reference Compatibility](docs/REFERENCE_COMPATIBILITY.md)
- [Production Data Model](database/DATA_MODEL.md)
- [Database ERD](database/ERD.md)
- [AI Database Schema](database/AI_SCHEMA.md)
- [Database Migration Strategy](database/MIGRATION_STRATEGY.md)
- [Database Seed Plan](database/SEED_PLAN.md)
- [Contributing](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)

## Getting started

Requirements:

- Node.js 24 Active LTS;
- pnpm 11.18 through Corepack;
- Docker Compose for the local PostgreSQL, Redis, MinIO, and Mailpit services.

From a clean clone:

```bash
corepack enable
corepack prepare pnpm@11.18.0 --activate
pnpm install --frozen-lockfile
cp .env.example .env
pnpm services:up
pnpm db:generate
pnpm dev
```

The web application runs at `http://localhost:5173`, the API at
`http://localhost:5000/api/v1`, the MinIO console at `http://localhost:9001`,
and the Mailpit inbox at `http://localhost:8025`.

Run `pnpm validate` before every commit. It checks formatting, documentation,
the Prisma schema, lint, types, tests, and production builds.

## Governance

- Changes are made through pull requests.
- Architecture-impacting changes require an Architecture Decision Record (ADR).
- Secrets must never be committed.
- Production changes must be reviewed, tested, observable, and reversible.

## License

No license has been selected. All rights are reserved until the project owner
adds an explicit license.

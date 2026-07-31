# ADR 0002: Reference-Compatible Cloud-Agnostic Runtime

- Status: Accepted
- Date: 2026-07-31

## Context

The initial architecture foundation proposed Next.js, NestJS, WorkOS, and an
AWS-specific runtime. The supplied OneXL reference product instead establishes
React Router/Vite and Express behavior, while the master implementation
directive requires compatible architecture, self-hostable local development,
provider abstraction, and deployment without a mandatory cloud.

The approved Prisma/PostgreSQL database architecture remains unchanged.

## Decision

Zorfly will use:

- React, React Router, Vite, and TypeScript for the web application;
- Express 5 and TypeScript for the REST API;
- a separate TypeScript worker using BullMQ;
- PostgreSQL with Prisma and tenant row-level security;
- Redis-compatible infrastructure for queues, coordination, cache, and
  distributed rate limits;
- S3-compatible object storage with MinIO as the local reference;
- SMTP as the baseline email transport;
- OCI containers and Docker Compose as the portable deployment contract;
- provider-neutral ports for identity federation, payments, storage, mail,
  notifications, observability, and AI.

Node.js 24 Active LTS is the initial runtime line. Package and container
versions are pinned in implementation artifacts.

## Consequences

- Existing OneXL routes and interaction patterns can be migrated incrementally.
- TypeScript and explicit application/domain boundaries strengthen the
  reference implementation without rewriting its product.
- Cloud deployments supply managed PostgreSQL, Redis-compatible services,
  object storage, SMTP/email, and container execution by configuration.
- SSR is not an initial dependency. Public marketing or SEO surfaces may use a
  separate rendering strategy later without coupling authenticated product
  workflows to it.
- Enterprise SSO remains an adapter capability rather than a mandatory WorkOS
  dependency.
- AWS CDK is removed from the canonical topology. Provider-specific examples
  may be added later as optional, isolated templates.

## Superseded decisions

The framework, identity-vendor, queue, storage, email, and deployment selections
in the original foundation documents are superseded where they conflict with
this ADR. Security, tenancy, audit, recovery, AI governance, and database
principles remain in force.

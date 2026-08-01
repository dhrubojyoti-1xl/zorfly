# Zorfly Architecture Documentation

## Reading order

1. [Software Requirements Specification](SRS.md)
2. [Principal Architecture Review](ARCHITECTURE_REVIEW.md)
3. [OneXL Reference Compatibility](REFERENCE_COMPATIBILITY.md)
4. [Core Architecture](ARCHITECTURE.md)
5. [Technology Stack](TECH_STACK.md)
6. [Project Structure](PROJECT_STRUCTURE.md)
7. [Security Architecture](SECURITY_ARCHITECTURE.md)
8. [Authorization Architecture](AUTHORIZATION_ARCHITECTURE.md)
9. [Data and API Architecture](DATA_AND_API_ARCHITECTURE.md)
10. [Database Data Model](../database/DATA_MODEL.md)
11. [Database ERD](../database/ERD.md)
12. [AI Database Schema](../database/AI_SCHEMA.md)
13. [Database Migration Strategy](../database/MIGRATION_STRATEGY.md)
14. [Database Seed Plan](../database/SEED_PLAN.md)
15. [AI and Agent Architecture](AI_AND_AGENT_ARCHITECTURE.md)
16. [Media and SVG Architecture](MEDIA_AND_SVG_ARCHITECTURE.md)
17. [Operations and Resilience](OPERATIONS_AND_RESILIENCE.md)
18. [Deployment Runbook](DEPLOYMENT_RUNBOOK.md)
19. [Coding Standards](CODING_STANDARDS.md)
20. [Implementation Plan](IMPLEMENTATION_PLAN.md)

## Controlled documentation

| Area | Source of truth | Review trigger |
| --- | --- | --- |
| System context and boundaries | `ARCHITECTURE.md` | New deployable, data store, trust boundary, or tenant model |
| Review status and gates | `ARCHITECTURE_REVIEW.md` | Phase completion, major incident, or semiannual review |
| Technology decisions | `TECH_STACK.md` and ADRs | New vendor, runtime, framework, or major upgrade |
| Authorization | `AUTHORIZATION_ARCHITECTURE.md` | New permission scope, admin path, support access, or agent tool |
| Security | `SECURITY_ARCHITECTURE.md` and threat models | New data class, trust boundary, attack surface, or compliance scope |
| Data, API, cache, and queue | `DATA_AND_API_ARCHITECTURE.md` | New public contract, store, shard, cache class, or event |
| Domain and physical data model | `database/schema.prisma` and `database/*.md` | New entity, relationship, retention rule, partition, index, or seed |
| AI and agents | `AI_AND_AGENT_ARCHITECTURE.md` | New provider, model, prompt class, tool, memory, or autonomous action |
| Media and SVG | `MEDIA_AND_SVG_ARCHITECTURE.md` | New file format, transformation, model, renderer, or delivery mode |
| Reliability and DR | `OPERATIONS_AND_RESILIENCE.md` | New SLO, region, critical dependency, or recovery tier |
| Delivery sequence | `IMPLEMENTATION_PLAN.md` | Phase exit or material priority change |

## Supporting records

- `adr/`: durable architecture decisions and consequences;
- `threat-models/`: assets, trust boundaries, abuse cases, and mitigations;
- `runbooks/`: owned operational diagnostics, containment, and recovery.
- `sops/`: business quality criteria used to define assessment taxonomies and
  review rules.

Documentation is reviewed with the system it describes. A diagram or policy that
cannot be validated through tests, telemetry, deployment controls, or exercise
evidence is an intention, not an implemented guarantee.

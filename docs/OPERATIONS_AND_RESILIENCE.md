# Operations, Deployment, and Disaster Recovery

## Reliability model

Multi-Availability-Zone design protects against localized infrastructure failure.
It is not disaster recovery. Disaster recovery addresses regional loss,
destructive change, data corruption, credential compromise, and critical
provider failure.

## Service tiers

The following are planning targets, not customer commitments. Product,
engineering, security, finance, and legal owners must approve them before launch.

| Tier | Examples | Availability objective | RTO | RPO |
| --- | --- | --- | --- | --- |
| 0 — Critical control path | Identity callback, tenant resolution, authorization, core API, transactional database | 99.9% initial target | 1 hour | 5 minutes |
| 1 — Important asynchronous | Worker, queue processing, uploads, generated assets, notifications, AI orchestration | 99.5% initial target | 4 hours | 15 minutes |
| 2 — Deferred or rebuildable | Search indexes, derived caches, analytics, noncritical batch work | Best effort with owned target | 24 hours | 24 hours or rebuild from source |

Individual capabilities may require stricter targets through an ADR. Dependencies
cannot have weaker recovery characteristics than the capability they support
unless a tested degradation mode exists.

## Logging

Application logs are structured JSON emitted through a shared interface.

Required fields:

- timestamp, severity, service, environment, region, release, and instance;
- event name and schema version;
- trace, span, request, correlation, and causation identifiers;
- privacy-safe tenant, actor, operation, agent-run, and job identifiers when
  applicable;
- outcome, duration, stable error code, retryability, and dependency;
- provider request identifier for support correlation.

Rules:

- log events, not prose fragments;
- redact by allowlist before serialization;
- never log tokens, secrets, credentials, raw prompts, tool results, file
  contents, or sensitive request bodies by default;
- prevent newline and control-character injection;
- separate immutable security/audit events from diagnostic logs;
- encrypt, access-control, retain, and delete by data class;
- sample successful high-volume diagnostics, never required audit events;
- record access to production logs.

## Monitoring and telemetry

OpenTelemetry is the instrumentation boundary. CloudWatch is the initial managed
backend.

### Platform signals

- traffic, errors, latency, saturation, and availability;
- ECS task health, deployment state, CPU, memory, restarts, and throttling;
- database connections, replication lag, locks, storage, transactions, and slow
  queries;
- queue age, depth, throughput, retries, in-flight messages, and dead letters;
- cache hit ratio, memory, latency, evictions, connection use, and failures;
- CDN origin errors, cache behavior, WAF blocks, and signed-URL failures;
- identity success, denial, provisioning lag, and suspicious access;
- tenant tier consumption and noisy-neighbor indicators.

### AI signals

- queue wait and end-to-end run latency;
- provider/model/prompt versions and rollout;
- token, image, cached-token, tool, and normalized cost usage;
- budget, rate-limit, safety, policy, and approval outcomes;
- schema-valid response rate, evaluation score, tool success, and fallback rate;
- provider health, overload, timeout, and circuit-breaker state.

High-cardinality identifiers belong in traces and logs, not metric labels.

### Alert policy

An alert must:

- represent customer impact, imminent SLO breach, data risk, or exhausted
  capacity;
- identify an owner and severity;
- link to a tested runbook;
- avoid duplicate symptoms from the same failure;
- include safe diagnostic context;
- be tested and reviewed for actionability.

Use multi-window burn-rate alerts for SLOs. Dashboards alone do not constitute
monitoring.

## Deployment architecture

### Environments

- Separate AWS accounts for development, staging, production, security/log
  archive, and shared services as scale requires.
- Production changes flow only through reviewed automation.
- Humans use federated, time-bounded roles; no shared users or long-lived keys.
- GitHub Actions obtains short-lived AWS credentials through OIDC.

### Artifact flow

1. Validate formatting, types, boundaries, contracts, migrations, tests, and
   policies.
2. Scan source, dependencies, secrets, licenses, infrastructure, and containers.
3. Build once in a controlled environment.
4. Generate SBOM, provenance, vulnerability report, and signature.
5. Store immutable images in ECR and promote the same digest.
6. Produce an infrastructure change set and migration plan.
7. Deploy to staging, run integration, security, resilience, and smoke tests.
8. Progressively deploy to production with health and SLO gates.
9. Automatically halt or roll back on defined failure signals.

### Runtime rollout

- ECS services use rolling or blue/green deployment with minimum healthy
  capacity across Availability Zones.
- Database migrations run as one-shot jobs before code that requires the new
  schema, using expand-and-contract compatibility.
- Workers drain gracefully and stop accepting new leases before shutdown.
- Queue contract changes support old and new consumers during rollout.
- Feature flags separate deployment from tenant enablement.
- AI model/prompt changes use shadow or canary evaluation and independent kill
  switches.
- Rollback restores the previous artifact; it does not assume a destructive
  database migration can be reversed.

## Backup and recovery

### PostgreSQL

- Multi-AZ primary with automated backups and point-in-time recovery.
- Encrypted snapshots copied cross-account and cross-region according to policy.
- Cross-region read replica or managed equivalent when Tier 0 RTO requires warm
  data-plane recovery.
- Backup vault controls prevent routine administrators from deleting recovery
  copies.
- Restore tests validate data integrity, RLS, application compatibility, and
  measured RTO/RPO.

### S3

- Versioning, KMS encryption, lifecycle policy, and protected deletion for
  critical assets.
- Cross-region replication for assets whose tier requires it.
- Metadata and object recovery are tested together.
- Quarantine and disposable derivatives use separate retention from approved
  originals.

### Queues and events

SQS queue state is not the source of truth and is not assumed to replicate
cross-region.

- Recreate infrastructure from CDK.
- Rebuild unpublished work from the transactional outbox.
- Persist durable job and agent-run state in PostgreSQL.
- Archive/replay eligible events according to retention and privacy policy.
- Use idempotency to tolerate re-publication.

### Configuration and secrets

- Infrastructure, policies, and non-secret configuration are versioned.
- Secrets are replicated or independently provisioned in the recovery region.
- Recovery never copies production secrets into lower environments.
- Key and certificate dependencies are inventoried with rotation and recovery
  owners.

## Regional recovery topology

The initial recommendation is single-region, Multi-AZ production with a
pre-provisioned or rapidly provisionable warm-standby region.

Recovery-region readiness includes:

- network, security, observability, ECR, ECS, and edge infrastructure;
- replicated or restorable PostgreSQL and S3 state;
- regional secrets and KMS strategy;
- provider callback and webhook endpoints;
- DNS health checks and low-enough TTLs;
- capacity quotas verified in advance;
- deployment of the same signed artifacts and configuration versions.

Active-active multi-region is deferred until data consistency, residency,
traffic, and availability requirements justify its cost and complexity.

## Recovery procedure

1. Incident commander declares the recovery scenario and freezes unsafe changes.
2. Determine whether the failure is infrastructure, corruption, compromise, or
   provider-specific.
3. Select a known-good recovery point and record expected data loss.
4. Restore/promote PostgreSQL and validate integrity and tenant policies.
5. Restore or verify asset metadata and S3 availability.
6. deploy the exact approved application and infrastructure artifacts.
7. rotate or activate regional secrets and validate workload identities.
8. enable API in restricted mode; then workers and external side effects.
9. replay outbox and durable jobs with idempotency controls.
10. validate synthetic tenant journeys, audit logging, and telemetry.
11. shift traffic gradually and communicate measured RPO/RTO.
12. preserve evidence and plan failback as a separate reviewed change.

Dependency order is identity and policy, database, API reads, API writes,
storage, queues/workers, notifications, AI providers, then noncritical derived
systems.

## External provider resilience

- WorkOS outage: preserve valid sessions only within approved token policy; block
  new login or provisioning safely; never bypass authentication.
- OpenAI or Claude outage: circuit-break provider, queue eligible asynchronous
  work, use an approved fallback only when policy/evaluations allow, or degrade
  the AI capability explicitly.
- SES/Novu outage: retain notification intent, retry safely, surface delay, and
  preserve critical alternate channels where required.
- Regional vendor limitation: route only if tenant data policy permits the
  alternate region/provider.

Provider outages must not corrupt core transactional state.

## Exercises and evidence

- Quarterly restore of PostgreSQL and critical S3 metadata/assets.
- Semiannual regional recovery exercise before scale requires more frequent
  testing.
- Annual credential-compromise and destructive-change scenario.
- Routine queue replay, dead-letter, provider outage, and rollback game days.
- Record actual RTO, actual RPO, gaps, owners, and remediation dates.
- Backups are not considered valid until restore evidence exists.

## Official references

- [AWS Well-Architected SaaS Lens](https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/saas-lens.html)
- [AWS SaaS isolation mindset](https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/isolation-mindset.html)
- [Amazon RDS cross-region read replicas](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ReadRepl.XRgn.html)
- [GitHub Actions OIDC for AWS](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws)

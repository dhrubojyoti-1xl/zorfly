# Coding Standards

## Purpose

These standards optimize for correctness, maintainability, security, and
consistent review. Tooling should enforce mechanical rules so reviews can focus
on behavior and design.

## Language

- TypeScript is the default application language.
- Enable the strictest practical compiler options, including strict null checks.
- Avoid `any`; use `unknown` with explicit narrowing at trust boundaries.
- Prefer immutable data and readonly interfaces.
- Represent domain concepts with specific types rather than primitive strings.
- Validate all external data at runtime; compile-time types are not validation.
- Keep public types and contracts explicit.

## Formatting and static analysis

- Prettier owns formatting.
- ESLint owns correctness and maintainability rules.
- Imports are deterministic and free of cycles.
- Warnings fail CI; suppressions require a reason beside the suppression.
- Generated files are clearly marked and not manually edited.

## Naming

- Files and directories: `kebab-case`.
- Types, classes, React components, and enums: `PascalCase`.
- Variables, functions, methods, and object properties: `camelCase`.
- Environment variables and true constants: `UPPER_SNAKE_CASE`.
- Database tables and columns: `snake_case`.
- Booleans begin with `is`, `has`, `can`, or `should`.
- Events use completed business facts, such as `invoice.sent`.
- Avoid abbreviations unless they are unambiguous domain language.

## Design

- Keep business rules independent from frameworks and transport concerns.
- Depend on module contracts, not another module's implementation.
- Prefer composition and small explicit functions over inheritance.
- Use dependency injection at process and module boundaries.
- Keep side effects at the edges and make them visible in interfaces.
- Do not add abstractions until at least two concrete uses demonstrate the
  common behavior.
- Record significant or hard-to-reverse decisions in ADRs.

## Frontend

- Server Components are the default; use Client Components only for browser
  state or interactivity.
- Meet WCAG 2.2 AA and support keyboard operation from the start.
- Use semantic HTML before custom ARIA.
- Keep server state, URL state, form state, and local UI state distinct.
- Never expose server secrets or authorization decisions to the browser.
- Treat frontend permission checks as usability only; the API always authorizes.
- Define loading, empty, error, and permission-denied states for every screen.
- Track performance against explicit Core Web Vitals budgets.

## Backend

- Controllers adapt transport; application services coordinate use cases;
  domain modules own rules; repositories isolate persistence.
- Controllers never contain business logic.
- Every request receives validated actor and tenant context.
- Authorization occurs before data access and again at sensitive domain
  boundaries.
- External calls have explicit timeouts and bounded retry policies.
- Mutations that may be retried use idempotency keys.
- Do not swallow exceptions or return internal errors to clients.
- Use structured errors and RFC 9457 responses.

## API contracts

- OpenAPI is required for public HTTP endpoints.
- Use ISO 8601 UTC timestamps and stable string identifiers.
- Use opaque cursor pagination, not unbounded lists.
- Add fields compatibly; do not repurpose existing fields.
- Deprecations require documentation, telemetry, and a removal window.
- Consumer-driven contract tests protect critical integrations.

## Database

- All schema changes use reviewed migrations.
- Migrations are forward-only, deterministic, and safe to run once.
- Production migrations avoid long blocking transactions.
- Use expand-and-contract for breaking schema changes.
- Tenant-owned tables include tenant constraints and supporting indexes.
- Foreign keys and uniqueness constraints protect invariants where practical.
- Avoid sensitive values in primary keys, URLs, and logs.
- Query plans are reviewed for high-volume or latency-critical paths.
- Application startup never performs migrations.

## Security and privacy

- Never log credentials, tokens, secrets, full request bodies, or sensitive
  personal data.
- Parameterize all queries.
- Encode output for its destination context.
- Use allowlists for redirect URLs, uploads, and integrations.
- Authorize every object access; possession of an identifier is not permission.
- Use constant-time comparisons for secret material where relevant.
- Add threat-model notes to security-sensitive pull requests.
- Dependencies require maintenance, license, and vulnerability review.

## Testing

Use the smallest test that proves the behavior:

- unit tests for domain rules and pure logic;
- component tests for isolated UI behavior;
- integration tests for databases, queues, and service adapters;
- contract tests for module and external API compatibility;
- end-to-end tests for a small set of critical journeys;
- security tests for tenant isolation and authorization denial.

Tests must be deterministic, isolated, readable, and safe to run in parallel.
Avoid sleeps, shared mutable fixtures, and implementation-detail assertions.
Coverage supports risk analysis but is not a quality target by itself.

## Observability

- Use structured logs through the shared logging interface.
- Propagate trace, request, correlation, causation, actor, and safe tenant IDs.
- Do not use high-cardinality or sensitive values as metric labels.
- Record actionable context once, at the boundary that handles the error.
- Instrument new external dependencies and critical paths before release.

## Git and review

- Follow Conventional Commits.
- Keep commits coherent and buildable.
- Prefer small pull requests with one outcome.
- Require code-owner review for security, data, infrastructure, and public
  contracts.
- Resolve all review conversations before merge.
- Merge only when checks pass and rollback is understood.

## Documentation

- Explain why, constraints, and trade-offs; code already shows what.
- Keep public contracts and operational runbooks current.
- Add ADRs for durable decisions.
- Use inclusive, precise language and define domain terms.

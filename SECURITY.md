# Security Policy

## Reporting a vulnerability

Do not disclose suspected vulnerabilities in public issues, discussions, or pull
requests.

Until a dedicated security contact and private reporting workflow are
configured, contact the repository owner privately through GitHub. Include:

- the affected component and version or commit;
- reproduction steps or a proof of concept;
- the potential impact;
- any suggested mitigation;
- whether the issue has been shared elsewhere.

The project owner should acknowledge a report within two business days, provide
an initial assessment within five business days, and coordinate disclosure after
a fix is available.

## Security baseline

- No secrets or production data in source control.
- Least-privilege access with short-lived credentials.
- Mandatory review for authentication, authorization, cryptography, tenant
  boundaries, and data migrations.
- Dependency, secret, static-analysis, container, and infrastructure scanning in
  CI before production implementation begins.
- Encryption in transit and at rest.
- Auditable privileged and customer-data access.
- Defined vulnerability triage and patch service levels before launch.

This policy will be expanded with supported-version and disclosure details
before the first public release.

The system security design and implementation gates are defined in
[Security Architecture](docs/SECURITY_ARCHITECTURE.md).

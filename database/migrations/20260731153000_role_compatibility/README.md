# Role Compatibility Fields

Adds tenant-role rank and built-in permission-customization state required by
the OneXL Roles & Permissions API.

- Change class: compatible and additive.
- Lock: brief metadata lock on `core.TenantRole`.
- Backfill: PostgreSQL applies safe defaults to existing rows.
- Roll-forward: retain both fields; a corrective migration may adjust values.

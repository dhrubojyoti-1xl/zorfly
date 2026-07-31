# Team leader test authoring

Grants the existing `tests:manage` permission to active built-in Team Leader
roles so PostgreSQL-backed authorization preserves the OneXL authoring role.
The insert is idempotent and does not alter custom roles.

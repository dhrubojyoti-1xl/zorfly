INSERT INTO "core"."TenantRolePermission" (
  "tenantId",
  "roleId",
  "permissionId"
)
SELECT
  role."tenantId",
  role."id",
  permission."id"
FROM "core"."TenantRole" AS role
CROSS JOIN "platform"."Permission" AS permission
WHERE role."key" = 'team_leader'
  AND role."status" = 'ACTIVE'
  AND role."deletedAt" IS NULL
  AND permission."key" = 'tests:manage'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

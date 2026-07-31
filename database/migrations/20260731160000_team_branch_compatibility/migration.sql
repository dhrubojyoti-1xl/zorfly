ALTER TABLE "core"."Team"
ADD COLUMN "branchId" UUID;

CREATE INDEX "Team_tenantId_branchId_status_deletedAt_idx"
ON "core"."Team"("tenantId", "branchId", "status", "deletedAt");

ALTER TABLE "core"."Team"
ADD CONSTRAINT "Team_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "core"."Branch"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

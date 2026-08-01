ALTER TABLE "engagement"."BadgeAward"
  ADD CONSTRAINT "BadgeAward_tenantId_badgeId_membershipId_key"
  UNIQUE ("tenantId", "badgeId", "membershipId");

ALTER TABLE "learning"."Certificate"
  ADD COLUMN "assessmentId" UUID;

ALTER TABLE "learning"."Certificate"
  ADD CONSTRAINT "Certificate_assessmentId_fkey"
  FOREIGN KEY ("assessmentId") REFERENCES "assessment"."AssessmentDefinition"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "learning"."Certificate"
  ADD CONSTRAINT "Certificate_tenantId_membershipId_assessmentId_key"
  UNIQUE ("tenantId", "membershipId", "assessmentId");

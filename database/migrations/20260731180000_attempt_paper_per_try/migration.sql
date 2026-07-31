DROP INDEX "assessment"."AssessmentPaper_assignmentId_key";

CREATE INDEX "AssessmentPaper_tenantId_assignmentId_generatedAt_idx"
ON "assessment"."AssessmentPaper"("tenantId", "assignmentId", "generatedAt");

ALTER TABLE "assessment"."AssessmentAttempt"
ADD COLUMN "resultSummary" JSONB;

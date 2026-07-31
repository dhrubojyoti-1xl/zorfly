ALTER TABLE "assessment"."AssignmentCampaign"
ALTER COLUMN "dueAt" DROP NOT NULL;

ALTER TABLE "assessment"."AssessmentAssignment"
ALTER COLUMN "dueAt" DROP NOT NULL;

-- Study Library content (a LearningMaterial subset) needs to be filterable
-- and displayable by target-audience difficulty, matching the OneXL
-- reference's Study Library UI. Nullable so plain learning materials
-- (articles/videos/links) that have no difficulty concept are unaffected.
ALTER TABLE "learning"."LearningMaterial"
  ADD COLUMN "difficultyLevelId" UUID;

ALTER TABLE "learning"."LearningMaterial"
  ADD CONSTRAINT "LearningMaterial_difficultyLevelId_fkey"
  FOREIGN KEY ("difficultyLevelId") REFERENCES "content"."DifficultyLevel"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "LearningMaterial_tenantId_difficultyLevelId_idx"
  ON "learning"."LearningMaterial"("tenantId", "difficultyLevelId");

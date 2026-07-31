-- Add an opaque public identifier and a deterministic per-execution ordinal to
-- QuestionGenerationHistory, so API boundaries never expose the internal
-- bigint id and generation-history recording can be safely upserted/repaired.

-- AlterTable: publicId (backfilled per-row by the volatile default; safe for
-- this table's expected row volume)
ALTER TABLE "ai"."QuestionGenerationHistory"
  ADD COLUMN "publicId" UUID NOT NULL DEFAULT gen_random_uuid();

-- AlterTable: draftIndex, added nullable first so existing rows can be
-- backfilled deterministically before the NOT NULL + unique constraint.
ALTER TABLE "ai"."QuestionGenerationHistory"
  ADD COLUMN "draftIndex" INTEGER;

-- Backfill: assign a stable 0-based ordinal per executionId, ordered by
-- insertion order (id), matching the order drafts were originally recorded in.
WITH ordered AS (
  SELECT "id", (ROW_NUMBER() OVER (PARTITION BY "executionId" ORDER BY "id") - 1) AS ordinal
  FROM "ai"."QuestionGenerationHistory"
)
UPDATE "ai"."QuestionGenerationHistory" AS history
SET "draftIndex" = ordered.ordinal
FROM ordered
WHERE ordered."id" = history."id";

ALTER TABLE "ai"."QuestionGenerationHistory"
  ALTER COLUMN "draftIndex" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "QuestionGenerationHistory_publicId_key" ON "ai"."QuestionGenerationHistory"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionGenerationHistory_executionId_draftIndex_key" ON "ai"."QuestionGenerationHistory"("executionId", "draftIndex");

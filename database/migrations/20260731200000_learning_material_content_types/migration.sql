-- Extend LearningContentType with the AI/manual study-library content types
-- (study guides, summaries, flashcards, self-check practice quizzes). These
-- are persisted as ordinary LearningMaterial/LearningMaterialVersion rows —
-- LearningMaterialVersion.body already holds arbitrary structured JSON, so no
-- new tables are required.
ALTER TYPE "learning"."LearningContentType" ADD VALUE 'STUDY_GUIDE';
ALTER TYPE "learning"."LearningContentType" ADD VALUE 'SUMMARY';
ALTER TYPE "learning"."LearningContentType" ADD VALUE 'FLASHCARDS';
ALTER TYPE "learning"."LearningContentType" ADD VALUE 'PRACTICE_QUIZ';

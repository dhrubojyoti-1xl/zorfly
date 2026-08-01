import { z } from 'zod';
import { difficultyKeys, questionSchema } from '../assessment/question.validation.js';
import { aiQuestionTypes } from './question-generation.js';
import { studyContentTypeKeys } from './study-generation.js';

const uuid = z.uuid('Invalid value.');
const topic = z
  .string({ error: 'Topic is required.' })
  .trim()
  .min(3, 'Topic must be at least 3 characters.')
  .max(2000, 'Topic must not exceed 2000 characters.');
const difficulty = z.enum(difficultyKeys, { error: 'Difficulty is required.' });
const instructions = z.string().trim().max(1000).optional();
const aiTypes = z.array(z.enum(aiQuestionTypes)).min(1).max(4).optional();

export const generateQuestionsSchema = z.object({
  topic,
  types: aiTypes,
  count: z.number().int().min(1).max(20).default(5),
  categoryId: uuid,
  subCategoryId: uuid.optional().nullable(),
  difficulty,
  marks: z.number().min(0.5).max(1000).default(1),
  negativeMarks: z.number().min(0).max(100).default(0),
  instructions
});
export type GenerateQuestionsInput = z.output<typeof generateQuestionsSchema>;

export const generateTestSchema = z.object({
  topic,
  types: aiTypes,
  questionCount: z.number().int().min(1).max(30).default(10),
  categoryId: uuid,
  subCategoryId: uuid.optional().nullable(),
  difficulty,
  marks: z.number().min(0.5).max(1000).default(1),
  title: z.string().trim().max(200).optional(),
  timeLimitMin: z.number().int().min(0).max(600).optional(),
  passingPercentage: z.number().min(0).max(100).optional(),
  instructions
});
export type GenerateTestInput = z.output<typeof generateTestSchema>;

export const generateStudySchema = z.object({
  topic,
  contentType: z.enum(studyContentTypeKeys).default('study_guide'),
  categoryId: uuid.optional().nullable(),
  subCategoryId: uuid.optional().nullable(),
  difficulty: z.enum(difficultyKeys).optional().nullable(),
  questionCount: z.number().int().min(0).max(20).optional(),
  instructions
});
export type GenerateStudyInput = z.output<typeof generateStudySchema>;

const questionWithHistory = z.intersection(
  z.object({ historyId: z.string().trim().min(1).max(60).optional() }),
  questionSchema
);

export const saveQuestionsSchema = z.object({
  questions: z.array(questionWithHistory).min(1, 'No questions to save.').max(50)
});
export type SaveQuestionsInput = z.output<typeof saveQuestionsSchema>;

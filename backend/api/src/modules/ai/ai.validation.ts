import { z } from 'zod';
import { difficultyKeys, questionSchema } from '../assessment/question.validation.js';
import { aiQuestionTypes } from './question-generation.js';

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

export const saveQuestionsSchema = z.object({
  questions: z.array(questionSchema).min(1, 'No questions to save.').max(50)
});
export type SaveQuestionsInput = z.output<typeof saveQuestionsSchema>;

import { z } from 'zod';
import { difficultyKeys } from './question.validation.js';

const uuid = z.uuid('Invalid value.');

export const testSchema = z.object({
  title: z
    .string({ error: 'Test Title is required.' })
    .trim()
    .min(3, 'Test Title must be at least 3 characters.')
    .max(200, 'Test Title must not exceed 200 characters.'),
  description: z.string().trim().max(2000).default(''),
  categoryId: uuid.optional().nullable(),
  subCategoryId: uuid.optional().nullable(),
  difficulty: z.enum(difficultyKeys).optional().nullable(),
  mode: z.enum(['fixed', 'random']).default('fixed'),
  questionIds: z.array(uuid).max(200).default([]),
  randomConfig: z
    .object({
      count: z.number().int().min(1).max(100),
      categoryId: uuid.optional().nullable(),
      difficulty: z.enum(difficultyKeys).optional().nullable()
    })
    .optional()
    .nullable(),
  settings: z
    .object({
      passingPercentage: z.number().min(0).max(100).default(50),
      timeLimitMin: z.number().int().min(0).max(600).default(0),
      timeLimitPerQuestionSec: z.number().int().min(0).max(3600).default(0),
      attemptsAllowed: z.number().int().min(1).max(20).default(1),
      negativeMarking: z.boolean().default(false),
      shuffleQuestions: z.boolean().default(false),
      shuffleOptions: z.boolean().default(false),
      antiCheat: z
        .object({
          fullScreen: z.boolean().default(false),
          tabSwitchDetection: z.boolean().default(false),
          tabSwitchLimit: z.number().int().min(1).max(20).default(3),
          disableCopyPaste: z.boolean().default(false),
          webcamCapture: z.boolean().default(false)
        })
        .default({
          fullScreen: false,
          tabSwitchDetection: false,
          tabSwitchLimit: 3,
          disableCopyPaste: false,
          webcamCapture: false
        })
    })
    .default({
      passingPercentage: 50,
      timeLimitMin: 0,
      timeLimitPerQuestionSec: 0,
      attemptsAllowed: 1,
      negativeMarking: false,
      shuffleQuestions: false,
      shuffleOptions: false,
      antiCheat: {
        fullScreen: false,
        tabSwitchDetection: false,
        tabSwitchLimit: 3,
        disableCopyPaste: false,
        webcamCapture: false
      }
    })
});

export type TestInput = z.output<typeof testSchema>;

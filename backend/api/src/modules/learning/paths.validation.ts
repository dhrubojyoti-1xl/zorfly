import { z } from 'zod';
import { difficultyKeys } from '../assessment/question.validation.js';

const uuid = z.uuid('Invalid value.');

const materialStepSchema = z.object({
  kind: z.literal('material'),
  title: z.string().trim().min(1).max(200),
  materialId: uuid
});

const testStepSchema = z.object({
  kind: z.literal('test'),
  title: z.string().trim().min(1).max(200),
  testId: uuid
});

const practiceStepSchema = z.object({
  kind: z.literal('practice'),
  title: z.string().trim().min(1).max(200),
  practice: z.object({
    categoryId: uuid.optional().nullable(),
    difficulty: z.enum(difficultyKeys).optional().nullable(),
    count: z.number().int().min(1).max(50).default(5)
  })
});

export const pathSchema = z.object({
  title: z
    .string({ error: 'Path Title is required.' })
    .trim()
    .min(3, 'Path Title must be at least 3 characters.')
    .max(200, 'Path Title must not exceed 200 characters.'),
  description: z.string().trim().max(2000).default(''),
  steps: z
    .array(z.discriminatedUnion('kind', [materialStepSchema, testStepSchema, practiceStepSchema]))
    .min(1, 'Add at least one step.')
    .max(30)
});

export type PathInput = z.output<typeof pathSchema>;
export type PathStepInput = PathInput['steps'][number];

export const pathAssignSchema = z.object({
  targetType: z.enum(['company', 'department', 'team', 'employee'], {
    error: 'Target is required.'
  }),
  targetId: uuid.optional().nullable()
});

export type PathAssignInput = z.output<typeof pathAssignSchema>;

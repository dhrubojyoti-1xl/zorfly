import { z } from 'zod';
import { difficultyKeys } from '../assessment/question.validation.js';

export const learningMaterialTypeKeys = [
  'article',
  'video',
  'pdf',
  'link',
  'study_guide',
  'summary',
  'flashcards',
  'practice_quiz'
] as const;
export type LearningMaterialType = (typeof learningMaterialTypeKeys)[number];

export const linkLikeTypes: readonly LearningMaterialType[] = ['article', 'video', 'pdf', 'link'];
export const studyContentTypes: readonly LearningMaterialType[] = [
  'study_guide',
  'summary',
  'flashcards',
  'practice_quiz'
];

const uuid = z.uuid('Invalid value.');

const studyBodySchema = z
  .object({
    overview: z.string().max(3000).default(''),
    sections: z
      .array(
        z.object({
          heading: z.string().max(200).default(''),
          body: z.string().max(8000).default('')
        })
      )
      .max(50)
      .default([]),
    keyPoints: z.array(z.string().max(500)).max(50).default([])
  })
  .default({ overview: '', sections: [], keyPoints: [] });

const selfCheckQuestionSchema = z.object({
  prompt: z.string().max(500),
  options: z.array(z.string().max(300)).min(2).max(8),
  correctIndex: z.number().int().min(0),
  explanation: z.string().max(1000).default('')
});

export const learningMaterialSchema = z
  .object({
    title: z
      .string({ error: 'Title is required.' })
      .trim()
      .min(2, 'Title must be at least 2 characters.')
      .max(200, 'Title must not exceed 200 characters.'),
    description: z.string().trim().max(2000).default(''),
    categoryId: uuid.optional().nullable(),
    subCategoryId: uuid.optional().nullable(),
    difficulty: z.enum(difficultyKeys).optional().nullable(),
    type: z.enum(learningMaterialTypeKeys).default('link'),
    url: z.string().trim().max(1000).optional(),
    body: studyBodySchema,
    questions: z.array(selfCheckQuestionSchema).max(50).default([]),
    tags: z.array(z.string().trim().max(50)).max(20).default([])
  })
  .superRefine((value, context) => {
    if (linkLikeTypes.includes(value.type) && !value.url?.trim()) {
      context.addIssue({
        code: 'custom',
        path: ['url'],
        message: 'A URL or file link is required.'
      });
    }
    value.questions.forEach((question, index) => {
      if (question.correctIndex >= question.options.length) {
        context.addIssue({
          code: 'custom',
          path: ['questions', index, 'correctIndex'],
          message: 'The correct answer must reference one of the listed options.'
        });
      }
    });
  });

export type LearningMaterialInput = z.output<typeof learningMaterialSchema>;

export const updateLearningMaterialSchema = learningMaterialSchema;

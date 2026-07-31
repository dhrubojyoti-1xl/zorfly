import { z } from 'zod';

export const difficultyKeys = [
  'fresher',
  'junior',
  'mid_level',
  'senior',
  'team_lead',
  'manager',
  'hod',
  'cxo'
] as const;
export const questionTypeKeys = [
  'image_comparison',
  'find_mistakes',
  'hotspot',
  'content_review',
  'video_review',
  'mcq',
  'true_false',
  'drag_drop',
  'multiple_error_detection'
] as const;

const uuid = z.uuid('Invalid value.');
const idString = z.string().trim().min(1).max(50);
const mediaUrl = z.string().trim().min(1, 'Image/video is required.').max(1000);
const markedItem = z.object({
  id: idString,
  label: z.string().trim().min(1).max(200),
  marks: z.number().min(0).optional()
});
const hotspotContent = z.object({
  imageUrl: mediaUrl,
  zones: z
    .array(
      markedItem.extend({
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        w: z.number().min(0.005).max(1),
        h: z.number().min(0.005).max(1)
      })
    )
    .min(1, 'At least one zone is required.')
    .max(30),
  tolerancePct: z.number().min(0).max(10).default(2)
});

const contentSchemas = {
  mcq: z
    .object({
      options: z
        .array(
          z.object({
            id: idString,
            text: z.string().trim().min(1).max(500),
            imageUrl: z.string().max(1000).optional()
          })
        )
        .min(2, 'At least 2 options are required.')
        .max(10, 'No more than 10 options are allowed.'),
      correctOptionIds: z.array(idString).min(1, 'At least one correct option is required.'),
      multiple: z.boolean().default(false),
      partialCredit: z.boolean().default(false)
    })
    .superRefine((content, context) => {
      const ids = new Set(content.options.map((option) => option.id));
      if (content.correctOptionIds.some((id) => !ids.has(id))) {
        context.addIssue({
          code: 'custom',
          message: 'Correct options must be from the options list.'
        });
      }
      if (!content.multiple && content.correctOptionIds.length > 1) {
        context.addIssue({
          code: 'custom',
          message: 'Single-answer questions must have exactly one correct option.'
        });
      }
    }),
  true_false: z.object({
    correctAnswer: z.boolean({ error: 'Correct answer is required.' })
  }),
  image_comparison: z
    .object({
      images: z
        .array(z.object({ id: idString, url: mediaUrl }))
        .min(2, 'At least 2 images are required.')
        .max(6, 'No more than 6 images are allowed.'),
      correctImageId: idString
    })
    .superRefine((content, context) => {
      if (!content.images.some((image) => image.id === content.correctImageId)) {
        context.addIssue({
          code: 'custom',
          path: ['correctImageId'],
          message: 'Select which image is correct.'
        });
      }
    }),
  find_mistakes: z.object({
    imageUrl: mediaUrl,
    mode: z.enum(['checklist', 'typed']).default('checklist'),
    mistakes: z
      .array(markedItem.omit({ marks: true }))
      .min(1, 'At least one mistake is required.')
      .max(30),
    distractors: z
      .array(markedItem.omit({ marks: true }))
      .max(20)
      .default([])
  }),
  hotspot: hotspotContent,
  multiple_error_detection: hotspotContent,
  content_review: z
    .object({
      text: z.string().trim().min(10, 'Paragraph must be at least 10 characters.').max(10_000),
      errors: z
        .array(
          z.object({
            id: idString,
            wordIndex: z.number().int().min(0),
            correction: z.string().trim().max(500).default(''),
            explanation: z.string().trim().max(1000).default('')
          })
        )
        .min(1, 'At least one error is required.')
        .max(50)
    })
    .superRefine((content, context) => {
      const words = content.text.split(/\s+/).length;
      if (content.errors.some((error) => error.wordIndex >= words)) {
        context.addIssue({
          code: 'custom',
          message: 'Error word position is outside the paragraph.'
        });
      }
    }),
  video_review: z.object({
    videoUrl: mediaUrl,
    toleranceSec: z.number().min(0).max(30).default(2),
    mistakes: z
      .array(markedItem.extend({ timestampSec: z.number().min(0) }))
      .min(1, 'At least one mistake is required.')
      .max(50)
  }),
  drag_drop: z
    .discriminatedUnion('mode', [
      z.object({
        mode: z.literal('sequence'),
        items: z
          .array(z.object({ id: idString, text: z.string().trim().min(1).max(300) }))
          .min(2, 'At least 2 items are required.')
          .max(15),
        correctOrder: z.array(idString).min(2),
        partialCredit: z.boolean().default(true)
      }),
      z.object({
        mode: z.literal('match'),
        left: z
          .array(z.object({ id: idString, text: z.string().trim().min(1).max(300) }))
          .min(2)
          .max(15),
        right: z
          .array(z.object({ id: idString, text: z.string().trim().min(1).max(300) }))
          .min(2)
          .max(15),
        correctPairs: z.array(z.object({ leftId: idString, rightId: idString })).min(2),
        partialCredit: z.boolean().default(true)
      })
    ])
    .superRefine((content, context) => {
      if (content.mode === 'sequence') {
        const ids = new Set(content.items.map((item) => item.id));
        if (
          content.correctOrder.length !== content.items.length ||
          new Set(content.correctOrder).size !== content.items.length ||
          content.correctOrder.some((id) => !ids.has(id))
        ) {
          context.addIssue({
            code: 'custom',
            message: 'Correct order must contain every item exactly once.'
          });
        }
        return;
      }
      const left = new Set(content.left.map((item) => item.id));
      const right = new Set(content.right.map((item) => item.id));
      if (content.correctPairs.some((pair) => !left.has(pair.leftId) || !right.has(pair.rightId))) {
        context.addIssue({
          code: 'custom',
          message: 'Pairs must reference items from both lists.'
        });
      }
    })
} as const;

export const questionSchema = z
  .object({
    title: z
      .string({ error: 'Question Title is required.' })
      .trim()
      .min(3, 'Question Title must be at least 3 characters.')
      .max(300, 'Question Title must not exceed 300 characters.'),
    type: z.enum(questionTypeKeys, { error: 'Question Type is required.' }),
    categoryId: uuid,
    subCategoryId: uuid.optional().nullable(),
    difficulty: z.enum(difficultyKeys, { error: 'Difficulty is required.' }),
    marks: z.number({ error: 'Marks are required.' }).min(0.5).max(1000),
    negativeMarks: z.number().min(0).max(100).default(0),
    explanation: z.string().trim().max(5000).default(''),
    trainingLink: z.string().trim().max(1000).default(''),
    tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
    content: z.unknown()
  })
  .superRefine((question, context) => {
    const parsed = contentSchemas[question.type].safeParse(question.content);
    if (!parsed.success) {
      context.addIssue({
        code: 'custom',
        path: ['content'],
        message: parsed.error.issues[0]?.message ?? 'Question content is invalid.'
      });
    }
  })
  .transform((question) => ({
    ...question,
    content: contentSchemas[question.type].parse(question.content)
  }));

export type QuestionInput = z.output<typeof questionSchema>;

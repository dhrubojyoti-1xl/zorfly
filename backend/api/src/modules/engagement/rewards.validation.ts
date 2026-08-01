import { z } from 'zod';

export const badgeSchema = z.object({
  name: z
    .string({ error: 'Badge Name is required.' })
    .trim()
    .min(2, 'Badge Name must be at least 2 characters.')
    .max(100, 'Badge Name must not exceed 100 characters.'),
  description: z.string().trim().max(500).default(''),
  icon: z.string().trim().max(8).default('🏅'),
  ruleType: z.enum(['tests_count', 'score_percent', 'perfect', 'detection_percent'], {
    error: 'Rule is required.'
  }),
  threshold: z.number().min(0).max(1000).default(0),
  points: z.number().min(0).max(1000).default(10)
});

export type BadgeInput = z.output<typeof badgeSchema>;

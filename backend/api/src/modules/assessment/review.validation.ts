import { z } from 'zod';

export const scoreSchema = z.object({
  obtained: z.number({ error: 'Marks are required.' }).min(0, 'Marks must be 0 or more.')
});

export type ScoreInput = z.output<typeof scoreSchema>;

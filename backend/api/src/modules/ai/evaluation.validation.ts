import { z } from 'zod';

export const evaluationDecisionSchema = z
  .object({
    decision: z.enum(['accept', 'adjust', 'reject']),
    obtained: z.number().min(0).optional(),
    reason: z.string().trim().max(2000).optional()
  })
  .refine((value) => value.decision === 'accept' || value.obtained !== undefined, {
    message: 'Marks are required to adjust or reject an AI evaluation.',
    path: ['obtained']
  });

export type EvaluationDecisionInput = z.output<typeof evaluationDecisionSchema>;

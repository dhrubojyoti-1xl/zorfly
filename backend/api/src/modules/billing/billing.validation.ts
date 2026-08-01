import { z } from 'zod';

export const subscribeSchema = z.object({
  planId: z.uuid('Invalid value.'),
  couponCode: z.string().trim().max(30).optional().or(z.literal(''))
});

export type SubscribeInput = z.output<typeof subscribeSchema>;

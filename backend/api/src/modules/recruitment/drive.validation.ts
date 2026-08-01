import { z } from 'zod';

const uuid = z.uuid('Invalid value.');

export const driveSchema = z.object({
  title: z
    .string({ error: 'Position Title is required.' })
    .trim()
    .min(3, 'Position Title must be at least 3 characters.')
    .max(200, 'Position Title must not exceed 200 characters.'),
  description: z.string().trim().max(2000).default(''),
  testId: uuid,
  openFrom: z.iso.datetime({ offset: true }).optional().nullable(),
  openTo: z.iso.datetime({ offset: true }).optional().nullable(),
  showResultToCandidate: z.boolean().default(false)
});

export type DriveInput = z.output<typeof driveSchema>;

export const decisionSchema = z.object({
  status: z.enum(['shortlisted', 'hold', 'rejected'], { error: 'Decision is required.' }),
  notes: z.string().trim().max(2000).default('')
});

export type DecisionInput = z.output<typeof decisionSchema>;

export const registerSchema = z.object({
  fullName: z
    .string({ error: 'Full Name is required.' })
    .trim()
    .min(2, 'Full Name must be at least 2 characters.')
    .max(100, 'Full Name must not exceed 100 characters.'),
  email: z
    .string({ error: 'Email ID is required.' })
    .trim()
    .toLowerCase()
    .pipe(z.email('Enter a valid Email ID.')),
  contactNumber: z
    .string()
    .trim()
    .regex(/^\d{10,15}$/, 'Enter a valid Contact Number.')
    .optional()
    .or(z.literal(''))
});

export type RegisterInput = z.output<typeof registerSchema>;

import { z } from 'zod';

export const BROADCAST_REPORT_KINDS = [
  'company_performance',
  'leaderboard',
  'recruitment_drive'
] as const;

export const REPORT_KINDS = [
  'individual',
  'team',
  'department',
  'recruitment_drive',
  'company_performance',
  'leaderboard'
] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const EXPORT_FORMATS = ['pdf', 'xlsx', 'csv'] as const;

export const addRecipientSchema = z.object({
  email: z
    .string({ error: 'Email is required.' })
    .trim()
    .toLowerCase()
    .pipe(z.email('Enter a valid email address.'))
    .pipe(z.string().max(254)),
  reportTypes: z
    .array(z.enum(BROADCAST_REPORT_KINDS))
    .max(BROADCAST_REPORT_KINDS.length)
    .default([])
});
export type AddRecipientInput = z.output<typeof addRecipientSchema>;

export const updateRecipientSchema = z.object({
  reportTypes: z
    .array(z.enum(BROADCAST_REPORT_KINDS))
    .max(BROADCAST_REPORT_KINDS.length)
    .optional(),
  active: z.boolean().optional()
});
export type UpdateRecipientInput = z.output<typeof updateRecipientSchema>;

export const scheduleUpdateSchema = z
  .object({
    frequency: z.enum(['daily', 'weekly', 'monthly'], { error: 'Frequency is required.' }),
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    dayOfMonth: z.number().int().min(1).max(28).optional(),
    sendHour: z.number().int().min(0).max(23).default(8),
    sendMinute: z.number().int().min(0).max(59).default(0),
    active: z.boolean().default(true)
  })
  .superRefine((value, context) => {
    if (value.frequency === 'weekly' && value.dayOfWeek === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['dayOfWeek'],
        message: 'Day of week is required for a weekly schedule.'
      });
    }
    if (value.frequency === 'monthly' && value.dayOfMonth === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['dayOfMonth'],
        message: 'Day of month is required for a monthly schedule.'
      });
    }
  });
export type ScheduleUpdateInput = z.output<typeof scheduleUpdateSchema>;

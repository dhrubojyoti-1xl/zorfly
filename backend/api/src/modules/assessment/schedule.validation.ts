import { z } from 'zod';

const uuid = z.uuid('Invalid value.');
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD dates.');

export const scheduleSchema = z.object({
  testId: uuid,
  frequency: z.enum(['daily', 'weekly', 'monthly'], { error: 'Frequency is required.' }),
  dayOfWeek: z.number().int().min(0).max(6).default(1),
  dayOfMonth: z.number().int().min(1).max(28).default(1),
  openHour: z.number().int().min(0).max(23).default(9),
  windowHours: z.number().int().min(1).max(168).default(9),
  targetType: z.enum(['company', 'department', 'team', 'employee'], {
    error: 'Target is required.'
  }),
  targetId: uuid.optional().nullable(),
  blackoutDates: z.array(dateOnly).max(100).default([])
});

export type ScheduleInput = z.output<typeof scheduleSchema>;

export const blackoutSchema = z.object({
  blackoutDates: z.array(dateOnly).max(100)
});

export type BlackoutInput = z.output<typeof blackoutSchema>;

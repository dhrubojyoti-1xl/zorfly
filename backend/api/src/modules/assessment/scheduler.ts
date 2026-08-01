import {
  AssessmentStatus,
  AssignmentSource,
  AssignmentStatus,
  AttemptStatus,
  CycleStatus,
  RecordStatus,
  ScheduleFrequency,
  TargetScopeType,
  type Prisma,
  type ZorflyPrismaClient
} from '@zorfly/database';
import { ApiError } from '../../platform/api-error.js';
import type { AuthService } from '../auth/auth.service.js';
import { resolveAssignmentTarget, type AssignmentTargetType } from './tests.router.js';
import type { ScheduleInput } from './schedule.validation.js';

export type ScheduleFrequencyCode = 'daily' | 'weekly' | 'monthly';

export const frequencyCodes: Record<ScheduleFrequencyCode, ScheduleFrequency> = {
  daily: ScheduleFrequency.DAILY,
  weekly: ScheduleFrequency.WEEKLY,
  monthly: ScheduleFrequency.MONTHLY
};
export const codeToFrequency = new Map(
  Object.entries(frequencyCodes).map(([key, value]) => [value, key as ScheduleFrequencyCode])
);

export function targetTypeToScope(targetType: AssignmentTargetType): TargetScopeType {
  switch (targetType) {
    case 'company':
      return TargetScopeType.TENANT;
    case 'department':
      return TargetScopeType.DEPARTMENT;
    case 'team':
      return TargetScopeType.TEAM;
    default:
      return TargetScopeType.MEMBERSHIP;
  }
}

export function scopeToTargetType(scope: TargetScopeType): AssignmentTargetType {
  switch (scope) {
    case TargetScopeType.TENANT:
      return 'company';
    case TargetScopeType.DEPARTMENT:
      return 'department';
    case TargetScopeType.TEAM:
      return 'team';
    default:
      return 'employee';
  }
}

const ANCHOR_YEAR = 2024;
const ANCHOR_MONTH = 0; // January 2024 (UTC) — 31 days, day 7 is a Sunday.
const ANCHOR_SUNDAY_DATE = 7;

/** Encodes the recurrence anchor (day-of-week/month + open hour) as a UTC date so it can be stored in `startsAt` without extra columns. */
export function encodeAnchor(
  frequency: ScheduleFrequencyCode,
  dayOfWeek: number,
  dayOfMonth: number,
  openHour: number
): Date {
  if (frequency === 'weekly') {
    return new Date(Date.UTC(ANCHOR_YEAR, ANCHOR_MONTH, ANCHOR_SUNDAY_DATE + dayOfWeek, openHour));
  }
  if (frequency === 'monthly') {
    return new Date(Date.UTC(ANCHOR_YEAR, ANCHOR_MONTH, dayOfMonth, openHour));
  }
  return new Date(Date.UTC(ANCHOR_YEAR, ANCHOR_MONTH, 1, openHour));
}

export function decodeAnchor(startsAt: Date): {
  dayOfWeek: number;
  dayOfMonth: number;
  openHour: number;
} {
  return {
    dayOfWeek: startsAt.getUTCDay(),
    dayOfMonth: startsAt.getUTCDate(),
    openHour: startsAt.getUTCHours()
  };
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function dateKey(date: Date): string {
  return `${String(date.getUTCFullYear())}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

interface CycleSchedule {
  frequency: ScheduleFrequency;
  startsAt: Date;
  closeOffsetMinutes: number;
}

/** The cycle key identifies one occurrence; `null` means "not due today". */
export function currentCycleKey(schedule: CycleSchedule, now: Date): string | null {
  if (schedule.frequency === ScheduleFrequency.DAILY) return dateKey(now);
  if (schedule.frequency === ScheduleFrequency.WEEKLY) {
    return now.getUTCDay() === schedule.startsAt.getUTCDay() ? dateKey(now) : null;
  }
  if (schedule.frequency === ScheduleFrequency.MONTHLY) {
    return now.getUTCDate() === schedule.startsAt.getUTCDate() ? dateKey(now) : null;
  }
  return null;
}

export function windowFor(schedule: CycleSchedule, now: Date): { opensAt: Date; closesAt: Date } {
  const opensAt = new Date(now);
  opensAt.setUTCHours(schedule.startsAt.getUTCHours(), 0, 0, 0);
  const closesAt = new Date(opensAt.getTime() + schedule.closeOffsetMinutes * 60_000);
  return { opensAt, closesAt };
}

export async function createSchedule(
  prisma: ZorflyPrismaClient,
  tenantId: string,
  userId: string,
  input: ScheduleInput
) {
  const test = await prisma.assessmentDefinition.findFirst({
    where: { id: input.testId, tenantId, deletedAt: null },
    include: { currentVersion: true }
  });
  if (!test?.currentVersion || test.status !== AssessmentStatus.PUBLISHED) {
    throw new ApiError(422, 'Publish the test before scheduling it.');
  }
  if (input.targetType !== 'company' && !input.targetId) {
    throw new ApiError(422, 'Select who the schedule targets.');
  }
  return prisma.$transaction(async (transaction) => {
    await resolveAssignmentTarget(transaction, tenantId, input.targetType, input.targetId ?? null);
    const startsAt = encodeAnchor(
      input.frequency,
      input.dayOfWeek,
      input.dayOfMonth,
      input.openHour
    );
    const schedule = await transaction.assessmentSchedule.create({
      data: {
        tenantId,
        assessmentId: test.id,
        name: `${test.title} — ${input.frequency}`.slice(0, 200),
        frequency: frequencyCodes[input.frequency],
        timeZone: 'UTC',
        startsAt,
        openOffsetMinutes: 0,
        closeOffsetMinutes: input.windowHours * 60,
        status: RecordStatus.ACTIVE,
        createdById: userId
      }
    });
    await transaction.scheduleTarget.create({
      data: {
        tenantId,
        scheduleId: schedule.id,
        scopeType: targetTypeToScope(input.targetType),
        targetId: input.targetType === 'company' ? null : (input.targetId ?? null)
      }
    });
    const uniqueDates = [...new Set(input.blackoutDates)];
    if (uniqueDates.length > 0) {
      await transaction.scheduleBlackoutDate.createMany({
        data: uniqueDates.map((date) => ({
          tenantId,
          scheduleId: schedule.id,
          localDate: new Date(`${date}T00:00:00.000Z`)
        }))
      });
    }
    return schedule;
  });
}

export const scheduleInclude = {
  assessment: { select: { title: true } },
  targets: true,
  blackoutDates: true,
  cycles: { orderBy: { sequenceNumber: 'desc' }, take: 1 }
} satisfies Prisma.AssessmentScheduleInclude;

export type ScheduleRecord = Prisma.AssessmentScheduleGetPayload<{
  include: typeof scheduleInclude;
}>;

export function scheduleSummary(schedule: ScheduleRecord) {
  const target = schedule.targets[0];
  const anchor = decodeAnchor(schedule.startsAt);
  return {
    id: schedule.id,
    testTitle: schedule.assessment.title,
    frequency: codeToFrequency.get(schedule.frequency) ?? 'daily',
    dayOfWeek: anchor.dayOfWeek,
    dayOfMonth: anchor.dayOfMonth,
    openHour: anchor.openHour,
    windowHours: Math.round(schedule.closeOffsetMinutes / 60),
    targetType: target ? scopeToTargetType(target.scopeType) : 'company',
    active: schedule.status === RecordStatus.ACTIVE,
    blackoutDates: schedule.blackoutDates.map((row) => row.localDate.toISOString().slice(0, 10)),
    lastCycleKey: schedule.cycles[0]?.cycleKey ?? null,
    createdAt: schedule.createdAt
  };
}

async function findOwnedSchedule(
  prisma: ZorflyPrismaClient,
  tenantId: string,
  id: string,
  restrictToCreatedById?: string
) {
  const schedule = await prisma.assessmentSchedule.findFirst({
    where: {
      id,
      tenantId,
      deletedAt: null,
      ...(restrictToCreatedById ? { createdById: restrictToCreatedById } : {})
    }
  });
  if (!schedule) throw new ApiError(404, 'The requested schedule was not found.');
  return schedule;
}

export async function toggleSchedule(
  prisma: ZorflyPrismaClient,
  tenantId: string,
  id: string,
  restrictToCreatedById?: string
): Promise<boolean> {
  const schedule = await findOwnedSchedule(prisma, tenantId, id, restrictToCreatedById);
  const nextStatus =
    schedule.status === RecordStatus.ACTIVE ? RecordStatus.INACTIVE : RecordStatus.ACTIVE;
  const updated = await prisma.assessmentSchedule.update({
    where: { id: schedule.id },
    data: { status: nextStatus }
  });
  return updated.status === RecordStatus.ACTIVE;
}

export async function setBlackoutDates(
  prisma: ZorflyPrismaClient,
  tenantId: string,
  id: string,
  dates: readonly string[],
  restrictToCreatedById?: string
): Promise<string[]> {
  const schedule = await findOwnedSchedule(prisma, tenantId, id, restrictToCreatedById);
  const unique = [...new Set(dates)].sort();
  await prisma.$transaction([
    prisma.scheduleBlackoutDate.deleteMany({ where: { scheduleId: schedule.id } }),
    ...(unique.length > 0
      ? [
          prisma.scheduleBlackoutDate.createMany({
            data: unique.map((date) => ({
              tenantId,
              scheduleId: schedule.id,
              localDate: new Date(`${date}T00:00:00.000Z`)
            }))
          })
        ]
      : [])
  ]);
  return unique;
}

export async function deleteSchedule(
  prisma: ZorflyPrismaClient,
  tenantId: string,
  id: string,
  userId: string,
  restrictToCreatedById?: string
): Promise<void> {
  const schedule = await findOwnedSchedule(prisma, tenantId, id, restrictToCreatedById);
  await prisma.assessmentSchedule.update({
    where: { id: schedule.id },
    data: { status: RecordStatus.ARCHIVED, deletedAt: new Date(), deletedById: userId }
  });
}

async function closeDueAssignments(prisma: ZorflyPrismaClient, now: Date): Promise<number> {
  const due = await prisma.assessmentAssignment.findMany({
    where: {
      status: { in: [AssignmentStatus.AVAILABLE, AssignmentStatus.IN_PROGRESS] },
      dueAt: { not: null, lt: now }
    },
    select: { id: true, tenantId: true }
  });
  for (const assignment of due) {
    const submitted = await prisma.assessmentAttempt.findFirst({
      where: {
        tenantId: assignment.tenantId,
        assignmentId: assignment.id,
        status: {
          in: [
            AttemptStatus.SUBMITTED,
            AttemptStatus.EVALUATED,
            AttemptStatus.NEEDS_REVIEW,
            AttemptStatus.PUBLISHED
          ]
        }
      },
      select: { id: true }
    });
    await prisma.assessmentAssignment.update({
      where: { id: assignment.id },
      data: {
        status: submitted ? AssignmentStatus.COMPLETED : AssignmentStatus.EXPIRED,
        completedAt: submitted ? now : null
      }
    });
  }
  return due.length;
}

export interface SchedulerTickResult {
  cyclesOpened: number;
  assignmentsClosed: number;
}

/**
 * In-process recurring-assessment tick (SCH-02/03 v1) — mirrors the OneXL
 * reference's `worker/scheduler.js`. Scans every tenant's active schedules
 * for a due, unopened cycle, opens the assignment fan-out for it, and closes
 * assignments whose deadline has passed. Intended to run on a 60s interval
 * from the API process; a queue-backed worker replacement is a later step.
 */
export async function runSchedulerTick(
  prisma: ZorflyPrismaClient,
  service: AuthService,
  now: Date = new Date()
): Promise<SchedulerTickResult> {
  let cyclesOpened = 0;
  const schedules = await prisma.assessmentSchedule.findMany({
    where: { status: RecordStatus.ACTIVE, deletedAt: null },
    include: {
      assessment: { include: { currentVersion: true } },
      targets: true,
      blackoutDates: true,
      cycles: { orderBy: { sequenceNumber: 'desc' }, take: 1 }
    }
  });

  for (const schedule of schedules) {
    const cycleKey = currentCycleKey(schedule, now);
    if (!cycleKey || schedule.cycles[0]?.cycleKey === cycleKey) continue;
    const inBlackout = schedule.blackoutDates.some(
      (row) => row.localDate.toISOString().slice(0, 10) === cycleKey
    );
    if (inBlackout) continue;
    const { opensAt, closesAt } = windowFor(schedule, now);
    if (now < opensAt || now > closesAt) continue;
    const assessment = schedule.assessment;
    if (!assessment.currentVersion || assessment.status !== AssessmentStatus.PUBLISHED) continue;
    const target = schedule.targets[0];
    if (!target) continue;
    const targetType = scopeToTargetType(target.scopeType);
    const currentVersion = assessment.currentVersion;

    await prisma.$transaction(async (transaction) => {
      const resolved = await resolveAssignmentTarget(
        transaction,
        schedule.tenantId,
        targetType,
        target.targetId
      );
      const sequenceNumber = (schedule.cycles[0]?.sequenceNumber ?? 0) + 1;
      const cycle = await transaction.assessmentCycle.create({
        data: {
          tenantId: schedule.tenantId,
          scheduleId: schedule.id,
          cycleKey,
          sequenceNumber,
          status: CycleStatus.OPEN,
          opensAt,
          closesAt,
          createdById: schedule.createdById
        }
      });
      const campaign = await transaction.assignmentCampaign.create({
        data: {
          tenantId: schedule.tenantId,
          assessmentVersionId: currentVersion.id,
          cycleId: cycle.id,
          source: AssignmentSource.SCHEDULE,
          name: `${assessment.title} — ${cycleKey}`.slice(0, 200),
          opensAt,
          dueAt: closesAt,
          maxAttempts: currentVersion.maxAttempts,
          settings: { compatibility: 'one-xl', scheduleId: schedule.id },
          createdById: schedule.createdById,
          targetScopes: {
            create: {
              tenantId: schedule.tenantId,
              scopeType: resolved.scopeType,
              targetId: resolved.targetId,
              ...(resolved.targetValue && !resolved.targetId
                ? { filter: { key: resolved.targetValue } }
                : {})
            }
          }
        }
      });
      if (resolved.audience.length > 0) {
        await transaction.assessmentAssignment.createMany({
          data: resolved.audience.map((membership) => ({
            tenantId: schedule.tenantId,
            campaignId: campaign.id,
            assessmentVersionId: currentVersion.id,
            membershipId: membership.id,
            source: AssignmentSource.SCHEDULE,
            status: AssignmentStatus.AVAILABLE,
            availableAt: opensAt,
            dueAt: closesAt,
            maxAttempts: currentVersion.maxAttempts,
            createdById: schedule.createdById
          }))
        });
      }
      for (const membership of resolved.audience) {
        service.sendNotification({
          to: membership.user.emailCanonical,
          subject: `New test available: ${assessment.title}`,
          html: `<p>Hello ${membership.user.displayName ?? 'there'}, the recurring test <strong>${assessment.title}</strong> is now open and is due by ${closesAt.toLocaleDateString('en-GB')}.</p>`,
          type: 'schedule_opened',
          tenantId: schedule.tenantId
        });
      }
    });
    cyclesOpened += 1;
  }

  const assignmentsClosed = await closeDueAssignments(prisma, now);
  return { cyclesOpened, assignmentsClosed };
}

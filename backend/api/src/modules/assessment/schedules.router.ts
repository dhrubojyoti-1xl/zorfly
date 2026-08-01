import { Router, type Request } from 'express';
import { z } from 'zod';
import { RecordStatus, type ZorflyPrismaClient } from '@zorfly/database';
import { roles } from '../../domain/access-control.js';
import { ApiError } from '../../platform/api-error.js';
import { validate } from '../../platform/validate.js';
import { createRequireAuth, createRequirePermission } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { SessionPrincipal } from '../auth/auth.types.js';
import type { TokenService } from '../auth/tokens.js';
import { ledTeamIds } from './tests.router.js';
import { blackoutSchema, scheduleSchema, type ScheduleInput } from './schedule.validation.js';
import {
  createSchedule,
  deleteSchedule,
  frequencyCodes,
  scheduleInclude,
  scheduleSummary,
  setBlackoutDates,
  toggleSchedule,
  type ScheduleFrequencyCode
} from './scheduler.js';

const uuid = z.uuid();

function principal(request: Request): SessionPrincipal & { tenantId: string } {
  if (!request.auth?.tenantId) throw new ApiError(401, 'Authentication is required.');
  return { ...request.auth, tenantId: request.auth.tenantId };
}

function queryString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function pageQuery(request: Request) {
  const page = Math.max(1, Number.parseInt(queryString(request.query.page), 10) || 1);
  const requested = Number.parseInt(queryString(request.query.limit), 10) || 10;
  const limit = [10, 20, 50, 100].includes(requested) ? requested : 10;
  return { page, limit, skip: (page - 1) * limit };
}

export function createScheduleRouter(
  prisma: ZorflyPrismaClient,
  service: AuthService,
  tokens: TokenService
): Router {
  const router = Router();
  router.use(createRequireAuth(tokens));
  router.use(createRequirePermission(service, 'schedules:manage'));

  router.get('/', async (request, response) => {
    const auth = principal(request);
    const { page, limit, skip } = pageQuery(request);
    const frequency = queryString(request.query.frequency);
    const targetType = queryString(request.query.targetType);
    const activeParam = queryString(request.query.active);
    const where = {
      tenantId: auth.tenantId,
      deletedAt: null,
      ...(auth.role === roles.teamLeader ? { createdById: auth.userId } : {}),
      ...(frequency in frequencyCodes
        ? { frequency: frequencyCodes[frequency as ScheduleFrequencyCode] }
        : {}),
      ...(activeParam === 'true' ? { status: RecordStatus.ACTIVE } : {}),
      ...(activeParam === 'false' ? { status: { not: RecordStatus.ACTIVE } } : {}),
      ...(targetType ? { targets: { some: { scopeType: scopeFilterOf(targetType) } } } : {})
    };
    const [rows, totalCount] = await prisma.$transaction([
      prisma.assessmentSchedule.findMany({
        where,
        include: scheduleInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.assessmentSchedule.count({ where })
    ]);
    response.json({
      success: true,
      data: { rows: rows.map(scheduleSummary), totalCount, page, limit }
    });
  });

  router.post('/', validate(scheduleSchema), async (request, response) => {
    const auth = principal(request);
    const input = request.body as ScheduleInput;
    if (input.targetType !== 'company' && !input.targetId) {
      throw new ApiError(422, 'Select who the schedule targets.');
    }
    if (auth.role === roles.teamLeader) {
      const permitted = await ledTeamIds(prisma, auth.tenantId, auth.userId);
      if (input.targetType !== 'team' || !permitted.includes(input.targetId ?? '')) {
        throw new ApiError(403, 'Team Leaders can schedule tests for their own teams only.');
      }
    }
    const schedule = await createSchedule(prisma, auth.tenantId, auth.userId, input);
    response.status(201).json({
      success: true,
      data: { id: schedule.id, message: 'Schedule created successfully.' }
    });
  });

  router.patch('/:id/toggle', async (request, response) => {
    const auth = principal(request);
    const id = uuid.parse(request.params.id);
    const active = await toggleSchedule(
      prisma,
      auth.tenantId,
      id,
      auth.role === roles.teamLeader ? auth.userId : undefined
    );
    response.json({
      success: true,
      data: {
        active,
        message: active ? 'Schedule activated successfully.' : 'Schedule paused successfully.'
      }
    });
  });

  router.patch('/:id/blackout-dates', validate(blackoutSchema), async (request, response) => {
    const auth = principal(request);
    const id = uuid.parse(request.params.id);
    const { blackoutDates } = request.body as { blackoutDates: string[] };
    const dates = await setBlackoutDates(
      prisma,
      auth.tenantId,
      id,
      blackoutDates,
      auth.role === roles.teamLeader ? auth.userId : undefined
    );
    response.json({
      success: true,
      data: { blackoutDates: dates, message: 'Blackout dates updated successfully.' }
    });
  });

  router.delete('/:id', async (request, response) => {
    const auth = principal(request);
    const id = uuid.parse(request.params.id);
    await deleteSchedule(
      prisma,
      auth.tenantId,
      id,
      auth.userId,
      auth.role === roles.teamLeader ? auth.userId : undefined
    );
    response.json({ success: true, data: { message: 'Schedule deleted successfully.' } });
  });

  return router;
}

function scopeFilterOf(targetType: string): 'TENANT' | 'DEPARTMENT' | 'TEAM' | 'MEMBERSHIP' {
  if (targetType === 'department') return 'DEPARTMENT';
  if (targetType === 'team') return 'TEAM';
  if (targetType === 'employee') return 'MEMBERSHIP';
  return 'TENANT';
}

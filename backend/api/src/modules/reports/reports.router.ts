import { randomUUID } from 'node:crypto';
import { Router, type Request } from 'express';
import { MembershipStatus, Prisma, type ZorflyPrismaClient } from '@zorfly/database';
import { roles } from '../../domain/access-control.js';
import { ApiError } from '../../platform/api-error.js';
import { validate } from '../../platform/validate.js';
import { createRequireAuth, createRequirePermission } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { SessionPrincipal } from '../auth/auth.types.js';
import type { TokenService } from '../auth/tokens.js';
import { ledTeamIds } from '../assessment/tests.router.js';
import {
  companyPerformanceReport,
  departmentReport,
  individualReport,
  leaderboardReport,
  recruitmentDriveReport,
  teamReport
} from './reports.service.js';
import {
  REPORT_KINDS,
  addRecipientSchema,
  scheduleUpdateSchema,
  updateRecipientSchema,
  type AddRecipientInput,
  type ReportKind,
  type ScheduleUpdateInput,
  type UpdateRecipientInput
} from './report.validation.js';

const ADMIN_HR_ONLY = 'This report is only available to Company Admin or HR.';
const SETTINGS_CODE = 'scheduled-report-settings';

interface RecipientEntry {
  id: string;
  email: string;
  reportTypes: string[];
  active: boolean;
}

function principal(request: Request): SessionPrincipal & { tenantId: string } {
  if (!request.auth?.tenantId) throw new ApiError(401, 'Authentication is required.');
  return { ...request.auth, tenantId: request.auth.tenantId };
}

function queryString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function recipientsOf(value: unknown): RecipientEntry[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is RecipientEntry =>
          typeof entry === 'object' &&
          entry !== null &&
          typeof (entry as RecipientEntry).id === 'string'
      )
    : [];
}

async function fetchReportData(
  prisma: ZorflyPrismaClient,
  piiHashKey: string,
  kind: ReportKind,
  auth: SessionPrincipal & { tenantId: string },
  request: Request
) {
  const query = request.query;
  if (kind === 'individual') {
    const membershipId = queryString(query.userId);
    if (!membershipId) throw new ApiError(422, 'Select an employee.');
    if (auth.role === roles.teamLeader) {
      const myTeamIds = await ledTeamIds(prisma, auth.tenantId, auth.userId);
      const target = await prisma.tenantMembership.findFirst({
        where: { id: membershipId, tenantId: auth.tenantId },
        include: { teams: { where: { endsAt: null } } }
      });
      const inMyTeam = target?.teams.some((team) => myTeamIds.includes(team.teamId));
      if (!inMyTeam) throw new ApiError(403, 'You can only view reports for your own team.');
    }
    return individualReport(prisma, auth.tenantId, membershipId);
  }
  if (kind === 'team') {
    const teamId = queryString(query.teamId);
    if (!teamId) throw new ApiError(422, 'Select a team.');
    if (auth.role === roles.teamLeader) {
      const myTeamIds = await ledTeamIds(prisma, auth.tenantId, auth.userId);
      if (!myTeamIds.includes(teamId)) {
        throw new ApiError(403, "You can only view your own team's report.");
      }
    }
    return teamReport(prisma, auth.tenantId, teamId);
  }
  if (kind === 'department') {
    if (auth.role === roles.teamLeader) throw new ApiError(403, ADMIN_HR_ONLY);
    const departmentId = queryString(query.departmentId);
    if (!departmentId) throw new ApiError(422, 'Select a department.');
    return departmentReport(prisma, auth.tenantId, departmentId);
  }
  if (kind === 'recruitment_drive') {
    if (auth.role === roles.teamLeader) throw new ApiError(403, ADMIN_HR_ONLY);
    const driveId = queryString(query.driveId);
    if (!driveId) throw new ApiError(422, 'Select a recruitment drive.');
    const data = await recruitmentDriveReport(prisma, auth.tenantId, driveId, piiHashKey);
    if (!data) throw new ApiError(404, 'The requested drive was not found.');
    return data;
  }
  if (kind === 'company_performance') {
    if (auth.role === roles.teamLeader) throw new ApiError(403, ADMIN_HR_ONLY);
    return companyPerformanceReport(prisma, auth.tenantId, {
      period: queryString(query.period),
      month: queryString(query.month),
      year: queryString(query.year)
    });
  }
  return leaderboardReport(prisma, auth.tenantId, {
    scope: queryString(query.scope),
    scopeId: queryString(query.scopeId),
    period: queryString(query.period)
  });
}

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0] ?? {});
  const escape = (value: unknown) => {
    const text =
      value === null || value === undefined
        ? ''
        : value instanceof Date
          ? value.toISOString()
          : typeof value === 'object'
            ? JSON.stringify(value)
            : String(value as string | number | boolean);
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))
  ].join('\n');
}

function csvRowsFor(kind: ReportKind, data: Record<string, unknown>): Array<Record<string, unknown>> {
  if (kind === 'team' || kind === 'department') {
    return (data.members as Array<Record<string, unknown>> | undefined) ?? [];
  }
  if (kind === 'recruitment_drive') {
    return (data.candidates as Array<Record<string, unknown>> | undefined) ?? [];
  }
  if (kind === 'leaderboard') {
    return (data.rows as Array<Record<string, unknown>> | undefined) ?? [];
  }
  if (kind === 'company_performance') {
    return (data.departmentAverages as Array<Record<string, unknown>> | undefined) ?? [];
  }
  return [data];
}

async function settingsRow(prisma: ZorflyPrismaClient, tenantId: string, userId: string) {
  return prisma.reportDefinition.upsert({
    where: { tenantId_code: { tenantId, code: SETTINGS_CODE } },
    create: {
      tenantId,
      code: SETTINGS_CODE,
      name: 'Scheduled report summary',
      reportType: 'summary',
      querySpec: {},
      recipients: [],
      schedule: Prisma.JsonNull,
      createdById: userId
    },
    update: {}
  });
}

export function createReportRouter(
  prisma: ZorflyPrismaClient,
  service: AuthService,
  tokens: TokenService,
  piiHashKey: string
): Router {
  const router = Router();
  router.use(createRequireAuth(tokens));
  router.use(createRequirePermission(service, 'reports:read'));

  router.get('/:kind', async (request, response) => {
    const auth = principal(request);
    const kind = request.params.kind as ReportKind;
    if (!REPORT_KINDS.includes(kind)) throw new ApiError(404, 'Unknown report kind.');
    const data = await fetchReportData(prisma, piiHashKey, kind, auth, request);
    response.json({ success: true, data });
  });

  router.get('/:kind/export', async (request, response) => {
    const auth = principal(request);
    const kind = request.params.kind as ReportKind;
    const format = queryString(request.query.format);
    if (!REPORT_KINDS.includes(kind)) throw new ApiError(404, 'Unknown report kind.');
    if (format !== 'csv') {
      throw new ApiError(422, 'Only CSV export is available at this time.');
    }
    const data = await fetchReportData(prisma, piiHashKey, kind, auth, request);
    if (!data) throw new ApiError(404, 'No report data was found.');
    const rows = csvRowsFor(kind, data as Record<string, unknown>);
    const filename = `zorfly-${kind}-report-${new Date().toISOString().slice(0, 10)}.csv`;
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    response.send(toCsv(rows));
  });

  router.use('/settings', (request, _response, next) => {
    if (request.auth?.role !== roles.companyAdmin) {
      next(new ApiError(403, 'Only the Company Admin can manage report settings.'));
      return;
    }
    next();
  });

  router.get('/settings/recipients', async (request, response) => {
    const auth = principal(request);
    const admins = await prisma.tenantMembership.findMany({
      where: {
        tenantId: auth.tenantId,
        status: MembershipStatus.ACTIVE,
        deletedAt: null,
        roles: { some: { role: { key: roles.companyAdmin } } }
      },
      include: { user: true }
    });
    const row = await settingsRow(prisma, auth.tenantId, auth.userId);
    response.json({
      success: true,
      data: {
        companyAdmins: admins.map((admin) => ({
          fullName: admin.user.displayName ?? admin.user.emailCanonical,
          email: admin.user.emailCanonical
        })),
        recipients: recipientsOf(row.recipients)
      }
    });
  });

  router.post('/settings/recipients', validate(addRecipientSchema), async (request, response) => {
    const auth = principal(request);
    if (auth.role !== roles.companyAdmin) {
      throw new ApiError(403, 'Only the Company Admin can manage report settings.');
    }
    const input = request.body as AddRecipientInput;
    const row = await settingsRow(prisma, auth.tenantId, auth.userId);
    const recipients = recipientsOf(row.recipients);
    if (recipients.some((entry) => entry.email === input.email)) {
      throw new ApiError(409, 'This email is already a recipient.');
    }
    const entry: RecipientEntry = {
      id: randomUUID(),
      email: input.email,
      reportTypes: input.reportTypes,
      active: true
    };
    await prisma.reportDefinition.update({
      where: { id: row.id },
      data: { recipients: [entry, ...recipients] as unknown as Prisma.InputJsonValue }
    });
    response
      .status(201)
      .json({ success: true, data: { id: entry.id, message: 'Recipient added successfully.' } });
  });

  router.patch(
    '/settings/recipients/:id',
    validate(updateRecipientSchema),
    async (request, response) => {
      const auth = principal(request);
      if (auth.role !== roles.companyAdmin) {
        throw new ApiError(403, 'Only the Company Admin can manage report settings.');
      }
      const input = request.body as UpdateRecipientInput;
      const row = await settingsRow(prisma, auth.tenantId, auth.userId);
      const recipients = recipientsOf(row.recipients);
      const index = recipients.findIndex((entry) => entry.id === request.params.id);
      if (index === -1) throw new ApiError(404, 'The requested recipient was not found.');
      const current = recipients[index];
      if (!current) throw new ApiError(404, 'The requested recipient was not found.');
      recipients[index] = {
        ...current,
        reportTypes: input.reportTypes ?? current.reportTypes,
        active: input.active ?? current.active
      };
      await prisma.reportDefinition.update({
        where: { id: row.id },
        data: { recipients: recipients as unknown as Prisma.InputJsonValue }
      });
      response.json({ success: true, data: { message: 'Recipient updated successfully.' } });
    }
  );

  router.delete('/settings/recipients/:id', async (request, response) => {
    const auth = principal(request);
    if (auth.role !== roles.companyAdmin) {
      throw new ApiError(403, 'Only the Company Admin can manage report settings.');
    }
    const row = await settingsRow(prisma, auth.tenantId, auth.userId);
    const recipients = recipientsOf(row.recipients);
    const next = recipients.filter((entry) => entry.id !== request.params.id);
    if (next.length === recipients.length) {
      throw new ApiError(404, 'The requested recipient was not found.');
    }
    await prisma.reportDefinition.update({ where: { id: row.id }, data: { recipients: next as unknown as Prisma.InputJsonValue } });
    response.json({ success: true, data: { message: 'Recipient removed successfully.' } });
  });

  router.get('/settings/schedule', async (request, response) => {
    const auth = principal(request);
    const tenant = await prisma.tenant.findUnique({ where: { id: auth.tenantId } });
    const row = await settingsRow(prisma, auth.tenantId, auth.userId);
    const schedule =
      typeof row.schedule === 'object' && row.schedule !== null && !Array.isArray(row.schedule)
        ? (row.schedule as Record<string, unknown>)
        : { frequency: 'weekly', dayOfWeek: 1, sendHour: 8, sendMinute: 0, active: false };
    response.json({ success: true, data: { ...schedule, timeZone: tenant?.timeZone ?? 'UTC' } });
  });

  router.patch('/settings/schedule', validate(scheduleUpdateSchema), async (request, response) => {
    const auth = principal(request);
    if (auth.role !== roles.companyAdmin) {
      throw new ApiError(403, 'Only the Company Admin can manage report settings.');
    }
    const input = request.body as ScheduleUpdateInput;
    const row = await settingsRow(prisma, auth.tenantId, auth.userId);
    const schedule = { ...input, lastSentCycleKey: null };
    await prisma.reportDefinition.update({ where: { id: row.id }, data: { schedule } });
    const tenant = await prisma.tenant.findUnique({ where: { id: auth.tenantId } });
    response.json({
      success: true,
      data: {
        ...schedule,
        timeZone: tenant?.timeZone ?? 'UTC',
        message: 'Report schedule saved successfully.'
      }
    });
  });

  return router;
}

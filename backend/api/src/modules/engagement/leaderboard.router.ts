import { Router, type Request } from 'express';
import {
  AttemptMode,
  AttemptStatus,
  MembershipStatus,
  type ZorflyPrismaClient
} from '@zorfly/database';
import { ApiError } from '../../platform/api-error.js';
import { createRequireAuth, createRequirePermission } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { SessionPrincipal } from '../auth/auth.types.js';
import type { TokenService } from '../auth/tokens.js';

function principal(request: Request): SessionPrincipal & { tenantId: string } {
  if (!request.auth?.tenantId) throw new ApiError(401, 'Authentication is required.');
  return { ...request.auth, tenantId: request.auth.tenantId };
}

function queryString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function periodStart(period: string): Date | null {
  if (period === 'weekly' || period === 'monthly') {
    const start = new Date();
    start.setDate(start.getDate() - (period === 'weekly' ? 7 : 30));
    return start;
  }
  return null;
}

export interface LeaderboardRow {
  rank: number;
  userId: string;
  fullName: string;
  department: string;
  team: string;
  attempts: number;
  scorePercentage: number;
  accuracy: number;
  avgSecPerQuestion: number;
  points: number;
  composite: number;
}

const SUBMITTED_ATTEMPT_STATUSES = [
  AttemptStatus.SUBMITTED,
  AttemptStatus.NEEDS_REVIEW,
  AttemptStatus.EVALUATED,
  AttemptStatus.PUBLISHED
];

function object(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function number(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export async function computeLeaderboard(
  prisma: ZorflyPrismaClient,
  tenantId: string,
  scope: string,
  scopeId: string,
  period: string
): Promise<{ rows: LeaderboardRow[]; totalCount: number }> {
  const memberWhere = {
    tenantId,
    status: MembershipStatus.ACTIVE,
    deletedAt: null,
    ...(scope === 'department' && scopeId ? { departmentId: scopeId } : {}),
    ...(scope === 'team' && scopeId ? { teams: { some: { teamId: scopeId, endsAt: null } } } : {})
  };
  const memberships = await prisma.tenantMembership.findMany({
    where: memberWhere,
    include: {
      user: true,
      department: true,
      teams: { where: { endsAt: null }, take: 1, include: { team: true } }
    }
  });
  const membershipIds = memberships.map((membership) => membership.id);
  const start = periodStart(period);

  const attempts = await prisma.assessmentAttempt.findMany({
    where: {
      tenantId,
      membershipId: { in: membershipIds },
      mode: AttemptMode.OFFICIAL,
      status: { in: SUBMITTED_ATTEMPT_STATUSES },
      ...(start ? { submittedAt: { gte: start } } : {})
    },
    select: {
      membershipId: true,
      percentage: true,
      durationSeconds: true,
      resultSummary: true
    }
  });

  const pointsGroups = await prisma.rewardPointLedger.groupBy({
    by: ['membershipId'],
    where: { tenantId, membershipId: { in: membershipIds } },
    _sum: { points: true }
  });
  const pointsByMembership = new Map(
    pointsGroups.map((group) => [group.membershipId, group._sum.points ?? 0])
  );

  interface Stats {
    percentageSum: number;
    accuracySum: number;
    timeSum: number;
    questionCount: number;
    attempts: number;
  }
  const statsByMembership = new Map<string, Stats>();
  for (const attempt of attempts) {
    if (!attempt.membershipId) continue;
    const stats = statsByMembership.get(attempt.membershipId) ?? {
      percentageSum: 0,
      accuracySum: 0,
      timeSum: 0,
      questionCount: 0,
      attempts: 0
    };
    const summary = object(attempt.resultSummary);
    const perQuestion = Array.isArray(summary.perQuestion) ? summary.perQuestion : [];
    stats.percentageSum += attempt.percentage ? Number(attempt.percentage) : 0;
    stats.accuracySum += number(summary.accuracy);
    stats.timeSum += attempt.durationSeconds ?? 0;
    stats.questionCount += perQuestion.length;
    stats.attempts += 1;
    statsByMembership.set(attempt.membershipId, stats);
  }

  const maxAttempts = Math.max(1, ...[...statsByMembership.values()].map((s) => s.attempts));

  const rows = memberships
    .map((membership) => {
      const stats = statsByMembership.get(membership.id);
      if (!stats) return null;
      const scorePct = stats.percentageSum / stats.attempts;
      const accuracy = stats.accuracySum / stats.attempts;
      const avgSecPerQuestion = stats.questionCount > 0 ? stats.timeSum / stats.questionCount : 0;
      const speedScore = Math.max(0, 100 - (Math.min(avgSecPerQuestion, 120) / 120) * 100);
      const consistency = (stats.attempts / maxAttempts) * 100;
      const composite = scorePct * 0.5 + accuracy * 0.3 + speedScore * 0.1 + consistency * 0.1;
      return {
        userId: membership.userId,
        fullName: membership.user.displayName ?? membership.user.emailCanonical,
        department: membership.department?.name ?? '',
        team: membership.teams[0]?.team.name ?? '',
        attempts: stats.attempts,
        scorePercentage: Math.round(scorePct * 100) / 100,
        accuracy: Math.round(accuracy * 100) / 100,
        avgSecPerQuestion: Math.round(avgSecPerQuestion),
        points: pointsByMembership.get(membership.id) ?? 0,
        composite: Math.round(composite * 100) / 100
      };
    })
    .filter((row): row is Omit<LeaderboardRow, 'rank'> => row !== null)
    .sort((a, b) => b.composite - a.composite)
    .slice(0, 100)
    .map((row, index) => ({ rank: index + 1, ...row }));

  return { rows, totalCount: rows.length };
}

export function createLeaderboardRouter(
  prisma: ZorflyPrismaClient,
  service: AuthService,
  tokens: TokenService
): Router {
  const router = Router();
  router.use(createRequireAuth(tokens));
  router.use(createRequirePermission(service, 'leaderboard:read'));

  router.get('/', async (request, response) => {
    const auth = principal(request);
    const scope = queryString(request.query.scope) || 'company';
    const scopeId = queryString(request.query.scopeId);
    const period = queryString(request.query.period) || 'all';
    const { rows, totalCount } = await computeLeaderboard(
      prisma,
      auth.tenantId,
      scope,
      scopeId,
      period
    );
    const myRank = rows.find((row) => row.userId === auth.userId)?.rank ?? null;
    response.json({ success: true, data: { rows, totalCount, myRank } });
  });

  return router;
}

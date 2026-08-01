import {
  ApplicationStatus,
  AttemptMode,
  AttemptStatus,
  MembershipStatus,
  type ZorflyPrismaClient
} from '@zorfly/database';
import { computeLeaderboard } from '../engagement/leaderboard.router.js';
import { decryptPii } from '../recruitment/pii.js';

const SUBMITTED_STATUSES = [
  AttemptStatus.SUBMITTED,
  AttemptStatus.NEEDS_REVIEW,
  AttemptStatus.EVALUATED,
  AttemptStatus.PUBLISHED
];

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function resultSummaryOf(value: unknown): { accuracy: number; detectionRate: number | null } {
  const object =
    typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    accuracy: typeof object.accuracy === 'number' ? object.accuracy : 0,
    detectionRate: typeof object.detectionRate === 'number' ? object.detectionRate : null
  };
}

interface AttemptStat {
  percentage: unknown;
  resultSummary: unknown;
}

function averages(attempts: readonly AttemptStat[]) {
  if (attempts.length === 0) return { avgPercentage: null, avgAccuracy: null, avgDetection: null };
  let sumPercentage = 0;
  let sumAccuracy = 0;
  const detectionValues: number[] = [];
  for (const attempt of attempts) {
    sumPercentage += attempt.percentage ? Number(attempt.percentage) : 0;
    const summary = resultSummaryOf(attempt.resultSummary);
    sumAccuracy += summary.accuracy;
    if (summary.detectionRate !== null) detectionValues.push(summary.detectionRate);
  }
  return {
    avgPercentage: round2(sumPercentage / attempts.length),
    avgAccuracy: round2(sumAccuracy / attempts.length),
    avgDetection:
      detectionValues.length > 0
        ? round2(detectionValues.reduce((sum, value) => sum + value, 0) / detectionValues.length)
        : null
  };
}

async function categoryBreakdown(
  prisma: ZorflyPrismaClient,
  tenantId: string,
  attemptIds: bigint[]
): Promise<Array<{ categoryId: string; category: string; percentage: number }>> {
  if (attemptIds.length === 0) return [];
  const grouped = await prisma.attemptCategoryResult.groupBy({
    by: ['categoryId'],
    where: { tenantId, attemptId: { in: attemptIds } },
    _sum: { scored: true, possible: true }
  });
  const categories = await prisma.assessmentCategory.findMany({
    where: { id: { in: grouped.map((entry) => entry.categoryId) } }
  });
  const nameById = new Map(categories.map((category) => [category.id, category.name]));
  return grouped
    .map((entry) => {
      const possible = Number(entry._sum.possible ?? 0);
      const scored = Number(entry._sum.scored ?? 0);
      return {
        categoryId: entry.categoryId,
        category: nameById.get(entry.categoryId) ?? 'Uncategorised',
        percentage: possible > 0 ? round2((scored / possible) * 100) : 0
      };
    })
    .sort((a, b) => b.percentage - a.percentage);
}

export async function individualReport(
  prisma: ZorflyPrismaClient,
  tenantId: string,
  membershipId: string
) {
  const membership = await prisma.tenantMembership.findFirst({
    where: { id: membershipId, tenantId },
    include: {
      user: true,
      department: true,
      teams: { where: { endsAt: null }, take: 1, include: { team: true } }
    }
  });
  if (!membership) return null;
  const attempts = await prisma.assessmentAttempt.findMany({
    where: {
      tenantId,
      membershipId,
      mode: AttemptMode.OFFICIAL,
      status: { in: SUBMITTED_STATUSES }
    },
    orderBy: { submittedAt: 'asc' },
    select: { id: true, percentage: true, passed: true, resultSummary: true, submittedAt: true }
  });
  const practiceCount = await prisma.assessmentAttempt.count({
    where: {
      tenantId,
      membershipId,
      mode: AttemptMode.PRACTICE,
      status: { in: SUBMITTED_STATUSES }
    }
  });
  const breakdown = await categoryBreakdown(
    prisma,
    tenantId,
    attempts.map((attempt) => attempt.id)
  );
  const passRate =
    attempts.length > 0
      ? round2((attempts.filter((attempt) => attempt.passed).length / attempts.length) * 100)
      : null;
  return {
    fullName: membership.user.displayName ?? membership.user.emailCanonical,
    email: membership.user.emailCanonical,
    department: membership.department?.name ?? '',
    team: membership.teams[0]?.team.name ?? '',
    testsAttempted: attempts.length,
    practiceTests: practiceCount,
    ...averages(attempts),
    passRate,
    strengths: breakdown.slice(0, 3),
    weaknesses: [...breakdown].reverse().slice(0, 3),
    subStrengths: [] as unknown[],
    subWeaknesses: [] as unknown[],
    trend: attempts.map((attempt) => ({
      date: attempt.submittedAt,
      percentage: attempt.percentage ? Number(attempt.percentage) : 0
    }))
  };
}

async function membershipsReport(
  prisma: ZorflyPrismaClient,
  tenantId: string,
  where: { departmentId?: string; teams?: { some: { teamId: string; endsAt: null } } }
) {
  const employees = await prisma.tenantMembership.findMany({
    where: { tenantId, status: MembershipStatus.ACTIVE, deletedAt: null, ...where },
    include: { user: true }
  });
  const membershipIds = employees.map((employee) => employee.id);
  const attempts = await prisma.assessmentAttempt.findMany({
    where: {
      tenantId,
      membershipId: { in: membershipIds },
      mode: AttemptMode.OFFICIAL,
      status: { in: SUBMITTED_STATUSES }
    },
    select: { membershipId: true, percentage: true, resultSummary: true }
  });
  const byMembership = new Map<string, AttemptStat[]>();
  for (const attempt of attempts) {
    if (!attempt.membershipId) continue;
    const list = byMembership.get(attempt.membershipId) ?? [];
    list.push(attempt);
    byMembership.set(attempt.membershipId, list);
  }
  const members = employees
    .map((employee) => {
      const theirAttempts = byMembership.get(employee.id) ?? [];
      return {
        employeeId: employee.id,
        fullName: employee.user.displayName ?? employee.user.emailCanonical,
        attempts: theirAttempts.length,
        ...averages(theirAttempts)
      };
    })
    .sort((a, b) => (b.avgPercentage ?? 0) - (a.avgPercentage ?? 0));
  return {
    employees,
    attempts,
    members,
    participationRate:
      employees.length > 0 ? round2((byMembership.size / employees.length) * 100) : null
  };
}

export async function teamReport(prisma: ZorflyPrismaClient, tenantId: string, teamId: string) {
  const team = await prisma.team.findFirst({ where: { id: teamId, tenantId } });
  if (!team) return null;
  const { employees, attempts, members, participationRate } = await membershipsReport(
    prisma,
    tenantId,
    { teams: { some: { teamId, endsAt: null } } }
  );
  return {
    teamName: team.name,
    teamSize: employees.length,
    totalAttempts: attempts.length,
    participationRate,
    ...averages(attempts),
    members
  };
}

export async function departmentReport(
  prisma: ZorflyPrismaClient,
  tenantId: string,
  departmentId: string
) {
  const department = await prisma.department.findFirst({ where: { id: departmentId, tenantId } });
  if (!department) return null;
  const { employees, attempts, members, participationRate } = await membershipsReport(
    prisma,
    tenantId,
    { departmentId }
  );
  return {
    departmentName: department.name,
    totalEmployees: employees.length,
    totalAttempts: attempts.length,
    participationRate,
    ...averages(attempts),
    members
  };
}

export async function recruitmentDriveReport(
  prisma: ZorflyPrismaClient,
  tenantId: string,
  driveId: string,
  piiHashKey: string
) {
  const drive = await prisma.recruitmentDrive.findFirst({
    where: { id: driveId, tenantId },
    include: {
      stages: {
        orderBy: { stageOrder: 'asc' },
        take: 1,
        include: { assessmentVersion: { include: { assessment: true } } }
      }
    }
  });
  if (!drive) return null;
  const applications = await prisma.candidateApplication.findMany({
    where: { tenantId, driveId },
    include: {
      candidate: true,
      attempts: {
        where: { mode: AttemptMode.RECRUITMENT },
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  });
  const ranked = applications
    .filter((application) => application.completedAt)
    .map((application) => {
      const attempt = application.attempts[0];
      return {
        fullName: decryptPii(piiHashKey, application.candidate.fullNameCiphertext),
        email: decryptPii(piiHashKey, application.candidate.emailCiphertext),
        status: application.status,
        percentage: attempt?.percentage ? Number(attempt.percentage) : 0,
        timeTakenSec: attempt?.durationSeconds ?? 0
      };
    })
    .sort((a, b) => b.percentage - a.percentage || a.timeTakenSec - b.timeTakenSec)
    .map((row, index) => ({ rank: index + 1, ...row }));
  const completed = applications.filter((application) => application.completedAt).length;
  const shortlisted = applications.filter(
    (application) =>
      application.status === ApplicationStatus.SHORTLISTED ||
      application.status === ApplicationStatus.HIRED
  ).length;
  return {
    driveTitle: drive.title,
    testTitle: drive.stages[0]?.assessmentVersion.assessment.title ?? '',
    status: drive.status,
    totalCandidates: applications.length,
    completed,
    successRate: completed > 0 ? round2((shortlisted / completed) * 100) : 0,
    candidates: ranked
  };
}

export async function growthTrend(
  prisma: ZorflyPrismaClient,
  tenantId: string,
  options: { months?: number; departmentId?: string; membershipId?: string } = {}
) {
  const where: {
    tenantId: string;
    mode: AttemptMode;
    status: { in: AttemptStatus[] };
    membershipId?: string | { in: string[] };
  } = {
    tenantId,
    mode: AttemptMode.OFFICIAL,
    status: { in: SUBMITTED_STATUSES }
  };
  if (options.membershipId) {
    where.membershipId = options.membershipId;
  } else if (options.departmentId) {
    const members = await prisma.tenantMembership.findMany({
      where: { tenantId, departmentId: options.departmentId },
      select: { id: true }
    });
    where.membershipId = { in: members.map((member) => member.id) };
  }
  const attempts = await prisma.assessmentAttempt.findMany({
    where,
    select: { submittedAt: true, percentage: true },
    orderBy: { submittedAt: 'asc' }
  });
  const monthCount = Math.max(1, Math.min(24, options.months ?? 6));
  const now = new Date();
  const buckets: Array<{ key: string; label: string; sum: number; attempts: number }> = [];
  for (let i = monthCount - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${String(date.getFullYear())}-${String(date.getMonth())}`,
      label:
        monthCount > 12
          ? date.toLocaleString('en-GB', { month: 'short', year: '2-digit' })
          : date.toLocaleString('en-GB', { month: 'short' }),
      sum: 0,
      attempts: 0
    });
  }
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  for (const attempt of attempts) {
    if (!attempt.submittedAt) continue;
    const key = `${String(attempt.submittedAt.getFullYear())}-${String(attempt.submittedAt.getMonth())}`;
    const bucket = byKey.get(key);
    if (bucket) {
      bucket.sum += attempt.percentage ? Number(attempt.percentage) : 0;
      bucket.attempts += 1;
    }
  }
  return buckets.map((bucket) => ({
    label: bucket.label,
    avgPercentage: bucket.attempts > 0 ? round2(bucket.sum / bucket.attempts) : 0,
    attempts: bucket.attempts
  }));
}

export async function companyPerformanceReport(
  prisma: ZorflyPrismaClient,
  tenantId: string,
  params: { period?: string; month?: string; year?: string }
) {
  const now = new Date();
  let periodLabel = 'All Time';
  let submittedAt: { gte: Date; lt: Date } | undefined;
  if (params.period === 'monthly') {
    const year = params.year ? Number(params.year) : now.getFullYear();
    const month = params.month !== undefined ? Number(params.month) : now.getMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 1);
    submittedAt = { gte: start, lt: end };
    periodLabel = start.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
  } else if (params.period === 'annual') {
    const year = params.year ? Number(params.year) : now.getFullYear();
    submittedAt = { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) };
    periodLabel = String(year);
  }

  const [attempts, employees] = await Promise.all([
    prisma.assessmentAttempt.findMany({
      where: {
        tenantId,
        mode: AttemptMode.OFFICIAL,
        status: { in: SUBMITTED_STATUSES },
        ...(submittedAt ? { submittedAt } : {})
      },
      select: { membershipId: true, percentage: true, resultSummary: true }
    }),
    prisma.tenantMembership.findMany({
      where: { tenantId, status: MembershipStatus.ACTIVE, deletedAt: null },
      include: { user: true, department: true }
    })
  ]);

  const byMembership = new Map<string, AttemptStat[]>();
  for (const attempt of attempts) {
    if (!attempt.membershipId) continue;
    const list = byMembership.get(attempt.membershipId) ?? [];
    list.push(attempt);
    byMembership.set(attempt.membershipId, list);
  }

  const performers = employees
    .map((employee) => {
      const theirAttempts = byMembership.get(employee.id) ?? [];
      return {
        employeeId: employee.id,
        fullName: employee.user.displayName ?? employee.user.emailCanonical,
        department: employee.department?.name ?? '',
        attempts: theirAttempts.length,
        avgPercentage: averages(theirAttempts).avgPercentage
      };
    })
    .filter((entry) => entry.attempts > 0)
    .sort((a, b) => (b.avgPercentage ?? 0) - (a.avgPercentage ?? 0));

  const companyAvg = averages(attempts).avgPercentage ?? 0;
  const deptStats = new Map<
    string,
    {
      sum: number;
      count: number;
      employees: number;
      participated: number;
      topName: string;
      topAvg: number;
    }
  >();
  for (const employee of employees) {
    const departmentName = employee.department?.name ?? 'Unassigned';
    const theirAttempts = byMembership.get(employee.id) ?? [];
    const stat = deptStats.get(departmentName) ?? {
      sum: 0,
      count: 0,
      employees: 0,
      participated: 0,
      topName: '',
      topAvg: -1
    };
    stat.employees += 1;
    if (theirAttempts.length > 0) stat.participated += 1;
    for (const attempt of theirAttempts) {
      stat.sum += attempt.percentage ? Number(attempt.percentage) : 0;
      stat.count += 1;
    }
    const empAvg =
      theirAttempts.length > 0
        ? theirAttempts.reduce(
            (sum, attempt) => sum + (attempt.percentage ? Number(attempt.percentage) : 0),
            0
          ) / theirAttempts.length
        : -1;
    if (empAvg > stat.topAvg) {
      stat.topAvg = empAvg;
      stat.topName = employee.user.displayName ?? employee.user.emailCanonical;
    }
    deptStats.set(departmentName, stat);
  }
  const departmentAverages = [...deptStats.entries()].map(([department, stat]) => ({
    department,
    avgPercentage: stat.count > 0 ? round2(stat.sum / stat.count) : null,
    participation: stat.employees > 0 ? Math.round((stat.participated / stat.employees) * 100) : 0,
    topPerformer: stat.topName || '—',
    trend: stat.count > 0 && stat.sum / stat.count >= companyAvg ? 'up' : 'down'
  }));

  const trend = await growthTrend(prisma, tenantId, {
    months: params.period === 'annual' ? 12 : 6
  });

  return {
    period: periodLabel,
    totalEmployees: employees.length,
    totalAttempts: attempts.length,
    participationRate:
      employees.length > 0 ? round2((byMembership.size / employees.length) * 100) : null,
    ...averages(attempts),
    departmentAverages,
    topPerformers: performers.slice(0, 5),
    needsAttention: [...performers].reverse().slice(0, 5),
    trend
  };
}

export async function leaderboardReport(
  prisma: ZorflyPrismaClient,
  tenantId: string,
  params: { scope?: string; scopeId?: string; period?: string }
) {
  return computeLeaderboard(
    prisma,
    tenantId,
    params.scope ?? 'company',
    params.scopeId ?? '',
    params.period ?? 'all'
  );
}

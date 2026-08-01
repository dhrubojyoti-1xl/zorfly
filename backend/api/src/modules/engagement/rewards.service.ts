import { randomBytes } from 'node:crypto';
import {
  AttemptMode,
  AttemptStatus,
  CertificateStatus,
  LedgerEntryType,
  Prisma,
  RecordStatus,
  type ZorflyPrismaClient
} from '@zorfly/database';
import type { AuthService } from '../auth/auth.service.js';

const DEFAULT_CERTIFICATE_TEMPLATE_CODE = 'default';

const SUBMITTED_ATTEMPT_STATUSES = [
  AttemptStatus.SUBMITTED,
  AttemptStatus.NEEDS_REVIEW,
  AttemptStatus.EVALUATED,
  AttemptStatus.PUBLISHED
];

export interface BadgeRule {
  ruleType: 'tests_count' | 'score_percent' | 'perfect' | 'detection_percent';
  threshold: number;
  points: number;
  icon: string;
}

export function ruleOf(value: Prisma.JsonValue): BadgeRule {
  const object =
    typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const ruleType =
    object.ruleType === 'tests_count' ||
    object.ruleType === 'score_percent' ||
    object.ruleType === 'perfect' ||
    object.ruleType === 'detection_percent'
      ? object.ruleType
      : 'score_percent';
  return {
    ruleType,
    threshold: typeof object.threshold === 'number' ? object.threshold : 0,
    points: typeof object.points === 'number' ? object.points : 0,
    icon: typeof object.icon === 'string' ? object.icon : '🏅'
  };
}

async function awardPoints(
  prisma: ZorflyPrismaClient,
  tenantId: string,
  membershipId: string,
  points: number,
  sourceType: string,
  sourceId: string,
  idempotencyKey: string
): Promise<void> {
  const existing = await prisma.rewardPointLedger.findUnique({
    where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } }
  });
  if (existing) return;
  const balance = await prisma.rewardPointLedger.aggregate({
    where: { tenantId, membershipId },
    _sum: { points: true }
  });
  const balanceAfter = (balance._sum.points ?? 0) + points;
  await prisma.rewardPointLedger.create({
    data: {
      tenantId,
      membershipId,
      entryType: LedgerEntryType.EARN,
      points,
      balanceAfter,
      sourceType,
      sourceId,
      idempotencyKey,
      occurredAt: new Date()
    }
  });
}

export interface RewardsEvaluationInput {
  tenantId: string;
  membershipId: string;
  attemptPublicId: string;
  mode: AttemptMode;
  percentage: number;
  passed: boolean;
  detectionRate: number | null;
  userEmail: string;
  userName: string | null;
}

/** Points + badge evaluation (RWD-01/02), run after every official submission. Never throws. */
export async function evaluateRewards(
  prisma: ZorflyPrismaClient,
  service: AuthService,
  input: RewardsEvaluationInput
): Promise<void> {
  if (input.mode !== AttemptMode.OFFICIAL) return;
  const basePoints = Math.round(input.percentage / 10) + (input.passed ? 5 : 0);
  if (basePoints > 0) {
    await awardPoints(
      prisma,
      input.tenantId,
      input.membershipId,
      basePoints,
      'attempt',
      input.attemptPublicId,
      `attempt:${input.attemptPublicId}:base`
    );
  }

  const [badges, submittedCount, existingAwards] = await Promise.all([
    prisma.badgeDefinition.findMany({
      where: { tenantId: input.tenantId, status: RecordStatus.ACTIVE, deletedAt: null }
    }),
    prisma.assessmentAttempt.count({
      where: {
        tenantId: input.tenantId,
        membershipId: input.membershipId,
        mode: AttemptMode.OFFICIAL,
        status: { in: SUBMITTED_ATTEMPT_STATUSES }
      }
    }),
    prisma.badgeAward.findMany({
      where: { tenantId: input.tenantId, membershipId: input.membershipId },
      select: { badgeId: true }
    })
  ]);
  const alreadyEarned = new Set(existingAwards.map((award) => award.badgeId));

  for (const badge of badges) {
    if (alreadyEarned.has(badge.id)) continue;
    const rule = ruleOf(badge.rule);
    let earned = false;
    if (rule.ruleType === 'tests_count') earned = submittedCount >= rule.threshold;
    if (rule.ruleType === 'score_percent') earned = input.percentage >= rule.threshold;
    if (rule.ruleType === 'perfect') earned = input.percentage >= 100;
    if (rule.ruleType === 'detection_percent') {
      earned = input.detectionRate !== null && input.detectionRate >= rule.threshold;
    }
    if (!earned) continue;

    try {
      await prisma.badgeAward.create({
        data: {
          tenantId: input.tenantId,
          badgeId: badge.id,
          membershipId: input.membershipId,
          sourceType: 'attempt',
          sourceId: input.attemptPublicId,
          evidence: { percentage: input.percentage, detectionRate: input.detectionRate }
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') continue;
      throw error;
    }
    if (rule.points > 0) {
      await awardPoints(
        prisma,
        input.tenantId,
        input.membershipId,
        rule.points,
        'badge',
        badge.id,
        `badge:${badge.id}:${input.attemptPublicId}`
      );
    }
    service.sendNotification({
      to: input.userEmail,
      subject: `Badge earned: ${badge.name}`,
      html: `<p>${rule.icon} Congratulations! You earned the "${badge.name}" badge${rule.points ? ` and ${String(rule.points)} points` : ''}. ${badge.description ?? ''}</p>`,
      type: 'badge_earned',
      tenantId: input.tenantId,
      membershipId: input.membershipId,
      title: `Badge earned: ${badge.name}`,
      body: `${rule.icon} You earned the "${badge.name}" badge${rule.points ? ` and ${String(rule.points)} points` : ''}.`,
      link: '/app/badges'
    });
  }
}

export interface RewardsSummary {
  totalPoints: number;
  badges: Array<{
    id: string;
    name: string;
    icon: string;
    description: string;
    earnedAt: Date;
  }>;
}

export async function rewardsSummary(
  prisma: ZorflyPrismaClient,
  tenantId: string,
  membershipId: string
): Promise<RewardsSummary> {
  const [awards, balance] = await Promise.all([
    prisma.badgeAward.findMany({
      where: { tenantId, membershipId },
      include: { badge: true },
      orderBy: { awardedAt: 'desc' }
    }),
    prisma.rewardPointLedger.aggregate({
      where: { tenantId, membershipId },
      _sum: { points: true }
    })
  ]);
  return {
    totalPoints: balance._sum.points ?? 0,
    badges: awards.map((award) => {
      const rule = ruleOf(award.badge.rule);
      return {
        id: award.badge.id,
        name: award.badge.name,
        icon: rule.icon,
        description: award.badge.description ?? '',
        earnedAt: award.awardedAt
      };
    })
  };
}

async function defaultCertificateTemplate(prisma: ZorflyPrismaClient, tenantId: string) {
  return prisma.certificateTemplate.upsert({
    where: { tenantId_code: { tenantId, code: DEFAULT_CERTIFICATE_TEMPLATE_CODE } },
    create: {
      tenantId,
      code: DEFAULT_CERTIFICATE_TEMPLATE_CODE,
      name: 'Assessment Completion Certificate',
      template: { layout: 'standard' },
      status: RecordStatus.ACTIVE
    },
    update: {}
  });
}

function certificateSerial(): string {
  return `ZF-${randomBytes(5).toString('hex').toUpperCase()}`;
}

export interface CertificateIssuanceInput {
  tenantId: string;
  membershipId: string;
  attemptId: bigint;
  assessmentId: string;
  assessmentTitle: string;
  employeeName: string;
  percentage: number;
  passed: boolean;
  mode: AttemptMode;
}

/** Auto-issues a certificate on the employee's first pass of an assessment (once per test). Never throws. */
export async function issueCertificateIfPassed(
  prisma: ZorflyPrismaClient,
  input: CertificateIssuanceInput
): Promise<void> {
  if (input.mode !== AttemptMode.OFFICIAL || !input.passed) return;
  const existing = await prisma.certificate.findFirst({
    where: {
      tenantId: input.tenantId,
      membershipId: input.membershipId,
      assessmentId: input.assessmentId
    }
  });
  if (existing) return;
  const template = await defaultCertificateTemplate(prisma, input.tenantId);
  try {
    await prisma.certificate.create({
      data: {
        tenantId: input.tenantId,
        templateId: template.id,
        membershipId: input.membershipId,
        assessmentAttemptId: input.attemptId,
        assessmentId: input.assessmentId,
        verificationCode: certificateSerial(),
        status: CertificateStatus.ISSUED,
        issuedAt: new Date(),
        snapshot: {
          title: input.assessmentTitle,
          employeeName: input.employeeName,
          percentage: input.percentage
        }
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return;
    throw error;
  }
}

import { Router, type Request } from 'express';
import { z } from 'zod';
import {
  CouponDiscountType,
  MembershipStatus,
  RecordStatus,
  SubscriptionStatus,
  type ZorflyPrismaClient
} from '@zorfly/database';
import { ApiError } from '../../platform/api-error.js';
import { validate } from '../../platform/validate.js';
import { createRequireAuth, createRequirePermission } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { RequestContext, SessionPrincipal } from '../auth/auth.types.js';
import type { TokenService } from '../auth/tokens.js';
import { subscribeSchema, type SubscribeInput } from './billing.validation.js';

const MONTH_MS = 30 * 24 * 3600 * 1000;

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  INR: '₹',
  EUR: '€',
  GBP: '£'
};

function symbolFor(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? `${currency} `;
}

function principal(request: Request): SessionPrincipal & { tenantId: string } {
  if (!request.auth?.tenantId) throw new ApiError(401, 'Authentication is required.');
  return { ...request.auth, tenantId: request.auth.tenantId };
}

function context(request: Request): RequestContext {
  const userAgent = request.headers['user-agent'];
  return {
    ...(request.ip ? { ip: request.ip } : {}),
    ...(typeof request.id === 'string' || typeof request.id === 'number'
      ? { requestId: String(request.id) }
      : {}),
    ...(typeof userAgent === 'string' ? { userAgent } : {})
  };
}

const planInclude = { entitlements: true } as const;

function planShape(
  plan: { id: string; name: string; currency: string; monthlyAmount: unknown; entitlements: Array<{ featureKey: string; enabled: boolean; limitValue: bigint | null }> },
  isCurrent: boolean
) {
  const limits: Record<string, number> = { maxEmployees: -1, maxTests: -1 };
  const features: string[] = [];
  for (const entitlement of plan.entitlements) {
    if (!entitlement.enabled) continue;
    if (entitlement.featureKey === 'max_employees') {
      limits.maxEmployees = entitlement.limitValue !== null ? Number(entitlement.limitValue) : -1;
    } else if (entitlement.featureKey === 'max_tests') {
      limits.maxTests = entitlement.limitValue !== null ? Number(entitlement.limitValue) : -1;
    } else {
      features.push(entitlement.featureKey);
    }
  }
  return {
    id: plan.id,
    name: plan.name,
    description: '',
    badge: '',
    limits,
    features,
    isCurrent,
    symbol: symbolFor(plan.currency),
    priceMonthly: Number(plan.monthlyAmount)
  };
}

function applyCoupon(
  coupon: { discountType: CouponDiscountType; discountValue: unknown },
  price: number
): number {
  const value = Number(coupon.discountValue);
  if (coupon.discountType === CouponDiscountType.PERCENT) {
    return Math.max(0, Math.round(price * (1 - value / 100) * 100) / 100);
  }
  return Math.max(0, Math.round((price - value) * 100) / 100);
}

async function findValidCoupon(prisma: ZorflyPrismaClient, code: string) {
  const coupon = await prisma.coupon.findFirst({
    where: {
      code: code.toUpperCase(),
      active: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
    }
  });
  if (!coupon) return null;
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) return null;
  return coupon;
}

export function createBillingRouter(
  prisma: ZorflyPrismaClient,
  service: AuthService,
  tokens: TokenService
): Router {
  const router = Router();
  router.use(createRequireAuth(tokens));
  router.use(createRequirePermission(service, 'billing:manage'));

  router.get('/', async (request, response) => {
    const auth = principal(request);
    const [plans, currentSubscription, employeeCount, testCount] = await Promise.all([
      prisma.subscriptionPlan.findMany({
        where: { status: RecordStatus.ACTIVE, deletedAt: null },
        include: planInclude,
        orderBy: { monthlyAmount: 'asc' }
      }),
      prisma.tenantSubscription.findFirst({
        where: { tenantId: auth.tenantId, status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] } },
        include: { plan: { include: planInclude } },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.tenantMembership.count({
        where: { tenantId: auth.tenantId, status: MembershipStatus.ACTIVE, deletedAt: null }
      }),
      prisma.assessmentDefinition.count({
        where: { tenantId: auth.tenantId, status: { not: 'ARCHIVED' }, deletedAt: null }
      })
    ]);
    const currentPlanId = currentSubscription?.plan.id ?? null;
    response.json({
      success: true,
      data: {
        country: 'IN',
        currentPlan: currentSubscription
          ? planShape(currentSubscription.plan, true)
          : null,
        usage: { employees: employeeCount, tests: testCount },
        plans: plans.map((plan) => planShape(plan, plan.id === currentPlanId))
      }
    });
  });

  router.get('/coupon/:code', async (request, response) => {
    const planId = z.uuid().safeParse(request.query.planId).data;
    if (!planId) throw new ApiError(422, 'Select a plan first.');
    const plan = await prisma.subscriptionPlan.findFirst({
      where: { id: planId, status: RecordStatus.ACTIVE, deletedAt: null }
    });
    if (!plan) throw new ApiError(422, 'Select a plan first.');
    const price = Number(plan.monthlyAmount);
    const coupon = await findValidCoupon(prisma, String(request.params.code ?? ''));
    if (!coupon) throw new ApiError(422, 'This coupon code is not valid.');
    const discounted = applyCoupon(coupon, price);
    response.json({
      success: true,
      data: {
        original: price,
        discounted,
        symbol: symbolFor(plan.currency),
        message: 'Coupon applied successfully.'
      }
    });
  });

  router.post('/subscribe', validate(subscribeSchema), async (request, response) => {
    const auth = principal(request);
    const input = request.body as SubscribeInput;
    const plan = await prisma.subscriptionPlan.findFirst({
      where: { id: input.planId, status: RecordStatus.ACTIVE, deletedAt: null }
    });
    if (!plan) throw new ApiError(404, 'The requested plan was not found.');
    const price = Number(plan.monthlyAmount);

    let finalPrice = price;
    let coupon: Awaited<ReturnType<typeof findValidCoupon>> = null;
    if (input.couponCode) {
      coupon = await findValidCoupon(prisma, input.couponCode);
      if (!coupon) {
        throw new ApiError(422, 'This coupon code is not valid.', {
          couponCode: 'This coupon code is not valid.'
        });
      }
      finalPrice = applyCoupon(coupon, price);
    }

    const now = new Date();
    await prisma.$transaction(async (transaction) => {
      await transaction.tenantSubscription.updateMany({
        where: {
          tenantId: auth.tenantId,
          status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] }
        },
        data: { status: SubscriptionStatus.CANCELLED, endedAt: now }
      });
      await transaction.tenantSubscription.create({
        data: {
          tenantId: auth.tenantId,
          planId: plan.id,
          status: SubscriptionStatus.ACTIVE,
          startsAt: now,
          currentPeriodStart: now,
          currentPeriodEnd: new Date(now.getTime() + MONTH_MS)
        }
      });
      if (coupon) {
        await transaction.coupon.update({
          where: { id: coupon.id },
          data: { usedCount: { increment: 1 } }
        });
      }
    });

    await service.recordAudit(
      {
        action: 'billing.subscribed',
        actorUserId: auth.userId,
        tenantId: auth.tenantId,
        entityType: 'tenant_subscription',
        entityId: plan.id,
        metadata: { plan: plan.name, pricePaid: finalPrice, currency: plan.currency, coupon: coupon?.code ?? null }
      },
      context(request)
    );

    response.json({
      success: true,
      data: {
        plan: plan.name,
        pricePaid: finalPrice,
        currency: plan.currency,
        message: `Subscribed to the ${plan.name} plan successfully.`
      }
    });
  });

  return router;
}

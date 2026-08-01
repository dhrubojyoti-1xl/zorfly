import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseApiEnvironment } from '@zorfly/config';
import {
  CouponDiscountType,
  RecordStatus,
  SubscriptionStatus,
  createPrismaClient,
  type ZorflyPrismaClient
} from '@zorfly/database';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { passwordHasher } from '../src/modules/auth/password.js';
import { PrismaAuthRepository } from '../src/modules/auth/prisma-auth.repository.js';
import { createTokenService } from '../src/modules/auth/tokens.js';

const connectionString = process.env.TEST_DATABASE_URL;
const integration = describe.runIf(Boolean(connectionString));
const prisma: ZorflyPrismaClient | null = connectionString
  ? createPrismaClient(connectionString)
  : null;

afterAll(async () => {
  await prisma?.$disconnect();
});

integration('Billing HTTP routes (PostgreSQL-backed)', () => {
  const context = { requestId: randomUUID(), ip: '127.0.0.1', userAgent: 'vitest' };

  let app: Express;
  let adminAuthorization: string;
  let tenantId: string;
  let planId: string;

  beforeAll(async () => {
    if (!prisma) throw new Error('TEST_DATABASE_URL is required.');
    const db = prisma;
    const suffix = randomUUID().slice(0, 8);

    const hashKey = 'integration-hash-key-with-at-least-32-characters';
    const signingKey = 'integration-signing-key-with-at-least-32-characters';
    const tokens = createTokenService({ signingKey, hashKey, accessTokenTtlSeconds: 900 });
    const authService = new AuthService({
      repository: new PrismaAuthRepository(db, hashKey),
      passwordHasher,
      tokens,
      mailer: { send: () => Promise.resolve() },
      refreshTokenTtlSeconds: 604_800,
      appUrl: 'http://localhost:5173'
    });
    const environment = parseApiEnvironment({
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL: connectionString,
      SESSION_SIGNING_KEY: signingKey,
      SESSION_HASH_KEY: hashKey
    });
    app = createApp({
      environment,
      version: 'test',
      auth: { service: authService, tokens },
      organization: { prisma: db }
    });

    const admin = await authService.registerCompany(
      {
        companyName: `Billing Co ${suffix}`,
        fullName: 'Tenant Admin',
        email: `billing-${suffix}@example.com`,
        password: 'correct-password',
        referralCode: ''
      },
      context
    );
    if (!admin.company) throw new Error('Expected a company.');
    adminAuthorization = `Bearer ${admin.accessToken}`;
    tenantId = admin.company.id;

    const plan = await db.subscriptionPlan.create({
      data: {
        code: `pro-${suffix}`,
        name: 'Pro',
        currency: 'USD',
        monthlyAmount: 100,
        annualAmount: 1000,
        status: RecordStatus.ACTIVE,
        entitlements: {
          create: [
            { featureKey: 'max_employees', enabled: true, limitValue: 50 },
            { featureKey: 'max_tests', enabled: true, limitValue: -1 },
            { featureKey: 'ai_generation', enabled: true }
          ]
        }
      }
    });
    planId = plan.id;

    await db.coupon.create({
      data: {
        code: `SAVE20-${suffix}`.toUpperCase(),
        discountType: CouponDiscountType.PERCENT,
        discountValue: 20,
        active: true
      }
    });
  }, 30_000);

  it('rejects unauthenticated requests', async () => {
    await request(app).get('/api/v1/billing').expect(401);
  });

  it('returns the plan catalogue with no current subscription', async () => {
    const response = await request(app)
      .get('/api/v1/billing')
      .set('authorization', adminAuthorization)
      .expect(200);
    const body = response.body as {
      data: {
        currentPlan: unknown;
        plans: Array<{
          id: string;
          name: string;
          priceMonthly: number;
          symbol: string;
          isCurrent: boolean;
          limits: { maxEmployees: number; maxTests: number };
          features: string[];
        }>;
      };
    };
    expect(body.data.currentPlan).toBeNull();
    const plan = body.data.plans.find((entry) => entry.id === planId);
    expect(plan).toBeDefined();
    expect(plan?.priceMonthly).toBe(100);
    expect(plan?.symbol).toBe('$');
    expect(plan?.isCurrent).toBe(false);
    expect(plan?.limits).toEqual({ maxEmployees: 50, maxTests: -1 });
    expect(plan?.features).toContain('ai_generation');
  });

  it('rejects an unknown or missing coupon', async () => {
    await request(app)
      .get('/api/v1/billing/coupon/DOES-NOT-EXIST')
      .set('authorization', adminAuthorization)
      .query({ planId })
      .expect(422);

    await request(app)
      .get('/api/v1/billing/coupon/ANYTHING')
      .set('authorization', adminAuthorization)
      .expect(422);
  });

  it('applies a valid coupon and subscribes, cancelling a prior subscription on resubscribe', async () => {
    if (!prisma) throw new Error('TEST_DATABASE_URL is required.');
    const coupon = await prisma.coupon.findFirstOrThrow({ where: { active: true } });

    const checked = await request(app)
      .get(`/api/v1/billing/coupon/${coupon.code}`)
      .set('authorization', adminAuthorization)
      .query({ planId })
      .expect(200);
    const checkedBody = checked.body as {
      data: { original: number; discounted: number; symbol: string };
    };
    expect(checkedBody.data.original).toBe(100);
    expect(checkedBody.data.discounted).toBe(80);

    const subscribed = await request(app)
      .post('/api/v1/billing/subscribe')
      .set('authorization', adminAuthorization)
      .send({ planId, couponCode: coupon.code })
      .expect(200);
    const subscribedBody = subscribed.body as {
      data: { plan: string; pricePaid: number; currency: string; message: string };
    };
    expect(subscribedBody.data.plan).toBe('Pro');
    expect(subscribedBody.data.pricePaid).toBe(80);
    expect(subscribedBody.data.currency).toBe('USD');

    const afterFirstSubscribe = await prisma.tenantSubscription.findMany({
      where: { tenantId }
    });
    expect(afterFirstSubscribe).toHaveLength(1);
    expect(afterFirstSubscribe[0]?.status).toBe(SubscriptionStatus.ACTIVE);

    const catalogue = await request(app)
      .get('/api/v1/billing')
      .set('authorization', adminAuthorization)
      .expect(200);
    const catalogueBody = catalogue.body as {
      data: { currentPlan: { id: string; isCurrent: boolean } | null };
    };
    expect(catalogueBody.data.currentPlan?.id).toBe(planId);
    expect(catalogueBody.data.currentPlan?.isCurrent).toBe(true);

    const usedCoupon = await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } });
    expect(usedCoupon.usedCount).toBe(1);

    await request(app)
      .post('/api/v1/billing/subscribe')
      .set('authorization', adminAuthorization)
      .send({ planId, couponCode: '' })
      .expect(200);

    const subscriptions = await prisma.tenantSubscription.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' }
    });
    expect(subscriptions).toHaveLength(2);
    expect(subscriptions[0]?.status).toBe(SubscriptionStatus.CANCELLED);
    expect(subscriptions[1]?.status).toBe(SubscriptionStatus.ACTIVE);
  });

  it('rejects subscribing to an unknown plan', async () => {
    await request(app)
      .post('/api/v1/billing/subscribe')
      .set('authorization', adminAuthorization)
      .send({ planId: randomUUID(), couponCode: '' })
      .expect(404);
  });
});

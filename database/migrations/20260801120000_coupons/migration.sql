CREATE TYPE "platform"."CouponDiscountType" AS ENUM ('PERCENT', 'FLAT');

CREATE TABLE "platform"."Coupon" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" VARCHAR(30) NOT NULL,
  "discountType" "platform"."CouponDiscountType" NOT NULL,
  "discountValue" DECIMAL(10,2) NOT NULL,
  "maxUses" INTEGER,
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "expiresAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Coupon_code_key" ON "platform"."Coupon"("code");

CREATE INDEX "Coupon_active_expiresAt_idx" ON "platform"."Coupon"("active", "expiresAt");

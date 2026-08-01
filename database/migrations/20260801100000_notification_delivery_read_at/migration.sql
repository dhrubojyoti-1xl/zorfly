ALTER TABLE "communications"."NotificationDelivery"
  ADD COLUMN "readAt" TIMESTAMPTZ(6);

CREATE INDEX "NotificationDelivery_tenantId_recipientMembershipId_readAt_idx"
  ON "communications"."NotificationDelivery"("tenantId", "recipientMembershipId", "readAt");

-- ARC PEM Web (app.arcpem.com): web plans, firm subscriptions, the outbox that pushes changes to the app, and
-- OpenID Connect authorization codes for owner sign-in. Purely additive: existing desktop plans default to DESKTOP.

ALTER TABLE "Plan" ADD COLUMN "product" TEXT NOT NULL DEFAULT 'DESKTOP',
ADD COLUMN "tier" TEXT;
CREATE INDEX "Plan_product_isActive_idx" ON "Plan"("product", "isActive");
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_product_check" CHECK ("product" IN ('DESKTOP', 'WEB'));
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_web_tier_check" CHECK (
  ("product" = 'WEB' AND "tier" IN ('SOLO', 'STUDIO', 'ENTERPRISE')) OR ("product" = 'DESKTOP' AND "tier" IS NULL)
);

CREATE TABLE "WebSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmName" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodEnd" TIMESTAMP(3),
    "seatLimit" INTEGER,
    "projectLimit" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WebSubscription_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WebSubscription_status_check" CHECK ("status" IN ('ACTIVE', 'PAST_DUE', 'EXPIRED', 'SUSPENDED', 'CANCELED')),
    CONSTRAINT "WebSubscription_limits_check" CHECK (
      ("seatLimit" IS NULL OR "seatLimit" > 0) AND ("projectLimit" IS NULL OR "projectLimit" > 0)
    )
);
CREATE UNIQUE INDEX "WebSubscription_userId_key" ON "WebSubscription"("userId");
CREATE INDEX "WebSubscription_status_currentPeriodEnd_idx" ON "WebSubscription"("status", "currentPeriodEnd");
ALTER TABLE "WebSubscription" ADD CONSTRAINT "WebSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebSubscription" ADD CONSTRAINT "WebSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "WebSubscriptionPayment" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "paymentRef" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebSubscriptionPayment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WebSubscriptionPayment_paymentRef_key" ON "WebSubscriptionPayment"("paymentRef");
CREATE INDEX "WebSubscriptionPayment_subscriptionId_createdAt_idx" ON "WebSubscriptionPayment"("subscriptionId", "createdAt");
ALTER TABLE "WebSubscriptionPayment" ADD CONSTRAINT "WebSubscriptionPayment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "WebSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WebhookOutbox" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebhookOutbox_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WebhookOutbox_status_nextAttemptAt_idx" ON "WebhookOutbox"("status", "nextAttemptAt");
CREATE INDEX "WebhookOutbox_createdAt_idx" ON "WebhookOutbox"("createdAt");

CREATE TABLE "OidcAuthCode" (
    "codeHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "nonce" TEXT,
    "codeChallenge" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OidcAuthCode_pkey" PRIMARY KEY ("codeHash")
);
CREATE INDEX "OidcAuthCode_expiresAt_idx" ON "OidcAuthCode"("expiresAt");

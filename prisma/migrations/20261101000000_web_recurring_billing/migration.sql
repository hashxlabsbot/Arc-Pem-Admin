-- ARC PEM web plans become recurring subscriptions (Razorpay Subscriptions): billed monthly or annually and renewed
-- automatically by card, UPI AutoPay or bank e-mandate. Purely additive; existing subscriptions are annual, no auto-renew.

ALTER TABLE "WebSubscription" ADD COLUMN "billingInterval" TEXT NOT NULL DEFAULT 'YEAR',
ADD COLUMN "autoRenew" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "razorpaySubscriptionId" TEXT;
ALTER TABLE "WebSubscription" ADD CONSTRAINT "WebSubscription_billingInterval_check" CHECK ("billingInterval" IN ('MONTH', 'YEAR'));
CREATE UNIQUE INDEX "WebSubscription_razorpaySubscriptionId_key" ON "WebSubscription"("razorpaySubscriptionId");

-- The Razorpay plan object behind each (plan, billing interval, price). A price change gets a new Razorpay plan;
-- running subscriptions keep the price they were sold at until they are changed.
CREATE TABLE "RazorpayPlan" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "billingInterval" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RazorpayPlan_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RazorpayPlan_billingInterval_check" CHECK ("billingInterval" IN ('MONTH', 'YEAR')),
    CONSTRAINT "RazorpayPlan_amount_check" CHECK ("amountPaise" > 0)
);
CREATE UNIQUE INDEX "RazorpayPlan_planId_billingInterval_amountPaise_key" ON "RazorpayPlan"("planId", "billingInterval", "amountPaise");
ALTER TABLE "RazorpayPlan" ADD CONSTRAINT "RazorpayPlan_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

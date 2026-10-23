-- Billing rules staff can change from admin Settings without a deploy: add-on seat prices, the free trial and the
-- annual discount. One row ('default'); the website reads it for prices, checkout and the trial.
CREATE TABLE "BillingSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "seatAddonMonthly" INTEGER NOT NULL DEFAULT 599,
    "siteSeatAddonMonthly" INTEGER NOT NULL DEFAULT 199,
    "annualBilledMonths" INTEGER NOT NULL DEFAULT 10,
    "trialDays" INTEGER NOT NULL DEFAULT 14,
    "maxAddonSeats" INTEGER NOT NULL DEFAULT 50,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    CONSTRAINT "BillingSettings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BillingSettings_single_row" CHECK ("id" = 'default'),
    CONSTRAINT "BillingSettings_values_check" CHECK (
      "seatAddonMonthly" >= 0 AND "siteSeatAddonMonthly" >= 0 AND "annualBilledMonths" BETWEEN 6 AND 12
      AND "trialDays" BETWEEN 0 AND 60 AND "maxAddonSeats" BETWEEN 0 AND 1000
    )
);
INSERT INTO "BillingSettings" ("id") VALUES ('default');

-- A firm's page lists its history by entity; keep that a lookup, not a scan of the whole log.
CREATE INDEX "ActivityLog_entityId_createdAt_idx" ON "ActivityLog"("entityId", "createdAt");

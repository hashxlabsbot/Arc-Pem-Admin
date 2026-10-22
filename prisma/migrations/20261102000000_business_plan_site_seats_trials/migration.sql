-- Business tier, site seats (field roles counted apart from full seats), add-on seats bought with a subscription,
-- and free trials. Purely additive.

ALTER TABLE "Plan" DROP CONSTRAINT "Plan_web_tier_check";
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_web_tier_check" CHECK (
  ("product" = 'WEB' AND "tier" IN ('SOLO', 'STUDIO', 'BUSINESS', 'ENTERPRISE')) OR ("product" = 'DESKTOP' AND "tier" IS NULL)
);
-- Site seats included with a web plan (Site engineer, Supervisor roles). 100000 = unlimited.
ALTER TABLE "Plan" ADD COLUMN "maxSiteUsers" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "WebSubscription" ADD COLUMN "siteSeatLimit" INTEGER,
ADD COLUMN "extraSeats" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "extraSiteSeats" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "trialEndsAt" TIMESTAMP(3);
ALTER TABLE "WebSubscription" ADD CONSTRAINT "WebSubscription_extras_check" CHECK (
  "extraSeats" >= 0 AND "extraSiteSeats" >= 0 AND ("siteSeatLimit" IS NULL OR "siteSeatLimit" >= 0)
);

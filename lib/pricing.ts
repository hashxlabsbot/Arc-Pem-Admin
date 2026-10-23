/**
 * ARC PEM is sold as a one-year license (annual-only — there is no monthly
 * billing, because each license is machine-locked and issued manually).
 *
 * Plans store a monthly BASE price; the amount actually charged and recorded is
 * exactly 12× that base — no discount. This mirrors `lib/pricing.ts` in the
 * customer website, which is the single source of the displayed price. The two
 * MUST agree: the website charges `annualPrice(plan.price)`, so this app must
 * validate and record the same figure.
 */
export const MONTHS_PER_YEAR = 12

/** Yearly price for a plan, derived from its stored monthly base price (₹). */
export const annualPrice = (monthlyBase: number): number =>
  Math.round(monthlyBase * MONTHS_PER_YEAR)

/*
 * ARC PEM (web) plans are subscriptions billed monthly or annually and renewed automatically by Razorpay. These
 * mirror the website's lib/pricing.ts exactly: it charges `chargePaise(subscriptionPrice(…))` (the price plus GST),
 * so this app validates the same figure.
 */

/** GST added at checkout on web subscriptions. Must equal the website's GST_RATE_PCT and the seller tax rate. */
export const GST_RATE_PCT = 18

/** What Razorpay charges for a web price before tax, in paise: the price plus GST. */
export const chargePaise = (price: number): number => Math.round(price * (100 + GST_RATE_PCT))
export const BILLING_INTERVALS = ['MONTH', 'YEAR'] as const
export type BillingInterval = (typeof BILLING_INTERVALS)[number]
export const isBillingInterval = (v: unknown): v is BillingInterval =>
  typeof v === 'string' && (BILLING_INTERVALS as readonly string[]).includes(v)

/** Billing rules staff edit in admin Settings (BillingSettings). DEFAULT_BILLING_RULES applies until that row exists. */
export type BillingRules = {
  /** Monthly price of one add-on team seat (₹). */
  seatAddonMonthly: number
  /** Monthly price of one add-on site seat (₹), for a Site engineer or Supervisor. */
  siteSeatAddonMonthly: number
  /** Months charged for a year on annual billing: 10 = two months free, 12 = no discount. */
  annualBilledMonths: number
  /** Free trial on a firm's first subscription, in days; 0 = no trial. */
  trialDays: number
  /** Most add-on seats of each kind sold self-serve. */
  maxAddonSeats: number
}
export const DEFAULT_BILLING_RULES: BillingRules = {
  seatAddonMonthly: 599,
  siteSeatAddonMonthly: 199,
  annualBilledMonths: 10,
  trialDays: 14,
  maxAddonSeats: 50,
}

export type SeatAddons = { seats: number; siteSeats: number }
export const NO_ADDONS: SeatAddons = { seats: 0, siteSeats: 0 }

/** What one billing cycle of a subscription costs (₹): the plan plus any add-on seats, at the interval's rate. */
export const subscriptionPrice = (
  monthlyBase: number,
  interval: BillingInterval,
  addons: SeatAddons = NO_ADDONS,
  rules: BillingRules = DEFAULT_BILLING_RULES,
): number =>
  Math.round(
    (monthlyBase + addons.seats * rules.seatAddonMonthly + addons.siteSeats * rules.siteSeatAddonMonthly) *
      (interval === 'MONTH' ? 1 : rules.annualBilledMonths),
  )

/** Percentage saved by paying annually instead of monthly (0 when annual has no discount). */
export const annualSavingPct = (rules: BillingRules = DEFAULT_BILLING_RULES): number =>
  Math.round((1 - rules.annualBilledMonths / MONTHS_PER_YEAR) * 100)

/**
 * License term end after a payment is activated. Renewal-safe: if the user
 * still has time left on the current term, the new year is added on top of the
 * remaining term; otherwise the year starts now.
 */
export function planExpiryAfterPayment(
  currentExpiry?: Date | null,
  from: Date = new Date(),
): Date {
  const base = currentExpiry && currentExpiry > from ? new Date(currentExpiry) : new Date(from)
  base.setFullYear(base.getFullYear() + 1)
  return base
}

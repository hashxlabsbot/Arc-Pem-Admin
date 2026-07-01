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

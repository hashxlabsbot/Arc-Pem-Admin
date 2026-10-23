import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { DEFAULT_BILLING_RULES, type BillingRules } from '@/lib/pricing'

/** The billing rules in admin Settings (always read fresh here); the defaults apply until the row exists. */
export async function getBillingRules(client: Prisma.TransactionClient | typeof db = db): Promise<BillingRules> {
  const row = await client.billingSettings.findUnique({ where: { id: 'default' } })
  if (!row) return DEFAULT_BILLING_RULES
  return {
    seatAddonMonthly: row.seatAddonMonthly,
    siteSeatAddonMonthly: row.siteSeatAddonMonthly,
    annualBilledMonths: row.annualBilledMonths,
    trialDays: row.trialDays,
    maxAddonSeats: row.maxAddonSeats,
  }
}

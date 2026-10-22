import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import { getBillingRules } from '@/lib/billing-rules'
import { revalidateMarketingPricing } from '@/lib/blog-revalidate'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  return session?.user.role === 'ADMIN' ? session : null
}

const FIELDS = {
  seatAddonMonthly: { min: 0, max: 100_000, label: 'Team seat add-on price' },
  siteSeatAddonMonthly: { min: 0, max: 100_000, label: 'Site seat add-on price' },
  annualBilledMonths: { min: 6, max: 12, label: 'Annual billing months' },
  trialDays: { min: 0, max: 60, label: 'Free trial days' },
  maxAddonSeats: { min: 0, max: 1000, label: 'Most add-on seats' },
} as const

/** The billing rules the website uses for add-on seats, the free trial and the annual discount. */
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const row = await db.billingSettings.findUnique({ where: { id: 'default' } })
  return NextResponse.json({ rules: await getBillingRules(), updatedAt: row?.updatedAt ?? null, updatedBy: row?.updatedBy ?? null })
}

/**
 * Changes take effect for new checkouts within a minute. Running subscriptions keep the price they were sold at
 * (Razorpay plans are fixed per amount); a firm moves to new prices when it changes plan or seats.
 */
export async function PUT(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const data: Record<string, number> = {}
  for (const [key, { min, max, label }] of Object.entries(FIELDS)) {
    const v = Number(body[key])
    if (!Number.isInteger(v) || v < min || v > max) {
      return NextResponse.json({ error: `${label} must be a whole number from ${min} to ${max}.` }, { status: 400 })
    }
    data[key] = v
  }
  const before = await getBillingRules()
  const row = await db.billingSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', ...data, updatedBy: session.user.email ?? null },
    update: { ...data, updatedBy: session.user.email ?? null },
  })
  const changed = Object.keys(data)
    .filter((k) => before[k as keyof typeof before] !== data[k])
    .map((k) => `${k} ${before[k as keyof typeof before]} → ${data[k]}`)
  if (changed.length) await logActivity('UPDATE', 'BillingSettings', 'default', `Billing settings: ${changed.join(', ')}`)
  await revalidateMarketingPricing()
  return NextResponse.json({ rules: data, updatedAt: row.updatedAt })
}

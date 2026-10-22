import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { firmFilter } from '@/lib/firm-filter'

export const dynamic = 'force-dynamic'

const csv = (v: unknown) => {
  const s = v === null || v === undefined ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v)
  // Quote, and stop spreadsheet formula injection from customer-entered names.
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`
}

/** Every firm matching the list's filters, as CSV, for finance and sales. */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (session?.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const subs = await db.webSubscription.findMany({
    where: firmFilter(req.nextUrl.searchParams),
    include: {
      plan: { select: { name: true, maxUsers: true, maxSiteUsers: true, maxProjects: true } },
      user: { select: { name: true, email: true, billingProfile: { select: { gstin: true, city: true, state: true, phone: true } } } },
      payments: { select: { amount: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
    },
    orderBy: { createdAt: 'desc' },
  })
  const header = ['Firm', 'Owner', 'Email', 'Phone', 'GSTIN', 'City', 'State', 'Plan', 'Billing', 'Status', 'Auto-renew', 'Trial ends',
    'Access until', 'Team seats', 'Site seats', 'Projects', 'Add-on team seats', 'Add-on site seats', 'Payments', 'Paid total (₹)',
    'Last payment', 'Customer since', 'Razorpay subscription']
  const rows = subs.map((s) => [
    s.firmName, s.user.name, s.user.email, s.user.billingProfile?.phone, s.user.billingProfile?.gstin, s.user.billingProfile?.city,
    s.user.billingProfile?.state, s.plan.name, s.billingInterval === 'MONTH' ? 'Monthly' : 'Annual', s.status, s.autoRenew ? 'Yes' : 'No',
    s.trialEndsAt, s.currentPeriodEnd, s.seatLimit ?? s.plan.maxUsers, s.siteSeatLimit ?? s.plan.maxSiteUsers, s.projectLimit ?? s.plan.maxProjects,
    s.extraSeats, s.extraSiteSeats, s.payments.length, s.payments.reduce((t, p) => t + p.amount, 0), s.payments[0]?.createdAt, s.createdAt,
    s.razorpaySubscriptionId,
  ])
  const body = '﻿' + [header, ...rows].map((r) => r.map(csv).join(',')).join('\r\n')
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="arcpem-firms-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}

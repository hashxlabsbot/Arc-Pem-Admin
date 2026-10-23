import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import { deliverOutbox, enqueueSubscriptionUpdated } from '@/lib/web-app'
import { webMetrics } from '@/lib/web-metrics'
import { firmFilter } from '@/lib/firm-filter'

const TIERS = ['SOLO', 'STUDIO', 'BUSINESS', 'ENTERPRISE']
const sortByTier = <T extends { tier: string | null; price: number }>(plans: T[]) =>
  [...plans].sort((a, b) => TIERS.indexOf(a.tier ?? '') - TIERS.indexOf(b.tier ?? '') || a.price - b.price)

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  return session?.user.role === 'ADMIN' ? session : null
}

const PAGE_SIZE = 50

/** ARC PEM firms (filtered, a page at a time), subscription metrics, and the state of deliveries to the web app. */
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const params = req.nextUrl.searchParams
  const page = Math.max(1, Number(params.get('page')) || 1)
  const where = firmFilter(params)
  const [subscriptions, total, plans, pending, failed, metrics] = await Promise.all([
    db.webSubscription.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, status: true } },
        plan: { select: { id: true, name: true, tier: true, maxUsers: true, maxProjects: true, maxSiteUsers: true } },
        payments: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true, amount: true, paymentRef: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.webSubscription.count({ where }),
    db.plan.findMany({ where: { product: 'WEB' }, select: { id: true, name: true, tier: true, isActive: true, price: true } }).then(sortByTier),
    db.webhookOutbox.count({ where: { status: 'PENDING' } }),
    db.webhookOutbox.findMany({
      where: { status: 'FAILED' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, type: true, attempts: true, lastError: true, createdAt: true },
    }),
    params.get('metrics') === '0' ? null : webMetrics(),
  ])
  return NextResponse.json({ subscriptions, total, page, pageSize: PAGE_SIZE, plans, outbox: { pending, failed }, metrics })
}

/**
 * Grants a web subscription by hand (sales-led or complimentary deals) to an existing customer account. The owner
 * then signs in to the web app with that account. No payment is recorded; invoice separately if needed.
 */
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const months = Number(body.months)
  if (!email || !Number.isInteger(months) || months < 1 || months > 60)
    return NextResponse.json({ error: 'email and months (1-60) are required' }, { status: 400 })

  const [user, plan] = await Promise.all([
    db.user.findUnique({ where: { email }, include: { billingProfile: { select: { legalName: true } } } }),
    db.plan.findUnique({ where: { id: String(body.planId ?? '') } }),
  ])
  if (!user || user.role !== 'USER') return NextResponse.json({ error: 'No customer account with that email' }, { status: 404 })
  if (!plan || plan.product !== 'WEB') return NextResponse.json({ error: 'Choose a web plan' }, { status: 400 })
  if (await db.webSubscription.findUnique({ where: { userId: user.id } }))
    return NextResponse.json({ error: 'This account already has a web subscription; adjust it instead' }, { status: 409 })

  const end = new Date()
  end.setMonth(end.getMonth() + months)
  const firmName = (typeof body.firmName === 'string' && body.firmName.trim()) || user.billingProfile?.legalName || user.name
  const { sub, eventId } = await db.$transaction(async (tx) => {
    const lim = (v: unknown) => (v === undefined || v === null || v === '' ? null : Math.max(1, Math.min(100_000, Math.floor(Number(v)) || 1)))
    const sub = await tx.webSubscription.create({
      data: {
        userId: user.id,
        firmName,
        planId: plan.id,
        status: 'ACTIVE',
        currentPeriodEnd: end,
        seatLimit: lim(body.seatLimit),
        siteSeatLimit: lim(body.siteSeatLimit),
        projectLimit: lim(body.projectLimit),
      },
    })
    return { sub, eventId: await enqueueSubscriptionUpdated(tx, sub.id) }
  })
  await deliverOutbox({ ids: [eventId] }).catch((err) => console.error('[web-subscriptions] delivery failed (will retry):', err))
  await logActivity('CREATE', 'WebSubscription', sub.id, `Granted ${plan.name} for ${months} months to ${email}`)
  return NextResponse.json({ subscription: sub }, { status: 201 })
}

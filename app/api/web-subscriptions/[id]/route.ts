import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import { deliverOutbox, enqueueSubscriptionUpdated } from '@/lib/web-app'
import { cancelRazorpaySubscription, razorpayConfigured } from '@/lib/razorpay'

export const dynamic = 'force-dynamic'

const STATUSES = ['ACTIVE', 'PAST_DUE', 'EXPIRED', 'SUSPENDED', 'CANCELED']
const optionalLimit = (v: unknown) => (v === null || v === '' ? null : Number(v))
const validLimit = (n: number | null) => n === null || (Number.isInteger(n) && n > 0 && n <= 100_000)

/**
 * Adjusts one firm's web subscription. Every change is queued for the web app in the same transaction and pushed
 * straight away (retried later if the web app can't be reached).
 *   { action: 'extend', months | days }          add time to the term (from now if it already ended)
 *   { action: 'status', status }                  ACTIVE | PAST_DUE | EXPIRED | SUSPENDED | CANCELED
 *   { action: 'plan', planId }                    move to another web plan
 *   { action: 'limits', seatLimit, siteSeatLimit, projectLimit }  per-firm overrides (null = the plan's)
 *   { action: 'stopRenewal' }                     cancel the Razorpay subscription; access runs to the paid end
 *   { action: 'rename', firmName }
 *   { action: 'resync' }                          re-send the current state
 */
/** One firm in full: owner, plan, payments (with invoices), activity, and whether renewals can be stopped here. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (session?.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sub = await db.webSubscription.findUnique({
    where: { id: params.id },
    include: {
      plan: true,
      user: {
        select: {
          id: true, name: true, email: true, status: true, createdAt: true,
          billingProfile: { select: { legalName: true, gstin: true, city: true, state: true, phone: true } },
        },
      },
      payments: { orderBy: { createdAt: 'desc' } },
    },
  })
  if (!sub) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const refs = sub.payments.map((p) => p.paymentRef)
  const [pending, activity] = await Promise.all([
    db.pendingPayment.findMany({ where: { utr: { in: refs } }, select: { id: true, utr: true, status: true } }),
    db.activityLog.findMany({ where: { entityId: sub.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
  ])
  const invoices = await db.invoice.findMany({
    where: { paymentId: { in: pending.map((p) => p.id) } },
    select: { id: true, invoiceNumber: true, paymentId: true },
  })
  const byRef = new Map(pending.map((p) => [p.utr, p]))
  const invoiceByPayment = new Map(invoices.map((i) => [i.paymentId, i]))
  return NextResponse.json({
    subscription: {
      ...sub,
      payments: sub.payments.map((p) => {
        const row = byRef.get(p.paymentRef)
        const inv = row ? invoiceByPayment.get(row.id) : undefined
        return { ...p, status: row?.status ?? null, invoiceId: inv?.id ?? null, invoiceNumber: inv?.invoiceNumber ?? null }
      }),
    },
    activity,
    canStopRenewal: razorpayConfigured(),
  })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (session?.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sub = await db.webSubscription.findUnique({ where: { id: params.id } })
  if (!sub) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  const now = new Date()

  let data: Record<string, unknown>
  let summary: string
  switch (body.action) {
    case 'extend': {
      const months = body.months === undefined ? 0 : Number(body.months)
      const days = body.days === undefined ? 0 : Number(body.days)
      if (!Number.isInteger(months) || !Number.isInteger(days) || months < 0 || days < 0 || months > 60 || days > 365 || months + days === 0)
        return NextResponse.json({ error: 'Give months (1-60) or days (1-365)' }, { status: 400 })
      const from = sub.currentPeriodEnd && sub.currentPeriodEnd > now ? new Date(sub.currentPeriodEnd) : new Date(now)
      from.setMonth(from.getMonth() + months)
      from.setDate(from.getDate() + days)
      // Extending a trial lengthens free access only: the first charge stays on the date Razorpay has.
      data = {
        currentPeriodEnd: from,
        ...(sub.trialEndsAt ? { trialEndsAt: from } : {}),
        ...(sub.status === 'EXPIRED' || sub.status === 'PAST_DUE' ? { status: 'ACTIVE' } : {}),
      }
      summary = `Extended by ${months ? `${months} months` : ''}${months && days ? ' and ' : ''}${days ? `${days} days` : ''} to ${from.toISOString().slice(0, 10)}`
      break
    }
    case 'stopRenewal': {
      if (!sub.autoRenew) return NextResponse.json({ error: 'Auto-renew is already off' }, { status: 409 })
      if (sub.razorpaySubscriptionId) {
        const cancelled = await cancelRazorpaySubscription(sub.razorpaySubscriptionId)
        if (!cancelled.ok) return NextResponse.json({ error: cancelled.error }, { status: 502 })
      }
      data = { autoRenew: false }
      summary = `Auto-renew stopped by staff (access until ${sub.currentPeriodEnd?.toISOString().slice(0, 10) ?? 'no end date'})`
      break
    }
    case 'status': {
      if (!STATUSES.includes(body.status)) return NextResponse.json({ error: 'Unknown status' }, { status: 400 })
      data = { status: body.status }
      summary = `Status ${sub.status} → ${body.status}`
      break
    }
    case 'plan': {
      const plan = await db.plan.findUnique({ where: { id: String(body.planId ?? '') } })
      if (!plan || plan.product !== 'WEB') return NextResponse.json({ error: 'Choose a web plan' }, { status: 400 })
      data = { planId: plan.id }
      summary = `Plan → ${plan.name}`
      break
    }
    case 'limits': {
      const seatLimit = optionalLimit(body.seatLimit)
      const projectLimit = optionalLimit(body.projectLimit)
      const siteSeatLimit = body.siteSeatLimit === undefined ? sub.siteSeatLimit : optionalLimit(body.siteSeatLimit)
      if (!validLimit(seatLimit) || !validLimit(projectLimit) || !validLimit(siteSeatLimit))
        return NextResponse.json({ error: 'Limits must be positive whole numbers, or empty for the plan default' }, { status: 400 })
      data = { seatLimit, projectLimit, siteSeatLimit }
      summary = `Limits → team seats ${seatLimit ?? 'plan'}, site seats ${siteSeatLimit ?? 'plan'}, projects ${projectLimit ?? 'plan'}`
      break
    }
    case 'rename': {
      const firmName = typeof body.firmName === 'string' ? body.firmName.trim() : ''
      if (!firmName || firmName.length > 200) return NextResponse.json({ error: 'Firm name is required' }, { status: 400 })
      data = { firmName }
      summary = `Renamed to ${firmName}`
      break
    }
    case 'resync':
      data = {}
      summary = 'Re-sent to web app'
      break
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  const { updated, eventId } = await db.$transaction(async (tx) => {
    // updatedAt always moves, so the web app treats the state as newer than what it has.
    const updated = await tx.webSubscription.update({ where: { id: sub.id }, data: { ...data, updatedAt: now } })
    return { updated, eventId: await enqueueSubscriptionUpdated(tx, sub.id) }
  })
  const delivery = await deliverOutbox({ ids: [eventId] }).catch(() => null)
  await logActivity('UPDATE', 'WebSubscription', sub.id, summary)
  return NextResponse.json({ subscription: updated, delivered: (delivery?.delivered ?? 0) > 0 })
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { revalidateMarketingPricing } from '@/lib/blog-revalidate'
import { parsePlanProduct } from '@/lib/plan-product'
import { deliverOutbox, enqueueSubscriptionUpdated } from '@/lib/web-app'

/** Re-sends the state of every firm on a web plan after the plan's limits or tier changed. */
async function resyncWebFirmsOnPlan(planId: string) {
  const subs = await db.webSubscription.findMany({ where: { planId }, select: { id: true } })
  if (subs.length === 0) return
  const ids = await db.$transaction(async (tx) => {
    const out: string[] = []
    for (const s of subs) {
      // Bump updatedAt so the web app treats this as newer than what it has.
      await tx.webSubscription.update({ where: { id: s.id }, data: { updatedAt: new Date() } })
      out.push(await enqueueSubscriptionUpdated(tx, s.id))
    }
    return out
  })
  await deliverOutbox({ ids, limit: ids.length }).catch((err) => console.error('[plans] web-app delivery failed (will retry):', err))
}

interface Params {
  params: { id: string }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { name, price, period, description, features, maxProjects, maxUsers, isActive } = body

    const current = await db.plan.findUnique({
      where: { id: params.id },
      select: { product: true, tier: true, _count: { select: { users: true, webSubscriptions: true } } },
    })
    if (!current) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    const kind =
      body.product !== undefined || body.tier !== undefined
        ? parsePlanProduct(body.product ?? current.product, body.tier ?? current.tier)
        : null
    if (kind && 'error' in kind) return NextResponse.json({ error: kind.error }, { status: 400 })
    // Switching product would strand the firms or machines already on this plan.
    if (kind && kind.product !== current.product && current._count.users + current._count.webSubscriptions > 0)
      return NextResponse.json({ error: 'This plan has subscribers; create a new plan instead of changing its product.' }, { status: 409 })

    const plan = await db.plan.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(price !== undefined && { price: Number(price) }),
        ...(period !== undefined && { period }),
        ...(description !== undefined && { description }),
        ...(features !== undefined && { features }),
        ...(maxProjects !== undefined && { maxProjects: Number(maxProjects) }),
        ...(maxUsers !== undefined && { maxUsers: Number(maxUsers) }),
        ...(body.maxSiteUsers !== undefined && { maxSiteUsers: Math.max(0, Number(body.maxSiteUsers) || 0) }),
        ...(isActive !== undefined && { isActive }),
        ...(kind && { product: kind.product, tier: kind.tier }),
      },
    })

    // Web firms on this plan get its new limits and tier in the web app.
    if (plan.product === 'WEB') await resyncWebFirmsOnPlan(plan.id)

    await revalidateMarketingPricing()
    return NextResponse.json({ plan })
  } catch (err) {
    console.error('[PUT /api/subscriptions/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if any users (desktop) or firms (web) are on this plan
    const userCount =
      (await db.user.count({ where: { planId: params.id } })) +
      (await db.webSubscription.count({ where: { planId: params.id } }))
    if (userCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete plan — ${userCount} customer${userCount > 1 ? 's are' : ' is'} on it. Mark it inactive instead: existing customers keep it, new customers can't choose it.`,
        },
        { status: 409 }
      )
    }

    await db.plan.delete({ where: { id: params.id } })
    await revalidateMarketingPricing()
    return NextResponse.json({ message: 'Plan deleted' })
  } catch (err) {
    console.error('[DELETE /api/subscriptions/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

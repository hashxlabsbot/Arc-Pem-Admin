import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

interface Params {
  params: { id: string }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { status, planId } = body

    // Web plans are subscriptions held by firms (Firms page), never a user's desktop plan.
    if (planId) {
      const plan = await db.plan.findUnique({ where: { id: String(planId) }, select: { product: true } })
      if (plan?.product === 'WEB') {
        return NextResponse.json({ error: 'ARC PEM plans are managed per firm on the Firms page.' }, { status: 400 })
      }
    }

    const updateData: Record<string, unknown> = {}
    if (status !== undefined) updateData.status = status
    if (planId !== undefined) updateData.planId = planId

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const user = await db.user.update({
      where: { id: params.id },
      data: updateData,
      include: {
        plan: { select: { id: true, name: true, price: true, period: true } },
      },
    })

    const { password: _pw, ...safe } = user
    return NextResponse.json({ user: safe })
  } catch (err) {
    console.error('[PATCH /api/users/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await db.user.findUnique({ where: { id: params.id } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (user.role === 'ADMIN') {
      return NextResponse.json(
        { error: 'Cannot delete an admin account.' },
        { status: 403 }
      )
    }

    await db.user.delete({ where: { id: params.id } })
    return NextResponse.json({ message: 'User deleted' })
  } catch (err) {
    console.error('[DELETE /api/users/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

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
        ...(isActive !== undefined && { isActive }),
      },
    })

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

    // Check if any users are on this plan
    const userCount = await db.user.count({ where: { planId: params.id } })
    if (userCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete plan — ${userCount} user${userCount > 1 ? 's are' : ' is'} currently subscribed to it.`,
        },
        { status: 409 }
      )
    }

    await db.plan.delete({ where: { id: params.id } })
    return NextResponse.json({ message: 'Plan deleted' })
  } catch (err) {
    console.error('[DELETE /api/subscriptions/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

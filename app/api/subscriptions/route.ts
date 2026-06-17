import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const plans = await db.plan.findMany({
      include: {
        _count: { select: { users: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ plans })
  } catch (err) {
    console.error('[GET /api/subscriptions]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { name, price, period, description, features, maxProjects, maxUsers, isActive } = body

    if (!name || price === undefined || !description) {
      return NextResponse.json(
        { error: 'Name, price, and description are required.' },
        { status: 400 }
      )
    }

    const priceNum = Number(price)
    if (!isFinite(priceNum) || priceNum < 0) {
      return NextResponse.json({ error: 'price must be a non-negative number' }, { status: 400 })
    }

    const plan = await db.plan.create({
      data: {
        name,
        price: priceNum,
        period: period ?? 'month',
        description,
        features: features ?? '[]',
        maxProjects: Number(maxProjects) || 10,
        maxUsers: Number(maxUsers) || 1,
        isActive: isActive ?? true,
      },
    })

    return NextResponse.json({ plan }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/subscriptions]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

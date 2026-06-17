import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const action = searchParams.get('action') || ''
    const search = searchParams.get('search') || ''

    const where: Record<string, unknown> = {}
    if (action) where.action = action
    if (search) {
      where.OR = [
        { action: { contains: search } },
        { entityType: { contains: search } },
        { details: { contains: search } },
      ]
    }

    const [rows, total] = await Promise.all([
      db.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.activityLog.count({ where }),
    ])

    const allActions = await db.activityLog.findMany({
      select: { action: true },
      distinct: ['action'],
    })

    const actions = allActions.map((a) => a.action)

    return NextResponse.json({
      rows,
      total,
      page,
      pages: Math.ceil(total / limit),
      actions,
    })
  } catch (err) {
    console.error('[GET /api/activity]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

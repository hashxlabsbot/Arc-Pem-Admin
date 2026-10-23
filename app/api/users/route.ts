import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { buildUserWhere } from './helpers'

// Authenticated, per-request endpoint — never statically prerender.
export const dynamic = 'force-dynamic'

const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 100

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = req.nextUrl
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(searchParams.get('pageSize') ?? `${DEFAULT_PAGE_SIZE}`, 10) || DEFAULT_PAGE_SIZE)
    )
    const where = buildUserWhere(searchParams)

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        include: {
          plan: { select: { id: true, name: true, price: true, period: true } },
          webSubscription: { select: { id: true, firmName: true, status: true, plan: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.user.count({ where }),
    ])

    // Strip password hashes before sending to the client.
    const safe = users.map(({ password: _pw, ...u }) => u)

    return NextResponse.json({
      users: safe,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (err) {
    logger.error('GET /api/users failed', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import type { Prisma } from '@prisma/client'

// Authenticated, per-request endpoint — never statically prerender.
export const dynamic = 'force-dynamic'

const MAX_LIMIT = 100
const DEFAULT_LIMIT = 20

// The distinct list of actions changes rarely, but the `distinct` scan is
// expensive on a large, fast-growing table. Cache it in-process for a minute.
let actionsCache: { value: string[]; at: number } | null = null
const ACTIONS_TTL_MS = 60 * 1000

async function getActions(): Promise<string[]> {
  if (actionsCache && Date.now() - actionsCache.at < ACTIONS_TTL_MS) {
    return actionsCache.value
  }
  const rows = await db.activityLog.findMany({
    select: { action: true },
    distinct: ['action'],
  })
  const value = rows.map((a) => a.action)
  actionsCache = { value, at: Date.now() }
  return value
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(searchParams.get('limit') || `${DEFAULT_LIMIT}`, 10) || DEFAULT_LIMIT)
    )
    const action = searchParams.get('action') || ''
    const search = searchParams.get('search') || ''

    const where: Prisma.ActivityLogWhereInput = {}
    if (action) where.action = action
    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { entityType: { contains: search, mode: 'insensitive' } },
        { details: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [rows, total, actions] = await Promise.all([
      db.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.activityLog.count({ where }),
      getActions(),
    ])

    return NextResponse.json({
      rows,
      total,
      page,
      pages: Math.ceil(total / limit),
      actions,
    })
  } catch (err) {
    logger.error('GET /api/activity failed', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

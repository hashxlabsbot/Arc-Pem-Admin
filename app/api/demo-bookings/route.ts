import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import type { Prisma } from '@prisma/client'

// Authenticated, per-request endpoint — never statically prerender.
export const dynamic = 'force-dynamic'

const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 200

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
    const search = searchParams.get('search')?.trim() ?? ''
    const status = searchParams.get('status') ?? ''

    const where: Prisma.DemoBookingWhereInput = {}
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { whatsapp: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (status && status !== 'all') where.status = status

    const [bookings, total, totalAll, confirmedAll, pendingAll] = await Promise.all([
      db.demoBooking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.demoBooking.count({ where }),
      db.demoBooking.count(),
      db.demoBooking.count({ where: { status: 'CONFIRMED' } }),
      db.demoBooking.count({ where: { status: 'PENDING' } }),
    ])

    return NextResponse.json({
      bookings,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      stats: { total: totalAll, confirmed: confirmedAll, pending: pendingAll },
    })
  } catch (err) {
    logger.error('GET /api/demo-bookings failed', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

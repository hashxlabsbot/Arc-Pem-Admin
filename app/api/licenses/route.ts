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

    const where: Prisma.LicenseWhereInput = {}
    if (search) {
      where.OR = [
        { client: { is: { name: { contains: search, mode: 'insensitive' } } } },
        { machineId: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (status && status !== 'all') where.status = status

    const now = new Date()
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const [licenses, total, totalAll, activeAll, expiringAll, revokedAll, expiredActive] =
      await Promise.all([
        db.license.findMany({
          where,
          include: { client: { select: { name: true, email: true, paymentStatus: true } } },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        db.license.count({ where }),
        db.license.count(),
        db.license.count({ where: { status: 'active', expiry: { gte: now } } }),
        db.license.count({ where: { status: 'active', expiry: { gte: now, lte: in30 } } }),
        db.license.count({ where: { status: 'revoked' } }),
        db.license.count({ where: { status: { not: 'revoked' }, expiry: { lt: now } } }),
      ])

    return NextResponse.json({
      licenses,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      stats: {
        total: totalAll,
        active: activeAll,
        expiring: expiringAll,
        inactive: revokedAll + expiredActive,
      },
    })
  } catch (err) {
    logger.error('GET /api/licenses failed', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

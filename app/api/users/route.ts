import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

const PAGE_SIZE = 50

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = req.nextUrl
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const skip = (page - 1) * PAGE_SIZE

    const [users, total] = await Promise.all([
      db.user.findMany({
        include: {
          plan: { select: { id: true, name: true, price: true, period: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: PAGE_SIZE,
      }),
      db.user.count(),
    ])

    // Strip passwords
    const safe = users.map(({ password: _pw, ...u }) => u)

    return NextResponse.json({
      users: safe,
      pagination: { page, pageSize: PAGE_SIZE, total, totalPages: Math.ceil(total / PAGE_SIZE) },
    })
  } catch (err) {
    console.error('[GET /api/users]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

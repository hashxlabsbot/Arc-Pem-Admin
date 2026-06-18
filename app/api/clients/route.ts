import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity'
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
    const plan = searchParams.get('plan') ?? ''

    const where: Prisma.ClientWhereInput = {}
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (status && status !== 'all') where.status = status
    if (plan && plan !== 'all') where.plan = plan

    const [clients, total, totalAll, activeAll] = await Promise.all([
      db.client.findMany({
        where,
        include: {
          _count: {
            select: {
              licenses: { where: { status: 'active' } },
              apiKeys: { where: { status: 'active' } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.client.count({ where }),
      db.client.count(),
      db.client.count({ where: { status: 'active' } }),
    ])

    return NextResponse.json({
      clients,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      stats: { total: totalAll, active: activeAll },
    })
  } catch (err) {
    logger.error('GET /api/clients failed', err)
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
    const { name, email, phone, company, address, plan, notes, status, paymentStatus } = body

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
    }

    const client = await db.client.create({
      data: {
        name,
        email,
        phone: phone || null,
        company: company || null,
        address: address || null,
        plan: plan || 'standard',
        notes: notes || null,
        status: status || 'active',
        paymentStatus: paymentStatus || 'pending',
      },
    })

    await logActivity('CREATE', 'Client', client.id, `Created client: ${client.name}`)

    return NextResponse.json({ client }, { status: 201 })
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 })
    }
    logger.error('POST /api/clients failed', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

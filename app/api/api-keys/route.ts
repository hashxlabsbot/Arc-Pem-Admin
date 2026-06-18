import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import { generateApiKey } from '@/lib/api-key'
import { logger } from '@/lib/logger'
import type { Prisma } from '@prisma/client'

// Authenticated, per-request endpoint — never statically prerender.
export const dynamic = 'force-dynamic'

// Hard cap so a list request can never load an unbounded result set.
const MAX_PAGE_SIZE = 100
const DEFAULT_PAGE_SIZE = 50

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

    const where: Prisma.ApiKeyWhereInput = {}
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { client: { is: { name: { contains: search, mode: 'insensitive' } } } },
      ]
    }
    if (status && status !== 'all') where.status = status

    const [apiKeys, total, activeAll, revokedAll] = await Promise.all([
      db.apiKey.findMany({
        where,
        include: { client: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.apiKey.count({ where }),
      db.apiKey.count({ where: { status: 'active' } }),
      db.apiKey.count({ where: { status: 'revoked' } }),
    ])

    return NextResponse.json({
      apiKeys,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      stats: { active: activeAll, revoked: revokedAll },
    })
  } catch (err) {
    logger.error('GET /api/api-keys failed', err)
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
    const { clientId, name, scopes, expiresAt } = body

    if (!clientId || !name) {
      return NextResponse.json({ error: 'clientId and name are required' }, { status: 400 })
    }

    // Verify the client exists before issuing a key against it.
    const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true } })
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const { rawKey, keyHash, keyPrefix } = generateApiKey()

    const apiKey = await db.apiKey.create({
      data: {
        clientId,
        name,
        keyHash,
        keyPrefix,
        scopes: JSON.stringify(Array.isArray(scopes) ? scopes : []),
        status: 'active',
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      include: { client: { select: { name: true, email: true } } },
    })

    await logActivity('CREATE', 'ApiKey', apiKey.id, `Created API key "${name}" for client ${clientId}`)

    // rawKey is returned exactly once — it is never stored or recoverable.
    return NextResponse.json({ apiKey, rawKey }, { status: 201 })
  } catch (err) {
    logger.error('POST /api/api-keys failed', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const apiKeys = await db.apiKey.findMany({
      include: {
        client: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ apiKeys })
  } catch (err) {
    console.error('[GET /api/api-keys]', err)
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

    const rawKey = `pem_${crypto.randomBytes(24).toString('hex')}`
    const keyPrefix = rawKey.slice(0, 12)
    const keyHash = await bcrypt.hash(rawKey, 10)

    const apiKey = await db.apiKey.create({
      data: {
        clientId,
        name,
        keyHash,
        keyPrefix,
        scopes: JSON.stringify(scopes || []),
        status: 'active',
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      include: { client: { select: { name: true, email: true } } },
    })

    await logActivity('CREATE', 'ApiKey', apiKey.id, `Created API key "${name}" for client ${clientId}`)

    return NextResponse.json({ apiKey, rawKey }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/api-keys]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

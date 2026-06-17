import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clients = await db.client.findMany({
      include: {
        _count: {
          select: {
            licenses: { where: { status: 'active' } },
            apiKeys: { where: { status: 'active' } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ clients })
  } catch (err) {
    console.error('[GET /api/clients]', err)
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
    console.error('[POST /api/clients]', err)
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

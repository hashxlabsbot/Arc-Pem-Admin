import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity'

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const client = await db.client.findUnique({
      where: { id: params.id },
      include: {
        licenses: { orderBy: { createdAt: 'desc' } },
        apiKeys: { orderBy: { createdAt: 'desc' } },
        clientNotes: { orderBy: { createdAt: 'desc' } },
      },
    })

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    return NextResponse.json({ client })
  } catch (err) {
    console.error('[GET /api/clients/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { name, email, phone, company, address, plan, notes, status, paymentStatus } = body

    const client = await db.client.update({
      where: { id: params.id },
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

    await logActivity('UPDATE', 'Client', client.id, `Updated client: ${client.name}`)

    return NextResponse.json({ client })
  } catch (err) {
    console.error('[PUT /api/clients/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const client = await db.client.findUnique({ where: { id: params.id } })
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    await db.client.delete({ where: { id: params.id } })

    await logActivity('DELETE', 'Client', params.id, `Deleted client: ${client.name}`)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/clients/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

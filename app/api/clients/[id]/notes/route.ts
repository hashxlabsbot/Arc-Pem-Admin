import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const notes = await db.clientNote.findMany({
      where: { clientId: params.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ notes })
  } catch (err) {
    console.error('[GET /api/clients/[id]/notes]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { note } = body

    if (!note || !note.trim()) {
      return NextResponse.json({ error: 'Note is required' }, { status: 400 })
    }

    const clientNote = await db.clientNote.create({
      data: { clientId: params.id, note: note.trim() },
    })

    await logActivity('CREATE', 'ClientNote', clientNote.id, `Added note to client ${params.id}`)

    return NextResponse.json({ note: clientNote }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/clients/[id]/notes]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

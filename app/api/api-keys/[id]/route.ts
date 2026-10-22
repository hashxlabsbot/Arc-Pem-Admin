import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity'

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const apiKey = await db.apiKey.findUnique({ where: { id: params.id } })
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 })
    }

    await db.apiKey.delete({ where: { id: params.id } })

    await logActivity('DELETE', 'ApiKey', params.id, `Deleted API key: ${apiKey.name}`)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/api-keys/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

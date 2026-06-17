import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const apiKey = await db.apiKey.update({
      where: { id: params.id },
      data: { status: 'revoked' },
      include: { client: { select: { name: true } } },
    })

    await logActivity('REVOKE', 'ApiKey', apiKey.id, `Revoked API key: ${apiKey.name}`)

    return NextResponse.json({ apiKey })
  } catch (err) {
    console.error('[PATCH /api/api-keys/[id]/revoke]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

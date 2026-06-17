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

    const license = await db.license.update({
      where: { id: params.id },
      data: { status: 'active' },
      include: { client: { select: { name: true } } },
    })

    await logActivity('UPDATE', 'License', license.id, `Unrevoked license for ${license.client.name}`)

    return NextResponse.json({ license })
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2025') {
      return NextResponse.json({ error: 'License not found' }, { status: 404 })
    }
    console.error('[PATCH /api/licenses/[id]/unrevoke]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

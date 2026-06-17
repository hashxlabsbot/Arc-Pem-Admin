import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const licenses = await db.license.findMany({
      include: {
        client: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ licenses })
  } catch (err) {
    console.error('[GET /api/licenses]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

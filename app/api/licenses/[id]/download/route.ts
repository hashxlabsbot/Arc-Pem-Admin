import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const license = await db.license.findUnique({
      where: { id: params.id },
      include: { client: { select: { name: true, email: true } } },
    })

    if (!license) {
      return NextResponse.json({ error: 'License not found' }, { status: 404 })
    }

    const content = license.licenseKey

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="${license.fileName}"`,
      },
    })
  } catch (err) {
    console.error('[GET /api/licenses/[id]/download]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

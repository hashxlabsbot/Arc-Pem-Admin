import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { isEarlyAccessOpen, setSetting, SETTING_KEYS } from '@/lib/settings'

export const dynamic = 'force-dynamic'

// The public website reads this to decide whether to show the signup form, so
// keep CORS open like /api/auth/register and /api/billing.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

// Whether early-access registration is open. Public: returns just `{ open }`.
// Admins additionally get the size of the acquired early-access cohort.
export async function GET() {
  const open = await isEarlyAccessOpen()
  const session = await getServerSession(authOptions)
  if (session?.user.role === 'ADMIN') {
    const earlyAccessUsers = await db.user.count({ where: { earlyAccess: true } })
    return NextResponse.json({ open, earlyAccessUsers }, { headers: CORS_HEADERS })
  }
  return NextResponse.json({ open }, { headers: CORS_HEADERS })
}

// Flip the toggle. Admin only — this is the controlled go-live switch.
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS })
  }

  const body = await req.json().catch(() => ({}))
  if (typeof body.open !== 'boolean') {
    return NextResponse.json({ error: '`open` must be a boolean.' }, { status: 400, headers: CORS_HEADERS })
  }

  await setSetting(SETTING_KEYS.earlyAccessOpen, body.open ? 'true' : 'false')
  return NextResponse.json({ open: body.open }, { headers: CORS_HEADERS })
}

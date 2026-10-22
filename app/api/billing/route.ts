import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { validateBillingProfile } from '@/lib/invoice'

// Signed-in only (see POST); the open CORS headers let no one in without a session cookie for this site.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

// Create or update a buyer's GST/billing details. Requires a session: customers can only change their own (they
// normally do it on arcpem.com), admins may pass `email` to change any customer's. These details are printed on
// GST invoices, so they must never be writable by someone who merely knows an email address.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS })
    }

    const requestedEmail = typeof body.email === 'string' ? body.email : undefined
    const email = (session.user.role === 'ADMIN' && requestedEmail ? requestedEmail : session.user.email)?.trim().toLowerCase()
    if (!email) {
      return NextResponse.json({ error: 'email is required.' }, { status: 400, headers: CORS_HEADERS })
    }

    const user = await db.user.findUnique({ where: { email }, select: { id: true } })
    if (!user) {
      return NextResponse.json({ error: 'No account found for this email.' }, { status: 404, headers: CORS_HEADERS })
    }

    const validated = validateBillingProfile(body.billing ?? body)
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400, headers: CORS_HEADERS })
    }

    const data = { ...validated.data, email: validated.data.email ?? email }
    const profile = await db.billingProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...data },
      update: data,
    })

    return NextResponse.json({ success: true, billingProfile: profile }, { headers: CORS_HEADERS })
  } catch (err) {
    console.error('[POST /api/billing]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS_HEADERS })
  }
}

// Return the current user's billing profile (admins can pass ?email= to look up any user).
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS })
    }

    const requestedEmail = req.nextUrl.searchParams.get('email')?.trim().toLowerCase()
    const email =
      requestedEmail && session.user.role === 'ADMIN'
        ? requestedEmail
        : session.user.email?.toLowerCase()

    if (!email) {
      return NextResponse.json({ error: 'email is required.' }, { status: 400, headers: CORS_HEADERS })
    }

    const user = await db.user.findUnique({ where: { email }, select: { id: true } })
    if (!user) {
      return NextResponse.json({ billingProfile: null }, { headers: CORS_HEADERS })
    }

    const profile = await db.billingProfile.findUnique({ where: { userId: user.id } })
    return NextResponse.json({ billingProfile: profile }, { headers: CORS_HEADERS })
  } catch (err) {
    console.error('[GET /api/billing]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS_HEADERS })
  }
}

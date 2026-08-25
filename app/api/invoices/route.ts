import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

// List invoice metadata (never the PDF bytes). Requires a session — admins may
// filter by ?email= to see any user's invoices; everyone else only ever sees
// their own (the ?email= param is ignored for non-admins, same pattern as
// GET /api/billing).
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS })
    }

    const requestedEmail = req.nextUrl.searchParams.get('email')?.trim().toLowerCase()
    const isAdmin = session.user.role === 'ADMIN'
    // Non-admins are always scoped to their own email (requestedEmail is
    // ignored for them). Admins may pass ?email= to scope to one user, or
    // omit it to see every invoice.
    const email = isAdmin ? requestedEmail : session.user.email?.toLowerCase()

    let userId: string | undefined
    if (email) {
      const user = await db.user.findUnique({ where: { email }, select: { id: true } })
      if (!user) return NextResponse.json({ invoices: [] }, { headers: CORS_HEADERS })
      userId = user.id
    }

    const invoices = await db.invoice.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { issuedAt: 'desc' },
      // Omit the `pdf` Bytes field from list responses.
      select: {
        id: true,
        invoiceNumber: true,
        userId: true,
        planName: true,
        buyerName: true,
        placeOfSupply: true,
        taxableAmount: true,
        cgst: true,
        sgst: true,
        igst: true,
        total: true,
        currency: true,
        issuedAt: true,
      },
    })

    return NextResponse.json({ invoices }, { headers: CORS_HEADERS })
  } catch (err) {
    console.error('[GET /api/invoices]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS_HEADERS })
  }
}

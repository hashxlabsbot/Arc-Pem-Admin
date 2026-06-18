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

// List invoice metadata (never the PDF bytes). Admins see all (or filter by ?email=);
// the purchase app / a user passes ?email= to list that user's invoices.
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase()
    const isAdmin = session?.user?.role === 'ADMIN'

    let userId: string | undefined
    if (!isAdmin) {
      // Non-admins must scope to a specific user (their own email or the one provided).
      const scopedEmail = email ?? session?.user?.email?.toLowerCase()
      if (!scopedEmail) {
        return NextResponse.json({ error: 'email is required.' }, { status: 400, headers: CORS_HEADERS })
      }
      const user = await db.user.findUnique({ where: { email: scopedEmail }, select: { id: true } })
      if (!user) return NextResponse.json({ invoices: [] }, { headers: CORS_HEADERS })
      userId = user.id
    } else if (email) {
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

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { invoiceFileName } from '@/lib/invoice'

// pdf bytes are stored via Prisma (Bytes) — needs the Node runtime.
export const runtime = 'nodejs'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const invoice = await db.invoice.findUnique({
      where: { id: params.id },
      include: { user: { select: { email: true } } },
    })
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404, headers: CORS_HEADERS })
    }

    // Authorize: admin → any; owner session → own; else the purchase app may pass
    // ?email= that must match the invoice owner (invoice ids are unguessable cuids).
    const session = await getServerSession(authOptions)
    const reqEmail = req.nextUrl.searchParams.get('email')?.trim().toLowerCase()
    const ownerEmail = invoice.user.email.toLowerCase()
    const sessionEmail = session?.user?.email?.toLowerCase()

    const allowed =
      session?.user?.role === 'ADMIN' ||
      (sessionEmail && sessionEmail === ownerEmail) ||
      (reqEmail && reqEmail === ownerEmail)

    if (!allowed) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS })
    }

    return new NextResponse(Buffer.from(invoice.pdf), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoiceFileName(invoice.invoiceNumber)}"`,
      },
    })
  } catch (err) {
    console.error('[GET /api/invoices/[id]/download]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS_HEADERS })
  }
}

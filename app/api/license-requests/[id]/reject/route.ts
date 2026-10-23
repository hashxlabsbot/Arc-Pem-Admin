/**
 * POST /api/license-requests/[id]/reject
 * Admin rejects a pending machine ID / license request, optionally with a reason.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { sendLicenseRequestRejectionEmail } from '@/lib/email'
import { logActivity } from '@/lib/activity'

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const licReq = await db.licenseRequest.findUnique({ where: { id: params.id } })
    if (!licReq) {
      return NextResponse.json({ error: 'License request not found' }, { status: 404 })
    }
    if (licReq.status !== 'pending') {
      return NextResponse.json({ error: `Request is already ${licReq.status}` }, { status: 409 })
    }

    const body   = await req.json().catch(() => ({}))
    const reason = (body as { reason?: string }).reason

    await db.licenseRequest.update({
      where: { id: params.id },
      data:  { status: 'rejected' },
    })

    await logActivity('REJECT', 'LicenseRequest', params.id, `Rejected request from ${licReq.email}${reason ? ': ' + reason : ''}`)

    // Notify the user — fire-and-forget, rejection is already saved.
    if (process.env.BREVO_API_KEY) {
      sendLicenseRequestRejectionEmail({ to: licReq.email, name: licReq.name, reason })
        .catch((err) => console.error('[reject-license-request] email failed:', err))
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[POST /api/license-requests/[id]/reject]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

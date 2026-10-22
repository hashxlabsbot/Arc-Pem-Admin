/**
 * POST /api/license-requests/[id]/approve
 *
 * Admin reviews a pending machine ID request and issues a license.
 * Flow:
 *  1. Load the LicenseRequest
 *  2. Find (or create) the Client by email
 *  3. Look up the subscriber's Plan for features / limits
 *  4. Generate RSA-signed license with full plan metadata embedded
 *  5. Persist License row + link it to the LicenseRequest
 *  6. Email the .lic file to the client
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { generateLicenseKey, licenseFileName, buildLicenseFile } from '@/lib/license'
import { sendLicenseEmail } from '@/lib/email'
import { logActivity } from '@/lib/activity'

export const runtime = 'nodejs'

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const licenseRequestId = params.id

    // Admin can optionally override seats and expiry; defaults are derived from the plan.
    const body    = await req.json().catch(() => ({}))
    const { seats: seatsOverride, expiry: expiryOverride, notes } = body as {
      seats?:  number
      expiry?: string   // YYYY-MM-DD, defaults to 1 year from today
      notes?:  string
    }

    // ── 1. Load the request ──────────────────────────────────────────────────
    const licReq = await db.licenseRequest.findUnique({ where: { id: licenseRequestId } })
    if (!licReq) {
      return NextResponse.json({ error: 'License request not found' }, { status: 404 })
    }
    if (licReq.status !== 'pending') {
      return NextResponse.json({ error: `Request is already ${licReq.status}` }, { status: 409 })
    }

    // ── 2. Find or create Client ─────────────────────────────────────────────
    let client = await db.client.findUnique({ where: { email: licReq.email } })
    if (!client) {
      // If no client exists yet (edge case: request arrived before payment was processed)
      // create a minimal client record so the license can be issued.
      client = await db.client.create({
        data: {
          name:          licReq.name,
          email:         licReq.email,
          status:        'active',
          paymentStatus: 'pending',
          plan:          'standard',
        },
      })
      await logActivity('CREATE', 'Client', client.id, `Auto-created client for license request ${licenseRequestId}`)
    }

    // ── 3. Resolve plan details from the subscriber record ───────────────────
    const user = await db.user.findUnique({
      where:   { email: licReq.email },
      include: { plan: true },
    })
    const plan = user?.plan

    // ── 4. Build expiry date ─────────────────────────────────────────────────
    let expiryDate: string
    if (expiryOverride) {
      expiryDate = expiryOverride.split('T')[0]
    } else if (plan?.period === 'year' || plan?.period === 'yearly') {
      const d = new Date()
      d.setFullYear(d.getFullYear() + 1)
      expiryDate = d.toISOString().split('T')[0]
    } else {
      // Default: 1 month from today
      const d = new Date()
      d.setMonth(d.getMonth() + 1)
      expiryDate = d.toISOString().split('T')[0]
    }

    const seatCount = seatsOverride ?? 1

    // ── 5. Generate the enriched license ─────────────────────────────────────
    const features: string[] = plan?.features
      ? (() => { try { return JSON.parse(plan.features) } catch { return [] } })()
      : []

    const licenseKey = generateLicenseKey({
      client:      client.name,
      email:       client.email,
      plan:        plan?.name        ?? client.plan,
      planPeriod:  plan?.period      ?? 'monthly',
      features,
      maxProjects: plan?.maxProjects ?? 10,
      maxUsers:    plan?.maxUsers    ?? 1,
      seats:       seatCount,
      expiry:      expiryDate,
      machineId:   licReq.machineId,
    })

    const fileName  = licenseFileName(client.name, expiryDate)
    const licenseFileContent = buildLicenseFile(licenseKey, {
      client:      client.name,
      email:       client.email,
      plan:        plan?.name        ?? client.plan,
      planPeriod:  plan?.period      ?? 'monthly',
      features,
      maxProjects: plan?.maxProjects ?? 10,
      maxUsers:    plan?.maxUsers    ?? 1,
      seats:       seatCount,
      expiry:      expiryDate,
      machineId:   licReq.machineId,
      issued:      new Date().toISOString().split('T')[0],
    })

    // ── 6. Persist License row ───────────────────────────────────────────────
    const license = await db.license.create({
      data: {
        clientId:   client.id,
        machineId:  licReq.machineId,
        seats:      seatCount,
        expiry:     new Date(expiryDate),
        licenseKey,
        fileName,
        notes:      notes ?? licReq.notes ?? null,
        status:     'active',
      },
    })

    // Link the license to the request and mark it approved.
    await db.licenseRequest.update({
      where: { id: licenseRequestId },
      data:  {
        status:    'approved',
        licenseId: license.id,
        clientId:  client.id,
      },
    })

    await logActivity('APPROVE', 'LicenseRequest', licenseRequestId, `Issued license ${license.id} for ${licReq.email}`)
    await logActivity('GENERATE', 'License', license.id, `Generated via request for ${client.name}`)

    // ── 7. Email the .lic file ────────────────────────────────────────────────
    let emailSent = false
    let emailError: string | undefined
    if (process.env.BREVO_API_KEY) {
      try {
        await sendLicenseEmail({
          to:       client.email,
          name:     client.name,
          planName: plan?.name ?? client.plan,
          expiry:   expiryDate,
          licenseFile: {
            fileName,
            content: Buffer.from(licenseFileContent).toString('base64'),
          },
        })
        emailSent = true
      } catch (err) {
        console.error('[approve-license-request] email failed:', err)
        emailError = err instanceof Error ? err.message : String(err)
      }
    }

    return NextResponse.json({
      success: true,
      licenseId: license.id,
      fileName,
      clientId: client.id,
      expiry: expiryDate,
      emailSent,
      emailError,
    })
  } catch (err) {
    console.error('[POST /api/license-requests/[id]/approve]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

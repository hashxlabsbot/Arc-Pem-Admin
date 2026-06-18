import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { generateLicenseKey, licenseFileName } from '@/lib/license'
import { logActivity } from '@/lib/activity'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { expiry } = body

    if (!expiry) {
      return NextResponse.json({ error: 'expiry is required' }, { status: 400 })
    }

    const expiryMs = new Date(expiry).getTime()
    if (isNaN(expiryMs)) {
      return NextResponse.json({ error: 'expiry is not a valid date' }, { status: 400 })
    }
    if (expiryMs <= Date.now()) {
      return NextResponse.json({ error: 'expiry must be a future date' }, { status: 400 })
    }

    const existing = await db.license.findUnique({
      where:   { id: params.id },
      include: { client: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'License not found' }, { status: 404 })
    }

    // Re-fetch plan details so the extended license carries up-to-date metadata.
    const user = await db.user.findUnique({
      where:   { email: existing.client.email },
      include: { plan: true },
    })
    const plan = user?.plan
    const features: string[] = plan?.features
      ? (() => { try { return JSON.parse(plan.features) } catch { return [] } })()
      : []

    const expiryDate = expiry.split('T')[0]
    const licenseKey = generateLicenseKey({
      client:      existing.client.name,
      email:       existing.client.email,
      plan:        plan?.name        ?? existing.client.plan,
      planPeriod:  plan?.period      ?? 'monthly',
      features,
      maxProjects: plan?.maxProjects ?? 10,
      maxUsers:    plan?.maxUsers    ?? 1,
      seats:       existing.seats,
      expiry:      expiryDate,
      machineId:   existing.machineId,
    })

    const newFileName = licenseFileName(existing.client.name, expiryDate)

    const license = await db.license.update({
      where: { id: params.id },
      data: {
        expiry: new Date(expiry),
        licenseKey,
        fileName: newFileName,
        status: 'active',
      },
      include: { client: { select: { name: true } } },
    })

    await logActivity('EXTEND', 'License', license.id, `Extended license for ${license.client.name} to ${expiryDate}`)

    return NextResponse.json({ license })
  } catch (err) {
    console.error('[PATCH /api/licenses/[id]/extend]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

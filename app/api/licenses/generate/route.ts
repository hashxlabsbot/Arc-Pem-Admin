import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { generateLicenseKey, licenseFileName } from '@/lib/license'
import { logActivity } from '@/lib/activity'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { clientId, machineId, seats, expiry, notes } = body

    if (!clientId || !machineId || !expiry) {
      return NextResponse.json({ error: 'clientId, machineId, and expiry are required' }, { status: 400 })
    }

    const seatCount = Number(seats)
    if (!Number.isInteger(seatCount) || seatCount < 1) {
      return NextResponse.json({ error: 'seats must be a positive integer' }, { status: 400 })
    }

    const client = await db.client.findUnique({ where: { id: clientId } })
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Fetch the subscriber's plan details so the license carries feature/limit metadata.
    // Look up the User by email (the client was mirrored from the User on payment approval).
    const user = await db.user.findUnique({
      where:   { email: client.email },
      include: { plan: true },
    })
    const plan = user?.plan

    const expiryDate = expiry.split('T')[0]
    const licenseKey = generateLicenseKey({
      client:      client.name,
      email:       client.email,
      plan:        plan?.name        ?? client.plan,
      planPeriod:  plan?.period      ?? 'monthly',
      features:    plan?.features    ? JSON.parse(plan.features) : [],
      maxProjects: plan?.maxProjects ?? 10,
      maxUsers:    plan?.maxUsers    ?? 1,
      seats:       seatCount,
      expiry:      expiryDate,
      machineId,
    })

    const fileName = licenseFileName(client.name, expiryDate)

    const license = await db.license.create({
      data: {
        clientId,
        machineId,
        seats: seatCount,
        expiry: new Date(expiry),
        licenseKey,
        fileName,
        notes: notes || null,
        status: 'active',
      },
      include: { client: { select: { name: true, email: true } } },
    })

    await logActivity('GENERATE', 'License', license.id, `Generated license for ${client.name}`)

    return NextResponse.json({ license }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/licenses/generate]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

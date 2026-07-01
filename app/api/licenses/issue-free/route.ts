import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import bcrypt from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { generateLicenseKey, buildLicenseFile, licenseFileName } from '@/lib/license'
import type { LicensePayload } from '@/lib/license'
import { logActivity } from '@/lib/activity'
import { sendFreeLicenseEmail } from '@/lib/email'

export const runtime = 'nodejs'

function generateTempPassword(): string {
  const upper   = 'ABCDEFGHJKMNPQRSTUVWXYZ'
  const lower   = 'abcdefghjkmnpqrstuvwxyz'
  const digits  = '23456789'
  const special = '!@#$'
  const all     = upper + lower + digits + special
  const rand    = (s: string) => s[Math.floor(Math.random() * s.length)]
  const pw      = [rand(upper), rand(lower), rand(digits), rand(special)]
  for (let i = 4; i < 12; i++) pw.push(rand(all))
  for (let i = pw.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pw[i], pw[j]] = [pw[j], pw[i]]
  }
  return pw.join('')
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { name, email, planId, expiry, seats, machineIds, notes, createUser, phone, company } = body

    if (!name || !email || !planId || !expiry || !Array.isArray(machineIds) || machineIds.length === 0) {
      return NextResponse.json(
        { error: 'name, email, planId, expiry, and machineIds are required' },
        { status: 400 },
      )
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }
    const seatCount = Number(seats)
    if (!Number.isInteger(seatCount) || seatCount < 1) {
      return NextResponse.json({ error: 'seats must be a positive integer' }, { status: 400 })
    }
    const emptyIdx = (machineIds as string[]).findIndex(id => !id.trim())
    if (emptyIdx !== -1) {
      return NextResponse.json({ error: `Machine ID ${emptyIdx + 1} is required` }, { status: 400 })
    }

    const plan = await db.plan.findUnique({ where: { id: planId } })
    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })

    const normalizedEmail = email.trim().toLowerCase()
    const expiryDate      = (expiry as string).split('T')[0]
    const machineId       = (machineIds as string[]).map(id => id.trim()).join(' | ')

    // Create or update the Client record, marking as a free/complimentary account.
    const client = await db.client.upsert({
      where:  { email: normalizedEmail },
      create: {
        name,
        email:         normalizedEmail,
        phone:         phone  || null,
        company:       company || null,
        plan:          plan.name.toLowerCase(),
        status:        'active',
        paymentStatus: 'free',
        notes:         notes || null,
      },
      update: {
        plan:          plan.name.toLowerCase(),
        status:        'active',
        paymentStatus: 'free',
        ...(phone   ? { phone }   : {}),
        ...(company ? { company } : {}),
      },
    })

    // Optionally provision a User account so the client can log into the dashboard.
    let userCreated  = false
    let tempPassword: string | undefined
    if (createUser) {
      const existing = await db.user.findUnique({ where: { email: normalizedEmail } })
      if (!existing) {
        tempPassword = generateTempPassword()
        const hashed = await bcrypt.hash(tempPassword, 10)
        await db.user.create({
          data: {
            name,
            email:        normalizedEmail,
            password:     hashed,
            role:         'USER',
            status:       'ACTIVE',
            planId:       plan.id,
            planExpiresAt: new Date(expiry),
          },
        })
        userCreated = true
      } else {
        // Existing user — just assign the plan and extend expiry to the license term.
        await db.user.update({
          where: { email: normalizedEmail },
          data:  { planId: plan.id, planExpiresAt: new Date(expiry) },
        })
      }
    }

    // Generate the signed license key.
    const licenseKey = generateLicenseKey({
      client:      name,
      email:       normalizedEmail,
      plan:        plan.name,
      planPeriod:  plan.period ?? 'yearly',
      features:    plan.features ? (JSON.parse(plan.features) as string[]) : [],
      maxProjects: plan.maxProjects,
      maxUsers:    plan.maxUsers,
      seats:       seatCount,
      expiry:      expiryDate,
      machineId,
    })

    const fileName = licenseFileName(name, expiryDate)

    const license = await db.license.create({
      data: {
        clientId:  client.id,
        machineId,
        seats:     seatCount,
        expiry:    new Date(expiry),
        licenseKey,
        fileName,
        notes:     notes || null,
        status:    'active',
      },
      include: { client: { select: { name: true, email: true } } },
    })

    await logActivity(
      'FREE_LICENSE', 'License', license.id,
      `Issued free license to ${name} (${normalizedEmail}) — ${plan.name} plan, expires ${expiryDate}`,
    )

    // Build the .lic file and email it. We decode the payload directly from the key
    // rather than re-constructing it so the content is always consistent.
    const payloadJson = Buffer.from(licenseKey.split('.')[0], 'base64').toString('utf-8')
    const licPayload  = JSON.parse(payloadJson) as LicensePayload
    const licContent  = buildLicenseFile(licenseKey, licPayload)
    const licBase64   = Buffer.from(licContent).toString('base64')

    let emailSent = false
    try {
      await sendFreeLicenseEmail({
        to:          normalizedEmail,
        name,
        planName:    plan.name,
        expiry:      expiryDate,
        licenseFile: { fileName, content: licBase64 },
        ...(tempPassword ? { tempPassword, dashUrl: process.env.WEB_URL } : {}),
      })
      emailSent = true
    } catch (err) {
      console.error('[issue-free] email failed:', err)
    }

    return NextResponse.json(
      { license, clientId: client.id, userCreated, tempPassword, emailSent },
      { status: 201 },
    )
  } catch (err) {
    console.error('[POST /api/licenses/issue-free]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

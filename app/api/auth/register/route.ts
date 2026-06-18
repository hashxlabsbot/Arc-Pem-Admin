import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { sendWelcomeEmail } from '@/lib/email'
import { validatePassword } from '@/lib/password'
import { checkRateLimit, recordFailure } from '@/lib/rate-limit'
import { validateBillingProfile } from '@/lib/invoice'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, password, planId, planName, billing } = body

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required.' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    const normalizedEmail = email.trim().toLowerCase()

    // Throttle by both email and source IP so registration can't be spammed
    // either against one address or from one host across many addresses.
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      'unknown'
    const [emailRl, ipRl] = await Promise.all([
      checkRateLimit(`register:${normalizedEmail}`),
      checkRateLimit(`register-ip:${ip}`),
    ])
    if (!emailRl.allowed || !ipRl.allowed) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again in 15 minutes.' },
        { status: 429, headers: CORS_HEADERS }
      )
    }

    const pwCheck = validatePassword(password)
    if (!pwCheck.valid) {
      return NextResponse.json(
        { error: pwCheck.errors[0] },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    const existing = await db.user.findUnique({ where: { email: normalizedEmail } })
    if (existing) {
      await Promise.all([
        recordFailure(`register:${normalizedEmail}`),
        recordFailure(`register-ip:${ip}`),
      ])
      return NextResponse.json(
        { error: 'An account with this email already exists.' },
        { status: 409, headers: CORS_HEADERS }
      )
    }

    // Resolve plan: prefer explicit planId, fall back to name lookup
    let resolvedPlanId: string | undefined
    if (planId) {
      const plan = await db.plan.findUnique({ where: { id: planId } })
      if (plan) resolvedPlanId = plan.id
    } else if (planName) {
      const plans = await db.plan.findMany({ select: { id: true, name: true } })
      const match = plans.find((p) => p.name.toLowerCase() === planName.toLowerCase())
      if (match) resolvedPlanId = match.id
    }

    // Validate optional GST/billing details captured at purchase before creating anything.
    let billingData: ReturnType<typeof validateBillingProfile> | null = null
    if (billing) {
      billingData = validateBillingProfile(billing)
      if (!billingData.ok) {
        return NextResponse.json({ error: billingData.error }, { status: 400, headers: CORS_HEADERS })
      }
    }

    const hashed = await bcrypt.hash(password, 10)

    const user = await db.user.create({
      data: {
        name,
        email: normalizedEmail,
        password: hashed,
        role: 'USER',
        status: 'ACTIVE',
        ...(resolvedPlanId ? { planId: resolvedPlanId } : {}),
      },
    })

    // Persist GST/billing details captured at purchase, if provided.
    if (billingData?.ok) {
      await db.billingProfile.create({
        data: {
          userId: user.id,
          ...billingData.data,
          email: billingData.data.email ?? normalizedEmail,
        },
      })
    }

    // Send welcome email — fire-and-forget so a mail failure never blocks signup
    if (process.env.BREVO_API_KEY) {
      sendWelcomeEmail({ to: normalizedEmail, name, planName }).catch((err) =>
        console.error('[register] welcome email failed:', err)
      )
    }

    return NextResponse.json(
      { message: 'Account created successfully', userId: user.id },
      { status: 201, headers: CORS_HEADERS }
    )
  } catch (err) {
    console.error('[register]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS_HEADERS })
  }
}

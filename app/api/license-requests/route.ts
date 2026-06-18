/**
 * GET  /api/license-requests  — admin: list all requests with pagination + filters
 * POST /api/license-requests  — CORS-open: user submits machine ID from customer dashboard
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

// ── Admin: list all license requests ────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const page   = Math.max(1, parseInt(searchParams.get('page')   ?? '1', 10))
  const limit  = Math.min(100, parseInt(searchParams.get('limit') ?? '20', 10))
  const status = searchParams.get('status') ?? undefined   // pending | approved | rejected
  const search = searchParams.get('search')?.trim()        // name or email

  const where = {
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { name:  { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const [total, requests] = await Promise.all([
    db.licenseRequest.count({ where }),
    db.licenseRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip:    (page - 1) * limit,
      take:    limit,
      include: {
        client: { select: { id: true, name: true, plan: true } },
      },
    }),
  ])

  return NextResponse.json({ requests, total, page, limit })
}

// ── Customer dashboard: submit machine ID request ───────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, machineId, notes, userId } = body

    if (!name || !email || !machineId) {
      return NextResponse.json(
        { error: 'name, email, and machineId are required' },
        { status: 400, headers: CORS_HEADERS },
      )
    }

    const emailNorm = email.trim().toLowerCase()

    // Reject duplicate pending requests for the same email + machine combination.
    const duplicate = await db.licenseRequest.findFirst({
      where: { email: emailNorm, machineId, status: 'pending' },
    })
    if (duplicate) {
      return NextResponse.json(
        { error: 'A pending request already exists for this machine ID. Please wait for admin review.' },
        { status: 409, headers: CORS_HEADERS },
      )
    }

    // Try to link to an existing Client record so admin sees the context immediately.
    const client = await db.client.findUnique({
      where:  { email: emailNorm },
      select: { id: true },
    })

    const request = await db.licenseRequest.create({
      data: {
        name,
        email:     emailNorm,
        machineId,
        notes:     notes ?? null,
        userId:    userId ?? null,
        clientId:  client?.id ?? null,
        status:    'pending',
      },
    })

    await logActivity('CREATE', 'LicenseRequest', request.id, `License request from ${emailNorm} for machine ${machineId}`)

    return NextResponse.json(
      { success: true, requestId: request.id },
      { status: 201, headers: CORS_HEADERS },
    )
  } catch (err) {
    console.error('[POST /api/license-requests]', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}

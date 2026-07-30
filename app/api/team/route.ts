import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import bcrypt from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import { logger } from '@/lib/logger'
import { validatePassword } from '@/lib/password'
import { TEAM_ROLES, isTeamRole } from '@/lib/rbac'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 100

/** Internal staff directory (ADMIN + BLOG_EDITOR) — distinct from the customer /api/users list. ADMIN only. */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = req.nextUrl
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(searchParams.get('pageSize') ?? `${DEFAULT_PAGE_SIZE}`, 10) || DEFAULT_PAGE_SIZE),
    )
    const search = searchParams.get('search')?.trim() ?? ''

    const where: Prisma.UserWhereInput = { role: { in: [...TEAM_ROLES] } }
    if (search) {
      where.AND = [
        {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        },
      ]
    }

    const [team, total, admins, editors] = await Promise.all([
      db.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
      }),
      db.user.count({ where }),
      db.user.count({ where: { role: 'ADMIN' } }),
      db.user.count({ where: { role: 'BLOG_EDITOR' } }),
    ])

    return NextResponse.json({
      team,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      stats: { total: admins + editors, admins, editors },
    })
  } catch (err) {
    logger.error('GET /api/team failed', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** Create a staff account (ADMIN or BLOG_EDITOR) with an admin-chosen password. ADMIN only. */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const role = body.role

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email and password are all required.' }, { status: 400 })
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
    }
    if (!isTeamRole(role)) {
      return NextResponse.json({ error: 'Role must be Admin or Blog Editor.' }, { status: 400 })
    }
    const pwCheck = validatePassword(password)
    if (!pwCheck.valid) {
      return NextResponse.json({ error: pwCheck.errors[0] }, { status: 400 })
    }

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }

    const hashed = await bcrypt.hash(password, 10)
    const user = await db.user.create({
      data: { name, email, password: hashed, role, status: 'ACTIVE' },
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
    })

    await logActivity('CREATE', 'TeamMember', user.id, `Created team member: ${user.name} (${user.role})`)

    return NextResponse.json({ user }, { status: 201 })
  } catch (err) {
    logger.error('POST /api/team failed', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

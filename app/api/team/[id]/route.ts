import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import bcrypt from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import { logger } from '@/lib/logger'
import { validatePassword } from '@/lib/password'
import { isTeamRole } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

/** Update role/status/password for a staff account. ADMIN only; cannot target your own account (avoids self-lockout). */
export async function PATCH(req: NextRequest, props: Params) {
  const params = await props.params
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.id === params.id) {
      return NextResponse.json({ error: 'You cannot modify your own account from here.' }, { status: 400 })
    }

    const existing = await db.user.findUnique({ where: { id: params.id } })
    if (!existing || !isTeamRole(existing.role)) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 })
    }

    const body = await req.json()
    const updateData: { role?: string; status?: string; name?: string; password?: string } = {}

    if (body.role !== undefined) {
      if (!isTeamRole(body.role)) {
        return NextResponse.json({ error: 'Role must be Admin or Blog Editor.' }, { status: 400 })
      }
      updateData.role = body.role
    }
    if (body.status !== undefined) {
      if (body.status !== 'ACTIVE' && body.status !== 'SUSPENDED') {
        return NextResponse.json({ error: 'Status must be Active or Suspended.' }, { status: 400 })
      }
      updateData.status = body.status
    }
    if (body.name !== undefined) {
      const name = String(body.name).trim()
      if (!name) return NextResponse.json({ error: 'Name cannot be empty.' }, { status: 400 })
      updateData.name = name
    }
    if (body.password !== undefined) {
      const pwCheck = validatePassword(body.password)
      if (!pwCheck.valid) return NextResponse.json({ error: pwCheck.errors[0] }, { status: 400 })
      updateData.password = await bcrypt.hash(body.password, 10)
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    // Bump tokenVersion whenever the password or role changes so any live
    // session for this account is invalidated and re-checked on next request.
    const bumpsSession = updateData.password !== undefined || updateData.role !== undefined || updateData.status !== undefined
    const user = await db.user.update({
      where: { id: params.id },
      data: { ...updateData, ...(bumpsSession ? { tokenVersion: { increment: 1 } } : {}) },
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
    })

    await logActivity('UPDATE', 'TeamMember', user.id, `Updated team member: ${user.name}`)

    return NextResponse.json({ user })
  } catch (err) {
    logger.error('PATCH /api/team/[id] failed', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** Remove a staff account. ADMIN only; cannot target your own account. */
export async function DELETE(_req: NextRequest, props: Params) {
  const params = await props.params
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.id === params.id) {
      return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 })
    }

    const existing = await db.user.findUnique({ where: { id: params.id } })
    if (!existing || !isTeamRole(existing.role)) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 })
    }

    await db.user.delete({ where: { id: params.id } })
    await logActivity('DELETE', 'TeamMember', params.id, `Deleted team member: ${existing.name}`)

    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error('DELETE /api/team/[id] failed', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

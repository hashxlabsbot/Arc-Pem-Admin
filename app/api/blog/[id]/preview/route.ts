import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { signPreviewToken } from '@/lib/preview-token'
import { canManageBlog } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

/** Returns a short-lived signed preview URL on the marketing site for the admin editor's iframe. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || !canManageBlog(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const post = await db.blogPost.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  const base = (process.env.MARKETING_URL || 'http://localhost:3001').replace(/\/$/, '')
  const token = signPreviewToken(params.id)
  return NextResponse.json({ url: `${base}/blog/preview/${params.id}?token=${token}` })
}

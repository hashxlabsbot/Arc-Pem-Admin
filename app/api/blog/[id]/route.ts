import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import { logger } from '@/lib/logger'
import { buildBlogData } from '@/lib/blog-fields'
import { revalidateMarketingBlog } from '@/lib/blog-revalidate'
import { canManageBlog } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

async function requireBlogAccess() {
  const session = await getServerSession(authOptions)
  return !!session && canManageBlog(session.user.role)
}

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    if (!(await requireBlogAccess())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const post = await db.blogPost.findUnique({ where: { id: params.id } })
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    return NextResponse.json({ post })
  } catch (err) {
    logger.error('GET /api/blog/[id] failed', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    if (!(await requireBlogAccess())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const existing = await db.blogPost.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

    const body = await req.json()
    const data = buildBlogData(body)

    if (!data.title || !data.description || !data.contentMarkdown || !data.category) {
      return NextResponse.json(
        { error: 'Title, description, category and content are all required.' },
        { status: 400 },
      )
    }

    // Preserve the original publish date once set, rather than restamping it on every edit.
    if (existing.publishedAt && data.status === 'PUBLISHED' && !body.publishedAt) {
      data.publishedAt = existing.publishedAt
    }

    const post = await db.blogPost.update({ where: { id: params.id }, data })
    await logActivity('UPDATE', 'BlogPost', post.id, `Updated blog post: ${post.title}`)

    // Revalidate if it is (or was) public, and for the old slug too if it changed.
    if (post.status === 'PUBLISHED' || existing.status === 'PUBLISHED') {
      await revalidateMarketingBlog(post.slug)
      if (existing.slug !== post.slug) await revalidateMarketingBlog(existing.slug)
    }

    return NextResponse.json({ post })
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'A post with this URL slug already exists.' }, { status: 409 })
    }
    logger.error('PUT /api/blog/[id] failed', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    if (!(await requireBlogAccess())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const post = await db.blogPost.findUnique({ where: { id: params.id } })
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

    await db.blogPost.delete({ where: { id: params.id } })
    await logActivity('DELETE', 'BlogPost', params.id, `Deleted blog post: ${post.title}`)

    if (post.status === 'PUBLISHED') await revalidateMarketingBlog(post.slug)

    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error('DELETE /api/blog/[id] failed', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

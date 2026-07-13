import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import { logger } from '@/lib/logger'
import { buildBlogData } from '@/lib/blog-fields'
import { revalidateMarketingBlog } from '@/lib/blog-revalidate'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 200

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
    const status = searchParams.get('status') ?? ''
    const category = searchParams.get('category') ?? ''

    const where: Prisma.BlogPostWhereInput = {}
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (status && status !== 'all') where.status = status.toUpperCase()
    if (category && category !== 'all') where.category = category

    const [posts, total, totalAll, publishedAll] = await Promise.all([
      db.blogPost.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, slug: true, title: true, category: true, status: true,
          featured: true, publishedAt: true, updatedAt: true,
        },
      }),
      db.blogPost.count({ where }),
      db.blogPost.count(),
      db.blogPost.count({ where: { status: 'PUBLISHED' } }),
    ])

    return NextResponse.json({
      posts,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      stats: { total: totalAll, published: publishedAll },
    })
  } catch (err) {
    logger.error('GET /api/blog failed', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const data = buildBlogData(body)

    if (!data.title || !data.description || !data.contentMarkdown || !data.category) {
      return NextResponse.json(
        { error: 'Title, description, category and content are all required.' },
        { status: 400 },
      )
    }
    if (!data.slug) {
      return NextResponse.json({ error: 'Could not derive a URL slug from the title.' }, { status: 400 })
    }

    const post = await db.blogPost.create({ data })
    await logActivity('CREATE', 'BlogPost', post.id, `Created blog post: ${post.title}`)

    if (post.status === 'PUBLISHED') await revalidateMarketingBlog(post.slug)

    return NextResponse.json({ post }, { status: 201 })
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'A post with this URL slug already exists.' }, { status: 409 })
    }
    logger.error('POST /api/blog failed', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const DAY_MS = 86_400_000

/** UTC start-of-day, `days` ago (0 = today). Matches the beacon's bucketing. */
function dayStart(daysAgo: number): Date {
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  return new Date(d.getTime() - daysAgo * DAY_MS)
}

const iso = (d: Date) => d.toISOString().slice(0, 10)

/**
 * Blog analytics for the admin dashboard: all-time totals, a daily views/uniques
 * series over the requested window, and a per-post leaderboard. ADMIN only.
 * Query: ?days=7|30|90 (default 30), ?slug= (optional, filters the series).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = req.nextUrl
    const days = Math.min(365, Math.max(1, parseInt(searchParams.get('days') ?? '30', 10) || 30))
    const slug = searchParams.get('slug')?.trim() || undefined
    const since = dayStart(days - 1)

    const [totalAgg, windowRows, postGroups, posts] = await Promise.all([
      // All-time totals.
      db.blogPostView.aggregate({ _sum: { views: true, uniques: true } }),
      // Daily rows within the window (optionally for one post).
      db.blogPostView.findMany({
        where: { date: { gte: since }, ...(slug ? { slug } : {}) },
        select: { date: true, views: true, uniques: true },
        orderBy: { date: 'asc' },
      }),
      // Per-post view/unique totals within the window.
      db.blogPostView.groupBy({
        by: ['slug'],
        where: { date: { gte: since } },
        _sum: { views: true, uniques: true },
      }),
      // Post metadata for the leaderboard.
      db.blogPost.findMany({
        select: { slug: true, title: true, status: true, viewCount: true, publishedAt: true },
      }),
    ])

    // Fill a zero-based daily series so the chart has no gaps.
    const byDay = new Map<string, { views: number; uniques: number }>()
    for (const r of windowRows) {
      const k = iso(r.date)
      const cur = byDay.get(k) ?? { views: 0, uniques: 0 }
      cur.views += r.views
      cur.uniques += r.uniques
      byDay.set(k, cur)
    }
    const series = Array.from({ length: days }, (_, i) => {
      const k = iso(dayStart(days - 1 - i))
      const v = byDay.get(k) ?? { views: 0, uniques: 0 }
      return { date: k, views: v.views, uniques: v.uniques }
    })

    // Leaderboard: join post meta with windowed totals; sort by all-time views.
    const windowBySlug = new Map(postGroups.map((g) => [g.slug, g._sum]))
    const leaderboard = posts
      .map((p) => {
        const w = windowBySlug.get(p.slug)
        return {
          slug: p.slug,
          title: p.title,
          status: p.status,
          totalViews: p.viewCount,
          windowViews: w?.views ?? 0,
          windowReach: w?.uniques ?? 0,
          publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
        }
      })
      .sort((a, b) => b.totalViews - a.totalViews)

    const published = posts.filter((p) => p.status === 'PUBLISHED').length
    const totalViews = totalAgg._sum.views ?? 0

    return NextResponse.json({
      totals: {
        views: totalViews,
        reach: totalAgg._sum.uniques ?? 0,
        publishedPosts: published,
        avgViews: published ? Math.round(totalViews / published) : 0,
      },
      series,
      posts: leaderboard,
      days,
      slug: slug ?? null,
    })
  } catch (err) {
    logger.error('GET /api/blog/analytics failed', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

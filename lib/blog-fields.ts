import type { Prisma } from '@prisma/client'

export type FaqItem = { q: string; a: string }
export type HowtoStep = { name: string; text: string }
export type Howto = { name: string; description?: string; steps: HowtoStep[] }

/** "GST & Compliance" -> "gst-and-compliance" (kept in sync with the marketing app's slugifyCategory). */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/** Normalise/validate the FAQ JSON before storing — drops empty rows, returns null if none. */
export function cleanFaq(raw: unknown): FaqItem[] | null {
  if (!Array.isArray(raw)) return null
  const items = raw
    .filter((r): r is FaqItem => !!r && typeof r === 'object' && typeof (r as FaqItem).q === 'string')
    .map((r) => ({ q: r.q.trim(), a: String(r.a ?? '').trim() }))
    .filter((r) => r.q && r.a)
  return items.length ? items : null
}

/** Normalise/validate the HowTo JSON before storing — returns null if incomplete. */
export function cleanHowto(raw: unknown): Howto | null {
  if (!raw || typeof raw !== 'object') return null
  const h = raw as Partial<Howto>
  if (!h.name || typeof h.name !== 'string' || !Array.isArray(h.steps)) return null
  const steps = h.steps
    .filter((s): s is HowtoStep => !!s && typeof s === 'object' && typeof s.name === 'string')
    .map((s) => ({ name: s.name.trim(), text: String(s.text ?? '').trim() }))
    .filter((s) => s.name && s.text)
  if (!steps.length) return null
  return { name: h.name.trim(), description: h.description?.trim() || undefined, steps }
}

/** Build the Prisma data payload for create/update from a request body. */
export function buildBlogData(body: Record<string, unknown>): Prisma.BlogPostUncheckedCreateInput {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const strOrNull = (v: unknown) => {
    const s = typeof v === 'string' ? v.trim() : ''
    return s || null
  }
  const arr = (v: unknown) =>
    Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : []

  const title = str(body.title)
  const status = body.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT'
  const publishedAtRaw = strOrNull(body.publishedAt)
  const updatedDateRaw = strOrNull(body.updatedDate)

  return {
    slug: str(body.slug) || slugify(title),
    title,
    description: str(body.description),
    contentMarkdown: typeof body.contentMarkdown === 'string' ? body.contentMarkdown : '',
    category: str(body.category),
    tags: arr(body.tags),
    authorName: strOrNull(body.authorName),
    authorRole: strOrNull(body.authorRole),
    coverImage: strOrNull(body.coverImage),
    coverImageAlt: strOrNull(body.coverImageAlt),
    seoTitle: strOrNull(body.seoTitle),
    featured: Boolean(body.featured),
    status,
    // Stamp a publish date the first time it goes live if none supplied.
    publishedAt: publishedAtRaw ? new Date(publishedAtRaw) : status === 'PUBLISHED' ? new Date() : null,
    updatedDate: updatedDateRaw ? new Date(updatedDateRaw) : null,
    relatedTools: arr(body.relatedTools),
    relatedPosts: arr(body.relatedPosts),
    faq: (cleanFaq(body.faq) ?? undefined) as Prisma.InputJsonValue | undefined,
    howto: (cleanHowto(body.howto) ?? undefined) as Prisma.InputJsonValue | undefined,
  }
}

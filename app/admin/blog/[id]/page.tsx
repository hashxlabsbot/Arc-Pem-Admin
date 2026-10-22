import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import BlogEditor, { type BlogFormData } from '../BlogEditor'

export const dynamic = 'force-dynamic'
export const dynamicParams = true

// Explicitly declare "no pre-rendered params — render every id on demand". Without
// this, next build's page-data collector runs isPageStatic on this dynamic segment
// under the async, redirect()-ing admin layout and crashes trying to load /_document
// (a Next 14 build bug). Returning [] makes the route fully dynamic and skips it.
export function generateStaticParams(): { id: string }[] {
  return []
}

function toDateInput(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : ''
}

export default async function EditBlogPostPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const post = await db.blogPost.findUnique({ where: { id: params.id } })
  if (!post) notFound()

  const faq = Array.isArray(post.faq) ? (post.faq as { q: string; a: string }[]) : []
  const howto = post.howto && typeof post.howto === 'object' && !Array.isArray(post.howto)
    ? (post.howto as BlogFormData['howto'])
    : null

  const initial: BlogFormData = {
    id: post.id,
    slug: post.slug,
    title: post.title,
    description: post.description,
    contentMarkdown: post.contentMarkdown,
    category: post.category,
    tags: post.tags,
    authorName: post.authorName ?? '',
    authorRole: post.authorRole ?? '',
    coverImage: post.coverImage ?? '',
    coverImageAlt: post.coverImageAlt ?? '',
    seoTitle: post.seoTitle ?? '',
    featured: post.featured,
    status: post.status,
    publishedAt: toDateInput(post.publishedAt),
    updatedDate: toDateInput(post.updatedDate),
    relatedTools: post.relatedTools,
    relatedPosts: post.relatedPosts,
    faq,
    howto,
  }

  return <BlogEditor initial={initial} mode="edit" />
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileText, Plus, Search, Pencil, Trash2, Star, ExternalLink } from 'lucide-react'
import { usePaginatedList } from '@/lib/use-paginated-list'
import { Pagination } from '@/components/admin/Pagination'
import { BLOG_CATEGORIES } from '@/lib/blog-constants'

interface Post {
  id: string
  slug: string
  title: string
  category: string
  status: string
  featured: boolean
  publishedAt: string | null
  updatedAt: string
}

const STATUS_BADGE: Record<string, string> = {
  PUBLISHED: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  DRAFT: 'bg-amber-50 text-amber-700 border border-amber-100',
}

const MARKETING_URL = process.env.NEXT_PUBLIC_MARKETING_URL || 'https://arcpem.com'

export default function BlogListPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const {
    items: posts,
    pagination,
    stats,
    loading,
    setPage,
    refresh,
  } = usePaginatedList<Post>({
    url: '/api/blog',
    itemsKey: 'posts',
    search,
    filters: { status: statusFilter, category: categoryFilter },
  })

  async function confirmDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      await fetch(`/api/blog/${deleteId}`, { method: 'DELETE' })
      setDeleteId(null)
      refresh()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileText size={20} className="text-blue-500" /> Blog
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {stats.total ?? 0} posts · {stats.published ?? 0} published
          </p>
        </div>
        <Link
          href="/admin/blog/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
        >
          <Plus size={16} /> New Post
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search posts…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
        >
          <option value="all">All statuses</option>
          <option value="PUBLISHED">Published</option>
          <option value="DRAFT">Draft</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
        >
          <option value="all">All categories</option>
          {BLOG_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
              <th className="px-5 py-3">Title</th>
              <th className="px-5 py-3">Category</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Published</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-400">Loading…</td></tr>
            ) : posts.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-400">No posts yet. Create your first one.</td></tr>
            ) : (
              posts.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-gray-50 hover:bg-gray-50/60 transition cursor-pointer"
                  onClick={() => router.push(`/admin/blog/${p.id}`)}
                >
                  <td className="px-5 py-3 font-medium text-gray-900">
                    <span className="flex items-center gap-2">
                      {p.featured && <Star size={13} className="text-amber-400 fill-amber-400" />}
                      {p.title}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{p.category}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[p.status] ?? ''}`}>
                      {p.status === 'PUBLISHED' ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">
                    {p.publishedAt ? new Date(p.publishedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {p.status === 'PUBLISHED' && (
                        <a href={`${MARKETING_URL}/blog/${p.slug}`} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition" title="View live">
                          <ExternalLink size={15} />
                        </a>
                      )}
                      <Link href={`/admin/blog/${p.id}`}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition" title="Edit">
                        <Pencil size={15} />
                      </Link>
                      <button onClick={() => setDeleteId(p.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition" title="Delete">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pagination pagination={pagination} onPageChange={setPage} label="post" />
      </div>

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDeleteId(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 mb-1">Delete this post?</h3>
            <p className="text-sm text-gray-500 mb-5">This permanently removes the post. This can’t be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
              <button onClick={confirmDelete} disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-60">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

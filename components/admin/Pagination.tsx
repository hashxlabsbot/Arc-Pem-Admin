'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Pagination as PaginationData } from '@/lib/use-paginated-list'

interface Props {
  pagination: PaginationData
  onPageChange: (page: number) => void
  /** Singular noun for the count label, e.g. "client". */
  label?: string
}

export function Pagination({ pagination, onPageChange, label = 'item' }: Props) {
  const { page, pageSize, total, totalPages } = pagination
  if (totalPages <= 1) return null

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
      <p className="text-sm text-gray-500">
        Showing {from}–{to} of {total} {label}
        {total === 1 ? '' : 's'}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition"
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm text-gray-600 px-1">
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition"
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

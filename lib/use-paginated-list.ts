'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

interface Options {
  /** Base API path, e.g. '/api/clients'. */
  url: string
  /** Key under which the array lives in the response, e.g. 'clients'. */
  itemsKey: string
  /** Raw search box value (debounced internally). */
  search: string
  /** Extra query params (status, plan, …). 'all'/'ALL' are passed through; the API ignores them. */
  filters?: Record<string, string>
  pageSize?: number
}

interface Result<T> {
  items: T[]
  pagination: Pagination
  stats: Record<string, number>
  loading: boolean
  page: number
  setPage: (n: number) => void
  /** Re-fetch the current page (call after a create/update/delete). */
  refresh: () => void
}

/**
 * Drives a server-paginated, server-filtered list. Debounces the search box,
 * resets to page 1 when the query changes, and guards against out-of-order
 * responses so a slow earlier request can't overwrite a newer one.
 */
export function usePaginatedList<T>({
  url,
  itemsKey,
  search,
  filters = {},
  pageSize = 50,
}: Options): Result<T> {
  const [items, setItems] = useState<T[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize, total: 0, totalPages: 1 })
  const [stats, setStats] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [debouncedSearch, setDebouncedSearch] = useState(search)
  const [nonce, setNonce] = useState(0)

  // Debounce search input.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  const filtersKey = JSON.stringify(filters)

  // Reset to first page whenever the query (search/filters) changes.
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, filtersKey])

  const reqId = useRef(0)

  useEffect(() => {
    const myReq = ++reqId.current
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (debouncedSearch) params.set('search', debouncedSearch)
    for (const [k, v] of Object.entries(JSON.parse(filtersKey) as Record<string, string>)) {
      if (v) params.set(k, v)
    }

    fetch(`${url}?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (myReq !== reqId.current) return
        setItems(data[itemsKey] ?? [])
        if (data.pagination) setPagination(data.pagination)
        if (data.stats) setStats(data.stats)
      })
      .catch(() => {
        if (myReq === reqId.current) setItems([])
      })
      .finally(() => {
        if (myReq === reqId.current) setLoading(false)
      })
  }, [url, itemsKey, page, pageSize, debouncedSearch, filtersKey, nonce])

  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  return { items, pagination, stats, loading, page, setPage, refresh }
}

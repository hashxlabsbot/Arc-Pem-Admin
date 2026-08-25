import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { buildUserWhere } from '../helpers'
import { logger } from '@/lib/logger'

// Authenticated, per-request endpoint — never statically prerender.
export const dynamic = 'force-dynamic'

// Stream the CSV in cursor-paged batches so exporting a large, filtered set
// never loads the whole table into memory at once.
const BATCH = 1000

// Formula-injection guard: a cell starting with = + - @ (or tab/CR, which
// some spreadsheet apps also treat as a formula prefix) is opened by Excel/
// Sheets as a live formula rather than text. Values here come from
// user-supplied fields (name, email), so prefix those characters with a
// leading apostrophe to force text interpretation before quoting.
const FORMULA_PREFIX_RE = /^[=+\-@\t\r]/

function csvCell(value: unknown): string {
  let str = String(value ?? '')
  if (FORMULA_PREFIX_RE.test(str)) str = `'${str}`
  return `"${str.replace(/"/g, '""')}"`
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const where = buildUserWhere(req.nextUrl.searchParams)
  const header = ['Name', 'Email', 'Role', 'Status', 'Plan', 'Joined']

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(header.map(csvCell).join(',') + '\n'))

        let cursor: string | undefined
        // Keyset pagination by id keeps each batch O(BATCH) regardless of offset.
        for (;;) {
          const batch = await db.user.findMany({
            where,
            include: { plan: { select: { name: true } } },
            orderBy: { id: 'asc' },
            take: BATCH,
            ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          })
          if (batch.length === 0) break

          const chunk = batch
            .map((u) =>
              [u.name, u.email, u.role, u.status, u.plan?.name ?? 'No Plan', formatDate(u.createdAt)]
                .map(csvCell)
                .join(',')
            )
            .join('\n')
          controller.enqueue(encoder.encode(chunk + '\n'))

          if (batch.length < BATCH) break
          cursor = batch[batch.length - 1].id
        }
        controller.close()
      } catch (err) {
        logger.error('GET /api/users/export failed', err)
        controller.error(err)
      }
    },
  })

  const filename = `arc-pem-users-${new Date().toISOString().slice(0, 10)}.csv`
  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

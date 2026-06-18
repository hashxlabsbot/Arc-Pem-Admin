import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// Liveness/readiness probe for load balancers and uptime monitors.
// Verifies the process is up AND can reach the database.
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ok', db: 'up', ts: new Date().toISOString() })
  } catch (err) {
    logger.error('health check failed', err)
    return NextResponse.json(
      { status: 'error', db: 'down', ts: new Date().toISOString() },
      { status: 503 }
    )
  }
}

import { PrismaClient } from '@prisma/client'
import './env' // validate environment on first import

// Reuse a single PrismaClient across hot-reloads in dev and across the module
// graph in prod. With PostgreSQL behind a pooler (PgBouncer / Neon / Prisma
// Accelerate), keep `connection_limit` low in DATABASE_URL on serverless so
// instances don't exhaust the pool.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

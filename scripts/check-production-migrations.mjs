// READ-ONLY pre-deploy check of the shared database's migration state. Run it against production before
// `prisma migrate deploy`:
//
//   DATABASE_URL="<production direct url>" node scripts/check-production-migrations.mjs
//
// It never writes. It answers: does the database record its migrations? Which of ours are applied? Were tables
// created outside migrations (db push)? And it prints the exact, safe commands for this database's situation.
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const local = readdirSync(join(process.cwd(), 'prisma/migrations'))
  .filter((d) => statSync(join(process.cwd(), 'prisma/migrations', d)).isDirectory())
  .sort()

const exists = async (table) =>
  (await db.$queryRawUnsafe(`SELECT to_regclass('public."${table}"') IS NOT NULL AS ok`))[0].ok
const column = async (table, col) =>
  (
    await db.$queryRawUnsafe(
      `SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
      table,
      col,
    )
  )[0].n > 0

try {
  const host = (process.env.DATABASE_URL ?? '').replace(/:[^:@/]+@/, ':***@').match(/@([^/?]+)/)?.[1] ?? 'unknown'
  console.log(`Database: ${host}\n`)

  const tracked = await exists('_prisma_migrations')
  const applied = tracked
    ? (await db.$queryRawUnsafe(
        `SELECT migration_name, finished_at IS NOT NULL AS done, rolled_back_at IS NOT NULL AS rolled_back FROM "_prisma_migrations" ORDER BY started_at`,
      ))
    : []
  const done = new Set(applied.filter((m) => m.done && !m.rolled_back).map((m) => m.migration_name))
  const failed = applied.filter((m) => !m.done && !m.rolled_back).map((m) => m.migration_name)

  console.log(`Migration history table: ${tracked ? 'present' : 'MISSING (this database was built with db push)'}`)
  for (const m of local) console.log(`  ${done.has(m) ? '✓ applied ' : '· pending '} ${m}`)
  for (const m of applied.map((a) => a.migration_name).filter((n) => !local.includes(n)))
    console.log(`  ! applied here but not in this repo: ${m}`)
  if (failed.length) console.log(`\n✗ FAILED migrations recorded (fix before anything else): ${failed.join(', ')}`)

  console.log('\nTables that production got from db push (migration 20261105000000_invoice_tables_baseline adds them only where missing, so it is a no-op here):')
  for (const t of ['BillingProfile', 'SellerProfile', 'Invoice']) console.log(`  ${(await exists(t)) ? '✓' : '✗'} ${t}`)

  const webApplied = await column('Plan', 'product')
  console.log(`\nARC PEM Web schema (Plan.product, WebSubscription…): ${webApplied ? 'already present' : 'not yet applied'}`)

  // Every migration before the web one describes things production already has (or it wouldn't be running).
  const baseline = local.filter((m) => m < '20261026000000' && !done.has(m))
  console.log('\nWhat to do:')
  if (failed.length) {
    console.log('  Resolve the failed migrations first (prisma migrate resolve). Do not deploy.')
  } else if (!tracked || baseline.length) {
    console.log('  1. Take a backup / snapshot of the database.')
    console.log('  2. Mark the migrations production already reflects as applied (records history only, changes nothing):')
    for (const m of baseline) console.log(`       npx prisma migrate resolve --applied ${m}`)
    console.log('  3. Apply the rest: npx prisma migrate deploy')
  } else if (!webApplied) {
    console.log('  1. Take a backup / snapshot.  2. npx prisma migrate deploy  (applies only the additive web migration)')
  } else {
    console.log('  Nothing to do: the database is up to date.')
  }
} finally {
  await db.$disconnect()
}

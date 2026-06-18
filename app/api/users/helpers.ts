import type { Prisma } from '@prisma/client'

/**
 * Build the Prisma `where` filter from query params. Shared by the list and
 * export endpoints so they always agree on what "matching" means.
 */
export function buildUserWhere(searchParams: URLSearchParams): Prisma.UserWhereInput {
  const search = searchParams.get('search')?.trim() ?? ''
  const status = searchParams.get('status') ?? 'ALL'
  const plan = searchParams.get('plan') ?? 'ALL'

  const where: Prisma.UserWhereInput = {}

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ]
  }
  if (status && status !== 'ALL') where.status = status
  if (plan === 'NONE') where.planId = null
  else if (plan && plan !== 'ALL') where.planId = plan

  return where
}

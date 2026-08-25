import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { timingSafeEqual } from 'crypto'
import { db } from '@/lib/db'
import { env } from '@/lib/env'
import { checkRateLimit, recordFailure, resetLimit } from '@/lib/rate-limit'

/**
 * Constant-time string comparison. A `!==` short-circuits on the first
 * mismatched byte, leaking how many leading characters were guessed
 * correctly over repeated timed requests — unacceptable for the bootstrap
 * admin password, which has no DB-side bcrypt cost to mask the timing.
 */
function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) {
    // Do a same-length comparison anyway so a length mismatch doesn't
    // return faster than a same-length-but-wrong-content mismatch.
    timingSafeEqual(aBuf, aBuf)
    return false
  }
  return timingSafeEqual(aBuf, bBuf)
}

// Generic message — prevents user enumeration ("no account" vs "wrong password")
const INVALID_MSG = 'Invalid email or password.'
const LOCKED_MSG  = 'Too many failed attempts. Account temporarily locked. Try again in 15 minutes.'

// How often (ms) to re-validate a JWT against the DB. Bounds DB load while
// keeping suspend/logout-everywhere latency low.
const REVALIDATE_INTERVAL_MS = 60 * 1000

// Sentinel id for the env-configured admin (no corresponding DB row).
const ENV_ADMIN_ID = 'env-admin'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email'    },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error(INVALID_MSG)
        }

        const email = credentials.email.trim().toLowerCase()

        const rl    = await checkRateLimit(`login:${email}`)

        if (!rl.allowed) {
          throw new Error(LOCKED_MSG)
        }

        // Env-based admin: authenticate directly against ADMIN_EMAIL /
        // ADMIN_PASSWORD without touching the DB. Lets the admin log in even
        // when the users table isn't seeded.
        const adminEmail    = env.adminEmail()?.trim().toLowerCase()
        const adminPassword = env.adminPassword()
        if (adminEmail && adminPassword && email === adminEmail) {
          if (!safeCompare(credentials.password, adminPassword)) {
            await recordFailure(`login:${email}`)
            const updated = await checkRateLimit(`login:${email}`)
            if (!updated.allowed) throw new Error(LOCKED_MSG)
            throw new Error(INVALID_MSG)
          }
          await resetLimit(`login:${email}`)
          return {
            id:           ENV_ADMIN_ID,
            name:         'Admin',
            email:        adminEmail,
            role:         'ADMIN',
            tokenVersion: 0,
          } as { id: string; name: string; email: string; role: string; tokenVersion: number }
        }

        const user = await db.user.findUnique({ where: { email } })

        // Constant-time comparison even when user doesn't exist — prevents timing attacks
        const dummyHash = '$2a$10$gpRl.XIeFMUXyxglqoGtPOS/JcVbZTzn.iw0EMiNfeM5eYhJy6mXq'
        const hash      = user?.password ?? dummyHash
        const isValid   = await bcrypt.compare(credentials.password, hash)

        if (!user || !isValid) {
          await recordFailure(`login:${email}`)
          const updated = await checkRateLimit(`login:${email}`)
          if (!updated.allowed) throw new Error(LOCKED_MSG)
          throw new Error(INVALID_MSG)
        }

        // Check suspended BEFORE clearing the rate limit so brute-forcing
        // a suspended account doesn't reset the lockout counter.
        if (user.status === 'SUSPENDED') {
          throw new Error('Your account has been suspended. Contact support.')
        }

        // Successful login — clear rate limit
        await resetLimit(`login:${email}`)

        return {
          id:    user.id,
          name:  user.name,
          email: user.email,
          role:  user.role,
          tokenVersion: user.tokenVersion,
        } as { id: string; name: string; email: string; role: string; tokenVersion: number }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      // Initial sign-in: copy identity into the token.
      if (user) {
        const u = user as { id: string; role?: string; tokenVersion?: number }
        token.id           = u.id
        token.role         = u.role ?? 'USER'
        token.tokenVersion = u.tokenVersion ?? 0
        token.checkedAt    = Date.now()
        return token
      }

      // Env admin has no DB row — keep it ADMIN and skip DB revalidation.
      if (token.id === ENV_ADMIN_ID) {
        token.role = 'ADMIN'
        return token
      }

      // Subsequent requests: periodically re-validate against the DB so that
      // suspending a user or bumping tokenVersion revokes live sessions.
      const lastChecked = (token.checkedAt as number) ?? 0
      if (Date.now() - lastChecked < REVALIDATE_INTERVAL_MS) {
        return token
      }

      const dbUser = await db.user.findUnique({
        where: { id: token.id as string },
        select: { role: true, status: true, tokenVersion: true },
      })

      // User deleted, suspended, or token version bumped → mark revoked.
      if (
        !dbUser ||
        dbUser.status === 'SUSPENDED' ||
        dbUser.tokenVersion !== (token.tokenVersion as number)
      ) {
        token.role = 'REVOKED'
      } else {
        token.role = dbUser.role
      }
      token.checkedAt = Date.now()
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id   = token.id as string
        session.user.role = token.role as string
      }
      return session
    },
  },

  pages: {
    signIn: '/login',
    error:  '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge:   8 * 60 * 60,   // 8 hours (admin sessions should be short-lived)
  },

  secret: env.nextAuthSecret(),
}

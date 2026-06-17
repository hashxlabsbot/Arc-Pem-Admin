import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { checkRateLimit, recordFailure, resetLimit } from '@/lib/rate-limit'

// Generic message — prevents user enumeration ("no account" vs "wrong password")
const INVALID_MSG = 'Invalid email or password.'
const LOCKED_MSG  = 'Too many failed attempts. Account temporarily locked. Try again in 15 minutes.'

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
        const rl    = checkRateLimit(email)

        if (!rl.allowed) {
          throw new Error(LOCKED_MSG)
        }

        const user = await db.user.findUnique({ where: { email } })

        // Constant-time comparison even when user doesn't exist — prevents timing attacks
        const dummyHash = '$2a$10$gpRl.XIeFMUXyxglqoGtPOS/JcVbZTzn.iw0EMiNfeM5eYhJy6mXq'
        const hash      = user?.password ?? dummyHash
        const isValid   = await bcrypt.compare(credentials.password, hash)

        if (!user || !isValid) {
          recordFailure(email)
          const updated = checkRateLimit(email)
          if (!updated.allowed) throw new Error(LOCKED_MSG)
          throw new Error(INVALID_MSG)
        }

        // Check suspended BEFORE clearing the rate limit so brute-forcing
        // a suspended account doesn't reset the lockout counter.
        if (user.status === 'SUSPENDED') {
          throw new Error('Your account has been suspended. Contact support.')
        }

        // Successful login — clear rate limit
        resetLimit(email)

        return {
          id:    user.id,
          name:  user.name,
          email: user.email,
          role:  user.role,
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id   = user.id
        token.role = (user as { role?: string }).role ?? 'USER'
      }
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
    maxAge:   8 * 60 * 60,   // 8 hours (was 30 days — admin sessions should be short-lived)
  },

  secret: process.env.NEXTAUTH_SECRET,
}

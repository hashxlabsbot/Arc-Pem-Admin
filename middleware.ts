import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const { pathname } = req.nextUrl

    if (pathname.startsWith('/admin')) {
      // BLOG_EDITOR is scoped to the blog section only — bounce anything else
      // in /admin back to it rather than to login (they are authenticated,
      // just not authorized for that area).
      if (token?.role === 'BLOG_EDITOR') {
        if (!pathname.startsWith('/admin/blog')) {
          return NextResponse.redirect(new URL('/admin/blog', req.url))
        }
      } else if (token?.role !== 'ADMIN') {
        return NextResponse.redirect(
          new URL('/login?error=unauthorized', req.url)
        )
      }
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl
        // Always allow auth routes
        if (
          pathname.startsWith('/login') ||
          pathname.startsWith('/register') ||
          pathname.startsWith('/api/auth')
        ) {
          return true
        }
        // Require token for admin
        if (pathname.startsWith('/admin')) {
          return !!token
        }
        return true
      },
    },
    pages: {
      signIn: '/login',
    },
  }
)

export const config = {
  matcher: ['/admin/:path*', '/login', '/register'],
}

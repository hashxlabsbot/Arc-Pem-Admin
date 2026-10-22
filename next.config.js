/** @type {import('next').NextConfig} */

// Server Action origins must include every host the app is served from in
// production. Drive it from env (comma-separated) and fall back to localhost.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

// Staff-only app holding customer, payment and invoice data: never framed by another site (the blog editor's own
// live preview frames this origin, hence SAMEORIGIN), no MIME sniffing, no full URLs leaked as referrers, and HTTPS
// pinned in production.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'" },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]
    : []),
]

const config = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      allowedOrigins,
    },
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

module.exports = config

/** @type {import('next').NextConfig} */

// Server Action origins must include every host the app is served from in
// production. Drive it from env (comma-separated) and fall back to localhost.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const config = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      allowedOrigins,
    },
  },
}

module.exports = config

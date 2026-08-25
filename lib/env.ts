/**
 * Centralised environment access with fail-fast validation.
 *
 * Required vars are checked once at module load. In production a missing
 * required var throws immediately (so a misconfigured deploy fails loudly
 * instead of 500-ing at runtime). In dev we warn but keep going.
 */

type EnvKey =
  | 'DATABASE_URL'
  | 'NEXTAUTH_SECRET'
  | 'NEXTAUTH_URL'
  | 'ADMIN_EMAIL'
  | 'ADMIN_PASSWORD'
  | 'LICENSE_PRIVATE_KEY'
  | 'BREVO_API_KEY'
  | 'BREVO_SENDER_EMAIL'
  | 'WEB_URL'
  | 'DIRECT_URL'
  | 'UPSTASH_REDIS_REST_URL'
  | 'UPSTASH_REDIS_REST_TOKEN'
  | 'ALLOWED_ORIGINS'
  | 'INTERNAL_API_KEY'

const REQUIRED: EnvKey[] = ['DATABASE_URL', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL']

const isProd = process.env.NODE_ENV === 'production'

const missing = REQUIRED.filter((k) => !process.env[k] || process.env[k]!.trim() === '')

if (missing.length > 0) {
  const msg = `[env] Missing required environment variables: ${missing.join(', ')}`
  if (isProd) throw new Error(msg)
  // eslint-disable-next-line no-console
  console.warn(`${msg} (continuing in non-production)`)
}

function get(key: EnvKey): string | undefined {
  const v = process.env[key]
  return v && v.trim() !== '' ? v : undefined
}

function required(key: EnvKey): string {
  const v = get(key)
  if (!v) throw new Error(`[env] Required environment variable not set: ${key}`)
  return v
}

export const env = {
  isProd,
  databaseUrl: () => required('DATABASE_URL'),
  nextAuthSecret: () => required('NEXTAUTH_SECRET'),
  adminEmail: () => get('ADMIN_EMAIL'),
  adminPassword: () => get('ADMIN_PASSWORD'),
  nextAuthUrl: () => get('NEXTAUTH_URL') ?? 'http://localhost:3000',
  webUrl: () => get('WEB_URL') ?? 'http://localhost:3001',
  brevoApiKey: () => get('BREVO_API_KEY'),
  brevoSender: () => get('BREVO_SENDER_EMAIL'),
  licensePrivateKey: () => get('LICENSE_PRIVATE_KEY'),
  upstashUrl: () => get('UPSTASH_REDIS_REST_URL'),
  upstashToken: () => get('UPSTASH_REDIS_REST_TOKEN'),
  /** Shared secret the website must send (X-Internal-Key) to call server-to-server payment endpoints. */
  internalApiKey: () => get('INTERNAL_API_KEY'),
  /** Comma-separated list of origins allowed for Server Actions / CORS. */
  allowedOrigins: (): string[] => {
    const raw = get('ALLOWED_ORIGINS')
    if (raw) return raw.split(',').map((s) => s.trim()).filter(Boolean)
    // Sensible default: derive from NEXTAUTH_URL host.
    try {
      return [new URL(env.nextAuthUrl()).host]
    } catch {
      return ['localhost:3000']
    }
  },
}

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
  | 'WEB_APP_URL'
  | 'WEB_APP_WEBHOOK_SECRET'
  | 'RAZORPAY_KEY_ID'
  | 'RAZORPAY_KEY_SECRET'
  | 'RAZORPAY_WEBHOOK_SECRET'

const REQUIRED: EnvKey[] = ['DATABASE_URL', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL']

/**
 * What a live admin needs to record Razorpay charges and refunds, email invoices and keep app.arcpem.com in sync.
 * Without any one of these the admin still opens, but quietly drops payments, invoice emails or firm updates.
 */
const LAUNCH_REQUIRED: EnvKey[] = [
  'RAZORPAY_WEBHOOK_SECRET',
  'BREVO_API_KEY',
  'BREVO_SENDER_EMAIL',
  'WEB_APP_URL',
  'WEB_APP_WEBHOOK_SECRET',
]

/** Problems with the production configuration, one readable line each (empty when it is complete). */
export function launchConfigProblems(source: Record<string, string | undefined> = process.env): string[] {
  const has = (k: string) => Boolean(source[k]?.trim())
  const problems = LAUNCH_REQUIRED.filter((k) => !has(k)).map((k) => `${k} is not set`)
  const secret = source.NEXTAUTH_SECRET?.trim() ?? ''
  if (secret && (secret.length < 32 || /replace|change-?me|secret$/i.test(secret)))
    problems.push('NEXTAUTH_SECRET must be a random value of at least 32 characters (openssl rand -base64 32)')
  if (has('WEB_APP_WEBHOOK_SECRET') && !source.WEB_APP_WEBHOOK_SECRET!.split(',').some((s) => s.trim().length >= 32))
    problems.push('WEB_APP_WEBHOOK_SECRET must be at least 32 characters (openssl rand -hex 32)')
  if (has('NEXTAUTH_URL') && !source.NEXTAUTH_URL!.startsWith('https://'))
    problems.push('NEXTAUTH_URL must be the https:// address of the admin')
  return problems
}

const isProd = process.env.NODE_ENV === 'production'

const missing = REQUIRED.filter((k) => !process.env[k] || process.env[k]!.trim() === '')

if (missing.length > 0) {
  const msg = `[env] Missing required environment variables: ${missing.join(', ')}`
  if (isProd) throw new Error(msg)
  // eslint-disable-next-line no-console
  console.warn(`${msg} (continuing in non-production)`)
}

// Checked when the production server starts, not during `next build` (which runs without production secrets). It only
// logs: a missing launch variable must never take the whole admin down, it just disables that feature (see above).
if (isProd && process.env.NEXT_PHASE !== 'phase-production-build') {
  const problems = launchConfigProblems()
  if (problems.length > 0) {
    // eslint-disable-next-line no-console
    console.error(`[env] Production configuration is incomplete:\n  - ${problems.join('\n  - ')}\nSee docs/LAUNCH.md in ARCPEM-Web.`)
  }
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
  /** ARC PEM Web (app.arcpem.com): subscription changes made here are pushed to {WEB_APP_URL}/api/webhooks/accounts. */
  webAppUrl: () => get('WEB_APP_URL')?.replace(/\/$/, ''),
  /** Signs those pushes; same value as the website's WEB_APP_WEBHOOK_SECRET (first one signs while rotating). */
  webAppWebhookSecret: () => get('WEB_APP_WEBHOOK_SECRET')?.split(',')[0]?.trim(),
  /** Razorpay API keys (same account as the website): lets staff stop a firm's auto-renew from here. Optional. */
  razorpayKeyId: () => get('RAZORPAY_KEY_ID'),
  razorpayKeySecret: () => get('RAZORPAY_KEY_SECRET'),
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

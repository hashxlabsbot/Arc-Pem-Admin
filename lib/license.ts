import crypto from 'crypto'

// RSA public key — baked in for verification (same key as in the Electron client)
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvPJmDOm9Q3IlGPJ/sZ8Y
H0ALN1Q4qAaSiFY6DewxwZ1x80M0rAg62Stc0LOkkac1qSs1JJlI2sH7fOSYmxC+
NfXrZkE9nxbRV2a/LvTpiMtTyfmq0b3sgeu+tMMKENH891+HsdiIHr3ho5daU9g6
z9UH9sI6Iwk1sQsC0Gi7ufxhAQ5GjBYO72p5dRuO/7oRRq1ews5hWqboZaJnno4X
eDiojPvDBAHM1uwUsxywVTAIaR+QOsSTrPY2jLgEWoY1UQ6l48R76umDWoHRYpba
xtvpgvCgChGFGAKsQfGgJk2tzqIKbaxwgd6D4TTil8Zlhbwx7GpbTSIi11u+Wmkc
8QIDAQAB
-----END PUBLIC KEY-----`

// RSA private key — loaded from env var (never commit the real key to git)
function getPrivateKey(): string {
  const key = process.env.LICENSE_PRIVATE_KEY
  if (!key) throw new Error('LICENSE_PRIVATE_KEY is not set in environment')
  // Support both inline (with literal \n) and multi-line formats
  return key.replace(/\\n/g, '\n')
}

export interface LicensePayload {
  client:      string
  email:       string
  // Plan identity — read by Arc PEM to determine feature access and limits.
  plan:        string    // e.g. "Professional"
  planPeriod:  string    // e.g. "monthly" | "yearly"
  features:    string[]  // feature list from the subscribed plan
  maxProjects: number
  maxUsers:    number
  seats:       number
  expiry:      string    // YYYY-MM-DD
  machineId:   string    // pipe-separated for multi-seat: "ID1|ID2"
  issued:      string    // YYYY-MM-DD
}

/**
 * Signs with RSA-SHA256 using standard base64.
 * Format: base64(JSON payload) + "." + base64(RSA signature)
 * This matches exactly what the PEM-construction Electron client verifies.
 */
export function generateLicenseKey(input: Omit<LicensePayload, 'issued'>): string {
  const payload: LicensePayload = {
    ...input,
    issued: new Date().toISOString().split('T')[0],
  }
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64')
  const signer     = crypto.createSign('RSA-SHA256')
  signer.update(payloadB64)
  const sigB64 = signer.sign(getPrivateKey(), 'base64')
  return `${payloadB64}.${sigB64}`
}

export interface VerifyResult {
  valid:    boolean
  payload?: LicensePayload
  error?:   string
}

/**
 * Verifies the RSA-SHA256 signature and checks expiry.
 * Uses the public key — no private key needed for verification.
 */
export function verifyLicenseKey(key: string): VerifyResult {
  try {
    const trimmed = key.trim()
    const dot     = trimmed.lastIndexOf('.')
    if (dot === -1) return { valid: false, error: 'Malformed key: missing signature separator' }

    const payloadB64 = trimmed.slice(0, dot)
    const sigB64     = trimmed.slice(dot + 1)

    const verifier = crypto.createVerify('RSA-SHA256')
    verifier.update(payloadB64)
    const ok = verifier.verify(PUBLIC_KEY, sigB64, 'base64')
    if (!ok) return { valid: false, error: 'Signature invalid — key may have been tampered with' }

    const payload: LicensePayload = JSON.parse(
      Buffer.from(payloadB64, 'base64').toString('utf-8')
    )

    if (new Date(payload.expiry) < new Date()) {
      return { valid: false, error: `License expired on ${payload.expiry}`, payload }
    }

    return { valid: true, payload }
  } catch {
    return { valid: false, error: 'Key could not be decoded — it may be corrupted' }
  }
}

export function licenseFileName(clientName: string, expiry: string): string {
  const slug = clientName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${slug}-${expiry}.lic`
}

export function buildLicenseFile(key: string, payload: LicensePayload): string {
  const machines = payload.machineId.split('|').map((m, i) => `  Machine ${i + 1}: ${m.trim()}`).join('\n')
  return [
    '-----BEGIN ARC PEM LICENSE-----',
    `Product     : ARC PEM`,
    `Client      : ${payload.client}`,
    `Email       : ${payload.email}`,
    `Plan        : ${payload.plan}`,
    `Period      : ${payload.planPeriod}`,
    `Max Projects: ${payload.maxProjects}`,
    `Max Users   : ${payload.maxUsers}`,
    `Seats       : ${payload.seats}`,
    `Issued      : ${payload.issued}`,
    `Expires     : ${payload.expiry}`,
    `Machines    :`,
    machines,
    '',
    key,
    '-----END ARC PEM LICENSE-----',
  ].join('\n')
}

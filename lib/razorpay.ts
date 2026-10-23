import { env } from '@/lib/env'

/** Whether this app can call Razorpay (keys set). Without them, staff stop renewals from the Razorpay dashboard. */
export const razorpayConfigured = () => Boolean(env.razorpayKeyId() && env.razorpayKeySecret())

/**
 * Cancels a Razorpay subscription straight away so it never charges again. Paid time is tracked by us and is not
 * affected. Razorpay refuses to cancel twice; an already-cancelled subscription counts as done.
 */
export async function cancelRazorpaySubscription(subscriptionId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = env.razorpayKeyId()
  const secret = env.razorpayKeySecret()
  if (!id || !secret) return { ok: false, error: 'Razorpay keys are not configured in the admin app (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).' }
  try {
    const res = await fetch(`https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cancel_at_cycle_end: 0 }),
      signal: AbortSignal.timeout(15_000),
    })
    if (res.ok) return { ok: true }
    const body = await res.json().catch(() => ({}))
    const description: string = body?.error?.description ?? `HTTP ${res.status}`
    if (/cancelled|completed|expired/i.test(description)) return { ok: true }
    return { ok: false, error: `Razorpay: ${description}` }
  } catch (err) {
    return { ok: false, error: `Could not reach Razorpay: ${String(err).slice(0, 200)}` }
  }
}

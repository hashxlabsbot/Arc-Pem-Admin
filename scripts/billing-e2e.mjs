/**
 * Billing end-to-end check for a LOCAL stack. It replays signed Razorpay webhooks against the running website and
 * admin and reads the result back from the accounts database: free trials, add-on seat pricing, renewals, failed
 * renewals, cancelling, plan switches, GST invoices and idempotency. It refuses any non-local database.
 *
 *   DATABASE_URL=postgresql://…@127.0.0.1:5433/arcpem_accounts RAZORPAY_WEBHOOK_SECRET=… \
 *     node scripts/billing-e2e.mjs
 *
 * Needs the website (default http://localhost:3011) and admin (http://localhost:3000) running with the same
 * RAZORPAY_WEBHOOK_SECRET, the plans seeded (website scripts/seed-plans.mjs), and the demo customers
 * (scripts/seed-demo.mjs). It uses ravi@desaiarch.test and cleans up after itself.
 */
import crypto from 'node:crypto'
import { PrismaClient } from '@prisma/client'

const dbHost = (process.env.DATABASE_URL ?? '').match(/@([^/:?]+)/)?.[1] ?? ''
if (!['localhost', '127.0.0.1'].includes(dbHost)) {
  console.error(`Refusing to run against "${dbHost || 'unknown host'}": this test writes to the database. Use a local one.`)
  process.exit(1)
}
const db = new PrismaClient()
const SECRET = process.env.RAZORPAY_WEBHOOK_SECRET ?? 'dev-razorpay-webhook-secret'
const SITE = `${process.env.SITE_URL ?? 'http://localhost:3011'}/api/payment/webhook`
const ADMIN = `${process.env.ADMIN_URL ?? 'http://localhost:3000'}/api/payments/webhook`
let failures = 0
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`)
  if (!ok) failures++
}
async function send(url, event, payload) {
  const body = JSON.stringify({ event, payload })
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('hex')
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-razorpay-signature': sig }, body })
  return { status: res.status, body: await res.json().catch(() => null) }
}
const sub = (id, notes, paid_count = 1, status = 'active') => ({ subscription: { entity: { id, status, paid_count, notes } } })
const pay = (n, amount) => ({ payment: { entity: { id: P(n), amount, currency: 'INR', status: 'captured', invoice_id: `inv_${n}`, subscription_id: 'x' } } })
const state = () => db.webSubscription.findUnique({ where: { userId: user.id }, include: { plan: true, payments: true } })
const months = (a, b) => (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth()

const user = await db.user.findUniqueOrThrow({ where: { email: 'ravi@desaiarch.test' } })
const studio = await db.plan.findFirstOrThrow({ where: { product: 'WEB', tier: 'STUDIO', isActive: true } })
const business = await db.plan.findFirstOrThrow({ where: { product: 'WEB', tier: 'BUSINESS', isActive: true } })
const run = Date.now().toString(36)
const S1 = `sub_e2e1_${run}`, S2 = `sub_e2e2_${run}`
const P = (n) => `pay_e2e${n}_${run}`
const S0 = `sub_e2e0_${run}`
await db.webSubscription.deleteMany({ where: { userId: user.id } })
const invoicesBefore = await db.invoice.count()
// Temporary GST profiles (seller + buyer) so admin can invoice; removed again below.
const tmpSeller = (await db.sellerProfile.count()) === 0
  ? await db.sellerProfile.create({ data: { legalName: 'E2E Seller', gstin: '27AAAAA0000A1Z5', addressLine1: '1 Test Road', city: 'Pune', state: 'Maharashtra', stateCode: '27', pincode: '411001' } })
  : null
const tmpBuyer = (await db.billingProfile.findUnique({ where: { userId: user.id } }))
  ? null
  : await db.billingProfile.create({ data: { userId: user.id, legalName: 'Desai Architects', addressLine1: '2 Test Road', city: 'Mumbai', state: 'Maharashtra', stateCode: '27', pincode: '400001' } })

try {
  const t0 = new Date()

  // 0. Free trial with add-on seats: auto-pay authorised, nothing charged, plan live until the trial ends.
  const trialEnd = new Date(Date.now() + 14 * 86400000)
  const notes0 = { userId: user.id, planId: studio.id, interval: 'MONTH', extraSeats: '2', extraSiteSeats: '5', trial: '1', trialEndsAt: trialEnd.toISOString() }
  let r0 = await send(SITE, 'subscription.authenticated', sub(S0, notes0, 0, 'authenticated'))
  let s0 = await state()
  check('trial starts on auto-pay authorisation', r0.status === 200 && s0?.trialEndsAt && s0.status === 'ACTIVE' && s0.autoRenew, JSON.stringify(r0.body))
  check('trial runs to its end date, nothing paid', s0 && Math.abs(s0.currentPeriodEnd - trialEnd) < 1000 && s0.payments.length === 0)
  check('add-on seats raise the limits (5+2 team, 10+5 site)', s0?.seatLimit === 7 && s0.siteSeatLimit === 15 && s0.extraSeats === 2)
  await send(SITE, 'subscription.authenticated', sub(S0, notes0, 0, 'authenticated'))
  check('repeat authorisation is a no-op', (await db.webSubscription.count({ where: { userId: user.id } })) === 1)
  const trialPrice = Math.round((studio.price + 2 * 599 + 5 * 199) * 100)
  r0 = await send(SITE, 'subscription.charged', { ...sub(S0, notes0, 1), ...pay(10, trialPrice) })
  s0 = await state()
  check('first charge after the trial adds a month from the trial end', s0.payments.length === 1 && months(trialEnd, s0.currentPeriodEnd) === 1 && !s0.trialEndsAt, JSON.stringify(r0.body))
  r0 = await send(SITE, 'subscription.charged', { ...sub(S0, notes0, 2), ...pay(11, Math.round(studio.price * 100)) })
  check('a charge without the add-ons is refused', (await state()).payments.length === 1)
  await send(SITE, 'subscription.authenticated', sub(`sub_e2eX_${run}`, { ...notes0 }, 0, 'authenticated'))
  check('no second trial for a firm that has subscribed', (await state()).razorpaySubscriptionId === S0)
  await db.webSubscription.deleteMany({ where: { userId: user.id } })

  const notes1 = { userId: user.id, planId: studio.id, interval: 'MONTH' }

  // 1. First monthly charge reaches the website.
  let r = await send(SITE, 'subscription.charged', { ...sub(S1, notes1), ...pay(1, Math.round(studio.price * 100)) })
  let s = await state()
  check('first charge applied by website', r.status === 200 && s?.status === 'ACTIVE' && s.planId === studio.id, JSON.stringify(r.body))
  check('monthly, auto-renew on, linked to Razorpay subscription', s?.billingInterval === 'MONTH' && s.autoRenew && s.razorpaySubscriptionId === S1)
  check('paid one month', s && months(t0, s.currentPeriodEnd) === 1, s?.currentPeriodEnd?.toISOString())
  const end1 = s.currentPeriodEnd

  // 2. Same charge reaches admin: approved + invoiced, not applied twice.
  r = await send(ADMIN, 'subscription.charged', { ...sub(S1, notes1), ...pay(1, Math.round(studio.price * 100)) })
  s = await state()
  const pp = await db.pendingPayment.findFirst({ where: { utr: P(1) } })
  check('admin approves the same charge', r.status === 200 && pp?.status === 'approved', JSON.stringify(r.body))
  check('term applied exactly once', s.payments.length === 1 && s.currentPeriodEnd.getTime() === end1.getTime())
  check('admin issued a GST invoice', (await db.invoice.count()) === invoicesBefore + 1)

  // 3. Webhook retry is a no-op.
  await send(SITE, 'subscription.charged', { ...sub(S1, notes1), ...pay(1, Math.round(studio.price * 100)) })
  check('retry is a no-op', (await state()).payments.length === 1)

  // 4. Wrong amount is refused.
  r = await send(SITE, 'subscription.charged', { ...sub(S1, notes1, 2), ...pay(99, 100) })
  check('charge with the wrong amount is refused', (await state()).payments.length === 1, JSON.stringify(r.body))

  // 5. Renewal fails first (pending), then succeeds.
  await send(SITE, 'subscription.pending', sub(S1, notes1, 1, 'pending'))
  check('failed renewal marks payment due', (await state()).status === 'PAST_DUE')
  await send(SITE, 'subscription.charged', { ...sub(S1, notes1, 2), ...pay(2, Math.round(studio.price * 100)) })
  s = await state()
  check('renewal charge restores ACTIVE and adds a month after the current end', s.status === 'ACTIVE' && months(end1, s.currentPeriodEnd) === 1, s.currentPeriodEnd.toISOString())
  const end2 = s.currentPeriodEnd

  // 6. Owner turns auto-renew off (Razorpay reports the cancellation).
  await send(SITE, 'subscription.cancelled', sub(S1, notes1, 2, 'cancelled'))
  s = await state()
  check('cancel stops auto-renew but keeps access to the paid end', !s.autoRenew && s.status === 'ACTIVE' && s.currentPeriodEnd.getTime() === end2.getTime())

  // 7. Switch to Business, annual (10 months' price): a new subscription that replaces the first.
  const notes2 = { userId: user.id, planId: business.id, interval: 'YEAR', replaces: S1 }
  r = await send(SITE, 'subscription.charged', { ...sub(S2, notes2), ...pay(3, Math.round(business.price * 10 * 100)) })
  s = await state()
  check('plan switch: Business, annual at 10 months, auto-renew on', s.planId === business.id && s.billingInterval === 'YEAR' && s.autoRenew && s.razorpaySubscriptionId === S2, JSON.stringify(r.body))
  check('switch without add-ons resets limits to the plan', s.seatLimit === null && s.siteSeatLimit === null)
  check('annual term starts at the end of the time already paid', s.currentPeriodEnd.getUTCFullYear() - end2.getUTCFullYear() === 1)

  // 8. Late events about the replaced subscription change nothing about the plan.
  await send(SITE, 'subscription.cancelled', sub(S1, notes1, 2, 'cancelled'))
  await send(SITE, 'subscription.charged', { ...sub(S1, notes1, 3), ...pay(4, Math.round(studio.price * 100)) })
  s = await state()
  check('replaced subscription cannot switch the firm back', s.planId === business.id && s.autoRenew && s.razorpaySubscriptionId === S2)
  check('…but a payment it did take still counts as paid time', s.payments.length === 4)

  // 9. order.paid for a subscription invoice is left to subscription.charged in admin.
  r = await send(ADMIN, 'order.paid', { ...pay(5, 100), order: { entity: { notes: { userId: user.id, planId: studio.id } } } })
  check('admin ignores order.paid for subscription invoices', r.status === 200 && !(await db.pendingPayment.findFirst({ where: { utr: P(5) } })))

  // 10. The web app was told: outbox events for this firm were delivered (or are queued if its owner has no firm yet).
  const pending = await db.webhookOutbox.count({ where: { status: 'FAILED', createdAt: { gte: t0 } } })
  check('no outbox event failed', pending === 0)
} finally {
  const ids = [1, 2, 3, 4, 5, 10, 11, 99].map(P)
  const rows = await db.pendingPayment.findMany({ where: { utr: { in: ids } }, select: { id: true } })
  await db.invoice.deleteMany({ where: { paymentId: { in: rows.map((r) => r.id) } } })
  await db.pendingPayment.deleteMany({ where: { utr: { in: ids } } })
  await db.webSubscription.deleteMany({ where: { userId: user.id } })
  if (tmpBuyer) await db.billingProfile.delete({ where: { id: tmpBuyer.id } })
  if (tmpSeller) await db.sellerProfile.delete({ where: { id: tmpSeller.id } })
  await db.$disconnect()
}
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed')
process.exit(failures ? 1 : 0)

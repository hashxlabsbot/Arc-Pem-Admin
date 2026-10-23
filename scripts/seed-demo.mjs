/**
 * Demo data for a LOCAL ARC PEM stack. Never run it against a shared or production database: it refuses to.
 *
 *   node scripts/seed-demo.mjs            people: admin, customers, seller GST details, a legacy desktop customer
 *   node scripts/seed-demo.mjs charges    their subscriptions, as signed Razorpay webhooks sent to the running
 *                                         website and admin, so trials, invoices and renewals come from the real code
 *
 * Needs DATABASE_URL (local), RAZORPAY_WEBHOOK_SECRET, and for `charges` the website (SITE_URL, default
 * http://localhost:3011) and admin (ADMIN_URL, default http://localhost:3000) running with the same secret.
 */
import { createHmac, randomBytes } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const url = process.env.DATABASE_URL ?? ''
const host = url.match(/@([^/:?]+)/)?.[1] ?? ''
if (!['localhost', '127.0.0.1'].includes(host)) {
  console.error(`Refusing to seed "${host || 'unknown host'}": demo data goes only into a local database.`)
  process.exit(1)
}
const db = new PrismaClient()
const phase = process.argv[2] ?? 'people'

const PEOPLE = [
  { email: 'admin@hashx.test', name: 'HashX Admin', password: 'Admin-Pass-2026', role: 'ADMIN' },
  {
    email: 'meera@kapoorstudio.test', name: 'Meera Kapoor', password: 'Owner-Pass-2026',
    bill: { legalName: 'Kapoor Design Studio LLP', gstin: '27AAKFK1234A1Z5', city: 'Pune', state: 'Maharashtra', stateCode: '27', pincode: '411001', phone: '+91 98200 11111' },
  },
  {
    email: 'arjun@buildcon.test', name: 'Arjun Sharma', password: 'Demo-Pass-2026',
    bill: { legalName: 'BuildCon Constructions Pvt Ltd', gstin: '07AABCB5678C1Z2', city: 'New Delhi', state: 'Delhi', stateCode: '07', pincode: '110001', phone: '+91 98100 22222' },
  },
  {
    email: 'kavita@designhub.test', name: 'Kavita Reddy', password: 'Demo-Pass-2026',
    bill: { legalName: 'DesignHub Interiors', gstin: '36AAHFD9012D1Z8', city: 'Hyderabad', state: 'Telangana', stateCode: '36', pincode: '500001', phone: '+91 98480 33333' },
  },
  {
    email: 'rohit@infratech.test', name: 'Rohit Mehta', password: 'Demo-Pass-2026',
    bill: { legalName: 'InfraTech Projects', gstin: null, city: 'Ahmedabad', state: 'Gujarat', stateCode: '24', pincode: '380001', phone: '+91 98250 44444' },
  },
  {
    email: 'sunita@pemgroup.test', name: 'Sunita Patel', password: 'Demo-Pass-2026',
    bill: { legalName: 'PEM Group Builders', gstin: '24AAGCP3456E1Z1', city: 'Surat', state: 'Gujarat', stateCode: '24', pincode: '395001', phone: '+91 98790 55555' },
  },
  {
    email: 'vikram@archcon.test', name: 'Vikram Raju', password: 'Demo-Pass-2026',
    bill: { legalName: 'ArchCon Associates', gstin: '29AAFCA7890F1Z4', city: 'Bengaluru', state: 'Karnataka', stateCode: '29', pincode: '560001', phone: '+91 98450 66666' },
  },
  { email: 'ravi@desaiarch.test', name: 'Ravi Desai', password: 'Desk-Pass-2026' }, // signed up, no plan yet: shows the purchase flow
  { email: 'rajesh@oldclient.test', name: 'Rajesh Gupta', password: 'Demo-Pass-2026', desktop: true }, // customer from before ARC PEM went web-only
]

async function people() {
  for (const p of PEOPLE) {
    const user = await db.user.upsert({
      where: { email: p.email },
      create: { email: p.email, name: p.name, password: await bcrypt.hash(p.password, 10), role: p.role ?? 'USER', status: 'ACTIVE' },
      update: {},
    })
    if (p.bill) {
      const data = { ...p.bill, addressLine1: `${Math.floor(Math.random() * 90) + 10}, Demo Road`, email: p.email }
      await db.billingProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: {} })
    }
    if (p.desktop) {
      const plan = await db.plan.findFirst({ where: { product: 'DESKTOP', isActive: true }, orderBy: { price: 'asc' }, skip: 1 })
      if (plan) await db.user.update({ where: { id: user.id }, data: { planId: plan.id, planExpiresAt: new Date(Date.now() + 200 * 86_400_000) } })
    }
    console.log(`  ✓ ${p.email}`)
  }
  const seller = {
    legalName: 'Hash X Labs Pvt Ltd (DEMO)', gstin: '06AAAAH0000A1Z5', addressLine1: 'Sector 15', city: 'Faridabad',
    state: 'Haryana', stateCode: '06', pincode: '121007', email: 'info@arcpem.com', phone: '+91 88102 35570',
  }
  if ((await db.sellerProfile.count()) === 0) await db.sellerProfile.create({ data: seller })
  console.log('  ✓ seller GST profile (demo values)')
}

// ── Subscriptions, as Razorpay would report them ──
const SECRET = process.env.RAZORPAY_WEBHOOK_SECRET
const SITE = (process.env.SITE_URL ?? 'http://localhost:3011').replace(/\/$/, '')
const ADMIN = (process.env.ADMIN_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const id = (prefix) => `${prefix}_demo_${randomBytes(5).toString('hex')}`

async function post(base, path, event, payload) {
  const body = JSON.stringify({ event, payload })
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-razorpay-signature': createHmac('sha256', SECRET).update(body).digest('hex') },
    body,
  })
  if (!res.ok) throw new Error(`${event} → ${base}${path}: HTTP ${res.status} ${await res.text()}`)
}

async function charges() {
  if (!SECRET) throw new Error('RAZORPAY_WEBHOOK_SECRET is not set')
  const rules = (await db.billingSettings.findUnique({ where: { id: 'default' } })) ?? { seatAddonMonthly: 599, siteSeatAddonMonthly: 199, annualBilledMonths: 10 }
  const planFor = async (tier) => db.plan.findFirstOrThrow({ where: { product: 'WEB', tier, isActive: true } })
  const userFor = (email) => db.user.findUniqueOrThrow({ where: { email } })

  const firms = [
    { email: 'meera@kapoorstudio.test', tier: 'BUSINESS', interval: 'YEAR', seats: 2 },
    { email: 'arjun@buildcon.test', tier: 'STUDIO', interval: 'MONTH' },
    { email: 'kavita@designhub.test', tier: 'SOLO', interval: 'MONTH', seats: 1, siteSeats: 2 },
    { email: 'rohit@infratech.test', tier: 'STUDIO', interval: 'MONTH', trialDays: 14 - 5 }, // 5 days into a 14-day trial
    { email: 'sunita@pemgroup.test', tier: 'BUSINESS', interval: 'MONTH', then: 'pending' },
    { email: 'vikram@archcon.test', tier: 'SOLO', interval: 'YEAR', then: 'cancelled' },
  ]
  for (const f of firms) {
    const [user, plan] = await Promise.all([userFor(f.email), planFor(f.tier)])
    const addons = { seats: f.seats ?? 0, siteSeats: f.siteSeats ?? 0 }
    const sub = id('sub')
    const notes = {
      userId: user.id, planId: plan.id, interval: f.interval, email: user.email,
      extraSeats: String(addons.seats), extraSiteSeats: String(addons.siteSeats),
    }
    if (f.trialDays) {
      const trialEndsAt = new Date(Date.now() + f.trialDays * 86_400_000).toISOString()
      await post(SITE, '/api/payment/webhook', 'subscription.authenticated', {
        subscription: { entity: { id: sub, status: 'authenticated', paid_count: 0, notes: { ...notes, trial: '1', trialEndsAt } } },
      })
      console.log(`  ✓ ${f.email}: ${f.tier} free trial (${f.trialDays} days left)`)
      continue
    }
    const price = Math.round((plan.price + addons.seats * rules.seatAddonMonthly + addons.siteSeats * rules.siteSeatAddonMonthly) * (f.interval === 'MONTH' ? 1 : rules.annualBilledMonths) * 100)
    const entity = { subscription: { entity: { id: sub, status: 'active', paid_count: 1, notes } }, payment: { entity: { id: id('pay'), amount: price, currency: 'INR', status: 'captured', subscription_id: sub, invoice_id: id('inv') } } }
    await post(SITE, '/api/payment/webhook', 'subscription.charged', entity) // applies the paid term
    await post(ADMIN, '/api/payments/webhook', 'subscription.charged', entity) // approves it and issues the GST invoice
    if (f.then) {
      await post(SITE, '/api/payment/webhook', `subscription.${f.then}`, { subscription: { entity: { id: sub, status: f.then, paid_count: 1, notes } } })
    }
    console.log(`  ✓ ${f.email}: ${f.tier} ${f.interval === 'MONTH' ? 'monthly' : 'annual'} paid ₹${(price / 100).toLocaleString('en-IN')}${f.then ? ` → ${f.then}` : ''}`)
  }
}

try {
  console.log(phase === 'charges' ? 'Subscriptions:' : 'People:')
  await (phase === 'charges' ? charges() : people())
} finally {
  await db.$disconnect()
}

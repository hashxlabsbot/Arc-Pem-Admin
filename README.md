# ARC PEM Admin

The internal panel staff use to run the business: ARC PEM firms and subscriptions, plans, payments and GST invoices,
billing rules, customers, the blog, and the legacy desktop licences. Part of a three-app product; the full picture is
in `ARCPEM-Web/docs` ([FEATURES](../ARCPEM-Web/docs/FEATURES.md), [SYSTEM](../ARCPEM-Web/docs/SYSTEM.md),
[LAUNCH](../ARCPEM-Web/docs/LAUNCH.md)).

## What it does

- **Dashboard:** recurring revenue, paying firms, trials, payment-due and at-risk firms, revenue by plan.
- **Firms:** every ARC PEM subscription with filters, search and CSV export; a firm page to change plan, status, term
  and limits, stop auto-renew, re-sync to the app, download invoices and see the history of staff changes.
- **Plans** (prices, seats, site seats, projects) and **Settings → Subscription billing** (add-on seat prices, free
  trial days, annual months). Changes refresh the public site within seconds.
- **Payments and invoices:** Razorpay subscription charges, bank-transfer approval, refunds, GST tax invoices (PDF).
- **Customers, Analytics, Demo bookings, Blog CMS, Team (staff), Alerts, Activity log.**
- **Legacy desktop:** clients, licences and API keys for customers from before ARC PEM went web-only.

## Stack and ownership

Next.js 14 (App Router) · NextAuth v4 · Prisma 5 (PostgreSQL) · Tailwind. **This app owns the accounts database
schema and all its migrations** (`prisma/migrations`); the website mirrors the models. After changing
`prisma/schema.prisma`, make a migration and copy the model changes into the website's `prisma/schema.prisma`.

## Run it locally

```bash
cp .env.example .env     # NEXTAUTH_SECRET, DATABASE_URL, ADMIN_EMAIL / ADMIN_PASSWORD, WEB_APP_* …
npm install              # also runs prisma generate
npx prisma migrate deploy
npm run dev              # http://localhost:3000
```

> **Do not run `npm run db:seed`.** That is the old desktop-era seed: it **deletes every user and plan** before
> recreating demo ones. For demo data use the scripts below, which refuse to run on anything but a local database.

| Script | Purpose |
| --- | --- |
| `scripts/seed-demo.mjs` | Demo customers, seller GST details and a legacy desktop customer. Then `node scripts/seed-demo.mjs charges` replays signed Razorpay webhooks (needs the website and admin running) to create the demo firms: paid, on trial, payment due and cancelled, with real GST invoices |
| `scripts/billing-e2e.mjs` | 25-check billing end-to-end test: trials, add-on pricing, renewals, switches, cancellations, idempotency |
| `scripts/check-production-migrations.mjs` | **Read-only** check of a production database's migration state before `migrate deploy` |

Plans themselves are seeded from the website repo (`node scripts/seed-plans.mjs`). The full local recipe, ports and
demo logins are in [SYSTEM.md, "Local development"](../ARCPEM-Web/docs/SYSTEM.md#10-local-development).

## Scripts

`dev` · `build` · `start` · `lint` · `db:migrate` (dev) · `db:migrate:deploy` · `db:generate` · `db:push` (avoid; use
migrations) · `db:studio`

## Where things are

| Concern | Files |
| --- | --- |
| Firm list, filters, export | `app/admin/web-subscriptions`, `app/api/web-subscriptions/*`, `lib/firm-filter.ts` |
| Recurring-revenue maths | `lib/web-metrics.ts` |
| Billing rules and pricing | `lib/billing-rules.ts`, `lib/pricing.ts`, `app/api/billing-settings`, `components/admin/BillingSettingsForm.tsx` |
| Subscription core (identical copy in the website) | `lib/web-app.ts` |
| Razorpay webhook and refunds | `app/api/payments/webhook` |
| Stopping a firm's renewals | `lib/razorpay.ts` (needs `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`) |
| Invoices | `lib/invoice.ts`, `lib/invoice-pdf.ts`, `app/api/invoices/*` |

## Notes

- Required secrets worth double-checking after a deploy: `RAZORPAY_WEBHOOK_SECRET` (without it payments are
  acknowledged but not recorded), `WEB_APP_URL` and `WEB_APP_WEBHOOK_SECRET` (to reach the app), and `MARKETING_URL`
  with a `REVALIDATE_SECRET` equal to the website's (so price changes refresh the public pages).
- GST invoices are issued only for customers with a billing profile; the website does not collect one yet. See
  "Known limits" in [FEATURES.md](../ARCPEM-Web/docs/FEATURES.md#9-known-limits-and-things-deliberately-not-built).

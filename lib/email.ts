/**
 * Customer emails sent by the admin app (via Brevo), on the shared ARC PEM layout (lib/email-layout.ts). The layout
 * escapes every value, so names, plan names, reasons and UTRs can never inject markup into these emails.
 */
import { renderEmail, type EmailContent } from './email-layout'

const BREVO_API = 'https://api.brevo.com/v3/smtp/email'

// Brevo accepts attachments as base64 content + filename.
export interface MailAttachment { name: string; content: string }

/** The customer website (arcpem.com): where customers sign in, pay and download. */
const site = () => (process.env.WEB_URL ?? 'http://localhost:3001').replace(/\/$/, '')
const webApp = () => (process.env.WEB_APP_URL ?? 'https://app.arcpem.com').replace(/\/$/, '')
const firstName = (name?: string) => (name?.trim() ? name.trim().split(/\s+/)[0] : '')
const hello = (name?: string) => (firstName(name) ? `Hi ${firstName(name)},` : 'Hi there,')

function sender() {
  const email = process.env.BREVO_SENDER_EMAIL
  if (!email && process.env.NODE_ENV === 'production') throw new Error('BREVO_SENDER_EMAIL is not configured')
  return { name: 'ARC PEM', email: email ?? 'no-reply@arcpem.com' }
}

async function send(to: string, toName: string, subject: string, content: EmailContent, attachments?: MailAttachment[]) {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) throw new Error('BREVO_API_KEY is not configured')
  // Brevo can't embed images, so the icon loads from the public website; the text wordmark stands in when blocked.
  const { html, text } = renderEmail(content, { appUrl: site(), logoUrl: `${site()}/arc-icon.png` })
  const res = await fetch(BREVO_API, {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: sender(),
      to: [{ email: to, name: toName }],
      subject,
      htmlContent: html,
      textContent: text,
      ...(attachments && attachments.length ? { attachment: attachments } : {}),
    }),
  })
  if (!res.ok) throw new Error(`Brevo API ${res.status}: ${await res.text()}`)
}

const ACTIVATE_STEPS = [
  'Save the attached **.lic** file to your computer.',
  'Open ARC PEM and go to **Settings → License**.',
  'Click **Activate** and choose the .lic file.',
]

export async function sendApprovalEmail({
  to, name, planName, invoice, product = 'DESKTOP',
}: {
  to: string; name: string; planName: string
  // Optional GST invoice PDF to attach to the activation email.
  invoice?: { fileName: string; pdf: Uint8Array }
  // WEB = ARC PEM Web: no license key or download, the firm's workspace is ready to use.
  product?: string
}) {
  const web = product === 'WEB'
  const attachments: MailAttachment[] | undefined = invoice
    ? [{ name: invoice.fileName, content: Buffer.from(invoice.pdf).toString('base64') }]
    : undefined
  await send(to, name, `Your ${planName} plan is now active`, {
    preheader: web ? "Your firm's ARC PEM Web workspace is ready." : 'Payment verified. Your license key is on its way.',
    eyebrow: 'Plan activated',
    heading: `Your ${planName} plan is active`,
    paragraphs: [hello(name), `Your payment has been verified and your **${planName}** plan is now active.`],
    details: [
      { label: 'Plan', value: planName },
      { label: 'Status', value: 'Active' },
      ...(invoice ? [{ label: 'GST invoice', value: 'Attached (PDF)' }] : []),
    ],
    list: web
      ? {
          title: 'Next steps',
          ordered: true,
          items: [
            'Open ARC PEM Web and choose **Sign in with ARC PEM account**.',
            'Set up your firm: projects, budgets and parties.',
            'Invite your team from the **Team** page.',
          ],
        }
      : {
          title: 'Next steps',
          ordered: true,
          items: [
            'Download ARC PEM from your dashboard.',
            'Our team generates your machine-locked license key and emails it to you shortly.',
            'Activate it from **Settings → License**.',
          ],
        },
    cta: web
      ? { label: 'Open ARC PEM Web', url: `${webApp()}/auth/arcpem` }
      : { label: 'Download ARC PEM', url: `${site()}/dashboard/downloads` },
    closing: ['Questions? Reply to this email and our team will help.'],
    reason: 'You received this because you have an ARC PEM account.',
  }, attachments)
}

export async function sendWelcomeEmail({ to, name, planName }: { to: string; name: string; planName?: string }) {
  await send(to, name, `Welcome to ARC PEM, ${firstName(name) || 'there'}! Your account is ready`, {
    preheader: 'Your ARC PEM account is ready. Here is how to get started.',
    eyebrow: 'Welcome aboard',
    heading: `Welcome to ARC PEM${firstName(name) ? `, ${firstName(name)}` : ''}`,
    paragraphs: [
      hello(name),
      'Your **ARC PEM** account is ready: project expense management built for architects and construction firms in India.',
      planName
        ? `It has been set up with the **${planName}** plan.`
        : 'You can choose or upgrade your plan any time from your dashboard.',
    ],
    list: {
      title: 'What you can do',
      items: [
        'Track project budgets and expenses in real time',
        'Manage BOQs, bills, vendors and site ledgers',
        'Invite your team and give everyone the right access',
        'Produce GST, TDS and Tally-ready reports in one click',
      ],
    },
    cta: { label: 'Sign in to ARC PEM', url: `${site()}/login` },
    closing: ["Didn't expect this? Reply to this email and we'll look into it."],
    reason: `You received this because an ARC PEM account was created for ${to}.`,
  })
}

export async function sendLicenseEmail({
  to, name, planName, expiry, licenseFile,
}: {
  to: string
  name: string
  planName: string
  expiry: string
  licenseFile: { fileName: string; content: string } // base64 content
}) {
  await send(to, name, 'Your ARC PEM license key is ready', {
    preheader: `Your ${planName} license file is attached. Activate it in under a minute.`,
    eyebrow: 'License ready',
    heading: 'Your license key is ready',
    paragraphs: [
      hello(name),
      `Your machine-locked license for the **${planName}** plan is attached to this email as **${licenseFile.fileName}**.`,
    ],
    list: { title: 'How to activate', ordered: true, items: ACTIVATE_STEPS },
    details: [
      { label: 'Plan', value: planName },
      { label: 'Valid until', value: expiry },
    ],
    note: { text: 'This license is locked to the machine you submitted. Contact support to transfer or extend it.' },
    cta: { label: 'Go to dashboard', url: `${site()}/dashboard` },
    reason: 'You received this because a license was issued for your ARC PEM account. Reply for help activating it.',
  }, [{ name: licenseFile.fileName, content: licenseFile.content }])
}

export async function sendFreeLicenseEmail({
  to, name, planName, expiry, licenseFile, tempPassword, dashUrl,
}: {
  to: string
  name: string
  planName: string
  expiry: string
  licenseFile: { fileName: string; content: string }
  tempPassword?: string
  dashUrl?: string
}) {
  const url = (dashUrl ?? site()).replace(/\/$/, '')
  await send(to, name, 'Your complimentary ARC PEM license is ready', {
    preheader: `A complimentary ${planName} license, valid until ${expiry}. The license file is attached.`,
    eyebrow: 'Complimentary license',
    heading: 'A complimentary license, on us',
    paragraphs: [
      hello(name),
      `We're pleased to give you a complimentary **${planName}** license for ARC PEM, valid until **${expiry}**. The signed license file is attached.`,
    ],
    details: [
      { label: 'Plan', value: planName },
      { label: 'Valid until', value: expiry },
      ...(tempPassword
        ? [
            { label: 'Dashboard login', value: to },
            { label: 'Temporary password', value: tempPassword },
          ]
        : []),
    ],
    list: { title: 'How to activate', ordered: true, items: ACTIVATE_STEPS },
    note: tempPassword
      ? { tone: 'warning', text: 'Please **change your temporary password** right after your first sign-in.' }
      : { text: 'This license is locked to your registered machine. Contact support to transfer or extend it.' },
    cta: { label: 'Go to dashboard', url: `${url}/dashboard` },
    reason: 'You received this because the ARC PEM team issued you a complimentary license.',
  }, [{ name: licenseFile.fileName, content: licenseFile.content }])
}

export async function sendLicenseRequestRejectionEmail({ to, name, reason }: { to: string; name: string; reason?: string }) {
  await send(to, name, 'Your license request could not be processed', {
    preheader: "We couldn't generate a license for the machine ID you sent.",
    eyebrow: 'License request',
    heading: "We couldn't process your license request",
    paragraphs: [
      hello(name),
      'Unfortunately we were unable to generate a license for the machine ID you submitted.',
      'Reply to this email with your machine ID and subscription details and we will resolve it for you.',
    ],
    details: reason ? [{ label: 'Reason', value: reason }] : undefined,
    reason: 'You received this because you requested an ARC PEM license.',
  })
}

export async function sendRejectionEmail({
  to, name, planName, utr, reason,
}: { to: string; name: string; planName: string; utr: string; reason?: string }) {
  await send(to, name, 'Payment verification failed: action required', {
    preheader: `We couldn't verify your payment for the ${planName} plan.`,
    eyebrow: 'Payment not verified',
    heading: "We couldn't verify your payment",
    paragraphs: [
      hello(name),
      `We were unable to verify your payment for the **${planName}** plan. Please try again with the correct UTR, or reply with a screenshot of the payment.`,
    ],
    details: [
      { label: 'Plan', value: planName },
      { label: 'UTR submitted', value: utr },
      ...(reason ? [{ label: 'Reason', value: reason }] : []),
    ],
    cta: { label: 'Try payment again', url: `${site()}/dashboard/subscription` },
    reason: 'You received this because you submitted a payment on arcpem.com.',
  })
}

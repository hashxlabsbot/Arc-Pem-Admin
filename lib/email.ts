const BREVO_API = 'https://api.brevo.com/v3/smtp/email'
const FROM = { name: 'ARC PEM', email: process.env.BREVO_SENDER_EMAIL ?? 'vashisth0052@gmail.com' }

// Brevo accepts attachments as base64 content + filename.
export interface MailAttachment { name: string; content: string }

async function sendMail(
  to: string,
  toName: string,
  subject: string,
  html: string,
  attachments?: MailAttachment[],
) {
  const res = await fetch(BREVO_API, {
    method: 'POST',
    headers: {
      'api-key':      process.env.BREVO_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender:      FROM,
      to:          [{ email: to, name: toName }],
      subject,
      htmlContent: html,
      ...(attachments && attachments.length ? { attachment: attachments } : {}),
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Brevo API ${res.status}: ${err}`)
  }
}

export async function sendApprovalEmail({
  to, name, planName, invoice,
}: {
  to: string; name: string; planName: string
  // Optional GST invoice PDF to attach to the activation email.
  invoice?: { fileName: string; pdf: Uint8Array }
}) {
  const dashUrl = process.env.WEB_URL ?? 'http://localhost:3001'
  const attachments: MailAttachment[] | undefined = invoice
    ? [{ name: invoice.fileName, content: Buffer.from(invoice.pdf).toString('base64') }]
    : undefined
  const invoiceNote = invoice
    ? `<p style="font-size:13px;color:#475569;margin:0 0 24px;line-height:1.6;">Your GST tax invoice is attached to this email as a PDF.</p>`
    : ''

  await sendMail(to, name, `Your ${planName} plan is now active`, `
    <!DOCTYPE html><html>
    <body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;">
    <div style="max-width:540px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.07);">
      <div style="background:linear-gradient(135deg,#065f46,#10b981);padding:32px 36px;">
        <h1 style="color:white;font-size:22px;font-weight:700;margin:0 0 6px;">Plan Activated!</h1>
        <p style="color:rgba(255,255,255,0.8);font-size:14px;margin:0;">Your <strong>${planName}</strong> subscription is now live.</p>
      </div>
      <div style="padding:32px 36px;">
        <p style="font-size:15px;color:#1e293b;margin:0 0 20px;">Hi <strong>${name}</strong>,</p>
        <p style="font-size:14px;color:#475569;margin:0 0 24px;line-height:1.6;">
          Your payment has been verified and your <strong>${planName}</strong> plan is now active.
        </p>
        ${invoiceNote}
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 18px;margin-bottom:24px;">
          <p style="font-size:13px;color:#166534;margin:0;line-height:1.7;">
            <strong>Next steps:</strong><br/>
            Our team will generate your machine-locked license key and email it to you shortly.<br/>
            In the meantime you can download ARC PEM from your <a href="${dashUrl}/dashboard/downloads" style="color:#16a34a;">dashboard</a>.
          </p>
        </div>
        <p style="font-size:13px;color:#94a3b8;margin:0;">
          Contact support if you have any questions.<br/>
          <strong style="color:#1e293b;">ARC PEM Team</strong>
        </p>
      </div>
      <div style="background:#f8fafc;border-top:1px solid #f1f5f9;padding:20px 36px;text-align:center;">
        <p style="font-size:12px;color:#94a3b8;margin:0;">© 2026 ARCPEM. All rights reserved.<br/>You received this because you have an account with ARCPEM.</p>
      </div>
    </div>
    </body></html>
  `, attachments)
}

export async function sendWelcomeEmail({
  to, name, planName,
}: { to: string; name: string; planName?: string }) {
  const dashUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const planLine = planName
    ? `<p style="margin:0 0 12px;font-size:14px;color:#334155;">Your account has been set up with the <strong style="color:#4f46e5;">${planName} Plan</strong>.</p>`
    : `<p style="margin:0 0 12px;font-size:14px;color:#334155;">You can upgrade your subscription anytime from your dashboard.</p>`

  await sendMail(to, name, `Welcome to ARC PEM, ${name.split(' ')[0]}! Your account is ready 🎉`, `
    <!DOCTYPE html><html>
    <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
    <div style="max-width:560px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
      <div style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:36px 40px 32px;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:2px;color:#c4b5fd;text-transform:uppercase;">ARC PEM</p>
        <h1 style="margin:0;font-size:26px;font-weight:800;color:#ffffff;line-height:1.2;">Welcome aboard, ${name.split(' ')[0]}! 🎉</h1>
        <p style="margin:10px 0 0;font-size:14px;color:#c4b5fd;">Your account is ready. Let's build something great.</p>
      </div>
      <div style="padding:36px 40px 28px;">
        <p style="margin:0 0 16px;font-size:15px;color:#334155;">Hi <strong>${name}</strong>,</p>
        <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">
          Thank you for creating your <strong>ARC PEM</strong> account — India's most powerful Project Expense Management platform for architects and construction firms.
        </p>
        ${planLine}
        <div style="border-top:1px solid #e2e8f0;margin:24px 0;"></div>
        <p style="margin:0 0 14px;font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">What you can do now</p>
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr><td width="32" style="padding:5px 0;font-size:16px;">📊</td><td style="padding:5px 0;font-size:14px;color:#475569;">Track project budgets &amp; expenses in real time</td></tr>
          <tr><td width="32" style="padding:5px 0;font-size:16px;">📋</td><td style="padding:5px 0;font-size:14px;color:#475569;">Manage BOQ, purchase orders, and invoices</td></tr>
          <tr><td width="32" style="padding:5px 0;font-size:16px;">👥</td><td style="padding:5px 0;font-size:14px;color:#475569;">Invite team members and assign roles</td></tr>
          <tr><td width="32" style="padding:5px 0;font-size:16px;">📈</td><td style="padding:5px 0;font-size:14px;color:#475569;">Generate financial reports instantly</td></tr>
        </table>
        <div style="margin:28px 0 0;text-align:center;">
          <a href="${dashUrl}/login" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;">
            Sign In to Dashboard →
          </a>
        </div>
      </div>
      <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
          This email was sent to <strong>${to}</strong> because you created an account on ARC PEM.<br/>
          If you didn't sign up, you can safely ignore this email.
        </p>
        <p style="margin:10px 0 0;font-size:12px;color:#cbd5e1;">© ${new Date().getFullYear()} ARC PEM. All rights reserved.</p>
      </div>
    </div>
    </body></html>
  `)
}

export async function sendRejectionEmail({
  to, name, planName, utr, reason,
}: { to: string; name: string; planName: string; utr: string; reason?: string }) {
  const dashUrl = process.env.WEB_URL ?? 'http://localhost:3001'

  await sendMail(to, name, 'Payment verification failed — action required', `
    <!DOCTYPE html><html>
    <body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;">
    <div style="max-width:540px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.07);">
      <div style="background:linear-gradient(135deg,#7f1d1d,#ef4444);padding:32px 36px;">
        <h1 style="color:white;font-size:22px;font-weight:700;margin:0 0 6px;">Payment Not Verified</h1>
        <p style="color:rgba(255,255,255,0.8);font-size:14px;margin:0;">We could not verify your UPI transaction.</p>
      </div>
      <div style="padding:32px 36px;">
        <p style="font-size:15px;color:#1e293b;margin:0 0 20px;">Hi <strong>${name}</strong>,</p>
        <p style="font-size:14px;color:#475569;margin:0 0 20px;line-height:1.6;">
          We were unable to verify your payment for the <strong>${planName}</strong> plan.
          ${reason ? `<br/><br/><strong>Reason:</strong> ${reason}` : ''}
        </p>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px 18px;margin-bottom:24px;">
          <p style="font-size:12px;font-weight:700;color:#991b1b;margin:0 0 4px;">Transaction submitted</p>
          <p style="font-family:monospace;font-size:13px;color:#7f1d1d;margin:0;">UTR: ${utr}</p>
        </div>
        <p style="font-size:14px;color:#475569;margin:0 0 20px;line-height:1.6;">
          Please try again with the correct UTR or contact us with your payment screenshot.
        </p>
        <a href="${dashUrl}/dashboard/subscription"
           style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#6366f1);color:white;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px;">
          Try Payment Again →
        </a>
      </div>
      <div style="background:#f8fafc;border-top:1px solid #f1f5f9;padding:20px 36px;text-align:center;">
        <p style="font-size:12px;color:#94a3b8;margin:0;">© 2026 ARCPEM. All rights reserved.<br/>You received this because you have an account with ARCPEM.</p>
      </div>
    </div>
    </body></html>
  `)
}

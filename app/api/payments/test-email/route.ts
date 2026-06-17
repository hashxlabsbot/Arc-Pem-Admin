import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'BREVO_API_KEY is not set in .env' }, { status: 500 })
  }

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key':      apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender:      { name: 'ARC PEM', email: process.env.BREVO_SENDER_EMAIL ?? 'vashisth0052@gmail.com' },
        to:          [{ email: session.user.email!, name: session.user.name ?? 'Admin' }],
        subject:     'ARC PEM — SMTP test successful',
        htmlContent: `<p style="font-family:sans-serif;">Brevo API is working correctly.<br/>Sent at <strong>${new Date().toISOString()}</strong>.</p>`,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Brevo ${res.status}: ${err}`)
    }

    return NextResponse.json({
      ok:      true,
      message: `Test email sent to ${session.user.email}`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

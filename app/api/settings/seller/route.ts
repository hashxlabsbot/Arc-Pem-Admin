import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { GSTIN_RE } from '@/lib/invoice'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return null
  return session
}

// Return the single seller profile (or null if not yet configured).
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const seller = await db.sellerProfile.findFirst()
  return NextResponse.json({ seller })
}

// Create or update the single seller profile.
export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))

  const legalName = body.legalName?.trim()
  const gstin = body.gstin?.trim().toUpperCase()
  const addressLine1 = body.addressLine1?.trim()
  const city = body.city?.trim()
  const state = body.state?.trim()
  const stateCode = body.stateCode?.trim()
  const pincode = body.pincode?.trim()

  if (!legalName) return NextResponse.json({ error: 'Legal name is required.' }, { status: 400 })
  if (!gstin || !GSTIN_RE.test(gstin)) {
    return NextResponse.json({ error: 'A valid seller GSTIN is required.' }, { status: 400 })
  }
  if (!addressLine1 || !city || !state) {
    return NextResponse.json({ error: 'Address line 1, city and state are required.' }, { status: 400 })
  }
  if (!stateCode || !/^[0-9]{2}$/.test(stateCode)) {
    return NextResponse.json({ error: 'A valid 2-digit state code is required.' }, { status: 400 })
  }
  if (gstin.slice(0, 2) !== stateCode) {
    return NextResponse.json({ error: 'GSTIN state code must match the state code.' }, { status: 400 })
  }
  if (!pincode || !/^[0-9]{6}$/.test(pincode)) {
    return NextResponse.json({ error: 'A valid 6-digit pincode is required.' }, { status: 400 })
  }

  const taxRate = body.taxRate === undefined || body.taxRate === '' ? 18 : Number(body.taxRate)
  if (!isFinite(taxRate) || taxRate < 0) {
    return NextResponse.json({ error: 'Tax rate must be a non-negative number.' }, { status: 400 })
  }

  const data = {
    legalName,
    gstin,
    addressLine1,
    addressLine2: body.addressLine2?.trim() || null,
    city,
    state,
    stateCode,
    pincode,
    email: body.email?.trim() || null,
    phone: body.phone?.trim() || null,
    hsnSac: body.hsnSac?.trim() || '998314',
    taxRate,
    invoicePrefix: body.invoicePrefix?.trim() || 'ARC',
    bankDetails: body.bankDetails?.trim() || null,
  }

  const existing = await db.sellerProfile.findFirst()
  const seller = existing
    ? await db.sellerProfile.update({ where: { id: existing.id }, data })
    : await db.sellerProfile.create({ data })

  return NextResponse.json({ seller })
}

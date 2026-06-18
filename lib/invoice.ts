import { db } from './db'
import { renderInvoicePdf } from './invoice-pdf'

// Standard GSTIN: 2-digit state code + 10-char PAN + entity digit + 'Z' + checksum char.
export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
// GST state codes run 01..38 (plus 97 for "Other Territory").
const STATE_CODE_RE = /^(0[1-9]|[1-2][0-9]|3[0-8]|97)$/

export interface BillingInput {
  legalName?: string
  gstin?: string | null
  addressLine1?: string
  addressLine2?: string | null
  city?: string
  state?: string
  stateCode?: string
  pincode?: string
  country?: string | null
  phone?: string | null
  email?: string | null
}

// Normalized, persistable billing data. Optional fields are `string | null`
// (never `undefined`) so it maps cleanly onto Prisma create/update inputs.
export interface NormalizedBilling {
  legalName: string
  gstin: string | null
  addressLine1: string
  addressLine2: string | null
  city: string
  state: string
  stateCode: string
  pincode: string
  country: string
  phone: string | null
  email: string | null
}

/**
 * Validate a billing profile payload. Returns the normalized data on success or
 * a human-readable error. GSTIN is optional (B2C / unregistered buyers), but when
 * present it must be well-formed and its state code must match `stateCode`.
 */
export function validateBillingProfile(
  input: BillingInput
): { ok: true; data: NormalizedBilling } | { ok: false; error: string } {
  const legalName = input.legalName?.trim()
  const addressLine1 = input.addressLine1?.trim()
  const city = input.city?.trim()
  const state = input.state?.trim()
  const stateCode = input.stateCode?.trim()
  const pincode = input.pincode?.trim()

  if (!legalName) return { ok: false, error: 'Legal / billing name is required.' }
  if (!addressLine1) return { ok: false, error: 'Address line 1 is required.' }
  if (!city) return { ok: false, error: 'City is required.' }
  if (!state) return { ok: false, error: 'State is required.' }
  if (!stateCode || !STATE_CODE_RE.test(stateCode)) {
    return { ok: false, error: 'A valid 2-digit GST state code is required (e.g. 27).' }
  }
  if (!pincode || !/^[0-9]{6}$/.test(pincode)) {
    return { ok: false, error: 'A valid 6-digit pincode is required.' }
  }

  const gstin = input.gstin?.trim().toUpperCase() || null
  if (gstin) {
    if (!GSTIN_RE.test(gstin)) return { ok: false, error: 'GSTIN is not valid.' }
    if (gstin.slice(0, 2) !== stateCode) {
      return { ok: false, error: 'GSTIN state code does not match the selected state.' }
    }
  }

  return {
    ok: true,
    data: {
      legalName,
      gstin,
      addressLine1,
      addressLine2: input.addressLine2?.trim() || null,
      city,
      state,
      stateCode,
      pincode,
      country: input.country?.trim() || 'India',
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
    },
  }
}

export interface GstBreakup {
  taxRate: number
  taxableAmount: number
  cgst: number
  sgst: number
  igst: number
  total: number
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/**
 * Compute the GST breakup for a plan price treated as **tax-exclusive** (tax added
 * on top). Intra-state (buyer state == seller state) splits the rate into CGST+SGST;
 * inter-state charges a single IGST line.
 */
export function computeGst(
  amount: number,
  sellerStateCode: string,
  buyerStateCode: string,
  taxRate: number
): GstBreakup {
  const taxableAmount = round2(amount)
  const taxAmount = round2((taxableAmount * taxRate) / 100)
  const intraState = sellerStateCode === buyerStateCode

  if (intraState) {
    const half = round2(taxAmount / 2)
    return {
      taxRate,
      taxableAmount,
      cgst: half,
      // Assign the rounding remainder to SGST so cgst+sgst always equals taxAmount.
      sgst: round2(taxAmount - half),
      igst: 0,
      total: round2(taxableAmount + taxAmount),
    }
  }

  return {
    taxRate,
    taxableAmount,
    cgst: 0,
    sgst: 0,
    igst: taxAmount,
    total: round2(taxableAmount + taxAmount),
  }
}

/** Indian financial year label for a date, e.g. 2026-06-18 -> "2026-27". */
export function financialYear(date = new Date()): string {
  const y = date.getFullYear()
  const m = date.getMonth() // 0-indexed; FY starts in April (month 3)
  const start = m >= 3 ? y : y - 1
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`
}

/**
 * Allocate the next sequential invoice number for the current financial year,
 * e.g. "ARC/2026-27/0001". Pass the same Prisma transaction client used to create
 * the invoice so the count and insert are atomic.
 */
export async function nextInvoiceNumber(
  prefix: string,
  tx: { invoice: { count: (args: any) => Promise<number> } } = db
): Promise<string> {
  const fy = financialYear()
  const marker = `${prefix}/${fy}/`
  const count = await tx.invoice.count({
    where: { invoiceNumber: { startsWith: marker } },
  })
  return `${marker}${String(count + 1).padStart(4, '0')}`
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function twoDigits(n: number): string {
  if (n < 20) return ONES[n]
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ' ' + ONES[n % 10] : ''}`
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100)
  const rest = n % 100
  return `${h ? ONES[h] + ' Hundred' + (rest ? ' ' : '') : ''}${rest ? twoDigits(rest) : ''}`.trim()
}

/** Convert a rupee amount to Indian-system words, e.g. "Rupees One Thousand Only". */
export function amountInWords(amount: number): string {
  const rupees = Math.floor(amount)
  const paise = Math.round((amount - rupees) * 100)

  if (rupees === 0 && paise === 0) return 'Rupees Zero Only'

  const crore = Math.floor(rupees / 10000000)
  const lakh = Math.floor((rupees % 10000000) / 100000)
  const thousand = Math.floor((rupees % 100000) / 1000)
  const hundred = rupees % 1000

  const parts: string[] = []
  if (crore) parts.push(`${twoDigits(crore)} Crore`)
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`)
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`)
  if (hundred) parts.push(threeDigits(hundred))

  let words = `Rupees ${parts.join(' ')}`
  if (paise) words += ` and ${twoDigits(paise)} Paise`
  return `${words} Only`
}

function formatBuyerAddress(b: {
  addressLine1: string; addressLine2: string | null; city: string; state: string; pincode: string; country: string
}): string {
  return [b.addressLine1, b.addressLine2, `${b.city}, ${b.state} - ${b.pincode}`, b.country]
    .filter(Boolean)
    .join('\n')
}

function formatSellerAddress(s: {
  addressLine1: string; addressLine2: string | null; city: string; state: string; pincode: string
}): string {
  return [s.addressLine1, s.addressLine2, `${s.city}, ${s.state} - ${s.pincode}`]
    .filter(Boolean)
    .join('\n')
}

export type GenerateInvoiceResult =
  | { ok: true; invoiceId: string; invoiceNumber: string; pdf: Uint8Array; fileName: string }
  | { ok: false; reason: string }

/**
 * Build, render and persist a GST invoice for an approved payment. Idempotent:
 * if an invoice already exists for the payment it is returned as-is. Never throws
 * for the "missing data" cases — returns `{ ok: false, reason }` so callers (e.g.
 * the approval route) can keep the approval intact and just report the skip.
 */
export async function generateInvoiceForPayment(payment: {
  id: string
  userId: string
  planName: string
  amount: number
}): Promise<GenerateInvoiceResult> {
  // Reuse an existing invoice for this payment if present.
  const existing = await db.invoice.findUnique({ where: { paymentId: payment.id } })
  if (existing) {
    return {
      ok: true,
      invoiceId: existing.id,
      invoiceNumber: existing.invoiceNumber,
      pdf: Uint8Array.from(existing.pdf),
      fileName: invoiceFileName(existing.invoiceNumber),
    }
  }

  const [buyer, seller] = await Promise.all([
    db.billingProfile.findUnique({ where: { userId: payment.userId } }),
    db.sellerProfile.findFirst(),
  ])

  if (!buyer) return { ok: false, reason: 'Buyer has no billing/GST details on file.' }
  if (!seller) return { ok: false, reason: 'Seller GST profile is not configured in Settings.' }

  const gst = computeGst(payment.amount, seller.stateCode, buyer.stateCode, seller.taxRate)
  const invoiceNumber = await nextInvoiceNumber(seller.invoicePrefix)
  const issuedAt = new Date()

  const buyerAddress = formatBuyerAddress(buyer)
  const sellerAddress = formatSellerAddress(seller)
  const placeOfSupply = `${buyer.state} (${buyer.stateCode})`

  const pdf = await renderInvoicePdf({
    invoiceNumber,
    issuedAt,
    planName: payment.planName,
    placeOfSupply,
    hsnSac: seller.hsnSac,
    taxRate: gst.taxRate,
    taxableAmount: gst.taxableAmount,
    cgst: gst.cgst,
    sgst: gst.sgst,
    igst: gst.igst,
    total: gst.total,
    currency: 'INR',
    buyerName: buyer.legalName,
    buyerGstin: buyer.gstin,
    buyerAddress,
    sellerName: seller.legalName,
    sellerGstin: seller.gstin,
    sellerAddress,
    sellerEmail: seller.email,
    sellerPhone: seller.phone,
    bankDetails: seller.bankDetails,
  })

  const invoice = await db.invoice.create({
    data: {
      invoiceNumber,
      userId: payment.userId,
      paymentId: payment.id,
      planName: payment.planName,
      buyerName: buyer.legalName,
      buyerGstin: buyer.gstin,
      buyerAddress,
      buyerStateCode: buyer.stateCode,
      sellerName: seller.legalName,
      sellerGstin: seller.gstin,
      sellerAddress,
      sellerStateCode: seller.stateCode,
      placeOfSupply,
      hsnSac: seller.hsnSac,
      taxRate: gst.taxRate,
      taxableAmount: gst.taxableAmount,
      cgst: gst.cgst,
      sgst: gst.sgst,
      igst: gst.igst,
      total: gst.total,
      currency: 'INR',
      pdf: Buffer.from(pdf),
      issuedAt,
    },
  })

  return { ok: true, invoiceId: invoice.id, invoiceNumber, pdf, fileName: invoiceFileName(invoiceNumber) }
}

/** Safe download filename from an invoice number (slashes -> hyphens). */
export function invoiceFileName(invoiceNumber: string): string {
  return `Invoice-${invoiceNumber.replace(/[\/\\]/g, '-')}.pdf`
}

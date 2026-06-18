import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib'
import { amountInWords } from './invoice'

export interface InvoicePdfData {
  invoiceNumber: string
  issuedAt: Date
  planName: string
  placeOfSupply: string
  hsnSac: string
  taxRate: number
  taxableAmount: number
  cgst: number
  sgst: number
  igst: number
  total: number
  currency: string

  buyerName: string
  buyerGstin?: string | null
  buyerAddress: string

  sellerName: string
  sellerGstin: string
  sellerAddress: string
  sellerEmail?: string | null
  sellerPhone?: string | null
  bankDetails?: string | null
}

const PAGE_W = 595.28 // A4 width in points
const PAGE_H = 841.89 // A4 height in points
const MARGIN = 48
const INK = rgb(0.11, 0.13, 0.18)
const MUTED = rgb(0.42, 0.45, 0.5)
const LINE = rgb(0.85, 0.87, 0.9)
const ACCENT = rgb(0.36, 0.2, 0.69) // violet, matches admin UI

function money(n: number, currency: string): string {
  const sym = currency === 'INR' ? 'Rs. ' : ''
  return `${sym}${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export async function renderInvoicePdf(data: InvoicePdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([PAGE_W, PAGE_H])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const draw = (
    text: string,
    x: number,
    y: number,
    opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb> } = {}
  ) => {
    page.drawText(text ?? '', {
      x,
      y,
      size: opts.size ?? 10,
      font: opts.font ?? font,
      color: opts.color ?? INK,
    })
  }

  // Draw multi-line text from an address string; returns the y after the last line.
  const drawLines = (text: string, x: number, y: number, size = 9, lineGap = 13) => {
    const lines = text.split('\n')
    lines.forEach((ln, i) => draw(ln, x, y - i * lineGap, { size, color: MUTED }))
    return y - (lines.length - 1) * lineGap
  }

  const hLine = (y: number, x1 = MARGIN, x2 = PAGE_W - MARGIN, color = LINE) => {
    page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 1, color })
  }

  let y = PAGE_H - MARGIN

  // Accent band
  page.drawRectangle({ x: 0, y: PAGE_H - 6, width: PAGE_W, height: 6, color: ACCENT })

  // Header: seller name + TAX INVOICE
  draw(data.sellerName, MARGIN, y, { size: 18, font: bold })
  draw('TAX INVOICE', PAGE_W - MARGIN - bold.widthOfTextAtSize('TAX INVOICE', 16), y, {
    size: 16,
    font: bold,
    color: ACCENT,
  })
  y -= 18
  y = drawLines(data.sellerAddress, MARGIN, y, 9)
  y -= 13
  draw(`GSTIN: ${data.sellerGstin}`, MARGIN, y, { size: 9, color: MUTED })
  const contactBits = [data.sellerEmail, data.sellerPhone].filter(Boolean).join('  |  ')
  if (contactBits) {
    y -= 12
    draw(contactBits, MARGIN, y, { size: 9, color: MUTED })
  }

  y -= 20
  hLine(y)
  y -= 22

  // Invoice meta (right) + Bill To (left)
  const metaX = PAGE_W - MARGIN - 200
  draw('Invoice No.', metaX, y, { size: 9, color: MUTED })
  draw(data.invoiceNumber, metaX + 90, y, { size: 9, font: bold })
  draw('Invoice Date', metaX, y - 15, { size: 9, color: MUTED })
  draw(
    data.issuedAt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    metaX + 90,
    y - 15,
    { size: 9, font: bold }
  )
  draw('Place of Supply', metaX, y - 30, { size: 9, color: MUTED })
  draw(data.placeOfSupply, metaX + 90, y - 30, { size: 9, font: bold })

  draw('BILL TO', MARGIN, y, { size: 9, font: bold, color: MUTED })
  draw(data.buyerName, MARGIN, y - 16, { size: 11, font: bold })
  let by = drawLines(data.buyerAddress, MARGIN, y - 31, 9)
  if (data.buyerGstin) {
    by -= 13
    draw(`GSTIN: ${data.buyerGstin}`, MARGIN, by, { size: 9, color: MUTED })
  }

  y = Math.min(by, y - 30) - 30

  // Line items table header
  const colDesc = MARGIN
  const colHsn = 320
  const colRate = 400
  const colAmt = PAGE_W - MARGIN
  page.drawRectangle({
    x: MARGIN - 6,
    y: y - 6,
    width: PAGE_W - 2 * MARGIN + 12,
    height: 22,
    color: rgb(0.96, 0.95, 0.99),
  })
  draw('DESCRIPTION', colDesc, y, { size: 9, font: bold, color: ACCENT })
  draw('HSN/SAC', colHsn, y, { size: 9, font: bold, color: ACCENT })
  draw('RATE', colRate, y, { size: 9, font: bold, color: ACCENT })
  const amtLabel = 'AMOUNT'
  draw(amtLabel, colAmt - bold.widthOfTextAtSize(amtLabel, 9), y, { size: 9, font: bold, color: ACCENT })
  y -= 28

  // Single line item: the plan
  draw(`${data.planName} subscription`, colDesc, y, { size: 10 })
  draw(data.hsnSac, colHsn, y, { size: 10, color: MUTED })
  const rateStr = money(data.taxableAmount, data.currency)
  draw(rateStr, colRate, y, { size: 10, color: MUTED })
  const amtStr = money(data.taxableAmount, data.currency)
  draw(amtStr, colAmt - font.widthOfTextAtSize(amtStr, 10), y, { size: 10 })
  y -= 16
  hLine(y)
  y -= 22

  // Totals block (right aligned)
  const labelX = PAGE_W - MARGIN - 220
  const valRight = PAGE_W - MARGIN
  const totalRow = (label: string, value: string, opts: { bold?: boolean; size?: number } = {}) => {
    const f = opts.bold ? bold : font
    const s = opts.size ?? 10
    draw(label, labelX, y, { size: s, font: f, color: opts.bold ? INK : MUTED })
    draw(value, valRight - f.widthOfTextAtSize(value, s), y, { size: s, font: f })
    y -= 17
  }

  totalRow('Taxable Value', money(data.taxableAmount, data.currency))
  if (data.igst > 0) {
    totalRow(`IGST @ ${data.taxRate}%`, money(data.igst, data.currency))
  } else {
    totalRow(`CGST @ ${data.taxRate / 2}%`, money(data.cgst, data.currency))
    totalRow(`SGST @ ${data.taxRate / 2}%`, money(data.sgst, data.currency))
  }
  y -= 2
  hLine(y + 12, labelX, valRight)
  totalRow('Total', money(data.total, data.currency), { bold: true, size: 12 })

  y -= 10
  draw('Amount in words:', MARGIN, y, { size: 9, font: bold, color: MUTED })
  y -= 14
  draw(amountInWords(data.total), MARGIN, y, { size: 9, color: INK })

  // Bank details + footer
  if (data.bankDetails) {
    y -= 28
    draw('Payment / Bank Details', MARGIN, y, { size: 9, font: bold, color: MUTED })
    drawLines(data.bankDetails, MARGIN, y - 14, 9)
  }

  // Footer
  hLine(MARGIN + 30, MARGIN, PAGE_W - MARGIN, LINE)
  draw('This is a computer-generated invoice and does not require a signature.', MARGIN, MARGIN + 14, {
    size: 8,
    color: MUTED,
  })

  return doc.save()
}

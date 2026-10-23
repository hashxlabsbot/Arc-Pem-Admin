import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib'
import { amountInWords } from './invoice'
import { LOGO_PNG_BASE64 } from './email-logo'

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
const MARGIN = 44
const CONTENT_W = PAGE_W - 2 * MARGIN

const INK = rgb(0.09, 0.1, 0.16)
const MUTED = rgb(0.4, 0.43, 0.5)
const LINE = rgb(0.9, 0.91, 0.94)
const WHITE = rgb(1, 1, 1)
const BRAND = rgb(0.36, 0.31, 0.94) // #5b4ff0, the ARC PEM indigo
const BRAND_DARK = rgb(0.17, 0.14, 0.48)
const BRAND_SOFT = rgb(0.95, 0.95, 1)
const CARD = rgb(0.975, 0.977, 0.99)

function money(n: number, currency: string): string {
  const sym = currency === 'INR' ? 'Rs. ' : ''
  return `${sym}${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// The standard PDF fonts only cover WinAnsi; anything else would make pdf-lib throw.
function safe(text: string | null | undefined): string {
  return (text ?? '')
    .replace(/₹/g, 'Rs.')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '')
}

export async function renderInvoicePdf(data: InvoicePdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(`Tax Invoice ${data.invoiceNumber}`)
  doc.setAuthor(safe(data.sellerName))
  doc.setProducer('ARC PEM')
  doc.setCreationDate(data.issuedAt)

  const page = doc.addPage([PAGE_W, PAGE_H])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const logo = await doc.embedPng(Buffer.from(LOGO_PNG_BASE64, 'base64'))

  type Color = ReturnType<typeof rgb>
  const draw = (
    text: string,
    x: number,
    y: number,
    opts: { size?: number; font?: PDFFont; color?: Color; align?: 'left' | 'right' } = {}
  ) => {
    const f = opts.font ?? font
    const size = opts.size ?? 9.5
    const t = safe(text)
    const px = opts.align === 'right' ? x - f.widthOfTextAtSize(t, size) : x
    page.drawText(t, { x: px, y, size, font: f, color: opts.color ?? INK })
  }

  // Word-wraps to a width and returns the y position after the last line.
  const paragraph = (
    text: string,
    x: number,
    y: number,
    width: number,
    opts: { size?: number; font?: PDFFont; color?: Color; gap?: number } = {}
  ) => {
    const f = opts.font ?? font
    const size = opts.size ?? 9
    const gap = opts.gap ?? size + 4
    const lines: string[] = []
    for (const raw of safe(text).split('\n')) {
      let line = ''
      for (const word of raw.split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word
        if (f.widthOfTextAtSize(next, size) > width && line) {
          lines.push(line)
          line = word
        } else {
          line = next
        }
      }
      lines.push(line)
    }
    lines.forEach((ln, i) => draw(ln, x, y - i * gap, { size, font: f, color: opts.color ?? MUTED }))
    return y - (lines.length - 1) * gap
  }

  const roundRect = (x: number, top: number, w: number, h: number, r: number, color: Color, border?: Color) => {
    const path = `M ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`
    page.drawSvgPath(path, {
      x,
      y: top,
      color,
      ...(border ? { borderColor: border, borderWidth: 0.8 } : {}),
    })
  }

  const hLine = (y: number, x1 = MARGIN, x2 = PAGE_W - MARGIN, color = LINE) =>
    page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.8, color })

  // ── Header band ─────────────────────────────────────────────────────────
  const BAND_H = 118
  page.drawRectangle({ x: 0, y: PAGE_H - BAND_H, width: PAGE_W, height: BAND_H, color: BRAND_DARK })
  page.drawRectangle({ x: 0, y: PAGE_H - BAND_H, width: PAGE_W * 0.62, height: BAND_H, color: BRAND, opacity: 0.55 })
  page.drawRectangle({ x: 0, y: PAGE_H - BAND_H - 3, width: PAGE_W, height: 3, color: BRAND })

  roundRect(MARGIN, PAGE_H - 30, 52, 52, 12, WHITE)
  page.drawImage(logo, { x: MARGIN + 6, y: PAGE_H - 30 - 46, width: 40, height: 40 })

  draw(data.sellerName, MARGIN + 68, PAGE_H - 50, { size: 17, font: bold, color: WHITE })
  draw('Project Expense Manager', MARGIN + 68, PAGE_H - 66, { size: 9, color: rgb(0.82, 0.83, 1) })
  const contact = [data.sellerEmail, data.sellerPhone].filter(Boolean).join('   |   ')
  if (contact) draw(contact, MARGIN + 68, PAGE_H - 96, { size: 8.5, color: rgb(0.82, 0.83, 1) })

  draw('TAX INVOICE', PAGE_W - MARGIN, PAGE_H - 52, { size: 22, font: bold, color: WHITE, align: 'right' })
  draw(`# ${data.invoiceNumber}`, PAGE_W - MARGIN, PAGE_H - 70, {
    size: 10.5,
    font: bold,
    color: rgb(0.82, 0.83, 1),
    align: 'right',
  })
  draw(
    data.issuedAt.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }),
    PAGE_W - MARGIN,
    PAGE_H - 86,
    { size: 9, color: rgb(0.82, 0.83, 1), align: 'right' }
  )

  // ── Billed by / Billed to / Details cards ───────────────────────────────
  const cardTop = PAGE_H - BAND_H - 28
  const gapX = 12
  const cardW = (CONTENT_W - 2 * gapX) / 3
  const cardH = 128

  const card = (i: number, label: string) => {
    const x = MARGIN + i * (cardW + gapX)
    roundRect(x, cardTop, cardW, cardH, 8, CARD, LINE)
    draw(label, x + 12, cardTop - 20, { size: 7.5, font: bold, color: BRAND })
    return x + 12
  }

  let cx = card(0, 'BILLED BY')
  const sellerNameEnd = paragraph(data.sellerName, cx, cardTop - 36, cardW - 24, { size: 10, font: bold, color: INK, gap: 12 })
  let cy = paragraph(data.sellerAddress, cx, sellerNameEnd - 14, cardW - 24, { size: 8.5, gap: 11 })
  draw(`GSTIN: ${data.sellerGstin}`, cx, cy - 15, { size: 8.5, font: bold, color: INK })

  cx = card(1, 'BILLED TO')
  const buyerNameEnd = paragraph(data.buyerName, cx, cardTop - 36, cardW - 24, { size: 10, font: bold, color: INK, gap: 12 })
  cy = paragraph(data.buyerAddress, cx, buyerNameEnd - 14, cardW - 24, { size: 8.5, gap: 11 })
  if (data.buyerGstin) draw(`GSTIN: ${data.buyerGstin}`, cx, cy - 15, { size: 8.5, font: bold, color: INK })

  cx = card(2, 'INVOICE DETAILS')
  const detail = (label: string, value: string, y: number) => {
    draw(label, cx, y, { size: 8, color: MUTED })
    draw(value, cx, y - 12, { size: 9.5, font: bold })
  }
  detail('Invoice number', data.invoiceNumber, cardTop - 38)
  detail(
    'Date of issue',
    data.issuedAt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    cardTop - 68
  )
  detail('Place of supply', data.placeOfSupply, cardTop - 98)

  // ── Line items ──────────────────────────────────────────────────────────
  let y = cardTop - cardH - 34
  const colDesc = MARGIN + 12
  const colHsn = 300
  const colQty = 372
  const colRate = 462
  const colAmt = PAGE_W - MARGIN - 12

  roundRect(MARGIN, y + 14, CONTENT_W, 26, 6, BRAND_DARK)
  const th = { size: 8, font: bold, color: WHITE }
  draw('DESCRIPTION', colDesc, y - 4, th)
  draw('HSN/SAC', colHsn, y - 4, th)
  draw('QTY', colQty, y - 4, th)
  draw('RATE', colRate, y - 4, { ...th, align: 'right' })
  draw('AMOUNT', colAmt, y - 4, { ...th, align: 'right' })

  y -= 32
  const rowTop = y + 14
  const rowH = 46
  roundRect(MARGIN, rowTop, CONTENT_W, rowH, 6, BRAND_SOFT)
  draw(`${data.planName} subscription`, colDesc, y, { size: 10.5, font: bold })
  draw('ARC PEM web platform access, billed per plan term', colDesc, y - 14, { size: 8.5, color: MUTED })
  draw(data.hsnSac, colHsn, y, { size: 9.5, color: MUTED })
  draw('1', colQty, y, { size: 9.5, color: MUTED })
  draw(money(data.taxableAmount, data.currency), colRate, y, { size: 9.5, color: MUTED, align: 'right' })
  draw(money(data.taxableAmount, data.currency), colAmt, y, { size: 10, font: bold, align: 'right' })

  // ── Totals (right) + amount in words (left) ─────────────────────────────
  y = rowTop - rowH - 26
  const totalsW = 230
  const labelX = PAGE_W - MARGIN - totalsW
  const valRight = PAGE_W - MARGIN - 12
  const totalsTop = y + 10

  const row = (label: string, value: string) => {
    draw(label, labelX + 12, y, { size: 9.5, color: MUTED })
    draw(value, valRight, y, { size: 9.5, align: 'right' })
    y -= 19
  }
  row('Taxable value', money(data.taxableAmount, data.currency))
  if (data.igst > 0) {
    row(`IGST @ ${data.taxRate}%`, money(data.igst, data.currency))
  } else {
    row(`CGST @ ${data.taxRate / 2}%`, money(data.cgst, data.currency))
    row(`SGST @ ${data.taxRate / 2}%`, money(data.sgst, data.currency))
  }
  y -= 2
  roundRect(labelX, y + 14, totalsW, 34, 8, BRAND)
  draw('Total due', labelX + 14, y - 3, { size: 10.5, font: bold, color: WHITE })
  draw(money(data.total, data.currency), valRight + 2, y - 3, { size: 13, font: bold, color: WHITE, align: 'right' })
  const totalsBottom = y - 20

  const wordsW = CONTENT_W - totalsW - 24
  draw('AMOUNT IN WORDS', MARGIN, totalsTop - 8, { size: 7.5, font: bold, color: BRAND })
  const wordsEnd = paragraph(amountInWords(data.total), MARGIN, totalsTop - 24, wordsW, {
    size: 10,
    font: bold,
    color: INK,
    gap: 14,
  })

  // ── Bank details + notes ────────────────────────────────────────────────
  y = Math.min(totalsBottom, wordsEnd - 10) - 22
  if (data.bankDetails) {
    const bankLines = safe(data.bankDetails).split('\n').length
    const h = 34 + bankLines * 12
    roundRect(MARGIN, y + 8, CONTENT_W, h, 8, CARD, LINE)
    draw('PAYMENT DETAILS', MARGIN + 14, y - 10, { size: 7.5, font: bold, color: BRAND })
    paragraph(data.bankDetails, MARGIN + 14, y - 26, CONTENT_W - 28, { size: 9, color: INK, gap: 12 })
    y -= h + 14
  }

  draw('NOTES', MARGIN, y - 4, { size: 7.5, font: bold, color: BRAND })
  paragraph(
    'Thank you for choosing ARC PEM. This invoice is for your subscription and is subject to the terms agreed at purchase. For billing questions, reply to the email this invoice was sent with.',
    MARGIN,
    y - 18,
    CONTENT_W,
    { size: 8.5, gap: 12 }
  )

  // ── Footer ──────────────────────────────────────────────────────────────
  hLine(MARGIN + 28)
  draw('This is a computer-generated invoice and does not require a signature.', MARGIN, MARGIN + 12, {
    size: 8,
    color: MUTED,
  })
  draw(safe(data.sellerName), PAGE_W - MARGIN, MARGIN + 12, { size: 8, font: bold, color: BRAND, align: 'right' })

  return doc.save()
}

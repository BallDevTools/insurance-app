'use strict'

const PDFDocument = require('pdfkit')
const path = require('path')
const fs = require('fs')

// Thai-capable fonts (priority order)
const THAI_FONTS = [
  'C:/Windows/Fonts/tahoma.ttf',
  'C:/Windows/Fonts/cordia.ttc',
  '/usr/share/fonts/truetype/thai/TlwgTypewriter.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
]

function getThaiFont() {
  for (const f of THAI_FONTS) {
    if (fs.existsSync(f)) return f
  }
  return null  // fallback to Helvetica (no Thai)
}

const COVERAGE_LABELS = {
  ownDamage: 'ความเสียหายต่อตัวรถ',
  thirdPartyBody: 'ความเสียหายต่อร่างกายบุคคลภายนอก',
  thirdPartyProperty: 'ความเสียหายต่อทรัพย์สินบุคคลภายนอก',
  theft: 'การสูญหาย/ไฟไหม้',
  fire: 'ไฟไหม้',
  flood: 'น้ำท่วม',
  personalAccident: 'อุบัติเหตุส่วนบุคคล',
  medicalExpense: 'ค่ารักษาพยาบาล'
}

const TYPE_MAP = { class1: 'ประกันชั้น 1', class2plus: 'ประกันชั้น 2+', class3plus: 'ประกันชั้น 3+' }

function formatNum(n) {
  return Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatNumInt(n) {
  return Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 0 })
}

/**
 * Generate PDF quote buffer
 * @param {Object} quote - quote row from DB
 * @param {Object} lead - customer_lead row (optional)
 * @param {Object} insuranceConfig - INSURANCE_TYPES[quote.insurance_type]
 * @returns {Promise<Buffer>}
 */
function generateQuotePDF(quote, lead, insuranceConfig) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, info: {
      Title: `ใบเสนอราคาประกันภัย ${quote.quote_number}`,
      Author: 'ระบบประกันรถยนต์ออนไลน์'
    }})

    const chunks = []
    doc.on('data', chunk => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const thaiFont = getThaiFont()
    const fontName = thaiFont || 'Helvetica'

    if (thaiFont) {
      doc.registerFont('Thai', thaiFont)
      doc.registerFont('ThaiBold', thaiFont)
    }

    const useFont  = (size = 11) => thaiFont ? doc.font('Thai').fontSize(size) : doc.font('Helvetica').fontSize(size)
    const useBold  = (size = 11) => thaiFont ? doc.font('ThaiBold').fontSize(size) : doc.font('Helvetica-Bold').fontSize(size)

    const W = doc.page.width - 100  // usable width (margin 50 each side)
    const L = 50  // left margin

    // ─── HEADER ───────────────────────────────────────────────
    // Blue header bar
    doc.rect(0, 0, doc.page.width, 80).fill('#1a56db')
    useBold(20).fillColor('white')
    doc.text('ใบเสนอราคาประกันภัยรถยนต์', L, 22, { width: W - 150 })
    useFont(10).fillColor('#bfdbfe')
    doc.text('MOTOR INSURANCE QUOTATION', L, 48, { width: W })

    // Quote number box (top right)
    doc.rect(doc.page.width - 175, 15, 155, 50).fill('#1e40af').stroke('#3b82f6')
    useFont(8).fillColor('#93c5fd').text('เลขที่ใบเสนอราคา', doc.page.width - 175, 20, { width: 155, align: 'center' })
    useBold(12).fillColor('white').text(quote.quote_number, doc.page.width - 175, 33, { width: 155, align: 'center' })

    doc.fillColor('#1f2937')

    // ─── INFO SECTION ──────────────────────────────────────────
    let y = 100

    // Date + expiry
    useFont(9).fillColor('#6b7280')
    const createdDate = new Date(quote.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
    const expiresDate = quote.expires_at ? new Date(quote.expires_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'
    doc.text(`วันที่ออก: ${createdDate}    วันหมดอายุ: ${expiresDate}`, L, y)
    y += 20

    // ─── SECTION: ข้อมูลรถยนต์ ──────────────────────────────
    y = drawSectionHeader(doc, useBold, useFont, L, W, y, 'ข้อมูลรถยนต์')
    y = drawInfoRow(doc, useFont, L, W, y, 'ยี่ห้อ / รุ่น', `${quote.car_brand} ${quote.car_model}`)
    y = drawInfoRow(doc, useFont, L, W, y, 'ปีผลิต', String(quote.car_year))
    y = drawInfoRow(doc, useFont, L, W, y, 'ทะเบียนรถ', quote.license_plate)
    y = drawInfoRow(doc, useFont, L, W, y, 'จังหวัดจดทะเบียน', quote.province)
    y = drawInfoRow(doc, useFont, L, W, y, 'มูลค่ารถ (ประเมิน)', `${formatNumInt(quote.car_value)} บาท`)
    y = drawInfoRow(doc, useFont, L, W, y, 'ประเภทประกัน', TYPE_MAP[quote.insurance_type] || quote.insurance_type)
    y += 6

    // ─── SECTION: ความคุ้มครอง ──────────────────────────────
    y = drawSectionHeader(doc, useBold, useFont, L, W, y, 'ความคุ้มครอง')
    const coverageDetails = typeof quote.coverage_details === 'string'
      ? JSON.parse(quote.coverage_details)
      : (quote.coverage_details || {})

    for (const [key, val] of Object.entries(coverageDetails)) {
      const label = COVERAGE_LABELS[key] || key
      const isNotCovered = val === 'ไม่คุ้มครอง' || val === false
      useFont(9).fillColor(isNotCovered ? '#9ca3af' : '#1f2937')
      doc.text(`${isNotCovered ? '✗' : '✓'}  ${label}`, L + 10, y, { width: W * 0.5 })
      useFont(9).fillColor(isNotCovered ? '#9ca3af' : '#374151')
      doc.text(val === false ? 'ไม่คุ้มครอง' : val === true ? 'คุ้มครอง' : String(val), L + W * 0.55, y, { width: W * 0.45 })
      y += 16
    }
    y += 6

    // ─── SECTION: เบี้ยประกัน ──────────────────────────────
    y = drawSectionHeader(doc, useBold, useFont, L, W, y, 'สรุปเบี้ยประกัน')

    const netPremium = Math.round(quote.premium_amount / 1.07 / 1.004)
    const stampDuty  = Math.round(netPremium * 0.004)
    const vat        = Math.round((netPremium + stampDuty) * 0.07)
    const total      = quote.premium_amount

    y = drawPremiumRow(doc, useFont, L, W, y, 'เบี้ยประกันสุทธิ', `${formatNum(netPremium)} บาท`, false)
    y = drawPremiumRow(doc, useFont, L, W, y, 'อากรแสตมป์ (0.4%)', `${formatNum(stampDuty)} บาท`, false)
    y = drawPremiumRow(doc, useFont, L, W, y, 'ภาษีมูลค่าเพิ่ม (7%)', `${formatNum(vat)} บาท`, false)

    // Total box
    y += 4
    doc.rect(L, y, W, 36).fill('#1a56db')
    useBold(13).fillColor('white')
    doc.text('เบี้ยประกันรวมทั้งสิ้น', L + 10, y + 10, { width: W * 0.55 })
    useBold(15).fillColor('white')
    doc.text(`฿ ${formatNum(total)}`, L + W * 0.55, y + 8, { width: W * 0.42, align: 'right' })
    y += 46

    // ─── CUSTOMER (if provided) ──────────────────────────────
    if (lead) {
      y = drawSectionHeader(doc, useBold, useFont, L, W, y, 'ข้อมูลลูกค้า')
      y = drawInfoRow(doc, useFont, L, W, y, 'ชื่อ-นามสกุล', lead.full_name)
      y = drawInfoRow(doc, useFont, L, W, y, 'เบอร์โทรศัพท์', lead.phone)
      if (lead.email) y = drawInfoRow(doc, useFont, L, W, y, 'อีเมล', lead.email)
    }

    // ─── FOOTER ──────────────────────────────────────────────
    const footerY = doc.page.height - 70
    doc.rect(0, footerY, doc.page.width, 70).fill('#f3f4f6')
    useFont(8).fillColor('#6b7280')
    doc.text(
      'เอกสารนี้เป็นใบเสนอราคาเท่านั้น ไม่ใช่กรมธรรม์ประกันภัย • กรุณาติดต่อเจ้าหน้าที่เพื่อยืนยันการซื้อประกัน',
      L, footerY + 12, { width: W, align: 'center' }
    )
    useFont(8).fillColor('#9ca3af')
    doc.text(
      `สร้างโดยระบบประกันรถยนต์ออนไลน์ • ${new Date().toLocaleDateString('th-TH')}`,
      L, footerY + 28, { width: W, align: 'center' }
    )

    doc.end()
  })
}

function drawSectionHeader(doc, useBold, useFont, L, W, y, title) {
  doc.rect(L, y, W, 24).fill('#eff6ff')
  useBold(10).fillColor('#1a56db').text(title, L + 8, y + 7, { width: W })
  doc.fillColor('#1f2937')
  return y + 30
}

function drawInfoRow(doc, useFont, L, W, y, label, value) {
  useFont(9).fillColor('#6b7280').text(label, L + 10, y, { width: W * 0.38 })
  useFont(9).fillColor('#111827').text(value, L + W * 0.42, y, { width: W * 0.56 })
  y += 15
  doc.moveTo(L + 10, y - 2).lineTo(L + W - 10, y - 2).strokeColor('#f3f4f6').lineWidth(0.5).stroke()
  return y + 2
}

function drawPremiumRow(doc, useFont, L, W, y, label, value, bold) {
  useFont(9).fillColor('#6b7280').text(label, L + 10, y, { width: W * 0.55 })
  useFont(9).fillColor('#111827').text(value, L + W * 0.55, y, { width: W * 0.42, align: 'right' })
  return y + 18
}

module.exports = { generateQuotePDF }

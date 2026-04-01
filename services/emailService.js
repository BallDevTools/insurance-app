'use strict'

const nodemailer = require('nodemailer')
const { generateQuotePDF } = require('./pdfService')

// สร้าง transporter จาก env vars
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || ''
    }
  })
}

const FROM = process.env.SMTP_FROM || 'ระบบประกันรถยนต์ <noreply@insurance.local>'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.SMTP_USER || ''

const TYPE_MAP = { class1: 'ประกันชั้น 1', class2plus: 'ประกันชั้น 2+', class3plus: 'ประกันชั้น 3+' }

function fmt(n) {
  return Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 0 })
}

/**
 * ส่ง email + PDF ให้ลูกค้าหลัง submit contact form
 */
async function sendQuoteToCustomer(quote, lead) {
  if (!ADMIN_EMAIL || !process.env.SMTP_USER) return  // ยังไม่ได้ตั้งค่า SMTP

  const pdfBuf = await generateQuotePDF(quote, lead, null)
  const netPremium = Math.round(quote.premium_amount / 1.07 / 1.004)
  const stampDuty  = Math.round(netPremium * 0.004)
  const vat        = Math.round((netPremium + stampDuty) * 0.07)

  const html = `
<!DOCTYPE html>
<html lang="th">
<head><meta charset="UTF-8">
<style>
  body { font-family: 'Sarabun', Arial, sans-serif; background: #f3f4f6; margin: 0; padding: 0; }
  .wrap { max-width: 600px; margin: 0 auto; background: #fff; }
  .header { background: #1a56db; color: #fff; padding: 32px 40px; }
  .header h1 { margin: 0; font-size: 22px; }
  .header p { margin: 6px 0 0; font-size: 13px; opacity: .8; }
  .body { padding: 32px 40px; }
  .info-box { background: #eff6ff; border-left: 4px solid #1a56db; padding: 16px 20px; border-radius: 8px; margin: 20px 0; }
  .info-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
  .info-row:last-child { border: none; }
  .label { color: #6b7280; }
  .value { font-weight: 600; color: #111827; }
  .total-box { background: #1a56db; color: #fff; padding: 20px; border-radius: 8px; text-align: center; margin: 24px 0; }
  .total-box .amount { font-size: 28px; font-weight: 700; margin: 4px 0; }
  .footer { background: #f9fafb; padding: 24px 40px; font-size: 12px; color: #9ca3af; text-align: center; }
  .btn { display: inline-block; background: #1a56db; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>🛡️ ใบเสนอราคาประกันภัยรถยนต์</h1>
    <p>ระบบประกันรถยนต์ออนไลน์</p>
  </div>
  <div class="body">
    <p>เรียนคุณ ${lead.full_name},</p>
    <p>ขอบคุณที่สนใจบริการของเรา ใบเสนอราคาของคุณพร้อมแล้ว กรุณาตรวจสอบรายละเอียดด้านล่าง</p>

    <div class="info-box">
      <div class="info-row">
        <span class="label">เลขที่ใบเสนอราคา</span>
        <span class="value">${quote.quote_number}</span>
      </div>
      <div class="info-row">
        <span class="label">รถยนต์</span>
        <span class="value">${quote.car_brand} ${quote.car_model} ปี ${quote.car_year}</span>
      </div>
      <div class="info-row">
        <span class="label">ทะเบียน</span>
        <span class="value">${quote.license_plate}</span>
      </div>
      <div class="info-row">
        <span class="label">จังหวัด</span>
        <span class="value">${quote.province}</span>
      </div>
      <div class="info-row">
        <span class="label">ประเภทประกัน</span>
        <span class="value">${TYPE_MAP[quote.insurance_type] || quote.insurance_type}</span>
      </div>
    </div>

    <div class="total-box">
      <div style="font-size:13px;opacity:.8">เบี้ยประกันรวม (รวม VAT + อากรแสตมป์)</div>
      <div class="amount">฿ ${fmt(quote.premium_amount)}</div>
    </div>

    <p style="font-size:13px;color:#6b7280">
      เจ้าหน้าที่จะติดต่อกลับภายใน 1 วันทำการ หากมีคำถามกรุณาโทร ${process.env.SITE_PHONE || '02-xxx-xxxx'}
    </p>
  </div>
  <div class="footer">
    ใบเสนอราคานี้มีอายุ 30 วัน • เอกสารแนบด้านล่างคือ PDF ใบเสนอราคา<br>
    © ระบบประกันรถยนต์ออนไลน์
  </div>
</div>
</body>
</html>`

  const transporter = createTransporter()
  await transporter.sendMail({
    from: FROM,
    to: lead.email,
    subject: `ใบเสนอราคาประกันภัยรถยนต์ ${quote.quote_number}`,
    html,
    attachments: [{
      filename: `quote_${quote.quote_number}.pdf`,
      content: pdfBuf,
      contentType: 'application/pdf'
    }]
  })
}

/**
 * แจ้ง admin เมื่อมี lead ใหม่
 */
async function notifyAdminNewLead(quote, lead) {
  if (!ADMIN_EMAIL || !process.env.SMTP_USER) return

  const html = `
<!DOCTYPE html>
<html lang="th">
<head><meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; background: #f3f4f6; margin: 0; }
  .wrap { max-width: 600px; margin: 0 auto; background: #fff; }
  .header { background: #059669; color: #fff; padding: 24px 32px; }
  .header h2 { margin: 0; font-size: 18px; }
  .body { padding: 24px 32px; }
  .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
  .label { color: #6b7280; }
  .value { font-weight: 600; }
  .btn { display: inline-block; background: #1a56db; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 16px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header"><h2>🔔 Lead ใหม่เข้ามา!</h2></div>
  <div class="body">
    <div class="info-row"><span class="label">ชื่อลูกค้า</span><span class="value">${lead.full_name}</span></div>
    <div class="info-row"><span class="label">เบอร์โทร</span><span class="value">${lead.phone}</span></div>
    <div class="info-row"><span class="label">อีเมล</span><span class="value">${lead.email || '-'}</span></div>
    <div class="info-row"><span class="label">ช่องทาง</span><span class="value">${lead.preferred_contact}</span></div>
    <div class="info-row"><span class="label">รถ</span><span class="value">${quote.car_brand} ${quote.car_model} ${quote.car_year}</span></div>
    <div class="info-row"><span class="label">ทะเบียน</span><span class="value">${quote.license_plate}</span></div>
    <div class="info-row"><span class="label">ประกัน</span><span class="value">${TYPE_MAP[quote.insurance_type]}</span></div>
    <div class="info-row"><span class="label">เบี้ย</span><span class="value">฿ ${fmt(quote.premium_amount)}</span></div>
    <a href="${process.env.APP_URL || 'http://localhost:3000'}/admin/quotes" class="btn">เปิด Admin →</a>
  </div>
</div>
</body>
</html>`

  const transporter = createTransporter()
  await transporter.sendMail({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `[Lead ใหม่] ${lead.full_name} — ${quote.car_brand} ${quote.car_model} (${TYPE_MAP[quote.insurance_type]})`,
    html
  })
}

/**
 * ส่ง Renewal Reminder ให้ลูกค้า
 */
async function sendRenewalReminder(quote, lead, daysLeft) {
  if (!ADMIN_EMAIL || !process.env.SMTP_USER || !lead.email) return

  const html = `
<!DOCTYPE html>
<html lang="th">
<head><meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; background: #f3f4f6; margin: 0; }
  .wrap { max-width: 600px; margin: 0 auto; background: #fff; }
  .header { background: ${daysLeft <= 7 ? '#dc2626' : '#d97706'}; color: #fff; padding: 24px 32px; }
  .header h2 { margin: 0; font-size: 18px; }
  .body { padding: 24px 32px; font-size: 14px; }
  .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
  .label { color: #6b7280; }
  .value { font-weight: 600; }
  .btn { display: inline-block; background: #1a56db; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 16px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h2>${daysLeft <= 7 ? '🚨' : '⚠️'} ประกันรถยนต์ใกล้หมดอายุ — เหลือ ${daysLeft} วัน</h2>
  </div>
  <div class="body">
    <p>เรียนคุณ ${lead.full_name},</p>
    <p>ประกันรถยนต์ของคุณกำลังจะหมดอายุในอีก <strong>${daysLeft} วัน</strong> กรุณาต่ออายุเพื่อความต่อเนื่องในการคุ้มครอง</p>
    <div class="info-row"><span class="label">รถยนต์</span><span class="value">${quote.car_brand} ${quote.car_model} ${quote.car_year}</span></div>
    <div class="info-row"><span class="label">ทะเบียน</span><span class="value">${quote.license_plate}</span></div>
    <div class="info-row"><span class="label">ประเภทประกัน</span><span class="value">${TYPE_MAP[quote.insurance_type] || quote.insurance_type}</span></div>
    <div class="info-row"><span class="label">วันหมดอายุ</span><span class="value">${new Date(quote.expires_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
    <a href="${process.env.APP_URL || 'http://localhost:3000'}" class="btn">ต่ออายุประกัน →</a>
    <p style="margin-top:16px;color:#6b7280;font-size:13px">หรือโทรหาเจ้าหน้าที่: ${process.env.SITE_PHONE || '02-xxx-xxxx'}</p>
  </div>
</div>
</body>
</html>`

  const transporter = createTransporter()
  await transporter.sendMail({
    from: FROM,
    to: lead.email,
    subject: `⚠️ ประกันรถยนต์ทะเบียน ${quote.license_plate} หมดอายุใน ${daysLeft} วัน`,
    html
  })
}

module.exports = { sendQuoteToCustomer, notifyAdminNewLead, sendRenewalReminder }

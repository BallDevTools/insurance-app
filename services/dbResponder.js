'use strict'

const db = require('../db')
const { textMsg, quoteBubble } = require('./lineBot')

// =============================================
// ตอบคำถามจากข้อมูลใน DB
// =============================================

// ค้นหา quote จาก quote number หรือทะเบียน
async function lookupQuote(params) {
  let rows = []

  if (params.quoteNumber) {
    ;[rows] = await db.query(
      'SELECT * FROM quotes WHERE quote_number = ? LIMIT 1',
      [params.quoteNumber.toUpperCase()]
    )
  } else if (params.plate) {
    const cleanPlate = params.plate.replace(/\s/g, '').toUpperCase()
    ;[rows] = await db.query(
      'SELECT * FROM quotes WHERE REPLACE(license_plate, " ", "") LIKE ? ORDER BY created_at DESC LIMIT 3',
      [`%${cleanPlate}%`]
    )
  }

  if (rows.length === 0) return null
  return rows
}

// ข้อมูลความคุ้มครองแต่ละชั้น
const COVERAGE_TEXT = {
  class1: `🛡️ ประกันชั้น 1
• ซ่อมรถตัวเองทุกกรณี (ชน/น้ำท่วม/ไฟ/โจรกรรม)
• บุคคลที่ 3 สูงสุด 10 ล้าน/ครั้ง
• ทรัพย์สินที่ 3 สูงสุด 5 ล้าน/ครั้ง
• อุบัติเหตุส่วนบุคคล 100,000 บาท/คน
• ค่ารักษาพยาบาล 50,000 บาท/คน`,

  class2plus: `🛡️ ประกันชั้น 2+
• ซ่อมรถตัวเองเฉพาะกรณีชนรถ
• ไฟไหม้ + โจรกรรม
• บุคคลที่ 3 สูงสุด 5 ล้าน/ครั้ง
• ทรัพย์สินที่ 3 สูงสุด 1 ล้าน/ครั้ง
• อุบัติเหตุส่วนบุคคล 100,000 บาท/คน`,

  class3plus: `🛡️ ประกันชั้น 3+
• ซ่อมรถตัวเองเฉพาะกรณีชนรถยนต์
• บุคคลที่ 3 สูงสุด 1 ล้าน/ครั้ง
• ทรัพย์สินที่ 3 สูงสุด 500,000 บาท/ครั้ง
• อุบัติเหตุส่วนบุคคล 100,000 บาท/คน`
}

async function handleIntent(intent, params) {
  switch (intent) {

    case 'greeting':
      return {
        found: true,
        messages: [textMsg(
          'สวัสดีครับ! 🙏 ยินดีให้บริการจากระบบประกันรถยนต์ออนไลน์\n\n' +
          'สามารถสอบถามได้เลยครับ เช่น\n' +
          '📋 เช็คใบเสนอราคา เช่น "QT260312XXXXX"\n' +
          '💰 สอบถามราคาประกัน\n' +
          '🛡️ ข้อมูลความคุ้มครอง\n' +
          '👤 ติดต่อเจ้าหน้าที่'
        )]
      }

    case 'quote_lookup': {
      const quotes = await lookupQuote(params)
      if (!quotes) {
        return {
          found: false,
          messages: [textMsg('ไม่พบใบเสนอราคาที่ค้นหาครับ กรุณาตรวจสอบเลขที่ใบเสนอราคา หรือทะเบียนรถอีกครั้ง')]
        }
      }
      const messages = []
      if (quotes.length > 1) {
        messages.push(textMsg(`พบ ${quotes.length} ใบเสนอราคา ดังนี้ครับ 👇`))
      }
      for (const q of quotes.slice(0, 3)) {
        messages.push(quoteBubble(q))
      }
      return { found: true, messages }
    }

    case 'coverage_info': {
      const text = params.text || ''
      let key = null
      if (/ชั้น 1|ชั้นหนึ่ง|class1/i.test(text)) key = 'class1'
      else if (/ชั้น 2|ชั้นสอง|2\+|class2/i.test(text)) key = 'class2plus'
      else if (/ชั้น 3|ชั้นสาม|3\+|class3/i.test(text)) key = 'class3plus'

      if (key) {
        return { found: true, messages: [textMsg(COVERAGE_TEXT[key])] }
      }
      // ไม่ระบุชั้น — แสดงทั้งหมด
      return {
        found: true,
        messages: [textMsg(
          'มีประกัน 3 ประเภทครับ:\n\n' +
          Object.values(COVERAGE_TEXT).join('\n\n─────────────\n\n')
        )]
      }
    }

    case 'price_inquiry':
      return {
        found: true,
        messages: [textMsg(
          '💰 อัตราเบี้ยประกัน (โดยประมาณ)\n\n' +
          '🔵 ชั้น 1 — ประมาณ 4.2% ของมูลค่ารถ\n' +
          '🟢 ชั้น 2+ — ประมาณ 2.2% ของมูลค่ารถ\n' +
          '🟡 ชั้น 3+ — ประมาณ 1.0% ของมูลค่ารถ\n\n' +
          'ราคาจริงขึ้นอยู่กับ: ยี่ห้อ/รุ่น/ปีรถ และจังหวัด\n\n' +
          '📲 คำนวณราคาที่แน่นอนได้ที่:\n' +
          `${process.env.APP_URL || 'http://localhost:3000'}`
        )]
      }

    case 'thanks':
      return {
        found: true,
        messages: [textMsg('ยินดีให้บริการเสมอครับ 🙏 มีคำถามอื่นเพิ่มเติมได้เลยนะครับ')]
      }

    case 'farewell':
      return {
        found: true,
        messages: [textMsg('ขอบคุณที่ใช้บริการครับ ลาก่อนนะครับ 👋')]
      }

    case 'handoff_request':
    case 'contact_request':
      return { found: true, needsHandoff: true, messages: [] }

    default:
      return { found: false, messages: [] }
  }
}

module.exports = { handleIntent, lookupQuote }

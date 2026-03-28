'use strict'

// =============================================
// Intent Detection — keyword-based
// =============================================

const INTENTS = {
  greeting: {
    patterns: [/^สวัสดี/i, /^หวัดดี/i, /^ดี$/i, /^hello/i, /^hi\b/i, /^ไง/i, /^มีใคร/i]
  },
  quote_lookup: {
    // ค้นหาใบเสนอราคาด้วย quote number หรือทะเบียนรถ
    patterns: [/QT\d{7,}/i, /ใบเสนอ/, /เช็คราคา.*QT/, /ดูใบ/],
    extract: (text) => {
      const qn = text.match(/QT\d{7,}/i)
      const plate = text.match(/[ก-ฮ]{1,3}\s*\d{1,4}/)
      return { quoteNumber: qn ? qn[0].toUpperCase() : null, plate: plate ? plate[0] : null }
    }
  },
  price_inquiry: {
    // ถามราคาประกันรถ
    patterns: [/ราคา/, /เบี้ย/, /ค่าประกัน/, /ประกัน.*เท่าไ/, /แพง/, /ถูก/, /คำนวณ/]
  },
  coverage_info: {
    // ถามความคุ้มครอง
    patterns: [/ความคุ้มครอง/, /คุ้มครอง/, /ชั้น [123]/, /ชั้นหนึ่ง/, /ชั้นสอง/, /ชั้นสาม/, /class\s*[123]/i, /ประกันชั้น/]
  },
  contact_request: {
    // ต้องการติดต่อเจ้าหน้าที่
    patterns: [/ติดต่อ.*คน/, /คุย.*เจ้าหน้า/, /เจ้าหน้าที่/, /ต้องการคน/, /มีคนช่วย/, /agent/, /คน/, /โทร/]
  },
  handoff_request: {
    // บอกตรงๆ ว่าต้องการคน
    patterns: [/^ติดต่อเจ้าหน้าที่$/, /^ต้องการคุยกับคน$/, /^ขอคุยกับคน/, /^handoff/i, /^โอนสาย/]
  },
  thanks: {
    patterns: [/ขอบคุณ/, /ขอบใจ/, /ขอบพระคุณ/, /thanks/i, /thank you/i, /🙏/]
  },
  farewell: {
    patterns: [/ลาก่อน/, /บาย/, /goodbye/i, /^bye/i, /ออกไปแล้ว/]
  }
}

function detectIntent(text) {
  const t = text.trim()

  for (const [intent, config] of Object.entries(INTENTS)) {
    for (const pattern of config.patterns) {
      if (pattern.test(t)) {
        const params = config.extract ? config.extract(t) : {}
        return { intent, params }
      }
    }
  }

  // ไม่รู้ intent — ส่งไป AI
  return { intent: 'unknown', params: {} }
}

module.exports = { detectIntent }

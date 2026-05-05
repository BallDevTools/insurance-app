'use strict'

const Groq = require('groq-sdk')

const SYSTEM_PROMPT = `คุณเป็นผู้ช่วยของบริษัทประกันรถยนต์ออนไลน์ ตอบภาษาไทยเสมอ กระชับ ชัดเจน เป็นมิตร

ข้อมูลบริษัท:
- ให้บริการประกันรถยนต์ ชั้น 1, ชั้น 2+, ชั้น 3+
- คำนวณเบี้ยออนไลน์ได้ที่ ${process.env.APP_URL || 'http://localhost:3000'}
- สามารถค้นหาราคาด้วยยี่ห้อ รุ่น และปีรถได้

กฎการตอบ:
1. ตอบสั้นๆ ไม่เกิน 200 คำ
2. ถ้าถามเรื่องราคาจริง แนะนำให้คำนวณบนเว็บ
3. ถ้าไม่ทราบข้อมูล ให้บอกตรงๆ และแนะนำให้ติดต่อเจ้าหน้าที่
4. ห้ามแต่งข้อมูลราคาหรือความคุ้มครองที่ไม่แน่ใจ`

let client = null

function getClient() {
  if (!client) {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) return null
    client = new Groq({ apiKey })
  }
  return client
}

async function getAIResponse(userMessage, conversationHistory = []) {
  const ai = getClient()
  if (!ai) {
    return 'ขออภัยครับ ระบบ AI ยังไม่พร้อมใช้งาน กรุณาติดต่อเจ้าหน้าที่โดยตรงครับ 🙏'
  }

  try {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversationHistory.slice(-6),
      { role: 'user', content: userMessage }
    ]

    const response = await ai.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 400,
      messages
    })

    return response.choices[0]?.message?.content || 'ขออภัยครับ ไม่สามารถตอบได้ในขณะนี้'
  } catch (err) {
    console.error('[AI] Error:', err.message)
    return 'ขออภัยครับ เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้งหรือติดต่อเจ้าหน้าที่ครับ'
  }
}

module.exports = { getAIResponse }

'use strict'

const db = require('../db')
const { validateSignature, replyMessage, getUserProfile, textMsg } = require('../services/lineBot')
const { detectIntent } = require('../services/intentDetector')
const { handleIntent } = require('../services/dbResponder')
const { getAIResponse } = require('../services/aiResponder')

// =============================================
// LINE Webhook Plugin
// =============================================

const MAX_ASK_BEFORE_HANDOFF = 3  // ถาม AI ไม่ได้ 3 ครั้ง → handoff

module.exports = async function webhookPlugin(fastify, opts) {

  // ต้องอ่าน raw body เพื่อตรวจ signature
  fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    try {
      req.rawBody = body
      done(null, JSON.parse(body.toString()))
    } catch (err) {
      done(err)
    }
  })

  // ============================================================
  // POST /webhook/line — รับ event จาก LINE
  // ============================================================
  fastify.post('/webhook/line', async (req, reply) => {
    // ตรวจ signature
    const signature = req.headers['x-line-signature']
    if (!validateSignature(req.rawBody, signature)) {
      return reply.status(403).send({ error: 'Invalid signature' })
    }

    const events = req.body?.events || []

    // ประมวลผล events แบบ parallel
    await Promise.all(events.map(event => handleEvent(event).catch(err => {
      console.error('[Webhook] Event error:', err.message)
    })))

    return reply.send({ ok: true })
  })

  // ============================================================
  // GET /webhook/line — LINE verify endpoint
  // ============================================================
  fastify.get('/webhook/line', async (req, reply) => {
    return reply.send({ status: 'LINE Webhook ready' })
  })
}

// =============================================
// จัดการแต่ละ event
// =============================================
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return
  if (!event.source?.userId) return

  const userId = event.source.userId
  const text = event.message.text.trim()
  const replyToken = event.replyToken

  // โหลด session
  let session = await getOrCreateSession(userId)

  // บันทึก message ที่รับมา
  await saveMessage(userId, 'in', text)

  // ถ้า user อยู่ใน handoff mode → ไม่ตอบ (ให้ admin ตอบ)
  if (session.state === 'handoff') {
    await replyMessage(replyToken, [
      textMsg('ข้อความของคุณถูกส่งถึงเจ้าหน้าที่แล้วครับ กรุณารอสักครู่ 🙏')
    ])
    return
  }

  // ตรวจ intent
  const { intent, params } = detectIntent(text)
  params.text = text  // ส่ง text ดิบไปด้วยสำหรับ dbResponder

  // handoff request ทันที
  if (intent === 'handoff_request' || intent === 'contact_request') {
    await setHandoffState(session, userId)
    await replyMessage(replyToken, [
      textMsg('กำลังโอนสายให้เจ้าหน้าที่ครับ ⏳\nเจ้าหน้าที่จะติดต่อกลับเร็วๆ นี้ กรุณารอสักครู่ 🙏')
    ])
    return
  }

  // ลอง DB responder ก่อน
  const dbResult = await handleIntent(intent, params)

  if (dbResult.needsHandoff) {
    await setHandoffState(session, userId)
    await replyMessage(replyToken, [
      textMsg('กำลังโอนสายให้เจ้าหน้าที่ครับ ⏳\nเจ้าหน้าที่จะติดต่อกลับเร็วๆ นี้ 🙏')
    ])
    return
  }

  if (dbResult.found && dbResult.messages.length > 0) {
    // ตอบจาก DB
    await replyMessage(replyToken, dbResult.messages)
    for (const m of dbResult.messages) {
      const txt = m.type === 'text' ? m.text : `[${m.altText || 'flex'}]`
      await saveMessage(userId, 'out', txt, 'bot')
    }
    await resetAskCount(userId)
    return
  }

  // Fallback → AI
  const context = await getConversationHistory(userId)
  const aiText = await getAIResponse(text, context)

  await replyMessage(replyToken, [textMsg(aiText)])
  await saveMessage(userId, 'out', aiText, 'ai')

  // นับจำนวนครั้งที่ใช้ AI
  const newCount = (session.ask_count || 0) + 1
  await db.query('UPDATE line_sessions SET ask_count = ?, last_message = ? WHERE line_user_id = ?',
    [newCount, text, userId])

  // ถ้าถาม AI บ่อยเกินไป → แนะนำ handoff
  if (newCount >= MAX_ASK_BEFORE_HANDOFF) {
    await replyMessage(replyToken, [
      textMsg('หากต้องการข้อมูลเพิ่มเติมหรือต้องการพูดคุยกับเจ้าหน้าที่โดยตรง\nพิมพ์ "ติดต่อเจ้าหน้าที่" ได้เลยครับ 😊')
    ])
    await db.query('UPDATE line_sessions SET ask_count = 0 WHERE line_user_id = ?', [userId])
  }
}

// =============================================
// Session helpers
// =============================================

async function getOrCreateSession(userId) {
  const [rows] = await db.query('SELECT * FROM line_sessions WHERE line_user_id = ?', [userId])
  if (rows.length > 0) {
    await db.query('UPDATE line_sessions SET updated_at = NOW() WHERE line_user_id = ?', [userId])
    return rows[0]
  }

  // ดึงโปรไฟล์จาก LINE
  const profile = await getUserProfile(userId)
  await db.query(
    'INSERT INTO line_sessions (line_user_id, display_name, picture_url) VALUES (?, ?, ?)',
    [userId, profile?.displayName || 'Unknown', profile?.pictureUrl || null]
  )
  const [newRows] = await db.query('SELECT * FROM line_sessions WHERE line_user_id = ?', [userId])
  return newRows[0]
}

async function setHandoffState(session, userId) {
  await db.query(
    'UPDATE line_sessions SET state = "handoff", handoff_at = NOW() WHERE line_user_id = ?',
    [userId]
  )
}

async function resetAskCount(userId) {
  await db.query('UPDATE line_sessions SET ask_count = 0 WHERE line_user_id = ?', [userId])
}

async function saveMessage(userId, direction, message, sentBy = 'bot') {
  await db.query(
    'INSERT INTO line_messages (line_user_id, direction, message, sent_by) VALUES (?, ?, ?, ?)',
    [userId, direction, message, sentBy]
  )
}

async function getConversationHistory(userId) {
  const [rows] = await db.query(
    'SELECT direction, message FROM line_messages WHERE line_user_id = ? ORDER BY created_at DESC LIMIT 10',
    [userId]
  )
  return rows.reverse().map(r => ({
    role: r.direction === 'in' ? 'user' : 'assistant',
    content: r.message
  }))
}

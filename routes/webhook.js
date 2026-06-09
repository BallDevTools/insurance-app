'use strict'

const db = require('../db')
const { validateSignature, replyMessage, getUserProfile, textMsg, welcomeBubble } = require('../services/lineBot')
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
    if (!await validateSignature(req.rawBody, signature)) {
      return reply.status(403).send({ error: 'Invalid signature' })
    }

    const events = req.body?.events || []

    // ประมวลผล events แบบ sequential (เพื่อความปลอดภัยของ session)
    for (const event of events) {
      try {
        // Idempotency: ตรวจ messageId ซ้ำ
        if (event.message?.id) {
          const [existing] = await db.query(
            'SELECT id FROM line_messages WHERE line_message_id = ? LIMIT 1',
            [event.message.id]
          ).catch(() => [[]])
          if (existing.length > 0) continue  // ข้ามถ้าเคยประมวลผลแล้ว
        }
        await handleEvent(event)
      } catch (err) {
        console.error('[Webhook] Event error:', err.message)
      }
    }

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
  const messageId = event.message.id

  // โหลด session
  let session = await getOrCreateSession(userId)

  // บันทึก message ที่รับมา (พร้อม messageId สำหรับ idempotency)
  await saveMessage(userId, 'in', text, 'user', messageId)
  // แจ้ง notification badge ถ้า handoff หรือ human_first
  if (session.state === 'handoff' || session.state === 'human_first') {
    db.query("INSERT INTO notifications (type, ref_id) VALUES ('new_line_message', 0)").catch(() => {})
  }

  // human_first: เจ้าหน้าที่รับก่อน — bot ไม่ตอบอัตโนมัติ
  if (session.state === 'human_first') {
    if (session.isNew) {
      await replyMessage(replyToken, [welcomeBubble()])
    } else {
      await replyMessage(replyToken, [
        textMsg('ขอบคุณที่ติดต่อมาครับ 🙏\nเจ้าหน้าที่กำลังจะดูแลคุณในไม่ช้า\n\nหากต้องการให้ระบบตอบอัตโนมัติ พิมพ์ "bot" ได้เลยครับ')
      ])
    }
    return
  }

  // ถ้า user อยู่ใน handoff mode → ไม่ตอบ (ให้ admin ตอบ)
  if (session.state === 'handoff') {
    await replyMessage(replyToken, [
      textMsg('ข้อความของคุณถูกส่งถึงเจ้าหน้าที่แล้วครับ กรุณารอสักครู่ 🙏')
    ])
    return
  }

  // คำสั่ง "bot" — สลับจาก human_first เป็น bot mode
  if (text.toLowerCase() === 'bot') {
    await db.query('UPDATE line_sessions SET state = "bot" WHERE line_user_id = ?', [userId])
    await replyMessage(replyToken, [
      textMsg('เปิดใช้งานระบบตอบอัตโนมัติแล้วครับ 🤖\nสอบถามข้อมูลประกันได้เลย!')
    ])
    return
  }

  // Knowledge Base — ตรวจก่อน intent detection
  const kbAnswer = await searchKnowledge(text)
  if (kbAnswer) {
    await replyMessage(replyToken, [textMsg(kbAnswer)])
    await saveMessage(userId, 'out', kbAnswer, 'bot')
    await resetAskCount(userId)
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

  // Fallback → AI + log unknown
  const context = await getConversationHistory(userId)
  const aiText = await getAIResponse(text, context)

  await replyMessage(replyToken, [textMsg(aiText)])
  await saveMessage(userId, 'out', aiText, 'ai')
  logUnknown(text)  // fire-and-forget

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
    return { ...rows[0], isNew: false }
  }

  // ดึงโปรไฟล์จาก LINE
  const profile = await getUserProfile(userId)
  await db.query(
    'INSERT INTO line_sessions (line_user_id, display_name, picture_url, state) VALUES (?, ?, ?, "human_first")',
    [userId, profile?.displayName || 'Unknown', profile?.pictureUrl || null]
  )
  const [newRows] = await db.query('SELECT * FROM line_sessions WHERE line_user_id = ?', [userId])
  return { ...newRows[0], isNew: true }
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

async function saveMessage(userId, direction, message, sentBy = 'bot', lineMessageId = null) {
  const sse = require('../services/sse')
  await db.query(
    'INSERT INTO line_messages (line_user_id, direction, message, sent_by, line_message_id) VALUES (?, ?, ?, ?, ?)',
    [userId, direction, message, sentBy, lineMessageId]
  ).catch(() => {})
  sse.broadcast(userId, { type: 'message', direction, message, sent_by: sentBy, created_at: new Date() })
}

async function searchKnowledge(text) {
  const [entries] = await db.query(
    'SELECT * FROM bot_knowledge WHERE is_active = 1'
  ).catch(() => [[]])
  const textLower = text.toLowerCase()
  for (const entry of entries) {
    const keywords = entry.keywords.split(',').map(k => k.trim().toLowerCase())
    if (keywords.some(k => k && textLower.includes(k))) {
      db.query('UPDATE bot_knowledge SET match_count = match_count+1 WHERE id=?', [entry.id]).catch(() => {})
      return entry.answer
    }
  }
  return null
}

async function logUnknown(message) {
  const msg = message.substring(0, 500)
  const [existing] = await db.query(
    'SELECT id FROM bot_unknowns WHERE message = ? AND status = "pending" LIMIT 1', [msg]
  ).catch(() => [[]])
  if (existing.length > 0) {
    db.query('UPDATE bot_unknowns SET frequency = frequency+1, last_seen_at = NOW() WHERE id=?', [existing[0].id]).catch(() => {})
  } else {
    db.query('INSERT INTO bot_unknowns (message) VALUES (?)', [msg]).catch(() => {})
  }
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

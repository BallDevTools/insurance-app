'use strict'

const https = require('https')
const crypto = require('crypto')

const LINE_REPLY_URL = 'https://api.line.me/v2/bot/message/reply'
const LINE_PUSH_URL  = 'https://api.line.me/v2/bot/message/push'
const LINE_PROFILE_URL = (userId) => `https://api.line.me/v2/bot/profile/${userId}`

// Credential cache — อ่านจาก app_settings DB ก่อน, fallback ไป .env
let _cred = { secret: '', token: '', ts: 0 }
const CRED_TTL = 5 * 60 * 1000

async function getCredentials() {
  if (Date.now() - _cred.ts < CRED_TTL && _cred.secret) return _cred
  const db = require('../db')
  const [rows] = await db.query(
    "SELECT `key`, `value` FROM app_settings WHERE `key` IN ('line_channel_secret','line_channel_access_token') AND affiliate_id = 0"
  ).catch(() => [[]])
  const map = {}
  rows.forEach(r => { map[r.key] = r.value })
  _cred = {
    secret: map.line_channel_secret || process.env.LINE_CHANNEL_SECRET || '',
    token:  map.line_channel_access_token || process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
    ts: Date.now()
  }
  return _cred
}

function invalidateCredCache() { _cred.ts = 0 }

// ตรวจ signature ของ LINE webhook
async function validateSignature(rawBody, signature) {
  const { secret } = await getCredentials()
  const hash = crypto.createHmac('SHA256', secret).update(rawBody).digest('base64')
  return hash === signature
}

// ส่ง HTTP request แบบ Promise
async function lineRequest(url, body) {
  const { token } = await getCredentials()
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const urlObj = new URL(url)
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Authorization': `Bearer ${token}`
      }
    }
    const req = https.request(options, (res) => {
      let result = ''
      res.on('data', (chunk) => result += chunk)
      res.on('end', () => resolve({ status: res.statusCode, body: result }))
    })
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

// ดึงโปรไฟล์ user จาก LINE
async function getUserProfile(userId) {
  const { token } = await getCredentials()
  return new Promise((resolve, reject) => {
    const urlObj = new URL(LINE_PROFILE_URL(userId))
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    }
    const req = https.request(options, (res) => {
      let result = ''
      res.on('data', (chunk) => result += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(result)) } catch { resolve(null) }
      })
    })
    req.on('error', () => resolve(null))
    req.end()
  })
}

// Reply message (ใช้ replyToken จาก webhook event)
async function replyMessage(replyToken, messages) {
  if (!Array.isArray(messages)) messages = [messages]
  return lineRequest(LINE_REPLY_URL, { replyToken, messages })
}

// Push message (ใช้ userId โดยตรง — สำหรับ admin ส่งหา user)
async function pushMessage(userId, messages) {
  if (!Array.isArray(messages)) messages = [messages]
  return lineRequest(LINE_PUSH_URL, { to: userId, messages })
}

// สร้าง text message object
function textMsg(text) {
  return { type: 'text', text }
}

// สร้าง Flex Message แบบ bubble สำหรับแสดงผลใบเสนอราคา (ปรับปรุง)
function quoteBubble(quote) {
  const typeMap = { class1: 'ชั้น 1', class2plus: 'ชั้น 2+', class3plus: 'ชั้น 3+' }
  const typeColor = { class1: '#1a56db', class2plus: '#7c3aed', class3plus: '#059669' }
  const color = typeColor[quote.insurance_type] || '#1a56db'
  const APP = process.env.APP_URL || 'http://localhost:3000'
  const netPremium = Math.round(quote.premium_amount / 1.07 / 1.004)
  const stampDuty  = Math.round(netPremium * 0.004)
  const vat        = Math.round((netPremium + stampDuty) * 0.07)

  return {
    type: 'flex',
    altText: `ใบเสนอราคา ${quote.quote_number} — ฿${Number(quote.premium_amount).toLocaleString('th-TH')}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: color,
        paddingAll: '16px',
        contents: [
          { type: 'text', text: '🛡️ ใบเสนอราคาประกันภัย', color: '#ffffff', size: 'sm', opacity: 0.8 },
          { type: 'text', text: quote.quote_number, color: '#ffffff', size: 'lg', weight: 'bold' },
          { type: 'text', text: typeMap[quote.insurance_type] || quote.insurance_type, color: '#ffffff', size: 'sm', margin: 'sm' }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '16px',
        contents: [
          {
            type: 'box', layout: 'horizontal', margin: 'none',
            contents: [
              { type: 'text', text: 'รถยนต์', color: '#9ca3af', size: 'xs', flex: 2 },
              { type: 'text', text: `${quote.car_brand} ${quote.car_model} ${quote.car_year}`, size: 'xs', flex: 5, weight: 'bold', wrap: true }
            ]
          },
          {
            type: 'box', layout: 'horizontal',
            contents: [
              { type: 'text', text: 'ทะเบียน', color: '#9ca3af', size: 'xs', flex: 2 },
              { type: 'text', text: quote.license_plate, size: 'xs', flex: 5, weight: 'bold' }
            ]
          },
          {
            type: 'box', layout: 'horizontal',
            contents: [
              { type: 'text', text: 'จังหวัด', color: '#9ca3af', size: 'xs', flex: 2 },
              { type: 'text', text: quote.province, size: 'xs', flex: 5 }
            ]
          },
          { type: 'separator', margin: 'md' },
          {
            type: 'box', layout: 'horizontal', margin: 'md',
            contents: [
              { type: 'text', text: 'เบี้ยสุทธิ', color: '#6b7280', size: 'xs', flex: 3 },
              { type: 'text', text: `฿${Number(netPremium).toLocaleString('th-TH')}`, size: 'xs', flex: 3, align: 'end' }
            ]
          },
          {
            type: 'box', layout: 'horizontal',
            contents: [
              { type: 'text', text: 'อากรแสตมป์ + VAT', color: '#6b7280', size: 'xs', flex: 3 },
              { type: 'text', text: `฿${Number(stampDuty + vat).toLocaleString('th-TH')}`, size: 'xs', flex: 3, align: 'end' }
            ]
          },
          {
            type: 'box', layout: 'horizontal', margin: 'sm',
            backgroundColor: '#eff6ff', paddingAll: '10px', cornerRadius: '8px',
            contents: [
              { type: 'text', text: '💰 รวมทั้งสิ้น', size: 'sm', weight: 'bold', flex: 3, color: color },
              { type: 'text', text: `฿${Number(quote.premium_amount).toLocaleString('th-TH')}`, size: 'lg', weight: 'bold', flex: 3, align: 'end', color: color }
            ]
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '12px',
        contents: [
          {
            type: 'button',
            action: { type: 'uri', label: '📋 ดูใบเสนอราคา', uri: `${APP}/result/${quote.quote_number}` },
            style: 'primary', color, height: 'sm'
          },
          {
            type: 'button',
            action: { type: 'uri', label: '⬇ ดาวน์โหลด PDF', uri: `${APP}/result/${quote.quote_number}/pdf` },
            style: 'secondary', height: 'sm'
          }
        ]
      }
    }
  }
}

// Flex: แจ้ง admin เมื่อมี lead ใหม่ (Clean White Card)
function newLeadBubble(lead) {
  const TYPE_MAP   = { class1: 'ชั้น 1', class2plus: 'ชั้น 2+', class3plus: 'ชั้น 3+', compulsory: 'พรบ.' }
  const SOURCE_MAP = { organic: 'Organic', line_ads: 'LINE Ads', facebook_ads: 'Facebook Ads', google: 'Google', other: 'อื่นๆ' }
  const SOURCE_COLOR = { organic: '#4f46e5', line_ads: '#16a34a', facebook_ads: '#2563eb', google: '#dc2626', other: '#6b7280' }
  const color = SOURCE_COLOR[lead.source] || '#4f46e5'
  const APP = process.env.APP_URL || 'http://localhost:3000'
  const now = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'short', timeStyle: 'short' })

  const contactContents = []
  if (lead.name && lead.phone) {
    contactContents.push({ type: 'text', text: `👤 ${lead.name}`, size: 'sm', color: '#334155', flex: 1 })
    contactContents.push({ type: 'text', text: `📞 ${lead.phone}`, size: 'sm', color: '#334155', flex: 1, align: 'end' })
  } else if (lead.name) {
    contactContents.push({ type: 'text', text: `👤 ${lead.name}`, size: 'sm', color: '#334155' })
  } else if (lead.phone) {
    contactContents.push({ type: 'text', text: `📞 ${lead.phone}`, size: 'sm', color: '#334155' })
  }

  const mainContents = [
    // Header row: 🔔 Lead ใหม่! + badge pill
    {
      type: 'box', layout: 'horizontal', contents: [
        {
          type: 'box', layout: 'vertical', flex: 1, contents: [
            { type: 'text', text: '🔔 Lead ใหม่!', size: 'sm', weight: 'bold', color: '#0f172a' },
            { type: 'text', text: now, size: 'xs', color: '#94a3b8', margin: 'xs' }
          ]
        },
        {
          type: 'box', layout: 'vertical', flex: 0, justifyContent: 'center', contents: [{
            type: 'box', layout: 'vertical', backgroundColor: color, cornerRadius: '20px',
            paddingStart: '10px', paddingEnd: '10px', paddingTop: '4px', paddingBottom: '4px',
            contents: [{ type: 'text', text: SOURCE_MAP[lead.source] || lead.source, size: 'xxs', color: '#ffffff', align: 'center' }]
          }]
        }
      ]
    },
    { type: 'separator', margin: 'md', color: '#e2e8f0' },
    // ชื่อรถ + ปี
    {
      type: 'box', layout: 'horizontal', margin: 'md', contents: [
        { type: 'text', text: `${lead.brand} ${lead.model}`, size: 'md', weight: 'bold', color: '#0f172a', flex: 1, wrap: true },
        { type: 'text', text: `ปี ${lead.year}`, size: 'sm', color: '#64748b', flex: 0, align: 'end', gravity: 'bottom' }
      ]
    },
    // Info grid: ประกัน + จังหวัด
    {
      type: 'box', layout: 'vertical', margin: 'sm', spacing: 'xs', contents: [
        {
          type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'ประกัน', size: 'xs', color: '#94a3b8', flex: 3 },
            { type: 'text', text: TYPE_MAP[lead.insurance_type] || lead.insurance_type, size: 'xs', color: '#334155', flex: 5, weight: 'bold' }
          ]
        },
        {
          type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'จังหวัด', size: 'xs', color: '#94a3b8', flex: 3 },
            { type: 'text', text: lead.province, size: 'xs', color: '#334155', flex: 5 }
          ]
        }
      ]
    }
  ]

  // Price highlight box
  if (lead.best_price) {
    mainContents.push({
      type: 'box', layout: 'horizontal', margin: 'md',
      backgroundColor: '#f8fafc', cornerRadius: '8px', paddingAll: '12px',
      borderWidth: '1px', borderColor: '#e2e8f0',
      contents: [
        { type: 'text', text: 'ราคาเริ่มต้น', size: 'xs', color: '#64748b', flex: 3, gravity: 'center' },
        { type: 'text', text: `฿${Number(lead.best_price).toLocaleString('th-TH')}`, size: 'xl', weight: 'bold', color, flex: 4, align: 'end' }
      ]
    })
  }

  // Contact row
  if (contactContents.length > 0) {
    mainContents.push({ type: 'separator', margin: 'md', color: '#e2e8f0' })
    mainContents.push({ type: 'box', layout: 'horizontal', margin: 'md', contents: contactContents })
  }

  return {
    type: 'flex',
    altText: `🔔 Lead ใหม่! ${lead.brand} ${lead.model} ปี ${lead.year} • ${TYPE_MAP[lead.insurance_type] || lead.insurance_type}`,
    contents: {
      type: 'bubble', size: 'mega',
      body: {
        type: 'box', layout: 'vertical', paddingAll: '0px',
        contents: [
          // Accent bar
          { type: 'box', layout: 'vertical', height: '6px', backgroundColor: color, contents: [] },
          // Main content
          { type: 'box', layout: 'vertical', paddingAll: '16px', paddingTop: '14px', contents: mainContents }
        ]
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '12px', paddingTop: '4px',
        contents: [{
          type: 'button',
          action: { type: 'uri', label: '📋 ดู Lead ใน Admin', uri: `${APP}/admin/leads` },
          style: 'primary', color, height: 'sm'
        }]
      }
    }
  }

}

// Flex: welcome card สำหรับ user ที่ทัก LINE ครั้งแรก
function welcomeBubble() {
  const APP = process.env.APP_URL || 'http://localhost:3000'
  return {
    type: 'flex',
    altText: 'ยินดีต้อนรับสู่บริการประกันรถยนต์ออนไลน์ 🛡️',
    contents: {
      type: 'bubble', size: 'mega',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: '#1a56db', paddingAll: '16px',
        contents: [
          { type: 'text', text: '🛡️ ประกันรถยนต์ออนไลน์', color: '#b3c6ff', size: 'sm' },
          { type: 'text', text: 'ยินดีต้อนรับครับ! 👋', color: '#ffffff', size: 'lg', weight: 'bold', margin: 'xs' }
        ]
      },
      body: {
        type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'sm',
        contents: [
          { type: 'text', text: 'เราช่วยเรื่องประกันรถได้ครบจบในที่เดียว', size: 'sm', color: '#374151', wrap: true },
          { type: 'separator', margin: 'md' },
          {
            type: 'box', layout: 'vertical', margin: 'md', spacing: 'xs',
            contents: [
              { type: 'text', text: '📌 บริการของเรา', size: 'xs', weight: 'bold', color: '#6b7280' },
              { type: 'text', text: '• เช็คราคาประกันใน 30 วินาที', size: 'sm', color: '#374151' },
              { type: 'text', text: '• เปรียบเทียบ 12+ บริษัทประกัน', size: 'sm', color: '#374151' },
              { type: 'text', text: '• ใบเสนอราคาภายใน 5 นาที', size: 'sm', color: '#374151' }
            ]
          }
        ]
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '12px', spacing: 'sm',
        contents: [
          {
            type: 'button',
            action: { type: 'uri', label: '🔍 เช็คราคาเลย', uri: APP },
            style: 'primary', color: '#1a56db', height: 'sm'
          },
          {
            type: 'button',
            action: { type: 'message', label: '💬 คุยกับเจ้าหน้าที่', text: 'ติดต่อเจ้าหน้าที่' },
            style: 'secondary', height: 'sm'
          }
        ]
      }
    }
  }
}

// แจ้งเตือนเจ้าหน้าที่เมื่อมี lead ใหม่
// adminUserId มาจาก app_settings(line_admin_user_id) per-affiliate, fallback ไป env var
async function notifyAdminNewLead(lead, adminUserId) {
  const id = adminUserId || process.env.LINE_ADMIN_USER_ID
  if (!id) return
  return pushMessage(id, [newLeadBubble(lead)]).catch(() => {})
}

module.exports = { validateSignature, replyMessage, pushMessage, getUserProfile, textMsg, quoteBubble, newLeadBubble, welcomeBubble, notifyAdminNewLead, invalidateCredCache }

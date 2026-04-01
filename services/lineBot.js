'use strict'

const https = require('https')
const crypto = require('crypto')

const LINE_REPLY_URL = 'https://api.line.me/v2/bot/message/reply'
const LINE_PUSH_URL  = 'https://api.line.me/v2/bot/message/push'
const LINE_PROFILE_URL = (userId) => `https://api.line.me/v2/bot/profile/${userId}`

function getToken() {
  return process.env.LINE_CHANNEL_ACCESS_TOKEN || ''
}

// ตรวจ signature ของ LINE webhook
function validateSignature(rawBody, signature) {
  const secret = process.env.LINE_CHANNEL_SECRET || ''
  const hash = crypto.createHmac('SHA256', secret).update(rawBody).digest('base64')
  return hash === signature
}

// ส่ง HTTP request แบบ Promise
function lineRequest(url, body) {
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
        'Authorization': `Bearer ${getToken()}`
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
function getUserProfile(userId) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(LINE_PROFILE_URL(userId))
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${getToken()}` }
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

// แจ้งเตือนเจ้าหน้าที่เมื่อมี lead ใหม่
async function notifyAdminNewLead(lead) {
  const adminId = process.env.LINE_ADMIN_USER_ID
  if (!adminId) return
  const typeMap = { class1: 'ชั้น 1', class2plus: 'ชั้น 2+', class3plus: 'ชั้น 3+' }
  const sourceMap = { organic: 'Organic', line_ads: 'LINE Ads', facebook_ads: 'Facebook Ads', google: 'Google', other: 'อื่นๆ' }
  const lines = [
    '🔔 มี Lead ใหม่เข้ามาแล้ว!',
    `🚗 ${lead.brand} ${lead.model} ปี ${lead.year}`,
    `🛡️ ประกัน${typeMap[lead.insurance_type] || lead.insurance_type}`,
    `📍 ${lead.province}`,
  ]
  if (lead.name)  lines.push(`👤 ${lead.name}`)
  if (lead.phone) lines.push(`📞 ${lead.phone}`)
  lines.push(`📌 แหล่ง: ${sourceMap[lead.source] || lead.source}`)
  lines.push('\nดู Leads ทั้งหมดที่ Admin Dashboard')
  return pushMessage(adminId, [textMsg(lines.join('\n'))]).catch(() => {})
}

module.exports = { validateSignature, replyMessage, pushMessage, getUserProfile, textMsg, quoteBubble, notifyAdminNewLead }

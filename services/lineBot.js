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

// สร้าง Flex Message แบบ bubble สำหรับแสดงผลใบเสนอราคา
function quoteBubble(quote) {
  const typeMap = { class1: 'ชั้น 1', class2plus: 'ชั้น 2+', class3plus: 'ชั้น 3+' }
  return {
    type: 'flex',
    altText: `ใบเสนอราคา ${quote.quote_number}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#1a73e8',
        contents: [{
          type: 'text',
          text: `📋 ${quote.quote_number}`,
          color: '#ffffff',
          size: 'md',
          weight: 'bold'
        }]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          { type: 'text', text: `🚗 ${quote.car_brand} ${quote.car_model} ปี ${quote.car_year}`, wrap: true, size: 'sm' },
          { type: 'text', text: `🛡️ ประกัน${typeMap[quote.insurance_type] || quote.insurance_type}`, size: 'sm' },
          { type: 'text', text: `📍 ${quote.province}`, size: 'sm' },
          { type: 'separator' },
          {
            type: 'text',
            text: `💰 ${Number(quote.premium_amount).toLocaleString('th-TH')} บาท`,
            size: 'lg',
            weight: 'bold',
            color: '#1a73e8'
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [{
          type: 'button',
          action: {
            type: 'uri',
            label: 'ดูรายละเอียด',
            uri: `${process.env.APP_URL || 'http://localhost:3000'}/result/${quote.quote_number}`
          },
          style: 'primary',
          color: '#1a73e8'
        }]
      }
    }
  }
}

module.exports = { validateSignature, replyMessage, pushMessage, getUserProfile, textMsg, quoteBubble }

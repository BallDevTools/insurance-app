'use strict'
/**
 * setup_line_richmenu.js
 * สร้าง LINE Rich Menu สำหรับ bot
 *
 * ใช้งาน: node setup_line_richmenu.js
 * (ต้องมี LINE_CHANNEL_ACCESS_TOKEN ใน .env)
 */

require('dotenv').config()
const https = require('https')

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN
if (!TOKEN) {
  console.error('❌ ไม่พบ LINE_CHANNEL_ACCESS_TOKEN ใน .env')
  process.exit(1)
}

const APP_URL = process.env.APP_URL || 'http://localhost:3000'

function lineAPI(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null
    const options = {
      hostname: 'api.line.me',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }
    const req = https.request(options, res => {
      let result = ''
      res.on('data', c => result += c)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(result) }) }
        catch { resolve({ status: res.statusCode, body: result }) }
      })
    })
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

async function createRichMenu() {
  const richMenu = {
    size: { width: 2500, height: 843 },
    selected: true,
    name: 'Insurance Bot Menu',
    chatBarText: 'เมนู 🛡️',
    areas: [
      {
        bounds: { x: 0, y: 0, width: 833, height: 843 },
        action: {
          type: 'message',
          label: 'คำนวณเบี้ยประกัน',
          text: 'ต้องการคำนวณเบี้ยประกัน'
        }
      },
      {
        bounds: { x: 833, y: 0, width: 834, height: 843 },
        action: {
          type: 'uri',
          label: 'ดูใบเสนอราคา',
          uri: APP_URL + '/compare'
        }
      },
      {
        bounds: { x: 1667, y: 0, width: 833, height: 843 },
        action: {
          type: 'message',
          label: 'ติดต่อเจ้าหน้าที่',
          text: 'ต้องการติดต่อเจ้าหน้าที่'
        }
      }
    ]
  }

  console.log('📋 กำลังสร้าง Rich Menu...')
  const res = await lineAPI('POST', '/v2/bot/richmenu', richMenu)
  if (res.status !== 200) {
    console.error('❌ สร้าง Rich Menu ไม่สำเร็จ:', res.body)
    return null
  }
  const richMenuId = res.body.richMenuId
  console.log('✅ Rich Menu ID:', richMenuId)
  return richMenuId
}

async function setDefaultRichMenu(richMenuId) {
  console.log('🔗 ตั้งเป็น default rich menu...')
  const res = await lineAPI('POST', `/v2/bot/user/all/richmenu/${richMenuId}`)
  if (res.status === 200) {
    console.log('✅ ตั้ง default Rich Menu สำเร็จ')
  } else {
    console.error('❌ ตั้ง default ไม่สำเร็จ:', res.body)
  }
}

async function listRichMenus() {
  const res = await lineAPI('GET', '/v2/bot/richmenu/list')
  return res.body?.richmenus || []
}

async function main() {
  console.log('🚀 LINE Rich Menu Setup\n')

  // ลบ rich menu เก่าก่อน (ถ้ามี)
  const existing = await listRichMenus()
  for (const rm of existing) {
    console.log(`🗑️  ลบ rich menu เก่า: ${rm.richMenuId}`)
    await lineAPI('DELETE', `/v2/bot/richmenu/${rm.richMenuId}`)
  }

  const richMenuId = await createRichMenu()
  if (!richMenuId) return

  console.log('\n⚠️  หมายเหตุ: Rich Menu ต้องอัปโหลดรูปภาพก่อนจึงจะแสดงใน LINE')
  console.log('   อัปโหลดรูปด้วย:')
  console.log(`   curl -X POST https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content \\`)
  console.log(`     -H "Authorization: Bearer ${TOKEN}" \\`)
  console.log(`     -H "Content-Type: image/png" \\`)
  console.log(`     --data-binary @richmenu.png`)
  console.log('\n   แล้วรัน:')
  console.log(`   node setup_line_richmenu.js set-default ${richMenuId}`)

  // ถ้าส่ง argument set-default
  if (process.argv[2] === 'set-default' && process.argv[3]) {
    await setDefaultRichMenu(process.argv[3])
  } else {
    // ลอง set default ทันทีเลย (ไม่มีรูปก็ได้ — user จะเห็นเมนูแต่ไม่มีรูป)
    await setDefaultRichMenu(richMenuId)
  }
}

main().catch(console.error)

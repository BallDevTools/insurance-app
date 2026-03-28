'use strict'

require('dotenv').config()

const path = require('path')
const fastify = require('fastify')({ logger: false })
const db = require('./db')
const { INSURANCE_TYPES, calculatePremium, generateQuoteNumber } = require('./calculator')

const PUB_LAYOUT = 'layout.ejs'

// =============================================
// Register Plugins
// =============================================
fastify.register(require('@fastify/formbody'))
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'public'),
  prefix: '/public/'
})
// ไม่ set global layout — ระบุ per-render แทน เพื่อให้ admin ใช้ layout ของตัวเอง
fastify.register(require('@fastify/view'), {
  engine: { ejs: require('ejs') },
  root: path.join(__dirname, 'views'),
  defaultContext: {
    siteName: 'ประกันรถยนต์ออนไลน์',
    year: new Date().getFullYear()
  }
})
fastify.register(require('@fastify/cookie'))
fastify.register(require('@fastify/session'), {
  secret: 'insurance-admin-secret-key-2026-minimum32ch',
  cookie: { secure: false, httpOnly: true, maxAge: 60 * 60 * 8 * 1000 } // 8 ชม.
})

// =============================================
// Helpers
// =============================================
function formatNumber(n) {
  return Number(n).toLocaleString('th-TH', { minimumFractionDigits: 0 })
}

// =============================================
// Admin Routes Plugin
// =============================================
fastify.register(require('./routes/admin'), { prefix: '/admin' })

// =============================================
// LINE Webhook Plugin
// =============================================
fastify.register(require('./routes/webhook'))

// =============================================
// GET / — หน้าแรก: กรอกข้อมูลรถ
// =============================================
fastify.get('/', async (req, reply) => {
  const [brands] = await db.query('SELECT id, name FROM car_brands ORDER BY name')
  const [provinces] = await db.query('SELECT name, risk_factor FROM provinces ORDER BY name')
  const currentYear = new Date().getFullYear()
  const years = []
  for (let y = currentYear; y >= currentYear - 20; y--) years.push(y)

  return reply.view('index.ejs', {
    title: 'คำนวณเบี้ยประกันรถยนต์',
    brands, provinces, years, errors: {}, old: {}
  }, { layout: PUB_LAYOUT })
})

// =============================================
// GET /api/models?brand_id=X — โหลดรุ่นรถ (AJAX)
// =============================================
fastify.get('/api/models', async (req, reply) => {
  const brandId = parseInt(req.query.brand_id)
  if (!brandId) return reply.send([])
  const [rows] = await db.query(
    'SELECT id, name, base_value FROM car_models WHERE brand_id = ? ORDER BY name',
    [brandId]
  )
  return reply.send(rows)
})

// =============================================
// POST /quote — คำนวณเบี้ยประกัน
// =============================================
fastify.post('/quote', async (req, reply) => {
  const body = req.body || {}
  const { car_brand, car_model, car_model_id, car_year, license_plate, province, insurance_type } = body

  const errors = {}
  if (!car_brand) errors.car_brand = 'กรุณาเลือกยี่ห้อรถ'
  if (!car_model) errors.car_model = 'กรุณาเลือกรุ่นรถ'
  if (!car_year) errors.car_year = 'กรุณาเลือกปีผลิต'
  if (!license_plate || license_plate.trim().length < 3) errors.license_plate = 'กรุณากรอกทะเบียนรถ'
  if (!province) errors.province = 'กรุณาเลือกจังหวัด'
  if (!insurance_type || !INSURANCE_TYPES[insurance_type]) errors.insurance_type = 'กรุณาเลือกประเภทประกัน'

  if (Object.keys(errors).length > 0) {
    const [brands] = await db.query('SELECT id, name FROM car_brands ORDER BY name')
    const [provinces] = await db.query('SELECT name, risk_factor FROM provinces ORDER BY name')
    const currentYear = new Date().getFullYear()
    const years = []
    for (let y = currentYear; y >= currentYear - 20; y--) years.push(y)
    return reply.view('index.ejs', {
      title: 'คำนวณเบี้ยประกันรถยนต์',
      brands, provinces, years, errors, old: body
    }, { layout: PUB_LAYOUT })
  }

  let carValue = 800000
  if (car_model_id) {
    const [modelRows] = await db.query('SELECT base_value FROM car_models WHERE id = ?', [car_model_id])
    if (modelRows.length > 0) carValue = parseFloat(modelRows[0].base_value)
  }

  let provinceFactor = 1.0
  const [provRows] = await db.query('SELECT risk_factor FROM provinces WHERE name = ?', [province])
  if (provRows.length > 0) provinceFactor = parseFloat(provRows[0].risk_factor)

  // โหลด rates จาก DB settings (ถ้ามี)
  const [settingRows] = await db.query('SELECT `key`, `value` FROM app_settings').catch(() => [[]])
  const settings = {}
  settingRows.forEach(r => { settings[r.key] = parseFloat(r.value) })

  const result = calculatePremium({
    carValue, insuranceType: insurance_type,
    year: parseInt(car_year), provinceFactor, settings
  })

  const quoteNumber = generateQuoteNumber()

  await db.query(
    `INSERT INTO quotes
      (quote_number, car_brand, car_model, car_year, license_plate, province,
       insurance_type, car_value, premium_amount, coverage_details)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [quoteNumber, car_brand, car_model, car_year,
     license_plate.trim().toUpperCase(), province, insurance_type,
     result.effectiveCarValue, result.totalPremium,
     JSON.stringify(result.config.coverageDetails)]
  )

  return reply.redirect(`/result/${quoteNumber}`)
})

// =============================================
// GET /result/:quoteNumber — หน้าผลลัพธ์
// =============================================
fastify.get('/result/:quoteNumber', async (req, reply) => {
  const { quoteNumber } = req.params
  const [rows] = await db.query('SELECT * FROM quotes WHERE quote_number = ?', [quoteNumber])
  if (rows.length === 0) return reply.redirect('/')

  const quote = rows[0]
  const insuranceConfig = INSURANCE_TYPES[quote.insurance_type]
  const netPremium = Math.round(quote.premium_amount / 1.07 / 1.004)
  const stampDuty = Math.round(netPremium * 0.004)
  const vat = Math.round((netPremium + stampDuty) * 0.07)
  const [leadRows] = await db.query('SELECT id FROM customer_leads WHERE quote_id = ?', [quote.id])

  return reply.view('result.ejs', {
    title: `ใบเสนอราคา ${quoteNumber}`,
    quote, insuranceConfig, netPremium, stampDuty, vat, formatNumber,
    alreadyContacted: leadRows.length > 0, errors: {}, old: {}
  }, { layout: PUB_LAYOUT })
})

// =============================================
// POST /contact — บันทึกข้อมูลติดต่อ
// =============================================
fastify.post('/contact', async (req, reply) => {
  const body = req.body || {}
  const { quote_id, quote_number, full_name, phone, email, preferred_contact, notes } = body

  const errors = {}
  if (!full_name || full_name.trim().length < 2) errors.full_name = 'กรุณากรอกชื่อ-นามสกุล'
  if (!phone || !/^0[0-9]{8,9}$/.test(phone.replace(/[\s-]/g, ''))) errors.phone = 'กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง'
  if (email && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'รูปแบบอีเมลไม่ถูกต้อง'

  if (Object.keys(errors).length > 0) {
    const [rows] = await db.query('SELECT * FROM quotes WHERE quote_number = ?', [quote_number])
    if (rows.length === 0) return reply.redirect('/')
    const quote = rows[0]
    const insuranceConfig = INSURANCE_TYPES[quote.insurance_type]
    const netPremium = Math.round(quote.premium_amount / 1.07 / 1.004)
    const stampDuty = Math.round(netPremium * 0.004)
    const vat = Math.round((netPremium + stampDuty) * 0.07)
    return reply.view('result.ejs', {
      title: `ใบเสนอราคา ${quote_number}`,
      quote, insuranceConfig, netPremium, stampDuty, vat, formatNumber,
      alreadyContacted: false, errors, old: body
    }, { layout: PUB_LAYOUT })
  }

  await db.query(
    `INSERT INTO customer_leads (quote_id, full_name, phone, email, preferred_contact, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [parseInt(quote_id), full_name.trim(), phone.replace(/[\s-]/g, ''),
     email ? email.trim() : null, preferred_contact || 'phone',
     notes ? notes.trim() : null]
  )
  await db.query("UPDATE quotes SET status = 'contacted' WHERE id = ?", [parseInt(quote_id)])
  return reply.redirect(`/success/${quote_number}`)
})

// =============================================
// GET /success/:quoteNumber — หน้าส่งข้อมูลสำเร็จ
// =============================================
fastify.get('/success/:quoteNumber', async (req, reply) => {
  const { quoteNumber } = req.params
  const [rows] = await db.query(
    `SELECT q.*, cl.full_name, cl.phone FROM quotes q
     LEFT JOIN customer_leads cl ON cl.quote_id = q.id
     WHERE q.quote_number = ?`,
    [quoteNumber]
  )
  if (rows.length === 0) return reply.redirect('/')
  return reply.view('success.ejs', {
    title: 'ส่งข้อมูลสำเร็จ',
    data: rows[0],
    insuranceConfig: INSURANCE_TYPES[rows[0].insurance_type]
  }, { layout: PUB_LAYOUT })
})

// =============================================
// Start Server
// =============================================
const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' })
    console.log('\x1b[36m%s\x1b[0m', '┌─────────────────────────────────────────┐')
    console.log('\x1b[36m%s\x1b[0m', '│   ระบบประกันรถยนต์ออนไลน์               │')
    console.log('\x1b[36m%s\x1b[0m', '│   http://localhost:3000                 │')
    console.log('\x1b[36m%s\x1b[0m', '│   Admin: http://localhost:3000/admin    │')
    console.log('\x1b[36m%s\x1b[0m', '└─────────────────────────────────────────┘')
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

start()

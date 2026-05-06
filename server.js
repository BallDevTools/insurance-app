'use strict'

require('dotenv').config()

if (process.env.SENTRY_DSN) {
  const Sentry = require('@sentry/node')
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'production',
    tracesSampleRate: 0.1
  })
  console.log('[Sentry] Error tracking เปิดใช้งานแล้ว')
}

const path    = require('path')
const crypto  = require('crypto')
const fastify = require('fastify')({ logger: true, trustProxy: true })
const db      = require('./db')
const { INSURANCE_TYPES } = require('./calculator')
const { sanitizeBody }    = require('./services/sanitize')
const { notifyAdminNewLead } = require('./services/lineBot')
const { startScraperScheduler } = require('./scraper/scheduler')

const PUB_LAYOUT = 'layout.ejs'
const CLASS_MAP  = { class1: '1', class2plus: '2+', class3plus: '3+' }

// =============================================
// Plugins
// =============================================
fastify.register(require('@fastify/rate-limit'), {
  global: true,
  max: 200,
  timeWindow: '1 minute',
  errorResponseBuilder: () => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: 'คุณส่งคำขอมากเกินไป กรุณารอสักครู่'
  })
})

fastify.register(require('@fastify/formbody'))
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'public'),
  prefix: '/public/'
})
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
  secret: process.env.SESSION_SECRET || 'insurance-admin-secret-key-2026-minimum32ch',
  cookie: { secure: false, httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 8 * 1000 }
})

// =============================================
// Helpers
// =============================================
function formatNumber(n) {
  return Number(n).toLocaleString('th-TH', { minimumFractionDigits: 0 })
}

function genCsrf(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex')
  }
  return req.session.csrfToken
}
function checkCsrf(req) {
  const token = req.body?._csrf
  return token && token === req.session.csrfToken
}

// =============================================
// Routes
// =============================================
fastify.register(require('./routes/admin'),   { prefix: '/admin' })
fastify.register(require('./routes/scraper'), { prefix: '/admin/scraper' })
fastify.register(require('./routes/webhook'))

// =============================================
// GET / — หน้าแรก + จับ UTM
// =============================================
fastify.get('/', async (req, reply) => {
  // จับ UTM params และเก็บใน session
  const { utm_source, utm_campaign, utm_medium, utm_content } = req.query
  if (utm_source || utm_campaign || utm_medium) {
    req.session.utm = {
      source:   utm_source   || 'organic',
      campaign: utm_campaign || null,
      medium:   utm_medium   || null,
      content:  utm_content  || null
    }
  }

  const [brands]    = await db.query('SELECT id, name FROM scraped_brands ORDER BY name')
  const [provinces] = await db.query('SELECT name, risk_factor FROM provinces ORDER BY name')
  const currentYear = new Date().getFullYear()
  const years = []
  for (let y = currentYear; y >= currentYear - 20; y--) years.push(y)
  const csrfToken = genCsrf(req)

  return reply.view('index.ejs', {
    title: 'คำนวณเบี้ยประกันรถยนต์',
    brands, provinces, years, errors: {}, old: {},
    utm: req.session.utm || {}, csrfToken
  }, { layout: PUB_LAYOUT })
})

// =============================================
// GET /api/models?brand_id=X — AJAX โหลดรุ่น
// =============================================
fastify.get('/api/models', async (req, reply) => {
  const brandId = parseInt(req.query.brand_id)
  if (!brandId) return reply.send([])
  const [rows] = await db.query(
    'SELECT id, name FROM scraped_models WHERE brand_id = ? ORDER BY name',
    [brandId]
  )
  return reply.send(rows)
})

// =============================================
// POST /quote — บันทึก lead + redirect ไป result
// =============================================
fastify.post('/quote', {
  config: { rateLimit: { max: 15, timeWindow: '1 minute' } }
}, async (req, reply) => {
  if (!checkCsrf(req)) {
    return reply.code(403).view('error.ejs',
      { title: 'CSRF Error', message: 'CSRF token ไม่ถูกต้อง กรุณาโหลดหน้าใหม่', code: 403 },
      { layout: PUB_LAYOUT })
  }

  const body = sanitizeBody(req.body || {})
  const {
    car_brand, car_model, car_model_id, car_year,
    license_plate, province, insurance_type,
    name, phone,
    utm_source, utm_campaign, utm_medium, utm_content
  } = body

  const currentYear = new Date().getFullYear()
  const yearInt = parseInt(car_year)
  const errors = {}
  if (!car_brand)  errors.car_brand = 'กรุณาเลือกยี่ห้อรถ'
  if (!car_model)  errors.car_model = 'กรุณาเลือกรุ่นรถ'
  if (!car_year || isNaN(yearInt) || yearInt < currentYear - 20 || yearInt > currentYear)
    errors.car_year = 'กรุณาเลือกปีผลิต'
  if (!license_plate || license_plate.trim().length < 2 || license_plate.trim().length > 20)
    errors.license_plate = 'กรุณากรอกทะเบียนรถ'
  if (!province) errors.province = 'กรุณาเลือกจังหวัด'
  if (!insurance_type || !INSURANCE_TYPES[insurance_type])
    errors.insurance_type = 'กรุณาเลือกประเภทประกัน'

  if (Object.keys(errors).length > 0) {
    const [brands]    = await db.query('SELECT id, name FROM scraped_brands ORDER BY name')
    const [provinces] = await db.query('SELECT name, risk_factor FROM provinces ORDER BY name')
    const years = []
    for (let y = currentYear; y >= currentYear - 20; y--) years.push(y)
    const csrfToken = genCsrf(req)
    return reply.view('index.ejs', {
      title: 'คำนวณเบี้ยประกันรถยนต์',
      brands, provinces, years, errors, old: body,
      utm: req.session.utm || {}, csrfToken
    }, { layout: PUB_LAYOUT })
  }

  // ดึงชื่อจริงจาก scraped_models
  const modelId  = parseInt(car_model_id)
  let brandName  = car_brand
  let modelName  = car_model

  if (modelId > 0) {
    const [modelRows] = await db.query(
      `SELECT sm.name AS model_name, sb.name AS brand_name
       FROM scraped_models sm JOIN scraped_brands sb ON sb.id = sm.brand_id
       WHERE sm.id = ?`,
      [modelId]
    )
    if (modelRows.length > 0) {
      brandName = modelRows[0].brand_name
      modelName = modelRows[0].model_name
    }
  }

  // ดึงราคาจาก scraped_packages
  const scraperClass = CLASS_MAP[insurance_type]
  const [packages] = await db.query(
    `SELECT company_name, insurance_class, premium_amount, premium_discounted
     FROM scraped_packages
     WHERE model_id = ? AND car_year = ? AND insurance_class = ?
     ORDER BY COALESCE(premium_discounted, premium_amount) ASC`,
    [modelId, yearInt, scraperClass]
  )

  const bestPrice = packages.length > 0
    ? parseFloat(packages[0].premium_discounted || packages[0].premium_amount)
    : null

  // UTM — รับจาก form (hidden fields) หรือจาก session
  const utm = req.session.utm || {}
  const source   = utm_source   || utm.source   || 'organic'
  const campaign = utm_campaign || utm.campaign  || null
  const medium   = utm_medium   || utm.medium    || null
  const content  = utm_content  || utm.content   || null

  // validate phone/name (optional)
  let cleanPhone = null
  if (phone && phone.trim()) {
    const ph = phone.trim().replace(/[\s-]/g, '')
    if (/^0[0-9]{8,9}$/.test(ph)) cleanPhone = ph
  }
  const cleanName = (name && name.trim().length >= 2)
    ? name.trim().substring(0, 200) : null

  // สร้าง token (32-char hex)
  const token = crypto.randomBytes(16).toString('hex')

  // บันทึก lead
  await db.query(
    `INSERT INTO leads
      (token, source, utm_campaign, utm_medium, utm_content,
       brand, model, model_id, year, license_plate, province,
       insurance_type, name, phone, best_price, packages_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [token, source, campaign, medium, content,
     brandName, modelName, modelId > 0 ? modelId : null, yearInt,
     license_plate.trim().toUpperCase(), province,
     insurance_type, cleanName, cleanPhone, bestPrice, JSON.stringify(packages)]
  )

  // Notification badge + LINE notify
  const [[newLead]] = await db.query('SELECT id FROM leads WHERE token = ?', [token])
  db.query("INSERT INTO notifications (type, ref_id) VALUES ('new_lead', ?)", [newLead?.id || 0]).catch(() => {})
  notifyAdminNewLead({
    brand: brandName, model: modelName, year: yearInt,
    insurance_type, province, name: cleanName, phone: cleanPhone, source
  }).catch(() => {})

  return reply.redirect(`/result/${token}`)
})

// =============================================
// GET /result/:token — หน้าแสดงราคา + CTA
// =============================================
fastify.get('/result/:token', async (req, reply) => {
  const { token } = req.params
  if (!/^[0-9a-f]{32}$/.test(token)) return reply.redirect('/')

  const [rows] = await db.query('SELECT * FROM leads WHERE token = ?', [token])
  if (rows.length === 0) return reply.redirect('/')

  const lead = rows[0]
  const insuranceConfig = INSURANCE_TYPES[lead.insurance_type]

  let packages = []
  try {
    const parsed = JSON.parse(lead.packages_json || '[]')
    if (Array.isArray(parsed)) packages = parsed
  } catch {}

  // CTA URLs จาก settings
  const [settingRows] = await db.query(
    "SELECT `key`, `value` FROM app_settings WHERE `key` IN ('line_oa_url','facebook_url')"
  ).catch(() => [[]])
  const settings = {}
  settingRows.forEach(r => { settings[r.key] = r.value })

  return reply.view('result.ejs', {
    title: 'ราคาประกันรถยนต์ของคุณ',
    lead, insuranceConfig, packages, formatNumber,
    lineOaUrl:   settings.line_oa_url   || '#',
    facebookUrl: settings.facebook_url  || '#'
  }, { layout: PUB_LAYOUT })
})

// =============================================
// GET /click/line?token=... — track + redirect
// =============================================
fastify.get('/click/line', async (req, reply) => {
  const { token } = req.query
  if (token && /^[0-9a-f]{32}$/.test(token)) {
    await db.query(
      "UPDATE leads SET clicked_line=1, status=IF(status='new','contacted',status), updated_at=NOW() WHERE token=?",
      [token]
    ).catch(() => {})
  }
  const [[row]] = await db.query(
    "SELECT value FROM app_settings WHERE `key`='line_oa_url'"
  ).catch(() => [[null]])
  return reply.redirect(row?.value || '/')
})

// =============================================
// GET /click/facebook?token=... — track + redirect
// =============================================
fastify.get('/click/facebook', async (req, reply) => {
  const { token } = req.query
  if (token && /^[0-9a-f]{32}$/.test(token)) {
    await db.query(
      "UPDATE leads SET clicked_facebook=1, status=IF(status='new','contacted',status), updated_at=NOW() WHERE token=?",
      [token]
    ).catch(() => {})
  }
  const [[row]] = await db.query(
    "SELECT value FROM app_settings WHERE `key`='facebook_url'"
  ).catch(() => [[null]])
  return reply.redirect(row?.value || '/')
})

// =============================================
// GET /compare — เปรียบเทียบราคา (คงไว้)
// =============================================
fastify.get('/compare', async (req, reply) => {
  const { brand_id, model_id, year, province } = req.query
  const [brands]    = await db.query('SELECT id, name FROM scraped_brands ORDER BY name')
  const [provinces] = await db.query('SELECT name FROM provinces ORDER BY name')
  const currentYear = new Date().getFullYear()
  const years = []
  for (let y = currentYear; y >= currentYear - 20; y--) years.push(y)

  let models = []
  if (brand_id) {
    const [modelRows] = await db.query(
      'SELECT id, name FROM scraped_models WHERE brand_id = ? ORDER BY name',
      [parseInt(brand_id)]
    )
    models = modelRows
  }

  let comparisons = null
  let selectedModel = null
  if (model_id && year) {
    const modelIdInt = parseInt(model_id)
    const yearInt    = parseInt(year)
    const [modelInfo] = await db.query(
      `SELECT sm.id, sm.name AS model_name, sb.name AS brand_name
       FROM scraped_models sm JOIN scraped_brands sb ON sb.id = sm.brand_id
       WHERE sm.id = ?`,
      [modelIdInt]
    )
    if (modelInfo.length > 0) {
      selectedModel = modelInfo[0]
      const [allPackages] = await db.query(
        `SELECT company_name, insurance_class, premium_amount, premium_discounted
         FROM scraped_packages
         WHERE model_id = ? AND car_year = ?
         ORDER BY insurance_class, COALESCE(premium_discounted, premium_amount) ASC`,
        [modelIdInt, yearInt]
      )
      const reverseMap = { '1': 'class1', '2+': 'class2plus', '3+': 'class3plus' }
      comparisons = { class1: [], class2plus: [], class3plus: [] }
      allPackages.forEach(pkg => {
        const key = reverseMap[pkg.insurance_class]
        if (key) comparisons[key].push(pkg)
      })
    }
  }

  const csrfToken = genCsrf(req)
  return reply.view('compare.ejs', {
    title: 'เปรียบเทียบประกันรถยนต์',
    brands, models, provinces, years,
    comparisons, selectedModel,
    selected: { brand_id, model_id, year, province },
    formatNumber, INSURANCE_TYPES, csrfToken
  }, { layout: PUB_LAYOUT })
})

// =============================================
// Error Handler
// =============================================
fastify.setErrorHandler(async (error, req, reply) => {
  console.error('[Error]', error)
  if (process.env.SENTRY_DSN) {
    const Sentry = require('@sentry/node')
    Sentry.captureException(error, { extra: { url: req.url, method: req.method } })
  }
  if (error.statusCode === 429) {
    return reply.code(429).view('error.ejs',
      { title: 'Too Many Requests', message: error.message, code: 429 },
      { layout: PUB_LAYOUT }
    ).catch(() => reply.code(429).send({ error: error.message }))
  }
  reply.code(error.statusCode || 500).send({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' })
})

// =============================================
// Start
// =============================================
const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' })
    startScraperScheduler()
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

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
const { lookupIp } = require('./services/geoip')
const { parseUA }  = require('./services/uaParser')
const clientIp = req => req.headers['x-real-ip'] || (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip

const _cache = new Map()
function getCached(key, ttlMs, fn) {
  const hit = _cache.get(key)
  if (hit && Date.now() < hit.exp) return Promise.resolve(hit.data)
  return Promise.resolve(fn()).then(data => {
    _cache.set(key, { data, exp: Date.now() + ttlMs })
    return data
  })
}

const PUB_LAYOUT = 'layout.ejs'
const CLASS_MAP  = { class1: '1', class2plus: '2+', class3plus: '3+' }

async function resolveAffiliate(req) {
  const slug = req.cookies?.aff_slug
  if (!slug) return null
  const [[aff]] = await db.query(
    'SELECT id FROM affiliates WHERE slug=? AND is_active=1', [slug]
  ).catch(() => [[null]])
  return aff?.id || null
}

async function getPublicSettings(affiliateId = 0) {
  return getCached(`pub_${affiliateId}`, 2 * 60 * 1000, async () => {
    const [global] = await db.query(
      'SELECT `key`, `value` FROM app_settings WHERE affiliate_id = 0'
    ).catch(() => [[]])
    const s = {}
    global.forEach(r => { s[r.key] = r.value })
    if (affiliateId) {
      const [aff] = await db.query(
        'SELECT `key`, `value` FROM app_settings WHERE affiliate_id = ?', [affiliateId]
      ).catch(() => [[]])
      aff.forEach(r => { s[r.key] = r.value })
    }
    return s
  })
}

const getBrands    = () => getCached('brands',    10 * 60 * 1000, async () => { const [r] = await db.query('SELECT id, name FROM scraped_brands ORDER BY name'); return r })
const getCompanies = () => getCached('companies', 10 * 60 * 1000, async () => { const [r] = await db.query('SELECT id, name, short_name, logo_url FROM companies WHERE is_active = 1 ORDER BY name').catch(() => [[]]); return r })
const getProvinces = () => getCached('provinces', 10 * 60 * 1000, async () => { const [r] = await db.query('SELECT name FROM provinces ORDER BY name'); return r })
const getAllModels = () => getCached('all_models', 10 * 60 * 1000, async () => {
  const [rows] = await db.query(
    'SELECT sm.id, sm.name AS model, sb.id AS brand_id, sb.name AS brand FROM scraped_models sm JOIN scraped_brands sb ON sb.id = sm.brand_id'
  ).catch(() => [[]])
  return rows
})
const getPopularCars = () => getCached('popular_cars', 10 * 60 * 1000, async () => {
  const [rows] = await db.query(`
    SELECT sm.id AS model_id, sm.name AS model_name, sb.name AS brand_name,
           sp.insurance_class,
           MIN(COALESCE(sp.premium_discounted, sp.premium_amount)) AS min_price,
           MAX(sp.car_year) AS year,
           COUNT(*) AS cnt
    FROM scraped_packages sp
    JOIN scraped_models sm ON sm.id = sp.model_id
    JOIN scraped_brands sb ON sb.id = sm.brand_id
    WHERE sp.car_year >= YEAR(NOW()) - 2 AND sp.insurance_class = '1'
    GROUP BY sm.id
    HAVING cnt >= 2
    ORDER BY cnt DESC, min_price ASC
    LIMIT 10
  `).catch(() => [[]])
  return rows
})

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
  store: require('./services/sessionStore'),
  rolling: true,
  cookie: { secure: false, httpOnly: true, sameSite: 'lax', maxAge: 14 * 24 * 60 * 60 * 1000 },
  errorHandler: (err, req, reply) => {
    req.log.error(err, 'session store error — continuing with empty session')
  }
})

// =============================================
// Helpers
// =============================================
function formatNumber(n) {
  return Number(n).toLocaleString('th-TH', { minimumFractionDigits: 0 })
}

const COMPANY_ABBR = {
  'ทิพย':                              'TIP',
  'วิริยะ':                            'VIB',
  'กรุงเทพ':                           'BKI',
  'เมืองไทยประกันภัย':                 'MTI',
  'ไทยวิวัฒน์':                        'TVI',
  'เทเวศ':                             'DVI',
  'คุ้มภัยโตเกียวมารีนประกันภัย':      'TKI',
  'อลิอันซ์':                          'AZAY',
  'ERGO':                              'ERGO',
  'LMG':                               'LMG',
}
function getCompanyAbbr(name) {
  return COMPANY_ABBR[name] || name.slice(0, 3).toUpperCase()
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

  // เก็บ query params ทั้งหมดไว้ใน session (attribution)
  if (Object.keys(req.query).length > 0) {
    req.session.queryParams = req.query
  }

  // affiliate cookie + click counter
  if (req.query.aff) {
    const affSlug = req.query.aff.substring(0, 50)
    reply.setCookie('aff_slug', affSlug, {
      path: '/', maxAge: 30 * 24 * 60 * 60, httpOnly: true, sameSite: 'lax'
    })
    db.query('UPDATE affiliates SET click_count = click_count + 1 WHERE slug = ? AND is_active = 1', [affSlug]).catch(() => {})
  }

  // visitor_id cookie — track returning visitors
  let visitorId = req.cookies?.visitor_id
  if (!visitorId || !/^[0-9a-f-]{36}$/.test(visitorId)) {
    visitorId = crypto.randomUUID()
    reply.setCookie('visitor_id', visitorId, {
      path: '/', maxAge: 365 * 24 * 60 * 60, httpOnly: true, sameSite: 'lax'
    })
  }

  const [brands, insurers, popularCars, allModels] = await Promise.all([getBrands(), getCompanies(), getPopularCars(), getAllModels()])
  const currentYear = new Date().getFullYear()
  const years = []
  for (let y = currentYear; y >= currentYear - 20; y--) years.push(y)
  const csrfToken = genCsrf(req)

  const affiliateId = await resolveAffiliate(req)
  const pub = await getPublicSettings(affiliateId)

  return reply.view('index.ejs', {
    title: 'คำนวณเบี้ยประกันรถยนต์',
    brands, insurers, popularCars, allModels, years, errors: {}, old: {},
    utm: req.session.utm || {}, csrfToken,
    lineOaUrl: pub.line_oa_url || null,
    gtmHeadCode: pub.gtm_head_code || '',
    gtmBodyCode: pub.gtm_body_code || ''
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
// POST /partial-lead — บันทึก lead ระหว่างกรอกฟอร์ม
// =============================================
fastify.post('/partial-lead', {
  config: { rateLimit: { max: 30, timeWindow: '1 minute' } }
}, async (req, reply) => {
  const body = sanitizeBody(req.body || {})
  const { partial_token, model_id, car_year, insurance_type, name, phone, funnel_stage } = body

  if (!partial_token || !/^[0-9a-f]{32}$/.test(partial_token)) return reply.send({ ok: false })
  if (!model_id || !car_year || !insurance_type) return reply.send({ ok: false })
  if (!INSURANCE_TYPES[insurance_type]) return reply.send({ ok: false })

  const modelIdInt = parseInt(model_id)
  const yearInt    = parseInt(car_year)
  const stage      = funnel_stage === 'warm' ? 'warm' : 'cold'

  const [modelRows] = await db.query(
    `SELECT sm.name AS model_name, sb.name AS brand_name
     FROM scraped_models sm JOIN scraped_brands sb ON sb.id = sm.brand_id
     WHERE sm.id = ?`, [modelIdInt]
  ).catch(() => [[]])
  if (!modelRows.length) return reply.send({ ok: false })

  const { brand_name, model_name } = modelRows[0]

  let cleanPhone = null
  if (phone && phone.trim()) {
    const ph = phone.trim().replace(/[\s-]/g, '')
    if (/^0[0-9]{8,9}$/.test(ph)) cleanPhone = ph
  }
  const cleanName = (name && name.trim().length >= 2) ? name.trim().substring(0, 200) : null

  const utm         = req.session?.utm || {}
  const token       = crypto.randomBytes(16).toString('hex')
  const visitorId   = req.cookies?.visitor_id || null
  const queryParams = req.session?.queryParams ? JSON.stringify(req.session.queryParams) : null
  const affiliateId = await resolveAffiliate(req)

  await db.query(
    `INSERT INTO leads
       (token, partial_token, source, brand, model, model_id, year, insurance_type, funnel_stage, name, phone, visitor_id, query_params, affiliate_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       brand=VALUES(brand), model=VALUES(model), model_id=VALUES(model_id),
       year=VALUES(year), insurance_type=VALUES(insurance_type),
       funnel_stage=IF(funnel_stage='hot','hot',VALUES(funnel_stage)),
       name=COALESCE(VALUES(name), name),
       phone=COALESCE(VALUES(phone), phone),
       visitor_id=COALESCE(visitor_id, VALUES(visitor_id)),
       query_params=COALESCE(query_params, VALUES(query_params)),
       affiliate_id=COALESCE(affiliate_id, VALUES(affiliate_id)),
       updated_at=NOW()`,
    [token, partial_token, utm.source || 'organic',
     brand_name, model_name, modelIdInt, yearInt, insurance_type, stage, cleanName, cleanPhone, visitorId, queryParams, affiliateId]
  ).catch(() => {})

  return reply.send({ ok: true })
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
    insurance_type, partial_token,
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
  if (!insurance_type || !INSURANCE_TYPES[insurance_type])
    errors.insurance_type = 'กรุณาเลือกประเภทประกัน'

  if (Object.keys(errors).length > 0) {
    const [brands, insurers] = await Promise.all([getBrands(), getCompanies()])
    const years = []
    for (let y = currentYear; y >= currentYear - 20; y--) years.push(y)
    const csrfToken = genCsrf(req)
    return reply.view('index.ejs', {
      title: 'คำนวณเบี้ยประกันรถยนต์',
      brands, insurers, years, errors, old: body,
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
    `SELECT company_name, insurance_class, premium_amount, premium_discounted, coverage
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

  // visitor_id + IP tracking + query params + affiliate
  const visitorId   = req.cookies?.visitor_id || null
  const geoData     = await lookupIp(clientIp(req)).catch(() => null)
  const queryParams = req.session?.queryParams ? JSON.stringify(req.session.queryParams) : null
  const affiliateId = await resolveAffiliate(req)
  const userAgent   = (req.headers['user-agent'] || '').substring(0, 500) || null

  // validate phone/name (optional)
  let cleanPhone = null
  if (phone && phone.trim()) {
    const ph = phone.trim().replace(/[\s-]/g, '')
    if (/^0[0-9]{8,9}$/.test(ph)) cleanPhone = ph
  }
  const cleanName = (name && name.trim().length >= 2)
    ? name.trim().substring(0, 200) : null

  // ตรวจ partial lead ที่บันทึกไว้ระหว่างกรอกฟอร์ม
  let resultToken = null
  if (partial_token && /^[0-9a-f]{32}$/.test(partial_token)) {
    const [[existing]] = await db.query(
      'SELECT token FROM leads WHERE partial_token = ?', [partial_token]
    ).catch(() => [[null]])
    if (existing?.token) resultToken = existing.token
  }

  if (resultToken) {
    // อัปเกรด partial lead → hot
    await db.query(
      `UPDATE leads SET
         brand=?, model=?, model_id=?, year=?, insurance_type=?,
         funnel_stage='hot', name=?, phone=?, best_price=?, packages_json=?,
         source=?, utm_campaign=?, utm_medium=?, utm_content=?,
         visitor_id=COALESCE(visitor_id,?),
         ip_address=?, ip_country=?, ip_city=?, ip_isp=?, ip_mobile=?, ip_proxy=?,
         query_params=COALESCE(query_params,?),
         affiliate_id=COALESCE(affiliate_id,?),
         user_agent=COALESCE(user_agent,?),
         updated_at=NOW()
       WHERE token=?`,
      [brandName, modelName, modelId > 0 ? modelId : null, yearInt, insurance_type,
       cleanName, cleanPhone, bestPrice, JSON.stringify(packages),
       source, campaign, medium, content,
       visitorId,
       clientIp(req), geoData?.country||null, geoData?.city||null, geoData?.isp||null,
       geoData?.mobile||0, geoData?.proxy||0,
       queryParams, affiliateId, userAgent, resultToken]
    )
  } else {
    // สร้าง lead ใหม่
    resultToken = crypto.randomBytes(16).toString('hex')
    await db.query(
      `INSERT INTO leads
        (token, source, utm_campaign, utm_medium, utm_content,
         brand, model, model_id, year,
         insurance_type, funnel_stage, name, phone, best_price, packages_json,
         visitor_id, ip_address, ip_country, ip_city, ip_isp, ip_mobile, ip_proxy, ip_geo, query_params, affiliate_id, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'hot', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [resultToken, source, campaign, medium, content,
       brandName, modelName, modelId > 0 ? modelId : null, yearInt,
       insurance_type, cleanName, cleanPhone, bestPrice, JSON.stringify(packages),
       visitorId, clientIp(req), geoData?.country||null, geoData?.city||null, geoData?.isp||null,
       geoData?.mobile||0, geoData?.proxy||0, geoData ? JSON.stringify(geoData) : null, queryParams, affiliateId, userAgent]
    )
  }

  // Notification badge + LINE notify (ใช้ line_admin_user_id จาก settings per-affiliate)
  const [[newLead]] = await db.query('SELECT id FROM leads WHERE token = ?', [resultToken])
  db.query("INSERT INTO notifications (type, ref_id) VALUES ('new_lead', ?)", [newLead?.id || 0]).catch(() => {})
  getPublicSettings(affiliateId || 0).then(pub => {
    notifyAdminNewLead({
      brand: brandName, model: modelName, year: yearInt,
      insurance_type, name: cleanName, phone: cleanPhone, source
    }, pub.line_admin_user_id || null).catch(() => {})
  }).catch(() => {})

  return reply.redirect(`/result/${resultToken}`)
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
  if (lead.model_id && lead.year && lead.insurance_type) {
    const scraperClass = CLASS_MAP[lead.insurance_type]
    const [pkgRows] = await db.query(
      `SELECT sp.id, sp.company_name, sp.insurance_class, sp.premium_amount, sp.premium_discounted, sp.coverage,
              sp.repair_type, sp.has_flood, c.logo_url
       FROM scraped_packages sp
       LEFT JOIN companies c ON c.name LIKE CONCAT(sp.company_name, '%')
       WHERE sp.model_id = ? AND sp.car_year = ? AND sp.insurance_class = ?
       ORDER BY COALESCE(sp.premium_discounted, sp.premium_amount) ASC`,
      [lead.model_id, lead.year, scraperClass]
    ).catch(() => db.query(
      `SELECT sp.id, sp.company_name, sp.insurance_class, sp.premium_amount, sp.premium_discounted, sp.coverage,
              c.logo_url
       FROM scraped_packages sp
       LEFT JOIN companies c ON c.name LIKE CONCAT(sp.company_name, '%')
       WHERE sp.model_id = ? AND sp.car_year = ? AND sp.insurance_class = ?
       ORDER BY COALESCE(sp.premium_discounted, sp.premium_amount) ASC`,
      [lead.model_id, lead.year, scraperClass]
    ).catch(() => [[]]))
    packages = pkgRows.map(pkg => ({
      ...pkg,
      coverage: typeof pkg.coverage === 'string' ? JSON.parse(pkg.coverage) : pkg.coverage
    }))
  }
  if (packages.length === 0) {
    try {
      const parsed = JSON.parse(lead.packages_json || '[]')
      if (Array.isArray(parsed)) packages = parsed
    } catch {}
  }

  const pub = await getPublicSettings(lead.affiliate_id || 0)

  return reply.view('result.ejs', {
    title: 'ราคาประกันรถยนต์ของคุณ',
    lead, insuranceConfig, packages, formatNumber, getCompanyAbbr,
    lineOaUrl:   pub.line_oa_url   || '#',
    facebookUrl: pub.facebook_url  || '#',
    sitePhone:   pub.site_phone    || null,
    gtmHeadCode: pub.gtm_head_code || '',
    gtmBodyCode: pub.gtm_body_code || ''
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
  const pub = await getPublicSettings(0)
  return reply.redirect(pub.line_oa_url || '/')
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
  const pub = await getPublicSettings(0)
  return reply.redirect(pub.facebook_url || '/')
})

// =============================================
// POST /concierge — ขอให้ทีมโทรกลับ (ไม่ต้องกรอกฟอร์มเต็ม)
// =============================================
fastify.post('/concierge', {
  config: { rateLimit: { max: 5, timeWindow: '5 minutes' } }
}, async (req, reply) => {
  const body = sanitizeBody(req.body || {})
  const { phone, name } = body

  if (!phone || !phone.trim()) return reply.send({ ok: false, message: 'กรุณากรอกเบอร์โทร' })
  const ph = phone.trim().replace(/[\s-]/g, '')
  if (!/^0[0-9]{8,9}$/.test(ph)) return reply.send({ ok: false, message: 'เบอร์โทรไม่ถูกต้อง' })

  const cleanName  = (name && name.trim().length >= 2) ? name.trim().substring(0, 200) : null
  const token      = crypto.randomBytes(16).toString('hex')
  const utm        = req.session?.utm || {}
  const visitorId   = req.cookies?.visitor_id || null
  const geoData     = await lookupIp(clientIp(req)).catch(() => null)
  const queryParams = req.session?.queryParams ? JSON.stringify(req.session.queryParams) : null
  const affiliateId = await resolveAffiliate(req)

  await db.query(
    `INSERT INTO leads
       (token, source, brand, model, year, license_plate, province,
        insurance_type, funnel_stage, lead_type, name, phone,
        visitor_id, ip_address, ip_country, ip_city, ip_isp, ip_mobile, ip_proxy, ip_geo, query_params, affiliate_id)
     VALUES (?, ?, 'ไม่ระบุ', 'ไม่ระบุ', ?, '', 'ไม่ระบุ', 'class1', 'hot', 'concierge', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [token, utm.source || 'organic', new Date().getFullYear(), cleanName, ph,
     visitorId, clientIp(req), geoData?.country||null, geoData?.city||null, geoData?.isp||null,
     geoData?.mobile||0, geoData?.proxy||0, geoData ? JSON.stringify(geoData) : null, queryParams, affiliateId]
  ).catch(() => {})

  const [[newLead]] = await db.query('SELECT id FROM leads WHERE token = ?', [token]).catch(() => [[null]])
  db.query("INSERT INTO notifications (type, ref_id) VALUES ('new_lead', ?)", [newLead?.id || 0]).catch(() => {})
  getPublicSettings(affiliateId || 0).then(pub => {
    notifyAdminNewLead({
      brand: 'Concierge', model: '—', year: new Date().getFullYear(),
      insurance_type: 'class1', name: cleanName, phone: ph, source: utm.source || 'organic'
    }, pub.line_admin_user_id || null).catch(() => {})
  }).catch(() => {})

  return reply.send({ ok: true })
})

// =============================================
// GET /compare — เปรียบเทียบราคา (คงไว้)
// =============================================
fastify.get('/compare', async (req, reply) => {
  const { brand_id, model_id, year, province, insurance_class } = req.query
  const [brands, provinces] = await Promise.all([getBrands(), getProvinces()])
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
  let sameClassPackages = null
  let selectedModel = null
  const CLASS_LABEL_MAP = { class1: '1', class2plus: '2+', class3plus: '3+' }

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

      if (insurance_class && CLASS_LABEL_MAP[insurance_class]) {
        // Mode B: same-class, multi-company
        const scraperClass = CLASS_LABEL_MAP[insurance_class]
        const [pkgRows] = await db.query(
          `SELECT id, company_name, insurance_class, premium_amount, premium_discounted, coverage,
                  repair_type, has_flood
           FROM scraped_packages
           WHERE model_id = ? AND car_year = ? AND insurance_class = ?
           ORDER BY COALESCE(premium_discounted, premium_amount) ASC`,
          [modelIdInt, yearInt, scraperClass]
        ).catch(() => db.query(
          `SELECT id, company_name, insurance_class, premium_amount, premium_discounted, coverage
           FROM scraped_packages
           WHERE model_id = ? AND car_year = ? AND insurance_class = ?
           ORDER BY COALESCE(premium_discounted, premium_amount) ASC`,
          [modelIdInt, yearInt, scraperClass]
        ).catch(() => [[]]))
        sameClassPackages = pkgRows.map(pkg => ({
          ...pkg,
          coverage: typeof pkg.coverage === 'string' ? JSON.parse(pkg.coverage) : (pkg.coverage || null)
        }))
      } else {
        // Mode A: cross-class (default)
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
  }

  const csrfToken = genCsrf(req)
  return reply.view('compare.ejs', {
    title: 'เปรียบเทียบประกันรถยนต์',
    brands, models, provinces, years,
    comparisons, sameClassPackages, selectedModel,
    selected: { brand_id, model_id, year, province, insurance_class },
    formatNumber, getCompanyAbbr, INSURANCE_TYPES, csrfToken
  }, { layout: PUB_LAYOUT })
})

// =============================================
// GET /compare-view — เปรียบเทียบแผนแบบเคียงข้างกัน (dedicated page)
// =============================================
fastify.get('/compare-view', async (req, reply) => {
  const { pkg_ids, token } = req.query
  if (!pkg_ids) return reply.redirect('/')

  const ids = pkg_ids.split(',').map(n => parseInt(n, 10)).filter(n => !isNaN(n) && n > 0).slice(0, 3)
  if (ids.length < 2) return reply.redirect('/')

  const [pkgRows] = await db.query(
    `SELECT id, company_name, insurance_class, premium_amount, premium_discounted, coverage,
            repair_type, has_flood, model_id, car_year
     FROM scraped_packages
     WHERE id IN (?)
     ORDER BY FIELD(id, ${ids.join(',')})`,
    [ids]
  ).catch(() => db.query(
    `SELECT id, company_name, insurance_class, premium_amount, premium_discounted, coverage,
            model_id, car_year
     FROM scraped_packages
     WHERE id IN (?)
     ORDER BY FIELD(id, ${ids.join(',')})`,
    [ids]
  ).catch(() => [[]]))

  if (pkgRows.length < 2) return reply.redirect('/')

  const packages = pkgRows.map(pkg => ({
    ...pkg,
    coverage: typeof pkg.coverage === 'string' ? JSON.parse(pkg.coverage) : (pkg.coverage || {})
  }))

  let carInfo = null
  const firstPkg = packages[0]
  if (firstPkg?.model_id) {
    const [[modelRow]] = await db.query(
      `SELECT sm.id AS model_id, sm.name AS model_name, sb.id AS brand_id, sb.name AS brand_name
       FROM scraped_models sm JOIN scraped_brands sb ON sb.id = sm.brand_id
       WHERE sm.id = ?`,
      [firstPkg.model_id]
    ).catch(() => [[null]])
    if (modelRow) carInfo = { ...modelRow, year: firstPkg.car_year, insurance_class: firstPkg.insurance_class }
  }

  const brands = await getBrands()
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 21 }, (_, i) => currentYear - i)

  const pub = await getPublicSettings(0)

  return reply.view('compare-view.ejs', {
    title: 'เปรียบเทียบแผนประกัน',
    packages,
    carInfo,
    brands,
    years,
    INSURANCE_TYPES,
    leadToken: /^[0-9a-f]{32}$/.test(token || '') ? token : null,
    formatNumber, getCompanyAbbr,
    lineOaUrl:   pub.line_oa_url   || '#',
    facebookUrl: pub.facebook_url  || '#',
    sitePhone:   pub.site_phone    || null,
    gtmHeadCode: pub.gtm_head_code || '',
    gtmBodyCode: pub.gtm_body_code || ''
  }, { layout: PUB_LAYOUT })
})

// =============================================
// GET /quick — popular card shortcut → result
// =============================================
fastify.get('/quick', async (req, reply) => {
  const { model_id, year, type } = req.query
  const modelId  = parseInt(model_id, 10)
  const carYear  = parseInt(year, 10)
  const insType  = ['class1','class2plus','class3plus'].includes(type) ? type : 'class1'
  if (!modelId || !carYear) return reply.redirect('/')

  const [[modelRow]] = await db.query(
    `SELECT sm.id, sm.name AS model_name, sb.name AS brand_name
     FROM scraped_models sm JOIN scraped_brands sb ON sb.id = sm.brand_id
     WHERE sm.id = ?`, [modelId]
  ).catch(() => [[null]])
  if (!modelRow) return reply.redirect('/')

  const token = crypto.randomBytes(16).toString('hex')
  const visitorId = req.cookies?.visitor_id || null
  const affiliateId = await resolveAffiliate(req)
  await db.query(
    `INSERT INTO leads (token, source, brand, model, model_id, year, insurance_type, funnel_stage, visitor_id, affiliate_id, ip_address)
     VALUES (?, 'popular', ?, ?, ?, ?, ?, 'hot', ?, ?, ?)`,
    [token, modelRow.brand_name, modelRow.model_name, modelId, carYear, insType, 'hot', visitorId, affiliateId, clientIp(req)]
  ).catch(() => {})

  return reply.redirect('/result/' + token)
})

// =============================================
// GET /api/quote-pdf — generate PDF quotation
// =============================================
fastify.get('/api/quote-pdf', async (req, reply) => {
  const { token, pkg_id } = req.query
  if (!token || !/^[0-9a-f]{32}$/.test(token)) return reply.code(400).send({ error: 'invalid' })
  const pkgId = parseInt(pkg_id, 10)
  if (!pkgId) return reply.code(400).send({ error: 'invalid' })

  const [[lead]] = await db.query('SELECT * FROM leads WHERE token = ?', [token]).catch(() => [[null]])
  if (!lead) return reply.code(404).send({ error: 'not found' })

  const [[pkg]] = await db.query('SELECT * FROM scraped_packages WHERE id = ?', [pkgId]).catch(() => [[null]])
  if (!pkg) return reply.code(404).send({ error: 'not found' })

  const pub = await getPublicSettings(lead.affiliate_id || 0)
  let coverage = {}
  try { coverage = typeof pkg.coverage === 'string' ? JSON.parse(pkg.coverage) : (pkg.coverage || {}) } catch {}

  const displayPrice = pkg.premium_discounted && parseFloat(pkg.premium_discounted) < parseFloat(pkg.premium_amount)
    ? parseFloat(pkg.premium_discounted) : parseFloat(pkg.premium_amount)
  const net = Math.round(displayPrice / 1.07428)
  const tax = Math.round(displayPrice - net)

  const PDFDocument = require('pdfkit')
  const FONT = path.join(__dirname, 'public/fonts/Sarabun-Regular.ttf')
  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  const chunks = []
  doc.on('data', c => chunks.push(c))

  const quoteNo = 'QT-' + String(lead.id).padStart(6, '0') + String(pkgId).padStart(3, '0')
  const today  = new Date().toLocaleDateString('th-TH', { day: '2-digit', month: 'long', year: 'numeric' })
  const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toLocaleDateString('th-TH', { day: '2-digit', month: 'long', year: 'numeric' })

  await new Promise((resolve, reject) => {
    doc.on('end', resolve)
    doc.on('error', reject)
    doc.registerFont('Sarabun', FONT)
    doc.font('Sarabun')

    const W = doc.page.width - 100
    const L = 50

    // Header
    doc.rect(L, 50, W, 64).fill('#1a3a5c')
    doc.fillColor('#ffffff').fontSize(18).text('ใบเสนอราคาประกันภัยรถยนต์', L + 14, 64, { width: W - 28 })
    doc.fontSize(11).text(pub.site_name || '724Thai Insurance', L + 14, 87, { width: W - 28 })

    // Quote meta
    doc.fillColor('#1a3a5c').fontSize(11)
      .text('เลขที่: ' + quoteNo, L, 130, { width: W / 2 })
      .text('วันที่: ' + today, L + W / 2, 130, { width: W / 2, align: 'right' })
    doc.moveTo(L, 152).lineTo(L + W, 152).strokeColor('#e2e8f0').lineWidth(1).stroke()

    // Customer + car
    doc.fillColor('#94a3b8').fontSize(9).text('ผู้เอาประกัน', L, 162)
    doc.fillColor('#1a3a5c').fontSize(13).text(lead.name || '-', L, 176)
    doc.fillColor('#475569').fontSize(11).text(lead.phone || '', L, 194)

    doc.fillColor('#94a3b8').fontSize(9).text('รถยนต์', L + 300, 162)
    doc.fillColor('#1a3a5c').fontSize(13).text((lead.brand || '') + ' ' + (lead.model || ''), L + 300, 176)
    doc.fillColor('#475569').fontSize(11).text('ปี ' + (lead.year || ''), L + 300, 194)
    doc.moveTo(L, 218).lineTo(L + W, 218).strokeColor('#e2e8f0').stroke()

    // Company + class
    doc.rect(L, 228, W, 34).fill('#eff6ff')
    doc.fillColor('#1a3a5c').fontSize(13)
      .text(pkg.company_name + '  ·  ประกันชั้น ' + pkg.insurance_class, L + 12, 239, { width: W - 24 })

    // Coverage items
    let y = 278
    const repairLabel = pkg.repair_type === 'authorized' ? 'ซ่อมศูนย์' : 'ซ่อมอู่'
    const covItems = ['✓  ประกันชั้น ' + pkg.insurance_class + '  ·  ' + repairLabel]
    if (pkg.has_flood) covItems.push('✓  คุ้มครองภัยน้ำท่วม')
    if (coverage.own_vehicle) {
      Object.entries(coverage.own_vehicle).slice(0, 4).forEach(([k, v]) => covItems.push('✓  ' + k + ':  ' + v))
    }
    if (coverage.third_party) {
      Object.entries(coverage.third_party).slice(0, 2).forEach(([k, v]) => covItems.push('✓  ' + k + ':  ' + v))
    }
    doc.fillColor('#0f766e').fontSize(12)
    covItems.forEach(item => { doc.text(item, L + 8, y); y += 22 })

    // Price box
    y = Math.max(y + 20, 460)
    doc.rect(L, y, W, 96).fill('#f8fafc')
    doc.moveTo(L, y).lineTo(L + W, y).strokeColor('#e2e8f0').stroke()
    doc.moveTo(L, y + 96).lineTo(L + W, y + 96).strokeColor('#e2e8f0').stroke()
    doc.fillColor('#475569').fontSize(11)
      .text('เบี้ยประกันสุทธิ', L + 14, y + 12, { width: W - 28 })
      .text(formatNumber(net) + ' บาท', L + 14, y + 12, { width: W - 28, align: 'right' })
      .text('อากรแสตมป์ + ภาษีมูลค่าเพิ่ม', L + 14, y + 34, { width: W - 28 })
      .text(formatNumber(tax) + ' บาท', L + 14, y + 34, { width: W - 28, align: 'right' })
    doc.moveTo(L + 14, y + 55).lineTo(L + W - 14, y + 55).strokeColor('#cbd5e1').stroke()
    doc.fillColor('#1a3a5c').fontSize(14)
      .text('รวมเบี้ยประกันทั้งสิ้น', L + 14, y + 64, { width: W - 28 })
    doc.fillColor('#0f766e').fontSize(18)
      .text('฿' + formatNumber(displayPrice), L + 14, y + 60, { width: W - 28, align: 'right' })

    // Footer
    const fy = y + 116
    doc.moveTo(L, fy).lineTo(L + W, fy).strokeColor('#e2e8f0').stroke()
    doc.fillColor('#94a3b8').fontSize(9)
      .text('ใบเสนอราคามีผลถึง: ' + expiry + '  ·  ราคานี้ยังไม่รวมส่วนลดพิเศษ กรุณาติดต่อเจ้าหน้าที่เพื่อยืนยันก่อนชำระเงิน', L, fy + 10, { width: W, align: 'center' })
    if (pub.site_phone) {
      doc.fillColor('#64748b').fontSize(10).text('โทร: ' + pub.site_phone, L, fy + 28, { width: W, align: 'center' })
    }

    doc.end()
  })

  reply.header('Content-Type', 'application/pdf')
  reply.header('Content-Disposition', 'attachment; filename="' + quoteNo + '.pdf"')
  return reply.send(Buffer.concat(chunks))
})

// =============================================
// Error Pages
// =============================================
const ERROR_META = {
  400: { icon: '⚠️',  title: 'คำขอไม่ถูกต้อง',          message: 'ข้อมูลที่ส่งมาไม่ถูกต้องหรือไม่ครบถ้วน กรุณาตรวจสอบแล้วลองใหม่', codeColor: '#f59e0b', codeColor2: '#d97706' },
  401: { icon: '🔐',  title: 'กรุณาเข้าสู่ระบบ',          message: 'คุณต้องเข้าสู่ระบบก่อนจึงจะเข้าถึงหน้านี้ได้',                    codeColor: '#8b5cf6', codeColor2: '#6d28d9' },
  403: { icon: '🚫',  title: 'ไม่มีสิทธิ์เข้าถึง',        message: 'คุณไม่ได้รับอนุญาตให้เข้าถึงหน้านี้',                             codeColor: '#ef4444', codeColor2: '#dc2626' },
  404: { icon: '🔍',  title: 'ไม่พบหน้าที่ต้องการ',       message: 'URL ที่คุณพิมพ์อาจผิดพลาดหรือหน้านี้ถูกย้ายไปแล้ว',              codeColor: '#475569', codeColor2: '#1e293b' },
  429: { icon: '⏳',  title: 'คำขอมากเกินไป',             message: 'คุณส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองใหม่',                  codeColor: '#f97316', codeColor2: '#ea580c' },
  500: { icon: '🛠️', title: 'เกิดข้อผิดพลาดภายในระบบ',   message: 'ระบบมีปัญหาชั่วคราว ทีมงานได้รับแจ้งแล้ว กรุณาลองใหม่อีกครั้ง', codeColor: '#64748b', codeColor2: '#475569' },
  503: { icon: '🔧',  title: 'ระบบปิดให้บริการชั่วคราว',  message: 'เรากำลังปรับปรุงระบบ กรุณากลับมาใหม่ในอีกสักครู่',               codeColor: '#64748b', codeColor2: '#475569' },
}

function renderError(reply, code, req) {
  const meta = ERROR_META[code] || { icon: '❌', title: 'เกิดข้อผิดพลาด', message: 'กรุณาลองใหม่อีกครั้ง', codeColor: '#64748b', codeColor2: '#475569' }
  return reply.code(code).view('error.ejs', {
    title: meta.title,
    ...meta,
    code,
    reqUrl: req?.url || ''
  }, { layout: PUB_LAYOUT }).catch(() => reply.code(code).send({ error: meta.title }))
}

// =============================================
// 404 Handler
// =============================================
fastify.setNotFoundHandler((req, reply) => {
  renderError(reply, 404, req)
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
  const code = error.statusCode || 500
  renderError(reply, code, req)
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

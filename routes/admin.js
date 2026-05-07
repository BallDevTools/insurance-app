'use strict'

const crypto = require('crypto')
const db = require('../db')
const bcrypt = require('bcryptjs')
const { INSURANCE_TYPES } = require('../calculator')
const audit = require('../services/auditLog')

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

const ADM_LAYOUT = 'admin_layout.ejs'
const AUTH_LAYOUT = 'auth_layout.ejs'

// lead WHERE filter ตาม role
function leadFilter(admin) {
  if (admin.role === 'affiliate') return { extra: ' AND l.affiliate_id = ?', p: [admin.affiliate_id] }
  if (admin.role === 'agent')     return { extra: ' AND l.affiliate_id IS NULL', p: [] }
  return { extra: '', p: [] }
}

// คำนวณ commission เมื่อ lead → converted
async function calcCommission(leadId) {
  const [[lead]] = await db.query(
    'SELECT affiliate_id, best_price, commission_amount FROM leads WHERE id=?', [leadId]
  ).catch(() => [[null]])
  if (!lead?.affiliate_id || !lead?.best_price || lead.commission_amount) return

  const [sRows] = await db.query(
    "SELECT `key`,`value` FROM app_settings WHERE `key` IN ('commission_base','broker_fee_rate') AND affiliate_id=0"
  ).catch(() => [[]])
  const s = {}; sRows.forEach(r => { s[r.key] = r.value })

  const [[aff]] = await db.query(
    'SELECT commission_rate FROM affiliates WHERE id=?', [lead.affiliate_id]
  ).catch(() => [[null]])
  if (!aff) return

  const price    = parseFloat(lead.best_price)
  const commRate = parseFloat(aff.commission_rate) / 100
  let amount
  if (s.commission_base === 'broker_fee') {
    const bfRate = parseFloat(s.broker_fee_rate || 0) / 100
    amount = price * bfRate * commRate
  } else {
    amount = price * commRate
  }
  await db.query('UPDATE leads SET commission_amount=? WHERE id=?', [amount.toFixed(2), leadId]).catch(() => {})
}

function formatNumber(n) {
  return Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 0 })
}

const TYPE_MAP   = { class1: 'ชั้น 1', class2plus: 'ชั้น 2+', class3plus: 'ชั้น 3+', compulsory: 'พรบ.' }
const LEAD_STATUS_MAP = { new: 'ใหม่', contacted: 'ติดต่อแล้ว', converted: 'ปิดงาน', lost: 'ยกเลิก' }
const SOURCE_MAP = { organic: 'Organic', line_ads: 'LINE Ads', facebook_ads: 'Facebook Ads', google: 'Google', other: 'อื่นๆ' }

module.exports = async function adminPlugin(fastify, opts) {

  // ---- Auth + CSRF Guard ----
  fastify.addHook('preHandler', async (req, reply) => {
    // CSRF check for all form POST submissions
    if (req.method === 'POST') {
      const ct = req.headers['content-type'] || ''
      if (ct.includes('application/x-www-form-urlencoded')) {
        if (!checkCsrf(req)) {
          return reply.code(403).send('CSRF token ไม่ถูกต้อง กรุณาโหลดหน้าใหม่')
        }
      }
    }
    // Auth check
    if (req.url.startsWith('/admin/login')) return
    if (!req.session?.admin) return reply.redirect('/admin/login')

    // Affiliate: เข้าได้เฉพาะ dashboard + leads
    if (req.session.admin.role === 'affiliate') {
      const p = req.url.split('?')[0]
      const ok = p === '/admin' || p === '/admin/logout' || p === '/admin/settings' ||
                 p.startsWith('/admin/leads') || p.startsWith('/admin/api/')
      if (!ok) return reply.redirect('/admin/leads')
    }
    // Fetch theme settings for layout CSS vars
    const [themeRows] = await db.query(
      "SELECT `key`, `value` FROM app_settings WHERE `key` LIKE 'theme_%' AND affiliate_id = 0"
    ).catch(() => [[]])
    req.themeSettings = themeRows.reduce((acc, r) => { acc[r.key] = r.value; return acc }, {})
  })

  // helper: render admin view (includes csrfToken automatically)
  const av = (reply, tpl, data = {}) => {
    const csrfToken = genCsrf(reply.request)
    const themeSettings = reply.request.themeSettings || {}
    return reply.view(`admin/${tpl}`, { formatNumber, TYPE_MAP, LEAD_STATUS_MAP, SOURCE_MAP, INSURANCE_TYPES, csrfToken, themeSettings, ...data }, { layout: ADM_LAYOUT })
  }

  // ============================================================
  // AUTH
  // ============================================================
  fastify.get('/login', async (req, reply) => {
    if (req.session?.admin) return reply.redirect('/admin')
    const csrfToken = genCsrf(req)
    return reply.view('admin/login.ejs', { title: 'เข้าสู่ระบบ Admin', error: null, csrfToken }, { layout: AUTH_LAYOUT })
  })

  fastify.post('/login', {
    config: { rateLimit: { max: 5, timeWindow: '5 minutes' } }
  }, async (req, reply) => {
    const { username = '', password = '' } = req.body || {}
    const fail = (msg) => {
      const csrfToken = genCsrf(req)
      return reply.view('admin/login.ejs', { title: 'เข้าสู่ระบบ Admin', error: msg, csrfToken }, { layout: AUTH_LAYOUT })
    }

    if (!username || !password) return await fail('กรุณากรอก Username และ Password')

    const [rows] = await db.query('SELECT * FROM admin_users WHERE username = ?', [username.trim()])
    if (!rows.length) return await fail('Username หรือ Password ไม่ถูกต้อง')

    const valid = await bcrypt.compare(password, rows[0].password_hash)
    if (!valid) return await fail('Username หรือ Password ไม่ถูกต้อง')

    await db.query('UPDATE admin_users SET last_login = NOW() WHERE id = ?', [rows[0].id])
    req.session.admin = {
      id: rows[0].id, username: rows[0].username,
      full_name: rows[0].full_name, role: rows[0].role,
      affiliate_id: rows[0].affiliate_id || null
    }
    return reply.redirect('/admin')
  })

  fastify.get('/logout', async (req, reply) => {
    await new Promise(resolve => req.session.destroy(resolve))
    return reply.redirect('/admin/login')
  })

  // ============================================================
  // DASHBOARD
  // ============================================================
  fastify.get('/', async (req, reply) => {
    const { extra, p: fp } = leadFilter(req.session.admin)
    const fWhere = extra ? `WHERE 1=1 ${extra}` : ''

    const [[totals]] = await db.query(`
      SELECT
        COUNT(*) AS total_leads,
        SUM(CASE WHEN DATE(created_at)=CURDATE() THEN 1 ELSE 0 END) AS today_leads,
        SUM(CASE WHEN MONTH(created_at)=MONTH(NOW()) AND YEAR(created_at)=YEAR(NOW()) THEN 1 ELSE 0 END) AS month_leads,
        SUM(clicked_line)     AS total_line_clicks,
        SUM(clicked_facebook) AS total_fb_clicks,
        SUM(CASE WHEN clicked_line=1 OR clicked_facebook=1 THEN 1 ELSE 0 END) AS total_clicked,
        SUM(CASE WHEN status='new'       THEN 1 ELSE 0 END) AS new_count,
        SUM(CASE WHEN status='contacted' THEN 1 ELSE 0 END) AS contacted_count,
        SUM(CASE WHEN status='converted' THEN 1 ELSE 0 END) AS converted_count,
        SUM(CASE WHEN funnel_stage='cold' THEN 1 ELSE 0 END) AS cold_count,
        SUM(CASE WHEN funnel_stage='warm' THEN 1 ELSE 0 END) AS warm_count,
        SUM(CASE WHEN funnel_stage='hot'  THEN 1 ELSE 0 END) AS hot_count
        ${req.session.admin.role === 'affiliate' ? `,
        SUM(CASE WHEN commission_amount IS NOT NULL AND commission_paid=0 THEN commission_amount ELSE 0 END) AS pending_commission,
        SUM(CASE WHEN commission_paid=1 THEN commission_amount ELSE 0 END) AS paid_commission` : ''}
      FROM leads ${fWhere}
    `, fp).catch(() => [[{
      total_leads:0, today_leads:0, month_leads:0,
      total_line_clicks:0, total_fb_clicks:0, total_clicked:0,
      new_count:0, contacted_count:0, converted_count:0,
      cold_count:0, warm_count:0, hot_count:0
    }]])

    const [typeBreakdown] = await db.query(
      `SELECT insurance_type, COUNT(*) AS cnt FROM leads ${fWhere} GROUP BY insurance_type ORDER BY cnt DESC`, fp
    ).catch(() => [[]])

    const [dailyStats] = await db.query(
      `SELECT DATE(created_at) AS day, COUNT(*) AS cnt
       FROM leads WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) ${extra}
       GROUP BY DATE(created_at) ORDER BY day ASC`, fp
    ).catch(() => [[]])

    const [topBrands] = await db.query(
      `SELECT COALESCE(NULLIF(brand,''), 'ไม่ระบุ') AS car_brand, COUNT(*) AS cnt
       FROM leads ${fWhere} GROUP BY COALESCE(NULLIF(brand,''), 'ไม่ระบุ') ORDER BY cnt DESC LIMIT 5`, fp
    ).catch(() => [[]])

    const [recentLeads] = await db.query(
      `SELECT id, token, brand, model, year, insurance_type, source,
              name, phone, best_price, clicked_line, clicked_facebook, status, created_at
       FROM leads ${fWhere} ORDER BY created_at DESC LIMIT 10`, fp
    ).catch(() => [[]])

    let affSlug = null
    if (req.session.admin.role === 'affiliate' && req.session.admin.affiliate_id) {
      const [[affRow]] = await db.query('SELECT slug FROM affiliates WHERE id=?', [req.session.admin.affiliate_id]).catch(() => [[null]])
      affSlug = affRow?.slug || null
    }

    const appUrl = process.env.APP_URL || 'https://ins.dapp3.net'

    return av(reply, 'dashboard.ejs', {
      title: 'Dashboard', activePage: 'dashboard', admin: req.session.admin,
      totals, typeBreakdown, dailyStats, topBrands, recentLeads,
      affSlug, appUrl
    })
  })

  // ============================================================
  // LEADS
  // ============================================================
  fastify.get('/leads', async (req, reply) => {
    const page   = Math.max(1, parseInt(req.query.page) || 1)
    const limit  = 20
    const offset = (page - 1) * limit
    const { q = '', status = '', source = '', funnel_stage = '', aff_filter = '', aff_id = '' } = req.query

    const { extra, p: fp } = leadFilter(req.session.admin)
    let where = `WHERE 1=1 ${extra}`; const p = [...fp]
    if (q)            { where += ' AND (l.name LIKE ? OR l.phone LIKE ? OR l.brand LIKE ? OR l.model LIKE ?)'; p.push(`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`) }
    if (status)       { where += ' AND l.status=?'; p.push(status) }
    if (source)       { where += ' AND l.source=?'; p.push(source) }
    if (funnel_stage) { where += ' AND l.funnel_stage=?'; p.push(funnel_stage) }
    if (aff_filter === 'direct')    { where += ' AND l.affiliate_id IS NULL' }
    if (aff_filter === 'affiliate') { where += ' AND l.affiliate_id IS NOT NULL' }
    if (aff_id)       { where += ' AND l.affiliate_id=?'; p.push(parseInt(aff_id)) }

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM leads l ${where}`, p
    ).catch(() => [[{ total: 0 }]])

    const [leads] = await db.query(
      `SELECT l.id, l.token, l.brand, l.model, l.year, l.province,
              l.insurance_type, l.funnel_stage, l.lead_type, l.source, l.utm_campaign,
              l.name, l.phone, l.best_price,
              l.clicked_line, l.clicked_facebook, l.status, l.created_at,
              l.commission_amount, l.commission_paid,
              a.slug AS aff_slug, a.name AS aff_name
       FROM leads l
       LEFT JOIN affiliates a ON a.id = l.affiliate_id
       ${where} ORDER BY l.created_at DESC LIMIT ? OFFSET ?`,
      [...p, limit, offset]
    ).catch(() => [[]])

    return av(reply, 'leads.ejs', {
      title: 'Leads ลูกค้า', activePage: 'leads', admin: req.session.admin,
      leads, total, page, totalPages: Math.ceil(total / limit),
      filters: { q, status, source, funnel_stage, aff_filter, aff_id }
    })
  })

  fastify.get('/leads/:id/detail', async (req, reply) => {
    const id = parseInt(req.params.id)
    if (!id) return reply.code(400).send({ error: 'invalid id' })
    const [[lead]] = await db.query(
      `SELECT id, brand, model, year, province, insurance_type, funnel_stage, lead_type,
              source, utm_campaign, utm_medium, utm_content,
              name, phone, best_price, clicked_line, clicked_facebook, status, note,
              visitor_id, ip_address, ip_country, ip_city, ip_isp, ip_mobile, ip_proxy,
              query_params, created_at
       FROM leads WHERE id = ?`, [id]
    )
    if (!lead) return reply.code(404).send({ error: 'not found' })
    return reply.send({ lead })
  })

  fastify.post('/leads/:id/note', async (req, reply) => {
    const { note } = req.body || {}
    if (note?.trim()) {
      await db.query('UPDATE leads SET note=? WHERE id=?', [note.trim().substring(0, 1000), req.params.id])
    }
    return reply.redirect('/admin/leads')
  })

  fastify.post('/leads/:id/status', async (req, reply) => {
    const { status } = req.body
    if (['new','contacted','converted','lost'].includes(status)) {
      await db.query('UPDATE leads SET status=?, updated_at=NOW() WHERE id=?', [status, req.params.id])
      if (status === 'converted') await calcCommission(req.params.id)
    }
    return reply.redirect('/admin/leads')
  })

  // ============================================================
  // SETTINGS
  // ============================================================
  fastify.get('/settings', async (req, reply) => {
    const admin = req.session.admin
    const isAffiliate = admin.role === 'affiliate'
    const affId = isAffiliate ? (admin.affiliate_id || 0) : 0

    // Global settings
    const [globalRows] = await db.query('SELECT `key`, `value` FROM app_settings WHERE affiliate_id = 0').catch(() => [[]])
    const settings = {}
    globalRows.forEach(r => { settings[r.key] = r.value })

    // Affiliate override (merge on top of global)
    if (isAffiliate && affId) {
      const [affRows] = await db.query('SELECT `key`, `value` FROM app_settings WHERE affiliate_id = ?', [affId]).catch(() => [[]])
      affRows.forEach(r => { settings[r.key] = r.value })
    }

    let affSlug = null
    if (isAffiliate && affId) {
      const [[affRow]] = await db.query('SELECT slug FROM affiliates WHERE id=?', [affId]).catch(() => [[null]])
      affSlug = affRow?.slug || null
    }
    const appUrl = process.env.APP_URL || 'https://ins.dapp3.net'

    return av(reply, 'settings.ejs', {
      title: isAffiliate ? 'ตั้งค่าของฉัน' : 'ตั้งค่าระบบ',
      activePage: 'settings', admin,
      settings, saved: req.query.saved === '1',
      affSlug, appUrl, slugError: req.query.slug_error || null
    })
  })

  fastify.post('/settings/slug', async (req, reply) => {
    const admin = req.session.admin
    if (admin.role !== 'affiliate' || !admin.affiliate_id) return reply.redirect('/admin')

    const { new_slug } = req.body || {}
    const cleaned = (new_slug || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
    if (!cleaned) return reply.redirect('/admin/settings?slug_error=invalid')

    const [exist] = await db.query('SELECT id FROM affiliates WHERE slug=? AND id!=?', [cleaned, admin.affiliate_id])
    if (exist.length) return reply.redirect('/admin/settings?slug_error=taken')

    await db.query('UPDATE affiliates SET slug=? WHERE id=?', [cleaned, admin.affiliate_id])
    // อัป cookie ที่ browser ด้วย
    reply.setCookie('aff_slug', cleaned, { path: '/', maxAge: 30 * 24 * 60 * 60, httpOnly: true, sameSite: 'lax' })
    return reply.redirect('/admin/settings?saved=1')
  })

  fastify.post('/settings', async (req, reply) => {
    const admin = req.session.admin
    const isAffiliate = admin.role === 'affiliate'
    if (!isAffiliate && admin.role !== 'superadmin') return reply.redirect('/admin')

    const affId = isAffiliate ? (admin.affiliate_id || 0) : 0

    const superKeys = ['site_phone','site_email','line_oa_url','facebook_url','line_admin_user_id',
                       'theme_sidebar_bg','theme_accent','theme_content_bg',
                       'commission_base','broker_fee_rate','gtm_head_code','gtm_body_code']
    const affKeys   = ['line_oa_url','facebook_url','site_phone','gtm_head_code','gtm_body_code']
    const keys = isAffiliate ? affKeys : superKeys

    for (const k of keys) {
      if (req.body[k] !== undefined) {
        await db.query(
          'INSERT INTO app_settings (`key`, `affiliate_id`, `value`) VALUES (?,?,?) ON DUPLICATE KEY UPDATE `value`=?',
          [k, affId, req.body[k], req.body[k]]
        )
      }
    }
    return reply.redirect('/admin/settings?saved=1')
  })

  // ============================================================
  // REPORTS
  // ============================================================
  fastify.get('/reports', async (req, reply) => {
    const [[funnel]] = await db.query(`
      SELECT
        COUNT(*) AS total_leads,
        SUM(clicked_line)     AS line_clicks,
        SUM(clicked_facebook) AS fb_clicks,
        SUM(CASE WHEN clicked_line=1 OR clicked_facebook=1 THEN 1 ELSE 0 END) AS total_clicks,
        SUM(CASE WHEN status='converted' THEN 1 ELSE 0 END) AS converted
      FROM leads
    `).catch(() => [[{ total_leads:0, line_clicks:0, fb_clicks:0, total_clicks:0, converted:0 }]])

    const [monthly] = await db.query(`
      SELECT DATE_FORMAT(created_at,'%Y-%m') AS month,
             DATE_FORMAT(created_at,'%b %Y') AS month_label,
             COUNT(*) AS leads,
             SUM(CASE WHEN clicked_line=1 OR clicked_facebook=1 THEN 1 ELSE 0 END) AS clicks,
             SUM(CASE WHEN status='converted' THEN 1 ELSE 0 END) AS converted
      FROM leads
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 11 MONTH)
      GROUP BY month, month_label ORDER BY month ASC
    `).catch(() => [[]])

    const [bySource] = await db.query(`
      SELECT source, COUNT(*) AS cnt,
             SUM(CASE WHEN clicked_line=1 OR clicked_facebook=1 THEN 1 ELSE 0 END) AS clicks,
             SUM(CASE WHEN status='converted' THEN 1 ELSE 0 END) AS converted
      FROM leads GROUP BY source ORDER BY cnt DESC
    `).catch(() => [[]])

    const [byType] = await db.query(`
      SELECT insurance_type, COUNT(*) AS cnt,
             SUM(CASE WHEN clicked_line=1 OR clicked_facebook=1 THEN 1 ELSE 0 END) AS clicks
      FROM leads GROUP BY insurance_type ORDER BY cnt DESC
    `).catch(() => [[]])

    const [topBrands] = await db.query(`
      SELECT brand, COUNT(*) AS cnt,
             SUM(CASE WHEN clicked_line=1 OR clicked_facebook=1 THEN 1 ELSE 0 END) AS clicks
      FROM leads GROUP BY brand ORDER BY cnt DESC LIMIT 8
    `).catch(() => [[]])

    const [daily] = await db.query(`
      SELECT DATE(created_at) AS day,
             DATE_FORMAT(created_at,'%d/%m') AS day_label,
             COUNT(*) AS leads,
             SUM(CASE WHEN clicked_line=1 OR clicked_facebook=1 THEN 1 ELSE 0 END) AS clicks
      FROM leads
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
      GROUP BY DATE(created_at) ORDER BY day ASC
    `).catch(() => [[]])

    const [recentLeads] = await db.query(`
      SELECT id, brand, model, year, insurance_type, source, name, phone,
             best_price, clicked_line, clicked_facebook, status, created_at
      FROM leads ORDER BY created_at DESC LIMIT 10
    `).catch(() => [[]])

    return av(reply, 'reports.ejs', {
      title: 'รายงาน', activePage: 'reports', admin: req.session.admin,
      funnel, monthly, bySource, byType, topBrands, daily, recentLeads
    })
  })

  // ============================================================
  // LINE SESSIONS
  // ============================================================
  fastify.get('/line', async (req, reply) => {
    const [sessions] = await db.query(
      'SELECT * FROM line_sessions ORDER BY state DESC, updated_at DESC'
    ).catch(() => [[]])
    return av(reply, 'line_sessions.ejs', {
      title: 'LINE Chat', activePage: 'line', admin: req.session.admin, sessions
    })
  })

  // GET messages for a user
  fastify.get('/line/messages', async (req, reply) => {
    const { userId } = req.query
    if (!userId) return reply.send([])
    const [msgs] = await db.query(
      'SELECT * FROM line_messages WHERE line_user_id = ? ORDER BY created_at ASC LIMIT 100',
      [userId]
    ).catch(() => [[]])
    return reply.send(msgs)
  })

  // POST send message to user (push)
  fastify.post('/line/send', async (req, reply) => {
    const { userId, message } = req.body || {}
    if (!userId || !message) return reply.send({ ok: false })

    const { pushMessage, textMsg } = require('../services/lineBot')
    await pushMessage(userId, [textMsg(message)])

    const adminName = req.session.admin?.username || 'admin'
    await db.query(
      'INSERT INTO line_messages (line_user_id, direction, message, sent_by) VALUES (?, "out", ?, ?)',
      [userId, message, `admin:${adminName}`]
    ).catch(() => {})

    await db.query(
      'UPDATE line_sessions SET last_message = ?, updated_at = NOW() WHERE line_user_id = ?',
      [message, userId]
    ).catch(() => {})

    return reply.send({ ok: true })
  })

  // POST set state (handoff / bot)
  fastify.post('/line/state', async (req, reply) => {
    const { userId, state } = req.body || {}
    if (!userId || !['human_first','bot','handoff'].includes(state)) return reply.send({ ok: false })
    await db.query(
      'UPDATE line_sessions SET state = ?, handoff_at = ? WHERE line_user_id = ?',
      [state, state === 'handoff' ? new Date() : null, userId]
    ).catch(() => {})
    return reply.send({ ok: true })
  })

  // ============================================================
  // NOTIFICATIONS API (badge)
  // ============================================================
  fastify.get('/api/notifications', async (req, reply) => {
    const [[leadCount]] = await db.query(
      "SELECT COUNT(*) AS cnt FROM notifications WHERE type='new_lead' AND is_read=0"
    ).catch(() => [[{ cnt: 0 }]])
    const [[lineCount]] = await db.query(
      "SELECT COUNT(*) AS cnt FROM notifications WHERE type='new_line_message' AND is_read=0"
    ).catch(() => [[{ cnt: 0 }]])
    return reply.send({ leads: leadCount.cnt, line: lineCount.cnt })
  })

  fastify.post('/api/notifications/read', async (req, reply) => {
    const { type } = req.body || {}
    if (type) {
      await db.query("UPDATE notifications SET is_read=1 WHERE type=?", [type]).catch(() => {})
    }
    return reply.send({ ok: true })
  })

  // ============================================================
  // ADMIN MANAGEMENT (multi-admin)
  // ============================================================
  fastify.get('/admins', async (req, reply) => {
    // superadmin only
    if (req.session.admin?.role !== 'superadmin') return reply.redirect('/admin')
    const [admins] = await db.query(`
      SELECT au.id, au.username, au.full_name, au.role, au.last_login, au.created_at,
             a.slug AS aff_slug, a.name AS aff_name
      FROM admin_users au
      LEFT JOIN affiliates a ON a.id = au.affiliate_id
      ORDER BY au.created_at DESC
    `)
    const [affiliates] = await db.query('SELECT id, slug, name FROM affiliates WHERE is_active=1 ORDER BY name').catch(() => [[]])
    return av(reply, 'admins.ejs', {
      title: 'จัดการผู้ดูแลระบบ', activePage: 'admins', admin: req.session.admin,
      admins, affiliates, msg: req.query.msg || '', error: req.query.error || ''
    })
  })

  fastify.post('/admins/add', async (req, reply) => {
    if (req.session.admin?.role !== 'superadmin') return reply.redirect('/admin')
    const { username, password, full_name, role } = req.body || {}
    if (!username?.trim() || !password || password.length < 6) {
      return reply.redirect('/admin/admins?error=invalid_input')
    }
    const [exist] = await db.query('SELECT id FROM admin_users WHERE username=?', [username.trim()])
    if (exist.length) return reply.redirect('/admin/admins?error=username_taken')
    const hash      = await bcrypt.hash(password, 10)
    const cleanRole = ['superadmin','agent','affiliate'].includes(role) ? role : 'agent'
    const affId     = (cleanRole === 'affiliate' && req.body.affiliate_id) ? parseInt(req.body.affiliate_id) : null
    await db.query(
      'INSERT INTO admin_users (username, password_hash, full_name, role, affiliate_id) VALUES (?,?,?,?,?)',
      [username.trim(), hash, full_name?.trim() || username.trim(), cleanRole, affId]
    )
    await audit.log(req.session.admin?.username, 'add_admin', 'admin_user', null, `เพิ่ม admin: ${username.trim()}`, req.ip)
    return reply.redirect('/admin/admins?msg=added')
  })

  fastify.post('/admins/:id/delete', async (req, reply) => {
    if (req.session.admin?.role !== 'superadmin') return reply.redirect('/admin')
    if (String(req.params.id) === String(req.session.admin?.id)) {
      return reply.redirect('/admin/admins?error=cannot_delete_self')
    }
    const [[a]] = await db.query('SELECT username FROM admin_users WHERE id=?', [req.params.id])
    await db.query('DELETE FROM admin_users WHERE id=?', [req.params.id])
    await audit.log(req.session.admin?.username, 'delete_admin', 'admin_user', req.params.id, `ลบ admin: ${a?.username}`, req.ip)
    return reply.redirect('/admin/admins?msg=deleted')
  })

  fastify.post('/admins/:id/reset-password', async (req, reply) => {
    if (req.session.admin?.role !== 'superadmin') return reply.redirect('/admin')
    const { new_password } = req.body || {}
    if (!new_password || new_password.length < 6) return reply.redirect(`/admin/admins?error=password_too_short`)
    const hash = await bcrypt.hash(new_password, 10)
    await db.query('UPDATE admin_users SET password_hash=? WHERE id=?', [hash, req.params.id])
    await audit.log(req.session.admin?.username, 'reset_password', 'admin_user', req.params.id, 'รีเซ็ตรหัสผ่าน', req.ip)
    return reply.redirect('/admin/admins?msg=password_reset')
  })

  // ============================================================
  // AFFILIATES
  // ============================================================
  fastify.get('/affiliates', async (req, reply) => {
    if (req.session.admin?.role !== 'superadmin') return reply.redirect('/admin')
    const [affiliates] = await db.query(`
      SELECT a.*,
        COUNT(l.id) AS total_leads,
        SUM(CASE WHEN l.status='converted' THEN 1 ELSE 0 END) AS converted_leads,
        SUM(CASE WHEN l.commission_paid=0 AND l.commission_amount IS NOT NULL THEN l.commission_amount ELSE 0 END) AS pending_commission,
        SUM(CASE WHEN l.commission_paid=1 THEN l.commission_amount ELSE 0 END) AS paid_commission,
        au.username AS admin_username
      FROM affiliates a
      LEFT JOIN leads l ON l.affiliate_id = a.id
      LEFT JOIN admin_users au ON au.affiliate_id = a.id AND au.role='affiliate'
      GROUP BY a.id
      ORDER BY a.created_at DESC
    `).catch(() => [[]])
    return av(reply, 'affiliates.ejs', {
      title: 'จัดการ Affiliates', activePage: 'affiliates', admin: req.session.admin,
      affiliates, msg: req.query.msg || '', error: req.query.error || ''
    })
  })

  fastify.post('/affiliates/add', async (req, reply) => {
    if (req.session.admin?.role !== 'superadmin') return reply.redirect('/admin')
    const { slug, name, phone, commission_rate } = req.body || {}
    if (!slug?.trim() || !name?.trim()) return reply.redirect('/admin/affiliates?error=invalid_input')
    const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
    if (!cleanSlug) return reply.redirect('/admin/affiliates?error=invalid_slug')
    const [exist] = await db.query('SELECT id FROM affiliates WHERE slug=?', [cleanSlug])
    if (exist.length) return reply.redirect('/admin/affiliates?error=slug_taken')
    const rate = Math.min(100, Math.max(0, parseFloat(commission_rate) || 0))
    await db.query(
      'INSERT INTO affiliates (slug, name, phone, commission_rate) VALUES (?,?,?,?)',
      [cleanSlug, name.trim(), phone?.trim() || null, rate]
    )
    await audit.log(req.session.admin?.username, 'add_affiliate', 'affiliates', null, `เพิ่ม affiliate: ${cleanSlug}`, req.ip)
    return reply.redirect('/admin/affiliates?msg=added')
  })

  fastify.post('/affiliates/:id/edit', async (req, reply) => {
    if (req.session.admin?.role !== 'superadmin') return reply.redirect('/admin')
    const { name, phone, commission_rate } = req.body || {}
    const rate = Math.min(100, Math.max(0, parseFloat(commission_rate) || 0))
    await db.query(
      'UPDATE affiliates SET name=?, phone=?, commission_rate=? WHERE id=?',
      [name?.trim() || 'ไม่ระบุ', phone?.trim() || null, rate, req.params.id]
    )
    return reply.redirect('/admin/affiliates?msg=updated')
  })

  fastify.post('/affiliates/:id/toggle', async (req, reply) => {
    if (req.session.admin?.role !== 'superadmin') return reply.redirect('/admin')
    await db.query('UPDATE affiliates SET is_active = 1 - is_active WHERE id=?', [req.params.id])
    return reply.redirect('/admin/affiliates?msg=updated')
  })

  fastify.post('/affiliates/:id/pay-all', async (req, reply) => {
    if (req.session.admin?.role !== 'superadmin') return reply.redirect('/admin')
    await db.query(
      'UPDATE leads SET commission_paid=1, commission_paid_at=NOW() WHERE affiliate_id=? AND commission_amount IS NOT NULL AND commission_paid=0',
      [req.params.id]
    )
    await audit.log(req.session.admin?.username, 'pay_commission', 'affiliates', req.params.id, 'Mark paid all commission', req.ip)
    return reply.redirect('/admin/affiliates?msg=paid')
  })

  fastify.post('/affiliates/:id/pay-lead/:leadId', async (req, reply) => {
    if (req.session.admin?.role !== 'superadmin') return reply.code(403).send({ error: 'forbidden' })
    const affId  = parseInt(req.params.id)
    const leadId = parseInt(req.params.leadId)
    await db.query(
      'UPDATE leads SET commission_paid=1, commission_paid_at=NOW() WHERE id=? AND affiliate_id=? AND commission_paid=0',
      [leadId, affId]
    )
    await audit.log(req.session.admin?.username, 'pay_commission_lead', 'leads', leadId, `Mark paid lead #${leadId}`, req.ip)
    return reply.send({ ok: true })
  })

  fastify.get('/api/affiliates/:id/commission', async (req, reply) => {
    if (req.session.admin?.role !== 'superadmin') return reply.code(403).send({ error: 'forbidden' })
    const [rows] = await db.query(
      `SELECT l.id, l.name, l.phone, l.brand, l.model, l.year, l.insurance_type,
              l.best_price, l.commission_amount, l.commission_paid, l.commission_paid_at, l.status, l.created_at
       FROM leads l
       WHERE l.affiliate_id=? AND l.commission_amount IS NOT NULL
       ORDER BY l.commission_paid ASC, l.created_at DESC`,
      [req.params.id]
    ).catch(() => [[]])
    return reply.send(rows)
  })

  // ============================================================
  // AUDIT LOG
  // ============================================================
  fastify.get('/audit', async (req, reply) => {
    if (req.session.admin?.role !== 'superadmin') return reply.redirect('/admin')
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = 50
    const offset = (page - 1) * limit
    const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM audit_logs').catch(() => [[{ total: 0 }]])
    const [logs] = await db.query(
      'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    ).catch(() => [[]])
    return av(reply, 'audit.ejs', {
      title: 'Audit Log', activePage: 'admins', admin: req.session.admin,
      logs, total, page, totalPages: Math.ceil(total / limit)
    })
  })
}

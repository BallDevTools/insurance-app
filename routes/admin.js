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

function formatNumber(n) {
  return Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 0 })
}

const TYPE_MAP   = { class1: 'ชั้น 1', class2plus: 'ชั้น 2+', class3plus: 'ชั้น 3+' }
const STATUS_MAP = { pending: 'รอติดต่อ', contacted: 'ติดต่อแล้ว', completed: 'สำเร็จ', cancelled: 'ยกเลิก' }
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
  })

  // helper: render admin view (includes csrfToken automatically)
  const av = (reply, tpl, data = {}) => {
    const csrfToken = genCsrf(reply.request)
    return reply.view(`admin/${tpl}`, { formatNumber, TYPE_MAP, STATUS_MAP, LEAD_STATUS_MAP, SOURCE_MAP, INSURANCE_TYPES, csrfToken, ...data }, { layout: ADM_LAYOUT })
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
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } }
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
    req.session.admin = { id: rows[0].id, username: rows[0].username, full_name: rows[0].full_name, role: rows[0].role }
    return reply.redirect('/admin')
  })

  fastify.get('/logout', async (req, reply) => {
    req.session.destroy()
    return reply.redirect('/admin/login')
  })

  // ============================================================
  // DASHBOARD
  // ============================================================
  fastify.get('/', async (req, reply) => {
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
        SUM(CASE WHEN status='converted' THEN 1 ELSE 0 END) AS converted_count
      FROM leads
    `).catch(() => [[{
      total_leads:0, today_leads:0, month_leads:0,
      total_line_clicks:0, total_fb_clicks:0, total_clicked:0,
      new_count:0, contacted_count:0, converted_count:0
    }]])

    const [typeBreakdown] = await db.query(
      `SELECT insurance_type, COUNT(*) AS cnt FROM leads GROUP BY insurance_type ORDER BY cnt DESC`
    ).catch(() => [[]])

    const [dailyStats] = await db.query(
      `SELECT DATE(created_at) AS day, COUNT(*) AS cnt
       FROM leads WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
       GROUP BY DATE(created_at) ORDER BY day ASC`
    ).catch(() => [[]])

    const [topProvinces] = await db.query(
      `SELECT province, COUNT(*) AS cnt FROM leads GROUP BY province ORDER BY cnt DESC LIMIT 5`
    ).catch(() => [[]])

    const [topBrands] = await db.query(
      `SELECT brand AS car_brand, COUNT(*) AS cnt FROM leads GROUP BY brand ORDER BY cnt DESC LIMIT 5`
    ).catch(() => [[]])

    const [recentLeads] = await db.query(
      `SELECT id, token, brand, model, year, insurance_type, source,
              name, phone, best_price, clicked_line, clicked_facebook, status, created_at
       FROM leads ORDER BY created_at DESC LIMIT 10`
    ).catch(() => [[]])

    return av(reply, 'dashboard.ejs', {
      title: 'Dashboard', activePage: 'dashboard', admin: req.session.admin,
      totals, typeBreakdown, dailyStats, topProvinces, topBrands, recentLeads
    })
  })

  // ============================================================
  // QUOTES
  // ============================================================
  fastify.get('/quotes', async (req, reply) => {
    const page   = Math.max(1, parseInt(req.query.page) || 1)
    const limit  = 20
    const offset = (page - 1) * limit
    const { q = '', type = '', status = '', from = '', to = '' } = req.query

    let where = 'WHERE 1=1'; const p = []
    if (q)      { where += ' AND (q.quote_number LIKE ? OR q.license_plate LIKE ? OR q.car_brand LIKE ? OR q.car_model LIKE ?)'; p.push(`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`) }
    if (type)   { where += ' AND q.insurance_type=?'; p.push(type) }
    if (status) { where += ' AND q.status=?'; p.push(status) }
    if (from)   { where += ' AND DATE(q.created_at)>=?'; p.push(from) }
    if (to)     { where += ' AND DATE(q.created_at)<=?'; p.push(to) }

    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM quotes q ${where}`, p)
    const [quotes] = await db.query(
      `SELECT q.*, cl.full_name, cl.phone FROM quotes q
       LEFT JOIN customer_leads cl ON cl.quote_id=q.id
       ${where} ORDER BY q.created_at DESC LIMIT ? OFFSET ?`,
      [...p, limit, offset]
    )

    return av(reply, 'quotes.ejs', {
      title: 'ใบเสนอราคา', activePage: 'quotes', admin: req.session.admin,
      quotes, total, page, totalPages: Math.ceil(total / limit),
      filters: { q, type, status, from, to }
    })
  })

  // Export CSV
  fastify.get('/quotes/export', async (req, reply) => {
    const { q = '', type = '', status = '', from = '', to = '' } = req.query
    let where = 'WHERE 1=1'; const p = []
    if (q)      { where += ' AND (q.quote_number LIKE ? OR q.license_plate LIKE ? OR q.car_brand LIKE ? OR q.car_model LIKE ?)'; p.push(`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`) }
    if (type)   { where += ' AND q.insurance_type=?'; p.push(type) }
    if (status) { where += ' AND q.status=?'; p.push(status) }
    if (from)   { where += ' AND DATE(q.created_at)>=?'; p.push(from) }
    if (to)     { where += ' AND DATE(q.created_at)<=?'; p.push(to) }

    const [rows] = await db.query(
      `SELECT q.quote_number, q.car_brand, q.car_model, q.car_year, q.license_plate,
              q.province, q.insurance_type, q.car_value, q.premium_amount, q.status, q.created_at,
              cl.full_name, cl.phone, cl.email
       FROM quotes q LEFT JOIN customer_leads cl ON cl.quote_id=q.id ${where} ORDER BY q.created_at DESC`, p
    )

    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = [
      ['เลขที่','ยี่ห้อ','รุ่น','ปี','ทะเบียน','จังหวัด','ประกัน','มูลค่ารถ','เบี้ยรวม','สถานะ','ชื่อลูกค้า','เบอร์','อีเมล','วันที่'],
      ...rows.map(r => [
        r.quote_number, r.car_brand, r.car_model, r.car_year, r.license_plate,
        r.province, TYPE_MAP[r.insurance_type]||r.insurance_type, r.car_value, r.premium_amount,
        STATUS_MAP[r.status]||r.status, r.full_name||'', r.phone||'', r.email||'',
        new Date(r.created_at).toLocaleDateString('th-TH')
      ])
    ].map(row => row.map(esc).join(',')).join('\r\n')

    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', `attachment; filename="quotes_${Date.now()}.csv"`)
    return reply.send('\uFEFF' + csv)
  })

  // Quote Detail
  fastify.get('/quotes/:id', async (req, reply) => {
    const [rows] = await db.query('SELECT * FROM quotes WHERE id=?', [req.params.id])
    if (!rows.length) return reply.redirect('/admin/quotes')
    const quote = rows[0]
    const [leads] = await db.query('SELECT * FROM customer_leads WHERE quote_id=?', [quote.id])
    const lead = leads[0] || null
    let notes = []
    if (lead) {
      const [nr] = await db.query('SELECT * FROM lead_notes WHERE lead_id=? ORDER BY created_at DESC', [lead.id])
      notes = nr
    }
    return av(reply, 'quote_detail.ejs', {
      title: `ใบเสนอราคา ${quote.quote_number}`, activePage: 'quotes', admin: req.session.admin,
      quote, lead, notes, insuranceConfig: INSURANCE_TYPES[quote.insurance_type]
    })
  })

  // PDF download for admin
  fastify.get('/quotes/:id/pdf', async (req, reply) => {
    const [rows] = await db.query(
      `SELECT q.*, cl.full_name, cl.phone, cl.email FROM quotes q
       LEFT JOIN customer_leads cl ON cl.quote_id = q.id
       WHERE q.id = ?`,
      [req.params.id]
    )
    if (!rows.length) return reply.redirect('/admin/quotes')
    const quote = rows[0]
    const lead = quote.full_name ? { full_name: quote.full_name, phone: quote.phone, email: quote.email } : null
    const { INSURANCE_TYPES } = require('../calculator')
    const { generateQuotePDF } = require('../services/pdfService')
    const buf = await generateQuotePDF(quote, lead, INSURANCE_TYPES[quote.insurance_type])
    reply.header('Content-Type', 'application/pdf')
    reply.header('Content-Disposition', `attachment; filename="quote_${quote.quote_number}.pdf"`)
    return reply.send(buf)
  })

  fastify.post('/quotes/:id/status', async (req, reply) => {
    const { status } = req.body
    if (['pending','contacted','completed','cancelled'].includes(status)) {
      await db.query('UPDATE quotes SET status=? WHERE id=?', [status, req.params.id])
      await audit.log(req.session.admin?.username, 'update_quote_status', 'quote', req.params.id, `สถานะ → ${status}`, req.ip)
    }
    return reply.redirect(`/admin/quotes/${req.params.id}`)
  })

  // ============================================================
  // LEADS
  // ============================================================
  fastify.get('/leads', async (req, reply) => {
    const page   = Math.max(1, parseInt(req.query.page) || 1)
    const limit  = 20
    const offset = (page - 1) * limit
    const { q = '', status = '', source = '' } = req.query

    let where = 'WHERE 1=1'; const p = []
    if (q)      { where += ' AND (name LIKE ? OR phone LIKE ? OR brand LIKE ? OR model LIKE ? OR license_plate LIKE ?)'; p.push(`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`) }
    if (status) { where += ' AND status=?'; p.push(status) }
    if (source) { where += ' AND source=?'; p.push(source) }

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM leads ${where}`, p
    ).catch(() => [[{ total: 0 }]])

    const [leads] = await db.query(
      `SELECT id, token, brand, model, year, license_plate, province,
              insurance_type, source, utm_campaign,
              name, phone, best_price,
              clicked_line, clicked_facebook, status, created_at
       FROM leads ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...p, limit, offset]
    ).catch(() => [[]])

    return av(reply, 'leads.ejs', {
      title: 'Leads ลูกค้า', activePage: 'leads', admin: req.session.admin,
      leads, total, page, totalPages: Math.ceil(total / limit),
      filters: { q, status, source }
    })
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
    }
    return reply.redirect('/admin/leads')
  })

  // ============================================================
  // PROVINCES
  // ============================================================
  fastify.get('/provinces', async (req, reply) => {
    const [provinces] = await db.query('SELECT * FROM provinces ORDER BY name')
    const msgs = { added:'เพิ่มจังหวัดสำเร็จ', updated:'แก้ไขสำเร็จ', deleted:'ลบสำเร็จ' }
    return av(reply, 'provinces.ejs', {
      title: 'จัดการจังหวัด', activePage: 'provinces', admin: req.session.admin,
      provinces, msg: msgs[req.query.msg] || ''
    })
  })

  fastify.post('/provinces/add', async (req, reply) => {
    const { name, risk_factor } = req.body || {}
    if (name?.trim()) await db.query('INSERT INTO provinces (name, risk_factor) VALUES (?,?)', [name.trim(), parseFloat(risk_factor)||1.0])
    return reply.redirect('/admin/provinces?msg=added')
  })

  fastify.post('/provinces/:id/edit', async (req, reply) => {
    const { name, risk_factor } = req.body || {}
    await db.query('UPDATE provinces SET name=?, risk_factor=? WHERE id=?', [name.trim(), parseFloat(risk_factor), req.params.id])
    return reply.redirect('/admin/provinces?msg=updated')
  })

  fastify.post('/provinces/:id/delete', async (req, reply) => {
    await db.query('DELETE FROM provinces WHERE id=?', [req.params.id])
    return reply.redirect('/admin/provinces?msg=deleted')
  })

  // ============================================================
  // SETTINGS
  // ============================================================
  fastify.get('/settings', async (req, reply) => {
    const [rows] = await db.query('SELECT * FROM app_settings')
    const settings = {}
    rows.forEach(r => { settings[r.key] = r.value })
    return av(reply, 'settings.ejs', {
      title: 'ตั้งค่าระบบ', activePage: 'settings', admin: req.session.admin,
      settings, saved: req.query.saved === '1'
    })
  })

  fastify.post('/settings', async (req, reply) => {
    const keys = ['class1_rate','class1_min','class2plus_rate','class2plus_min','class3plus_rate','class3plus_min',
                   'site_phone','site_email','line_oa_url','facebook_url','line_admin_user_id']
    for (const k of keys) {
      if (req.body[k] !== undefined) {
        await db.query(
          'INSERT INTO app_settings (`key`,`value`) VALUES (?,?) ON DUPLICATE KEY UPDATE `value`=?',
          [k, req.body[k], req.body[k]]
        )
      }
    }
    return reply.redirect('/admin/settings?saved=1')
  })

  // ============================================================
  // REPORTS
  // ============================================================
  fastify.get('/reports', async (req, reply) => {
    const [monthly] = await db.query(`
      SELECT DATE_FORMAT(created_at,'%Y-%m') AS month,
             DATE_FORMAT(created_at,'%b %Y') AS month_label,
             COUNT(*) AS quotes, COALESCE(SUM(premium_amount),0) AS revenue,
             SUM(CASE WHEN status IN ('contacted','completed') THEN 1 ELSE 0 END) AS leads,
             SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed
      FROM quotes
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 11 MONTH)
      GROUP BY month, month_label ORDER BY month ASC
    `)
    const [[funnel]] = await db.query(`
      SELECT COUNT(*) AS total_quotes,
             SUM(CASE WHEN status!='pending' THEN 1 ELSE 0 END) AS total_contacted,
             SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS total_completed
      FROM quotes
    `)
    const [revenueByType] = await db.query(`
      SELECT insurance_type, COUNT(*) AS cnt, COALESCE(SUM(premium_amount),0) AS revenue
      FROM quotes GROUP BY insurance_type ORDER BY revenue DESC
    `)
    const [topQuotes] = await db.query(`
      SELECT q.*, cl.full_name FROM quotes q
      LEFT JOIN customer_leads cl ON cl.quote_id=q.id
      ORDER BY q.premium_amount DESC LIMIT 10
    `)

    return av(reply, 'reports.ejs', {
      title: 'รายงาน', activePage: 'reports', admin: req.session.admin,
      monthly, funnel, revenueByType, topQuotes
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
    const [admins] = await db.query('SELECT id, username, full_name, role, last_login, created_at FROM admin_users ORDER BY created_at DESC')
    return av(reply, 'admins.ejs', {
      title: 'จัดการผู้ดูแลระบบ', activePage: 'admins', admin: req.session.admin,
      admins, msg: req.query.msg || '', error: req.query.error || ''
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
    const hash = await bcrypt.hash(password, 10)
    await db.query(
      'INSERT INTO admin_users (username, password_hash, full_name, role) VALUES (?,?,?,?)',
      [username.trim(), hash, full_name?.trim() || username.trim(), ['superadmin','agent'].includes(role) ? role : 'agent']
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

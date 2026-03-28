'use strict'

const db = require('../db')
const bcrypt = require('bcryptjs')
const { INSURANCE_TYPES } = require('../calculator')

const ADM_LAYOUT = 'admin_layout.ejs'
const AUTH_LAYOUT = 'auth_layout.ejs'

function formatNumber(n) {
  return Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 0 })
}

const TYPE_MAP = { class1: 'ชั้น 1', class2plus: 'ชั้น 2+', class3plus: 'ชั้น 3+' }
const STATUS_MAP = { pending: 'รอติดต่อ', contacted: 'ติดต่อแล้ว', completed: 'สำเร็จ', cancelled: 'ยกเลิก' }

module.exports = async function adminPlugin(fastify, opts) {

  // ---- Auth Guard ----
  fastify.addHook('preHandler', async (req, reply) => {
    if (req.url.startsWith('/admin/login')) return
    if (!req.session?.admin) return reply.redirect('/admin/login')
  })

  // helper: render admin view
  const av = (reply, tpl, data = {}) =>
    reply.view(`admin/${tpl}`, { formatNumber, TYPE_MAP, STATUS_MAP, INSURANCE_TYPES, ...data }, { layout: ADM_LAYOUT })

  // ============================================================
  // AUTH
  // ============================================================
  fastify.get('/login', async (req, reply) => {
    if (req.session?.admin) return reply.redirect('/admin')
    return reply.view('admin/login.ejs', { title: 'เข้าสู่ระบบ Admin', error: null }, { layout: AUTH_LAYOUT })
  })

  fastify.post('/login', async (req, reply) => {
    const { username = '', password = '' } = req.body || {}
    const fail = (msg) => reply.view('admin/login.ejs', { title: 'เข้าสู่ระบบ Admin', error: msg }, { layout: AUTH_LAYOUT })

    if (!username || !password) return fail('กรุณากรอก Username และ Password')

    const [rows] = await db.query('SELECT * FROM admin_users WHERE username = ?', [username.trim()])
    if (!rows.length) return fail('Username หรือ Password ไม่ถูกต้อง')

    const valid = await bcrypt.compare(password, rows[0].password_hash)
    if (!valid) return fail('Username หรือ Password ไม่ถูกต้อง')

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
        COUNT(*) AS total_quotes,
        COALESCE(SUM(premium_amount),0) AS total_premium,
        SUM(CASE WHEN DATE(created_at)=CURDATE() THEN 1 ELSE 0 END) AS today_quotes,
        COALESCE(SUM(CASE WHEN DATE(created_at)=CURDATE() THEN premium_amount ELSE 0 END),0) AS today_premium,
        SUM(CASE WHEN MONTH(created_at)=MONTH(NOW()) AND YEAR(created_at)=YEAR(NOW()) THEN 1 ELSE 0 END) AS month_quotes,
        COALESCE(SUM(CASE WHEN MONTH(created_at)=MONTH(NOW()) AND YEAR(created_at)=YEAR(NOW()) THEN premium_amount ELSE 0 END),0) AS month_premium,
        SUM(CASE WHEN status='contacted' THEN 1 ELSE 0 END) AS contacted_count,
        SUM(CASE WHEN status='pending'   THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed_count
      FROM quotes
    `)
    const [typeBreakdown] = await db.query(
      `SELECT insurance_type, COUNT(*) AS cnt, COALESCE(SUM(premium_amount),0) AS total
       FROM quotes GROUP BY insurance_type ORDER BY cnt DESC`
    )
    const [dailyStats] = await db.query(
      `SELECT DATE(created_at) AS day, COUNT(*) AS cnt, COALESCE(SUM(premium_amount),0) AS total
       FROM quotes WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
       GROUP BY DATE(created_at) ORDER BY day ASC`
    )
    const [topProvinces] = await db.query(
      `SELECT province, COUNT(*) AS cnt FROM quotes GROUP BY province ORDER BY cnt DESC LIMIT 5`
    )
    const [topBrands] = await db.query(
      `SELECT car_brand, COUNT(*) AS cnt FROM quotes GROUP BY car_brand ORDER BY cnt DESC LIMIT 5`
    )
    const [recentLeads] = await db.query(
      `SELECT cl.id, cl.full_name, cl.phone, cl.email, cl.preferred_contact, cl.created_at,
              q.id AS quote_id, q.quote_number, q.car_brand, q.car_model,
              q.car_year, q.insurance_type, q.premium_amount, q.status, q.province
       FROM customer_leads cl
       JOIN quotes q ON q.id = cl.quote_id
       ORDER BY cl.created_at DESC LIMIT 10`
    )

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

  fastify.post('/quotes/:id/status', async (req, reply) => {
    const { status } = req.body
    if (['pending','contacted','completed','cancelled'].includes(status)) {
      await db.query('UPDATE quotes SET status=? WHERE id=?', [status, req.params.id])
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
    const { q = '', status = '', contact = '' } = req.query

    let where = 'WHERE 1=1'; const p = []
    if (q)       { where += ' AND (cl.full_name LIKE ? OR cl.phone LIKE ? OR q.quote_number LIKE ?)'; p.push(`%${q}%`,`%${q}%`,`%${q}%`) }
    if (status)  { where += ' AND q.status=?'; p.push(status) }
    if (contact) { where += ' AND cl.preferred_contact=?'; p.push(contact) }

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM customer_leads cl JOIN quotes q ON q.id=cl.quote_id ${where}`, p
    )
    const [leads] = await db.query(
      `SELECT cl.*, q.id AS quote_id, q.quote_number, q.car_brand, q.car_model, q.car_year,
              q.insurance_type, q.premium_amount, q.status, q.province
       FROM customer_leads cl JOIN quotes q ON q.id=cl.quote_id
       ${where} ORDER BY cl.created_at DESC LIMIT ? OFFSET ?`,
      [...p, limit, offset]
    )

    return av(reply, 'leads.ejs', {
      title: 'Leads ลูกค้า', activePage: 'leads', admin: req.session.admin,
      leads, total, page, totalPages: Math.ceil(total / limit),
      filters: { q, status, contact }
    })
  })

  fastify.post('/leads/:id/note', async (req, reply) => {
    const { note } = req.body || {}
    if (note?.trim()) {
      await db.query(
        'INSERT INTO lead_notes (lead_id, note, created_by) VALUES (?,?,?)',
        [req.params.id, note.trim(), req.session.admin.username]
      )
    }
    const [rows] = await db.query('SELECT quote_id FROM customer_leads WHERE id=?', [req.params.id])
    return reply.redirect(rows.length ? `/admin/quotes/${rows[0].quote_id}` : '/admin/leads')
  })

  fastify.post('/leads/:id/status', async (req, reply) => {
    const { status } = req.body
    if (['pending','contacted','completed','cancelled'].includes(status)) {
      const [r] = await db.query('SELECT quote_id FROM customer_leads WHERE id=?', [req.params.id])
      if (r.length) await db.query('UPDATE quotes SET status=? WHERE id=?', [status, r[0].quote_id])
    }
    return reply.redirect('/admin/leads')
  })

  // ============================================================
  // CARS
  // ============================================================
  fastify.get('/cars', async (req, reply) => {
    const [brands] = await db.query('SELECT * FROM car_brands ORDER BY name')
    const [models] = await db.query(
      `SELECT m.*, b.name AS brand_name FROM car_models m
       JOIN car_brands b ON b.id=m.brand_id ORDER BY b.name, m.name`
    )
    const msgs = { brand_added:'เพิ่มยี่ห้อสำเร็จ', brand_deleted:'ลบยี่ห้อสำเร็จ',
                   brand_has_models:'ไม่สามารถลบได้ มียี่ห้อนี้ในระบบ', model_added:'เพิ่มรุ่นสำเร็จ',
                   model_updated:'แก้ไขสำเร็จ', model_deleted:'ลบสำเร็จ' }
    return av(reply, 'cars.ejs', {
      title: 'จัดการรถยนต์', activePage: 'cars', admin: req.session.admin,
      brands, models, msg: msgs[req.query.msg] || ''
    })
  })

  fastify.post('/cars/brand/add', async (req, reply) => {
    const { name } = req.body || {}
    if (name?.trim()) await db.query('INSERT INTO car_brands (name) VALUES (?)', [name.trim()])
    return reply.redirect('/admin/cars?msg=brand_added')
  })

  fastify.post('/cars/brand/:id/delete', async (req, reply) => {
    const [[{ cnt }]] = await db.query('SELECT COUNT(*) AS cnt FROM car_models WHERE brand_id=?', [req.params.id])
    if (cnt > 0) return reply.redirect('/admin/cars?msg=brand_has_models')
    await db.query('DELETE FROM car_brands WHERE id=?', [req.params.id])
    return reply.redirect('/admin/cars?msg=brand_deleted')
  })

  fastify.post('/cars/model/add', async (req, reply) => {
    const { brand_id, name, base_value } = req.body || {}
    if (brand_id && name?.trim() && base_value) {
      await db.query('INSERT INTO car_models (brand_id, name, base_value) VALUES (?,?,?)',
        [parseInt(brand_id), name.trim(), parseFloat(base_value)])
    }
    return reply.redirect('/admin/cars?msg=model_added')
  })

  fastify.post('/cars/model/:id/edit', async (req, reply) => {
    const { name, base_value, brand_id } = req.body || {}
    await db.query('UPDATE car_models SET name=?, base_value=?, brand_id=? WHERE id=?',
      [name.trim(), parseFloat(base_value), parseInt(brand_id), req.params.id])
    return reply.redirect('/admin/cars?msg=model_updated')
  })

  fastify.post('/cars/model/:id/delete', async (req, reply) => {
    await db.query('DELETE FROM car_models WHERE id=?', [req.params.id])
    return reply.redirect('/admin/cars?msg=model_deleted')
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
    const keys = ['class1_rate','class1_min','class2plus_rate','class2plus_min','class3plus_rate','class3plus_min','site_phone','site_email']
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
    if (!userId || !['bot','handoff'].includes(state)) return reply.send({ ok: false })
    await db.query(
      'UPDATE line_sessions SET state = ?, handoff_at = ? WHERE line_user_id = ?',
      [state, state === 'handoff' ? new Date() : null, userId]
    ).catch(() => {})
    return reply.send({ ok: true })
  })
}

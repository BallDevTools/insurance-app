'use strict'

const scraper = require('../scraper/index')
const scraperDb = require('../scraper/db')

// log buffer สำหรับ stream ไปหน้า admin
const logBuffer = []
const MAX_LOG = 200

function pushLog(msg) {
  const line = `[${new Date().toLocaleTimeString('th-TH')}] ${msg}`
  logBuffer.push(line)
  if (logBuffer.length > MAX_LOG) logBuffer.shift()
}

module.exports = async function scraperPlugin(fastify, opts) {

  // Auth guard
  fastify.addHook('preHandler', async (req, reply) => {
    if (!req.session?.admin) return reply.redirect('/admin/login')
  })

  // ============================================================
  // GET /admin/scraper — dashboard
  // ============================================================
  fastify.get('/', async (req, reply) => {
    const stats = await scraperDb.getStats().catch(() => ({ counts: {}, logs: [] }))
    const crypto = require('crypto')
    if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(24).toString('hex')
    return reply.view('admin/scraper.ejs', {
      title: 'Scraper Dashboard',
      activePage: 'scraper',
      admin: req.session.admin,
      stats,
      running: scraper.isRunning(),
      logs: [...logBuffer],
      csrfToken: req.session.csrfToken
    }, { layout: 'admin_layout.ejs' })
  })

  // ============================================================
  // GET /admin/scraper/status — polling JSON
  // ============================================================
  fastify.get('/status', async (req, reply) => {
    const stats = await scraperDb.getStats().catch(() => ({ counts: {}, logs: [] }))
    return reply.send({
      running: scraper.isRunning(),
      stats: stats.counts,
      logs: logBuffer.slice(-50)
    })
  })

  // ============================================================
  // POST /admin/scraper/start — เริ่ม scrape
  // ============================================================
  fastify.post('/start', async (req, reply) => {
    if (scraper.isRunning()) {
      return reply.send({ ok: false, message: 'กำลังรันอยู่แล้ว' })
    }

    logBuffer.length = 0 // clear log เก่า
    pushLog('Admin สั่งเริ่ม scrape...')

    // รันใน background — ไม่ await
    scraper.run({
      runType: 'manual',
      onProgress: pushLog
    }).catch(err => pushLog(`FATAL: ${err.message}`))

    return reply.send({ ok: true, message: 'เริ่มต้น scrape แล้ว' })
  })

  // ============================================================
  // POST /admin/scraper/retry-errors — รันเฉพาะรายการที่ error
  // ============================================================
  fastify.post('/retry-errors', async (req, reply) => {
    if (scraper.isRunning()) {
      return reply.send({ ok: false, message: 'กำลังรันอยู่แล้ว' })
    }

    logBuffer.length = 0
    pushLog('Admin สั่ง Retry รายการที่ error...')

    scraper.run({
      runType: 'retry-errors',
      errorsOnly: true,
      onProgress: pushLog
    }).catch(err => pushLog(`FATAL: ${err.message}`))

    return reply.send({ ok: true, message: 'เริ่มต้น Retry แล้ว' })
  })

  // ============================================================
  // POST /admin/scraper/stop — หยุด scrape
  // ============================================================
  fastify.post('/stop', async (req, reply) => {
    if (!scraper.isRunning()) {
      return reply.send({ ok: false, message: 'ไม่ได้รันอยู่' })
    }
    scraper.stop()
    pushLog('Admin สั่งหยุด scrape...')
    return reply.send({ ok: true, message: 'ส่งคำสั่งหยุดแล้ว' })
  })

  // ============================================================
  // POST /admin/scraper/reset-progress — reset progress ทั้งหมด
  // (ใช้เมื่อต้องการ full re-scrape)
  // ============================================================
  fastify.post('/reset-progress', async (req, reply) => {
    if (scraper.isRunning()) {
      return reply.send({ ok: false, message: 'หยุด scraper ก่อน' })
    }
    const db = require('../db')
    await db.query("DELETE FROM scraper_progress")
    pushLog('Admin reset progress ทั้งหมดแล้ว')
    return reply.send({ ok: true, message: 'Reset progress แล้ว — scrape ครั้งหน้าจะรัน full scan' })
  })
}

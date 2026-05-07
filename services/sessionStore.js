'use strict'

const db = require('../db')

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000 // cleanup expired rows ทุก 1 ชั่วโมง

class MysqlSessionStore {
  constructor() {
    // ลอง ensure table หลัง DB connect (retry สูงสุด 5 ครั้ง)
    let attempts = 0
    const tryEnsure = () => {
      this._ensureTable().catch(() => {
        if (++attempts < 5) setTimeout(tryEnsure, 3000)
      })
    }
    setTimeout(tryEnsure, 1000)
    setInterval(() => this._cleanup().catch(() => {}), CLEANUP_INTERVAL_MS)
  }

  async _ensureTable() {
    await db.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid       VARCHAR(128) NOT NULL PRIMARY KEY,
        sess      TEXT         NOT NULL,
        expired_at DATETIME    NOT NULL,
        INDEX idx_expired (expired_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
  }

  async _cleanup() {
    await db.query('DELETE FROM sessions WHERE expired_at <= NOW()')
  }

  get(sid, cb) {
    db.query('SELECT sess FROM sessions WHERE sid = ? AND expired_at > NOW()', [sid])
      .then(([[row]]) => {
        if (!row) return cb(null, null)
        try { cb(null, JSON.parse(row.sess)) } catch { cb(null, null) }
      })
      .catch(cb)
  }

  set(sid, session, cb) {
    const expiredAt = session.cookie?.expires
      ? new Date(session.cookie.expires)
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    const sess = JSON.stringify(session)
    db.query(
      `INSERT INTO sessions (sid, sess, expired_at) VALUES (?,?,?)
       ON DUPLICATE KEY UPDATE sess=VALUES(sess), expired_at=VALUES(expired_at)`,
      [sid, sess, expiredAt]
    )
      .then(() => cb(null))
      .catch(cb)
  }

  destroy(sid, cb) {
    db.query('DELETE FROM sessions WHERE sid = ?', [sid])
      .then(() => cb(null))
      .catch(cb)
  }

  touch(sid, session, cb) {
    this.set(sid, session, cb)
  }
}

module.exports = new MysqlSessionStore()

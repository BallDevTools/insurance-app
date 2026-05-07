require('dotenv').config()
const fs = require('fs')
const db = require('./db')
const sql = fs.readFileSync('./migrations/schema.sql', 'utf8')
const stmts = sql.split(';').map(s => s.trim()).filter(s => s && s.indexOf('--') !== 0 && s.toUpperCase().indexOf('USE ') !== 0 && s.toUpperCase().indexOf('CREATE DATABASE') !== 0)
;(async () => {
  for (const s of stmts) {
    try { await db.query(s) } catch(e) {
      if (e.message.indexOf('already exists') === -1) console.log('skip:', e.message.substring(0, 80))
    }
  }
  console.log('schema done')
  process.exit(0)
})()

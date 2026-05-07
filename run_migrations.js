require('dotenv').config()
const db = require('./db')
const fs = require('fs')

const files = [
  'migrate_admin2', 'migrate_security', 'migrate_line', 'migrate_scraper',
  'migrate_leads', 'migrate_notifications', 'migrate_tracking',
  'migrate_query_params', 'migrate_affiliate', 'migrate_settings_affiliate'
]

;(async () => {
  for (const f of files) {
    const sql = fs.readFileSync('./migrations/' + f + '.sql', 'utf8')
    const stmts = sql.split(';').map(s => s.trim()).filter(s => s.length > 4)
    for (const s of stmts) {
      try { await db.query(s) } catch(e) {
        console.log(f + ': ' + e.message.substring(0, 80))
      }
    }
    console.log('ok:', f)
  }
  process.exit(0)
})()

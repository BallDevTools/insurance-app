#!/usr/bin/env node
require('dotenv').config()
const db = require('../db')
const fs = require('fs')
const path = require('path')

const MIGRATIONS_DIR = path.join(__dirname, '../migrations')

const ORDER = [
  'schema.sql',
  'migrate_admin2.sql',
  'migrate_security.sql',
  'migrate_line.sql',
  'migrate_scraper.sql',
  'migrate_leads.sql',
  'migrate_funnel.sql',
  'migrate_partial.sql',
  'migrate_notifications.sql',
  'migrate_tracking.sql',
  'migrate_query_params.sql',
  'migrate_affiliate.sql',
  'migrate_settings_affiliate.sql',
  'migrate_commission.sql',
  'migrate_affiliate_clicks.sql',
  'migrate_companies_and_pkg_fields.sql',
]

async function runFile(file) {
  const filePath = path.join(MIGRATIONS_DIR, file)
  if (!fs.existsSync(filePath)) { console.log(`  SKIP (not found): ${file}`); return }
  const sql = fs.readFileSync(filePath, 'utf8')
  const stmts = sql
    .split(';')
    .map(s => s.replace(/--[^\n]*/g, '').trim())
    .filter(s => s.length > 0)
  for (const stmt of stmts) {
    await db.query(stmt).catch(e => {
      if (/already exists|duplicate|1060|1061|1050/.test(e.message)) {
        console.log(`    skip (exists): ${stmt.substring(0, 60)}`)
      } else {
        throw e
      }
    })
  }
  console.log(`  OK: ${file}`)
}

;(async () => {
  console.log('Running migrations...')
  for (const file of ORDER) {
    await runFile(file)
  }
  const [[cnt]] = await db.query('SELECT COUNT(*) as n FROM companies').catch(() => [[{ n: 'N/A' }]])
  console.log(`\nDone. companies table: ${cnt.n} rows`)
  process.exit(0)
})().catch(e => { console.error('ERR:', e.message); process.exit(1) })

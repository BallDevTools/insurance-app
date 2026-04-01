'use strict'

const db = require('../db')

async function saveBrand(brand) {
  await db.query(
    `INSERT INTO scraped_brands (brand_id_724, name) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name)`,
    [brand.id, brand.name]
  )
  const [[row]] = await db.query(
    'SELECT id FROM scraped_brands WHERE brand_id_724 = ?', [brand.id]
  )
  return row.id
}

async function saveModel(brandDbId, model) {
  await db.query(
    `INSERT INTO scraped_models (brand_id, model_id_724, name) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name)`,
    [brandDbId, model.model_id_724, model.name]
  )
  const [[row]] = await db.query(
    'SELECT id FROM scraped_models WHERE model_id_724 = ?', [model.model_id_724]
  )
  return row.id
}

async function savePackages(modelDbId, year, packages) {
  if (!packages.length) return 0
  // bulk INSERT แทนการ insert ทีละ row
  const placeholders = packages.map(() => '(?,?,?,?,?,?,?,?,?)').join(',')
  const values = packages.flatMap(pkg => [
    modelDbId, year,
    pkg.insurance_class, pkg.company_name,
    pkg.product_name || null,
    pkg.premium_amount, pkg.premium_discounted,
    pkg.coverage ? JSON.stringify(pkg.coverage) : null,
    pkg.source_url
  ])
  await db.query(
    `INSERT INTO scraped_packages
      (model_id, car_year, insurance_class, company_name, product_name, premium_amount, premium_discounted, coverage, source_url)
     VALUES ${placeholders}
     ON DUPLICATE KEY UPDATE
      premium_amount = VALUES(premium_amount),
      premium_discounted = VALUES(premium_discounted),
      coverage = VALUES(coverage),
      source_url = VALUES(source_url),
      scraped_at = CURRENT_TIMESTAMP`,
    values
  )
  return packages.length
}

async function setProgress(modelId724, year, status, errorMsg = null) {
  await db.query(
    `INSERT INTO scraper_progress (model_id_724, car_year, status, error_msg)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE status = VALUES(status), error_msg = VALUES(error_msg)`,
    [modelId724, year, status, errorMsg]
  )
}

async function isDone(modelId724, year) {
  const [[row]] = await db.query(
    `SELECT status FROM scraper_progress WHERE model_id_724 = ? AND car_year = ?`,
    [modelId724, year]
  )
  return row?.status === 'done'
}

// โหลด set ของปีที่ done แล้วของ model นี้ ครั้งเดียว (ลด DB roundtrips)
async function getDoneYears(modelId724) {
  const [rows] = await db.query(
    `SELECT car_year FROM scraper_progress WHERE model_id_724 = ? AND status = 'done'`,
    [modelId724]
  )
  return new Set(rows.map(r => r.car_year))
}

async function createLog(runType) {
  const [result] = await db.query(
    `INSERT INTO scraper_logs (run_type, started_at, status) VALUES (?, NOW(), 'running')`,
    [runType]
  )
  return result.insertId
}

async function updateLog(logId, fields) {
  const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ')
  await db.query(
    `UPDATE scraper_logs SET ${sets} WHERE id = ?`,
    [...Object.values(fields), logId]
  )
}

async function getStats() {
  const [[counts]] = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM scraped_brands) AS brands,
      (SELECT COUNT(*) FROM scraped_models) AS models,
      (SELECT COUNT(*) FROM scraped_packages) AS packages,
      (SELECT COUNT(*) FROM scraper_progress WHERE status = 'done') AS done,
      (SELECT COUNT(*) FROM scraper_progress WHERE status = 'error') AS errors,
      (SELECT COUNT(*) FROM scraper_progress WHERE status = 'pending') AS pending
  `)
  const [logs] = await db.query(
    `SELECT * FROM scraper_logs ORDER BY started_at DESC LIMIT 10`
  )
  return { counts, logs }
}

module.exports = { saveBrand, saveModel, savePackages, setProgress, isDone, getDoneYears, createLog, updateLog, getStats }

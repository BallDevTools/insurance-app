'use strict'

const { BRANDS, MIN_YEAR, MAX_YEAR, REQUEST_DELAY } = require('./config')
const { fetchModels } = require('./fetchModels')
const { fetchTable } = require('./fetchTable')
const scraperDb = require('./db')

// จำนวน model ที่รันพร้อมกัน (ปรับได้ใน .env SCRAPER_CONCURRENCY)
const CONCURRENCY = parseInt(process.env.SCRAPER_CONCURRENCY || '5', 10)

// state สำหรับ stop จากภายนอก
let _running = false
let _abortController = null

function isRunning() { return _running }
function stop() {
  if (_abortController) _abortController.abort()
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

/** รัน tasks พร้อมกัน ไม่เกิน limit ตัว */
async function pLimit(tasks, limit) {
  const results = []
  let idx = 0
  async function worker() {
    while (idx < tasks.length) {
      const i = idx++
      results[i] = await tasks[i]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker))
  return results
}

/**
 * ประมวลผล 1 model (ทุกปี)
 */
async function processModel({ brandDbId, brand, model, runType, signal, onProgress, counters }) {
  if (signal.aborted) return

  let modelDbId
  try {
    modelDbId = await scraperDb.saveModel(brandDbId, model)
  } catch (e) {
    onProgress(`[Scraper] ✗ saveModel ${model.name}: ${e.message}`)
    return
  }

  // prefetch ปีที่ done แล้วทั้งหมดในครั้งเดียว
  const doneYears = runType === 'scheduled'
    ? await scraperDb.getDoneYears(model.model_id_724)
    : new Set()

  for (let year = MAX_YEAR; year >= MIN_YEAR; year--) {
    if (signal.aborted) return
    if (doneYears.has(year)) continue

    try {
      await sleep(REQUEST_DELAY)
      const { tableUrl, packages } = await fetchTable(model.model_id_724, year, signal)

      if (!tableUrl) {
        await scraperDb.setProgress(model.model_id_724, year, 'done')
        continue
      }

      const saved = await scraperDb.savePackages(modelDbId, year, packages)
      await scraperDb.setProgress(model.model_id_724, year, 'done')
      counters.scraped += saved

      if (saved > 0) {
        onProgress(`[Scraper]   ✓ ${brand.name} ${model.name} ${year} — ${saved} packages`)
      }
    } catch (e) {
      if (signal.aborted) return
      counters.errors++
      await scraperDb.setProgress(model.model_id_724, year, 'error', e.message)
      onProgress(`[Scraper]   ✗ ${model.name} ${year}: ${e.message}`)
      await sleep(REQUEST_DELAY * 2)
    }
  }
}

/**
 * รันเฉพาะรายการที่ error
 */
async function runErrorsOnly({ signal, onProgress, counters }) {
  const errors = await scraperDb.getErrors()
  if (errors.length === 0) {
    onProgress('[Scraper] ไม่พบรายการที่ error')
    return
  }

  onProgress(`[Scraper] กำลังดึงข้อมูลซ้ำสำหรับ ${errors.length} รายการที่ผิดพลาด...`)

  const { fetchTable } = require('./fetchTable')
  const { REQUEST_DELAY } = require('./config')

  // ใช้ concurrency สำหรับการรัน error ด้วย
  const tasks = errors.map(err => async () => {
    if (signal.aborted) return

    try {
      await sleep(REQUEST_DELAY)
      const { tableUrl, packages } = await fetchTable(err.model_id_724, err.car_year, signal)

      if (!tableUrl) {
        await scraperDb.setProgress(err.model_id_724, err.car_year, 'done')
        return
      }

      const saved = await scraperDb.savePackages(err.model_db_id, err.car_year, packages)
      await scraperDb.setProgress(err.model_id_724, err.car_year, 'done')
      counters.scraped += saved

      if (saved > 0) {
        onProgress(`[Scraper]   ✓ ${err.brand_name} ${err.model_name} ${err.car_year} — ${saved} packages (Retry)`)
      }
    } catch (e) {
      if (signal.aborted) return
      counters.errors++
      await scraperDb.setProgress(err.model_id_724, err.car_year, 'error', e.message)
      onProgress(`[Scraper]   ✗ ${err.model_name} ${err.car_year}: ${e.message} (Retry)`)
      await sleep(REQUEST_DELAY * 2)
    }
  })

  await pLimit(tasks, CONCURRENCY)
}

/**
 * Main entry point
 * @param {object} opts
 * @param {string} opts.runType  'manual' | 'scheduled' | 'retry-errors'
 * @param {boolean} opts.errorsOnly  รันเฉพาะที่ error
 * @param {function} opts.onProgress  callback(msg) สำหรับ log realtime
 */
async function run({ runType = 'scheduled', errorsOnly = false, onProgress = console.log } = {}) {
  if (_running) {
    onProgress('[Scraper] กำลังรันอยู่แล้ว')
    return
  }

  _running = true
  _abortController = new AbortController()
  const signal = _abortController.signal

  const logId = await scraperDb.createLog(runType)
  const counters = { scraped: 0, errors: 0 }

  onProgress(`[Scraper] เริ่มต้น (${runType}) — log #${logId} — concurrency: ${CONCURRENCY}`)

  try {
    if (errorsOnly) {
      await runErrorsOnly({ signal, onProgress, counters })
    } else {
      for (const brand of BRANDS) {
        if (signal.aborted) break

        onProgress(`[Scraper] → Brand: ${brand.name} (${brand.id})`)

      let brandDbId
      try {
        brandDbId = await scraperDb.saveBrand(brand)
      } catch (e) {
        onProgress(`[Scraper] ✗ saveBrand ${brand.name}: ${e.message}`)
        continue
      }

      let models = []
      try {
        models = await fetchModels(brand.id)
        onProgress(`[Scraper]   พบ ${models.length} รุ่น — รัน ${Math.min(CONCURRENCY, models.length)} พร้อมกัน`)
      } catch (e) {
        onProgress(`[Scraper] ✗ fetchModels ${brand.name}: ${e.message}`)
        await sleep(REQUEST_DELAY)
        continue
      }

      // รัน models พร้อมกัน CONCURRENCY ตัว
      const tasks = models.map(model => () =>
        processModel({ brandDbId, brand, model, runType, signal, onProgress, counters })
      )
      await pLimit(tasks, CONCURRENCY)
    }
  }
} catch (fatalErr) {
    onProgress(`[Scraper] FATAL: ${fatalErr.message}`)
    await scraperDb.updateLog(logId, {
      finished_at: new Date(),
      total_scraped: counters.scraped,
      total_errors: counters.errors,
      status: 'error'
    })
    _running = false
    _abortController = null
    return
  }

  const finalStatus = signal.aborted ? 'stopped' : 'done'
  await scraperDb.updateLog(logId, {
    finished_at: new Date(),
    total_scraped: counters.scraped,
    total_errors: counters.errors,
    status: finalStatus
  })

  onProgress(`[Scraper] ${finalStatus} — scraped: ${counters.scraped}, errors: ${counters.errors}`)
  _running = false
  _abortController = null
}

module.exports = { run, stop, isRunning }

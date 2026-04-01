'use strict'

const cron = require('node-cron')
const scraper = require('./index')

/**
 * ตั้ง cron รัน scraper ทุกคืน 02:00 น.
 * โดยจะ reset progress ให้รัน incremental (ข้ามรายการที่ done แล้ว)
 */
function startScraperScheduler() {
  cron.schedule('0 2 * * *', async () => {
    console.log('[ScraperScheduler] เริ่ม scheduled scrape...')
    await scraper.run({
      runType: 'scheduled',
      onProgress: (msg) => console.log(msg)
    })
  }, { timezone: 'Asia/Bangkok' })

  console.log('[ScraperScheduler] Cron ตั้งค่าแล้ว (ทุกคืน 02:00 น.)')
}

module.exports = { startScraperScheduler }

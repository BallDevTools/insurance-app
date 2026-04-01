'use strict'

const axios  = require('axios')
const https  = require('https')
const { BASE_URL, ENDPOINTS, REQUEST_DELAY } = require('./config')
const { parsePackages, parseCoverage } = require('./parser')

const agent = new https.Agent({ rejectUnauthorized: false })
const headers = {
  'User-Agent': 'Mozilla/5.0 (compatible; InsuranceBot/1.0)',
  'Referer': 'https://insure.724.co.th/motor'
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

/**
 * ดึงหน้า detail coverage ของแต่ละแพ็กเกจ
 */
async function fetchCoverage(confirmUrl, signal) {
  if (!confirmUrl) return null
  // ถ้า relative URL ให้เติม BASE_URL
  const url = confirmUrl.startsWith('http') ? confirmUrl : `${BASE_URL}${confirmUrl}`
  try {
    const res = await axios.get(url, {
      timeout: 15000, httpsAgent: agent, headers, signal
    })
    return parseCoverage(res.data)
  } catch {
    return null
  }
}

/**
 * ดึงตารางราคา + coverage detail ของรุ่นรถ + ปี
 */
async function fetchTable(modelId, year, signal) {
  // Step 1: POST → รับ URL ของหน้าตาราง
  const priceRes = await axios.post(
    ENDPOINTS.tablePrice(modelId, year),
    null,
    { timeout: 15000, httpsAgent: agent, headers, signal }
  )

  const tableUrl = priceRes.data?.url
  if (!tableUrl) return { tableUrl: null, packages: [] }

  // Step 2: GET หน้าตาราง → parse ราคา (retry 3 ครั้ง)
  let packages = []
  let lastErr
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (signal?.aborted) throw new Error('Scraper stopped')
    try {
      const tableRes = await axios.get(tableUrl, {
        timeout: 30000, httpsAgent: agent, headers, signal
      })
      packages = parsePackages(tableRes.data, tableUrl)
      break
    } catch (err) {
      if (err.code === 'ERR_CANCELED' || signal?.aborted) throw new Error('Scraper stopped')
      lastErr = err
      if (attempt < 3) await sleep(2000 * attempt)
    }
  }
  if (!packages.length && lastErr) throw lastErr

  // Step 3: ดึง coverage detail ของแต่ละแพ็กเกจ
  // ใช้ confirm_url ที่ parser เก็บไว้ใน coverage.confirm_url
  for (const pkg of packages) {
    if (signal?.aborted) break
    const confirmUrl = pkg.coverage?.confirm_url
    if (!confirmUrl) continue

    await sleep(REQUEST_DELAY)
    const coverageData = await fetchCoverage(confirmUrl, signal)
    if (coverageData) {
      pkg.coverage = { confirm_url: confirmUrl, ...coverageData }
    }
  }

  return { tableUrl, packages }
}

module.exports = { fetchTable }

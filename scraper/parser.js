'use strict'

const cheerio = require('cheerio')

/**
 * Parse HTML จาก load_car_model → [{model_id_724, name}]
 */
function parseModels(html) {
  const $ = cheerio.load(html)
  const models = []
  $('a[data-search-type="car_model"]').each((_, el) => {
    const id = parseInt($(el).attr('data-search-value-id'))
    const name = $(el).attr('data-search-value-name')?.trim()
    if (id && name) models.push({ model_id_724: id, name })
  })
  return models
}

/**
 * Parse หน้าตาราง /table/{brand}/{model}/{year}
 *
 * โครงสร้าง column ในตาราง (10 td ต่อ row):
 *   [0] label (ยอดนิยม, เคลมดี ฯลฯ)
 *   [1] ชื่อบริษัท (ใน <span>)
 *   [2] ป.1 ซ่อมศูนย์
 *   [3] ป.1 ซ่อมอู่
 *   [4] ป.2
 *   [5] ป.3
 *   [6] ป.2+ ทุน 100k
 *   [7] ป.2+ ทุน 200k
 *   [8] ป.3+ ทุน 100k
 *   [9] ป.3+ ทุน 200k
 *
 * @returns {Array} [{company_name, insurance_class, premium_amount, coverage, source_url}]
 */
function parsePackages(html, sourceUrl) {
  const $ = cheerio.load(html)
  const packages = []

  // column index → insurance class
  const COL_CLASS = {
    2: '1',    // ป.1 ซ่อมศูนย์
    3: '1',    // ป.1 ซ่อมอู่
    4: '2',    // ป.2
    5: '3',    // ป.3
    6: '2+',   // ป.2+ ทุน 100k
    7: '2+',   // ป.2+ ทุน 200k
    8: '3+',   // ป.3+ ทุน 100k
    9: '3+',   // ป.3+ ทุน 200k
  }

  // เอาเฉพาะ rows ที่มี td 10 ตัว (data rows)
  $('table tr').each((_, row) => {
    const $row = $(row)
    const tds = $row.find('td')
    if (tds.length < 8) return // skip header rows

    // บริษัทประกัน + product name (ข้อความใต้ชื่อบริษัท)
    const company = tds.eq(1).find('span').text().trim()
    if (!company) return
    // ชื่อแพ็กเกจ — ข้อความใน td[1] ที่ไม่ใช่ span (text node ตรง ๆ หรือ div/p ถัดจาก span)
    const $td1 = tds.eq(1)
    const $td1Clone = $td1.clone()
    $td1Clone.find('span').remove()
    const productName = $td1Clone.text().trim() || null

    // แต่ละ column → package
    for (const [colIdx, cls] of Object.entries(COL_CLASS)) {
      const idx = parseInt(colIdx)
      const $td = tds.eq(idx)
      const priceText = $td.find('a').text().trim()

      if (!priceText || priceText === '-') continue

      const premium = parsePrice(priceText)
      if (!premium || premium <= 0) continue

      // หา coverage จาก second-topic row (ทุนประกันภัย)
      // เก็บ href ของ package confirm link
      const confirmUrl = $td.find('a').attr('href') || ''

      packages.push({
        company_name: company,
        product_name: productName,
        insurance_class: cls,
        premium_amount: premium,
        premium_discounted: null,
        coverage: { confirm_url: confirmUrl || null },
        source_url: sourceUrl
      })
    }
  })

  return packages
}

function parsePrice(text) {
  if (!text) return null
  const cleaned = text.replace(/[^0-9.]/g, '')
  const val = parseFloat(cleaned)
  return isNaN(val) || val <= 0 ? null : val
}

/**
 * Parse หน้า detail ของแต่ละแพ็กเกจ → coverage object
 *
 * โครงสร้างหน้า detail มี 3 section (h3/div.title):
 *   1. ความรับผิดชอบต่อตัวรถยนต์
 *   2. ความรับผิดชอบต่อบุคคลภายนอก
 *   3. ความคุ้มครองตามเอกสารแนบท้าย
 * แต่ละ section มีตาราง 2 column: label | value
 */
function parseCoverage(html) {
  const $ = cheerio.load(html)
  const result = {}

  // ดึง key-value จากตาราง 2 col ใน container ที่กำหนด
  function extractTable($container) {
    const data = {}
    $container.find('tr').each((_, tr) => {
      const tds = $(tr).find('td')
      if (tds.length < 2) return
      const key   = tds.eq(0).text().trim()
      const value = tds.eq(1).text().trim()
      if (key && value && value !== '') data[key] = value
    })
    return data
  }

  // หา section โดยวนผ่าน headings และ div ที่มีชื่อ section
  const sectionMap = {
    'ความรับผิดชอบต่อตัวรถยนต์':       'own_vehicle',
    'ความรับผิดชอบต่อบุคคลภายนอก':     'third_party',
    'ความคุ้มครองตามเอกสารแนบท้าย':    'extra',
  }

  // Strategy 1: หา heading แล้ว traverse หา table ถัดไป
  $('h3, h4, .coverage-title, .section-title, [class*="title"]').each((_, el) => {
    const headingText = $(el).text().trim()
    for (const [thaiName, key] of Object.entries(sectionMap)) {
      if (headingText.includes(thaiName)) {
        const $table = $(el).nextAll('table').first()
        if ($table.length) {
          result[key] = extractTable($table)
        }
        break
      }
    }
  })

  // Strategy 2: fallback — หา table ทั้งหมดแล้วดู context
  if (Object.keys(result).length === 0) {
    const tables = $('table').toArray()
    tables.forEach((table, idx) => {
      const $prev = $(table).prev()
      const headerText = $prev.text().trim()
      for (const [thaiName, key] of Object.entries(sectionMap)) {
        if (headerText.includes(thaiName)) {
          result[key] = extractTable($(table))
          break
        }
      }
      // ถ้า table แรก ไม่มี header ก่อนหน้า ลอง parent
      if (idx === 0 && Object.keys(result).length === 0) {
        const parentText = $(table).parent().prev().text().trim()
        for (const [thaiName, key] of Object.entries(sectionMap)) {
          if (parentText.includes(thaiName)) {
            result[key] = extractTable($(table))
            break
          }
        }
      }
    })
  }

  // Strategy 3: สุดท้าย — เก็บ table แรก 3 ตารางตามลำดับ
  if (Object.keys(result).length === 0) {
    const keys = Object.values(sectionMap)
    $('table').each((idx, table) => {
      if (idx < keys.length) {
        const data = extractTable($(table))
        if (Object.keys(data).length > 0) result[keys[idx]] = data
      }
    })
  }

  return Object.keys(result).length > 0 ? result : null
}

module.exports = { parseModels, parsePackages, parseCoverage }

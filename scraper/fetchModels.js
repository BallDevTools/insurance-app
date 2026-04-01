'use strict'

const axios = require('axios')
const { ENDPOINTS } = require('./config')
const { parseModels } = require('./parser')

/**
 * ดึงรายการรุ่นรถของ brand นั้น
 * @returns {Array} [{model_id_724, name}]
 */
async function fetchModels(brandId) {
  const url = ENDPOINTS.loadModels(brandId)
  const res = await axios.post(url, null, {
    timeout: 15000,
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; InsuranceBot/1.0)',
      'Referer': 'https://insure.724.co.th/motor'
    }
  })
  return parseModels(res.data)
}

module.exports = { fetchModels }

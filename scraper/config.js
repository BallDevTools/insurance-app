'use strict'

const BASE_URL = 'https://insure.724.co.th'

// Brand IDs จาก HTML ของ insure.724.co.th (ฝังตรงใน data-search-value-id)
const BRANDS = [
  { id: 1,    name: 'AUDI' },
  { id: 2,    name: 'BMW' },
  { id: 4,    name: 'CHEVROLET' },
  { id: 5,    name: 'FORD' },
  { id: 6,    name: 'HONDA' },
  { id: 7,    name: 'HYUNDAI' },
  { id: 8,    name: 'ISUZU' },
  { id: 9,    name: 'KIA' },
  { id: 12,   name: 'MAZDA' },
  { id: 13,   name: 'MERCEDES-BENZ' },
  { id: 15,   name: 'MITSUBISHI' },
  { id: 16,   name: 'NISSAN' },
  { id: 17,   name: 'PEUGEOT' },
  { id: 19,   name: 'SUZUKI' },
  { id: 20,   name: 'TOYOTA' },
  { id: 23,   name: 'VOLVO' },
  { id: 42,   name: 'MG' },
  { id: 44,   name: 'OPEL' },
  { id: 47,   name: 'PROTON' },
  { id: 53,   name: 'SUBARU' },
  { id: 222,  name: 'TESLA' },
  { id: 242,  name: 'BYD' },
  { id: 9045, name: 'ORA' },
  { id: 9046, name: 'NETA' }
]

// ปีรถที่จะ scrape
const MIN_YEAR = 1997
const MAX_YEAR = new Date().getFullYear()

// หน่วงเวลาระหว่าง request (ms) — เพื่อไม่ให้โดน rate limit
const REQUEST_DELAY = 400

// API endpoints
const ENDPOINTS = {
  loadModels: (brandId) =>
    `${BASE_URL}/index.php/app/index/fnc/load_car_model/id/${brandId}/CarSaleType/M`,
  tablePrice: (modelId, year) =>
    `${BASE_URL}/index.php/app/package/fnc/sel_table_price/model_id/${modelId}/year_id/${year}`
}

module.exports = { BASE_URL, BRANDS, MIN_YEAR, MAX_YEAR, REQUEST_DELAY, ENDPOINTS }

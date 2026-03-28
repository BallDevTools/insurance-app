'use strict'

// =============================================
// ตรรกะคำนวณเบี้ยประกันรถยนต์
// =============================================

const INSURANCE_TYPES = {
  class1: {
    label: 'ประกันชั้น 1',
    baseRate: 0.042,        // 4.2% ของมูลค่ารถ
    minPremium: 12000,
    coverage: {
      ownDamage: true,
      thirdPartyBody: true,
      thirdPartyProperty: true,
      theft: true,
      fire: true,
      flood: true,
      personalAccident: true,
      medicalExpense: true,
    },
    coverageDetails: {
      ownDamage: 'ตามมูลค่ารถ',
      thirdPartyBody: '10,000,000 บาท/ครั้ง',
      thirdPartyProperty: '5,000,000 บาท/ครั้ง',
      theft: 'ตามมูลค่ารถ',
      fire: 'ตามมูลค่ารถ',
      flood: 'ตามมูลค่ารถ',
      personalAccident: '100,000 บาท/คน',
      medicalExpense: '50,000 บาท/คน',
    }
  },
  class2plus: {
    label: 'ประกันชั้น 2+',
    baseRate: 0.022,        // 2.2%
    minPremium: 7000,
    coverage: {
      ownDamage: 'collision',
      thirdPartyBody: true,
      thirdPartyProperty: true,
      theft: true,
      fire: true,
      flood: false,
      personalAccident: true,
      medicalExpense: true,
    },
    coverageDetails: {
      ownDamage: 'ชนรถยนต์เท่านั้น ตามมูลค่ารถ',
      thirdPartyBody: '5,000,000 บาท/ครั้ง',
      thirdPartyProperty: '1,000,000 บาท/ครั้ง',
      theft: 'ตามมูลค่ารถ',
      fire: 'ตามมูลค่ารถ',
      flood: 'ไม่คุ้มครอง',
      personalAccident: '100,000 บาท/คน',
      medicalExpense: '30,000 บาท/คน',
    }
  },
  class3plus: {
    label: 'ประกันชั้น 3+',
    baseRate: 0.010,        // 1.0%
    minPremium: 3500,
    coverage: {
      ownDamage: 'collision',
      thirdPartyBody: true,
      thirdPartyProperty: true,
      theft: false,
      fire: false,
      flood: false,
      personalAccident: true,
      medicalExpense: false,
    },
    coverageDetails: {
      ownDamage: 'ชนรถยนต์เท่านั้น (ไม่เกิน 50% ของมูลค่ารถ)',
      thirdPartyBody: '1,000,000 บาท/ครั้ง',
      thirdPartyProperty: '500,000 บาท/ครั้ง',
      theft: 'ไม่คุ้มครอง',
      fire: 'ไม่คุ้มครอง',
      flood: 'ไม่คุ้มครอง',
      personalAccident: '100,000 บาท/คน',
      medicalExpense: 'ไม่คุ้มครอง',
    }
  }
}

// ตัวคูณตามอายุรถ
function getAgeFactor(year) {
  const age = new Date().getFullYear() + 543 - year  // แปลง ค.ศ. เป็น พ.ศ.
  const ageActual = new Date().getFullYear() - year
  if (ageActual <= 1) return 1.00
  if (ageActual <= 3) return 0.95
  if (ageActual <= 5) return 0.88
  if (ageActual <= 7) return 0.80
  if (ageActual <= 10) return 0.72
  return 0.65
}

// มูลค่ารถตามอายุ (สำหรับรถที่ไม่มีใน DB)
function estimateCarValue(baseValue, year) {
  const ageFactor = getAgeFactor(year)
  return Math.round(baseValue * ageFactor)
}

function calculatePremium({ carValue, insuranceType, year, provinceFactor = 1.0, settings = {} }) {
  const config = INSURANCE_TYPES[insuranceType]
  if (!config) throw new Error('ประเภทประกันไม่ถูกต้อง')

  // ใช้ rate จาก DB settings ถ้ามี
  const rateKey = `${insuranceType}_rate`
  const minKey = `${insuranceType}_min`
  const baseRate = settings[rateKey] || config.baseRate
  const minPremium = settings[minKey] || config.minPremium

  const ageFactor = getAgeFactor(year)
  const effectiveValue = carValue * ageFactor

  let premium = effectiveValue * baseRate * provinceFactor

  // ปัดให้ได้ผลลัพธ์ที่สวยงาม
  premium = Math.max(premium, minPremium)
  premium = Math.round(premium / 100) * 100

  // ภาษีอากรแสตมป์ 0.4% + ภาษีมูลค่าเพิ่ม 7%
  const stampDuty = Math.round(premium * 0.004)
  const vat = Math.round((premium + stampDuty) * 0.07)
  const total = premium + stampDuty + vat

  return {
    netPremium: premium,
    stampDuty,
    vat,
    totalPremium: total,
    effectiveCarValue: Math.round(effectiveValue),
    ageFactor,
    config
  }
}

function generateQuoteNumber() {
  const now = new Date()
  const dateStr = now.getFullYear().toString().slice(-2)
    + String(now.getMonth() + 1).padStart(2, '0')
    + String(now.getDate()).padStart(2, '0')
  const rand = Math.floor(Math.random() * 90000) + 10000
  return `QT${dateStr}${rand}`
}

module.exports = {
  INSURANCE_TYPES,
  calculatePremium,
  generateQuoteNumber,
  estimateCarValue,
  getAgeFactor
}

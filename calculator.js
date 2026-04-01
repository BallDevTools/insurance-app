'use strict'

// =============================================
// ข้อมูลประเภทประกัน (coverage labels)
// =============================================

const INSURANCE_TYPES = {
  class1: {
    label: 'ประกันชั้น 1',
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

function generateQuoteNumber() {
  const now = new Date()
  const dateStr = now.getFullYear().toString().slice(-2)
    + String(now.getMonth() + 1).padStart(2, '0')
    + String(now.getDate()).padStart(2, '0')
  const rand = Math.floor(Math.random() * 90000) + 10000
  return `QT${dateStr}${rand}`
}

module.exports = { INSURANCE_TYPES, generateQuoteNumber }

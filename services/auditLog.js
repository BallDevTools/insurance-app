'use strict'

const db = require('../db')

/**
 * บันทึก audit log
 * @param {string} adminUsername
 * @param {string} action - e.g. 'update_quote_status', 'delete_car_brand'
 * @param {string} targetType - e.g. 'quote', 'car_brand', 'province'
 * @param {string|number} targetId
 * @param {string} detail - human-readable detail
 * @param {string} ip
 */
async function log(adminUsername, action, targetType, targetId, detail, ip) {
  await db.query(
    'INSERT INTO audit_logs (admin_username, action, target_type, target_id, detail, ip_address) VALUES (?,?,?,?,?,?)',
    [adminUsername, action, targetType || null, targetId ? String(targetId) : null, detail || null, ip || null]
  ).catch(() => {})  // ไม่ให้ audit log ทำให้ request fail
}

module.exports = { log }

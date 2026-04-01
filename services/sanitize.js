'use strict'

/**
 * Strip HTML tags from a string to prevent XSS when data is reflected.
 * EJS's <%= %> auto-escapes, but we also sanitize before storing in DB.
 */
function stripHtml(str) {
  if (typeof str !== 'string') return str
  return str.replace(/<[^>]*>/g, '').trim()
}

/**
 * Sanitize all string fields in an object (shallow).
 */
function sanitizeBody(obj) {
  if (!obj || typeof obj !== 'object') return obj
  const out = {}
  for (const key of Object.keys(obj)) {
    out[key] = typeof obj[key] === 'string' ? stripHtml(obj[key]) : obj[key]
  }
  return out
}

module.exports = { stripHtml, sanitizeBody }

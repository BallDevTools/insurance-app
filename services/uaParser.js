'use strict'

function parseUA(ua) {
  if (!ua) return { browser: null, browser_version: null, os: null, device_type: 'unknown' }

  let browser = 'Other'
  let browser_version = null
  let os = 'Other'
  let device_type = 'Desktop'

  // Device type
  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    device_type = 'Tablet'
  } else if (/mobile|android|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop/i.test(ua)) {
    device_type = 'Mobile'
  }

  // OS
  if (/windows nt 10/i.test(ua))       os = 'Windows 10/11'
  else if (/windows nt 6\.3/i.test(ua)) os = 'Windows 8.1'
  else if (/windows nt 6\.1/i.test(ua)) os = 'Windows 7'
  else if (/windows/i.test(ua))         os = 'Windows'
  else if (/ipad/i.test(ua))            os = 'iPadOS'
  else if (/iphone|ipod/i.test(ua))     os = 'iOS'
  else if (/mac os x/i.test(ua)) {
    const m = ua.match(/mac os x (\d+[_\.]\d+)/i)
    os = m ? `macOS ${m[1].replace('_', '.')}` : 'macOS'
  } else if (/android/i.test(ua)) {
    const m = ua.match(/android (\d+\.?\d*)/i)
    os = m ? `Android ${m[1]}` : 'Android'
  } else if (/linux/i.test(ua)) os = 'Linux'

  // Browser (order matters — check Edge/Samsung before Chrome/Safari)
  let m
  if (/edg\//i.test(ua)) {
    m = ua.match(/edg\/(\d+)/i)
    browser = 'Edge'; browser_version = m?.[1] || null
  } else if (/opr\//i.test(ua) || /opera/i.test(ua)) {
    m = ua.match(/(?:opr|opera)\/(\d+)/i)
    browser = 'Opera'; browser_version = m?.[1] || null
  } else if (/samsungbrowser/i.test(ua)) {
    m = ua.match(/samsungbrowser\/(\d+)/i)
    browser = 'Samsung Browser'; browser_version = m?.[1] || null
  } else if (/crios/i.test(ua)) {
    m = ua.match(/crios\/(\d+)/i)
    browser = 'Chrome (iOS)'; browser_version = m?.[1] || null
  } else if (/fxios/i.test(ua)) {
    m = ua.match(/fxios\/(\d+)/i)
    browser = 'Firefox (iOS)'; browser_version = m?.[1] || null
  } else if (/chrome\/(\d+)/i.test(ua)) {
    m = ua.match(/chrome\/(\d+)/i)
    browser = 'Chrome'; browser_version = m?.[1] || null
  } else if (/firefox\/(\d+)/i.test(ua)) {
    m = ua.match(/firefox\/(\d+)/i)
    browser = 'Firefox'; browser_version = m?.[1] || null
  } else if (/safari\/(\d+)/i.test(ua) && /version\/(\d+)/i.test(ua)) {
    m = ua.match(/version\/(\d+)/i)
    browser = 'Safari'; browser_version = m?.[1] || null
  } else if (/lineapp/i.test(ua)) {
    browser = 'LINE App'; browser_version = null
  }

  return { browser, browser_version, os, device_type }
}

module.exports = { parseUA }

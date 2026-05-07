'use strict'

const cache = new Map()
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

const PRIVATE = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fd)/

async function lookupIp(ip) {
  if (!ip || PRIVATE.test(ip)) return null

  const cached = cache.get(ip)
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data

  const ctrl = new AbortController()
  const tid  = setTimeout(() => ctrl.abort(), 2000)

  try {
    const res  = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,city,isp,mobile,proxy`,
      { signal: ctrl.signal }
    )
    const data = await res.json()
    if (data.status !== 'success') return null

    const result = {
      country: data.country || null,
      city:    data.city    || null,
      isp:     data.isp     || null,
      mobile:  data.mobile  ? 1 : 0,
      proxy:   data.proxy   ? 1 : 0
    }
    cache.set(ip, { data: result, ts: Date.now() })
    return result
  } catch {
    return null
  } finally {
    clearTimeout(tid)
  }
}

module.exports = { lookupIp }

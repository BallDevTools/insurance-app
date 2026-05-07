'use strict'

const cache = new Map()
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

const PRIVATE = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fd)/

async function lookupIp(ip) {
  if (!ip || PRIVATE.test(ip)) return null

  // check global rate-limit backoff
  const rl = cache.get('__ratelimit__')
  if (rl && Date.now() - rl.ts < CACHE_TTL) return null

  const cached = cache.get(ip)
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data

  const ctrl = new AbortController()
  const tid  = setTimeout(() => ctrl.abort(), 2000)

  try {
    const res  = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,city,isp,mobile,proxy`,
      { signal: ctrl.signal }
    )
    if (res.status === 429) {
      // rate limited — cache null for 2 minutes to back off
      cache.set('__ratelimit__', { data: null, ts: Date.now() - CACHE_TTL + 120000 })
      cache.set(ip, { data: null, ts: Date.now() - CACHE_TTL + 120000 })
      return null
    }
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

const clients = new Map() // userId → Set<raw res>

function add(userId, raw) {
  if (!clients.has(userId)) clients.set(userId, new Set())
  clients.get(userId).add(raw)
}

function remove(userId, raw) {
  clients.get(userId)?.delete(raw)
  if (clients.get(userId)?.size === 0) clients.delete(userId)
}

function broadcast(userId, payload) {
  clients.get(userId)?.forEach(raw => {
    try { raw.write(`data: ${JSON.stringify(payload)}\n\n`) } catch {}
  })
}

module.exports = { add, remove, broadcast }

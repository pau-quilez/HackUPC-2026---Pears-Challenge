export function generateId () {
  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16)
    globalThis.crypto.getRandomValues(bytes)
    return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
  }
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 18)}`
}

export function createTopicBuffer (roomName) {
  const topic = new Uint8Array(32)
  let seed = 0x811c9dc5
  for (let i = 0; i < roomName.length; i++) {
    seed ^= roomName.charCodeAt(i)
    seed = Math.imul(seed, 0x01000193)
  }

  for (let i = 0; i < topic.length; i++) {
    seed ^= i
    seed = Math.imul(seed, 0x5bd1e995)
    topic[i] = (seed >>> ((i % 4) * 8)) & 0xff
  }
  return topic
}

export function shortId (hexKey) {
  return hexKey.slice(0, 8)
}

export function timestamp () {
  return Date.now()
}

export function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

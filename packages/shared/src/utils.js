import crypto from 'node:crypto'

export function generateId () {
  return crypto.randomBytes(16).toString('hex')
}

export function createTopicBuffer (roomName) {
  return crypto.createHash('sha256').update(roomName).digest()
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

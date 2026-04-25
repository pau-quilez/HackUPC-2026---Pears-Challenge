import MESSAGE_TYPES from '../../shared/src/types.js' // your message types

export function normalizeEvent (message, fallback = {}) {
  if (!message?.type || typeof message.type !== 'string') {
    throw new Error('Invalid message: type required')
  }

  const timestamp = message.timestamp ?? Date.now()
  const from = message.from ?? fallback.from ?? 'system'
  const matchId = message.matchId ?? fallback.matchId  // FIXED: use 'message', not 'event'
  const payload = message.payload ?? {}

  if (!matchId) {
    throw new Error('matchId required for game events')
  }

  return {
    id: `${message.type}:${matchId}:${timestamp}`,
    type: message.type,
    matchId,
    from,
    timestamp,
    payload
  }
}
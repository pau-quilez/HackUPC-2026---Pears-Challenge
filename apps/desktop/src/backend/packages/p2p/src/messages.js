import { MSG_TYPES } from '../../shared/src/index.js'
import { timestamp } from '../../shared/src/index.js'

export function createMessage (type, from, payload = {}) {
  return JSON.stringify({
    type,
    from,
    payload,
    timestamp: timestamp()
  })
}

export function parseMessage (raw) {
  try {
    const str = typeof raw === 'string' ? raw : raw.toString('utf-8')
    return JSON.parse(str)
  } catch {
    return null
  }
}

export function msgPlayerJoin (peerId, name) {
  return createMessage(MSG_TYPES.PLAYER_JOIN, peerId, { name })
}

export function msgPlayerReady (peerId) {
  return createMessage(MSG_TYPES.PLAYER_READY, peerId)
}

export function msgGameStart (peerId, state) {
  return createMessage(MSG_TYPES.GAME_START, peerId, state)
}

export function msgGameState (peerId, state) {
  return createMessage(MSG_TYPES.GAME_STATE, peerId, state)
}

export function msgDiceRoll (peerId, roll) {
  return createMessage(MSG_TYPES.DICE_ROLL, peerId, roll)
}

export function msgTilesShut (peerId, tiles) {
  return createMessage(MSG_TYPES.TILES_SHUT, peerId, { tiles })
}

export function msgTurnEnd (peerId, result) {
  return createMessage(MSG_TYPES.TURN_END, peerId, result)
}

export function msgGameOver (peerId, results) {
  return createMessage(MSG_TYPES.GAME_OVER, peerId, { results })
}

export function msgChat (peerId, text) {
  return createMessage(MSG_TYPES.CHAT, peerId, { text })
}

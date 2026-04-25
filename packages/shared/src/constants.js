export const TILES = [1, 2, 3, 4, 5, 6, 7, 8, 9]

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 4

export const DICE_COUNT = 2
export const DICE_SIDES = 6

// If the sum of remaining open tiles is <= this value, player rolls 1 die
export const SINGLE_DIE_THRESHOLD = 6

export const GAME_PHASES = {
  LOBBY: 'lobby',
  PLAYING: 'playing',
  FINISHED: 'finished'
}

export const TURN_STATES = {
  ROLLING: 'rolling',
  CHOOSING: 'choosing',
  DONE: 'done'
}

export const MSG_TYPES = {
  PLAYER_JOIN: 'player-join',
  PLAYER_READY: 'player-ready',
  GAME_START: 'game-start',
  GAME_STATE: 'game-state',
  DICE_ROLL: 'dice-roll',
  TILES_SHUT: 'tiles-shut',
  TURN_END: 'turn-end',
  ROUND_END: 'round-end',
  GAME_OVER: 'game-over',
  CHAT: 'chat',
  PING: 'ping',
  PONG: 'pong'
}

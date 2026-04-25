export const NUM_TILES = 12
export const TILES = Array.from({ length: NUM_TILES }, (_, i) => i + 1)

export const MIN_PLAYERS = 2
/** Max peers in a room. Turn order = fixed ring (see GameController). */
export const MAX_PLAYERS = 6

export const DICE_COUNT = 2
export const DICE_SIDES = 6

// If the sum of remaining open tiles is <= this value, player rolls 1 die
// Change this single value to adjust the threshold (like a #define in C)
export const SINGLE_DIE_THRESHOLD = 3

// Max hints each player can use per game to reveal valid combinations
export const MAX_HINTS = 3

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

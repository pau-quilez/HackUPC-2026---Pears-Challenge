import { EventLog } from './eventLog.js'  // FIXED: import EventLog

export async function loadMatchState (db, matchId) {
  const log = new EventLog(db, matchId)
  const events = await log.getAll()

  let state = {
    phase: 'lobby',
    players: [],
    currentPlayerIndex: 0,
    turnState: 'rolling',
    lastRoll: null,
    hostId: null,
    round: 1,
    matchId
  }

  for (const event of events) {
    state = applyEvent(state, event)
  }

  return state
}

export function applyEvent (state, event) {
  switch (event.type) {
    case 'GAME_START':
      return {
        ...state,
        phase: 'playing',
        players: event.payload.players ?? [],
        hostId: event.payload.hostId ?? state.hostId
      }

    case 'DICE_ROLLED':
      return {
        ...state,
        turnState: 'choosing',
        lastRoll: {
          values: event.payload.values ?? [],
          total: event.payload.total ?? 0,
          count: event.payload.count ?? 2
        }
      }

    case 'TILES_CLOSED':
      const playerIndex = state.currentPlayerIndex
      const player = state.players[playerIndex]
      if (!player) return state

      const newOpenTiles = player.openTiles.filter(tile => 
        !(event.payload.tiles ?? []).includes(tile)
      )

      return {
        ...state,
        players: [
          ...state.players.slice(0, playerIndex),
          { ...player, openTiles: newOpenTiles },
          ...state.players.slice(playerIndex + 1)
        ],
        turnState: 'done'
      }

    default:
      return state
  }
}
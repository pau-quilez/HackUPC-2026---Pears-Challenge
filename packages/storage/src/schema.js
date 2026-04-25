/**
 * Key schema for the Hyperbee database.
 *
 * Matches are stored under:
 *   match:<matchId>            -> { players, startedAt, finishedAt, winner }
 *
 * Events are stored under:
 *   event:<matchId>:<seq>      -> { type, from, payload, timestamp }
 *
 * Player stats:
 *   stats:<playerId>           -> { gamesPlayed, gamesWon, totalScore, bestScore }
 */

export function matchKey (matchId) {
  return `match:${matchId}`
}

export function eventKey (matchId, seq) {
  return `event:${matchId}:${String(seq).padStart(6, '0')}`
}

export function statsKey (playerId) {
  return `stats:${playerId}`
}

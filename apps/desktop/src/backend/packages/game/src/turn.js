import { rollDice } from './dice.js'
import { shouldRollOneDie, hasValidMove, findValidCombinations, calculateScore, isBoxShut } from './rules.js'
import { validateMove } from './validateMove.js'
import { MAX_HINTS } from '../../shared/src/index.js'

/**
 * Manages a single player's turn in Shut the Box.
 * Each turn = 1 roll + 1 tile selection, then next player.
 */
export class Turn {
  constructor (openTiles, hintsRemaining = MAX_HINTS) {
    this.openTiles = [...openTiles]
    this.lastRoll = null
    this.finished = false
    this.shutTheBox = false
    this.hintsRemaining = hintsRemaining
  }

  roll () {
    const count = shouldRollOneDie(this.openTiles) ? 1 : 2
    this.lastRoll = rollDice(count)
    return this.lastRoll
  }

  getValidMoves () {
    if (!this.lastRoll) return []
    return findValidCombinations(this.openTiles, this.lastRoll.total)
  }

  canMove () {
    if (!this.lastRoll) return false
    return hasValidMove(this.openTiles, this.lastRoll.total)
  }

  useHint () {
    if (this.hintsRemaining <= 0) return null
    this.hintsRemaining--
    return this.getValidMoves()
  }

  /**
   * Shut the chosen tiles. Returns updated open tiles or throws on invalid move.
   * After shutting, the turn ends (1 roll per turn).
   */
  shutTiles (chosenTiles) {
    const result = validateMove(this.openTiles, chosenTiles, this.lastRoll.total)
    if (!result.valid) {
      throw new Error(result.reason)
    }

    this.openTiles = this.openTiles.filter(t => !chosenTiles.includes(t))

    if (isBoxShut(this.openTiles)) {
      this.shutTheBox = true
    }

    this.finished = true
    this.lastRoll = null
    return this.openTiles
  }

  endTurn () {
    this.finished = true
    return {
      openTiles: this.openTiles,
      score: calculateScore(this.openTiles),
      shutTheBox: this.shutTheBox,
      hintsRemaining: this.hintsRemaining
    }
  }
}

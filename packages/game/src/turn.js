import { rollDice } from './dice.js'
import { shouldRollOneDie, hasValidMove, findValidCombinations, calculateScore, isBoxShut } from './rules.js'
import { validateMove } from './validateMove.js'

/**
 * Manages a single player's turn in Shut the Box.
 */
export class Turn {
  constructor (openTiles) {
    this.openTiles = [...openTiles]
    this.lastRoll = null
    this.finished = false
    this.shutTheBox = false
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

  /**
   * Shut the chosen tiles. Returns updated open tiles or throws on invalid move.
   */
  shutTiles (chosenTiles) {
    const result = validateMove(this.openTiles, chosenTiles, this.lastRoll.total)
    if (!result.valid) {
      throw new Error(result.reason)
    }

    this.openTiles = this.openTiles.filter(t => !chosenTiles.includes(t))

    if (isBoxShut(this.openTiles)) {
      this.finished = true
      this.shutTheBox = true
    }

    this.lastRoll = null
    return this.openTiles
  }

  endTurn () {
    this.finished = true
    return {
      openTiles: this.openTiles,
      score: calculateScore(this.openTiles),
      shutTheBox: this.shutTheBox
    }
  }
}

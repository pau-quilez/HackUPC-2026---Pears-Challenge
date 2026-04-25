import { sumTiles } from './rules.js'

/**
 * Validate that the chosen tiles can be shut.
 * @param {number[]} openTiles - Currently open tiles
 * @param {number[]} chosenTiles - Tiles the player wants to shut
 * @param {number} diceTotal - The dice roll total to match
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateMove (openTiles, chosenTiles, diceTotal) {
  if (!chosenTiles || chosenTiles.length === 0) {
    return { valid: false, reason: 'Must choose at least one tile' }
  }

  const uniqueChosen = [...new Set(chosenTiles)]
  if (uniqueChosen.length !== chosenTiles.length) {
    return { valid: false, reason: 'Duplicate tiles selected' }
  }

  for (const tile of chosenTiles) {
    if (!openTiles.includes(tile)) {
      return { valid: false, reason: `Tile ${tile} is not open` }
    }
  }

  const chosenSum = sumTiles(chosenTiles)
  if (chosenSum !== diceTotal) {
    return { valid: false, reason: `Tiles sum to ${chosenSum}, need ${diceTotal}` }
  }

  return { valid: true }
}

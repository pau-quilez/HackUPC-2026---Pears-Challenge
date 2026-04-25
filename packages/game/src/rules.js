import { TILES, SINGLE_DIE_THRESHOLD } from '@shut-the-box/shared'

export function createBoard () {
  return [...TILES]
}

export function sumTiles (tiles) {
  return tiles.reduce((sum, t) => sum + t, 0)
}

export function shouldRollOneDie (openTiles) {
  return sumTiles(openTiles) <= SINGLE_DIE_THRESHOLD
}

export function isBoxShut (openTiles) {
  return openTiles.length === 0
}

/**
 * Find all subsets of `openTiles` that sum to `target`.
 * Returns array of arrays, e.g. [[2,5], [3,4], [7]]
 */
export function findValidCombinations (openTiles, target) {
  const results = []

  function backtrack (start, current, remaining) {
    if (remaining === 0) {
      results.push([...current])
      return
    }
    if (remaining < 0) return

    for (let i = start; i < openTiles.length; i++) {
      current.push(openTiles[i])
      backtrack(i + 1, current, remaining - openTiles[i])
      current.pop()
    }
  }

  backtrack(0, [], target)
  return results
}

export function hasValidMove (openTiles, diceTotal) {
  return findValidCombinations(openTiles, diceTotal).length > 0
}

export function calculateScore (openTiles) {
  return sumTiles(openTiles)
}

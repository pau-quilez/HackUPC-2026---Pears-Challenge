import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  createBoard, rollDice, findValidCombinations,
  hasValidMove, calculateScore, isBoxShut, sumTiles, shouldRollOneDie
} from '@shut-the-box/game'
import { validateMove } from '@shut-the-box/game'
import { Turn } from '@shut-the-box/game'

describe('createBoard', () => {
  it('returns tiles 1-9', () => {
    const board = createBoard()
    assert.deepStrictEqual(board, [1, 2, 3, 4, 5, 6, 7, 8, 9])
  })
})

describe('rollDice', () => {
  it('rolls the specified number of dice', () => {
    const result = rollDice(2)
    assert.strictEqual(result.count, 2)
    assert.strictEqual(result.values.length, 2)
    assert.ok(result.total >= 2 && result.total <= 12)
  })

  it('rolls 1 die correctly', () => {
    const result = rollDice(1)
    assert.strictEqual(result.count, 1)
    assert.ok(result.total >= 1 && result.total <= 6)
  })
})

describe('findValidCombinations', () => {
  it('finds single-tile matches', () => {
    const combos = findValidCombinations([1, 2, 3, 4, 5], 3)
    assert.ok(combos.some(c => c.length === 1 && c[0] === 3))
  })

  it('finds multi-tile matches', () => {
    const combos = findValidCombinations([1, 2, 3, 4, 5], 7)
    assert.ok(combos.some(c => JSON.stringify(c) === JSON.stringify([2, 5])))
    assert.ok(combos.some(c => JSON.stringify(c) === JSON.stringify([3, 4])))
  })

  it('returns empty when no match', () => {
    const combos = findValidCombinations([9], 3)
    assert.strictEqual(combos.length, 0)
  })
})

describe('validateMove', () => {
  it('accepts valid tile choices', () => {
    const result = validateMove([1, 2, 3, 4, 5], [2, 3], 5)
    assert.ok(result.valid)
  })

  it('rejects wrong sum', () => {
    const result = validateMove([1, 2, 3, 4, 5], [2, 4], 5)
    assert.ok(!result.valid)
  })

  it('rejects tiles not open', () => {
    const result = validateMove([1, 3, 5], [2], 2)
    assert.ok(!result.valid)
  })
})

describe('shouldRollOneDie', () => {
  it('returns true when remaining tiles sum <= 6', () => {
    assert.ok(shouldRollOneDie([1, 2, 3]))
    assert.ok(shouldRollOneDie([6]))
  })

  it('returns false when sum > 6', () => {
    assert.ok(!shouldRollOneDie([1, 2, 3, 4]))
    assert.ok(!shouldRollOneDie([7, 8, 9]))
  })
})

describe('calculateScore', () => {
  it('sums remaining tiles', () => {
    assert.strictEqual(calculateScore([3, 7, 9]), 19)
  })

  it('returns 0 for empty (shut the box)', () => {
    assert.strictEqual(calculateScore([]), 0)
  })
})

describe('Turn', () => {
  it('tracks open tiles through a turn', () => {
    const turn = new Turn([1, 2, 3, 4, 5, 6, 7, 8, 9])
    assert.strictEqual(turn.openTiles.length, 9)
    assert.ok(!turn.finished)
  })
})

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  createBoard, rollDice, findValidCombinations,
  hasValidMove, calculateScore, isBoxShut, sumTiles, shouldRollOneDie
} from '@shut-the-box/game'
import { validateMove } from '@shut-the-box/game'
import { Turn } from '@shut-the-box/game'
import { NUM_TILES, SINGLE_DIE_THRESHOLD, MAX_HINTS } from '@shut-the-box/shared'

describe('createBoard', () => {
  it(`returns tiles 1-${NUM_TILES}`, () => {
    const board = createBoard()
    const expected = Array.from({ length: NUM_TILES }, (_, i) => i + 1)
    assert.deepStrictEqual(board, expected)
    assert.strictEqual(board.length, NUM_TILES)
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

  it('works with tiles up to 12', () => {
    const combos = findValidCombinations([10, 11, 12], 12)
    assert.ok(combos.some(c => c.length === 1 && c[0] === 12))
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
  it(`returns true when remaining tiles sum <= ${SINGLE_DIE_THRESHOLD}`, () => {
    assert.ok(shouldRollOneDie([1, 2]))
    assert.ok(shouldRollOneDie([3]))
    assert.ok(shouldRollOneDie([1]))
  })

  it(`returns false when sum > ${SINGLE_DIE_THRESHOLD}`, () => {
    assert.ok(!shouldRollOneDie([1, 2, 3]))
    assert.ok(!shouldRollOneDie([4]))
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

  it('handles tiles above 9', () => {
    assert.strictEqual(calculateScore([10, 11, 12]), 33)
  })
})

describe('Turn', () => {
  it(`starts with ${NUM_TILES} tiles and ${MAX_HINTS} hints`, () => {
    const turn = new Turn(createBoard())
    assert.strictEqual(turn.openTiles.length, NUM_TILES)
    assert.strictEqual(turn.hintsRemaining, MAX_HINTS)
    assert.ok(!turn.finished)
  })

  it('ends after shutting tiles (1 roll per turn)', () => {
    const turn = new Turn([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    turn.lastRoll = { values: [3, 4], total: 7, count: 2 }
    turn.shutTiles([3, 4])
    assert.ok(turn.finished)
    assert.ok(!turn.openTiles.includes(3))
    assert.ok(!turn.openTiles.includes(4))
  })

  it('useHint decrements hints and returns combinations', () => {
    const turn = new Turn([1, 2, 3])
    turn.lastRoll = { values: [1, 2], total: 3, count: 2 }
    const combos = turn.useHint()
    assert.ok(Array.isArray(combos))
    assert.strictEqual(turn.hintsRemaining, MAX_HINTS - 1)
  })

  it('useHint returns null when no hints left', () => {
    const turn = new Turn([1, 2, 3], 0)
    turn.lastRoll = { values: [1, 2], total: 3, count: 2 }
    assert.strictEqual(turn.useHint(), null)
  })
})

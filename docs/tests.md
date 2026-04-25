# Tests — Shut the Box P2P

## How to run

```bash
# Full test suite with descriptive catalog + spec results
npm test

# Quick run (no catalog)
npm run test:quick
```

`npm test` runs `tests/run.js`, which first displays a numbered catalog describing each test, then executes all tests using the `spec` reporter from `node:test`.

---

## Summary

| File | Module | Tests | What it covers |
|---|---|---|---|
| `game.test.js` | `@shut-the-box/game` | 19 | Game logic: board, dice, combinations, validation, scoring, turns, hints |
| `p2p.test.js` | `@shut-the-box/p2p` | 4 | Message protocol: creation, parsing, specific types, error tolerance |
| `storage.test.js` | `@shut-the-box/storage` | 3 | Hyperbee key schema: key format for matches, events, and stats |
| **Total** | | **26** | |

---

## game.test.js (19 tests)

Tests the pure game logic defined in `packages/game/`. No external dependencies or I/O.

### createBoard (1 test)

| # | Test | Description |
|---|---|---|
| 1 | `returns tiles 1-12` | Verifies `createBoard()` returns `[1, 2, ..., 12]` with exactly `NUM_TILES` elements. Uses `NUM_TILES` from `constants.js` so the test adapts automatically if tile count changes. |

### rollDice (2 tests)

| # | Test | Description |
|---|---|---|
| 2 | `rolls the specified number of dice` | Rolls 2 dice and checks: `count === 2`, array of 2 values, total between 2 and 12. |
| 3 | `rolls 1 die correctly` | Rolls 1 die and checks: `count === 1`, total between 1 and 6. |

### findValidCombinations (4 tests)

This function uses **backtracking** to find all subsets of open tiles whose sum equals the dice total. It is the core of the game logic.

| # | Test | Description |
|---|---|---|
| 4 | `finds single-tile matches` | Tiles `[1,2,3,4,5]`, target `3` → finds `[3]`. |
| 5 | `finds multi-tile matches` | Tiles `[1,2,3,4,5]`, target `7` → finds `[2,5]` and `[3,4]`. Verifies **all** valid combinations are returned. |
| 6 | `returns empty when no match` | Tiles `[9]`, target `3` → returns empty array. |
| 7 | `works with tiles up to 12` | Tiles `[10,11,12]`, target `12` → finds `[12]`. Verifies logic works with tiles > 9. |

### validateMove (3 tests)

Validates that a player's tile selection is legal before applying it.

| # | Test | Description |
|---|---|---|
| 8 | `accepts valid tile choices` | Tiles `[2,3]` sum to 5, both open in `[1,2,3,4,5]`, dice = 5 → `valid: true`. |
| 9 | `rejects wrong sum` | Tiles `[2,4]` sum to 6 but dice = 5 → `valid: false`, reason: "sum mismatch". |
| 10 | `rejects tiles not open` | Tile `[2]` not in board `[1,3,5]` → `valid: false`, reason: "tile not open". |

### shouldRollOneDie (2 tests)

Determines whether the player rolls 1 or 2 dice based on `SINGLE_DIE_THRESHOLD` (currently 3).

| # | Test | Description |
|---|---|---|
| 11 | `returns true when sum ≤ 3` | Tiles `[1,2]` (sum 3), `[3]` (sum 3), `[1]` (sum 1) → roll 1 die. |
| 12 | `returns false when sum > 3` | Tiles `[1,2,3]` (sum 6), `[4]` (sum 4), `[7,8,9]` (sum 24) → roll 2 dice. |

### calculateScore (3 tests)

A player's final score is the sum of their remaining open tiles. Lower = better.

| # | Test | Description |
|---|---|---|
| 13 | `sums remaining tiles` | Tiles `[3,7,9]` → score = 19. |
| 14 | `returns 0 for empty` | Tiles `[]` → score = 0 ("Shut the Box", best possible result). |
| 15 | `handles tiles above 9` | Tiles `[10,11,12]` → score = 33. |

### Turn (4 tests)

The `Turn` class manages a single player's turn. With current rules: 1 dice roll + 1 tile selection = turn over.

| # | Test | Description |
|---|---|---|
| 16 | `starts with 12 tiles and 3 hints` | A new Turn has 12 open tiles, 3 available hints, and `finished = false`. |
| 17 | `ends after shutting tiles` | After shutting tiles `[3,4]`, turn is marked `finished = true` and those tiles are removed. Verifies the 1-roll-per-turn rule. |
| 18 | `useHint works` | With tiles `[1,2,3]` and total 3, `useHint()` returns valid combinations and decrements `hintsRemaining` from 3 to 2. |
| 19 | `useHint exhausted` | A Turn created with 0 hints returns `null` from `useHint()` without throwing. |

---

## p2p.test.js (4 tests)

Tests the JSON message protocol that peers use to communicate. Defined in `packages/p2p/src/messages.js`.

### messages (4 tests)

| # | Test | Description |
|---|---|---|
| 20 | `creates and parses a message` | `createMessage('test-type', 'peer123', { hello: 'world' })` generates a JSON string. `parseMessage()` reconstructs it. Verifies all 4 fields: `type`, `from`, `payload`, `timestamp`. |
| 21 | `creates player join message` | `msgPlayerJoin('peer1', 'Alice')` generates a `player-join` message with `payload.name = 'Alice'`. This is the first message sent when a peer connects. |
| 22 | `creates dice roll message` | `msgDiceRoll('peer1', { values: [3,5], total: 8, count: 2 })` generates a `dice-roll` message with correct total in payload. |
| 23 | `returns null for invalid JSON` | `parseMessage('not json {{{')` returns `null` instead of throwing. Ensures corrupt messages don't crash the app. |

---

## storage.test.js (3 tests)

Tests the Hyperbee database key schema. Defined in `packages/storage/src/schema.js`. Hyperbee sorts keys lexicographically, so key format matters.

### schema keys (3 tests)

| # | Test | Description |
|---|---|---|
| 24 | `generates match keys` | `matchKey('abc123')` → `'match:abc123'`. Key for storing complete match data (players, winner, timestamps). |
| 25 | `generates event keys` | `eventKey('abc123', 0)` → `'event:abc123:000000'`. Sequence is zero-padded to 6 digits to maintain correct **lexicographic order** in Hyperbee. |
| 26 | `generates stats keys` | `statsKey('player1')` → `'stats:player1'`. Key for cumulative player statistics (games played, won, best score). |

---

## Configuration

Tests use the native Node.js test runner (`node:test`) with `assert/strict`. No external dependencies required.

| Setting | Value |
|---|---|
| Runner | `node:test` (native, Node.js ≥ 18) |
| Assertions | `node:assert/strict` |
| Reporter | `spec` (for `npm test`) / TAP (for `npm run test:quick`) |
| Custom runner | `tests/run.js` (catalog + spec reporter) |

### Available scripts

```bash
npm test            # Descriptive catalog + spec results
npm run test:quick  # Quick direct execution (TAP output)
```

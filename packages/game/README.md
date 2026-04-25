# @shut-the-box/game

Pure game logic and the event-driven **GameController** orchestrator.

## Files

| File | Purpose |
|---|---|
| `dice.js` | `rollDie()`, `rollDice(count)` — random dice rolling |
| `rules.js` | Board creation, valid combinations (backtracking), scoring, single-die threshold |
| `turn.js` | `Turn` class — manages one player's turn (roll → shut → end) |
| `validateMove.js` | Validates tile selections against open tiles and dice total |
| `controller.js` | `GameController` — full game lifecycle orchestrator (see below) |
| `index.js` | Public exports |

## GameController

The core of the application. An `EventEmitter` with **zero I/O** that drives the full game lifecycle:

**Lobby → Playing → Finished**

### Actions (called by UI)

| Method | When |
|---|---|
| `connect(name, room, mode)` | Join/create a P2P room (`mode`: `'create'` or `'join'`) |
| `startGame()` | Any player can start when 2-4 players are in the lobby |
| `roll()` | Roll dice during your turn |
| `shutTiles([3, 5])` | Shut selected tiles (must sum to dice total) |
| `useHint()` | Spend a hint to see valid combinations |

### Events (listened by UI)

| Event | Payload |
|---|---|
| `connected` | `{ myId }` |
| `lobby-updated` | `{ players }` |
| `player-joined` | `{ player, players }` |
| `player-left` | `{ player, players }` |
| `game-started` | `{ players, matchId }` |
| `round-start` | `{ round }` |
| `my-turn` | `{ player, round }` |
| `opponent-turn` | `{ player, round }` |
| `roll-result` | `{ player, roll, isMe }` |
| `has-valid-moves` | `{ player }` |
| `no-valid-moves` | `{ player, isMe }` |
| `tiles-shut` | `{ player, tiles, isMe }` |
| `round-done` | `{ player, openTiles, score, isMe }` |
| `shut-the-box` | `{ player, isMe }` |
| `game-over` | `{ results }` (sorted by score ascending) |
| `game-aborted` | `{ reason, results }` |
| `error` | `{ message }` |

### Design

- **Symmetric**: no host/guest distinction — any player can start.
- **Storage integrated**: logs events and persists results to Hyperbee via `@shut-the-box/storage`.
- **Failure tolerant**: handles peer disconnections, auto-skips disconnected players' turns, aborts if < 2 players remain.

## Game rules (configurable in `@shut-the-box/shared`)

| Parameter | Value | Constant |
|---|---|---|
| Tiles | 1–12 | `NUM_TILES` |
| Players | 2–4 | `MIN_PLAYERS` / `MAX_PLAYERS` |
| Dice | 2 six-sided | `DICE_COUNT` / `DICE_SIDES` |
| Single-die threshold | ≤ 3 | `SINGLE_DIE_THRESHOLD` |
| Hints per player | 3 | `MAX_HINTS` |
| Rolls per round | 1 | (hardcoded in `Turn`) |

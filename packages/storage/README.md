# @shut-the-box/storage

Persistent storage layer using **Hypercore** (append-only log) + **Hyperbee** (B-tree key-value store).

## What it stores

| Key pattern | Content | File |
|---|---|---|
| `match:<matchId>` | Match data (players, winner, timestamps) | `matchStore.js` |
| `event:<matchId>:<seq>` | Sequential game events (for replay/debug) | `eventLog.js` |
| `stats:<playerId>` | Cumulative player statistics | `matchStore.js` |

## Files

| File | Purpose |
|---|---|
| `db.js` | `createDatabase(path)` / `closeDatabase()` — Hypercore + Hyperbee setup |
| `schema.js` | Key generators (`matchKey`, `eventKey`, `statsKey`) |
| `eventLog.js` | `EventLog` class — append events, retrieve all events for a match |
| `matchStore.js` | `MatchStore` class — save/load matches, update player stats |
| `replay.js` | `loadMatchState()` — rebuild game state from stored events |

## Usage

```js
import { createDatabase, closeDatabase, EventLog, MatchStore } from '@shut-the-box/storage'

const { core, db } = await createDatabase('./data/matches/my-match')
const log = new EventLog(db, 'match-123')
const store = new MatchStore(db)

// Log events during the game
await log.append({ type: 'DICE_ROLLED', from: 'peer-id', payload: { total: 7 }, timestamp: Date.now() })

// Save match result
await store.saveMatch('match-123', { players: [...], finishedAt: Date.now(), winnerId: 'peer-id' })

// Update player stats
await store.updateStats('peer-id', 15, true)  // score=15, won=true

// Close when done
await closeDatabase({ core })
```

## Data location

All storage goes under the `data/` directory (git-ignored):

```
data/
  matches/<matchId>/    ← Hypercore files for each game
  test/                 ← Test databases (auto-cleaned)
```

Deleting `data/` is safe — it regenerates automatically on the next game.

## Design notes

- Each peer stores its own history locally (no replication for the hackathon).
- The GameController calls storage at: game start, dice roll, tiles shut, turn end, game over.
- Storage is a service layer — it contains zero game logic.

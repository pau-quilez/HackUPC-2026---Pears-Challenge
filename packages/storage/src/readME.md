Absolutely. Here’s a README you can drop into `packages/storage/README.md`. I wrote it for the person working on the GameController, so it explains what the storage layer does, how to call it, and what not to do. Hyperbee is an append-only B-tree on top of Hypercore, and Pear docs note that each app has its own storage and can keep append-only data locally or replicate it later if needed. [docs.pears](https://docs.pears.com/how-tos/share-append-only-databases-with-hyperbee)

***

# Storage package

This package handles persistence for the shut the box game.

It uses Hypercore + Hyperbee to store:

- match data.
- event history.
- player statistics.

The GameController should use this package as a storage service, not as game logic.

## What this package does

- Saves match data under `match:<matchId>`.
- Saves game events under `event:<matchId>:<seq>`.
- Saves player stats under `stats:<playerId>`.
- Rebuilds match state by replaying stored events.

Hyperbee is a good fit here because it gives you a key/value store with sorted iteration and append-only history on top of Hypercore. [hypercore-protocol.github](https://hypercore-protocol.github.io/new-website/guides/modules/hyperbee/)

## Main files

### `src/db.js`
Creates and closes the database.

```js
import { createDatabase, closeDatabase } from './db.js'
```

Use this once when the app starts, and close it when the app exits.

### `src/eventLog.js`
Stores the event history for one match.

```js
const log = new EventLog(db, matchId)
await log.append(event)
const events = await log.getAll()
```

This is the file the GameController will call while the match is running.

### `src/matchStore.js`
Stores the match snapshot and player stats.

```js
const store = new MatchStore(db)
await store.saveMatch(matchId, data)
const match = await store.getMatch(matchId)
await store.updateStats(playerId, score, won)
```

Use this when a game starts, ends, or needs stats updated.

### `src/replay.js`
Rebuilds the current game state from the saved events.

```js
const state = await loadMatchState(db, matchId)
```

This is useful when the UI or controller needs to recover a match after a restart.

### `src/schema.js`
Keeps all database keys in one place.

This helps keep the storage format consistent across the app.

### `src/index.js`
Exports the storage API from one place.

```js
export { createDatabase, closeDatabase } from './db.js'
export { EventLog } from './eventLog.js'
export { MatchStore } from './matchStore.js'
```

## How the GameController should use it

The GameController should do three things with this package:

1. Save events during the match.
2. Save the final result when the match ends.
3. Update player stats.

Typical flow:

```js
import { createDatabase, EventLog, MatchStore, loadMatchState } from '...'

const { core, db } = await createDatabase()
const log = new EventLog(db, matchId)
const store = new MatchStore(db)

await log.append({
  type: 'GAME_START',
  from: hostId,
  timestamp: Date.now(),
  payload: { players }
})

await log.append({
  type: 'DICE_ROLLED',
  from: playerId,
  timestamp: Date.now(),
  payload: { values: [4, 3], total: 7, count: 2 }
})

await store.saveMatch(matchId, {
  players,
  startedAt: Date.now()
})
```

At the end of the match:

```js
await store.saveMatch(matchId, {
  players,
  startedAt,
  finishedAt: Date.now(),
  winner: winnerId
})

await store.updateStats(winnerId, score, true)
await store.updateStats(loserId, score, false)
```

## Event format

Events should follow the shared message format:

```js
{
  type: 'GAME_START',
  from: 'peer-id',
  payload: { ... },
  timestamp: 1716382910289
}
```

The storage layer keeps the event as-is and stores it under the match prefix.

## Important notes

- Do not write directly to Hyperbee from the GameController.
- Always use `EventLog` or `MatchStore`.
- Keep game rules in the controller or game logic layer.
- Keep storage focused on persistence only.

## Local storage only

For the hackathon, local storage is enough.

That means:

- each peer stores its own history locally.
- no replication is required.
- no shared host database is needed.
- the app is simpler and easier to debug.

Pear docs also mention that each app has dedicated storage, which fits this approach well. [docs.pears](https://docs.pears.com/howto/share-append-only-databases-with-hyperbee.html)

## Current key layout

```txt
match:<matchId>
event:<matchId>:<seq>
stats:<playerId>
```

Example:

```txt
match:match-1
event:match-1:000000
event:match-1:000001
stats:peer-a1b2
```

## Good practices

- Use one database per app.
- Use one `EventLog` per match.
- Close the database when the app exits.
- Do not commit test storage folders.
- Keep all key names in `schema.js`.

Hypercore stores the data in the storage directory you pass in, so the database is persistent on disk for that app instance. [github](https://github.com/holepunchto/hypercore)

## For the team

If you are the GameController developer, your job is to call storage at these moments:

- when a game starts.
- when a player rolls dice.
- when a player closes tiles.
- when a turn ends.
- when the game ends.

That is enough for a solid first version.

## Example import

```js
import {
  createDatabase,
  closeDatabase,
  EventLog,
  MatchStore,
  loadMatchState
} from 'packages/storage/src/index.js'
```

***

If you want, I can also turn this into a **shorter, nicer README with Spanish comments removed and ready to commit**.
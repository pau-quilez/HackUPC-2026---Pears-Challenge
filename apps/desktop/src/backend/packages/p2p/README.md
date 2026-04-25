# @shut-the-box/p2p

P2P networking layer built on **Hyperswarm** (DHT-based peer discovery with UDP hole-punching).

## Files

| File | Purpose |
|---|---|
| `swarm.js` | `SwarmManager` — low-level Hyperswarm wrapper (join topic, broadcast, send to peer) |
| `room.js` | `Room` — high-level room abstraction (player registration, message routing) |
| `messages.js` | JSON message protocol — factory functions and parser |

## How it works

1. A **topic** is derived from the room name (SHA-256 hash → 32-byte buffer).
2. All peers `join()` the same topic via Hyperswarm DHT.
3. Hyperswarm handles NAT traversal and UDP hole-punching automatically.
4. Once connected, peers exchange JSON messages over encrypted streams.

## Room API

```js
import { Room } from '@shut-the-box/p2p'

const room = new Room('PlayerName')
await room.host('my-room')   // or room.join('my-room')

room.on('message', (msg) => { /* { type, from, payload, timestamp } */ })
room.on('peer-connected', (peerId) => { ... })
room.on('peer-disconnected', (peerId) => { ... })

room.broadcast(msgDiceRoll(room.myId, rollData))
await room.destroy()
```

## Message types

| Type | Factory | Purpose |
|---|---|---|
| `player-join` | `msgPlayerJoin(id, name)` | Announce player to peers |
| `game-start` | `msgGameStart(id, state)` | Broadcast game start with player order |
| `dice-roll` | `msgDiceRoll(id, roll)` | Share dice roll result |
| `tiles-shut` | `msgTilesShut(id, tiles)` | Share which tiles were shut |
| `turn-end` | `msgTurnEnd(id, result)` | End of turn with score and state |
| `game-over` | `msgGameOver(id, results)` | Final results and ranking |

## Design notes

- `Room` is **zero I/O** — no console.log, only events.
- The `GameController` owns the Room instance and handles all message logic.
- Same code works on Node.js and Pear Runtime (Hyperswarm is available natively in Pear).

# Message Protocol

All messages are JSON objects with this structure:

```json
{
  "type": "message-type",
  "from": "peer-public-key-hex",
  "payload": { ... },
  "timestamp": 1714000000000
}
```

## Message Types

| Type | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `player-join` | broadcast | `{ name }` | Player announces themselves |
| `player-ready` | broadcast | `{}` | Player is ready to start |
| `game-start` | host->all | `{ players, phase }` | Host starts the game |
| `game-state` | host->all | `{ full state }` | Full state sync |
| `dice-roll` | player->all | `{ values, total, count }` | Dice roll result |
| `tiles-shut` | player->all | `{ tiles }` | Tiles the player shut |
| `turn-end` | player->all | `{ score, shutTheBox, openTiles }` | Player's turn ended |
| `game-over` | host->all | `{ results }` | Final results |
| `chat` | broadcast | `{ text }` | Chat message |

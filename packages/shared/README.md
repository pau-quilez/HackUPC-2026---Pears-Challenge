# @shut-the-box/shared

Shared constants, configuration, and utility functions used by all other packages.

## Files

| File | Purpose |
|---|---|
| `constants.js` | Game configuration, phase/state enums, message type constants |
| `utils.js` | Crypto helpers (`generateId`, `createTopicBuffer`, `shortId`, `timestamp`, `sleep`) |

## Constants

### Game configuration

| Constant | Value | Description |
|---|---|---|
| `NUM_TILES` | 12 | Number of tiles on the board |
| `TILES` | `[1..12]` | Array of tile numbers |
| `MIN_PLAYERS` | 2 | Minimum players to start |
| `MAX_PLAYERS` | 4 | Maximum players allowed |
| `DICE_COUNT` | 2 | Number of dice |
| `DICE_SIDES` | 6 | Sides per die |
| `SINGLE_DIE_THRESHOLD` | 3 | Roll 1 die if open tiles sum ≤ this |
| `MAX_HINTS` | 3 | Hints available per player per game |

### Enums

- `GAME_PHASES`: `LOBBY`, `PLAYING`, `FINISHED`
- `TURN_STATES`: `ROLLING`, `CHOOSING`, `DONE`
- `MSG_TYPES`: all P2P message type strings

## Utilities

```js
import { generateId, shortId, createTopicBuffer, timestamp } from '@shut-the-box/shared'

generateId()                  // 32-char hex string (crypto.randomBytes)
shortId('abcdef1234567890')   // 'abcdef12' (first 8 chars)
createTopicBuffer('my-room')  // 32-byte SHA-256 buffer
timestamp()                   // Date.now()
```

## Design notes

- This package has **zero external dependencies**.
- All other packages import from here — changing a constant here changes the entire game.

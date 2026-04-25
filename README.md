# Shut the Box - P2P Edition

> **HackUPC 2026 - Pear Protocol Challenge**

A fully decentralized, peer-to-peer multiplayer **Shut the Box** game. No servers, no cloud — just peers connected via Hyperswarm DHT hole-punching.

---

## How the Game Works

**Shut the Box** is a classic dice game:

1. The board has **9 tiles** numbered 1-9
2. On your turn, **roll 2 dice** (or 1 die if your remaining tiles sum to 6 or less)
3. **Shut (close) tiles** whose values add up to the dice total
4. Keep rolling and shutting until you can't make a valid combination
5. Your **score** = sum of remaining open tiles (lower is better)
6. **Shut the Box** = close all tiles = score 0 (best possible!)
7. All players take turns, **lowest score wins**

Supports **2-4 players** connected peer-to-peer.

---

## Tech Stack

| Category | Technology |
| :--- | :--- |
| **Runtime** | Node.js (ESM) |
| **P2P Networking** | Hyperswarm (DHT-based swarming, UDP hole-punching) |
| **Data Storage** | Hypercore + Hyperbee (append-only log + B-tree KV store) |
| **Desktop UI** | Pear Protocol (planned) |
| **CLI** | Node.js readline |

---

## Project Structure

```
shut-the-box-p2p/
├── apps/
│   ├── cli/                    # CLI game client (playable now!)
│   │   ├── index.js
│   │   └── package.json
│   └── desktop/                # Pear Desktop UI (planned)
│       ├── index.html
│       ├── src/
│       │   ├── main.js
│       │   ├── ui/             # LobbyView, GameView, Board
│       │   ├── styles/
│       │   └── assets/
│       └── package.json
├── packages/
│   ├── shared/                 # Constants, types, utilities
│   │   └── src/
│   │       ├── constants.js    # Tiles, dice, game phases, message types
│   │       ├── types.js        # JSDoc type definitions
│   │       └── utils.js        # Crypto helpers, topic buffer, IDs
│   ├── game/                   # Game logic (pure, no I/O)
│   │   └── src/
│   │       ├── dice.js         # Dice rolling
│   │       ├── rules.js        # Board, combinations, scoring
│   │       ├── turn.js         # Turn state machine
│   │       └── validateMove.js # Move validation
│   ├── p2p/                    # P2P networking layer
│   │   └── src/
│   │       ├── swarm.js        # Hyperswarm wrapper
│   │       ├── room.js         # Room management (host/join)
│   │       └── messages.js     # JSON message protocol
│   └── storage/                # Persistent storage
│       └── src/
│           ├── db.js           # Hyperbee database setup
│           ├── schema.js       # Key schema for matches/events/stats
│           ├── eventLog.js     # Append-only event log
│           └── matchStore.js   # Match & player stats persistence
├── tests/                      # Unit tests
│   ├── game.test.js
│   ├── p2p.test.js
│   └── storage.test.js
├── docs/                       # Documentation
├── package.json                # Root workspace config
├── .gitignore
└── README.md
```

### Module Responsibilities

| Module | What it does | Dependencies |
| :--- | :--- | :--- |
| `@shut-the-box/shared` | Constants, types, utility functions | None |
| `@shut-the-box/game` | All game rules, dice, turns, validation | shared |
| `@shut-the-box/p2p` | Hyperswarm connections, rooms, messaging | shared, hyperswarm |
| `@shut-the-box/storage` | Hyperbee persistence, match/event history | shared, hypercore, hyperbee |
| `@shut-the-box/cli` | Interactive CLI client | game, p2p, storage, shared |
| `@shut-the-box/desktop` | Pear desktop UI (planned) | game, p2p, storage, shared |

---

## Getting Started

### Prerequisites

- **Node.js** >= 18.0.0

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd shut-the-box-p2p

# Install all dependencies (npm workspaces handles linking)
npm install
```

### Running the Game (CLI)

You need **2 or more terminals** on the same machine (or different machines on the same network).

**Terminal 1 — Host the game:**

```bash
# Windows (PowerShell or CMD)
node apps/cli/index.js --host

# Linux / macOS
node apps/cli/index.js --host
```

**Terminal 2 (and 3, 4) — Join the game:**

```bash
node apps/cli/index.js --join
```

**Steps:**
1. Each player enters their name
2. All players enter the **same room name** (this creates a shared topic on the DHT)
3. The host waits for all players to connect, then types `y` to start
4. Players take turns rolling dice and shutting tiles
5. Lowest score wins!

### Running Tests

```bash
npm test
```

### Quick Commands Reference

| Command | Description |
| :--- | :--- |
| `npm install` | Install all dependencies |
| `npm test` | Run unit tests |
| `node apps/cli/index.js --host` | Start a game as host |
| `node apps/cli/index.js --join` | Join an existing game |

---

## Roadmap

- [x] Game logic (dice, tiles, turns, scoring, validation)
- [x] P2P networking (Hyperswarm room-based discovery)
- [x] Message protocol (JSON over Hyperswarm connections)
- [x] CLI client (fully playable)
- [ ] Persistent match history (Hyperbee)
- [ ] Desktop UI (Pear Protocol)
- [ ] Cross-machine play (already supported by Hyperswarm DHT)
- [ ] Spectator mode
- [ ] Multiple rounds per match

---

## License

MIT

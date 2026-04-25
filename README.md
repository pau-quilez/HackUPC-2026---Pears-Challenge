# Shut the Box - P2P Edition

> **HackUPC 2026 - Pear Protocol Challenge**

A fully decentralized, peer-to-peer multiplayer **Shut the Box** game. No servers, no cloud — just peers connected via Hyperswarm DHT hole-punching.

---

## How the Game Works

**Shut the Box** is a classic dice game:

1. The board has **12 tiles** numbered 1-12
2. On your turn, **roll 2 dice** (or 1 die if your remaining tiles sum to 3 or less)
3. **Shut (close) tiles** whose values add up to the dice total
4. Each round you get **1 roll** — shut tiles, then next player
5. If you can't make a valid combination, you're **eliminated**
6. Your **score** = sum of remaining open tiles (lower is better)
7. **Shut the Box** = close all tiles = score 0 (best possible!)
8. All players take turns, **lowest score wins**
9. Each player gets **3 hints** per game (type `hint` to see valid combos)

Supports **2-4 players** connected peer-to-peer. **No host** — any player can start the game.

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
│   │   ├── index.js            # Thin adapter — only renders & routes input
│   │   └── package.json
│   └── desktop/                # Pear Desktop UI (planned)
│       ├── index.html
│       └── src/
├── packages/
│   ├── shared/                 # Constants, utilities
│   │   └── src/
│   │       ├── constants.js    # Tiles, dice, game phases, message types
│   │       └── utils.js        # Crypto helpers, topic buffer, IDs
│   ├── game/                   # Game logic (pure, no I/O)
│   │   └── src/
│   │       ├── dice.js         # Dice rolling
│   │       ├── rules.js        # Board, combinations, scoring
│   │       ├── turn.js         # Turn state machine
│   │       ├── validateMove.js # Move validation
│   │       ├── controller.js   # GameController (event-driven orchestrator)
│   │       └── index.js        # Public exports
│   ├── p2p/                    # P2P networking layer
│   │   └── src/
│   │       ├── swarm.js        # Hyperswarm wrapper
│   │       ├── room.js         # Room management (create/join)
│   │       └── messages.js     # JSON message protocol
│   └── storage/                # Persistent storage (Hyperbee)
│       └── src/
│           ├── db.js           # Database setup
│           ├── schema.js       # Key schema (match/event/stats)
│           ├── eventLog.js     # Append-only event log
│           └── matchStore.js   # Match & player stats persistence
├── data/                       # Local storage (git-ignored)
│   ├── matches/                # Game data per match
│   └── test/                   # Test storage
├── tests/                      # Unit tests
│   ├── game.test.js
│   ├── p2p.test.js
│   ├── storage.test.js
│   └── run.js                  # Custom test runner with catalog
├── docs/                       # Documentation
├── TAREAS.md                   # Task breakdown (Spanish)
├── package.json                # Root workspace config
├── .gitignore
└── README.md
```

### Module Responsibilities

| Module | What it does | Dependencies |
| :--- | :--- | :--- |
| `@shut-the-box/shared` | Constants, utility functions | None |
| `@shut-the-box/game` | Game rules, dice, turns, validation, GameController | shared, p2p, storage |
| `@shut-the-box/p2p` | Hyperswarm connections, rooms, messaging | shared, hyperswarm |
| `@shut-the-box/storage` | Hyperbee persistence, match/event history | shared, hypercore, hyperbee |
| `@shut-the-box/cli` | Interactive CLI client (thin adapter) | game, shared |
| `@shut-the-box/desktop` | Pear desktop UI (planned) | game, shared |

---

## Getting Started

### Prerequisites

- **Node.js** >= 18.0.0

### Installation

```bash
git clone <repo-url>
cd shut-the-box-p2p
npm install
```

### Running the Game (CLI)

You need **2 or more terminals** (same machine or different machines on the network).

**Terminal 1:**

```bash
node apps/cli/index.js
```

**Terminal 2 (and 3, 4):**

```bash
node apps/cli/index.js
```

**Steps:**
1. Enter your name
2. Choose: **1** to create a game, **2** to join
3. All players enter the **same room name** (creates a shared topic on the DHT)
4. In the lobby, press ENTER to refresh player list
5. **Any player** can type `start` to begin when there are 2+ players
6. Take turns rolling dice and shutting tiles
7. Type `hint` to see valid combinations (3 hints per game)
8. Lowest score wins!

### Running Tests

```bash
npm test
```

### Quick Commands Reference

| Command | Description |
| :--- | :--- |
| `npm install` | Install all dependencies |
| `npm test` | Run full test suite with catalog |
| `npm run test:quick` | Quick tests without catalog |
| `node apps/cli/index.js` | Start the game |

---

## Architecture

### GameController (event-driven)

The `GameController` in `packages/game/src/controller.js` is the core orchestrator:

- **Zero I/O** — no console.log, no readline
- **Event emitter** — UI layers listen and render
- **Action-based** — UI calls `roll()`, `shutTiles()`, `startGame()`
- **Symmetric** — no host/guest distinction, any player can start
- **Storage integrated** — logs events and persists match results to Hyperbee

```
UI (CLI/Desktop)  ←→  GameController  ←→  Room (P2P)  ←→  Other Peers
                           ↕
                      Storage (Hyperbee)
```

### Failure Tolerance

- Peer disconnections are detected and the player is removed
- If a player disconnects during their turn, it's automatically skipped
- If fewer than 2 players remain, the game is aborted with partial results

---

## Roadmap

- [x] Game logic (dice, tiles, turns, scoring, validation)
- [x] P2P networking (Hyperswarm room-based discovery)
- [x] Message protocol (JSON over Hyperswarm connections)
- [x] CLI client (fully playable)
- [x] GameController (event-driven, decoupled from I/O)
- [x] Persistent match history (Hyperbee)
- [x] Failure tolerance (peer disconnect handling)
- [ ] Desktop UI (Pear Protocol)
- [ ] Cross-machine play testing
- [ ] Deploy with Pear (pear:// link)

---

## License

MIT

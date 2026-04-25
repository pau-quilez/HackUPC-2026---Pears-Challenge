# Shut the Box — P2P Edition

> **HackUPC 2026 — Pear Protocol Challenge**

A fully decentralized, peer-to-peer multiplayer **Shut the Box** dice game. No servers, no cloud — just peers connected via Hyperswarm DHT hole-punching.

---

## Game Rules

### Overview

Shut the Box is a classic dice game where players try to "shut" (close) numbered tiles by rolling dice. The goal is to close as many tiles as possible — **lowest score wins**.

### Setup

- The board has **12 tiles** numbered **1 through 12**, all starting open.
- **2 to 6 players** can play in the same game (see `MAX_PLAYERS` in `@shut-the-box/shared`).

### Turn order (round-robin / token ring)

- At **game start**, all peers agree on the same ordered list: players are sorted by **peer id** (string compare).
- Each **round**, play passes **once** over that list: player 0 → 1 → … → n−1.
- The next **round** repeats the **same** order. Players who are eliminated or who shut the box are **skipped** but their slot stays in the list so everyone stays in sync.
- This is a fixed **round-robin** schedule — there is no random turn order; it matches a token passing around a ring.
- Each player gets **3 hints** per game (to reveal valid tile combinations).

### How a round works

1. **Roll dice**: the active player rolls dice.
   - Roll **2 dice** (values 2–12) normally.
   - Roll **1 die** (values 1–6) if the sum of your remaining open tiles is **3 or less**.
2. **Shut tiles**: choose one or more open tiles whose values **add up exactly** to the dice total.
   - Example: you roll a **7** → you could shut `[7]`, or `[3, 4]`, or `[1, 2, 4]`, or `[2, 5]`, etc.
   - Only tiles that are still open can be selected.
3. **End of turn**: after shutting tiles, your turn ends and the next player goes.
   - You only get **1 roll per round** (no re-rolls).

### Elimination

- If you roll and there is **no valid combination** of open tiles that sums to the dice total, you are **eliminated** from the game.
- Your score is locked at the sum of your remaining open tiles.

### Scoring

- **Score = sum of your remaining open tiles** (lower is better).
- **Shut the Box** = all tiles closed = **score 0** (the best possible result!).

### Winning

- The player with the **lowest score** wins.
- If multiple players have the same score, it's a **tie** (shared victory).

### Hints

- During your turn, after rolling, you can type **`hint`** to see all valid tile combinations.
- Each player has **3 hints** for the entire game — use them wisely!

### Example turn

```
Your tiles:  [1] [2] [3] [4] [5] [6] [7] [8] [9] [10] [11] [12]
You roll:    [4, 3] = 7

Valid options:
  1) [7]
  2) [3, 4]
  3) [2, 5]
  4) [1, 6]
  5) [1, 2, 4]

You choose:  3, 4
Result:      tiles 3 and 4 are now shut.

Your tiles:  [1] [2] [X] [X] [5] [6] [7] [8] [9] [10] [11] [12]
```

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 18.0.0

### Installation

```bash
git clone https://github.com/pau-quilez/HackUPC-2026---Pears-Challenge.git
cd shut-the-box-p2p
npm install
```

### Play

Open **2 or more terminals** and run in each:

```bash
node apps/cli/index.js
```

1. Enter your name
2. Choose **1** (create) or **2** (join)
3. Enter the **same room name** in all terminals
4. Type **`start`** when everyone is in the lobby
5. Play! Type tile numbers to shut them (e.g. `3,5`), type `hint` for help

### Run tests

```bash
npm test
```

---

## Tech Stack

| Category | Technology |
|---|---|
| **Runtime** | Node.js (ESM) |
| **P2P Networking** | [Hyperswarm](https://github.com/holepunchto/hyperswarm) — DHT swarming + UDP hole-punching |
| **Data Storage** | [Hypercore](https://github.com/holepunchto/hypercore) + [Hyperbee](https://github.com/holepunchto/hyperbee) — append-only log + B-tree KV store |
| **Desktop UI** | [Pear Protocol](https://pears.com/) (planned) |
| **CLI** | Node.js `readline` |

---

## Project Structure

```
shut-the-box-p2p/
├── apps/
│   ├── cli/                 → CLI game client
│   └── desktop/             → Pear Desktop UI (planned)
├── packages/
│   ├── shared/              → Constants and utilities
│   ├── game/                → Game logic + GameController
│   ├── p2p/                 → P2P networking (Hyperswarm)
│   └── storage/             → Persistent storage (Hyperbee)
├── data/                    → Local game data (git-ignored, auto-generated)
├── tests/                   → Unit tests (26 tests)
├── docs/                    → Documentation
└── TAREAS.md                → Task breakdown
```

### Package documentation

Each package has its own README with detailed API documentation:

| Package | README | Description |
|---|---|---|
| `@shut-the-box/shared` | [`packages/shared/README.md`](packages/shared/README.md) | Constants, configuration, utility functions |
| `@shut-the-box/game` | [`packages/game/README.md`](packages/game/README.md) | Game rules, dice, turns, GameController |
| `@shut-the-box/p2p` | [`packages/p2p/README.md`](packages/p2p/README.md) | Hyperswarm rooms, message protocol |
| `@shut-the-box/storage` | [`packages/storage/README.md`](packages/storage/README.md) | Hyperbee persistence, event log, match store |
| CLI | [`apps/cli/README.md`](apps/cli/README.md) | How to run, CLI commands |

### Additional docs

- [Test documentation](docs/tests.md) — detailed description of all 26 tests

---

## Architecture

```
┌──────────────┐     events      ┌──────────────────┐    broadcast    ┌──────────────┐
│   CLI / UI   │ ◄────────────── │  GameController   │ ──────────────► │  Other Peers  │
│  (thin layer)│ ──────────────► │  (event emitter)  │ ◄────────────── │  (Hyperswarm) │
└──────────────┘     actions     └────────┬─────────┘    messages     └──────────────┘
                                          │
                                          ▼
                                  ┌──────────────┐
                                  │   Hyperbee   │
                                  │  (local DB)  │
                                  └──────────────┘
```

- **Symmetric model**: no host — any player can create or join, any player can start.
- **Zero I/O in packages**: all console output lives in the CLI adapter only.
- **Failure tolerant**: disconnections are handled, turns skipped, game aborted if < 2 players.

### Data storage

Game data is stored locally under `data/` (git-ignored). Each match creates its own Hypercore + Hyperbee database.

**Deleting `data/` is safe** — it regenerates automatically on the next game. No data is shared between peers; each peer stores its own history.

---

## Commands Reference

| Command | Description |
|---|---|
| `npm install` | Install all dependencies |
| `npm test` | Run full test suite (26 tests) with catalog |
| `npm run test:quick` | Quick tests without catalog |
| `node apps/cli/index.js` | Start the game |

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
- [ ] Deploy with Pear (`pear://` link)

---

## License

MIT

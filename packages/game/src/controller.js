import { EventEmitter } from 'node:events'
import { Room } from '@shut-the-box/p2p'
import {
  msgGameStart, msgDiceRoll, msgTilesShut,
  msgTurnEnd, msgGameOver
} from '@shut-the-box/p2p'
import { createDatabase, closeDatabase, EventLog, MatchStore } from '@shut-the-box/storage'
import { Turn } from './turn.js'
import { createBoard, calculateScore } from './rules.js'
import {
  GAME_PHASES, MSG_TYPES, MAX_HINTS,
  MIN_PLAYERS, MAX_PLAYERS, generateId, timestamp
} from '@shut-the-box/shared'

/**
 * GameController — orchestrates the full game lifecycle (tasks 4.1-4.5).
 * Zero I/O: no console.log, no readline.
 * The UI layer (CLI or Desktop) listens to events and calls actions.
 *
 * ── EVENTS emitted ───────────────────────────────────────────────────
 *  'waiting'          ({ isHost })
 *  'lobby-updated'    ({ players })
 *  'player-joined'    ({ player, players })
 *  'player-left'      ({ peerId, players })
 *  'game-started'     ({ players, matchId })
 *  'round-start'      ({ round })
 *  'my-turn'          ({ player, round })
 *  'opponent-turn'    ({ player, round })
 *  'player-skipped'   ({ player })
 *  'roll-result'      ({ player, roll, isMe })
 *  'no-valid-moves'   ({ player, isMe })
 *  'tiles-shut'       ({ player, tiles, isMe })
 *  'round-done'       ({ player, openTiles, score, isMe })
 *  'shut-the-box'     ({ player, isMe })
 *  'game-over'        ({ results })          results sorted asc by score
 *  'error'            ({ message })
 *
 * ── ACTIONS the UI calls ─────────────────────────────────────────────
 *  await controller.connect(name, roomName, asHost)
 *  controller.startGame()
 *  controller.roll()
 *  controller.shutTiles(tiles[])
 *  controller.useHint()   → returns combos[] or null
 *  await controller.destroy()
 *
 * ── READ-ONLY STATE ──────────────────────────────────────────────────
 *  controller.state  →  { phase, players, myId, isHost, round,
 *                         currentPlayerIndex, hintsRemaining }
 */
export class GameController extends EventEmitter {
  constructor () {
    super()
    this.room = null
    this.phase = GAME_PHASES.LOBBY
    this.players = []
    this.currentPlayerIndex = 0
    this.myId = null
    this.isHost = false
    this.round = 0
    this.matchId = null

    // Storage handles (initialized when game starts)
    this._db = null
    this._dbCore = null
    this._eventLog = null
    this._matchStore = null

    // Internal promise resolvers for async flow control
    this._rollResolve = null       // resolved when UI calls roll()
    this._shutResolve = null       // resolved when UI calls shutTiles()
    this._opponentResolve = null   // resolved when opponent's turn-end arrives
    this._startGameResolve = null  // resolved when host calls startGame()
    this._guestStartResolve = null // resolved when game-start msg arrives

    // Active Turn object (only set during our own turn, before tiles are shut)
    this._activeTurn = null
  }

  // ──────────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────────

  /** Connect to a P2P room and drive the full lifecycle. */
  async connect (name, roomName, asHost) {
    this.isHost = asHost
    this.room = new Room(name)

    this.room.on('message', (msg) => this._handleMessage(msg))
    this.room.on('peer-disconnected', (peerId) => {
      this.players = this.players.filter(p => p.id !== peerId)
      this.emit('player-left', { peerId, players: this.players })
      this.emit('lobby-updated', { players: this.players })
    })

    if (asHost) {
      await this.room.host(roomName)
    } else {
      await this.room.join(roomName)
    }

    this.myId = this.room.myId
    this.players.push(this._makePlayer(this.myId, name))

    this.emit('waiting', { isHost: this.isHost })

    if (asHost) {
      // 4.2: Host waits in lobby until startGame() is called
      await this._lobbyPhase()
    } else {
      // Guest waits for game-start message from host
      await new Promise(resolve => { this._guestStartResolve = resolve })
      await this._gameLoop()
    }
  }

  /**
   * 4.2: Host calls this to start the game.
   * Validates min/max players before proceeding.
   */
  startGame () {
    if (!this.isHost) {
      return this.emit('error', { message: 'Only the host can start the game' })
    }
    if (this.phase !== GAME_PHASES.LOBBY) {
      return this.emit('error', { message: 'Game already started' })
    }
    if (this.players.length < MIN_PLAYERS) {
      return this.emit('error', { message: `Need at least ${MIN_PLAYERS} players (have ${this.players.length})` })
    }
    if (this.players.length > MAX_PLAYERS) {
      return this.emit('error', { message: `Too many players (max ${MAX_PLAYERS})` })
    }
    if (this._startGameResolve) {
      this._startGameResolve()
      this._startGameResolve = null
    }
  }

  /** 4.3: Roll dice — only valid during our turn, before tiles are selected. */
  roll () {
    if (!this._activeTurn) {
      return this.emit('error', { message: 'Not your turn' })
    }
    if (this._activeTurn.lastRoll) {
      return this.emit('error', { message: 'Already rolled this turn' })
    }
    const roll = this._activeTurn.roll()
    const me = this._getMyPlayer()
    this.room.broadcast(msgDiceRoll(this.myId, roll))
    this.emit('roll-result', { player: me, roll, isMe: true })

    if (this._rollResolve) {
      this._rollResolve(roll)
      this._rollResolve = null
    }
  }

  /** 4.3: Shut tiles — only valid during our turn, after rolling. */
  shutTiles (tiles) {
    if (!this._activeTurn) {
      return this.emit('error', { message: 'Not your turn' })
    }
    if (!this._activeTurn.lastRoll) {
      return this.emit('error', { message: 'Roll first' })
    }
    try {
      this._activeTurn.shutTiles(tiles)
      const me = this._getMyPlayer()
      this.room.broadcast(msgTilesShut(this.myId, tiles))
      this.emit('tiles-shut', { player: me, tiles, isMe: true })
      if (this._shutResolve) {
        this._shutResolve(tiles)
        this._shutResolve = null
      }
    } catch (err) {
      this.emit('error', { message: err.message })
    }
  }

  /** Returns valid combinations for the current roll, or null if no hints left. */
  useHint () {
    if (!this._activeTurn) {
      this.emit('error', { message: 'Not your turn' })
      return null
    }
    return this._activeTurn.useHint()
  }

  async destroy () {
    if (this._dbCore) {
      await closeDatabase({ core: this._dbCore })
      this._db = null
      this._dbCore = null
    }
    if (this.room) {
      await this.room.destroy()
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // Read-only state snapshot
  // ──────────────────────────────────────────────────────────────────

  get state () {
    return {
      phase: this.phase,
      players: this.players,
      myId: this.myId,
      isHost: this.isHost,
      round: this.round,
      matchId: this.matchId,
      currentPlayerIndex: this.currentPlayerIndex,
      hintsRemaining: this._activeTurn?.hintsRemaining ?? null
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // Internal: player helpers
  // ──────────────────────────────────────────────────────────────────

  _makePlayer (id, name) {
    return {
      id,
      name,
      openTiles: createBoard(),
      score: 0,
      finished: false,
      shutTheBox: false,
      hintsRemaining: MAX_HINTS
    }
  }

  _getMyPlayer () {
    return this.players.find(p => p.id === this.myId)
  }

  _allPlayersFinished () {
    return this.players.every(p => p.finished || p.shutTheBox)
  }

  // ──────────────────────────────────────────────────────────────────
  // Internal: storage
  // ──────────────────────────────────────────────────────────────────

  async _initStorage () {
    this.matchId = generateId()
    const storagePath = `./data/matches/${this.matchId.slice(0, 8)}`
    const { core, db } = await createDatabase(storagePath)
    this._dbCore = core
    this._db = db
    this._eventLog = new EventLog(db, this.matchId)
    this._matchStore = new MatchStore(db)
  }

  async _logEvent (type, payload = {}) {
    if (!this._eventLog) return
    try {
      await this._eventLog.append({ type, from: this.myId, payload, timestamp: timestamp() })
    } catch (_) {}
  }

  // ──────────────────────────────────────────────────────────────────
  // Internal: 4.2 Lobby phase
  // ──────────────────────────────────────────────────────────────────

  async _lobbyPhase () {
    await new Promise(resolve => { this._startGameResolve = resolve })

    this.phase = GAME_PHASES.PLAYING
    this.room.broadcast(msgGameStart(this.myId, {
      players: this.players.map(p => ({ id: p.id, name: p.name })),
      phase: GAME_PHASES.PLAYING
    }))

    await this._startGame()
    await this._gameLoop()
  }

  async _startGame () {
    await this._initStorage()
    await this._matchStore.saveMatch(this.matchId, {
      players: this.players.map(p => ({ id: p.id, name: p.name })),
      startedAt: timestamp()
    })
    await this._logEvent('GAME_START', {
      players: this.players.map(p => ({ id: p.id, name: p.name }))
    })
    this.emit('game-started', { players: this.players, matchId: this.matchId })
  }

  // ──────────────────────────────────────────────────────────────────
  // Internal: 4.3 Playing phase — round loop
  // ──────────────────────────────────────────────────────────────────

  async _gameLoop () {
    while (!this._allPlayersFinished()) {
      this.round++
      this.emit('round-start', { round: this.round })

      for (let i = 0; i < this.players.length; i++) {
        this.currentPlayerIndex = i
        const player = this.players[i]

        if (player.finished || player.shutTheBox) {
          this.emit('player-skipped', { player })
          continue
        }

        if (player.id === this.myId) {
          await this._playMyTurn(player)
        } else {
          // 4.3: In opponent's turn, just receive and display their actions
          this.emit('opponent-turn', { player, round: this.round })
          await new Promise(resolve => { this._opponentResolve = resolve })
        }
      }
    }

    // 4.4: All players done — compute ranking
    await this._finishGame()
  }

  // ──────────────────────────────────────────────────────────────────
  // Internal: 4.3 My turn
  // ──────────────────────────────────────────────────────────────────

  async _playMyTurn (player) {
    this._activeTurn = new Turn(player.openTiles, player.hintsRemaining)
    this.emit('my-turn', { player, round: this.round })

    // Wait for UI to call roll()
    await new Promise(resolve => { this._rollResolve = resolve })
    const roll = this._activeTurn.lastRoll
    await this._logEvent('DICE_ROLLED', { values: roll.values, total: roll.total, count: roll.count })

    if (!this._activeTurn.canMove()) {
      // No valid combinations — player is eliminated from further rounds
      this.emit('no-valid-moves', { player, isMe: true })
      player.finished = true
      const result = this._activeTurn.endTurn()
      this._applyTurnResult(player, result)
      await this._logEvent('TURN_END', { openTiles: result.openTiles, score: result.score, finished: true })
      this.room.broadcast(msgTurnEnd(this.myId, { ...result, finished: true }))
      this._activeTurn = null
      return
    }

    // Wait for UI to call shutTiles()
    await new Promise(resolve => { this._shutResolve = resolve })
    const tiles = this._activeTurn.openTiles  // already updated inside shutTiles()

    await this._logEvent('TILES_SHUT', { tiles })

    const result = this._activeTurn.endTurn()
    this._applyTurnResult(player, result)
    this._activeTurn = null

    if (result.shutTheBox) {
      await this._logEvent('SHUT_THE_BOX', { score: 0 })
      this.emit('shut-the-box', { player, isMe: true })
      this.room.broadcast(msgTurnEnd(this.myId, { ...result, finished: true }))
    } else {
      await this._logEvent('TURN_END', { openTiles: result.openTiles, score: result.score, finished: false })
      this.emit('round-done', { player, openTiles: result.openTiles, score: result.score, isMe: true })
      this.room.broadcast(msgTurnEnd(this.myId, { ...result, finished: false }))
    }
  }

  _applyTurnResult (player, result) {
    player.openTiles = result.openTiles
    player.score = result.score
    player.shutTheBox = result.shutTheBox
    player.hintsRemaining = result.hintsRemaining
  }

  // ──────────────────────────────────────────────────────────────────
  // Internal: 4.4 Finished phase
  // ──────────────────────────────────────────────────────────────────

  async _finishGame () {
    this.phase = GAME_PHASES.FINISHED

    // 4.4: Sort by score asc; ties share the same rank
    const results = this.players
      .map(p => ({
        id: p.id,
        name: p.name,
        score: p.shutTheBox ? 0 : calculateScore(p.openTiles),
        shutTheBox: p.shutTheBox
      }))
      .sort((a, b) => a.score - b.score)

    // 4.4: Declare winner(s) — the one(s) with lowest score
    const winnerScore = results[0].score
    const winners = results.filter(r => r.score === winnerScore)
    const winnerId = winners.length === 1 ? winners[0].id : null  // null = tie

    // Persist final match data and player stats
    await this._logEvent('GAME_OVER', { results })
    if (this._matchStore) {
      await this._matchStore.saveMatch(this.matchId, {
        players: this.players.map(p => ({ id: p.id, name: p.name })),
        startedAt: this._matchStore._startedAt,
        finishedAt: timestamp(),
        winnerId,
        results
      })
      // 4.4: Update stats for every player
      for (const r of results) {
        const won = winners.some(w => w.id === r.id)
        await this._matchStore.updateStats(r.id, r.score, won)
      }
    }

    // 4.5: Host sends authoritative game-over to all peers
    if (this.isHost) {
      this.room.broadcast(msgGameOver(this.myId, results))
    }

    this.emit('game-over', { results })
    await this.destroy()
  }

  // ──────────────────────────────────────────────────────────────────
  // Internal: incoming message handler
  // ──────────────────────────────────────────────────────────────────

  _handleMessage (msg) {
    switch (msg.type) {
      // 4.2: A new player announces themselves in the lobby
      case MSG_TYPES.PLAYER_JOIN: {
        if (!this.players.find(p => p.id === msg.from)) {
          const player = this._makePlayer(msg.from, msg.payload.name)
          this.players.push(player)
          this.emit('player-joined', { player, players: this.players })
          this.emit('lobby-updated', { players: this.players })
        }
        break
      }

      // 4.2: Host broadcast — game is starting
      case MSG_TYPES.GAME_START: {
        this.phase = GAME_PHASES.PLAYING
        for (const sp of msg.payload.players) {
          if (!this.players.find(p => p.id === sp.id)) {
            this.players.push(this._makePlayer(sp.id, sp.name))
          }
        }
        // Guest: initialize own local storage and resolve the wait
        this._initStorage().then(() => {
          this._matchStore.saveMatch(this.matchId, {
            players: this.players.map(p => ({ id: p.id, name: p.name })),
            startedAt: timestamp()
          })
          this._logEvent('GAME_START', {
            players: this.players.map(p => ({ id: p.id, name: p.name }))
          })
        })
        this.emit('game-started', { players: this.players, matchId: this.matchId })
        if (this._guestStartResolve) {
          this._guestStartResolve()
          this._guestStartResolve = null
        }
        break
      }

      // 4.3: Opponent rolled dice
      case MSG_TYPES.DICE_ROLL: {
        if (msg.from !== this.myId) {
          const player = this.players.find(p => p.id === msg.from)
          if (player) {
            this.emit('roll-result', { player, roll: msg.payload, isMe: false })
          }
        }
        break
      }

      // 4.3: Opponent shut tiles — update their local board
      case MSG_TYPES.TILES_SHUT: {
        if (msg.from !== this.myId) {
          const player = this.players.find(p => p.id === msg.from)
          if (player) {
            player.openTiles = player.openTiles.filter(t => !msg.payload.tiles.includes(t))
            this.emit('tiles-shut', { player, tiles: msg.payload.tiles, isMe: false })
          }
        }
        break
      }

      // 4.3/4.4: Opponent's turn ended — update state and unblock our loop
      case MSG_TYPES.TURN_END: {
        if (msg.from !== this.myId) {
          const player = this.players.find(p => p.id === msg.from)
          if (player) {
            player.openTiles = msg.payload.openTiles
            player.score = msg.payload.score
            player.shutTheBox = msg.payload.shutTheBox
            player.finished = msg.payload.finished || false

            if (msg.payload.shutTheBox) {
              this.emit('shut-the-box', { player, isMe: false })
            } else if (msg.payload.finished) {
              this.emit('no-valid-moves', { player, isMe: false })
            } else {
              this.emit('round-done', { player, openTiles: msg.payload.openTiles, score: msg.payload.score, isMe: false })
            }

            if (this._opponentResolve) {
              this._opponentResolve()
              this._opponentResolve = null
            }
          }
        }
        break
      }

      // 4.4: Host sent final results — non-host peers display scoreboard
      case MSG_TYPES.GAME_OVER: {
        if (this.phase !== GAME_PHASES.FINISHED) {
          this.phase = GAME_PHASES.FINISHED
          this.emit('game-over', { results: msg.payload.results })
        }
        break
      }
    }
  }
}

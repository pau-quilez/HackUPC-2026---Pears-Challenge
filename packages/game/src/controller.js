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
 * GameController — orchestrates the full game lifecycle.
 *
 * Symmetric model: there is NO host. Any player can start the game.
 * All peers validate locally and trust incoming messages.
 *
 * ── EVENTS ───────────────────────────────────────────────────────────
 *  'connected'        ({ myId })
 *  'lobby-updated'    ({ players })
 *  'player-joined'    ({ player, players })
 *  'player-left'      ({ player, players })
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
 *  'game-over'        ({ results })
 *  'game-aborted'     ({ reason, results })
 *  'error'            ({ message })
 *
 * ── ACTIONS ──────────────────────────────────────────────────────────
 *  await connect(name, roomName, mode)   mode = 'create' | 'join'
 *  startGame()
 *  roll()
 *  shutTiles(tiles[])
 *  useHint()  → combos[] | null
 *  await destroy()
 */
export class GameController extends EventEmitter {
  constructor () {
    super()
    this.room = null
    this.phase = GAME_PHASES.LOBBY
    this.players = []
    this.currentPlayerIndex = 0
    this.myId = null
    this.round = 0
    this.matchId = null
    this._gameEnded = false

    this._db = null
    this._dbCore = null
    this._eventLog = null
    this._matchStore = null

    this._rollResolve = null
    this._shutResolve = null
    this._opponentResolve = null
    this._startGameResolve = null
    this._activeTurn = null
    this._waitingTurnPeerId = null
  }

  // ── Public API ─────────────────────────────────────────────────────

  async connect (name, roomName, mode) {
    this.room = new Room(name)
    this.room.on('message', (msg) => this._handleMessage(msg))
    this.room.on('peer-disconnected', (peerId) => this._handlePeerDisconnected(peerId))

    if (mode === 'create') {
      await this.room.host(roomName)
    } else {
      await this.room.join(roomName)
    }

    this.myId = this.room.myId
    this.players.push(this._makePlayer(this.myId, name))

    this.emit('connected', { myId: this.myId })
    this.emit('lobby-updated', { players: this.players })

    await this._lobbyPhase()
  }

  startGame () {
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
      this._startGameResolve('local')
      this._startGameResolve = null
    }
  }

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

  useHint () {
    if (!this._activeTurn) {
      this.emit('error', { message: 'Not your turn' })
      return null
    }
    return this._activeTurn.useHint()
  }

  async destroy () {
    if (this._dbCore) {
      try { await closeDatabase({ core: this._dbCore }) } catch (_) {}
      this._db = null
      this._dbCore = null
    }
    if (this.room) {
      try { await this.room.destroy() } catch (_) {}
    }
  }

  get state () {
    return {
      phase: this.phase,
      players: this.players,
      myId: this.myId,
      round: this.round,
      matchId: this.matchId,
      currentPlayerIndex: this.currentPlayerIndex,
      hintsRemaining: this._activeTurn?.hintsRemaining ?? null
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────

  _makePlayer (id, name) {
    return {
      id, name,
      openTiles: createBoard(),
      score: 0,
      finished: false,
      shutTheBox: false,
      hintsRemaining: MAX_HINTS
    }
  }

  _getMyPlayer () { return this.players.find(p => p.id === this.myId) }

  _allPlayersFinished () {
    return this.players.every(p => p.finished || p.shutTheBox)
  }

  _buildResults () {
    return this.players
      .map(p => ({
        id: p.id,
        name: p.name,
        score: p.shutTheBox ? 0 : calculateScore(p.openTiles),
        shutTheBox: p.shutTheBox
      }))
      .sort((a, b) => a.score - b.score)
  }

  // ── Storage ────────────────────────────────────────────────────────

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

  // ── Lobby (symmetric) ─────────────────────────────────────────────

  async _lobbyPhase () {
    const source = await new Promise(resolve => { this._startGameResolve = resolve })

    if (source === 'remote') {
      // Another peer started — handler already set phase, reordered players
      // and emitted game-started. Just init storage and start the game loop.
      await this._initStorage()
      await this._logEvent('GAME_START', { players: this.players.map(p => ({ id: p.id, name: p.name })) })
      if (this._matchStore) {
        await this._matchStore.saveMatch(this.matchId, {
          players: this.players.map(p => ({ id: p.id, name: p.name })),
          startedAt: timestamp()
        })
      }
      await this._gameLoop()
      return
    }

    // We are the initiator
    this.players.sort((a, b) => a.id.localeCompare(b.id))
    this.phase = GAME_PHASES.PLAYING
    this.room.broadcast(msgGameStart(this.myId, {
      players: this.players.map(p => ({ id: p.id, name: p.name })),
      phase: GAME_PHASES.PLAYING
    }))

    await this._initStorage()
    await this._logEvent('GAME_START', { players: this.players.map(p => ({ id: p.id, name: p.name })) })
    if (this._matchStore) {
      await this._matchStore.saveMatch(this.matchId, {
        players: this.players.map(p => ({ id: p.id, name: p.name })),
        startedAt: timestamp()
      })
    }
    this.emit('game-started', { players: this.players, matchId: this.matchId })
    await this._gameLoop()
  }

  // ── Game loop ──────────────────────────────────────────────────────

  async _gameLoop () {
    while (this.phase === GAME_PHASES.PLAYING && !this._allPlayersFinished()) {
      this.round++
      this.emit('round-start', { round: this.round })

      for (let i = 0; i < this.players.length; i++) {
        if (this.phase !== GAME_PHASES.PLAYING) break
        this.currentPlayerIndex = i
        const player = this.players[i]

        if (player.finished || player.shutTheBox) {
          this.emit('player-skipped', { player })
          continue
        }

        if (player.id === this.myId) {
          await this._playMyTurn(player)
        } else {
          this.emit('opponent-turn', { player, round: this.round })
          this._waitingTurnPeerId = player.id
          await new Promise(resolve => { this._opponentResolve = resolve })
          this._waitingTurnPeerId = null
        }
      }

      if (this.phase !== GAME_PHASES.PLAYING) break
    }

    if (this._gameEnded) return
    if (this.phase !== GAME_PHASES.PLAYING && !this._allPlayersFinished()) return
    await this._finishGame()
  }

  // ── My turn ────────────────────────────────────────────────────────

  async _playMyTurn (player) {
    this._activeTurn = new Turn(player.openTiles, player.hintsRemaining)
    this.emit('my-turn', { player, round: this.round })

    await new Promise(resolve => { this._rollResolve = resolve })

    if (this._gameEnded || !this._activeTurn) return

    const roll = this._activeTurn.lastRoll
    await this._logEvent('DICE_ROLLED', { values: roll.values, total: roll.total, count: roll.count })

    if (!this._activeTurn.canMove()) {
      this.emit('no-valid-moves', { player, isMe: true })
      player.finished = true
      const result = this._activeTurn.endTurn()
      this._applyTurnResult(player, result)
      await this._logEvent('TURN_END', { openTiles: result.openTiles, score: result.score, finished: true })
      this.room.broadcast(msgTurnEnd(this.myId, { ...result, finished: true }))
      this._activeTurn = null
      return
    }

    this.emit('has-valid-moves', { player })
    await new Promise(resolve => { this._shutResolve = resolve })

    if (this._gameEnded || !this._activeTurn) return

    await this._logEvent('TILES_SHUT', { tiles: this._activeTurn.openTiles })

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

  // ── Finish ─────────────────────────────────────────────────────────

  async _finishGame () {
    if (this._gameEnded) return
    this._gameEnded = true
    this.phase = GAME_PHASES.FINISHED

    const results = this._buildResults()
    const winnerScore = results[0].score
    const winners = results.filter(r => r.score === winnerScore)
    const winnerId = winners.length === 1 ? winners[0].id : null

    await this._logEvent('GAME_OVER', { results })
    if (this._matchStore) {
      await this._matchStore.saveMatch(this.matchId, {
        players: this.players.map(p => ({ id: p.id, name: p.name })),
        finishedAt: timestamp(),
        winnerId,
        results
      })
      for (const r of results) {
        const won = winners.some(w => w.id === r.id)
        await this._matchStore.updateStats(r.id, r.score, won)
      }
    }

    this.room.broadcast(msgGameOver(this.myId, results))
    this.emit('game-over', { results })
    await this.destroy()
  }

  // ── Peer disconnect ────────────────────────────────────────────────

  _handlePeerDisconnected (peerId) {
    const index = this.players.findIndex(p => p.id === peerId)
    if (index === -1) return

    const [removed] = this.players.splice(index, 1)
    this.emit('player-left', { player: removed, players: this.players })

    if (this.phase === GAME_PHASES.LOBBY) {
      this.emit('lobby-updated', { players: this.players })
      return
    }

    if (index <= this.currentPlayerIndex && this.currentPlayerIndex > 0) {
      this.currentPlayerIndex--
    }

    if (this._waitingTurnPeerId === peerId && this._opponentResolve) {
      this._opponentResolve()
      this._opponentResolve = null
    }

    if (this.phase === GAME_PHASES.PLAYING && this.players.length < MIN_PLAYERS) {
      this._abortDueToDisconnect()
    }
  }

  _abortDueToDisconnect () {
    if (this._gameEnded) return
    this._gameEnded = true
    this.phase = GAME_PHASES.FINISHED

    const results = this._buildResults()

    if (this._opponentResolve) { this._opponentResolve(); this._opponentResolve = null }
    if (this._rollResolve) { this._rollResolve(null); this._rollResolve = null }
    if (this._shutResolve) { this._shutResolve(null); this._shutResolve = null }

    this.emit('game-aborted', { reason: `Not enough players (minimum ${MIN_PLAYERS})`, results })
  }

  // ── Incoming messages ──────────────────────────────────────────────

  _handleMessage (msg) {
    switch (msg.type) {
      case MSG_TYPES.PLAYER_JOIN: {
        if (!this.players.find(p => p.id === msg.from)) {
          const player = this._makePlayer(msg.from, msg.payload.name)
          this.players.push(player)
          this.emit('player-joined', { player, players: this.players })
          this.emit('lobby-updated', { players: this.players })
        }
        break
      }

      case MSG_TYPES.GAME_START: {
        if (this.phase !== GAME_PHASES.LOBBY) break

        this.phase = GAME_PHASES.PLAYING

        const ordered = []
        for (const sp of msg.payload.players) {
          let existing = this.players.find(p => p.id === sp.id)
          if (!existing) existing = this._makePlayer(sp.id, sp.name)
          ordered.push(existing)
        }
        this.players = ordered

        this.emit('game-started', { players: this.players, matchId: null })

        // Unblock _lobbyPhase — it will init storage and run gameLoop
        if (this._startGameResolve) {
          this._startGameResolve('remote')
          this._startGameResolve = null
        }
        break
      }

      case MSG_TYPES.DICE_ROLL: {
        if (msg.from !== this.myId) {
          const player = this.players.find(p => p.id === msg.from)
          if (player) this.emit('roll-result', { player, roll: msg.payload, isMe: false })
        }
        break
      }

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

      case MSG_TYPES.GAME_OVER: {
        if (this.phase !== GAME_PHASES.FINISHED) {
          this.phase = GAME_PHASES.FINISHED
          this._gameEnded = true
          this.emit('game-over', { results: msg.payload.results })
          if (this._opponentResolve) { this._opponentResolve(); this._opponentResolve = null }
        }
        break
      }
    }
  }
}

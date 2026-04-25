#!/usr/bin/env node

/**
 * CLI adapter for GameController.
 * Renders controller events to the terminal and calls controller actions
 * in response to user input. Contains zero game logic.
 */

import readline from 'node:readline'
import { GameController } from '@shut-the-box/game'
import { NUM_TILES, MAX_HINTS, MIN_PLAYERS, shortId } from '@shut-the-box/shared'

// ─────────────────────────────────────────────
// Terminal I/O helpers
// ─────────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = (q) => new Promise(resolve => rl.question(q, resolve))

function printBoard (openTiles) {
  const cells = []
  for (let i = 1; i <= NUM_TILES; i++) {
    cells.push(openTiles.includes(i) ? (i < 10 ? ` ${i} ` : `${i} `) : ' X ')
  }
  const sep = cells.map(() => '───')
  console.log('┌' + sep.join('┬') + '┐')
  console.log('│' + cells.join('│') + '│')
  console.log('└' + sep.join('┴') + '┘')
}

function printScoreboard (players) {
  console.log('\n--- Scoreboard ---')
  const sorted = [...players].sort((a, b) => a.score - b.score)
  sorted.forEach((p, i) => {
    const medal = i === 0 ? '>>> ' : '    '
    const shutTheBoxBadge = p.shutTheBox ? ' (SHUT THE BOX!)' : ''
    console.log(`${medal}${p.name}: ${p.score} points${shutTheBoxBadge}`)
  })
  console.log('------------------\n')
}

class GameController {
  constructor () {
    this.room = null
    this.phase = GAME_PHASES.LOBBY
    this.players = []
    this.currentPlayerIndex = 0
    this.myId = null
    this.round = 0
    this._waitingTurnPeerId = null
    this._waitingTurnResolver = null
    this._gameEnded = false
  }

  getMyPlayer () {
    return this.players.find(p => p.id === this.myId)
  }

  async start () {
    const name = await ask('Enter your name: ')
    
    console.log('\nOptions:')
    console.log('1. Create game')
    console.log('2. Join game')
    
    let selectedOption = ''
    while (selectedOption !== '1' && selectedOption !== '2') {
      selectedOption = await ask('Choose an option (1 or 2): ')
    }

    const roomName = await ask('Enter room name: ')

    this.room = new Room(name)
    this.room.on('message', (msg) => this.handleMessage(msg))
    this.room.on('peer-disconnected', (peerId) => this.handlePeerDisconnected(peerId))

    if (selectedOption === '1') {
      await this.room.host(roomName)
    } else {
      await this.room.join(roomName)
    }

    this.myId = this.room.myId
    this.players.push({
      id: this.myId,
      name,
      openTiles: createBoard(),
      score: 0,
      finished: false,
      shutTheBox: false,
      hintsRemaining: MAX_HINTS
    })

    await this.sharedLobby()
  }

  async sharedLobby () {
    console.log('\n=== LOBBY ===')
    console.log('Waiting for players... (Type "start" to begin, or press ENTER to refresh the list)')

    while (this.phase === GAME_PHASES.LOBBY) {
      const input = await ask('\nUse "start" command to begin the game: ')

      // Exit this loop if another player starts the game while we are typing.
      if (this.phase !== GAME_PHASES.LOBBY) break 

      if (input.trim().toLowerCase() === 'start') {
        if (this.players.length < MIN_PLAYERS) {
          console.log(`Need at least ${MIN_PLAYERS} players to start! (Current: ${this.players.length})`)
        } else {
          this.phase = GAME_PHASES.PLAYING
          
          // IMPORTANT: Sort players by ID so everyone has exactly
          // the same turn order, regardless of join time.
          this.players.sort((a, b) => a.id.localeCompare(b.id))
          
          this.room.broadcast(msgGameStart(this.myId, {
            players: this.players.map(p => ({ id: p.id, name: p.name })),
            phase: GAME_PHASES.PLAYING
          }))
          
          console.log('\n=== YOU STARTED THE GAME ===\n')
          await this.gameLoop()
        }
      } else {
        // Show current lobby state.
        console.log(`\nPlayers in room (${this.players.length}):`)
        this.players.forEach(p => console.log(`  - ${p.name} (${shortId(p.id)})`))
      }
    }
  }

  handleMessage (msg) {
    switch (msg.type) {
      case MSG_TYPES.PLAYER_JOIN: {
        if (!this.players.find(p => p.id === msg.from)) {
          this.players.push({
            id: msg.from,
            name: msg.payload.name,
            openTiles: createBoard(),
            score: 0,
            finished: false,
            shutTheBox: false,
            hintsRemaining: MAX_HINTS
          })
          console.log(`\n>>> ${msg.payload.name} joined the room!`)
        }
        break
      }

      case MSG_TYPES.GAME_START: {
        if (this.phase === GAME_PHASES.LOBBY) {
          this.phase = GAME_PHASES.PLAYING
          
          // Use the official player order from whoever pressed 'start'.
          const serverPlayers = msg.payload.players
          const newPlayersList = []
          
          for (const serverPlayer of serverPlayers) {
            let existingPlayer = this.players.find(p => p.id === serverPlayer.id)
            if (!existingPlayer) {
              existingPlayer = {
                id: serverPlayer.id,
                name: serverPlayer.name,
                openTiles: createBoard(),
                score: 0,
                finished: false,
                shutTheBox: false,
                hintsRemaining: MAX_HINTS
              }
            }
            newPlayersList.push(existingPlayer)
          }
          
          this.players = newPlayersList
          console.log('\n\n=== GAME STARTED! (Press ENTER to continue) ===\n')
          
          rl.write('\n')
          
          // Start the game loop asynchronously.
          setTimeout(() => this.gameLoop(), 100) 
        }
        break
      }

      case MSG_TYPES.DICE_ROLL: {
        if (msg.from !== this.myId) {
          const player = this.players.find(p => p.id === msg.from)
          const name = player?.name || shortId(msg.from)
          console.log(`\n${name} rolled: [${msg.payload.values.join(', ')}] = ${msg.payload.total}`)
        }
        break
      }

      case MSG_TYPES.TILES_SHUT: {
        if (msg.from !== this.myId) {
          const player = this.players.find(p => p.id === msg.from)
          const name = player?.name || shortId(msg.from)
          const tiles = msg.payload.tiles
          console.log(`${name} shut tiles: [${tiles.join(', ')}]`)
          if (player) {
            player.openTiles = player.openTiles.filter(t => !tiles.includes(t))
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
            player.finished = msg.payload.finished || false
            player.shutTheBox = msg.payload.shutTheBox
            const name = player.name
            
            if (msg.payload.shutTheBox) {
              console.log(`\n*** ${name} SHUT THE BOX! Score: 0 ***`)
            } else if (msg.payload.finished) {
              console.log(`\n${name} has no valid moves. Current score: ${msg.payload.score}`)
            } else {
              console.log(`\n${name}'s turn ended. Open tiles: [${msg.payload.openTiles.join(', ')}]`)
            }
          }
        }
        break
      }

      case MSG_TYPES.GAME_OVER: {
        // In a symmetric network, process GAME_OVER if any peer sends it.
        if (this.phase !== GAME_PHASES.FINISHED) {
          console.log('\n========== GAME OVER ==========')
          printScoreboard(msg.payload.results)
          this.phase = GAME_PHASES.FINISHED
          if (this._waitingTurnResolver) this._waitingTurnResolver()
        }
        break
      }
    }
  }

  handlePeerDisconnected (peerId) {
    const index = this.players.findIndex(p => p.id === peerId)
    if (index === -1) return

    const [removed] = this.players.splice(index, 1)
    console.log(`\n>>> ${removed.name} disconnected.`)

    if (index <= this.currentPlayerIndex && this.currentPlayerIndex > 0) {
      this.currentPlayerIndex--
    }

    if (this._waitingTurnPeerId === peerId && this._waitingTurnResolver) {
      console.log('Current player disconnected. Skipping turn...')
      this._waitingTurnResolver()
    }

    if (this.phase === GAME_PHASES.PLAYING && this.players.length < MIN_PLAYERS) {
      this.endDueToInsufficientPlayers()
    }
  }

  buildResults () {
    return this.players.map(p => ({
      id: p.id,
      name: p.name,
      score: p.shutTheBox ? 0 : calculateScore(p.openTiles),
      shutTheBox: p.shutTheBox
    }))
  }

  endDueToInsufficientPlayers () {
    if (this._gameEnded) return
    this._gameEnded = true
    this.phase = GAME_PHASES.FINISHED

    console.log(`\nNot enough players (minimum ${MIN_PLAYERS}). The game has ended.`)

    if (this._waitingTurnResolver) {
      this._waitingTurnResolver()
    }

    const results = this.buildResults()
    if (results.length > 0) {
      printScoreboard(results)
    }

    rl.close()
    this.room.destroy().catch((err) => {
      console.error('Error while closing room:', err)
    })
  }

  allPlayersFinished () {
    return this.players.every(p => p.finished || p.shutTheBox)
  }

  async gameLoop () {
    // Rounds continue until all players are finished or have shut the box.
    while (this.phase === GAME_PHASES.PLAYING && !this.allPlayersFinished()) {
      this.round++
      console.log(`\n========== ROUND ${this.round} ==========`)

      for (let i = 0; i < this.players.length; i++) {
        if (this.phase !== GAME_PHASES.PLAYING) break

        this.currentPlayerIndex = i
        const player = this.players[i]

        if (player.finished || player.shutTheBox) {
          console.log(`\n${player.name} is already done (Score: ${player.score}).`)
          continue
        }

        if (player.id === this.myId) {
          console.log(`\n=== YOUR TURN (${player.name}) === [Round ${this.round}]`)
          await this.playMyTurn(player)
        } else {
          console.log(`\n=== ${player.name}'s turn === [Round ${this.round}]`)
          console.log('Waiting for their move...')
          await this.waitForTurnEnd(player)
        }
      }

      if (this.phase !== GAME_PHASES.PLAYING) break
    }

    if (this._gameEnded) return
    if (this.phase !== GAME_PHASES.PLAYING && !this.allPlayersFinished()) return

    this.phase = GAME_PHASES.FINISHED
    const results = this.buildResults()

    console.log('\n========== GAME OVER ==========')
    printScoreboard(results)
    
    rl.close()
    this._gameEnded = true
    await this.room.destroy()
  }

  async playMyTurn (player) {
    const turn = new Turn(player.openTiles, player.hintsRemaining)

    printBoard(turn.openTiles)

    await ask('\nPress ENTER to roll dice...')
    const roll = turn.roll()
    console.log(`\nYou rolled: [${roll.values.join(', ')}] = ${roll.total}`)
    this.room.broadcast(msgDiceRoll(this.myId, roll))

    if (!turn.canMove()) {
      console.log('No valid moves available. You are out!')
      player.finished = true
      const result = turn.endTurn()
      player.openTiles = result.openTiles
      player.score = result.score
      player.hintsRemaining = result.hintsRemaining
      this.room.broadcast(msgTurnEnd(this.myId, { ...result, finished: true }))
      return
    }

    console.log(`\n(Type "hint" to show combinations. Hints left: ${turn.hintsRemaining})`)

    let validChoice = false
    while (!validChoice) {
      const choice = await ask('\nChoose tiles to shut (comma-separated, e.g. "2,5"): ')

      if (choice.trim().toLowerCase() === 'hint') {
        const combos = turn.useHint()
        if (combos === null) {
          console.log('No hints remaining!')
        } else {
          console.log(`\nValid combinations (Hints left: ${turn.hintsRemaining}):`)
          combos.forEach((combo, i) => {
            console.log(`  ${i + 1}) [${combo.join(', ')}]`)
          })
        }
        continue
      }

      const chosenTiles = choice.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))

      try {
        turn.shutTiles(chosenTiles)
        validChoice = true
        console.log(`Shut tiles: [${chosenTiles.join(', ')}]`)
        this.room.broadcast(msgTilesShut(this.myId, chosenTiles))
      } catch (err) {
        console.log(`Invalid: ${err.message}. Try again.`)
      }
    }

    const result = turn.endTurn()
    player.openTiles = result.openTiles
    player.score = result.score
    player.shutTheBox = result.shutTheBox
    player.hintsRemaining = result.hintsRemaining

    if (result.shutTheBox) {
      console.log('\n*** YOU SHUT THE BOX! Score: 0 ***')
      this.room.broadcast(msgTurnEnd(this.myId, { ...result, finished: true }))
    } else {
      console.log(`\nTurn finished. Open tiles: [${result.openTiles.join(', ')}] (Current score: ${result.score})`)
      this.room.broadcast(msgTurnEnd(this.myId, { ...result, finished: false }))
    }
  }

  waitForTurnEnd (player) {
    return new Promise((resolve) => {
      this._waitingTurnPeerId = player.id

      const finish = () => {
        this.room.removeListener('message', handler)
        this._waitingTurnPeerId = null
        this._waitingTurnResolver = null
        resolve()
      }

      const handler = (msg) => {
        if (msg.type === MSG_TYPES.TURN_END && msg.from === player.id) {
          finish()
        }
      }

      this._waitingTurnResolver = finish
      this.room.on('message', handler)
    })
  }
}

async function main () {
  console.log('╔═══════════════════════════════════════════╗')
  console.log('║        SHUT THE BOX - P2P Edition         ║')
  console.log('╠═══════════════════════════════════════════╣')
  console.log(`║  Tiles: 1-${NUM_TILES} | Players: 2-4 | ${MAX_HINTS} hints    ║`)
  console.log('║  1 roll per round, shut tiles and win      ║')
  console.log('╚═══════════════════════════════════════════╝')
  console.log()

  const name = await ask('Your name: ')
  const roomName = await ask('Room name: ')

  const controller = new GameController()
  wireEvents(controller)

  if (isHost) {
    setImmediate(() => hostLobbyLoop(controller))
  }

  await controller.connect(name, roomName, isHost)
}

main().catch(err => {
  console.error('\nFatal error:', err.message)
  process.exit(1)
})
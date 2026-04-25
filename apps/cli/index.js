#!/usr/bin/env node

import readline from 'node:readline'
import { Room } from '@shut-the-box/p2p'
import {
  msgPlayerReady, msgGameStart, msgDiceRoll,
  msgTilesShut, msgTurnEnd, msgGameOver
} from '@shut-the-box/p2p'
import { Turn, createBoard, calculateScore } from '@shut-the-box/game'
import {
  GAME_PHASES, MSG_TYPES, NUM_TILES, MAX_HINTS,
  MIN_PLAYERS, MAX_PLAYERS, shortId
} from '@shut-the-box/shared'

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = (q) => new Promise(resolve => rl.question(q, resolve))

const args = process.argv.slice(2)
const isHost = args.includes('--host')
const isJoin = args.includes('--join')

function printBoard (openTiles) {
  const cells = []
  for (let i = 1; i <= NUM_TILES; i++) {
    cells.push(openTiles.includes(i) ? (i < 10 ? ` ${i} ` : `${i} `) : ' X ')
  }
  const border = cells.map(() => '───')
  console.log('┌' + border.join('┬') + '┐')
  console.log('│' + cells.join('│') + '│')
  console.log('└' + border.join('┴') + '┘')
}

function printScoreboard (players) {
  console.log('\n--- Scoreboard ---')
  const sorted = [...players].sort((a, b) => a.score - b.score)
  sorted.forEach((p, i) => {
    const medal = i === 0 ? '>>> ' : '    '
    const stb = p.shutTheBox ? ' (SHUT THE BOX!)' : ''
    console.log(`${medal}${p.name}: ${p.score} points${stb}`)
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
    this.isHost = false
    this.round = 0
  }

  getMyPlayer () {
    return this.players.find(p => p.id === this.myId)
  }

  async start () {
    const name = await ask('Enter your name: ')
    const roomName = await ask('Enter room name: ')

    this.room = new Room(name)
    this.isHost = isHost

    this.room.on('message', (msg) => this.handleMessage(msg))

    if (isHost) {
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

    console.log(`\nWaiting for players... (${this.isHost ? 'you are the host' : 'waiting for host to start'})`)

    if (this.isHost) {
      await this.hostLobby()
    } else {
      await this.waitForStart()
    }
  }

  async hostLobby () {
    while (this.phase === GAME_PHASES.LOBBY) {
      const totalPlayers = this.players.length
      console.log(`\nPlayers in room: ${totalPlayers}`)
      this.players.forEach(p => console.log(`  - ${p.name} (${shortId(p.id)})`))

      if (totalPlayers < MIN_PLAYERS) {
        console.log(`Need at least ${MIN_PLAYERS} players to start.`)
        await ask('Press Enter to refresh...')
        continue
      }

      const answer = await ask(`Start game with ${totalPlayers} players? (y/n): `)
      if (answer.toLowerCase() === 'y') {
        this.phase = GAME_PHASES.PLAYING
        this.room.broadcast(msgGameStart(this.myId, {
          players: this.players.map(p => ({ id: p.id, name: p.name })),
          phase: GAME_PHASES.PLAYING
        }))
        console.log('\n=== GAME STARTED ===\n')
        await this.gameLoop()
      }
    }
  }

  async waitForStart () {
    return new Promise((resolve) => {
      this._startResolve = resolve
    })
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
        this.phase = GAME_PHASES.PLAYING
        const serverPlayers = msg.payload.players
        for (const sp of serverPlayers) {
          if (!this.players.find(p => p.id === sp.id)) {
            this.players.push({
              id: sp.id,
              name: sp.name,
              openTiles: createBoard(),
              score: 0,
              finished: false,
              shutTheBox: false,
              hintsRemaining: MAX_HINTS
            })
          }
        }
        console.log('\n=== GAME STARTED ===\n')
        if (this._startResolve) {
          this._startResolve()
          this.gameLoop()
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
              console.log(`\n${name} has no valid moves. Score so far: ${msg.payload.score}`)
            } else {
              console.log(`\n${name}'s round ended. Open tiles: [${msg.payload.openTiles.join(', ')}]`)
            }
          }
        }
        break
      }

      case MSG_TYPES.GAME_OVER: {
        console.log('\n========== GAME OVER ==========')
        printScoreboard(msg.payload.results)
        this.phase = GAME_PHASES.FINISHED
        break
      }
    }
  }

  allPlayersFinished () {
    return this.players.every(p => p.finished || p.shutTheBox)
  }

  async gameLoop () {
    // Rounds continue until all players are finished (no valid moves or shut the box)
    while (!this.allPlayersFinished()) {
      this.round++
      console.log(`\n========== ROUND ${this.round} ==========`)

      for (let i = 0; i < this.players.length; i++) {
        this.currentPlayerIndex = i
        const player = this.players[i]

        if (player.finished || player.shutTheBox) {
          console.log(`\n${player.name} is already done (score: ${player.score}).`)
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
    }

    this.phase = GAME_PHASES.FINISHED
    const results = this.players.map(p => ({
      id: p.id,
      name: p.name,
      score: p.shutTheBox ? 0 : calculateScore(p.openTiles),
      shutTheBox: p.shutTheBox
    }))

    if (this.isHost) {
      this.room.broadcast(msgGameOver(this.myId, results))
    }

    console.log('\n========== GAME OVER ==========')
    printScoreboard(results)
    rl.close()
    await this.room.destroy()
  }

  async playMyTurn (player) {
    const turn = new Turn(player.openTiles, player.hintsRemaining)

    printBoard(turn.openTiles)

    await ask('\nPress Enter to roll dice...')
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

    console.log(`\n(Type "hint" to reveal valid combinations. Hints remaining: ${turn.hintsRemaining})`)

    let validChoice = false
    while (!validChoice) {
      const choice = await ask('\nChoose tiles to shut (comma-separated, e.g. "2,5"): ')

      if (choice.trim().toLowerCase() === 'hint') {
        const combos = turn.useHint()
        if (combos === null) {
          console.log('No hints remaining!')
        } else {
          console.log(`\nValid combinations (hints left: ${turn.hintsRemaining}):`)
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
      console.log(`\nRound done. Open tiles: [${result.openTiles.join(', ')}] (score so far: ${result.score})`)
      this.room.broadcast(msgTurnEnd(this.myId, { ...result, finished: false }))
    }
  }

  waitForTurnEnd (player) {
    return new Promise((resolve) => {
      const handler = (msg) => {
        if (msg.type === MSG_TYPES.TURN_END && msg.from === player.id) {
          this.room.removeListener('message', handler)
          resolve()
        }
      }
      this.room.on('message', handler)
    })
  }
}

async function main () {
  console.log('╔═══════════════════════════════════════════╗')
  console.log('║        SHUT THE BOX - P2P Edition         ║')
  console.log('╠═══════════════════════════════════════════╣')
  console.log(`║  Tiles: 1-${NUM_TILES} | Players: 2-4 | ${MAX_HINTS} hints    ║`)
  console.log('║  1 roll per round, shut tiles, lowest wins ║')
  console.log('╚═══════════════════════════════════════════╝')
  console.log()

  if (!isHost && !isJoin) {
    console.log('Usage:')
    console.log('  Host a game:   node apps/cli/index.js --host')
    console.log('  Join a game:   node apps/cli/index.js --join')
    process.exit(1)
  }

  const game = new GameController()
  await game.start()
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})

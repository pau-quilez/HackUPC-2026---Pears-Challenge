#!/usr/bin/env node

/**
 * CLI adapter for GameController.
 * Renders controller events to the terminal and calls controller actions.
 * Contains zero game logic.
 */

import readline from 'node:readline'
import { GameController } from '@shut-the-box/game'
import { NUM_TILES, MAX_HINTS, MIN_PLAYERS, shortId } from '@shut-the-box/shared'

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = (q) => new Promise(resolve => rl.question(q, resolve))

// ─────────────────────────────────────────────
// Terminal rendering helpers
// ─────────────────────────────────────────────

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

function printScoreboard (results) {
  console.log('\n── Final Scoreboard ────────────────────────')
  results.forEach((p, i) => {
    const rank = i === 0 ? '>>> ' : `${i + 1}.  `
    const stb = p.shutTheBox ? '  (SHUT THE BOX!)' : ''
    console.log(`  ${rank}${p.name}: ${p.score} pts${stb}`)
  })
  const best = results[0].score
  const winners = results.filter(r => r.score === best)
  if (winners.length > 1) {
    console.log(`\n  Tie between: ${winners.map(w => w.name).join(' & ')}`)
  }
  console.log('────────────────────────────────────────────\n')
}

// ─────────────────────────────────────────────
// Lobby loop — shared, any player can start
// ─────────────────────────────────────────────

async function lobbyLoop (controller) {
  console.log('\n=== LOBBY ===')
  console.log('Waiting for players... (Type "start" to begin, or press ENTER to refresh)')

  while (controller.state.phase === 'lobby') {
    const input = await ask('\n> ')

    if (controller.state.phase !== 'lobby') break

    if (input.trim().toLowerCase() === 'start') {
      controller.startGame()
    } else {
      const { players } = controller.state
      console.log(`\nPlayers in room (${players.length}):`)
      players.forEach(p => console.log(`  - ${p.name} (${shortId(p.id)})`))
    }
  }
}

// ─────────────────────────────────────────────
// Wire controller events → terminal
// ─────────────────────────────────────────────

function wireEvents (controller) {
  controller.on('connected', ({ myId }) => {
    console.log(`\nConnected! Your ID: ${shortId(myId)}`)
  })

  controller.on('player-joined', ({ player }) => {
    console.log(`\n>>> ${player.name} joined!`)
  })

  controller.on('player-left', ({ player }) => {
    console.log(`\n<<< ${player.name} disconnected.`)
  })

  controller.on('game-started', ({ players, matchId }) => {
    console.log(`\n═══════════════════════════════════`)
    console.log(`  GAME STARTED  (match: ${(matchId || '').slice(0, 8)})`)
    console.log(`  Players: ${players.map(p => p.name).join(', ')}`)
    console.log(`═══════════════════════════════════\n`)
  })

  controller.on('round-start', ({ round }) => {
    console.log(`\n────────────  ROUND ${round}  ────────────`)
  })

  controller.on('player-skipped', ({ player }) => {
    console.log(`  ${player.name} already done (score: ${player.score}).`)
  })

  controller.on('my-turn', async ({ player, round }) => {
    console.log(`\n>>> YOUR TURN — ${player.name} [Round ${round}]`)
    printBoard(player.openTiles)
    await ask('\nPress ENTER to roll dice...')
    controller.roll()
  })

  controller.on('roll-result', async ({ player, roll, isMe }) => {
    if (isMe) {
      console.log(`\nYou rolled: [${roll.values.join(', ')}] = ${roll.total}`)
    } else {
      console.log(`  ${player.name} rolled: [${roll.values.join(', ')}] = ${roll.total}`)
    }
  })

  controller.on('no-valid-moves', ({ player, isMe }) => {
    if (isMe) {
      console.log('\n  No valid moves. You are out for this game!')
    } else {
      console.log(`\n  ${player.name} has no valid moves — eliminated.`)
    }
  })

  controller.on('tiles-shut', ({ player, tiles, isMe }) => {
    if (isMe) {
      console.log(`  You shut: [${tiles.join(', ')}]`)
    } else {
      console.log(`  ${player.name} shut: [${tiles.join(', ')}]`)
    }
  })

  controller.on('round-done', ({ player, openTiles, score, isMe }) => {
    if (isMe) {
      console.log(`\n  Round done. Open: [${openTiles.join(', ')}]  (score so far: ${score})`)
    } else {
      console.log(`\n  ${player.name} round done. Score so far: ${score}`)
    }
  })

  controller.on('shut-the-box', ({ player, isMe }) => {
    if (isMe) {
      console.log('\n  *** YOU SHUT THE BOX! Perfect score: 0 ***')
    } else {
      console.log(`\n  *** ${player.name} SHUT THE BOX! Score: 0 ***`)
    }
  })

  controller.on('opponent-turn', ({ player, round }) => {
    console.log(`\n    ${player.name}'s turn [Round ${round}] — waiting...`)
  })

  controller.on('game-over', ({ results }) => {
    console.log('\n═══════════════════════════════════════════')
    console.log('                GAME OVER')
    console.log('═══════════════════════════════════════════')
    printScoreboard(results)
    rl.close()
  })

  controller.on('game-aborted', ({ reason, results }) => {
    console.log(`\n  !! Game aborted: ${reason}`)
    if (results.length > 0) printScoreboard(results)
    rl.close()
  })

  controller.on('error', ({ message }) => {
    console.log(`  ! ${message}`)
  })

  // After rolling, if there are valid moves, prompt tile selection
  controller.on('roll-result', async ({ isMe }) => {
    if (!isMe) return

    // Wait a tick for no-valid-moves to fire first
    await new Promise(r => setImmediate(r))
    if (controller.state.phase !== 'playing') return
    if (!controller.state.hintsRemaining && controller.state.hintsRemaining !== 0) return

    const hin = controller.state.hintsRemaining
    console.log(`\n(Type "hint" to show combos — ${hin} hint${hin !== 1 ? 's' : ''} left)`)

    let done = false
    while (!done) {
      const raw = await ask('Choose tiles to shut (e.g. "3,5"): ')
      const input = raw.trim().toLowerCase()

      if (input === 'hint') {
        const combos = controller.useHint()
        if (combos === null) {
          console.log('  No hints remaining!')
        } else {
          const left = controller.state.hintsRemaining
          console.log(`  Valid combos (${left} hint${left !== 1 ? 's' : ''} left):`)
          combos.forEach((c, i) => console.log(`    ${i + 1}) [${c.join(', ')}]`))
        }
        continue
      }

      const tiles = input.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))
      if (tiles.length === 0) {
        console.log('  Enter tile numbers separated by commas.')
        continue
      }

      const errHandler = ({ message }) => { console.log(`  Invalid: ${message}`) }
      controller.once('error', errHandler)
      controller.shutTiles(tiles)
      await new Promise(r => setImmediate(r))
      controller.removeListener('error', errHandler)

      if (controller.state.hintsRemaining === null) {
        done = true
      }
    }
  })
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

async function main () {
  console.log('╔══════════════════════════════════════════╗')
  console.log('║        SHUT THE BOX — P2P Edition        ║')
  console.log('╠══════════════════════════════════════════╣')
  console.log(`║  Tiles 1-${NUM_TILES} · 2-4 players · ${MAX_HINTS} hints/game  ║`)
  console.log('║  1 roll per round · lowest score wins    ║')
  console.log('╚══════════════════════════════════════════╝')
  console.log()

  const name = await ask('Your name: ')

  console.log('\nOptions:')
  console.log('  1. Create game')
  console.log('  2. Join game')

  let option = ''
  while (option !== '1' && option !== '2') {
    option = (await ask('Choose (1 or 2): ')).trim()
  }

  const roomName = await ask('Room name: ')
  const mode = option === '1' ? 'create' : 'join'

  const controller = new GameController()
  wireEvents(controller)

  setImmediate(() => lobbyLoop(controller))

  await controller.connect(name, roomName, mode)
}

main().catch(err => {
  console.error('\nFatal error:', err.message)
  process.exit(1)
})

#!/usr/bin/env node

/**
 * CLI adapter for GameController.
 * Renders controller events to the terminal and calls controller actions.
 * Contains zero game logic.
 */

import readline from 'node:readline'
import { GameController } from '@shut-the-box/game'
import { NUM_TILES, MAX_HINTS, MIN_PLAYERS, MAX_PLAYERS, shortId } from '@shut-the-box/shared'

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = (q) => new Promise(resolve => rl.question(q, resolve))

let inGame = false

// ─────────────────────────────────────────────
// Rendering helpers
// ─────────────────────────────────────────────

function printBoard (openTiles) {
  const cells = []
  for (let i = 1; i <= NUM_TILES; i++) {
    cells.push(openTiles.includes(i) ? (i < 10 ? ` ${i} ` : `${i} `) : ' X ')
  }
  const sep = cells.map(() => '───')
  console.log('  ┌' + sep.join('┬') + '┐')
  console.log('  │' + cells.join('│') + '│')
  console.log('  └' + sep.join('┴') + '┘')
}

function printScoreboard (results) {
  console.log('\n  ── Final Scoreboard ────────────────────')
  results.forEach((p, i) => {
    const rank = i === 0 ? '  >>> ' : `   ${i + 1}.  `
    const stb = p.shutTheBox ? '  (SHUT THE BOX!)' : ''
    console.log(`${rank}${p.name}: ${p.score} pts${stb}`)
  })
  const best = results[0].score
  const winners = results.filter(r => r.score === best)
  if (winners.length > 1) {
    console.log(`\n  Tie: ${winners.map(w => w.name).join(' & ')}`)
  }
  console.log('  ────────────────────────────────────────\n')
}

function printPlayerList (players) {
  console.log(`  Players in room (${players.length}):`)
  players.forEach(p => console.log(`    - ${p.name} (${shortId(p.id)})`))
}

// ─────────────────────────────────────────────
// Lobby loop — any player can type "start"
// ─────────────────────────────────────────────

async function lobbyLoop (controller) {
  while (controller.state.phase === 'lobby') {
    const input = await ask('')

    if (controller.state.phase !== 'lobby') break

    if (input.trim().toLowerCase() === 'start') {
      controller.startGame()
    } else {
      printPlayerList(controller.state.players)
    }
  }
}

// ─────────────────────────────────────────────
// Tile selection prompt (only during our turn)
// ─────────────────────────────────────────────

async function tileSelectionLoop (controller) {
  const hin = controller.state.hintsRemaining
  console.log(`  (type "hint" for combos — ${hin} hint${hin !== 1 ? 's' : ''} left)`)

  while (true) {
    const raw = await ask('  Tiles to shut (e.g. 3,5): ')
    const input = raw.trim().toLowerCase()

    if (controller.state.phase !== 'playing') break

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

    let hadError = false
    const errHandler = ({ message }) => { console.log(`  Invalid: ${message}`); hadError = true }
    controller.once('error', errHandler)
    controller.shutTiles(tiles)
    await new Promise(r => setImmediate(r))
    controller.removeListener('error', errHandler)

    if (!hadError) break
  }
}

// ─────────────────────────────────────────────
// Wire controller events → terminal
// ─────────────────────────────────────────────

function wireEvents (controller) {
  controller.on('connected', ({ myId }) => {
    console.log(`  Connected! ID: ${shortId(myId)}`)
  })

  controller.on('player-joined', ({ player, players }) => {
    console.log(`\n  >>> ${player.name} joined!`)
    printPlayerList(players)
    if (!inGame) {
      console.log('  Type "start" to begin or press ENTER to refresh.')
    }
  })

  controller.on('player-left', ({ player }) => {
    console.log(`\n  <<< ${player.name} disconnected.`)
  })

  controller.on('game-started', ({ players, matchId }) => {
    inGame = true
    const id = matchId ? matchId.slice(0, 8) : '...'
    console.log('')
    console.log('  ═══════════════════════════════════')
    console.log(`  GAME STARTED  (match: ${id})`)
    console.log(`  Players: ${players.map(p => p.name).join(', ')}`)
    console.log('  ═══════════════════════════════════')

    // Force-resolve any pending lobby readline to unblock lobbyLoop
    rl.write('\n')
  })

  controller.on('round-start', ({ round }) => {
    console.log(`\n  ────────────  ROUND ${round}  ────────────`)
  })

  controller.on('player-skipped', ({ player }) => {
    console.log(`  ${player.name} done (score: ${player.score}).`)
  })

  controller.on('my-turn', async ({ player, round }) => {
    console.log(`\n  >>> YOUR TURN — ${player.name} [Round ${round}]`)
    printBoard(player.openTiles)
    await ask('  Press ENTER to roll dice...')
    controller.roll()
  })

  controller.on('has-valid-moves', async ({ player }) => {
    await tileSelectionLoop(controller)
  })

  controller.on('roll-result', ({ player, roll, isMe }) => {
    if (isMe) {
      console.log(`  You rolled: [${roll.values.join(', ')}] = ${roll.total}`)
    } else {
      console.log(`  ${player.name} rolled: [${roll.values.join(', ')}] = ${roll.total}`)
    }
  })

  controller.on('no-valid-moves', ({ player, isMe }) => {
    if (isMe) {
      console.log('  No valid moves. You are out!')
    } else {
      console.log(`  ${player.name} has no valid moves — eliminated.`)
    }
  })

  controller.on('tiles-shut', ({ player, tiles, isMe }) => {
    if (isMe) {
      console.log(`  Shut: [${tiles.join(', ')}]`)
    } else {
      console.log(`  ${player.name} shut: [${tiles.join(', ')}]`)
    }
  })

  controller.on('round-done', ({ player, openTiles, score, isMe }) => {
    if (isMe) {
      console.log(`  Round done. Open: [${openTiles.join(', ')}]  Score: ${score}`)
    } else {
      console.log(`  ${player.name} round done. Score: ${score}`)
    }
  })

  controller.on('shut-the-box', ({ player, isMe }) => {
    if (isMe) {
      console.log('\n  *** YOU SHUT THE BOX! Score: 0 ***')
    } else {
      console.log(`\n  *** ${player.name} SHUT THE BOX! Score: 0 ***`)
    }
  })

  controller.on('opponent-turn', ({ player, round }) => {
    console.log(`\n  ${player.name}'s turn [Round ${round}] — waiting...`)
  })

  controller.on('game-over', ({ results }) => {
    console.log('')
    console.log('  ═══════════════════════════════════')
    console.log('              GAME OVER')
    console.log('  ═══════════════════════════════════')
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
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

async function main () {
  console.log('╔══════════════════════════════════════════╗')
  console.log('║        SHUT THE BOX — P2P Edition        ║')
  console.log('╠══════════════════════════════════════════╣')
  console.log(`║  Tiles 1-${NUM_TILES} · ${MIN_PLAYERS}-${MAX_PLAYERS} players · ${MAX_HINTS} hints  ║`)
  console.log('║  1 roll per round · lowest score wins    ║')
  console.log('╚══════════════════════════════════════════╝')
  console.log()

  const name = await ask('  Your name: ')

  console.log('\n  1. Create game')
  console.log('  2. Join game')

  let option = ''
  while (option !== '1' && option !== '2') {
    option = (await ask('  Choose (1 or 2): ')).trim()
  }

  const roomName = await ask('  Room name: ')
  const mode = option === '1' ? 'create' : 'join'

  console.log('\n  Connecting...')

  const controller = new GameController()
  wireEvents(controller)

  // Start lobby input loop in background — will be broken by rl.write('\n') when game starts
  controller.once('connected', () => {
    console.log('\n  === LOBBY ===')
    console.log('  Type "start" to begin or press ENTER to refresh.\n')
    lobbyLoop(controller)
  })

  await controller.connect(name, roomName, mode)
}

main().catch(err => {
  console.error('\nFatal error:', err.message)
  process.exit(1)
})

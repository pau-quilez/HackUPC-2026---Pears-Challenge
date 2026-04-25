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

function printScoreboard (results) {
  console.log('\n── Final Scoreboard ────────────────────────')
  results.forEach((p, i) => {
    const rank = i === 0 ? '🏆 ' : `${i + 1}.  `
    const stb = p.shutTheBox ? '  ← SHUT THE BOX!' : ''
    console.log(`  ${rank}${p.name}: ${p.score} pts${stb}`)
  })
  // Tie detection
  const best = results[0].score
  const winners = results.filter(r => r.score === best)
  if (winners.length > 1) {
    console.log(`\n  Tie between: ${winners.map(w => w.name).join(' & ')}`)
  }
  console.log('────────────────────────────────────────────\n')
}

// ─────────────────────────────────────────────
// Host lobby loop (runs in parallel with connect)
// ─────────────────────────────────────────────

async function hostLobbyLoop (controller) {
  while (controller.state.phase === 'lobby') {
    const { players } = controller.state
    console.log(`\nPlayers in room: ${players.length}`)
    players.forEach(p => console.log(`  - ${p.name} (${shortId(p.id)})`))

    if (players.length < MIN_PLAYERS) {
      console.log(`  Need at least ${MIN_PLAYERS} players to start.`)
      await ask('Press Enter to refresh...')
      continue
    }

    const answer = await ask(`Start game with ${players.length} players? (y/n): `)
    if (answer.trim().toLowerCase() === 'y') {
      controller.startGame()
      break
    }
  }
}

// ─────────────────────────────────────────────
// Wire events → terminal rendering
// ─────────────────────────────────────────────

function wireEvents (controller) {
  controller.on('waiting', ({ isHost }) => {
    console.log(`\nWaiting for players... (${isHost ? 'you are the host — Press Enter to refresh' : 'waiting for host to start'})`)
  })

  controller.on('player-joined', ({ player }) => {
    console.log(`\n>>> ${player.name} joined!`)
  })

  controller.on('player-left', ({ peerId }) => {
    console.log(`\n<<< ${shortId(peerId)} disconnected.`)
  })

  controller.on('game-started', ({ players, matchId }) => {
    console.log(`\n═══════════════════════════════════`)
    console.log(`  GAME STARTED  (match: ${matchId.slice(0, 8)})`)
    console.log(`  Players: ${players.map(p => p.name).join(', ')}`)
    console.log(`═══════════════════════════════════\n`)
  })

  controller.on('round-start', ({ round }) => {
    console.log(`\n────────────  ROUND ${round}  ────────────`)
  })

  controller.on('player-skipped', ({ player }) => {
    console.log(`  ${player.name} already done (score: ${player.score}).`)
  })

  // My turn: show board, prompt roll, then tile selection
  controller.on('my-turn', async ({ player, round }) => {
    console.log(`\n>>> YOUR TURN — ${player.name} [Round ${round}]`)
    printBoard(player.openTiles)

    await ask('\nPress Enter to roll dice...')
    controller.roll()
  })

  controller.on('roll-result', async ({ player, roll, isMe }) => {
    if (isMe) {
      console.log(`\nYou rolled: [${roll.values.join(', ')}] = ${roll.total}`)

      // Tile selection loop — runs after canMove check in controller
      // If controller emits no-valid-moves first, this won't be reached
      const selectTiles = async () => {
        const { hintsRemaining } = controller.state
        console.log(`\n(type "hint" to reveal combos — ${hintsRemaining} hint${hintsRemaining !== 1 ? 's' : ''} left)`)

        while (true) {
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

          // shutTiles() emits 'error' on invalid, 'tiles-shut' on success
          // We use a one-time listener to detect the outcome
          let resolved = false
          const onError = ({ message }) => {
            if (!resolved) console.log(`  Invalid: ${message}`)
          }
          controller.once('error', onError)
          controller.shutTiles(tiles)
          // Give the event loop a tick — if tiles-shut fired, _shutResolve was called
          await new Promise(r => setImmediate(r))
          controller.removeListener('error', onError)

          // Check if turn is still active (if shutTiles succeeded, _activeTurn is cleared)
          if (!controller.state.hintsRemaining === null || controller.state.hintsRemaining !== null) {
            // Re-check: if shutResolve was resolved, the loop in controller moves on.
            // We just need to break here unconditionally because shutTiles either
            // threw (emitted error, _shutResolve NOT called) or succeeded.
            // The error listener above printed the message; on success we break.
            // We detect success by checking if activeTurn is still set — but that's private.
            // Instead: if no error event was emitted in this tick, it succeeded.
            resolved = true
            break
          }
        }
      }

      // Only prompt tile selection if controller didn't immediately emit no-valid-moves
      // We detect this by waiting one tick
      await new Promise(r => setImmediate(r))
      if (controller.state.phase === 'playing') {
        await selectTiles()
      }
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
      console.log('\n  ★★★ YOU SHUT THE BOX! Perfect score: 0 ★★★')
    } else {
      console.log(`\n  ★★★ ${player.name} SHUT THE BOX! Score: 0 ★★★`)
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

  controller.on('error', ({ message }) => {
    console.log(`  ! ${message}`)
  })
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

const args = process.argv.slice(2)
const isHost = args.includes('--host')
const isJoin = args.includes('--join')

async function main () {
  console.log('╔══════════════════════════════════════════╗')
  console.log('║        SHUT THE BOX — P2P Edition        ║')
  console.log('╠══════════════════════════════════════════╣')
  console.log(`║  Tiles 1-${NUM_TILES} · 2-4 players · ${MAX_HINTS} hints/game  ║`)
  console.log('║  1 roll per round · lowest score wins    ║')
  console.log('╚══════════════════════════════════════════╝')
  console.log()

  if (!isHost && !isJoin) {
    console.log('Usage:')
    console.log('  node apps/cli/index.js --host   (create a room)')
    console.log('  node apps/cli/index.js --join   (join a room)')
    process.exit(0)
  }

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

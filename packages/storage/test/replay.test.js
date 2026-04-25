import test from 'node:test'
import assert from 'node:assert/strict'
import { createDatabase, closeDatabase } from '../src/db.js'
import { EventLog } from '../src/eventLog.js'
import { loadMatchState } from '../src/replay.js'
import { MESSAGE_TYPES } from '../../../shared/src/types.js'

test('Replay reconstructs match state', async () => {
  const { core, db } = await createDatabase('./.test-replay')
  const log = new EventLog(db, 'match-1')

  await log.append({
    type: 'GAME_START',
    matchId: 'match-1',
    authorId: 'peer-1',
    payload: { players: ['peer-1', 'peer-2'] }
  })

  const state = await loadMatchState(db, 'match-1')
  assert.equal(state.phase, 'playing')
  assert.deepEqual(state.players.map(p => p.id), ['peer-1', 'peer-2'])  // FIXED
  assert.equal(state.players[0].openTiles.length, 9)  // full board

  await closeDatabase({ core })
})
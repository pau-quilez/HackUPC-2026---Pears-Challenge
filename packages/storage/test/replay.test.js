import test from 'node:test'
import assert from 'node:assert/strict'
import { createDatabase, closeDatabase } from '../src/db.js'
import { EventLog } from '../src/eventLog.js'
import { loadMatchState } from '../src/replay.js'
import { MESSAGE_TYPES } from '../../../shared/src/types.js'

test('Replay reconstructs match state', async () => {
  const { core, db } = await createDatabase('./.test-storage-replay')
  const log = new EventLog(db, 'match-1')

  await log.append({
    type: MESSAGE_TYPES.GAME_START,
    authorId: 'peer-1',
    payload: { players: ['peer-1', 'peer-2'] }
  })

  await log.append({
    type: MESSAGE_TYPES.TILES_CLOSED,
    authorId: 'peer-1',
    payload: { tiles: [1, 2] }
  })

  const state = await loadMatchState(db, 'match-1')
  assert.equal(state.players.length, 2)
  assert.equal(state.board.includes(1), false)
  assert.equal(state.board.includes(2), false)

  await closeDatabase({ core })
})
import test from 'node:test'
import assert from 'node:assert/strict'
import { createDatabase, closeDatabase } from '../src/db.js'
import { EventLog } from '../src/eventLog.js'
import { MESSAGE_TYPES } from '../../../shared/src/types.js'

test('EventLog appends and reads events in order', async () => {
  const { core, db } = await createDatabase('./.test-storage-eventlog')
  const log = new EventLog(db, 'match-1')

  await log.append({
    type: MESSAGE_TYPES.GAME_START,
    authorId: 'peer-1',
    payload: { players: ['peer-1', 'peer-2'] }
  })

  await log.append({
    type: MESSAGE_TYPES.DICE_ROLLED,
    authorId: 'peer-1',
    payload: { dice1: 4, dice2: 3, total: 7 }
  })

  const events = await log.getAll()
  assert.equal(events.length, 2)
  assert.equal(events[0].type, MESSAGE_TYPES.GAME_START)
  assert.equal(events[1].payload.total, 7)

  await closeDatabase({ core })
})
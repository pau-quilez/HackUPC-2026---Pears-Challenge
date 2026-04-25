import test from 'node:test'
import assert from 'node:assert/strict'
import { createDatabase, closeDatabase } from '../src/db.js'
import { MatchStore } from '../src/matchStore.js'

test('MatchStore saves and loads match data', async () => {
  const { core, db } = await createDatabase('./data/test/matchstore')
  const store = new MatchStore(db)

  await store.saveMatch('match-1', {
    players: ['peer-1', 'peer-2'],
    startedAt: 123
  })

  const match = await store.getMatch('match-1')
  assert(match !== null)
  assert.deepEqual(match, {
    players: ['peer-1', 'peer-2'],
    startedAt: 123
  })

  await closeDatabase({ core })
})
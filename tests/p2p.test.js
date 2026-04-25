import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createMessage, parseMessage, msgPlayerJoin, msgDiceRoll } from '@shut-the-box/p2p'

describe('messages', () => {
  it('creates and parses a message', () => {
    const raw = createMessage('test-type', 'peer123', { hello: 'world' })
    const msg = parseMessage(raw)
    assert.strictEqual(msg.type, 'test-type')
    assert.strictEqual(msg.from, 'peer123')
    assert.deepStrictEqual(msg.payload, { hello: 'world' })
    assert.ok(typeof msg.timestamp === 'number')
  })

  it('creates player join message', () => {
    const raw = msgPlayerJoin('peer1', 'Alice')
    const msg = parseMessage(raw)
    assert.strictEqual(msg.type, 'player-join')
    assert.strictEqual(msg.payload.name, 'Alice')
  })

  it('creates dice roll message', () => {
    const raw = msgDiceRoll('peer1', { values: [3, 5], total: 8, count: 2 })
    const msg = parseMessage(raw)
    assert.strictEqual(msg.type, 'dice-roll')
    assert.strictEqual(msg.payload.total, 8)
  })

  it('returns null for invalid JSON', () => {
    assert.strictEqual(parseMessage('not json {{{'), null)
  })
})

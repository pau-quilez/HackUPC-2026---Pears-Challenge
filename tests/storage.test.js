import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { matchKey, eventKey, statsKey } from '@shut-the-box/storage'

describe('schema keys', () => {
  it('generates match keys', () => {
    assert.strictEqual(matchKey('abc123'), 'match:abc123')
  })

  it('generates event keys with zero-padded sequence', () => {
    assert.strictEqual(eventKey('abc123', 0), 'event:abc123:000000')
    assert.strictEqual(eventKey('abc123', 42), 'event:abc123:000042')
  })

  it('generates stats keys', () => {
    assert.strictEqual(statsKey('player1'), 'stats:player1')
  })
})

import Hyperswarm from 'hyperswarm'
import { createTopicBuffer } from '@shut-the-box/shared'
import { EventEmitter } from 'node:events'

/**
 * Thin wrapper around Hyperswarm for topic-based peer discovery.
 * Emits: 'peer-connected', 'peer-disconnected', 'message'
 */
export class SwarmManager extends EventEmitter {
  constructor () {
    super()
    this.swarm = new Hyperswarm()
    this.peers = new Map()
    this.topic = null

    this.swarm.on('connection', (connection, peerInfo) => {
      const id = peerInfo.publicKey.toString('hex')
      this.peers.set(id, connection)
      this.emit('peer-connected', id, connection)

      connection.on('data', (data) => {
        this.emit('message', id, data)
      })

      connection.on('close', () => {
        this.peers.delete(id)
        this.emit('peer-disconnected', id)
      })

      connection.on('error', (err) => {
        this.peers.delete(id)
        this.emit('peer-disconnected', id)
      })
    })
  }

  async join (roomName) {
    this.topic = createTopicBuffer(roomName)
    const discovery = this.swarm.join(this.topic, { client: true, server: true })
    await discovery.flushed()
    return this.topic.toString('hex')
  }

  broadcast (message) {
    const buf = typeof message === 'string' ? Buffer.from(message) : message
    for (const [, connection] of this.peers) {
      connection.write(buf)
    }
  }

  sendTo (peerId, message) {
    const conn = this.peers.get(peerId)
    if (conn) {
      const buf = typeof message === 'string' ? Buffer.from(message) : message
      conn.write(buf)
    }
  }

  get peerCount () {
    return this.peers.size
  }

  get peerIds () {
    return [...this.peers.keys()]
  }

  get publicKey () {
    return this.swarm.keyPair.publicKey.toString('hex')
  }

  async destroy () {
    await this.swarm.destroy()
  }
}

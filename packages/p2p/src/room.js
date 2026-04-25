import { EventEmitter } from 'node:events'
import { SwarmManager } from './swarm.js'
import { parseMessage, msgPlayerJoin } from './messages.js'

/**
 * A Room manages a group of peers connected to the same topic.
 * It handles player registration and message routing.
 * Zero I/O — no console.log. All output is via events.
 */
export class Room extends EventEmitter {
  constructor (playerName, core = null) {
    super()
    this.swarm = new SwarmManager(core)
    this.playerName = playerName
    this.players = new Map()

    this.swarm.on('peer-connected', (peerId) => {
      this.broadcast(msgPlayerJoin(this.swarm.publicKey, this.playerName))
      this.emit('peer-connected', peerId)
    })

    this.swarm.on('peer-disconnected', (peerId) => {
      this.players.delete(peerId)
      this.emit('peer-disconnected', peerId)
    })

    this.swarm.on('message', (peerId, data) => {
      const msg = parseMessage(data)
      if (!msg) return

      if (msg.type === 'player-join') {
        this.players.set(msg.from, msg.payload.name)
      }

      this.emit('message', msg)
    })
  }

  async host (roomName) {
    const topicHex = await this.swarm.join(roomName)
    this.players.set(this.swarm.publicKey, this.playerName)
    return topicHex
  }

  async join (roomName) {
    const topicHex = await this.swarm.join(roomName)
    this.players.set(this.swarm.publicKey, this.playerName)
    return topicHex
  }

  broadcast (message) {
    this.swarm.broadcast(message)
  }

  get myId () {
    return this.swarm.publicKey
  }

  get connectedPlayers () {
    return this.players
  }

  get playerCount () {
    return this.players.size
  }

  async destroy () {
    await this.swarm.destroy()
  }
}

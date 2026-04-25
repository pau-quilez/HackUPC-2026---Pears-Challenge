import { EventEmitter } from 'node:events'
import { SwarmManager } from './swarm.js'
import { parseMessage, msgPlayerJoin, msgGameState } from './messages.js'
import { shortId } from '@shut-the-box/shared'

/**
 * A Room manages a group of peers connected to the same topic.
 * It handles player registration and message routing.
 */
export class Room extends EventEmitter {
  constructor (playerName) {
    super()
    this.swarm = new SwarmManager()
    this.playerName = playerName
    this.players = new Map()
    this.isHost = false

    this.swarm.on('peer-connected', (peerId) => {
      console.log(`[room] Peer connected: ${shortId(peerId)}`)
      this.broadcast(msgPlayerJoin(this.swarm.publicKey, this.playerName))
      this.emit('peer-connected', peerId)
    })

    this.swarm.on('peer-disconnected', (peerId) => {
      const name = this.players.get(peerId) || shortId(peerId)
      console.log(`[room] Peer disconnected: ${name}`)
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
    this.isHost = true
    const topicHex = await this.swarm.join(roomName)
    this.players.set(this.swarm.publicKey, this.playerName)
    console.log(`[room] Hosting room "${roomName}" (topic: ${shortId(topicHex)})`)
    console.log(`[room] Your ID: ${shortId(this.swarm.publicKey)}`)
    return topicHex
  }

  async join (roomName) {
    this.isHost = false
    const topicHex = await this.swarm.join(roomName)
    this.players.set(this.swarm.publicKey, this.playerName)
    console.log(`[room] Joined room "${roomName}" (topic: ${shortId(topicHex)})`)
    console.log(`[room] Your ID: ${shortId(this.swarm.publicKey)}`)
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

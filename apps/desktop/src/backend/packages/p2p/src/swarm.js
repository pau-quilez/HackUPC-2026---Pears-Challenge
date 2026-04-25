import { createTopicBuffer } from '../../shared/src/index.js'
import { EventEmitter } from '../../../EventEmitter.js'

export class SwarmManager extends EventEmitter {
  constructor (core = null) {
    super()
    this.swarm = null
    this.channel = null
    this.mode = null
    this.peers = new Map()
    this.topic = null
    this.topicHex = null
    this.core = core
    this.localId = this._createLocalId()
  }

  _createLocalId () {
    if (globalThis.crypto?.getRandomValues) {
      const bytes = new Uint8Array(16)
      globalThis.crypto.getRandomValues(bytes)
      return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
    }
    return `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 18)}`
  }

  _normalizeMessage (message) {
    if (typeof message === 'string') return message
    if (message instanceof Uint8Array) {
      return new TextDecoder().decode(message)
    }
    return String(message)
  }

  _wireHyperswarmEvents () {
    this.swarm.on('connection', (connection, peerInfo) => {
      const id = peerInfo.publicKey.toString('hex')
      this.peers.set(id, connection)

      if (this.core) {
        this.core.replicate(connection, { live: true })
      }

      this.emit('peer-connected', id, connection)

      connection.on('data', (data) => {
        this.emit('message', id, data)
      })

      connection.on('close', () => {
        this.peers.delete(id)
        this.emit('peer-disconnected', id)
      })

      connection.on('error', () => {
        this.peers.delete(id)
        this.emit('peer-disconnected', id)
      })
    })
  }

  _wireBroadcastEvents () {
    this.channel.onmessage = (event) => {
      const data = event.data
      if (!data || data.from === this.localId) return
      if (data.room !== this.topicHex) return

      if (data.type === 'hello') {
        const isNew = !this.peers.has(data.from)
        this.peers.set(data.from, true)
        if (isNew) this.emit('peer-connected', data.from)
        this.channel.postMessage({
          type: 'hello-ack',
          room: this.topicHex,
          from: this.localId,
          to: data.from
        })
        return
      }

      if (data.type === 'hello-ack') {
        if (data.to !== this.localId) return
        const isNew = !this.peers.has(data.from)
        this.peers.set(data.from, true)
        if (isNew) this.emit('peer-connected', data.from)
        return
      }

      if (data.type === 'bye') {
        if (this.peers.delete(data.from)) {
          this.emit('peer-disconnected', data.from)
        }
        return
      }

      if (data.type === 'msg') {
        if (data.to && data.to !== this.localId) return
        this.emit('message', data.from, data.payload)
      }
    }
  }

  async _joinWithHyperswarm (roomName) {
    const module = await import('hyperswarm')
    const Hyperswarm = module.default
    this.swarm = new Hyperswarm()
    this.mode = 'hyperswarm'
    this._wireHyperswarmEvents()

    this.topic = createTopicBuffer(roomName)
    this.topicHex = this.topic.toString('hex')
    const discovery = this.swarm.join(this.topic, { client: true, server: true })
    await discovery.flushed()
    return this.topicHex
  }

  _joinWithBroadcastChannel (roomName) {
    if (typeof BroadcastChannel === 'undefined') {
      throw new Error('BroadcastChannel is not available in this runtime')
    }
    this.mode = 'broadcast-channel'
    this.topicHex = roomName
    this.channel = new BroadcastChannel(`stb-room-${roomName}`)
    this._wireBroadcastEvents()
    this.channel.postMessage({ type: 'hello', room: this.topicHex, from: this.localId })
    return this.topicHex
  }

  async join (roomName) {
    try {
      return await this._joinWithHyperswarm(roomName)
    } catch {
      return this._joinWithBroadcastChannel(roomName)
    }
  }

  broadcast (message) {
    const payload = this._normalizeMessage(message)
    if (this.mode === 'hyperswarm') {
      for (const [, connection] of this.peers) {
        connection.write(payload)
      }
      return
    }

    if (this.channel) {
      this.channel.postMessage({
        type: 'msg',
        room: this.topicHex,
        from: this.localId,
        payload
      })
    }
  }

  sendTo (peerId, message) {
    const payload = this._normalizeMessage(message)
    if (this.mode === 'hyperswarm') {
      const conn = this.peers.get(peerId)
      if (conn) conn.write(payload)
      return
    }

    if (this.channel) {
      this.channel.postMessage({
        type: 'msg',
        room: this.topicHex,
        from: this.localId,
        to: peerId,
        payload
      })
    }
  }

  get peerCount () {
    return this.peers.size
  }

  get peerIds () {
    return [...this.peers.keys()]
  }

  get publicKey () {
    if (this.mode === 'hyperswarm' && this.swarm) {
      return this.swarm.keyPair.publicKey.toString('hex')
    }
    return this.localId
  }

  async destroy () {
    if (this.channel) {
      this.channel.postMessage({ type: 'bye', room: this.topicHex, from: this.localId })
      this.channel.close()
      this.channel = null
    }
    if (this.swarm) {
      await this.swarm.destroy()
      this.swarm = null
    }
  }
}
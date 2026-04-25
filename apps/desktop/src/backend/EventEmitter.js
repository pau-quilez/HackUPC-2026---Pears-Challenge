export class EventEmitter {
  constructor () {
    this._listeners = new Map()
  }

  on (eventName, listener) {
    if (!this._listeners.has(eventName)) {
      this._listeners.set(eventName, new Set())
    }
    this._listeners.get(eventName).add(listener)
    return this
  }

  once (eventName, listener) {
    const wrapper = (...args) => {
      this.removeListener(eventName, wrapper)
      listener(...args)
    }
    return this.on(eventName, wrapper)
  }

  emit (eventName, ...args) {
    const listeners = this._listeners.get(eventName)
    if (!listeners || listeners.size === 0) return false

    for (const listener of [...listeners]) {
      listener(...args)
    }
    return true
  }

  removeListener (eventName, listener) {
    const listeners = this._listeners.get(eventName)
    if (!listeners) return this

    listeners.delete(listener)
    if (listeners.size === 0) {
      this._listeners.delete(eventName)
    }
    return this
  }

  off (eventName, listener) {
    return this.removeListener(eventName, listener)
  }
}

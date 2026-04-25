import { eventKey } from './schema.js'

export class EventLog {
  constructor (db, matchId) {
    this.db = db
    this.matchId = matchId
    this.seq = 0
  }

  async append (event) {
    const key = eventKey(this.matchId, this.seq++)
    await this.db.put(key, event)
    return key
  }

  async getAll () {
    const prefix = `event:${this.matchId}:`
    const events = []
    for await (const entry of this.db.createReadStream({
      gte: prefix,
      lt: prefix + '\xff'
    })) {
      events.push(entry.value)
    }
    return events
  }
}

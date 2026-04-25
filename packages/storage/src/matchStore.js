import { matchKey, statsKey } from './schema.js'

export class MatchStore {
  constructor (db) {
    this.db = db
  }

  async saveMatch (matchId, data) {
    await this.db.put(matchKey(matchId), data)
  }
  
  async getMatch (matchId) {
  const entry = await this.db.get(matchKey(matchId))
  return entry ? entry.value : null  // FIXED: handle null entry
  }
  

  async updateStats (playerId, score, won) {
    const key = statsKey(playerId)
    const entry = await this.db.get(key)
    const stats = entry ? entry.value : {
      gamesPlayed: 0,
      gamesWon: 0,
      totalScore: 0,
      bestScore: Infinity
    }

    stats.gamesPlayed++
    if (won) stats.gamesWon++
    stats.totalScore += score
    if (score < stats.bestScore) stats.bestScore = score

    await this.db.put(key, stats)
    return stats
  }

  async getStats (playerId) {
    const entry = await this.db.get(statsKey(playerId))
    return entry ? entry.value : null
  }
}

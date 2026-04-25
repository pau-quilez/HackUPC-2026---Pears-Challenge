import Hypercore from 'hypercore'
import Hyperbee from 'hyperbee'

export async function createDatabase (storagePath = './data/matches/default') {
  const core = new Hypercore(storagePath)
  await core.ready()

  const db = new Hyperbee(core, {
    keyEncoding: 'utf-8',
    valueEncoding: 'json'
  })
  await db.ready()

  return { core, db }
}

export async function closeDatabase ({ core }) { 
  await core.close()
}
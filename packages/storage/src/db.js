import Hypercore from 'hypercore'
import Hyperbee from 'hyperbee'

/**
 * Initialize a local Hyperbee database backed by a Hypercore.
 * @param {string} storagePath - Directory for the hypercore storage
 * @returns {{ core: Hypercore, db: Hyperbee }}
 */
export async function createDatabase (storagePath = './.storage-db') {
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

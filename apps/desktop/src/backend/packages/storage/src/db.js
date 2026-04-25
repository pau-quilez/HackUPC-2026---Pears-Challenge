class InMemoryCore {
  async close () {}
}

class InMemoryDb {
  constructor () {
    this.map = new Map()
  }

  async ready () {}

  async put (key, value) {
    this.map.set(key, value)
  }

  async get (key) {
    if (!this.map.has(key)) return null
    return { key, value: this.map.get(key) }
  }

  async *createReadStream ({ gte = '', lt = '\uffff' } = {}) {
    const keys = [...this.map.keys()].sort()
    for (const key of keys) {
      if (key >= gte && key < lt) {
        yield { key, value: this.map.get(key) }
      }
    }
  }
}

export async function createDatabase (storagePath = './data/matches/default') {
  try {
    const [{ default: Hypercore }, { default: Hyperbee }] = await Promise.all([
      import('hypercore'),
      import('hyperbee')
    ])

    const core = new Hypercore(storagePath)
    await core.ready()

    const db = new Hyperbee(core, {
      keyEncoding: 'utf-8',
      valueEncoding: 'json'
    })
    await db.ready()

    return { core, db }
  } catch {
    return {
      core: new InMemoryCore(),
      db: new InMemoryDb()
    }
  }
}

export async function closeDatabase ({ core }) { 
  await core.close()
}
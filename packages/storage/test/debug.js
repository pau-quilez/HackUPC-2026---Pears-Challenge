import { createDatabase, closeDatabase } from '../src/db.js'
import { EventLog } from '../src/eventLog.js'

async function debugStorage () {
  console.log('=== Storage Debug ===')
  const { core, db } = await createDatabase('./.test-debug')
  
  const log = new EventLog(db, 'match-1')
  
  console.log('1. Appending first event...')
  await log.append({
    type: 'GAME_START',
    authorId: 'peer-1',
    payload: { players: ['peer-1', 'peer-2'] }
  })
  
  console.log('2. Appending second event...')
  await log.append({
    type: 'DICE_ROLLED',
    authorId: 'peer-1',
    payload: { dice1: 4, dice2: 3, total: 7 }
  })
  
  console.log('3. Reading all events...')
  const events = await log.getAll()
  console.log('Events found:', events.length)
  console.log('First event:', events[0])
  console.log('Second event total:', events[1]?.payload?.total)
  
  console.log('4. Keys in DB:')
  for await (const entry of db.createReadStream()) {
    console.log(`Key: ${entry.key}, Seq: ${entry.value?.seq}`)
  }
  
  await closeDatabase({ core })
  console.log('=== Debug complete ===')
}

debugStorage().catch(console.error)
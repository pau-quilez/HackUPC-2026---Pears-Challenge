#!/usr/bin/env node

/**
 * Custom test runner that shows a test catalog before running
 * and a summary report after.
 */

import { run } from 'node:test'
import { spec } from 'node:test/reporters'
import { pipeline } from 'node:stream/promises'
import path from 'node:path'

const TEST_CATALOG = [
  {
    file: 'game.test.js',
    module: '@shut-the-box/game',
    tests: [
      { id: 1,  name: 'createBoard > returns tiles 1-12', desc: 'El tablero se crea con tiles del 1 al 12' },
      { id: 2,  name: 'rollDice > rolls 2 dice', desc: 'Tirar 2 dados devuelve 2 valores con total entre 2-12' },
      { id: 3,  name: 'rollDice > rolls 1 die', desc: 'Tirar 1 dado devuelve 1 valor con total entre 1-6' },
      { id: 4,  name: 'findValidCombinations > single-tile', desc: 'Encuentra combinaciones de 1 tile (ej: [3] para total 3)' },
      { id: 5,  name: 'findValidCombinations > multi-tile', desc: 'Encuentra combinaciones de varias tiles (ej: [2,5] y [3,4] para total 7)' },
      { id: 6,  name: 'findValidCombinations > no match', desc: 'Devuelve array vacio si no hay combinacion posible' },
      { id: 7,  name: 'findValidCombinations > tiles up to 12', desc: 'Funciona con tiles altos (10, 11, 12)' },
      { id: 8,  name: 'validateMove > valid', desc: 'Acepta tiles que estan abiertos y suman el total correcto' },
      { id: 9,  name: 'validateMove > wrong sum', desc: 'Rechaza tiles cuya suma no coincide con los dados' },
      { id: 10, name: 'validateMove > tile not open', desc: 'Rechaza tiles que ya estan cerrados' },
      { id: 11, name: 'shouldRollOneDie > true', desc: 'Devuelve true si la suma de tiles restantes es <= 3' },
      { id: 12, name: 'shouldRollOneDie > false', desc: 'Devuelve false si la suma de tiles restantes es > 3' },
      { id: 13, name: 'calculateScore > sum', desc: 'La puntuacion es la suma de tiles abiertos' },
      { id: 14, name: 'calculateScore > zero', desc: 'Score 0 cuando no quedan tiles (Shut the Box)' },
      { id: 15, name: 'calculateScore > high tiles', desc: 'Calcula correctamente con tiles 10, 11, 12' },
      { id: 16, name: 'Turn > initial state', desc: 'Turn empieza con 12 tiles, 3 hints, finished=false' },
      { id: 17, name: 'Turn > ends after shut', desc: 'El turno acaba despues de cerrar tiles (1 tirada por turno)' },
      { id: 18, name: 'Turn > useHint works', desc: 'Hint devuelve combinaciones validas y decrementa contador' },
      { id: 19, name: 'Turn > useHint exhausted', desc: 'Devuelve null si no quedan hints' }
    ]
  },
  {
    file: 'p2p.test.js',
    module: '@shut-the-box/p2p',
    tests: [
      { id: 20, name: 'messages > create and parse', desc: 'Crea un mensaje JSON y lo parsea correctamente con type/from/payload/timestamp' },
      { id: 21, name: 'messages > player join', desc: 'msgPlayerJoin genera mensaje tipo player-join con nombre del jugador' },
      { id: 22, name: 'messages > dice roll', desc: 'msgDiceRoll genera mensaje tipo dice-roll con valores y total' },
      { id: 23, name: 'messages > invalid JSON', desc: 'parseMessage devuelve null en vez de error para JSON invalido' }
    ]
  },
  {
    file: 'storage.test.js',
    module: '@shut-the-box/storage',
    tests: [
      { id: 24, name: 'schema > match key', desc: 'Genera clave match:ID para guardar datos de partida' },
      { id: 25, name: 'schema > event key', desc: 'Genera clave event:ID:SEQ con secuencia zero-padded (6 digitos)' },
      { id: 26, name: 'schema > stats key', desc: 'Genera clave stats:ID para estadisticas del jugador' }
    ]
  }
]

function printCatalog () {
  const totalTests = TEST_CATALOG.reduce((sum, f) => sum + f.tests.length, 0)

  console.log('╔═══════════════════════════════════════════════════════════════════╗')
  console.log('║                    SHUT THE BOX - Test Suite                      ║')
  console.log('╠═══════════════════════════════════════════════════════════════════╣')
  console.log(`║  Total: ${totalTests} tests | ${TEST_CATALOG.length} archivos | node:test runner                  ║`)
  console.log('╚═══════════════════════════════════════════════════════════════════╝')
  console.log()

  for (const file of TEST_CATALOG) {
    console.log(`── ${file.file} (${file.module}) ──────────────────────`)
    for (const t of file.tests) {
      const num = String(t.id).padStart(2, ' ')
      console.log(`  #${num}  ${t.name}`)
      console.log(`       ${t.desc}`)
    }
    console.log()
  }

  console.log('═══════════════════════════════════════════════════════════════════')
  console.log('  Ejecutando tests...')
  console.log('═══════════════════════════════════════════════════════════════════\n')
}

printCatalog()

const testFiles = TEST_CATALOG.map(f => path.resolve('tests', f.file))

const stream = run({ files: testFiles })
await pipeline(stream, new spec(), process.stdout)

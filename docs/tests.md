# Tests - Shut the Box P2P

## Como ejecutar

```bash
# Con catalogo descriptivo + resultados detallados
npm test

# Ejecucion rapida (sin catalogo)
npm run test:quick
```

`npm test` ejecuta `tests/run.js`, que primero muestra un catalogo numerado con la descripcion de cada test, y despues ejecuta todos los tests mostrando el resultado con el reporter `spec` de `node:test`.

---

## Resumen

| Archivo | Modulo | Tests | Que testea |
|---|---|---|---|
| `game.test.js` | `@shut-the-box/game` | 19 | Logica del juego: tablero, dados, combinaciones, validacion, puntuacion, turnos, hints |
| `p2p.test.js` | `@shut-the-box/p2p` | 4 | Protocolo de mensajes: creacion, parseo, tipos especificos, tolerancia a errores |
| `storage.test.js` | `@shut-the-box/storage` | 3 | Esquema de claves de Hyperbee: formato de claves para partidas, eventos y estadisticas |
| **Total** | | **26** | |

---

## game.test.js (19 tests)

Testea la logica pura del juego definida en `packages/game/`. No tiene dependencias externas ni I/O.

### createBoard (1 test)

| # | Test | Descripcion |
|---|---|---|
| 1 | `returns tiles 1-12` | Verifica que `createBoard()` devuelve un array `[1, 2, ..., 12]` con exactamente `NUM_TILES` elementos. Se usa `NUM_TILES` de `constants.js` para que si se cambia el numero de tiles, el test se adapta automaticamente. |

### rollDice (2 tests)

| # | Test | Descripcion |
|---|---|---|
| 2 | `rolls the specified number of dice` | Tira 2 dados y comprueba: `count === 2`, array de 2 valores, total entre 2 y 12. |
| 3 | `rolls 1 die correctly` | Tira 1 dado y comprueba: `count === 1`, total entre 1 y 6. |

### findValidCombinations (4 tests)

Esta funcion usa **backtracking** para encontrar todos los subconjuntos de tiles abiertos cuya suma coincide con el total de los dados. Es el nucleo de la logica del juego.

| # | Test | Descripcion |
|---|---|---|
| 4 | `finds single-tile matches` | Con tiles `[1,2,3,4,5]` y objetivo `3`, encuentra la combinacion `[3]`. |
| 5 | `finds multi-tile matches` | Con tiles `[1,2,3,4,5]` y objetivo `7`, encuentra `[2,5]` y `[3,4]`. Verifica que se encuentran **todas** las combinaciones posibles. |
| 6 | `returns empty when no match` | Con tiles `[9]` y objetivo `3`, devuelve array vacio porque no hay ninguna combinacion posible. |
| 7 | `works with tiles up to 12` | Con tiles `[10,11,12]` y objetivo `12`, encuentra `[12]`. Verifica que la logica funciona correctamente con tiles > 9 (las nuevas tiles del tablero de 12). |

### validateMove (3 tests)

Valida que una jugada del usuario sea legal antes de aplicarla.

| # | Test | Descripcion |
|---|---|---|
| 8 | `accepts valid tile choices` | Tiles `[2,3]` suman 5 y estan abiertos en `[1,2,3,4,5]` con dados = 5 -> `valid: true`. |
| 9 | `rejects wrong sum` | Tiles `[2,4]` suman 6 pero los dados son 5 -> `valid: false`, razon: "sum mismatch". |
| 10 | `rejects tiles not open` | Tile `[2]` no existe en el board `[1,3,5]` -> `valid: false`, razon: "tile not open". |

### shouldRollOneDie (2 tests)

Decide si el jugador tira 1 dado o 2, segun la regla del `SINGLE_DIE_THRESHOLD` (actualmente = 3).

| # | Test | Descripcion |
|---|---|---|
| 11 | `returns true when sum <= 3` | Tiles `[1,2]` (suma 3), `[3]` (suma 3), `[1]` (suma 1) -> tira 1 dado. |
| 12 | `returns false when sum > 3` | Tiles `[1,2,3]` (suma 6), `[4]` (suma 4), `[7,8,9]` (suma 24) -> tira 2 dados. |

### calculateScore (3 tests)

La puntuacion final de un jugador es la suma de los tiles que le quedan abiertos. Menor = mejor.

| # | Test | Descripcion |
|---|---|---|
| 13 | `sums remaining tiles` | Tiles `[3,7,9]` -> score = 19. |
| 14 | `returns 0 for empty` | Tiles `[]` -> score = 0, que significa "Shut the Box" (el mejor resultado posible). |
| 15 | `handles tiles above 9` | Tiles `[10,11,12]` -> score = 33. Verifica que funciona con las tiles nuevas. |

### Turn (4 tests)

La clase `Turn` gestiona un turno de un jugador. Con las nuevas reglas: 1 tirada de dados + 1 seleccion de tiles = turno acabado.

| # | Test | Descripcion |
|---|---|---|
| 16 | `starts with 12 tiles and 3 hints` | Un Turn nuevo con `createBoard()` tiene 12 tiles abiertos, 3 hints disponibles, y `finished = false`. |
| 17 | `ends after shutting tiles` | Despues de cerrar tiles `[3,4]`, el turno se marca como `finished = true` y esos tiles desaparecen del board. Verifica la regla de 1 sola tirada por turno. |
| 18 | `useHint works` | Con tiles `[1,2,3]` y total 3, `useHint()` devuelve un array de combinaciones validas y decrementa `hintsRemaining` de 3 a 2. |
| 19 | `useHint exhausted` | Si se crea un Turn con 0 hints, `useHint()` devuelve `null` sin lanzar error. |

---

## p2p.test.js (4 tests)

Testea el protocolo de mensajes JSON que los peers usan para comunicarse. Definido en `packages/p2p/src/messages.js`.

### messages (4 tests)

| # | Test | Descripcion |
|---|---|---|
| 20 | `creates and parses a message` | `createMessage('test-type', 'peer123', { hello: 'world' })` genera un string JSON. `parseMessage()` lo reconstruye y se verifican los 4 campos: `type`, `from`, `payload` y `timestamp` (unix ms). |
| 21 | `creates player join message` | `msgPlayerJoin('peer1', 'Alice')` genera un mensaje de tipo `player-join` con `payload.name = 'Alice'`. Es el primer mensaje que se envia al conectar un peer. |
| 22 | `creates dice roll message` | `msgDiceRoll('peer1', { values: [3,5], total: 8, count: 2 })` genera un mensaje de tipo `dice-roll`. Verifica que el payload contiene el total correcto. |
| 23 | `returns null for invalid JSON` | `parseMessage('not json {{{')` devuelve `null` en vez de lanzar una excepcion. Garantiza que mensajes corruptos no crashean la app. |

---

## storage.test.js (3 tests)

Testea el esquema de claves de la base de datos Hyperbee. Definido en `packages/storage/src/schema.js`. Hyperbee ordena las claves lexicograficamente, asi que el formato de las claves es importante.

### schema keys (3 tests)

| # | Test | Descripcion |
|---|---|---|
| 24 | `generates match keys` | `matchKey('abc123')` -> `'match:abc123'`. Clave para guardar los datos de una partida completa (jugadores, ganador, timestamps). |
| 25 | `generates event keys` | `eventKey('abc123', 0)` -> `'event:abc123:000000'` y `eventKey('abc123', 42)` -> `'event:abc123:000042'`. La secuencia se rellena con ceros hasta 6 digitos para mantener el **orden lexicografico** correcto en Hyperbee (sin zero-padding, `event:...:9` iria despues de `event:...:10`). |
| 26 | `generates stats keys` | `statsKey('player1')` -> `'stats:player1'`. Clave para estadisticas acumuladas de un jugador (partidas jugadas, ganadas, mejor score). |

---

## Configuracion

Los tests usan el runner nativo de Node.js (`node:test`) con `assert/strict`. No requieren dependencias externas.

| Configuracion | Valor |
|---|---|
| Runner | `node:test` (nativo Node.js >= 18) |
| Assertions | `node:assert/strict` |
| Reporter | `spec` (para `npm test`) / TAP (para `npm run test:quick`) |
| Test runner custom | `tests/run.js` (catalogo + spec reporter) |

### Scripts disponibles

```bash
npm test          # Catalogo descriptivo + resultados spec
npm run test:quick  # Ejecucion directa rapida (output TAP)
```

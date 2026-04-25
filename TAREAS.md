# Tareas del Proyecto - Shut the Box P2P

> Juego multijugador P2P "Shut the Box" construido sobre Pear Runtime + Holepunch.
> Cada tarea tiene subtareas. Marcar con [x] cuando esté completada.

---

## TAREA 1: Game Engine (lógica pura del juego)

> Módulo: `packages/game/`
> Sin dependencias externas. Lógica pura de JavaScript sin I/O.

- [x] **1.1 Dados** (`dice.js`)
  - Tirar 1 o 2 dados de 6 caras
  - Devolver los valores individuales y la suma total

- [x] **1.2 Tablero** (`rules.js`)
  - Crear tablero con tiles 1-9
  - Calcular suma de tiles abiertas
  - Comprobar si el box está cerrado (victoria perfecta, score = 0)

- [x] **1.3 Reglas** (`rules.js`)
  - Si la suma de tiles abiertas es <= 6, el jugador tira solo 1 dado
  - Encontrar todas las combinaciones válidas de tiles que suman el resultado de los dados (algoritmo de backtracking)
  - Determinar si el jugador tiene alguna jugada válida disponible

- [x] **1.4 Validación de jugadas** (`validateMove.js`)
  - Comprobar que los tiles elegidos están abiertos
  - Comprobar que no hay tiles duplicados
  - Comprobar que la suma de los tiles elegidos coincide con el total de los dados
  - Devolver mensaje de error descriptivo si la jugada es inválida

- [x] **1.5 Gestión de turno** (`turn.js`)
  - Clase `Turn` que gestiona el estado de un turno completo de un jugador
  - Ciclo: tirar dados → elegir tiles → cerrar tiles → repetir o acabar turno
  - El turno acaba cuando no hay jugada válida o cuando se cierra el box
  - Al final del turno, calcular puntuación (suma de tiles que quedan abiertos)

- [x] **1.6 Cálculo de puntuación**
  - Score = suma de tiles abiertos (menor es mejor)
  - Score 0 = "Shut the Box" (cerrar todos los tiles, mejor resultado posible)

---

## TAREA 2: Protocolo de mensajes

> Módulo: `packages/p2p/src/messages.js`
> Define el formato JSON que usan los peers para comunicarse.

- [x] **2.1 Formato base de mensaje**
  - Cada mensaje es un JSON con: `type`, `from` (peer ID), `payload`, `timestamp`
  - Funciones `createMessage()` y `parseMessage()` para serializar/deserializar

- [x] **2.2 Tipos de mensaje definidos**
  - `player-join`: un jugador se anuncia con su nombre
  - `player-ready`: un jugador confirma que está listo
  - `game-start`: el host inicia la partida (envía lista de jugadores)
  - `game-state`: sincronización completa del estado
  - `dice-roll`: resultado de tirada de dados
  - `tiles-shut`: tiles que el jugador cierra
  - `turn-end`: fin de turno con puntuación
  - `game-over`: resultados finales de la partida
  - `chat`: mensaje de texto entre jugadores

- [x] **2.3 Funciones factory**
  - Una función helper por cada tipo de mensaje (`msgPlayerJoin()`, `msgDiceRoll()`, etc.)
  - Facilita crear mensajes sin recordar la estructura interna

---

## TAREA 3: Capa P2P con Hyperswarm

> Módulo: `packages/p2p/`
> Usa: **hyperswarm** (descubrimiento de peers via DHT + conexiones directas con hole-punching UDP)

- [x] **3.1 SwarmManager** (`swarm.js`)
  - Wrapper sobre Hyperswarm que simplifica la API
  - Crea un topic a partir de un nombre de sala (SHA-256 del nombre → buffer de 32 bytes)
  - `join(roomName)`: unirse a un topic (actúa como client y server)
  - `broadcast(message)`: enviar mensaje a todos los peers conectados
  - `sendTo(peerId, message)`: enviar mensaje a un peer específico
  - Emite eventos: `peer-connected`, `peer-disconnected`, `message`
  - Mantiene un Map de peers conectados (peerId → connection)

- [x] **3.2 Room** (`room.js`)
  - Capa de alto nivel sobre SwarmManager
  - Gestiona el registro de jugadores (nombre + ID)
  - Métodos `host(roomName)` y `join(roomName)` (misma lógica, distintos flags internos)
  - Al conectar un nuevo peer, se envía automáticamente un `player-join`
  - Mantiene un Map de jugadores conocidos (peerId → playerName)

- [x] **3.3 Compatibilidad con Pear Runtime**
  - Pear usa el module system de Bare (`require()`) en vez de Node.js ESM (`import/export`)
  - Evaluado: Bare/Pear actual soporta CJS y ESM con interoperabilidad, no es necesario convertir todo a CommonJS
  - Los módulos `hyperswarm`, `hypercore`, `hyperbee` están disponibles dentro de Pear de forma nativa
  - Se mantiene ESM en el proyecto para compatibilidad con workspaces Node.js; `hyperswarm` se importa por nombre de módulo (`import 'hyperswarm'`), válido en CLI y en Pear

- [x] **3.4 Reconexión y tolerancia a fallos**
  - `_handlePeerDisconnected()` detecta desconexión y emite `player-left`
  - Si un jugador se desconecta en su turno, el `_opponentResolve` se resuelve y se salta su turno
  - Ya no hay host, así que no hay migración de host — modelo simétrico
  - Si quedan menos de `MIN_PLAYERS`, se aborta la partida con `game-aborted`
  - `_abortDueToDisconnect()` desbloquea todos los resolvers pendientes

---

## TAREA 4: GameController (orquestación de la partida)

> `packages/game/src/controller.js` — módulo independiente, event-driven, cero I/O.
> **Modelo simétrico: no hay host.** Cualquier jugador puede iniciar la partida.

- [x] **4.1 Extraer GameController a un módulo independiente**
  - `packages/game/src/controller.js` — extiende EventEmitter, cero I/O
  - Sin dependencia de readline, console.log ni ningún terminal
  - Emite: `connected`, `lobby-updated`, `player-joined`, `player-left`, `game-started`, `round-start`, `my-turn`, `opponent-turn`, `roll-result`, `no-valid-moves`, `tiles-shut`, `round-done`, `shut-the-box`, `game-over`, `game-aborted`, `error`
  - Acepta acciones: `connect(name, room, mode)`, `startGame()`, `roll()`, `shutTiles()`, `useHint()`
  - `apps/cli/index.js` reescrito como adaptador fino (solo escucha eventos y llama acciones)

- [x] **4.2 Fase Lobby (simétrica)**
  - Ya no hay distinción host/guest — todos los peers esperan en `_lobbyPhase()`
  - Cualquier jugador puede llamar `startGame()` para iniciar la partida
  - `startGame()` valida `MIN_PLAYERS` y `MAX_PLAYERS` antes de proceder
  - Al iniciar, ordena jugadores por ID (`localeCompare`) para que todos tengan el mismo orden de turnos
  - Los peers que reciben `GAME_START` adoptan el orden de jugadores del iniciador

- [x] **4.3 Fase Playing**
  - `_gameLoop()` itera jugadores en orden secuencial por ronda
  - Turno propio: `_playMyTurn()` bloquea con Promises hasta que la UI llama `roll()` y `shutTiles()`
  - Turno ajeno: bloquea en `_opponentResolve` hasta recibir `TURN_END` del peer
  - Si el oponente se desconecta durante su turno, el resolver se desbloquea automáticamente
  - Estado sincronizado via mensajes: `DICE_ROLL`, `TILES_SHUT`, `TURN_END`

- [x] **4.4 Fase Finished**
  - `_finishGame()` ordena resultados por score ascendente
  - Ganador = menor puntuación; empate si varios tienen el mismo score (`winnerId = null`)
  - Todos los peers broadcast `game-over` con resultados (no solo uno)
  - Se persiste el resultado con `MatchStore.saveMatch()` y `updateStats()` para cada jugador

- [x] **4.5 Fuente de verdad y anti-trampas**
  - Modelo simple y simétrico: cada peer valida su propia jugada localmente y confía en los mensajes
  - No hay host autoritativo — todos calculan su ranking local
  - Suficiente para el hackathon; modelo robusto queda como mejora futura

---

## TAREA 5: Storage con Hyperbee

> Módulo: `packages/storage/`
> Usa: **hypercore** (log append-only) + **hyperbee** (key-value store sobre Hypercore)

- [x] **5.1 Base de datos local** (`db.js`)
  - Crear un Hypercore en un directorio local
  - Montar un Hyperbee encima con encoding UTF-8 para claves y JSON para valores
  - Funciones `createDatabase()` y `closeDatabase()`

- [x] **5.2 Esquema de claves** (`schema.js`)
  - `match:<matchId>` → datos de la partida (jugadores, ganador, timestamps)
  - `event:<matchId>:<seq>` → eventos de la partida en orden (para replay)
  - `stats:<playerId>` → estadísticas acumuladas del jugador

- [x] **5.3 EventLog** (`eventLog.js`)
  - Registrar cada acción de la partida como un evento secuencial
  - Poder recuperar todos los eventos de una partida (para replay o debug)

- [x] **5.4 MatchStore** (`matchStore.js`)
  - Guardar/recuperar datos de una partida
  - Actualizar estadísticas de jugador (partidas jugadas, ganadas, mejor score)

- [x] **5.5 Integrar storage en el GameController**
  - `_initStorage()` crea una Hyperbee local por partida (`matchId` único con `generateId()`)
  - Eventos registrados: `GAME_START`, `DICE_ROLLED`, `TILES_SHUT`, `TURN_END`, `SHUT_THE_BOX`, `GAME_OVER`
  - Al acabar: `saveMatch()` guarda resultado final con `winnerId`, `finishedAt` y ranking
  - `updateStats()` actualiza `gamesPlayed`, `gamesWon`, `totalScore`, `bestScore` para cada jugador
  - Guest también inicializa su propio storage local al recibir `GAME_START`

- [ ] **5.6 Decidir replicación**
  - Solo local: cada peer guarda su propio historial (más simple)
  - Replicado: el host comparte su Hypercore con los peers (más complejo, más completo)
  - Para el hackathon: solo local es suficiente

---

## TAREA 6: Configurar Pear Runtime

> Es la tarea clave para construir sobre https://pears.com/
> Pear es un runtime P2P de Tether/Holepunch que ejecuta apps desktop sin servidores.

- [ ] **6.1 Instalar Pear**
  - Instalar el runtime de Pear: `npm i -g pear`
  - Verificar que funciona: `pear --version`
  - Leer la documentación en https://docs.pears.com/

- [ ] **6.2 Configurar el manifiesto de la app** (`apps/desktop/package.json`)
  - Campo `pear.name`: nombre de la app en el ecosistema Pear
  - Campo `pear.type`: `"desktop"` para app con UI
  - Campo `main`: punto de entrada (`index.html`)
  - Las dependencias Holepunch (`hyperswarm`, `hypercore`, `hyperbee`) están disponibles de forma nativa en Pear, no hace falta instalarlas con npm

- [ ] **6.3 Adaptar el module system**
  - Pear usa Bare (no Node.js), que tiene su propio module system
  - Opciones:
    - **A) Convertir a CommonJS**: cambiar `import/export` por `require/module.exports`
    - **B) Usar bundler**: usar esbuild o rollup para generar un bundle único compatible
    - **C) Probar ESM**: verificar si la versión actual de Pear ya soporta `import/export`
  - Elegir la opción que funcione y sea más rápida de implementar

- [ ] **6.4 Usar la API de Pear en la app**
  - `Pear.config`: obtener configuración de la app (nombre, clave, etc.)
  - `Pear.teardown()`: registrar función de limpieza al cerrar la app (cerrar swarm, cerrar DB)
  - `Pear.updates()`: gestionar actualizaciones de la app en caliente (opcional)

- [ ] **6.5 Primer arranque**
  - Ejecutar con `pear run --dev .` desde `apps/desktop/`
  - Verificar que se abre la ventana con el HTML
  - Verificar que Hyperswarm funciona dentro de Pear (crear sala, ver peers)
  - Corregir cualquier error de compatibilidad

---

## TAREA 7: UI Desktop (HTML/CSS/JS dentro de Pear)

> Módulo: `apps/desktop/`
> La UI corre dentro de Pear Runtime (como un mini-navegador embebido).
> Se puede usar HTML puro + CSS + JS vanilla, o React/Vue si se quiere.

- [ ] **7.1 LobbyView** (`src/ui/LobbyView.js`)
  - Input de texto: nombre del jugador
  - Input de texto: nombre de la sala
  - Botón "Crear Sala" (actúa como host)
  - Botón "Unirse a Sala" (actúa como join)
  - Lista dinámica de jugadores conectados (se actualiza en tiempo real al conectar/desconectar peers)
  - Botón "Empezar Partida" (visible solo para el host, habilitado solo si hay >= 2 jugadores)
  - Indicador de estado de conexión (conectando... / conectado / error)

- [ ] **7.2 GameView - Tablero** (`src/ui/Board.js`)
  - 9 tiles numerados del 1 al 9, dispuestos en fila horizontal
  - Cada tile tiene 2 estados visuales: abierto (visible, clickable) y cerrado (tachado/oscurecido)
  - Los tiles se pueden seleccionar haciendo click (solo los que suman el total de los dados)
  - Resaltar tiles seleccionados con color diferente
  - Indicar visualmente qué combinaciones son válidas

- [ ] **7.3 GameView - Dados y controles** (`src/ui/GameView.js`)
  - Zona de dados: muestra los valores actuales (puede ser texto o iconos de dados)
  - Botón "Tirar Dados" (solo activo en tu turno, fase de tirada)
  - Botón "Cerrar Tiles" (solo activo en tu turno, después de tirar, cuando hay tiles seleccionados)
  - Botón "Pasar Turno" (si no puedes hacer ninguna jugada)
  - Indicador grande de quién tiene el turno actual
  - Si no es tu turno: deshabilitar todos los controles, mostrar "Esperando a [nombre]..."

- [ ] **7.4 GameView - Panel de jugadores**
  - Panel lateral o superior mostrando todos los jugadores
  - Para cada jugador: nombre, tiles abiertos/cerrados, puntuación parcial
  - Resaltar al jugador que tiene el turno actual
  - Animación o indicador cuando un jugador hace una jugada

- [ ] **7.5 ScoreboardView**
  - Se muestra al acabar la partida
  - Ranking de jugadores ordenados por puntuación (menor = mejor)
  - Resaltar al ganador
  - Indicar "SHUT THE BOX" si alguien cerró los 9 tiles
  - Botón "Volver al Lobby" para jugar otra partida

- [ ] **7.6 Estilos y diseño visual**
  - Estilo de juego de mesa: colores cálidos, madera, tiles que parecen físicos
  - Responsive: que se vea bien en diferentes tamaños de ventana
  - Usar CSS puro o Tailwind CSS (Tailwind requiere build step)
  - Animaciones básicas: dados girando, tiles cayendo al cerrarse

- [ ] **7.7 Conectar UI con GameController**
  - La UI llama métodos del GameController (roll, shutTiles, startGame)
  - El GameController emite eventos que la UI escucha para actualizar la pantalla
  - El GameController se comunica con Room (P2P) para enviar/recibir mensajes de los peers
  - Flujo: click en UI → GameController → Room.broadcast() → otros peers → su GameController → su UI

---

## TAREA 8: Testing y estabilidad

- [x] **8.1 Tests unitarios de game logic** (`tests/game.test.js`)
  - Crear tablero, tirar dados, validar combinaciones, calcular puntuación

- [x] **8.2 Tests unitarios de mensajes** (`tests/p2p.test.js`)
  - Crear y parsear mensajes, verificar tipos y payloads

- [x] **8.3 Tests unitarios de schema** (`tests/storage.test.js`)
  - Verificar formato de claves de Hyperbee

- [ ] **8.4 Test de integración: 2 peers en la misma máquina**
  - Abrir 2 terminales, uno con `--host` y otro con `--join`
  - Jugar una partida completa hasta el final
  - Verificar que el estado se sincroniza correctamente

- [ ] **8.5 Test multi-máquina**
  - Probar con 2 ordenadores en la misma red local
  - Probar con 2 ordenadores en redes diferentes (Hyperswarm con DHT debería funcionar)
  - Medir latencia y verificar que no hay desfase de estado

- [ ] **8.6 Tests de edge cases**
  - Jugador se desconecta a mitad de turno
  - Sala llena (jugador n.º 7+ cuando `MAX_PLAYERS` = 6)
  - Host se desconecta
  - Dos jugadores con el mismo nombre
  - Conexión lenta o con pérdida de paquetes

---

## TAREA 9: Deploy y distribución con Pear

> Fase final: publicar la app para que otros la puedan ejecutar con su link pear://

- [ ] **9.1 Stage**
  - Ejecutar `pear stage` en el directorio de la app desktop
  - Esto prepara la app para distribución (crea un bundle optimizado)

- [ ] **9.2 Seed**
  - Ejecutar `pear seed` para empezar a servir la app desde tu máquina
  - Mientras tu máquina esté encendida, otros peers pueden descargar la app

- [ ] **9.3 Compartir**
  - Pear genera un link tipo `pear://<key>` que identifica tu app
  - Cualquier persona con Pear instalado puede ejecutar: `pear run pear://<key>`
  - No necesita servidor, la app se descarga directamente de tu máquina via P2P

- [ ] **9.4 Documentar**
  - Añadir al README instrucciones de cómo instalar Pear
  - Añadir el link `pear://` de la app publicada
  - Instrucciones para ejecutar la app desde el link

---

## Resumen visual

```
HECHO                          POR HACER
─────                          ─────────
[████████████] T1 Game         [░░░░░░░░░░░░] T6 Configurar Pear
[████████████] T2 Mensajes     [░░░░░░░░░░░░] T7 UI Desktop
[████████████] T3 P2P          [░░░░░░░░░░░░] T8 Testing integración
[████████████] T4 Controller   [░░░░░░░░░░░░] T9 Deploy Pear
[████████████] T5 Storage
```

## Orden recomendado de ejecución

1. **T6** → Configurar Pear Runtime
2. **T7.1-7.3** → UI básica (Lobby + Board + Dados)
3. **T7.7** → Conectar UI con GameController
4. **T8.4** → Test integración 2 peers
5. **T7.4-7.6** → UI completa (panel jugadores, scoreboard, estilos)
6. **T8.5-8.6** → Tests avanzados
7. **T9** → Deploy con Pear

## Módulos Holepunch utilizados

| Módulo | Para qué lo usamos | Dónde |
|---|---|---|
| **hyperswarm** | Descubrimiento de peers y conexiones directas P2P | `packages/p2p/` |
| **hypercore** | Log append-only para guardar datos | `packages/storage/` |
| **hyperbee** | Base de datos key-value sobre Hypercore | `packages/storage/` |
| **hyperdht** | Lo usa Hyperswarm internamente, no lo tocamos directamente | (interno) |
| ~~hyperdrive~~ | No lo usamos (es para ficheros distribuidos) | - |
| ~~autopass~~ | No lo usamos (es para passwords) | - |

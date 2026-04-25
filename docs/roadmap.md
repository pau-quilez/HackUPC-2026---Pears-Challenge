# Roadmap

## Phase 1 - CLI on Single Machine (current)
- [x] Game engine (rules, dice, turns, validation)
- [x] P2P layer (Hyperswarm rooms, message protocol)
- [x] CLI client (interactive terminal game)
- [x] Unit tests
- [ ] Storage integration (match history)

## Phase 2 - Multi-Machine P2P
- [ ] Test across different machines on the same network
- [ ] Test across the internet (Hyperswarm DHT handles NAT traversal)
- [ ] Add reconnection handling
- [ ] Add latency/timeout handling

## Phase 3 - Desktop UI (Pear)
- [ ] Pear desktop app scaffold
- [ ] Lobby view (create/join room, player list)
- [ ] Game view (board, dice animation, tile selection)
- [ ] Scoreboard view
- [ ] Tailwind CSS styling

## Phase 4 - Polish
- [ ] Multiple rounds per match
- [ ] Spectator mode
- [ ] Match history browser
- [ ] Sound effects
- [ ] Animations

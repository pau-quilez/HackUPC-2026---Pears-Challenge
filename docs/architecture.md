# Architecture

## Overview

The project follows a monorepo structure with npm workspaces. Each package has a single responsibility and communicates through well-defined interfaces.

```
┌─────────────────────────────────────────┐
│              apps/cli  or  apps/desktop  │  UI Layer
├─────────────────────────────────────────┤
│  @shut-the-box/game    │  @shut-the-box/p2p    │  Logic + Network
├─────────────────────────────────────────┤
│            @shut-the-box/storage         │  Persistence
├─────────────────────────────────────────┤
│            @shut-the-box/shared          │  Constants + Utils
└─────────────────────────────────────────┘
```

## Data Flow

1. **Host** creates a room (joins a Hyperswarm topic)
2. **Peers** join the same topic by entering the same room name
3. Hyperswarm handles peer discovery via DHT
4. Connections are direct TCP/UDP streams with hole-punching
5. Game messages are JSON objects sent over these connections
6. Each peer runs game logic locally; the host arbitrates turn order

## P2P Model

- **Discovery**: Hyperswarm with SHA-256 topic derived from room name
- **Transport**: Direct peer connections (no relay servers)
- **Messages**: JSON-encoded game events broadcast to all peers
- **State**: Each peer maintains local game state, synchronized via messages

# CLI Client

Interactive command-line interface for Shut the Box. This is a **thin adapter** — it contains zero game logic, only rendering and input routing.

## How to run

```bash
node apps/cli/index.js
```

## Flow

1. Enter your name
2. Choose: **1** to create a game, **2** to join an existing one
3. Enter a room name (all players must use the same name)
4. In the lobby:
   - Press **ENTER** to refresh the player list
   - Type **`start`** to begin when there are 2+ players
5. During your turn:
   - Press **ENTER** to roll dice
   - Enter tiles to shut (comma-separated, e.g. `3,5`)
   - Type **`hint`** to see valid combinations (3 per game)
6. Game ends when all players are eliminated or shut the box

## Architecture

The CLI only does two things:

1. **Listens** to `GameController` events and renders them to the terminal.
2. **Calls** `GameController` actions (`roll()`, `shutTiles()`, `startGame()`) based on user input.

```
User input → CLI → GameController.action()
GameController.event → CLI → console.log()
```

All game logic, P2P communication, and storage happen inside the `GameController`.

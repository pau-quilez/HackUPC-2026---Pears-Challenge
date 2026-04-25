const app = document.getElementById('app')

let controller = null
let runningConnect = false
let GameControllerClass = null
const NUM_TILES = 12

const ui = {
	screen: 'connect',
	mode: 'create',
	name: '',
	roomName: '',
	myId: null,
	players: [],
	round: 0,
	phase: 'lobby',
	matchId: null,
	myTurn: false,
	canSelectTiles: false,
	selectedTiles: [],
	lastRoll: null,
	status: '',
	error: '',
	results: []
}

function escapeHtml (value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;')
}

function getMyPlayer () {
	return ui.players.find(p => p.id === ui.myId) || null
}

function getCurrentPlayer () {
	if (!controller) return null
	const index = controller.state.currentPlayerIndex
	return ui.players[index] || null
}

function selectedSum () {
	return ui.selectedTiles.reduce((sum, tile) => sum + tile, 0)
}

function resetTurnUiState () {
	ui.myTurn = false
	ui.canSelectTiles = false
	ui.selectedTiles = []
	ui.lastRoll = null
}

function setStatus (message) {
	ui.status = message
}

async function loadGameControllerClass () {
	if (GameControllerClass) return GameControllerClass
	const module = await import('./backend/packages/game/src/controller.js')
	GameControllerClass = module.GameController
	return GameControllerClass
}

function wireControllerEvents () {
	controller.on('connected', ({ myId }) => {
		ui.myId = myId
		ui.screen = 'lobby'
		ui.error = ''
		setStatus('Connected. Waiting for players...')
		render()
	})

	controller.on('lobby-updated', ({ players }) => {
		ui.players = players
		render()
	})

	controller.on('player-joined', ({ player, players }) => {
		ui.players = players
		setStatus(`${player.name} joined the room.`)
		render()
	})

	controller.on('player-left', ({ player, players }) => {
		ui.players = players
		setStatus(`${player.name} disconnected.`)
		render()
	})

	controller.on('game-started', ({ players, matchId }) => {
		ui.screen = 'game'
		ui.players = players
		ui.matchId = matchId
		ui.phase = 'playing'
		ui.error = ''
		setStatus('Game started.')
		render()
	})

	controller.on('round-start', ({ round }) => {
		ui.round = round
		ui.canSelectTiles = false
		ui.selectedTiles = []
		ui.lastRoll = null
		setStatus(`Round ${round}`)
		render()
	})

	controller.on('my-turn', ({ player, round }) => {
		ui.myTurn = true
		ui.canSelectTiles = false
		ui.selectedTiles = []
		ui.lastRoll = null
		setStatus(`Your turn: ${player.name} (Round ${round})`)
		render()
	})

	controller.on('opponent-turn', ({ player, round }) => {
		ui.myTurn = false
		ui.canSelectTiles = false
		ui.selectedTiles = []
		ui.lastRoll = null
		setStatus(`${player.name}'s turn (Round ${round})`) 
		render()
	})

	controller.on('has-valid-moves', () => {
		ui.canSelectTiles = true
		setStatus('Select tiles and confirm your move.')
		render()
	})

	controller.on('roll-result', ({ player, roll, isMe }) => {
		ui.lastRoll = roll
		if (isMe) {
			setStatus(`You rolled ${roll.values.join(' + ')} = ${roll.total}`)
		} else {
			setStatus(`${player.name} rolled ${roll.values.join(' + ')} = ${roll.total}`)
		}
		render()
	})

	controller.on('tiles-shut', ({ player, tiles, isMe }) => {
		if (isMe) {
			setStatus(`You shut [${tiles.join(', ')}]`)
			ui.canSelectTiles = false
			ui.selectedTiles = []
		} else {
			setStatus(`${player.name} shut [${tiles.join(', ')}]`)
		}
		render()
	})

	controller.on('no-valid-moves', ({ player, isMe }) => {
		if (isMe) {
			resetTurnUiState()
			setStatus('No valid moves. You are out.')
		} else {
			setStatus(`${player.name} has no valid moves.`)
		}
		render()
	})

	controller.on('round-done', ({ player, score, isMe }) => {
		if (isMe) {
			resetTurnUiState()
			setStatus(`Round done. Your score: ${score}`)
		} else {
			setStatus(`${player.name} finished the round. Score: ${score}`)
		}
		render()
	})

	controller.on('shut-the-box', ({ player, isMe }) => {
		if (isMe) {
			resetTurnUiState()
			setStatus('You shut the box!')
		} else {
			setStatus(`${player.name} shut the box!`)
		}
		render()
	})

	controller.on('game-over', ({ results }) => {
		ui.screen = 'end'
		ui.results = results
		ui.phase = 'finished'
		setStatus('Game over.')
		render()
	})

	controller.on('game-aborted', ({ reason, results }) => {
		ui.screen = 'end'
		ui.results = results
		ui.phase = 'finished'
		ui.error = reason
		setStatus('Game aborted.')
		render()
	})

	controller.on('error', ({ message }) => {
		ui.error = message
		render()
	})
}

async function onConnectSubmit (event) {
	event.preventDefault()
	if (runningConnect) return

	const form = event.currentTarget
	const formData = new FormData(form)
	const name = String(formData.get('name') || '').trim()
	const roomName = String(formData.get('roomName') || '').trim()
	const mode = String(formData.get('mode') || 'create')

	if (!name || !roomName) {
		ui.error = 'Name and room are required.'
		render()
		return
	}

	ui.error = ''
	runningConnect = true
	render()

	try {
		const Controller = await loadGameControllerClass()
		controller = new Controller()
		wireControllerEvents()
		ui.name = name
		ui.roomName = roomName
		ui.mode = mode
		setStatus('Connecting...')
		render()
		await controller.connect(name, roomName, mode)
	} catch (error) {
		ui.error = `Connection failed: ${error.message}`
		setStatus('')
		render()
	} finally {
		runningConnect = false
		render()
	}
}

function onStartGame () {
	ui.error = ''
	controller.startGame()
}

function onRoll () {
	ui.error = ''
	controller.roll()
}

function onHint () {
	ui.error = ''
	const combos = controller.useHint()
	if (combos === null) return
	if (combos.length === 0) {
		setStatus('No valid combinations available.')
	} else {
		const summary = combos.map(c => `[${c.join(', ')}]`).join('  ')
		setStatus(`Hint: ${summary}`)
	}
	render()
}

function onTileToggle (tileNumber) {
	if (!ui.canSelectTiles) return
	const myPlayer = getMyPlayer()
	if (!myPlayer || !myPlayer.openTiles.includes(tileNumber)) return

	if (ui.selectedTiles.includes(tileNumber)) {
		ui.selectedTiles = ui.selectedTiles.filter(t => t !== tileNumber)
	} else {
		ui.selectedTiles = [...ui.selectedTiles, tileNumber].sort((a, b) => a - b)
	}

	ui.error = ''
	render()
}

function onConfirmTiles () {
	if (!ui.canSelectTiles || !ui.lastRoll) return
	const sum = selectedSum()
	if (sum !== ui.lastRoll.total) {
		ui.error = `Selected tiles must sum exactly ${ui.lastRoll.total}.`
		render()
		return
	}

	ui.error = ''
	controller.shutTiles(ui.selectedTiles)
}

async function onLeaveGame () {
	if (controller) {
		await controller.destroy()
	}
	controller = null
	runningConnect = false
	Object.assign(ui, {
		screen: 'connect',
		mode: 'create',
		name: '',
		roomName: '',
		myId: null,
		players: [],
		round: 0,
		phase: 'lobby',
		matchId: null,
		myTurn: false,
		canSelectTiles: false,
		selectedTiles: [],
		lastRoll: null,
		status: '',
		error: '',
		results: []
	})
	render()
}

function renderConnectView () {
	return `
		<section class="card connect-card">
			<h1>Shut the Box</h1>
			<p class="subtitle">Desktop P2P Client</p>
			<form id="connect-form" class="form-grid">
				<label>
					<span>Your name</span>
					<input name="name" required maxlength="24" value="${escapeHtml(ui.name)}" />
				</label>
				<label>
					<span>Room name</span>
					<input name="roomName" required maxlength="64" value="${escapeHtml(ui.roomName)}" />
				</label>
				<label>
					<span>Mode</span>
					<select name="mode">
						<option value="create" ${ui.mode === 'create' ? 'selected' : ''}>Create game</option>
						<option value="join" ${ui.mode === 'join' ? 'selected' : ''}>Join game</option>
					</select>
				</label>
				<button type="submit" ${runningConnect ? 'disabled' : ''}>${runningConnect ? 'Connecting...' : 'Connect'}</button>
			</form>
			${ui.error ? `<p class="error">${escapeHtml(ui.error)}</p>` : ''}
		</section>
	`
}

function renderLobbyView () {
	return `
		<section class="card lobby-card">
			<header>
				<h2>Lobby</h2>
				<p>Room: <strong>${escapeHtml(ui.roomName)}</strong></p>
			</header>
			<p class="status">${escapeHtml(ui.status || 'Waiting for players...')}</p>
			<p class="hint">Any player can start when at least 2 players are connected.</p>
			<div class="actions">
				<button id="start-game" ${ui.players.length < 2 ? 'disabled' : ''}>Start game</button>
				<button id="leave-game" class="secondary">Leave</button>
			</div>
			<h3>Players (${ui.players.length})</h3>
			<ul class="player-list">
				${ui.players.map(player => `
					<li>
						<span>${escapeHtml(player.name)}</span>
						<small>${escapeHtml(player.id === ui.myId ? '(you)' : '')}</small>
					</li>
				`).join('')}
			</ul>
			${ui.error ? `<p class="error">${escapeHtml(ui.error)}</p>` : ''}
		</section>
	`
}

function renderTiles (player) {
	const openSet = new Set(player.openTiles)
	const isMyBoard = player.id === ui.myId
	const tiles = []
	for (let i = 1; i <= NUM_TILES; i++) {
		const open = openSet.has(i)
		const selected = isMyBoard && ui.selectedTiles.includes(i)
		const classes = [
			'tile',
			open ? 'open' : 'closed',
			selected ? 'selected' : ''
		].filter(Boolean).join(' ')

		tiles.push(`<button class="${classes}" data-tile="${i}" ${!open ? 'disabled' : ''}>${i}</button>`)
	}
	return tiles.join('')
}

function renderGameView () {
	const myPlayer = getMyPlayer()
	const currentPlayer = getCurrentPlayer()
	const total = ui.lastRoll?.total ?? '-'
	const selected = selectedSum()

	return `
		<section class="card game-card">
			<header class="game-header">
				<h2>Match ${escapeHtml((ui.matchId || '').slice(0, 8) || 'pending')}</h2>
				<p>Round ${ui.round || 1}</p>
			</header>

			<p class="status">${escapeHtml(ui.status || 'Game running...')}</p>
			<p class="turn">Current turn: <strong>${escapeHtml(currentPlayer?.name || '...')}</strong></p>

			<div class="actions">
				<button id="roll-btn" ${!ui.myTurn || ui.canSelectTiles ? 'disabled' : ''}>Roll dice</button>
				<button id="hint-btn" ${!ui.canSelectTiles ? 'disabled' : ''}>Hint</button>
				<button id="confirm-btn" ${!ui.canSelectTiles ? 'disabled' : ''}>Confirm tiles</button>
				<button id="leave-game" class="secondary">Leave</button>
			</div>

			<div class="roll-panel">
				<span>Roll:</span>
				<strong>${ui.lastRoll ? `${ui.lastRoll.values.join(' + ')} = ${ui.lastRoll.total}` : '-'}</strong>
				<span>Selected sum:</span>
				<strong>${selected} / ${total}</strong>
			</div>

			<div class="boards">
				${ui.players.map(player => `
					<article class="player-card ${player.id === ui.myId ? 'mine' : ''} ${currentPlayer && player.id === currentPlayer.id ? 'active' : ''}">
						<header>
							<h3>${escapeHtml(player.name)} ${player.id === ui.myId ? '<small>(you)</small>' : ''}</h3>
							<p>Score: ${player.shutTheBox ? 0 : player.score}</p>
						</header>
						<div class="tiles" data-owner="${escapeHtml(player.id)}">
							${renderTiles(player)}
						</div>
					</article>
				`).join('')}
			</div>

			${ui.error ? `<p class="error">${escapeHtml(ui.error)}</p>` : ''}
			${myPlayer ? `<p class="hint">Hints left: ${controller.state.hintsRemaining ?? myPlayer.hintsRemaining}</p>` : ''}
		</section>
	`
}

function renderEndView () {
	return `
		<section class="card end-card">
			<h2>${ui.error ? 'Game Aborted' : 'Game Over'}</h2>
			<p class="status">${escapeHtml(ui.error || ui.status)}</p>
			<ol class="results">
				${ui.results.map(result => `
					<li>
						<span>${escapeHtml(result.name)}</span>
						<strong>${result.score}</strong>
					</li>
				`).join('')}
			</ol>
			<div class="actions">
				<button id="leave-game">Back to lobby</button>
			</div>
		</section>
	`
}

function render () {
	if (!app) return

	if (ui.screen === 'connect') {
		app.innerHTML = renderConnectView()
		app.querySelector('#connect-form')?.addEventListener('submit', onConnectSubmit)
		return
	}

	if (ui.screen === 'lobby') {
		app.innerHTML = renderLobbyView()
		app.querySelector('#start-game')?.addEventListener('click', onStartGame)
		app.querySelector('#leave-game')?.addEventListener('click', () => {
			onLeaveGame().catch((error) => {
				ui.error = error.message
				render()
			})
		})
		return
	}

	if (ui.screen === 'game') {
		app.innerHTML = renderGameView()

		app.querySelector('#roll-btn')?.addEventListener('click', onRoll)
		app.querySelector('#hint-btn')?.addEventListener('click', onHint)
		app.querySelector('#confirm-btn')?.addEventListener('click', onConfirmTiles)
		app.querySelector('#leave-game')?.addEventListener('click', () => {
			onLeaveGame().catch((error) => {
				ui.error = error.message
				render()
			})
		})

		// Only allow tile clicks on my board and only while selecting.
		const myBoard = app.querySelector(`.tiles[data-owner="${CSS.escape(ui.myId || '')}"]`)
		if (myBoard) {
			myBoard.querySelectorAll('.tile.open').forEach(button => {
				button.addEventListener('click', () => {
					const tile = Number(button.dataset.tile)
					if (!Number.isNaN(tile)) onTileToggle(tile)
				})
			})
		}
		return
	}

	app.innerHTML = renderEndView()
	app.querySelector('#leave-game')?.addEventListener('click', () => {
		onLeaveGame().catch((error) => {
			ui.error = error.message
			render()
		})
	})
}

window.addEventListener('beforeunload', () => {
	if (controller) {
		controller.destroy().catch(() => {})
	}
})

render()

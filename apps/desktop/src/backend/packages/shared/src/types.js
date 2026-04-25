/**
 * @typedef {Object} Player
 * @property {string} id - Unique peer identifier (public key hex)
 * @property {string} name - Display name
 * @property {number[]} openTiles - Tiles still open [1..9]
 * @property {number} score - Sum of open tiles at end of turn (lower = better)
 * @property {boolean} ready - Ready to start
 * @property {boolean} finished - Has finished their round
 */

/**
 * @typedef {Object} DiceResult
 * @property {number[]} values - Individual die values
 * @property {number} total - Sum of dice
 * @property {number} count - Number of dice rolled (1 or 2)
 */

/**
 * @typedef {Object} GameState
 * @property {string} phase - Current game phase (lobby | playing | finished)
 * @property {Player[]} players - All players in the game
 * @property {number} currentPlayerIndex - Index of current player in players array
 * @property {string} turnState - Current turn state (rolling | choosing | done)
 * @property {DiceResult|null} lastRoll - Last dice roll result
 * @property {string} hostId - Public key of the host peer
 * @property {number} round - Current round number
 */

/**
 * @typedef {Object} Message
 * @property {string} type - Message type from MSG_TYPES
 * @property {string} from - Sender peer id
 * @property {*} payload - Message payload
 * @property {number} timestamp - Unix timestamp
 */

export default {}

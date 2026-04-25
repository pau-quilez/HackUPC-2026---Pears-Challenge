// Define the action types that can be sent through the swarm
export const MESSAGE_TYPES = {
  // 1. Room and Chat Events (To complete the "Secure Vault" challenge)
  PEER_JOINED: 'PEER_JOINED',
  PEER_LEFT: 'PEER_LEFT',
  SECURE_MESSAGE: 'SECURE_MESSAGE', // Encrypted chat/private notes
  GAME_ANNOUNCEMENT: 'GAME_ANNOUNCEMENT', // System-wide announcements (e.g., "New version available!")
  
  // 2. "Shut the Box" Game Events
  GAME_START: 'GAME_START',
  DICE_ROLLED: 'DICE_ROLLED',
  TILES_CLOSED: 'TILES_CLOSED',
  TURN_PASSED: 'TURN_PASSED',
  GAME_OVER: 'GAME_OVER', 
  LEADERBOARD_UPDATE: 'LEADERBOARD_UPDATE'
};

// Examples event format (the actual JSON content):

/* Example of a peer joining:
{
  type: MESSAGE_TYPES.PEER_JOINED,
  timestamp: 1716382910289,
  sequence_id: 0, // Incremental sequence number for ordering
  match_id: 'msg-000', // Unique message ID for tracking
  authorId: 'system',
  payload: { peerId: 'peer-c3d4', publicKey: 'abc123' }
}
*/

/* Example of a peer leaving:
{
  type: MESSAGE_TYPES.PEER_LEFT,
  timestamp: 1716382910290,
  sequence_id: 1,
  match_id: 'msg-000',
  authorId: 'system',
  payload: { peerId: 'peer-c3d4', publicKey: 'abc123'}
}
*/

/* Example of sending a secret note:
{
  type: MESSAGE_TYPES.SECURE_MESSAGE,
  timestamp: 1716382910291,
  sequence_id: 2,
  match_id: 'msg-001',
  authorId: 'peer-a1b2',
  payload: { text: 'The server password is 1234' }
}
*/

/* Example of createing game and announcing it to the swarm:
{
  type: MESSAGE_TYPES.GAME_ANNOUNCEMENT,
  timestamp: 1716382910291,
  authorId: 'peer-a1b2',
  payload: { topic: 'partida-super-xula' }
}
*/

/* Example of starting a game:
{
  type: MESSAGE_TYPES.GAME_START,
  timestamp: 1716382910292,
  sequence_id: 1, // Incremental sequence number for ordering
  match_id: 'msg-001', // Unique message ID for tracking
  authorId: 'peer-a1b2',
  payload: { players: ['peer-a1b2', 'peer-e5f6'] }
}
*/

/* Example of rolling the dice:
{
  type: MESSAGE_TYPES.DICE_ROLLED,
  timestamp: 1716382910295,
  sequence_id: 8, // Incremental sequence number for ordering
  match_id: 'match-xyz', // Unique identifier for the game session
  authorId: 'peer-a1b2',
  payload: { dice1: 4, dice2: 3, total: 7 }
}
*/

/* Example of closing tiles in "Shut the Box":
{
  type: MESSAGE_TYPES.TILES_CLOSED,
  timestamp: 1716382910300,
  sequence_id: 9, // Incremental sequence number for ordering
  match_id: 'match-xyz', // Unique identifier for the game session
  authorId: 'peer-a1b2',
  payload: { tiles: [3, 4] } // The player closes 3 and 4 because they add up to 7
}
*/

/* Example of passing a turn:
{
  type: MESSAGE_TYPES.TURN_PASSED,
  timestamp: 1716382910305,
  sequence_id: 10,
  match_id: 'match-xyz',
  authorId: 'peer-a1b2',
  payload: { nextPlayer: 'peer-e5f6' }
}
*/

/* Example of game over:
{
  type: MESSAGE_TYPES.GAME_OVER,
  timestamp: 1716382910310,
  sequence_id: 11,
  match_id: 'match-xyz',
  authorId: 'system',
  payload: { winner: 'peer-e5f6', score: 5 }
}
*/

/* Example of a leaderboard update:
{
  type: MESSAGE_TYPES.LEADERBOARD_UPDATE,
  sequence_id: 12,
  match_id: 'match-xyz',
  timestamp: 1716382910315,
  authorId: 'system',
  payload: { leaderboard: [{ peerId: 'peer-e5f6', wins: 1 }, { peerId: 'peer-a1b2', wins: 0 }] }
}
*/
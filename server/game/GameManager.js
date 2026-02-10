/**
 * Manages all game rooms
 */
class GameManager {
  constructor() {
    this.rooms = new Map(); // roomCode -> GameState
    this.playerRooms = new Map(); // playerId -> roomCode
  }

  /**
   * Create a new game room
   * @param {string} roomCode - Room code
   * @returns {GameState} New game state
   */
  createRoom(roomCode) {
    const GameState = require('./GameState');
    const gameState = new GameState(roomCode);
    this.rooms.set(roomCode, gameState);
    return gameState;
  }

  /**
   * Get game room
   * @param {string} roomCode - Room code
   * @returns {GameState|null} Game state or null
   */
  getRoom(roomCode) {
    return this.rooms.get(roomCode) || null;
  }

  /**
   * Join player to room - FIXED: Only joins existing rooms, doesn't create new ones
   * @param {string} playerId - Socket ID
   * @param {string} roomCode - Room code
   * @param {string} playerName - Player name
   * @returns {GameState|null} Game state or null (null if room doesn't exist)
   */
  joinRoom(playerId, roomCode, playerName) {
    // Normalize room code
    roomCode = roomCode.trim().toUpperCase();
    
    let gameState = this.getRoom(roomCode);
    
    // If not found, try case-insensitive search
    if (!gameState) {
      const availableRooms = Array.from(this.rooms.keys());
      const matchingRoom = availableRooms.find(r => r.toUpperCase() === roomCode);
      
      if (matchingRoom) {
        console.log(`🔍 Found existing room with different case: ${matchingRoom} -> using ${matchingRoom}`);
        gameState = this.getRoom(matchingRoom);
        roomCode = matchingRoom; // Use the actual room code
      }
    }
    
    // FIXED: Don't create room if it doesn't exist - only join existing rooms
    if (!gameState) {
      console.log(`❌ Room ${roomCode} does not exist - cannot join`);
      return null; // Room doesn't exist
    }
    
    if (gameState.phase === 'lobby') {
      gameState.addPlayer(playerId, playerName);
      this.playerRooms.set(playerId, roomCode);
      console.log(`✅ Player ${playerName} (${playerId}) joined room ${roomCode}`);
      return gameState;
    }
    
    return null; // Can't join after game started
  }

  /**
   * Remove player from room
   * @param {string} playerId - Socket ID
   */
  leaveRoom(playerId) {
    const roomCode = this.playerRooms.get(playerId);
    if (roomCode) {
      const gameState = this.getRoom(roomCode);
      if (gameState) {
        gameState.removePlayer(playerId);
        
        // Clean up empty rooms
        if (gameState.players.length === 0) {
          this.rooms.delete(roomCode);
        }
      }
      this.playerRooms.delete(playerId);
    }
  }

  /**
   * Get player's room
   * @param {string} playerId - Socket ID
   * @returns {string|null} Room code or null
   */
  getPlayerRoom(playerId) {
    return this.playerRooms.get(playerId) || null;
  }

  /**
   * Check if player is room creator (first player)
   * @param {string} playerId - Socket ID
   * @param {string} roomCode - Room code
   * @returns {boolean} True if creator
   */
  isRoomCreator(playerId, roomCode) {
    const gameState = this.getRoom(roomCode);
    if (!gameState || gameState.players.length === 0) return false;
    return gameState.players[0].id === playerId;
  }

  /**
   * Get list of all available rooms
   * @returns {Array} Array of room info objects
   */
  getAvailableRooms() {
    const rooms = [];
    this.rooms.forEach((gameState, roomCode) => {
      rooms.push({
        roomCode: roomCode,
        phase: gameState.phase,
        playerCount: gameState.players.length,
        maxPlayers: 10, // Can be made configurable
        canJoin: gameState.phase === 'lobby'
      });
    });
    return rooms;
  }

  /**
   * Check if room exists
   * @param {string} roomCode - Room code
   * @returns {boolean} True if room exists
   */
  roomExists(roomCode) {
    return this.rooms.has(roomCode);
  }

  /**
   * Get room info
   * @param {string} roomCode - Room code
   * @returns {Object|null} Room info or null
   */
  getRoomInfo(roomCode) {
    const gameState = this.getRoom(roomCode);
    if (!gameState) return null;

    return {
      roomCode: roomCode,
      phase: gameState.phase,
      playerCount: gameState.players.length,
      players: gameState.players.map(p => ({
        id: p.id,
        name: p.name,
        isAlive: p.isAlive
      })),
      canJoin: gameState.phase === 'lobby'
    };
  }
}

module.exports = GameManager;

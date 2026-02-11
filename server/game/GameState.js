/**
 * Game state machine and phase management
 */
class GameState {
  constructor(roomCode) {
    this.roomCode = roomCode;
    this.phase = 'lobby'; // 'lobby' | 'night' | 'day'
    this.players = [];
    this.nightActions = {};
    this.votes = {};
    this.dayVoteCount = {};
    this.round = 0;
    this.phaseTimer = null;
    this.timeRemaining = 0;
    this.winner = null;
  }

  /**
   * Add player to game
   * @param {string} playerId - Socket ID
   * @param {string} playerName - Player name
   */
  addPlayer(playerId, playerName) {
    if (!this.players.find(p => p.id === playerId)) {
      this.players.push({
        id: playerId,
        name: playerName,
        role: null,
        isAlive: true,
        votes: 0,
        disconnected: false
      });
    }
  }

  /**
   * Mark player as disconnected (keeps slot for rejoin on refresh)
   * @param {string} playerId - Socket ID
   */
  disconnectPlayer(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (player) {
      player.disconnected = true;
      player.id = null; // Free socket id so we can assign new one on rejoin
    }
  }

  /**
   * Reconnect a disconnected player by name (e.g. after refresh)
   * @param {string} name - Player display name
   * @param {string} newSocketId - New socket ID
   * @returns {boolean} True if reconnected
   */
  reconnectPlayerByName(name, newSocketId) {
    const player = this.players.find(p => p.name === name && p.disconnected);
    if (player) {
      player.id = newSocketId;
      player.disconnected = false;
      return true;
    }
    return false;
  }

  /**
   * Remove player from game (full removal; used only if needed)
   * @param {string} playerId - Socket ID
   */
  removePlayer(playerId) {
    this.players = this.players.filter(p => p.id !== playerId);
  }

  /**
   * Assign roles to all players
   */
  assignRoles() {
    const roles = require('./RoleManager').assignRoles(this.players.length);
    this.players.forEach((player, index) => {
      player.role = roles[index];
    });
  }

  /**
   * Start game - transition from lobby to night
   */
  startGame() {
    if (this.phase !== 'lobby') return false;
    if (this.players.length < 3) return false; // Minimum 3 players
    
    this.assignRoles();
    this.round = 1;
    this.transitionToNight();
    return true;
  }

  /**
   * Transition to night phase
   */
  transitionToNight() {
    this.phase = 'night';
    this.nightActions = {};
    this.votes = {};
    this.timeRemaining = 60; // 60 seconds for night phase
    
    // Reset vote counts
    this.players.forEach(p => {
      p.votes = 0;
    });
  }

  /**
   * Transition to day phase
   * @param {Object} nightResults - Results from night actions
   */
  transitionToDay(nightResults) {
    this.phase = 'day';
    this.dayVoteCount = {};
    this.timeRemaining = 120; // 120 seconds for day phase
    
    // Process deaths
    if (nightResults.deaths.length > 0) {
      nightResults.deaths.forEach(playerId => {
        const player = this.players.find(p => p.id === playerId);
        if (player) {
          player.isAlive = false;
        }
      });
    }
  }

  /**
   * Record night action
   * @param {string} playerId - Player performing action
   * @param {string} role - Player's role
   * @param {string} targetId - Target player ID
   */
  recordNightAction(playerId, role, targetId) {
    if (this.phase !== 'night') return false;
    
    const player = this.players.find(p => p.id === playerId);
    if (!player || !player.isAlive || player.role !== role) return false;
    
    if (!this.nightActions[role]) {
      this.nightActions[role] = [];
    }
    
    // Remove existing action from this player
    this.nightActions[role] = this.nightActions[role].filter(
      a => a.playerId !== playerId
    );
    
    // Add new action
    this.nightActions[role].push({ playerId, targetId });
    return true;
  }

  /**
   * Record day vote
   * @param {string} voterId - Player voting
   * @param {string} targetId - Player being voted for
   */
  recordVote(voterId, targetId) {
    if (this.phase !== 'day') return false;
    
    const voter = this.players.find(p => p.id === voterId);
    const target = this.players.find(p => p.id === targetId);
    
    if (!voter || !voter.isAlive || !target || !target.isAlive) return false;
    
    // Remove previous vote
    if (this.dayVoteCount[voterId]) {
      const prevTarget = this.dayVoteCount[voterId];
      const prevTargetPlayer = this.players.find(p => p.id === prevTarget);
      if (prevTargetPlayer) {
        prevTargetPlayer.votes = Math.max(0, prevTargetPlayer.votes - 1);
      }
    }
    
    // Record new vote
    this.dayVoteCount[voterId] = targetId;
    if (target) {
      target.votes = (target.votes || 0) + 1;
    }
    
    return true;
  }

  /**
   * Get player with most votes (for elimination)
   * @returns {string|null} Player ID with most votes
   */
  getMostVotedPlayer() {
    let maxVotes = 0;
    let mostVoted = null;
    
    this.players.forEach(player => {
      if (player.isAlive && player.votes > maxVotes) {
        maxVotes = player.votes;
        mostVoted = player.id;
      }
    });
    
    // Need majority to eliminate
    const aliveCount = this.players.filter(p => p.isAlive).length;
    if (maxVotes > Math.floor(aliveCount / 2)) {
      return mostVoted;
    }
    
    return null;
  }

  /**
   * Get game state for client
   * @returns {Object} Public game state
   */
  getPublicState() {
    return {
      roomCode: this.roomCode,
      phase: this.phase,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        isAlive: p.isAlive,
        votes: p.votes,
        role: p.role,
        disconnected: p.disconnected === true
      })),
      timeRemaining: this.timeRemaining,
      round: this.round,
      winner: this.winner
    };
  }

  /**
   * Get player's private state (including their role)
   * @param {string} playerId - Player ID
   * @returns {Object} Player's private state
   */
  getPlayerState(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return { role: null, roleImage: null };
    return {
      role: player.role || null,
      roleImage: player.role ? require('./RoleManager').getRoleImage(player.role) : null
    };
  }

  /**
   * Check if room has a disconnected player with this name
   */
  getDisconnectedPlayerByName(name) {
    return this.players.find(p => p.name === name && p.disconnected) || null;
  }
}

module.exports = GameState;

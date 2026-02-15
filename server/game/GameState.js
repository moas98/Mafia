/**
 * Game state machine and phase management
 */
class GameState {
  constructor(roomCode) {
    this.roomCode = roomCode;
    this.phase = 'lobby'; // 'lobby' | 'night' | 'day'
    this.players = [];
    this.nightActions = {};
    this.investigationResults = {}; // { [playerId]: true (mafia) | false (not mafia) } — persisted for officer
    this.votes = {};
    this.dayVoteCount = {};
    this.round = 0;
    this.nightNumber = 0; // 1 = first night, 2 = second night (no actions), 3+, etc.
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
    this.transitionToNight({ firstNight: true });
    return true;
  }

  /**
   * Transition to night phase
   * @param {Object} [opts] - Options: { firstNight: true } for game start
   */
  transitionToNight(opts) {
    const timing = require('../config').getTiming();
    this.phase = 'night';
    this.nightActions = {};
    this.votes = {};
    this.timeRemaining = timing.nightRoundTime;

    if (opts && opts.firstNight) {
      this.nightNumber = 1;
    } else {
      this.nightNumber = (this.nightNumber || 0) + 1;
    }
    
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
    const timing = require('../config').getTiming();
    this.phase = 'day';
    this.dayVoteCount = {};
    this.dayHasVoted = {}; // track who has submitted a vote (so we can end day when all voted)
    this.timeRemaining = timing.dayRoundTime;
    this.players.forEach(p => { p.votes = 0; });

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
    
    // Citizens cannot perform night actions
    if (role === 'citizen') return false;
    
    // Validate target for roles that require one
    if (role === 'mafia' || role === 'detective' || role === 'doctor') {
      if (!targetId) return false;
      
      const target = this.players.find(p => p.id === targetId);
      if (!target || !target.isAlive) return false;
      
      // Mafia, Detective, and Doctor cannot target themselves (except Doctor can protect themselves)
      if (role !== 'doctor' && targetId === playerId) return false;
      // Mafia cannot target other mafia
      if (role === 'mafia' && target.role === 'mafia') return false;
    }
    
    if (!this.nightActions[role]) {
      this.nightActions[role] = [];
    }
    
    // Mafia can change their kill decision; others get one action per night
    if (role === 'mafia') {
      const idx = this.nightActions[role].findIndex(a => a.playerId === playerId);
      if (idx >= 0) {
        this.nightActions[role][idx] = { playerId, targetId };
        return true;
      }
    } else {
      const alreadySubmitted = this.nightActions[role].some(a => a.playerId === playerId);
      if (alreadySubmitted) return false;
    }
    
    this.nightActions[role].push({ playerId, targetId });
    return true;
  }

  /**
   * Whether all roles that must act this night have submitted (so night can be finished early)
   */
  allNightActionsSubmitted() {
    if (this.phase !== 'night') return false;
    if (this.nightNumber === 2) return true; // Night 2: no actions
    const aliveMafia = this.players.filter(p => p.role === 'mafia' && p.isAlive);
    const aliveDetective = this.players.find(p => p.role === 'detective' && p.isAlive);
    const aliveDoctor = this.players.find(p => p.role === 'doctor' && p.isAlive);
    const mafiaDone = aliveMafia.length === 0 || (this.nightActions.mafia && this.nightActions.mafia.length >= aliveMafia.length);
    const detectiveDone = !aliveDetective || (this.nightActions.detective && this.nightActions.detective.length >= 1);
    const doctorDone = !aliveDoctor || (this.nightActions.doctor && this.nightActions.doctor.length >= 1);
    return mafiaDone && detectiveDone && doctorDone;
  }

  /**
   * Record day vote
   * @param {string} voterId - Player voting
   * @param {string|null} targetId - Player being voted for (null = skip vote)
   */
  recordVote(voterId, targetId) {
    if (this.phase !== 'day') return false;
    
    const voter = this.players.find(p => p.id === voterId);
    if (!voter || !voter.isAlive) return false;
    
    if (!this.dayHasVoted) this.dayHasVoted = {};
    
    // Remove previous vote
    if (this.dayVoteCount[voterId]) {
      const prevTarget = this.dayVoteCount[voterId];
      const prevTargetPlayer = this.players.find(p => p.id === prevTarget);
      if (prevTargetPlayer) {
        prevTargetPlayer.votes = Math.max(0, prevTargetPlayer.votes - 1);
      }
    }
    
    // Handle skip vote (null targetId)
    if (!targetId) {
      delete this.dayVoteCount[voterId];
      this.dayHasVoted[voterId] = true;
      return true;
    }
    
    // Validate target
    const target = this.players.find(p => p.id === targetId);
    if (!target || !target.isAlive) return false;
    
    // Record new vote
    this.dayVoteCount[voterId] = targetId;
    this.dayHasVoted[voterId] = true;
    if (target) {
      target.votes = (target.votes || 0) + 1;
    }
    
    return true;
  }

  /**
   * Whether every alive player has submitted a vote (or skip) this day
   */
  allAliveHaveVoted() {
    const alive = this.players.filter(p => p.isAlive);
    if (alive.length === 0) return false;
    if (!this.dayHasVoted) return false;
    return alive.every(p => this.dayHasVoted[p.id] === true);
  }

  /**
   * Get player with most votes (for elimination).
   * Only returns a player if exactly one has the highest vote count (no tie).
   * @returns {string|null} Player ID with most votes, or null if draw or no votes
   */
  getMostVotedPlayer() {
    let maxVotes = 0;
    this.players.forEach(player => {
      if (player.isAlive && (player.votes || 0) > maxVotes) {
        maxVotes = player.votes || 0;
      }
    });
    if (maxVotes === 0) return null;

    const playersWithMax = this.players.filter(
      p => p.isAlive && (p.votes || 0) === maxVotes
    );
    if (playersWithMax.length !== 1) return null; // draw: nothing happens
    return playersWithMax[0].id;
  }

  /**
   * Process votes and eliminate player with majority
   * @returns {Object|null} Eliminated player object or null if no majority
   */
  processVotes() {
    const mostVotedId = this.getMostVotedPlayer();
    
    if (!mostVotedId) {
      // Clear votes if no majority
      this.players.forEach(p => {
        p.votes = 0;
      });
      this.dayVoteCount = {};
      return null;
    }
    
    // Eliminate the most voted player
    const eliminated = this.players.find(p => p.id === mostVotedId);
    if (eliminated) {
      eliminated.isAlive = false;
    }
    
    // Clear all votes
    this.players.forEach(p => {
      p.votes = 0;
    });
    this.dayVoteCount = {};
    
    return eliminated || null;
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
   * Get current mafia kill votes for display to mafia only
   * @returns {Array<{voterId, voterName, targetId, targetName}>}
   */
  getMafiaKillVotes() {
    if (!this.nightActions.mafia || !Array.isArray(this.nightActions.mafia)) return [];
    return this.nightActions.mafia.map(action => {
      const voter = this.players.find(p => p.id === action.playerId);
      const target = action.targetId ? this.players.find(p => p.id === action.targetId) : null;
      return {
        voterId: action.playerId,
        voterName: voter ? voter.name : 'Unknown',
        targetId: action.targetId || null,
        targetName: action.targetId ? (target ? target.name : 'Unknown') : 'Skip'
      };
    });
  }

  /**
   * Get day vote breakdown (who voted for whom) for display to all players
   * @returns {Array<{voterId, voterName, targetId, targetName}>}
   */
  getDayVoteBreakdown() {
    const out = [];
    if (!this.dayVoteCount || typeof this.dayVoteCount !== 'object') return out;
    Object.entries(this.dayVoteCount).forEach(([voterId, targetId]) => {
      const voter = this.players.find(p => p.id === voterId);
      const target = targetId ? this.players.find(p => p.id === targetId) : null;
      out.push({
        voterId,
        voterName: voter ? voter.name : 'Unknown',
        targetId: targetId || null,
        targetName: targetId ? (target ? target.name : 'Unknown') : 'Skip'
      });
    });
    // Include skip votes (dayHasVoted but not in dayVoteCount)
    if (this.dayHasVoted && typeof this.dayHasVoted === 'object') {
      this.players.forEach(p => {
        if (p.isAlive && this.dayHasVoted[p.id] && !this.dayVoteCount[p.id]) {
          out.push({
            voterId: p.id,
            voterName: p.name || 'Unknown',
            targetId: null,
            targetName: 'Skip'
          });
        }
      });
    }
    return out;
  }

  /**
   * Get player's private state (including their role)
   * @param {string} playerId - Player ID
   * @returns {Object} Player's private state
   */
  getPlayerState(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return { role: null, roleImage: null };
    const state = {
      role: player.role || null,
      roleImage: player.role ? require('./RoleManager').getRoleImage(player.role) : null
    };
    if (player.role === 'mafia') {
      state.mafiaTeammateIds = this.players
        .filter(p => p.role === 'mafia' && p.id !== playerId && p.isAlive)
        .map(p => p.id);
    }
    return state;
  }

  /**
   * Check if room has a disconnected player with this name
   */
  getDisconnectedPlayerByName(name) {
    return this.players.find(p => p.name === name && p.disconnected) || null;
  }
}

module.exports = GameState;

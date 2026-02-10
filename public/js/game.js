/**
 * Client-side game state management
 */
class GameState {
    constructor() {
        this.roomCode = null;
        this.playerName = null;
        this.playerId = null;
        this.role = null;
        this.roleImage = null;
        this.phase = 'lobby';
        this.players = [];
        this.timeRemaining = 0;
        this.round = 0;
        this.selectedTarget = null;
        this.nightActionSubmitted = false;
        this.voteSubmitted = false;
    }

    /**
     * Initialize game state
     */
    init(roomCode, playerName, playerId) {
        this.roomCode = roomCode;
        this.playerName = playerName;
        this.playerId = playerId;
    }

    /**
     * Set role
     */
    setRole(role, roleImage) {
        this.role = role;
        this.roleImage = roleImage;
    }

    /**
     * Update phase
     */
    updatePhase(phase, timeRemaining) {
        this.phase = phase;
        this.timeRemaining = timeRemaining;
        this.selectedTarget = null;
        
        // Reset action flags on phase change
        if (phase === 'night') {
            this.nightActionSubmitted = false;
        } else if (phase === 'day') {
            this.voteSubmitted = false;
        }
    }

    /**
     * Update players list
     */
    updatePlayers(players) {
        this.players = players;
    }

    /**
     * Get current player
     */
    getCurrentPlayer() {
        return this.players.find(p => p.id === this.playerId);
    }

    /**
     * Check if current player is alive
     */
    isAlive() {
        const player = this.getCurrentPlayer();
        return player ? player.isAlive : false;
    }

    /**
   * Get alive players
   */
    getAlivePlayers() {
        return this.players.filter(p => p.isAlive);
    }

    /**
     * Get players that can be targeted (alive, not self)
     */
    getTargetablePlayers() {
        return this.players.filter(
            p => p.isAlive && p.id !== this.playerId
        );
    }

    /**
     * Check if player can perform action
     */
    canPerformAction() {
        if (!this.isAlive()) return false;
        
        if (this.phase === 'night') {
            if (this.role === 'citizen') return false;
            return !this.nightActionSubmitted;
        } else if (this.phase === 'day') {
            return !this.voteSubmitted;
        }
        
        return false;
    }

    /**
     * Mark action as submitted
     */
    markActionSubmitted() {
        if (this.phase === 'night') {
            this.nightActionSubmitted = true;
        } else if (this.phase === 'day') {
            this.voteSubmitted = true;
        }
    }
}

// Export singleton instance
const gameState = new GameState();

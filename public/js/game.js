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
        this.nightNumber = 0; // 1 = first night, 2 = no actions night, 3+, etc.
        this.selectedTarget = null;
        this.nightActionSubmitted = false;
        this.voteSubmitted = false;
        this.investigationResults = {}; // { [playerId]: true (mafia) | false (not mafia) } — for card borders
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
     * @param {string} phase - 'lobby' | 'night' | 'day'
     * @param {number} timeRemaining - seconds left
     * @param {number} [nightNumber] - current night (1, 2, 3...); Night 2 = no actions
     */
    updatePhase(phase, timeRemaining, nightNumber) {
        this.phase = phase;
        this.timeRemaining = timeRemaining;
        if (nightNumber !== undefined && nightNumber !== null) this.nightNumber = nightNumber;
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
     * Set investigation results (from server) for officer card borders
     * @param {Object} results - { [playerId]: true (mafia) | false (not mafia) }
     */
    setInvestigationResults(results) {
        if (results && typeof results === 'object') {
            this.investigationResults = { ...results };
        }
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
     * Officer: 1 investigate per night. Doctor: 1 protect per night.
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

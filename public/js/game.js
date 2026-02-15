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
        this.selectedVoteTarget = null; // For voting dialog
        this.nightActionSubmitted = false;
        this.voteSubmitted = false;
        this.dayHasVoted = {}; // Track who has voted: { playerId: true/false }
        this.investigationResults = {}; // { [playerId]: true (mafia) | false (not mafia) } — for card borders
        this.mafiaTeammateIds = []; // other mafia player ids (so we don't show Kill on them)
        this.mafiaKillVotes = []; // [{ voterName, targetName }] — visible to mafia during night
        this.voteBreakdown = []; // [{ voterName, targetName }] — who voted for whom during day
        this.nightCanFinish = false; // true when all roles have acted — show Finish Night button
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
    setRole(role, roleImage, mafiaTeammateIds) {
        this.role = role;
        this.roleImage = roleImage;
        this.mafiaTeammateIds = Array.isArray(mafiaTeammateIds) ? mafiaTeammateIds : [];
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
        this.selectedVoteTarget = null;
        
        // Reset action flags on phase change
        if (phase === 'night') {
            this.nightActionSubmitted = false;
            this.nightCanFinish = false;
        } else if (phase === 'day') {
            this.voteSubmitted = false;
            this.nightCanFinish = false;
        } else {
            this.nightCanFinish = false;
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
     * Get players that can be targeted (alive, not self).
     * For mafia: excludes other mafia (no Kill button on teammates).
     */
    getTargetablePlayers() {
        let list = this.players.filter(
            p => p.isAlive && p.id !== this.playerId
        );
        if (this.role === 'mafia' && this.mafiaTeammateIds && this.mafiaTeammateIds.length) {
            const teammateSet = new Set(this.mafiaTeammateIds);
            list = list.filter(p => !teammateSet.has(p.id));
        }
        return list;
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

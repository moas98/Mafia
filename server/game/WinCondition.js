/**
 * Checks win conditions for the game
 */
class WinCondition {
  /**
   * Check if game has ended and determine winner
   * @param {Array} players - Array of player objects
   * @returns {Object|null} - { winner: 'mafia'|'citizens', reason: string } or null
   */
  static checkWinCondition(players) {
    const alivePlayers = players.filter(p => p.isAlive);
    if (alivePlayers.length === 0) {
      return { winner: 'draw', reason: 'All players have been eliminated.' };
    }
    const aliveMafia = alivePlayers.filter(p => p.role === 'mafia');
    const aliveCitizens = alivePlayers.filter(
      p => p.role === 'citizen' || p.role === 'detective' || p.role === 'doctor'
    );

    // Mafia wins if they equal or outnumber citizens
    if (aliveMafia.length >= aliveCitizens.length && aliveCitizens.length > 0) {
      return {
        winner: 'mafia',
        reason: 'Mafia outnumber the citizens!'
      };
    }

    // Citizens win if all Mafia are eliminated
    if (aliveMafia.length === 0 && aliveCitizens.length > 0) {
      return {
        winner: 'citizens',
        reason: 'All Mafia members have been eliminated!'
      };
    }

    return null;
  }
}

module.exports = WinCondition;

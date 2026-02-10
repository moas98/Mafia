/**
 * Manages role assignment and night actions
 */
class RoleManager {
  /**
   * Assign roles to players
   * @param {number} playerCount - Number of players
   * @returns {Array} Array of role strings
   */
  static assignRoles(playerCount) {
    const roles = [];
    
    // Determine role distribution based on player count
    let mafiaCount = Math.floor(playerCount / 3); // ~1/3 are Mafia
    if (mafiaCount < 1) mafiaCount = 1;
    if (mafiaCount >= playerCount - 2) mafiaCount = Math.max(1, playerCount - 3);
    
    const specialRoles = [];
    if (playerCount >= 4) {
      specialRoles.push('detective');
    }
    if (playerCount >= 5) {
      specialRoles.push('doctor');
    }
    
    const citizenCount = playerCount - mafiaCount - specialRoles.length;
    
    // Add roles
    for (let i = 0; i < mafiaCount; i++) {
      roles.push('mafia');
    }
    roles.push(...specialRoles);
    for (let i = 0; i < citizenCount; i++) {
      roles.push('citizen');
    }
    
    // Shuffle roles
    for (let i = roles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [roles[i], roles[j]] = [roles[j], roles[i]];
    }
    
    return roles;
  }

  /**
   * Get role image path
   * @param {string} role - Role name
   * @returns {string} Image path
   */
  static getRoleImage(role) {
    const imageMap = {
      'citizen': '/images/citizen.jpg',
      'mafia': '/images/mafia.jpg',
      'detective': '/images/officer.jpg',
      'doctor': '/images/doctor.jpg'
    };
    return imageMap[role] || '/images/citizen.jpg';
  }

  /**
   * Process night actions
   * @param {Object} nightActions - Object containing all night actions
   * @param {Array} players - Array of all players
   * @returns {Object} Results of night actions
   */
  static processNightActions(nightActions, players) {
    const results = {
      deaths: [],
      protected: null,
      detectiveResult: null
    };

    // Get Mafia kill target
    const mafiaVotes = {};
    if (nightActions.mafia) {
      nightActions.mafia.forEach(action => {
        if (action.targetId) {
          mafiaVotes[action.targetId] = (mafiaVotes[action.targetId] || 0) + 1;
        }
      });
    }

    // Find most voted target
    let killTarget = null;
    let maxVotes = 0;
    Object.keys(mafiaVotes).forEach(targetId => {
      if (mafiaVotes[targetId] > maxVotes) {
        maxVotes = mafiaVotes[targetId];
        killTarget = targetId;
      }
    });

    // Check if Doctor protected the target
    const doctorProtection = nightActions.doctor?.[0]?.targetId;
    if (doctorProtection === killTarget) {
      results.protected = killTarget;
      killTarget = null; // Protected from death
    }

    // Execute kill if not protected
    if (killTarget) {
      const target = players.find(p => p.id === killTarget);
      if (target && target.isAlive) {
        target.isAlive = false;
        results.deaths.push(killTarget);
      }
    }

    // Process Detective check
    if (nightActions.detective?.[0]?.targetId) {
      const checkedPlayer = players.find(p => p.id === nightActions.detective[0].targetId);
      if (checkedPlayer) {
        results.detectiveResult = {
          targetId: checkedPlayer.id,
          targetName: checkedPlayer.name,
          isMafia: checkedPlayer.role === 'mafia'
        };
      }
    }

    return results;
  }
}

module.exports = RoleManager;

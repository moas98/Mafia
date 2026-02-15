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

    // Get alive mafia count
    const aliveMafia = players.filter(p => p.role === 'mafia' && p.isAlive);
    const mafiaCount = aliveMafia.length;

    // Mafia kill: agree on one → kill that player; disagree → random among targeted players
    const mafiaVotes = {};
    const targetedByMafia = []; // all targets (one per mafia action)
    if (nightActions.mafia && Array.isArray(nightActions.mafia)) {
      nightActions.mafia.forEach(action => {
        if (action && action.targetId) {
          mafiaVotes[action.targetId] = (mafiaVotes[action.targetId] || 0) + 1;
          targetedByMafia.push(action.targetId);
        }
      });
    }

    // Only consider non-mafia targets (mafia cannot kill each other)
    const mafiaIds = new Set(players.filter(p => p.role === 'mafia' && p.isAlive).map(p => p.id));
    const voteTargets = Object.keys(mafiaVotes).filter(id => !mafiaIds.has(id));
    let killTarget = null;

    // Mafia must all agree on one person to kill; if they disagree, no kill
    if (voteTargets.length === 0) {
      killTarget = null;
    } else if (voteTargets.length === 1) {
      killTarget = voteTargets[0];
    } else {
      killTarget = null; // Disagreement = no kill
    }

    // Check if Doctor protected the target
    if (nightActions.doctor && Array.isArray(nightActions.doctor) && nightActions.doctor.length > 0) {
      const doctorAction = nightActions.doctor[0];
      if (doctorAction && doctorAction.targetId) {
        const doctorProtection = doctorAction.targetId;
        if (doctorProtection === killTarget) {
          results.protected = killTarget;
          killTarget = null; // Protected from death
        }
      }
    }

    // Record kill (caller applies deaths in transitionToDay — single source of truth, no double-mutation)
    if (killTarget) {
      const target = players.find(p => p.id === killTarget);
      if (target && target.isAlive) {
        results.deaths.push(killTarget);
      }
    }

    // Process Detective check (use first detective action)
    if (nightActions.detective && Array.isArray(nightActions.detective) && nightActions.detective.length > 0) {
      const detectiveAction = nightActions.detective[0];
      if (detectiveAction && detectiveAction.targetId) {
        const checkedPlayer = players.find(p => p.id === detectiveAction.targetId);
        if (checkedPlayer) {
          results.detectiveResult = {
            targetId: checkedPlayer.id,
            targetName: checkedPlayer.name,
            isMafia: checkedPlayer.role === 'mafia'
          };
        }
      }
    }

    return results;
  }
}

module.exports = RoleManager;

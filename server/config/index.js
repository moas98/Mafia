/**
 * Load game settings from config/settings.json.
 * All timing values are in seconds.
 */
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  timing: {
    nightRoundTime: 60,
    dayRoundTime: 120,
    votingTime: 120
  }
};

let cached = null;

function loadSettings() {
  if (cached) return cached;
  const filePath = path.join(__dirname, 'settings.json');
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const voting = Number(parsed.timing?.votingTime) || Number(parsed.timing?.dayRoundTime) || DEFAULTS.timing.votingTime;
    cached = {
      timing: {
        nightRoundTime: Number(parsed.timing?.nightRoundTime) || DEFAULTS.timing.nightRoundTime,
        dayRoundTime: voting,
        votingTime: voting
      }
    };
    return cached;
  } catch (err) {
    console.warn('Could not load settings.json, using defaults:', err.message);
    cached = { ...DEFAULTS };
    return cached;
  }
}

function getTiming() {
  return loadSettings().timing;
}

module.exports = {
  loadSettings,
  getTiming,
  DEFAULTS
};

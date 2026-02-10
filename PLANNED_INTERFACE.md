# Planned Interface - Mafia Web Application

## Application Interface Overview

### Client-Side Interface

#### 1. Landing/Join Screen
- **Input Field**: Room code entry
- **Input Field**: Player name entry
- **Button**: "Join Game" - connects to room via WebSocket
- **Button**: "Create New Room" - generates unique room code

#### 2. Lobby/Waiting Room
- **Display**: Room code (for sharing)
- **List**: Connected players (with ready status)
- **Button**: "Start Game" (only for room creator)
- **Status**: Waiting for players message

#### 3. Game Interface (Main Screen)

**Header Section:**
- Current phase indicator (Day/Night) with visual transition
- Timer countdown for current phase
- Room code display

**Player Cards Area:**
- Grid of player cards showing:
  - Player name
  - Status (Alive/Dead)
  - Vote count (during voting phase)
  - Role card (only visible to player during Night phase)

**Action Panel:**
- Phase-specific actions:
  - **Night Phase**: Role-specific actions (Detective check, Doctor protect, Mafia kill)
  - **Day Phase**: Discussion chat, voting buttons
- Action buttons dynamically appear based on role and phase

**Chat Section:**
- **Public Chat**: Visible to all players (Day phase)
- **Mafia Chat**: Private chat visible only to Mafia members (Night phase)
- Chat input field with send button

**Moderator Bot Messages:**
- Centered announcement area for game events
- Examples: "The sun rises, and [Player] was found dead"
- "Night falls. The Mafia awakens."

**Win/Loss Screen:**
- Victory/Defeat message
- Winning team display
- "Play Again" button

### Server-Side API (WebSocket Events)

#### Client → Server Events:
- `join-room`: { roomCode, playerName }
- `start-game`: { roomCode }
- `night-action`: { roomCode, playerId, action, target }
- `vote`: { roomCode, playerId, targetId }
- `chat-message`: { roomCode, playerId, message, chatType }
- `ready`: { roomCode, playerId }

#### Server → Client Events:
- `player-joined`: { playerId, playerName, players }
- `role-assigned`: { role, roleImage }
- `game-started`: { players, roles }
- `night-phase`: { phase, timeRemaining }
- `day-phase`: { phase, timeRemaining, deaths }
- `night-action`: { action, result }
- `vote-cast`: { voterId, targetId, votes }
- `chat-message`: { playerId, playerName, message, chatType }
- `game-ended`: { winner, reason }
- `moderator-message`: { message }

### Output Schemas

#### Player Object:
```javascript
{
  id: string,
  name: string,
  role: 'citizen' | 'mafia' | 'detective' | 'doctor',
  isAlive: boolean,
  votes: number
}
```

#### Game State:
```javascript
{
  roomCode: string,
  phase: 'lobby' | 'night' | 'day',
  players: Player[],
  timeRemaining: number,
  votes: { [playerId]: number },
  nightActions: { [role]: { playerId: string, targetId: string } },
  winner: 'mafia' | 'citizens' | null
}
```

### Usage Example

```javascript
// Client joins room
socket.emit('join-room', { roomCode: 'ABC123', playerName: 'Alice' });

// Server responds with role
socket.on('role-assigned', (data) => {
  displayRoleCard(data.role, data.roleImage);
});

// Player performs night action
socket.emit('night-action', {
  roomCode: 'ABC123',
  playerId: 'player1',
  action: 'check',
  target: 'player2'
});

// Player votes during day
socket.emit('vote', {
  roomCode: 'ABC123',
  playerId: 'player1',
  targetId: 'player3'
});
```

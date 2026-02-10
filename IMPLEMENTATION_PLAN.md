# Implementation Plan - Mafia Web Application

## Internal Logic & Architecture

### Directory Structure
```
Mafia/
├── server/
│   ├── index.js              # Main server entry point
│   ├── game/
│   │   ├── GameManager.js    # Manages game rooms and state
│   │   ├── GameState.js      # Game state machine
│   │   ├── RoleManager.js    # Role assignment and actions
│   │   └── WinCondition.js   # Win condition checker
│   ├── socket/
│   │   └── socketHandlers.js # Socket.io event handlers
│   └── utils/
│       └── roomCodeGenerator.js
├── public/
│   ├── index.html            # Main HTML file
│   ├── css/
│   │   └── styles.css        # Material Design styles
│   ├── js/
│   │   ├── app.js            # Main application logic
│   │   ├── game.js           # Game state management
│   │   ├── socket.js         # Socket.io client
│   │   └── ui.js             # UI updates and rendering
│   └── images/
│       ├── citizen.jpg
│       ├── doctor.jpg
│       ├── officer.jpg
│       └── mafia.jpg
├── package.json
└── README.md
```

### Module Breakdown

#### 1. Server Module (`server/index.js`)
- Express server setup
- Socket.io server initialization
- Static file serving
- Port configuration

#### 2. Game Manager (`server/game/GameManager.js`)
- Room creation and management
- Player join/leave handling
- Game instance lifecycle
- Room code generation and validation

#### 3. Game State (`server/game/GameState.js`)
- Phase transitions (Lobby → Night → Day)
- Timer management for phases
- State persistence per room
- Event emission on state changes

#### 4. Role Manager (`server/game/RoleManager.js`)
- Role assignment algorithm
- Night action processing:
  - Detective: Check player alignment
  - Doctor: Protect player from death
  - Mafia: Vote to kill target
  - Citizen: No action
- Action validation and resolution

#### 5. Win Condition (`server/game/WinCondition.js`)
- Check after each elimination:
  - Mafia wins if mafiaCount >= citizenCount
  - Citizens win if mafiaCount === 0
- Game end event triggering

#### 6. Socket Handlers (`server/socket/socketHandlers.js`)
- Connection/disconnection handling
- Room join/leave events
- Game action events (night-action, vote)
- Chat message routing
- Real-time state synchronization

#### 7. Client Application (`public/js/app.js`)
- Application initialization
- Screen navigation (landing → lobby → game)
- Event listener setup
- State management

#### 8. Game Client (`public/js/game.js`)
- Client-side game state
- Phase rendering
- Player card updates
- Action button management

#### 9. Socket Client (`public/js/socket.js`)
- Socket.io client connection
- Event emission
- Event listener registration
- Reconnection handling

#### 10. UI Manager (`public/js/ui.js`)
- DOM manipulation
- Card rendering
- Chat interface
- Moderator message display
- Phase transition animations
- Responsive layout handling

### Data Flow

1. **Player Joins:**
   - Client emits `join-room` → Server validates → Adds to room → Emits `player-joined` → All clients update

2. **Game Start:**
   - Creator emits `start-game` → Server assigns roles → Emits `role-assigned` to each → Transitions to Night phase

3. **Night Phase:**
   - Players perform actions → Server validates → Stores actions → After timer: Resolves actions → Transitions to Day

4. **Day Phase:**
   - Players discuss in chat → Vote on elimination → Server counts votes → Eliminates player → Checks win condition

5. **Game End:**
   - Win condition met → Server emits `game-ended` → Clients display result → Option to restart

### State Machine

```
Lobby → (start-game) → Night → (timer/actions) → Day → (vote) → 
  → (check win) → [Game End] OR → Night (repeat)
```

### Security Considerations
- Validate all actions server-side
- Prevent duplicate votes
- Verify player roles before allowing actions
- Sanitize chat messages
- Room code validation

### Performance Optimizations
- Efficient state updates (only changed data)
- Debounced chat messages
- Optimized re-renders
- Connection pooling for Socket.io

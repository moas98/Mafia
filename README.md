# Mafia Web Application

A full-stack real-time Mafia game built with HTML5, CSS3 (Material Design), JavaScript (ES6+), and WebSockets (Socket.io).

## Features

- **Real-time Multiplayer**: Play with friends using WebSocket connections
- **Room System**: Create or join games with unique 6-character room codes
- **Multiple Roles**: 
  - **Citizen**: Vote during the day phase
  - **Mafia**: Eliminate players at night, private chat
  - **Detective**: Investigate players' alignment at night
  - **Doctor**: Protect players from death at night
- **Game Phases**: 
  - **Night Phase**: Players perform role-specific actions
  - **Day Phase**: Discussion and voting to eliminate suspected Mafia
- **Win Conditions**: 
  - Mafia wins if they equal or outnumber citizens
  - Citizens win if all Mafia are eliminated
- **Roleplay Features**:
  - Private Mafia chat during Night phase
  - Moderator Bot announcements for game events
- **Responsive Design**: Mobile-first design for playing on phones

## Visual Design

- **Color Palette**: 
  - Deep Black (#000000) - Background
  - Stark White (#FFFFFF) - Text and icons
  - Blood Red (#D32F2F) - Accents and borders
- **Material Design**: Clean, modern UI with card-based layouts
- **Smooth Transitions**: Animated phase changes between Day and Night

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

3. Open your browser and navigate to:
```
http://localhost:3000
```

## How to Play

1. **Create or Join a Room**:
   - Enter your name
   - Create a new room or enter a 6-character room code
   - Click "Join Game"

2. **Wait for Players**:
   - Minimum 3 players required to start
   - Room creator can start the game when ready

3. **Night Phase**:
   - **Mafia**: Vote to eliminate a player (private Mafia chat available)
   - **Detective**: Investigate a player to learn their alignment
   - **Doctor**: Protect a player from death
   - **Citizen**: No action (wait for day)

4. **Day Phase**:
   - Discuss with other players in public chat
   - Vote to eliminate a suspected Mafia member
   - Majority vote required to eliminate

5. **Win the Game**:
   - **Mafia**: Eliminate citizens until you equal or outnumber them
   - **Citizens**: Eliminate all Mafia members

## Project Structure

```
Mafia/
├── server/
│   ├── index.js              # Main server entry point
│   ├── game/
│   │   ├── GameManager.js    # Room and game management
│   │   ├── GameState.js      # Game state machine
│   │   ├── RoleManager.js    # Role assignment and actions
│   │   └── WinCondition.js   # Win condition checking
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

## Technologies Used

- **Backend**: Node.js, Express, Socket.io
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Design**: Material Design principles
- **Real-time Communication**: WebSockets via Socket.io

## Development

The application uses a modular architecture:

- **Server-side**: Game logic is handled server-side for security and consistency
- **Client-side**: UI updates and user interactions
- **WebSocket Events**: Real-time synchronization between server and clients

## License

MIT

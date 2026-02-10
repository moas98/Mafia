# Mafia Web Application - User Instructions

## Quick Start Guide

### Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start the Server**
   ```bash
   npm start
   ```
   The server will run on `http://localhost:3000`

3. **Open in Browser**
   - Navigate to `http://localhost:3000`
   - Or share the IP address with other players on your network

### Playing the Game

#### Step 1: Join or Create a Room

**Option A: Create a New Room**
1. Enter your name in the "Enter Your Name" field
2. Click "Create New Room"
3. A 6-character room code will be generated
4. Share this code with other players

**Option B: Join Existing Room**
1. Enter your name
2. Enter the 6-character room code
3. Click "Join Game"

#### Step 2: Wait in Lobby

- Wait for other players to join
- Minimum 3 players required
- Room creator will see "Start Game" button
- Other players will see "Waiting for players to join..."

#### Step 3: Game Starts

- Roles are randomly assigned
- Your role card will appear - **keep it secret!**
- Close the role card modal to continue

#### Step 4: Night Phase

**If you are Mafia:**
- Use the "Mafia Chat" tab to coordinate with other Mafia
- Select a player to eliminate
- Vote with other Mafia members

**If you are Detective:**
- Select a player to investigate
- You'll receive a result: "is Mafia" or "is not Mafia"

**If you are Doctor:**
- Select a player to protect from death
- You can protect yourself

**If you are Citizen:**
- No action available
- Wait for day phase

#### Step 5: Day Phase

1. **Read Moderator Message**
   - See who was killed (if anyone)
   - See who was protected (if applicable)

2. **Discuss in Public Chat**
   - Share information
   - Discuss suspicions
   - Coordinate with other Citizens

3. **Vote to Eliminate**
   - Click on a player card or use the vote buttons
   - Select who you think is Mafia
   - Majority vote is required

#### Step 6: Repeat or Win

- Game alternates between Night and Day
- Continue until win condition is met
- Winner is announced on end screen

## Interface Guide

### Landing Screen
- **Room Code Input**: Enter 6-character code to join
- **Player Name Input**: Enter your display name
- **Join Game Button**: Join existing room
- **Create New Room Button**: Generate new room code

### Lobby Screen
- **Room Code Display**: Shows your room code (click copy icon to copy)
- **Players List**: Shows all connected players
- **Start Game Button**: Only visible to room creator (when 3+ players)

### Game Screen

**Header:**
- Room code (top left)
- Phase indicator (NIGHT/DAY) with timer
- Round number (top right)

**Moderator Messages:**
- Game event announcements
- Death notifications
- Protection notifications

**Player Cards:**
- Shows all players
- Displays name, status (Alive/Dead)
- Vote count during day phase
- Your role icon (only visible to you)

**Action Panel:**
- Night actions (Detective, Doctor, Mafia)
- Day voting buttons
- Only shows actions available to your role

**Chat Section:**
- **Public Chat Tab**: Available during Day phase
- **Mafia Chat Tab**: Only visible to Mafia during Night phase
- Type message and press Enter or click Send

### End Screen
- Victory/Defeat message
- Your role revealed
- "Play Again" button to return to landing

## Controls

### Keyboard Shortcuts
- **Enter**: Submit form (join room, send chat)
- **Escape**: Close modals (if implemented)

### Mouse/Touch
- **Click**: Select players, buttons, chat tabs
- **Scroll**: Chat messages, player list

## Tips for Hosting

1. **Share Your IP**: 
   - Find your local IP address
   - Share with players: `http://YOUR_IP:3000`
   - Or use a service like ngrok for internet access

2. **Room Management**:
   - As room creator, you control when game starts
   - Wait for all players before starting
   - Minimum 3 players required

3. **Game Flow**:
   - Phases are timed automatically
   - Server handles all game logic
   - No manual moderation needed

## Troubleshooting

### Can't Connect to Server
- Check if server is running
- Verify port 3000 is not blocked
- Check firewall settings

### Can't Join Room
- Verify room code is correct (case-insensitive)
- Check if game has already started
- Try creating a new room

### Actions Not Working
- Make sure you're in the correct phase
- Check if you're still alive
- Verify your role has that action

### Chat Not Working
- Public chat only works during Day phase
- Mafia chat only works during Night phase (for Mafia only)
- Check your internet connection

### Game Stuck
- Refresh the page (you'll need to rejoin)
- Check server console for errors
- Restart server if needed

## Advanced Features

### Mobile Play
- Fully responsive design
- Works on phones and tablets
- Touch-friendly interface
- Can use phone as role card

### Multiple Devices
- Players can use multiple devices
- Each device needs to join separately
- Useful for showing role cards

### Room Codes
- 6-character alphanumeric codes
- Case-insensitive
- Automatically generated
- Can be shared via any method

## Support

For issues or questions:
- **Email**: www.mmmmm1998@gmail.com
- **Instagram**: @moar98

Created by **Mohammed Al-Saigh**

# Quick Start Guide - Mafia Web Application

## Step-by-Step Instructions

### Prerequisites
- **Node.js** installed (version 14 or higher)
- **npm** (comes with Node.js)

### Installation & Running

#### Step 1: Install Dependencies
Open a terminal in the project directory and run:
```bash
npm install
```

This will install:
- Express (web server)
- Socket.io (WebSocket library)
- Nodemon (for development, optional)

#### Step 2: Start the Server

**Option A: Production Mode**
```bash
npm start
```

**Option B: Development Mode (with auto-reload)**
```bash
npm run dev
```

#### Step 3: Open in Browser
Once the server starts, you'll see:
```
Mafia Web Application running on http://localhost:3000
```

Open your web browser and navigate to:
```
http://localhost:3000
```

### Playing the Game

1. **Create or Join a Room**
   - Enter your name
   - Click "Create Room" to create a new game
   - OR click "Join Room" and enter a room code

2. **Wait for Players**
   - Minimum 3 players needed
   - Room creator can start the game

3. **Play!**
   - Follow the on-screen instructions
   - Perform night actions based on your role
   - Vote during day phase

### Troubleshooting

**Port Already in Use?**
If port 3000 is already in use, you can change it:
1. Edit `server/index.js`
2. Change `const PORT = process.env.PORT || 3000;` to a different port (e.g., 3001)
3. Restart the server

**Dependencies Not Installing?**
- Make sure Node.js is installed: `node --version`
- Try deleting `node_modules` folder and `package-lock.json`, then run `npm install` again

**Can't Connect?**
- Make sure the server is running (check terminal for "running on http://localhost:3000")
- Check firewall settings
- Try `http://127.0.0.1:3000` instead

### For Multiplayer (Other Devices)

**On Same Network:**
1. Find your computer's local IP address:
   - Windows: `ipconfig` (look for IPv4 Address)
   - Mac/Linux: `ifconfig` or `ip addr`
2. Other players should use: `http://YOUR_IP:3000`
   - Example: `http://192.168.1.100:3000`

**Over Internet:**
- Use a service like ngrok: `ngrok http 3000`
- Share the ngrok URL with players

### Commands Summary

```bash
# Install dependencies (first time only)
npm install

# Start server
npm start

# Start with auto-reload (development)
npm run dev
```

Enjoy playing Mafia! 🎭

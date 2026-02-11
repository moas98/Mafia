/**
 * WebSocket event handlers using ws library
 */
const GameManager = require('../game/GameManager');
const RoleManager = require('../game/RoleManager');
const WinCondition = require('../game/WinCondition');
const { v4: uuidv4 } = require('uuid');

/**
 * Normalize any ws message payload to a UTF-8 string.
 * Handles: string, Buffer, ArrayBuffer, Buffer[], TypedArray.
 */
function messageToRawString(message) {
  if (typeof message === 'string') return message;
  if (Buffer.isBuffer(message)) return message.toString('utf8');
  if (Array.isArray(message)) {
    const buf = Buffer.concat(message.map(chunk => (Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))));
    return buf.toString('utf8');
  }
  if (message instanceof ArrayBuffer || ArrayBuffer.isView(message)) {
    return Buffer.from(message).toString('utf8');
  }
  if (message && typeof message.toString === 'function') return message.toString('utf8');
  return String(message);
}

/**
 * Parse incoming message. Try in order:
 * 1. "event@@@json" (delimiter @@@)
 * 2. "event\tjson" (tab)
 * 3. "event\njson" (newline)
 * 4. Legacy: single JSON { event, data }
 */
function parseClientMessage(raw) {
  let s = raw.trim();
  if (s.length > 0 && s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
  if (!s) return { event: null, data: null };

  const delimiters = ['@@@', '\t', '\n'];
  for (const sep of delimiters) {
    const idx = s.indexOf(sep);
    if (idx >= 0) {
      const event = s.slice(0, idx).trim();
      const dataStr = s.slice(idx + sep.length).trim();
      if (!event) continue;
      let data = {};
      try {
        data = dataStr ? JSON.parse(dataStr) : {};
      } catch (e) {
        try {
          data = dataStr ? JSON.parse(dataStr.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')) : {};
        } catch (e2) {
          continue;
        }
      }
      return { event, data };
    }
  }

  // Legacy: single JSON { event, data }
  let parsed = null;
  try {
    parsed = JSON.parse(s);
  } catch (e1) {
    const cleaned = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
    try {
      parsed = JSON.parse(cleaned);
    } catch (e2) {
      const firstBrace = s.indexOf('{');
      if (firstBrace !== -1) {
        let depth = 0;
        for (let i = firstBrace; i < s.length; i++) {
          const ch = s[i];
          if (ch === '{') depth++;
          else if (ch === '}') { depth--; if (depth === 0) { try { parsed = JSON.parse(s.slice(firstBrace, i + 1)); } catch (e3) {} break; } }
        }
      }
    }
  }
  if (!parsed || typeof parsed.event !== 'string') return { event: null, data: null };
  return { event: parsed.event, data: parsed.data !== undefined ? parsed.data : {} };
}

class SocketHandlers {
  constructor(wss) {
    this.wss = wss;
    this.gameManager = new GameManager();
    this.phaseTimers = new Map(); // roomCode -> timer
    this.onlinePlayers = new Map(); // socket -> socketId
    this.socketRooms = new Map(); // socketId -> Set of roomCodes
    this.roomSockets = new Map(); // roomCode -> Set of sockets
  }

  /**
   * Setup WebSocket connection handlers
   */
  setupHandlers() {
    this.wss.on('connection', (ws, req) => {
      // Generate unique socket ID
      const socketId = uuidv4();
      ws.socketId = socketId;
      ws.isAlive = true;
      
      console.log(`✅ Player connected: ${socketId}`);
      
      // Track online player
      this.onlinePlayers.set(ws, socketId);
      
      // Get accurate count
      const onlineCount = this.wss.clients.size;
      
      // Broadcast updated count to all clients
      this.broadcastOnlineCount();
      
      // Send connection confirmation with online count
      this.send(ws, 'connected', {
        message: 'Connected to Mafia server',
        socketId: socketId,
        onlineCount: onlineCount
      });

      // Handle pong for keepalive
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // Handle incoming messages: tab-separated "event\t{...}" or legacy JSON
      ws.on('message', (message) => {
        try {
          const raw = messageToRawString(message);
          const { event, data: eventData } = parseClientMessage(raw);
          if (!event) {
            if (!raw || !raw.trim()) {
              this.send(ws, 'error', { message: 'Invalid message format (empty)' });
            } else {
              const codes = Array.from(raw.slice(0, 40)).map((c, i) => raw.charCodeAt(i)).join(',');
              console.error(`❌ [${socketId}] Bad payload. len=${raw.length} first40codes=[${codes}] raw="${raw.slice(0, 80)}"`);
              this.send(ws, 'error', { message: 'Invalid message format' });
            }
            return;
          }
          console.log(`📥 [${socketId}] Received:`, event, eventData);
          this.handleMessage(ws, socketId, { event, data: eventData || {} });
        } catch (err) {
          console.error(`❌ [${socketId}] Message handler error:`, err.message);
          try {
            this.send(ws, 'error', { message: 'Invalid message format' });
          } catch (e) { /* ignore */ }
        }
      });

      // Handle disconnect (wrap so handler errors don't crash process)
      ws.on('close', () => {
        try {
          this.handleDisconnect(ws, socketId);
        } catch (err) {
          console.error(`❌ [${socketId}] Disconnect handler error:`, err.message);
        }
      });

      ws.on('error', (error) => {
        console.error(`❌ [${socketId}] WebSocket error:`, error);
      });
    });

    // Keepalive ping every 30 seconds
    setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (!ws.isAlive) {
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);
  }

  /**
   * Handle incoming message
   */
  handleMessage(ws, socketId, data) {
    const { event, data: eventData } = data;

    switch (event) {
      case 'create-room':
        this.handleCreateRoom(ws, socketId, eventData);
        break;
      case 'join-room':
        this.handleJoinRoom(ws, socketId, eventData);
        break;
      case 'start-game':
        this.handleStartGame(ws, socketId, eventData);
        break;
      case 'night-action':
        this.handleNightAction(ws, socketId, eventData);
        break;
      case 'vote':
        this.handleVote(ws, socketId, eventData);
        break;
      case 'chat-message':
        this.handleChatMessage(ws, socketId, eventData);
        break;
      case 'get-rooms':
        this.handleGetRooms(ws, socketId);
        break;
      case 'check-room':
        this.handleCheckRoom(ws, socketId, eventData);
        break;
      case 'request-room-state':
        this.handleRequestRoomState(ws, socketId, eventData);
        break;
      default:
        console.warn(`⚠️ [${socketId}] Unknown event: ${event}`);
    }
  }

  /**
   * Send message to WebSocket
   */
  send(ws, event, data) {
    if (ws.readyState === 1) { // WebSocket.OPEN
      try {
        ws.send(JSON.stringify({ event, data }));
        console.log(`📤 [${ws.socketId || 'unknown'}] Emitting: ${event}`);
      } catch (error) {
        console.error(`❌ Error sending message to ${ws.socketId}:`, error);
      }
    }
  }

  /**
   * Broadcast to all clients
   */
  broadcast(event, data) {
    this.wss.clients.forEach((ws) => {
      this.send(ws, event, data);
    });
  }

  /**
   * Broadcast to room
   */
  broadcastToRoom(roomCode, event, data) {
    const socketsInRoom = this.roomSockets.get(roomCode);
    if (socketsInRoom) {
      socketsInRoom.forEach((ws) => {
        if (ws.readyState === 1) {
          this.send(ws, event, data);
        }
      });
    }
  }

  /**
   * Add socket to room
   */
  addSocketToRoom(ws, socketId, roomCode) {
    if (!this.socketRooms.has(socketId)) {
      this.socketRooms.set(socketId, new Set());
    }
    this.socketRooms.get(socketId).add(roomCode);

    if (!this.roomSockets.has(roomCode)) {
      this.roomSockets.set(roomCode, new Set());
    }
    this.roomSockets.get(roomCode).add(ws);
  }

  /**
   * Remove socket from room
   */
  removeSocketFromRoom(ws, socketId, roomCode) {
    const socketRooms = this.socketRooms.get(socketId);
    if (socketRooms) {
      socketRooms.delete(roomCode);
      if (socketRooms.size === 0) {
        this.socketRooms.delete(socketId);
      }
    }

    const roomSockets = this.roomSockets.get(roomCode);
    if (roomSockets) {
      roomSockets.delete(ws);
      if (roomSockets.size === 0) {
        this.roomSockets.delete(roomCode);
      }
    }
  }

  /**
   * Handle room creation
   */
  handleCreateRoom(ws, socketId, data) {
    console.log(`📥 [${socketId}] Received create-room:`, data);
    const { roomCode, playerName } = data;
    
    if (!roomCode || !playerName) {
      console.error(`❌ [${socketId}] Invalid create-room data:`, data);
      this.send(ws, 'error', { message: 'Room code and player name required' });
      return;
    }

    // Normalize room code
    const normalizedCode = roomCode.trim().toUpperCase();
    
    // Check if room already exists
    if (this.gameManager.roomExists(normalizedCode)) {
      console.error(`❌ [${socketId}] Room ${normalizedCode} already exists`);
      this.send(ws, 'error', { message: 'Room code already exists. Please try a different code.' });
      return;
    }

    console.log(`🆕 [${socketId}] Creating room ${normalizedCode} as ${playerName}`);
    
    // Create the room
    const gameState = this.gameManager.createRoom(normalizedCode);
    
    // Now join the player to the room they just created
    const joinedGameState = this.gameManager.joinRoom(socketId, normalizedCode, playerName);
    
    if (!joinedGameState) {
      console.error(`❌ [${socketId}] Failed to join created room ${normalizedCode}`);
      this.send(ws, 'error', { message: 'Failed to create room' });
      return;
    }

    console.log(`✅ [${socketId}] Successfully created and joined room ${normalizedCode}`);
    console.log(`👥 Room ${normalizedCode} now has ${joinedGameState.players.length} players:`, 
      joinedGameState.players.map(p => p.name));

    try {
      // Add socket to room
      this.addSocketToRoom(ws, socketId, normalizedCode);
      console.log(`✅ [${socketId}] Socket added to room ${normalizedCode}`);
      
      // Player is always creator when creating room
      const isCreator = true;
      
      // Prepare players list
      const playersList = joinedGameState.players.map(p => ({
        id: p.id,
        name: p.name,
        isAlive: p.isAlive !== undefined ? p.isAlive : true,
        disconnected: p.disconnected === true
      }));
      
      console.log(`📤 [${socketId}] Sending room-joined with ${playersList.length} players:`, playersList);
      
      // Notify the creating player
      const roomJoinedData = {
        isCreator: isCreator,
        players: playersList,
        roomCode: normalizedCode
      };
      this.send(ws, 'room-joined', roomJoinedData);
      console.log(`✅ [${socketId}] room-joined event sent`);

      // Broadcast to all players in room (should only be the creator at this point)
      const playerJoinedData = {
        playerId: socketId,
        playerName: playerName,
        players: playersList
      };
      
      console.log(`📤 Broadcasting player-joined to room ${normalizedCode} with ${playersList.length} players`);
      this.broadcastToRoom(normalizedCode, 'player-joined', playerJoinedData);
      
      console.log(`✅ player-joined event broadcasted to room ${normalizedCode}`);
      
      // Broadcast updated room player count
      this.broadcastRoomPlayerCount(normalizedCode);
    } catch (error) {
      console.error(`❌ Error in handleCreateRoom:`, error);
      this.send(ws, 'error', { message: 'Failed to create room: ' + error.message });
    }
  }

  /**
   * Handle player joining a room
   */
  handleJoinRoom(ws, socketId, data) {
    console.log(`📥 [${socketId}] Received join-room:`, data);
    const { roomCode, playerName } = data;
    
    if (!roomCode || !playerName) {
      console.error(`❌ [${socketId}] Invalid join-room data:`, data);
      this.send(ws, 'error', { message: 'Room code and player name required' });
      return;
    }

    // Normalize room code for checking
    const normalizedCode = roomCode.trim().toUpperCase();
    console.log(`🔍 [${socketId}] Checking if room ${normalizedCode} exists...`);
    
    // CRITICAL: Check if room exists FIRST before any join attempt
    const availableRooms = Array.from(this.gameManager.rooms.keys());
    console.log(`🔍 [${socketId}] Available rooms:`, availableRooms);
    
    const matchingRoom = availableRooms.find(r => r.toUpperCase() === normalizedCode);
    
    if (!matchingRoom) {
      console.error(`❌ [${socketId}] Room ${normalizedCode} does NOT exist`);
      console.error(`❌ [${socketId}] Available rooms:`, availableRooms);
      this.send(ws, 'error', { message: 'No room with this code' });
      return;
    }
    
    // Room exists - use the actual room code (with correct case)
    const actualRoomCode = matchingRoom;
    console.log(`✅ [${socketId}] Room found: ${actualRoomCode} (searched for: ${normalizedCode})`);
    
    const existingRoom = this.gameManager.getRoom(actualRoomCode);
    // If game already started, only allow rejoin (disconnected player with same name)
    if (existingRoom && existingRoom.phase !== 'lobby') {
      const disconnected = existingRoom.getDisconnectedPlayerByName(playerName);
      if (!disconnected) {
        console.error(`❌ [${socketId}] Room ${actualRoomCode} is in ${existingRoom.phase} - cannot join (not a rejoin)`);
        this.send(ws, 'error', { message: 'Could not join room. Game may have already started.' });
        return;
      }
    }

    console.log(`🔄 [${socketId}] Joining room ${actualRoomCode} as ${playerName}`);
    const gameState = this.gameManager.joinRoom(socketId, actualRoomCode, playerName);
    
    if (!gameState) {
      console.error(`❌ [${socketId}] Failed to join room ${actualRoomCode}`);
      this.send(ws, 'error', { message: 'No room with this code' });
      return;
    }

    console.log(`✅ [${socketId}] Successfully joined room ${actualRoomCode}`);
    console.log(`👥 Room ${actualRoomCode} now has ${gameState.players.length} players:`, 
      gameState.players.map(p => p.name));

    try {
      // Add socket to room
      this.addSocketToRoom(ws, socketId, actualRoomCode);
      console.log(`✅ [${socketId}] Socket added to room ${actualRoomCode}`);
      
      // Send role if game has started
      if (gameState.phase !== 'lobby') {
        const playerState = gameState.getPlayerState(socketId);
        this.send(ws, 'role-assigned', playerState);
      }

      // Check if player is creator
      const isCreator = this.gameManager.isRoomCreator(socketId, actualRoomCode);
      
      // Prepare players list
      const playersList = gameState.players.map(p => ({
        id: p.id,
        name: p.name,
        isAlive: p.isAlive !== undefined ? p.isAlive : true,
        disconnected: p.disconnected === true
      }));

      console.log(`📤 [${socketId}] Sending room-joined with ${playersList.length} players:`, playersList);

      // Notify the joining player
      const roomJoinedData = {
        isCreator: isCreator,
        players: playersList,
        roomCode: actualRoomCode
      };
      this.send(ws, 'room-joined', roomJoinedData);
      console.log(`✅ [${socketId}] room-joined event sent`);

      // Broadcast to all players in room
      const playerJoinedData = {
        playerId: socketId,
        playerName: playerName,
        players: playersList
      };
      
      console.log(`📤 Broadcasting player-joined to room ${actualRoomCode} with ${playersList.length} players`);
      this.broadcastToRoom(actualRoomCode, 'player-joined', playerJoinedData);
      
      console.log(`✅ player-joined event broadcasted to room ${actualRoomCode}`);
      
      // Broadcast updated room player count
      this.broadcastRoomPlayerCount(actualRoomCode);
    } catch (error) {
      console.error(`❌ Error in handleJoinRoom:`, error);
      this.send(ws, 'error', { message: 'Failed to join room: ' + error.message });
    }
  }

  /**
   * Handle game start
   */
  handleStartGame(ws, socketId, data) {
    const { roomCode } = data;
    const gameState = this.gameManager.getRoom(roomCode);
    
    if (!gameState) {
      this.send(ws, 'error', { message: 'Room not found' });
      return;
    }

    if (!this.gameManager.isRoomCreator(socketId, roomCode)) {
      this.send(ws, 'error', { message: 'Only room creator can start the game' });
      return;
    }

    if (!gameState.startGame()) {
      this.send(ws, 'error', { message: 'Could not start game (need at least 3 players or already started)' });
      return;
    }

    // Send role to each player (GameState.assignRoles already ran inside startGame())
    gameState.players.forEach(player => {
      const playerState = gameState.getPlayerState(player.id);
      const wsForPlayer = this.findSocketById(player.id);
      if (wsForPlayer && playerState) {
        this.send(wsForPlayer, 'role-assigned', playerState);
      }
    });

    this.broadcastToRoom(roomCode, 'game-started', {
      players: gameState.players.map(p => ({
        id: p.id,
        name: p.name,
        role: p.role,
        isAlive: p.isAlive,
        disconnected: p.disconnected === true
      }))
    });

    this.broadcastModeratorMessage(roomCode, 'Night falls. The Mafia awakens...');
    this.startPhaseTimer(roomCode);
  }

  /**
   * Handle night action
   */
  handleNightAction(ws, socketId, data) {
    const { roomCode, action, target } = data;
    const gameState = this.gameManager.getRoom(roomCode);
    
    if (!gameState) return;
    
    const player = gameState.players.find(p => p.id === socketId);
    if (!player) return;

    const success = gameState.recordNightAction(socketId, player.role, target);
    
    if (success) {
      // Send confirmation
      this.send(ws, 'night-action-confirmed', { action, target });
      
      // For Detective, send result immediately
      if (player.role === 'detective' && target) {
        const targetPlayer = gameState.players.find(p => p.id === target);
        if (targetPlayer) {
          this.send(ws, 'detective-result', {
            targetName: targetPlayer.name,
            isMafia: targetPlayer.role === 'mafia'
          });
        }
      }
    }
  }

  /**
   * Handle day vote
   */
  handleVote(ws, socketId, data) {
    const { roomCode, targetId } = data;
    const gameState = this.gameManager.getRoom(roomCode);
    
    if (!gameState) return;

    const success = gameState.recordVote(socketId, targetId);
    
    if (success) {
      // Broadcast vote update
      this.broadcastToRoom(roomCode, 'vote-cast', {
        voterId: socketId,
        targetId: targetId,
        votes: gameState.players.map(p => ({
          id: p.id,
          votes: p.votes
        }))
      });
    }
  }

  /**
   * Handle chat message
   */
  handleChatMessage(ws, socketId, data) {
    const { roomCode, message, chatType } = data;
    const gameState = this.gameManager.getRoom(roomCode);
    
    if (!gameState) return;

    const player = gameState.players.find(p => p.id === socketId);
    if (!player) return;

    // Private mafia chat during night
    if (chatType === 'mafia' && gameState.phase === 'night' && player.role === 'mafia') {
      const mafiaPlayers = gameState.players.filter(p => p.role === 'mafia' && p.isAlive);
      mafiaPlayers.forEach(mafiaPlayer => {
        const wsForPlayer = this.findSocketById(mafiaPlayer.id);
        if (wsForPlayer) {
          this.send(wsForPlayer, 'chat-message', {
            playerName: player.name,
            message: message,
            chatType: 'mafia'
          });
        }
      });
    } else {
      // Public chat
      this.broadcastToRoom(roomCode, 'chat-message', {
        playerName: player.name,
        message: message,
        chatType: 'public'
      });
    }
  }

  /**
   * Handle get rooms
   */
  handleGetRooms(ws, socketId) {
    const rooms = this.gameManager.getAvailableRooms();
    this.send(ws, 'rooms-list', { rooms });
  }

  /**
   * Handle check room status
   */
  handleCheckRoom(ws, socketId, data) {
    try {
      let { roomCode } = data || {};
      
      if (!roomCode) {
        console.log(`❌ [${socketId}] check-room: No room code provided`);
        this.send(ws, 'room-status', { 
          exists: false,
          message: 'Room code is required',
          roomCode: null
        });
        return;
      }

      // Normalize room code (uppercase, trim)
      roomCode = roomCode.trim().toUpperCase();
      
      console.log(`🔍 [${socketId}] Checking room: ${roomCode}`);
      const availableRooms = Array.from(this.gameManager.rooms.keys());
      console.log(`🔍 [${socketId}] Available rooms:`, availableRooms);
      
      // Try exact match first
      let roomInfo = this.gameManager.getRoomInfo(roomCode);
      
      // If not found, try case-insensitive search
      if (!roomInfo) {
        const matchingRoom = availableRooms.find(r => r.toUpperCase() === roomCode);
        
        if (matchingRoom) {
          console.log(`🔍 [${socketId}] Found room with different case: ${matchingRoom} -> ${roomCode}`);
          roomInfo = this.gameManager.getRoomInfo(matchingRoom);
          if (roomInfo) {
            roomInfo.roomCode = matchingRoom;
          }
        }
      }
      
      if (roomInfo) {
        console.log(`✅ [${socketId}] Room ${roomCode} found:`, {
          phase: roomInfo.phase,
          playerCount: roomInfo.playerCount,
          canJoin: roomInfo.canJoin
        });
        this.send(ws, 'room-status', {
          ...roomInfo,
          exists: true
        });
        console.log(`📤 [${socketId}] room-status event sent successfully`);
      } else {
        console.log(`❌ [${socketId}] Room ${roomCode} not found`);
        this.send(ws, 'room-status', { 
          roomCode: roomCode,
          exists: false,
          message: 'Room does not exist',
          phase: null,
          playerCount: 0,
          canJoin: false
        });
        console.log(`📤 [${socketId}] room-status (not found) event sent successfully`);
      }
    } catch (error) {
      console.error(`❌ [${socketId}] Error in handleCheckRoom:`, error);
      this.send(ws, 'room-status', {
        exists: false,
        message: 'Error checking room: ' + error.message,
        roomCode: data?.roomCode || null
      });
    }
  }

  /**
   * Handle request for current room state
   */
  handleRequestRoomState(ws, socketId, data) {
    console.log(`📥 [${socketId}] ===== HANDLING REQUEST ROOM STATE =====`);
    const { roomCode } = data || {};
    
    if (!roomCode) {
      console.error(`❌ [${socketId}] No room code provided for room state request`);
      this.send(ws, 'room-state', { error: 'Room code is required' });
      return;
    }

    const normalizedCode = roomCode.trim().toUpperCase();
    const availableRooms = Array.from(this.gameManager.rooms.keys());
    const matchingRoom = availableRooms.find(r => r.toUpperCase() === normalizedCode);
    const targetRoom = matchingRoom || normalizedCode;

    console.log(`🔍 [${socketId}] Requesting state for room: ${targetRoom}`);
    
    const gameState = this.gameManager.getRoom(targetRoom);
    
    if (!gameState) {
      console.error(`❌ [${socketId}] Room ${targetRoom} not found for state request`);
      this.send(ws, 'room-state', { error: 'Room not found', roomCode: targetRoom });
      return;
    }

    const isCreator = this.gameManager.isRoomCreator(socketId, targetRoom);
    const playersList = gameState.players.map(p => ({
      id: p.id,
      name: p.name,
      isAlive: p.isAlive !== undefined ? p.isAlive : true,
      disconnected: p.disconnected === true
    }));

    console.log(`📤 [${socketId}] Preparing room-state response with ${playersList.length} players`);
    
    const roomStateData = {
      roomCode: targetRoom,
      isCreator: isCreator,
      players: playersList,
      phase: gameState.phase,
      timeRemaining: gameState.timeRemaining != null ? gameState.timeRemaining : 0
    };
    
    console.log(`📤 [${socketId}] Emitting room-state event with data:`, JSON.stringify(roomStateData, null, 2));
    this.send(ws, 'room-state', roomStateData);
    console.log(`✅ [${socketId}] room-state event sent successfully`);
  }

  /**
   * Broadcast online player count to all clients
   */
  broadcastOnlineCount() {
    const onlineCount = this.wss.clients.size;
    console.log(`📊 Broadcasting online count: ${onlineCount}`);
    this.broadcast('online-count-update', { 
      onlineCount: onlineCount,
      timestamp: Date.now()
    });
  }

  /**
   * Broadcast room player count to all players in a room
   */
  broadcastRoomPlayerCount(roomCode) {
    const socketsInRoom = this.roomSockets.get(roomCode);
    const playerCount = socketsInRoom ? socketsInRoom.size : 0;
    console.log(`📊 Broadcasting room ${roomCode} player count: ${playerCount}`);
    this.broadcastToRoom(roomCode, 'room-player-count-update', {
      roomCode: roomCode,
      playerCount: playerCount,
      timestamp: Date.now()
    });
  }

  /**
   * Handle disconnect
   */
  handleDisconnect(ws, socketId) {
    const roomCode = this.gameManager.getPlayerRoom(socketId);
    console.log(`Player disconnected: ${socketId}`);
    
    // Remove from game room first
    this.gameManager.leaveRoom(socketId);
    
    // Remove from online tracking
    this.onlinePlayers.delete(ws);
    
    if (roomCode) {
      // Remove from room tracking
      this.removeSocketFromRoom(ws, socketId, roomCode);
      // Broadcast updated room count
      this.broadcastRoomPlayerCount(roomCode);
    }
    
    // Broadcast updated online count
    setTimeout(() => {
      this.broadcastOnlineCount();
    }, 100);
  }

  /**
   * Find WebSocket by socket ID
   */
  findSocketById(socketId) {
    for (const [ws, id] of this.onlinePlayers.entries()) {
      if (id === socketId) {
        return ws;
      }
    }
    return null;
  }

  /**
   * Broadcast moderator message
   */
  broadcastModeratorMessage(roomCode, message) {
    this.broadcastToRoom(roomCode, 'moderator-message', {
      message: message,
      timestamp: Date.now()
    });
  }

  /**
   * Start phase timer
   */
  startPhaseTimer(roomCode) {
    // Clear existing timer
    if (this.phaseTimers.has(roomCode)) {
      clearInterval(this.phaseTimers.get(roomCode));
    }

    const gameState = this.gameManager.getRoom(roomCode);
    if (!gameState) return;

    let timeRemaining = gameState.phase === 'night' ? 60 : 120; // 60s night, 120s day

    const timer = setInterval(() => {
      timeRemaining--;
      
      this.broadcastToRoom(roomCode, 'phase-update', {
        phase: gameState.phase,
        timeRemaining: timeRemaining
      });

      if (timeRemaining <= 0) {
        clearInterval(timer);
        this.phaseTimers.delete(roomCode);
        
        if (gameState.phase === 'night') {
          this.processNightPhase(roomCode);
        } else {
          this.processDayPhase(roomCode);
        }
      }
    }, 1000);
    
    this.phaseTimers.set(roomCode, timer);
  }

  /**
   * Process night phase results
   */
  processNightPhase(roomCode) {
    const gameState = this.gameManager.getRoom(roomCode);
    if (!gameState) return;

    const results = RoleManager.processNightActions(gameState.nightActions, gameState.players);
    results.deaths.forEach(playerId => {
      const p = gameState.players.find(pl => pl.id === playerId);
      if (p) p.justKilled = true;
    });

    const killed = gameState.players.filter(p => !p.isAlive && p.justKilled);
    gameState.players.forEach(p => p.justKilled = false);

    if (killed.length > 0) {
      killed.forEach(player => {
        this.broadcastModeratorMessage(
          roomCode,
          `The sun rises. ${player.name} was found dead.`
        );
      });
    } else {
      this.broadcastModeratorMessage(roomCode, 'The sun rises. No one was killed last night.');
    }

    // Check win condition (expects players array)
    const winResult = WinCondition.checkWinCondition(gameState.players);
    if (winResult) {
      this.broadcastToRoom(roomCode, 'game-ended', { ...winResult, gameEnded: true });
      return;
    }

    // Start day phase
    gameState.transitionToDay(results);
    this.broadcastToRoom(roomCode, 'day-phase', {
      players: gameState.players.filter(p => p.isAlive).map(p => ({
        id: p.id,
        name: p.name
      }))
    });
    this.startPhaseTimer(roomCode);
  }

  /**
   * Process day phase results
   */
  processDayPhase(roomCode) {
    const gameState = this.gameManager.getRoom(roomCode);
    if (!gameState) return;

    const votedOut = gameState.processVotes();
    
    if (votedOut) {
      this.broadcastModeratorMessage(
        roomCode,
        `${votedOut.name} was voted out by the town.`
      );
    } else {
      this.broadcastModeratorMessage(roomCode, 'The town could not reach a majority decision.');
    }

    // Check win condition (expects players array)
    const winResult = WinCondition.checkWinCondition(gameState.players);
    if (winResult) {
      this.broadcastToRoom(roomCode, 'game-ended', { ...winResult, gameEnded: true });
      return;
    }

    // Start next night phase
    gameState.transitionToNight();
    this.broadcastModeratorMessage(roomCode, 'Night falls. The Mafia awakens...');
    this.startPhaseTimer(roomCode);
  }
}

module.exports = SocketHandlers;

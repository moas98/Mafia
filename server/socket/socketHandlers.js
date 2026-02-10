/**
 * Socket.io event handlers
 */
const GameManager = require('../game/GameManager');
const RoleManager = require('../game/RoleManager');
const WinCondition = require('../game/WinCondition');

class SocketHandlers {
  constructor(io) {
    this.io = io;
    this.gameManager = new GameManager();
    this.phaseTimers = new Map(); // roomCode -> timer
  }

  /**
   * Setup socket connection handlers
   */
  setupHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`Player connected: ${socket.id}`);

      // Join room
      socket.on('join-room', (data) => {
        this.handleJoinRoom(socket, data);
      });

      // Start game
      socket.on('start-game', (data) => {
        this.handleStartGame(socket, data);
      });

      // Night action
      socket.on('night-action', (data) => {
        this.handleNightAction(socket, data);
      });

      // Day vote
      socket.on('vote', (data) => {
        this.handleVote(socket, data);
      });

      // Chat message
      socket.on('chat-message', (data) => {
        this.handleChatMessage(socket, data);
      });

      // Disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });

      // Get available rooms
      socket.on('get-rooms', () => {
        this.handleGetRooms(socket);
      });

      // Check room status
      socket.on('check-room', (data) => {
        this.handleCheckRoom(socket, data);
      });
    });
  }

  /**
   * Handle player joining a room
   */
  handleJoinRoom(socket, data) {
    const { roomCode, playerName } = data;
    
    if (!roomCode || !playerName) {
      socket.emit('error', { message: 'Room code and player name required' });
      return;
    }

    const gameState = this.gameManager.joinRoom(socket.id, roomCode, playerName);
    
    if (!gameState) {
      socket.emit('error', { message: 'Could not join room. Game may have already started.' });
      return;
    }

    socket.join(roomCode);
    
    // Send role if game has started
    if (gameState.phase !== 'lobby') {
      const playerState = gameState.getPlayerState(socket.id);
      socket.emit('role-assigned', playerState);
    }

    // Check if player is creator
    const isCreator = this.gameManager.isRoomCreator(socket.id, roomCode);
    
    // Notify the joining player if they're the creator
    socket.emit('room-joined', {
      isCreator: isCreator,
      players: gameState.players.map(p => ({
        id: p.id,
        name: p.name,
        isAlive: p.isAlive
      }))
    });

    // Notify all players in room
    this.io.to(roomCode).emit('player-joined', {
      playerId: socket.id,
      playerName: playerName,
      players: gameState.players.map(p => ({
        id: p.id,
        name: p.name,
        isAlive: p.isAlive
      }))
    });
  }

  /**
   * Handle game start
   */
  handleStartGame(socket, data) {
    const { roomCode } = data;
    const gameState = this.gameManager.getRoom(roomCode);
    
    if (!gameState) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    if (!this.gameManager.isRoomCreator(socket.id, roomCode)) {
      socket.emit('error', { message: 'Only room creator can start the game' });
      return;
    }

    if (gameState.startGame()) {
      // Assign roles to all players
      gameState.players.forEach(player => {
        const playerState = gameState.getPlayerState(player.id);
        this.io.to(player.id).emit('role-assigned', playerState);
      });

      // Notify all players
      this.io.to(roomCode).emit('game-started', {
        players: gameState.players.map(p => ({
          id: p.id,
          name: p.name,
          isAlive: p.isAlive
        }))
      });

      // Start night phase
      this.startPhaseTimer(roomCode);
      this.broadcastModeratorMessage(roomCode, 'Night falls. The Mafia awakens...');
    }
  }

  /**
   * Handle night action
   */
  handleNightAction(socket, data) {
    const { roomCode, action, target } = data;
    const gameState = this.gameManager.getRoom(roomCode);
    
    if (!gameState) return;
    
    const player = gameState.players.find(p => p.id === socket.id);
    if (!player) return;

    const success = gameState.recordNightAction(socket.id, player.role, target);
    
    if (success) {
      // Send confirmation
      socket.emit('night-action-confirmed', { action, target });
      
      // For Detective, send result immediately
      if (player.role === 'detective' && target) {
        const targetPlayer = gameState.players.find(p => p.id === target);
        if (targetPlayer) {
          socket.emit('detective-result', {
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
  handleVote(socket, data) {
    const { roomCode, targetId } = data;
    const gameState = this.gameManager.getRoom(roomCode);
    
    if (!gameState) return;

    const success = gameState.recordVote(socket.id, targetId);
    
    if (success) {
      // Broadcast vote update
      this.io.to(roomCode).emit('vote-cast', {
        voterId: socket.id,
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
  handleChatMessage(socket, data) {
    const { roomCode, message, chatType } = data;
    const gameState = this.gameManager.getRoom(roomCode);
    
    if (!gameState) return;

    const player = gameState.players.find(p => p.id === socket.id);
    if (!player || !player.isAlive) return;

    // Mafia chat only during night phase and only for Mafia
    if (chatType === 'mafia') {
      if (gameState.phase !== 'night' || player.role !== 'mafia') {
        return; // Invalid chat access
      }
      // Send only to Mafia players
      gameState.players.forEach(p => {
        if (p.role === 'mafia' && p.isAlive) {
          this.io.to(p.id).emit('chat-message', {
            playerId: socket.id,
            playerName: player.name,
            message: message,
            chatType: 'mafia'
          });
        }
      });
    } else {
      // Public chat (day phase only)
      if (gameState.phase === 'day') {
        this.io.to(roomCode).emit('chat-message', {
          playerId: socket.id,
          playerName: player.name,
          message: message,
          chatType: 'public'
        });
      }
    }
  }

  /**
   * Handle disconnect
   */
  handleDisconnect(socket) {
    this.gameManager.leaveRoom(socket.id);
    console.log(`Player disconnected: ${socket.id}`);
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

    // Update timer every second
    const timer = setInterval(() => {
      const currentState = this.gameManager.getRoom(roomCode);
      if (!currentState) {
        clearInterval(timer);
        this.phaseTimers.delete(roomCode);
        return;
      }

      currentState.timeRemaining--;
      
      // Broadcast phase update
      this.io.to(roomCode).emit('phase-update', {
        phase: currentState.phase,
        timeRemaining: currentState.timeRemaining
      });

      if (currentState.timeRemaining <= 0) {
        this.handlePhaseEnd(roomCode);
      }
    }, 1000);

    this.phaseTimers.set(roomCode, timer);
  }

  /**
   * Handle phase end
   */
  handlePhaseEnd(roomCode) {
    const gameState = this.gameManager.getRoom(roomCode);
    if (!gameState) return;

    if (gameState.phase === 'night') {
      // Process night actions
      const nightResults = RoleManager.processNightActions(
        gameState.nightActions,
        gameState.players
      );

      // Transition to day
      gameState.transitionToDay(nightResults);

      // Broadcast deaths
      if (nightResults.deaths.length > 0) {
        nightResults.deaths.forEach(playerId => {
          const deadPlayer = gameState.players.find(p => p.id === playerId);
          if (deadPlayer) {
            this.broadcastModeratorMessage(
              roomCode,
              `The sun rises, and ${deadPlayer.name} was found dead.`
            );
          }
        });
      } else if (nightResults.protected) {
        const protectedPlayer = gameState.players.find(p => p.id === nightResults.protected);
        if (protectedPlayer) {
          this.broadcastModeratorMessage(
            roomCode,
            `The sun rises. ${protectedPlayer.name} was protected by the Doctor.`
          );
        }
      } else {
        this.broadcastModeratorMessage(roomCode, 'The sun rises. No one was killed last night.');
      }

      // Check win condition
      const winResult = WinCondition.checkWinCondition(gameState.players);
      if (winResult) {
        gameState.winner = winResult.winner;
        this.io.to(roomCode).emit('game-ended', winResult);
        this.phaseTimers.delete(roomCode);
        return;
      }

      // Start day phase timer
      this.startPhaseTimer(roomCode);
      this.io.to(roomCode).emit('day-phase', {
        phase: 'day',
        timeRemaining: gameState.timeRemaining,
        deaths: nightResults.deaths,
        players: gameState.players.map(p => ({
          id: p.id,
          name: p.name,
          isAlive: p.isAlive,
          votes: p.votes
        }))
      });

    } else if (gameState.phase === 'day') {
      // Process votes
      const eliminated = gameState.getMostVotedPlayer();
      
      if (eliminated) {
        const eliminatedPlayer = gameState.players.find(p => p.id === eliminated);
        if (eliminatedPlayer) {
          eliminatedPlayer.isAlive = false;
          this.broadcastModeratorMessage(
            roomCode,
            `${eliminatedPlayer.name} has been eliminated by the town's vote.`
          );
        }
      } else {
        this.broadcastModeratorMessage(roomCode, 'The town could not reach a majority decision.');
      }

      // Check win condition
      const winResult = WinCondition.checkWinCondition(gameState.players);
      if (winResult) {
        gameState.winner = winResult.winner;
        this.io.to(roomCode).emit('game-ended', winResult);
        this.phaseTimers.delete(roomCode);
        return;
      }

      // Transition to night
      gameState.round++;
      gameState.transitionToNight();
      this.startPhaseTimer(roomCode);
      this.broadcastModeratorMessage(roomCode, 'Night falls. The Mafia awakens...');
      this.io.to(roomCode).emit('night-phase', {
        phase: 'night',
        timeRemaining: gameState.timeRemaining,
        players: gameState.players.map(p => ({
          id: p.id,
          name: p.name,
          isAlive: p.isAlive,
          votes: p.votes
        }))
      });
    }
  }

  /**
   * Broadcast moderator message
   */
  broadcastModeratorMessage(roomCode, message) {
    this.io.to(roomCode).emit('moderator-message', { message });
  }

  /**
   * Handle get available rooms
   */
  handleGetRooms(socket) {
    const rooms = this.gameManager.getAvailableRooms();
    socket.emit('rooms-list', { rooms });
  }

  /**
   * Handle check room status
   */
  handleCheckRoom(socket, data) {
    const { roomCode } = data;
    const roomInfo = this.gameManager.getRoomInfo(roomCode);
    
    if (roomInfo) {
      socket.emit('room-status', roomInfo);
    } else {
      socket.emit('room-status', { 
        roomCode: roomCode,
        exists: false,
        message: 'Room does not exist'
      });
    }
  }
}

module.exports = SocketHandlers;

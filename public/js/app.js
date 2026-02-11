/**
 * Main application initialization and event handling
 */
class App {
    constructor() {
        this.isCreator = false;
        this.initializeEventListeners();
        this.setupSocketListeners();
    }

    /**
     * Initialize DOM event listeners
     */
    initializeEventListeners() {
        // Room tabs
        const createTab = document.getElementById('create-tab');
        const joinTab = document.getElementById('join-tab');
        const createSection = document.getElementById('create-room-section');
        const joinSection = document.getElementById('join-room-section');

        if (createTab) {
            createTab.addEventListener('click', () => this.switchRoomTab('create'));
        }
        if (joinTab) {
            joinTab.addEventListener('click', () => this.switchRoomTab('join'));
        }

        // Landing screen
        const joinBtn = document.getElementById('join-btn');
        const createRoomBtn = document.getElementById('create-room-btn');
        const roomCodeInput = document.getElementById('room-code-input');
        const playerNameInput = document.getElementById('player-name-input');
        const checkRoomBtn = document.getElementById('check-room-btn');
        const refreshRoomsBtn = document.getElementById('refresh-rooms-btn');

        if (joinBtn) {
            joinBtn.addEventListener('click', () => this.handleJoinRoom());
        }

        if (createRoomBtn) {
            createRoomBtn.addEventListener('click', () => this.handleCreateRoom());
        }

        // Check room button
        if (checkRoomBtn) {
            checkRoomBtn.addEventListener('click', () => this.handleCheckRoom());
        }

        // Refresh rooms button
        if (refreshRoomsBtn) {
            refreshRoomsBtn.addEventListener('click', () => this.handleRefreshRooms());
        }

        // Enter key handlers
        [roomCodeInput, playerNameInput].forEach(input => {
            if (input) {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        if (createRoomBtn && createSection.classList.contains('active')) {
                            createRoomBtn.click();
                        } else if (joinBtn && joinSection.classList.contains('active')) {
                            joinBtn.click();
                        }
                    }
                });
            }
        });

        // Auto-uppercase room code
        if (roomCodeInput) {
            roomCodeInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.toUpperCase();
            });
        }

        // Lobby screen
        const startGameBtn = document.getElementById('start-game-btn');
        if (startGameBtn) {
            startGameBtn.addEventListener('click', () => this.handleStartGame());
        }

        const copyRoomCodeBtn = document.getElementById('copy-room-code');
        if (copyRoomCodeBtn) {
            copyRoomCodeBtn.addEventListener('click', () => this.handleCopyRoomCode());
        }

        const refreshPlayersBtn = document.getElementById('refresh-players-btn');
        if (refreshPlayersBtn) {
            refreshPlayersBtn.addEventListener('click', () => this.handleRefreshPlayers());
        }

        // Game screen - Chat
        const publicChatInput = document.getElementById('public-chat-input');
        const publicSendBtn = document.getElementById('public-send-btn');
        const mafiaChatInput = document.getElementById('mafia-chat-input');
        const mafiaSendBtn = document.getElementById('mafia-send-btn');

        if (publicSendBtn) {
            publicSendBtn.addEventListener('click', () => this.handleSendChat('public'));
        }
        if (publicChatInput) {
            publicChatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleSendChat('public');
                }
            });
        }

        if (mafiaSendBtn) {
            mafiaSendBtn.addEventListener('click', () => this.handleSendChat('mafia'));
        }
        if (mafiaChatInput) {
            mafiaChatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleSendChat('mafia');
                }
            });
        }

        // Chat tabs
        const publicChatTab = document.getElementById('public-chat-tab');
        const mafiaChatTab = document.getElementById('mafia-chat-tab');

        if (publicChatTab) {
            publicChatTab.addEventListener('click', () => this.switchChatTab('public'));
        }
        if (mafiaChatTab) {
            mafiaChatTab.addEventListener('click', () => this.switchChatTab('mafia'));
        }

        // Role modal
        const closeRoleModal = document.getElementById('close-role-modal');
        if (closeRoleModal) {
            closeRoleModal.addEventListener('click', () => uiManager.hideRoleCard());
        }

        // End screen
        const playAgainBtn = document.getElementById('play-again-btn');
        if (playAgainBtn) {
            playAgainBtn.addEventListener('click', () => this.handlePlayAgain());
        }
    }

    /**
     * Setup Socket.io event listeners
     */
    setupSocketListeners() {
        console.log('🔧 Setting up socket event listeners...');
        
        // Ensure socket exists before registering listeners
        if (!socketClient.ws) {
            console.log('⏳ Socket not initialized, will register listeners when socket connects');
            // Listeners will be registered when socket connects via socketClient.on()
        }

        // Connected event - initialize online count and socket ID
        socketClient.on('connected', (data) => {
            console.log('✅ Connected to server:', data);
            socketClient.socketId = data.socketId;
            if (data.onlineCount !== undefined) {
                const onlineCountEl = document.getElementById('online-count');
                if (onlineCountEl) {
                    onlineCountEl.textContent = data.onlineCount;
                }
            }
        });
        
        // Room joined (for the joining player) - FIXED: Only navigate if on landing screen
        socketClient.on('room-joined', (data) => {
            console.log('📥 ===== ROOM-JOINED EVENT RECEIVED =====');
            console.log('📥 Room joined event received:', data);
            console.log('📥 Full data object:', JSON.stringify(data, null, 2));
            
            if (!data) {
                console.error('❌ No data in room-joined event');
                return;
            }
            
            this.isCreator = data.isCreator || false;
            
            // CRITICAL: Only navigate to lobby if we're still on landing screen
            // This prevents navigation if room doesn't exist (error would have been shown)
            const currentScreen = uiManager.currentScreen;
            console.log('🔍 Current screen before join:', currentScreen);
            
            // Persist room for rejoin on refresh
            try {
                const rc = data.roomCode || gameState.roomCode || '';
                const pn = gameState.playerName || '';
                if (rc) sessionStorage.setItem('mafia_roomCode', rc);
                if (pn) sessionStorage.setItem('mafia_playerName', pn);
            } catch (e) { /* ignore */ }

            if (currentScreen === 'landing' || !currentScreen) {
                console.log('✅ Navigating to lobby - room join successful');
                uiManager.updateRoomCode(data.roomCode || gameState.roomCode);
                uiManager.showScreen('lobby');
                // Request room state so rejoin after game start gets phase and can show game screen
                setTimeout(() => {
                    if (gameState.roomCode) socketClient.requestRoomState(gameState.roomCode);
                }, 300);
            } else {
                console.log('⚠️ Not navigating - already on screen:', currentScreen);
            }

            if (data.players && Array.isArray(data.players)) {
                console.log('👥 Valid players array received:', data.players.length, 'players');
                console.log('👥 Players:', data.players);
                uiManager.updatePlayersList(data.players, data.isCreator);
                
                // Verify update worked
                setTimeout(() => {
                    const countEl = document.getElementById('player-count');
                    if (countEl && countEl.textContent !== String(data.players.length)) {
                        console.error('❌ Player count mismatch! Expected:', data.players.length, 'Got:', countEl.textContent);
                        // Force update
                        uiManager.updatePlayersList(data.players, data.isCreator);
                    }
                }, 100);
            } else {
                console.error('❌ Invalid players data:', data.players);
                console.error('❌ Data type:', typeof data.players);
                console.warn('⚠️ Invalid players data received:', data);
            }
        });

        // Player joined (for all players)
        socketClient.on('player-joined', (data) => {
            console.log('📥 Player joined event:', data);
            console.log('📥 Full player-joined data:', JSON.stringify(data, null, 2));
            if (data.players && Array.isArray(data.players)) {
                console.log('👥 Updating players list:', data.players.length, 'players');
                console.log('👥 Players array:', data.players);
                uiManager.updatePlayersList(data.players, this.isCreator);
                
                // Verify update worked
                setTimeout(() => {
                    const countEl = document.getElementById('player-count');
                    if (countEl && countEl.textContent !== String(data.players.length)) {
                        console.error('❌ Player count mismatch after player-joined! Expected:', data.players.length, 'Got:', countEl.textContent);
                        // Force update
                        uiManager.updatePlayersList(data.players, this.isCreator);
                    }
                }, 100);
            } else {
                console.error('❌ Invalid players data in player-joined:', data.players);
                console.warn('⚠️ Invalid players data received:', data);
            }
        });

        // Role assigned
        socketClient.on('role-assigned', (data) => {
            gameState.setRole(data.role, data.roleImage);
            uiManager.showRoleCard(data.role, data.roleImage);
        });

        // Game started
        socketClient.on('game-started', (data) => {
            gameState.updatePlayers(data.players);
            uiManager.showScreen('game');
            uiManager.renderPlayerCards(data.players, gameState.playerId);
        });

        // Phase updates
        socketClient.on('phase-update', (data) => {
            gameState.updatePhase(data.phase, data.timeRemaining);
            uiManager.updatePhaseIndicator(data.phase, data.timeRemaining);
            // Refresh player cards to show updated states
            uiManager.renderPlayerCards(gameState.players, gameState.playerId);
        });

        // Night phase
        socketClient.on('night-phase', (data) => {
            gameState.updatePhase('night', data.timeRemaining);
            if (data.players) {
                gameState.updatePlayers(data.players);
            }
            uiManager.updatePhaseIndicator('night', data.timeRemaining);
            uiManager.updateActionPanel();
            uiManager.renderPlayerCards(gameState.players, gameState.playerId);
            
            // Show Mafia chat if player is Mafia
            if (gameState.role === 'mafia') {
                uiManager.toggleMafiaChat(true);
            }
        });

        // Day phase
        socketClient.on('day-phase', (data) => {
            gameState.updatePhase('day', data.timeRemaining);
            if (data.players) {
                gameState.updatePlayers(data.players);
            }
            uiManager.updatePhaseIndicator('day', data.timeRemaining);
            uiManager.updateActionPanel();
            uiManager.renderPlayerCards(gameState.players, gameState.playerId);
            
            // Hide Mafia chat
            uiManager.toggleMafiaChat(false);
        });

        // Night action confirmed
        socketClient.on('night-action-confirmed', (data) => {
            console.log('Night action confirmed:', data);
        });

        // Detective result
        socketClient.on('detective-result', (data) => {
            const result = data.isMafia ? 'is Mafia' : 'is not Mafia';
            alert(`Investigation Result: ${data.targetName} ${result}`);
        });

        // Vote cast
        socketClient.on('vote-cast', (data) => {
            uiManager.updateVotes(data.votes);
        });

        // Chat message
        socketClient.on('chat-message', (data) => {
            uiManager.addChatMessage(data.playerId, data.playerName, data.message, data.chatType);
        });

        // Moderator message
        socketClient.on('moderator-message', (data) => {
            uiManager.showModeratorMessage(data.message);
        });

        // Game ended
        socketClient.on('game-ended', (data) => {
            uiManager.showGameEnd(data.winner, data.reason, gameState.role);
        });

        // Error - FIXED: Handle join errors, show "No room with this code"
        socketClient.on('error', (error) => {
            console.error('❌ Socket error:', error);
            const errorMessage = error.message || 'An error occurred';
            
            // If we're on landing screen, show error in status display
            const statusEl = document.getElementById('room-status-display');
            if (statusEl && (uiManager.currentScreen === 'landing' || !uiManager.currentScreen)) {
                // Show "No room with this code" for room-related errors
                if (errorMessage.includes('Room') || errorMessage.includes('room') || errorMessage.includes('join') || errorMessage.includes('code')) {
                    statusEl.textContent = 'No room with this code';
                } else {
                    statusEl.textContent = errorMessage;
                }
                statusEl.className = 'room-status error';
                // CRITICAL: Ensure we stay on landing screen (don't navigate to lobby)
                uiManager.showScreen('landing');
            } else {
                // Otherwise show alert for other errors
                alert(errorMessage);
            }
        });

        // Room status - FIXED with better handling
        socketClient.on('room-status', (data) => {
            console.log('📥 ===== ROOM-STATUS EVENT RECEIVED =====');
            console.log('📥 Room status received:', data);
            const statusEl = document.getElementById('room-status-display');
            if (!statusEl) {
                console.warn('⚠️ Room status display element not found');
                return;
            }

            if (!data || data.exists === false) {
                statusEl.textContent = data?.message || 'Room does not exist';
                statusEl.className = 'room-status error';
                console.log('❌ Room not found:', data);
            } else {
                if (data.canJoin) {
                    statusEl.textContent = `✅ Room found! ${data.playerCount} player(s) in lobby. Ready to join!`;
                    statusEl.className = 'room-status success';
                    console.log('✅ Room found and can join:', data);
                } else {
                    statusEl.textContent = `Room is in ${data.phase} phase. Cannot join.`;
                    statusEl.className = 'room-status error';
                    console.log('⚠️ Room found but cannot join:', data);
                }
            }
        });

        // Online count update
        socketClient.on('online-count-update', (data) => {
            console.log('📊 Online count update:', data);
            const onlineCountEl = document.getElementById('online-count');
            if (onlineCountEl) {
                onlineCountEl.textContent = data.onlineCount || 0;
            }
        });

        // Room player count update
        socketClient.on('room-player-count-update', (data) => {
            console.log('📊 Room player count update:', data);
            const roomOnlineCountEl = document.getElementById('room-online-count');
            if (roomOnlineCountEl && data.roomCode === gameState.roomCode) {
                roomOnlineCountEl.textContent = data.playerCount || 0;
            }
        });

        // Rooms list
        socketClient.on('rooms-list', (data) => {
            uiManager.displayRoomsList(data.rooms);
        });

        // Room state (fallback/refresh)
        socketClient.on('room-state', (data) => {
            console.log('📥 ===== ROOM STATE RECEIVED =====');
            console.log('📥 Room state received:', data);
            console.log('📥 Full room-state data:', JSON.stringify(data, null, 2));
            console.log('📥 Data type check - players:', typeof data.players, Array.isArray(data.players));
            
            if (data.error) {
                console.error('❌ Room state error:', data.error);
                alert('Error getting room state: ' + data.error);
                return;
            }
            
            if (!data) {
                console.error('❌ No data received in room-state event');
                return;
            }
            
            if (data.players && Array.isArray(data.players)) {
                this.isCreator = data.isCreator || false;
                console.log('✅ Valid players array received:', data.players.length, 'players');
                console.log('👥 Players array:', data.players);
                uiManager.updatePlayersList(data.players, data.isCreator);
                // If we're in game phase (e.g. rejoin after refresh), show game screen
                if (data.phase === 'night' || data.phase === 'day') {
                    gameState.updatePhase(data.phase, data.timeRemaining != null ? data.timeRemaining : 0);
                    gameState.updatePlayers(data.players);
                    uiManager.showScreen('game');
                    uiManager.renderPlayerCards(data.players, gameState.playerId);
                    uiManager.updatePhaseIndicator(data.phase, data.timeRemaining != null ? data.timeRemaining : 0);
                }
                // Double-check after update
                setTimeout(() => {
                    const countEl = document.getElementById('player-count');
                    console.log('🔍 Verification - Player count element:', countEl?.textContent);
                    if (countEl && countEl.textContent !== String(data.players.length)) {
                        console.error('❌ COUNT MISMATCH! Expected:', data.players.length, 'Got:', countEl.textContent);
                        // Force update again
                        uiManager.updatePlayersList(data.players, data.isCreator);
                    } else {
                        console.log('✅ Player count matches!');
                    }
                }, 200);
            } else {
                console.error('❌ Invalid players data in room-state:', data.players);
                console.error('❌ Data structure:', data);
                if (data.players === undefined) {
                    console.error('❌ Players property is undefined!');
                } else if (!Array.isArray(data.players)) {
                    console.error('❌ Players is not an array, type:', typeof data.players);
                }
            }
        });
    }

    /**
     * Handle join room
     */
    handleJoinRoom() {
        const roomCode = document.getElementById('room-code-input')?.value.trim().toUpperCase();
        const playerName = document.getElementById('player-name-input')?.value.trim();
        const statusEl = document.getElementById('room-status-display');

        if (!roomCode || roomCode.length !== 6) {
            if (statusEl) {
                statusEl.textContent = 'Please enter a valid 6-character room code';
                statusEl.className = 'room-status error';
            } else {
                alert('Please enter a valid 6-character room code');
            }
            return;
        }

        if (!playerName || playerName.length < 2) {
            if (statusEl) {
                statusEl.textContent = 'Please enter your name (at least 2 characters)';
                statusEl.className = 'room-status error';
            } else {
                alert('Please enter your name (at least 2 characters)');
            }
            return;
        }

        // Ensure socket is connected
        if (!socketClient.connected) {
            console.log('⏳ Waiting for socket connection...');
            if (statusEl) {
                statusEl.textContent = 'Connecting to server...';
                statusEl.className = 'room-status info';
            }
            
            socketClient.on('connect', () => {
                console.log('✅ Socket connected, joining room...');
                this.performJoinRoom(roomCode, playerName, statusEl);
            });
        } else {
            this.performJoinRoom(roomCode, playerName, statusEl);
        }
    }

    /**
     * Perform the actual room join - FIXED: Only join if room exists
     */
    performJoinRoom(roomCode, playerName, statusEl) {
        // Show joining status
        if (statusEl) {
            statusEl.textContent = 'Joining room...';
            statusEl.className = 'room-status info';
        }

        // Ensure socket is connected
        if (!socketClient.connected) {
            console.warn('⚠️ Socket not connected, waiting...');
            socketClient.once('connected', () => {
                this.performJoinRoom(roomCode, playerName, statusEl);
            });
            return;
        }

        const socketId = socketClient.getId();
        console.log('🚪 Joining room:', roomCode, 'as', playerName, 'with socket', socketId);
        
        if (!socketId) {
            console.error('❌ No socket ID available');
            if (statusEl) {
                statusEl.textContent = 'Connection error. Please try again.';
                statusEl.className = 'room-status error';
            }
            return;
        }
        
        // Initialize game state (but don't navigate to lobby yet)
        gameState.init(roomCode, playerName, socketId);
        
        // Flag to prevent duplicate handling
        let joinHandled = false;
        
        // Set up one-time listener for join success/failure
        const joinSuccessHandler = (data) => {
            if (joinHandled) {
                console.log('⚠️ Join already handled, ignoring success');
                return;
            }
            joinHandled = true;
            console.log('✅ Join successful, navigating to lobby');
            uiManager.updateRoomCode(roomCode);
            uiManager.showScreen('lobby');
            
            // Request room state after a short delay as fallback
            setTimeout(() => {
                console.log('🔄 Requesting room state as fallback...');
                socketClient.requestRoomState(roomCode);
            }, 1000);
        };

        const joinErrorHandler = (error) => {
            if (joinHandled) {
                console.log('⚠️ Join already handled, ignoring error');
                return;
            }
            joinHandled = true;
            console.error('❌ Join failed:', error);
            
            // CRITICAL: Show error and ensure we stay on landing screen
            if (statusEl) {
                const errorMsg = error.message || 'No room with this code';
                statusEl.textContent = errorMsg.includes('code') || errorMsg.includes('room') ? 'No room with this code' : errorMsg;
                statusEl.className = 'room-status error';
            }
            
            // Force stay on landing screen - don't navigate to lobby
            console.log('🚫 Preventing navigation to lobby - room code invalid');
            if (uiManager.currentScreen !== 'landing') {
                uiManager.showScreen('landing');
            }
        };

        // Listen for room-joined (success) or error (failure)
        socketClient.once('room-joined', joinSuccessHandler);
        socketClient.once('error', joinErrorHandler);
        
        // Also set a timeout in case no response
        const timeout = setTimeout(() => {
            if (joinHandled) {
                console.log('⚠️ Join already handled, clearing timeout');
                return;
            }
            joinHandled = true;
            
            socketClient.off('room-joined', joinSuccessHandler);
            socketClient.off('error', joinErrorHandler);
            
            if (statusEl) {
                statusEl.textContent = 'No room with this code';
                statusEl.className = 'room-status error';
            }
            console.error('❌ Join timeout - no response from server');
            
            // CRITICAL: Ensure we stay on landing screen - don't navigate
            console.log('🚫 Timeout - preventing navigation to lobby');
            if (uiManager.currentScreen !== 'landing') {
                uiManager.showScreen('landing');
            }
        }, 5000);
        
        // Clear timeout if join succeeds or fails
        socketClient.once('room-joined', () => {
            clearTimeout(timeout);
        });
        socketClient.once('error', () => {
            clearTimeout(timeout);
        });
        
        // Now attempt to join
        socketClient.joinRoom(roomCode, playerName);
    }

    /**
     * Handle create room
     */
    handleCreateRoom() {
        const playerName = document.getElementById('player-name-create')?.value.trim();
        const statusEl = document.getElementById('create-room-status');
        
        if (!playerName || playerName.length < 2) {
            if (statusEl) {
                statusEl.textContent = 'Please enter your name (at least 2 characters)';
                statusEl.className = 'room-status error';
            } else {
                alert('Please enter your name (at least 2 characters)');
            }
            return;
        }

        // Generate room code
        const roomCode = this.generateRoomCode();
        
        // Show status
        if (statusEl) {
            statusEl.textContent = `Creating room ${roomCode}...`;
            statusEl.className = 'room-status info';
        }

        // FIXED: Ensure socket is connected before creating room
        this.ensureConnectedAndCreateRoom(roomCode, playerName, statusEl);
    }

    /**
     * Ensure socket is connected, then create room
     */
    ensureConnectedAndCreateRoom(roomCode, playerName, statusEl) {
        // Ensure socket exists
        if (!socketClient.ws) {
            console.log('⏳ Socket not initialized, connecting...');
            socketClient.connect();
        }

        // Get socket ID (might be null if not connected)
        const socketId = socketClient.getId();
        
        // Initialize game state (socketId might be null initially, will be set when connected)
        gameState.init(roomCode, playerName, socketId);

        // Wait for socket to be connected before creating room
        if (!socketClient.connected) {
            console.log('⏳ Waiting for socket connection before creating room...');
            if (statusEl) {
                statusEl.textContent = 'Connecting to server...';
                statusEl.className = 'room-status info';
            }
            
            // Wait for connection
            socketClient.once('connected', () => {
                console.log('✅ Socket connected, now creating room...');
                const connectedSocketId = socketClient.getId();
                gameState.playerId = connectedSocketId; // Update player ID
                
                if (statusEl) {
                    statusEl.textContent = `Creating room ${roomCode}...`;
                }
                
                // Now create the room
                socketClient.createRoom(roomCode, playerName);
            });
        } else {
            // Socket is already connected, create room immediately
            console.log('✅ Socket already connected, creating room...');
            const connectedSocketId = socketClient.getId();
            gameState.playerId = connectedSocketId; // Update player ID
            
            if (statusEl) {
                statusEl.textContent = `Creating room ${roomCode}...`;
            }
            
            socketClient.createRoom(roomCode, playerName);
        }
    }

    /**
     * Ensure socket is connected, then join room
     */
    ensureConnectedAndJoin(roomCode, playerName, statusEl) {
        // Ensure socket exists
        if (!socketClient.ws) {
            console.log('⏳ Socket not initialized, connecting...');
            socketClient.connect();
        }

        // Get socket ID (might be null if not connected)
        const socketId = socketClient.getId();
        
        // Initialize game state (socketId might be null initially, will be set when connected)
        gameState.init(roomCode, playerName, socketId);
        uiManager.updateRoomCode(roomCode);
        uiManager.showScreen('lobby');

        // Wait for socket to be connected before joining
        if (!socketClient.connected) {
            console.log('⏳ Waiting for socket connection before joining room...');
            if (statusEl) {
                statusEl.textContent = 'Connecting to server...';
                statusEl.className = 'room-status info';
            }
            
            // Wait for connection
            socketClient.once('connected', () => {
                console.log('✅ Socket connected, now joining room...');
                const connectedSocketId = socketClient.getId();
                gameState.playerId = connectedSocketId; // Update player ID
                
                if (statusEl) {
                    statusEl.textContent = `Joining room ${roomCode}...`;
                }
                
                // Now join the room
                socketClient.joinRoom(roomCode, playerName);
            });
        } else {
            // Socket is already connected, join immediately
            console.log('✅ Socket already connected, joining room...');
            const connectedSocketId = socketClient.getId();
            gameState.playerId = connectedSocketId; // Update player ID
            
            if (statusEl) {
                statusEl.textContent = `Joining room ${roomCode}...`;
            }
            
            socketClient.joinRoom(roomCode, playerName);
        }
    }

    /**
     * Try to rejoin room from sessionStorage (after refresh)
     */
    tryRejoinFromStorage(roomCode, playerName) {
        if (!roomCode || !playerName) return;
        const statusEl = document.getElementById('room-status-display');
        if (statusEl) {
            statusEl.textContent = 'Rejoining room...';
            statusEl.className = 'room-status info';
        }
        gameState.init(roomCode, playerName, socketClient.getId());
        uiManager.updateRoomCode(roomCode);
        socketClient.joinRoom(roomCode, playerName);
        // If rejoin fails, error handler will clear status
    }

    /**
     * Switch between create and join tabs
     */
    switchRoomTab(tab) {
        const createTab = document.getElementById('create-tab');
        const joinTab = document.getElementById('join-tab');
        const createSection = document.getElementById('create-room-section');
        const joinSection = document.getElementById('join-room-section');

        if (tab === 'create') {
            createTab?.classList.add('active');
            joinTab?.classList.remove('active');
            createSection?.classList.add('active');
            joinSection?.classList.remove('active');
        } else {
            joinTab?.classList.add('active');
            createTab?.classList.remove('active');
            joinSection?.classList.add('active');
            createSection?.classList.remove('active');
        }
    }

    /**
     * Handle check room status - FIXED with better error handling
     */
    handleCheckRoom() {
        const roomCodeInput = document.getElementById('room-code-input');
        const roomCode = roomCodeInput?.value.trim().toUpperCase();
        const statusEl = document.getElementById('room-status-display');

        if (!roomCode || roomCode.length !== 6) {
            if (statusEl) {
                statusEl.textContent = 'Please enter a valid 6-character room code';
                statusEl.className = 'room-status error';
            }
            return;
        }

        // Ensure socket is connected
        if (!socketClient.connected) {
            if (statusEl) {
                statusEl.textContent = 'Connecting to server...';
                statusEl.className = 'room-status info';
            }
            
            socketClient.once('connected', () => {
                this.handleCheckRoom();
            });
            return;
        }

        if (statusEl) {
            statusEl.textContent = 'Checking room...';
            statusEl.className = 'room-status info';
        }

        console.log('🔍 Checking room:', roomCode);
        socketClient.checkRoom(roomCode);
    }

    /**
     * Handle refresh rooms list
     */
    handleRefreshRooms() {
        socketClient.getRooms();
    }

    /**
     * Generate room code
     */
    generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    /**
     * Handle start game
     */
    handleStartGame() {
        socketClient.startGame(gameState.roomCode);
    }

    /**
     * Handle copy room code
     */
    handleCopyRoomCode() {
        const roomCode = gameState.roomCode;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(roomCode).then(() => {
                alert('Room code copied to clipboard!');
            });
        } else {
            // Fallback for older browsers
            const input = document.createElement('input');
            input.value = roomCode;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            alert('Room code copied to clipboard!');
        }
    }

    /**
     * Handle send chat message
     */
    handleSendChat(chatType) {
        const inputId = chatType === 'mafia' ? 'mafia-chat-input' : 'public-chat-input';
        const input = document.getElementById(inputId);
        const message = input?.value.trim();

        if (!message) return;

        socketClient.sendChatMessage(gameState.roomCode, message, chatType);
        input.value = '';
    }

    /**
     * Switch chat tab
     */
    switchChatTab(tab) {
        const publicTab = document.getElementById('public-chat-tab');
        const mafiaTab = document.getElementById('mafia-chat-tab');
        const publicChat = document.getElementById('public-chat');
        const mafiaChat = document.getElementById('mafia-chat');

        if (tab === 'public') {
            publicTab?.classList.add('active');
            mafiaTab?.classList.remove('active');
            publicChat?.classList.add('active');
            mafiaChat?.classList.remove('active');
        } else {
            mafiaTab?.classList.add('active');
            publicTab?.classList.remove('active');
            mafiaChat?.classList.add('active');
            publicChat?.classList.remove('active');
        }
    }

    /**
     * Handle refresh players list
     */
    handleRefreshPlayers() {
        const roomCode = gameState.roomCode;
        if (roomCode) {
            console.log('🔄 Manually refreshing players list...');
            socketClient.requestRoomState(roomCode);
        } else {
            console.warn('⚠️ No room code available for refresh');
        }
    }

    /**
     * Handle play again
     */
    handlePlayAgain() {
        // Reset game state
        gameState.roomCode = null;
        gameState.playerName = null;
        gameState.role = null;
        gameState.phase = 'lobby';
        gameState.players = [];

        // Clear persisted room so we don't auto-rejoin
        try {
            sessionStorage.removeItem('mafia_roomCode');
            sessionStorage.removeItem('mafia_playerName');
        } catch (e) { /* ignore */ }

        // Clear inputs
        document.getElementById('room-code-input').value = '';
        document.getElementById('player-name-input').value = '';

        // Show landing screen
        uiManager.showScreen('landing');
    }

    /**
     * Check if current player is room creator
     */
    isRoomCreator() {
        return this.isCreator;
    }
}

// Suppress browser extension async errors (not our code)
window.addEventListener('unhandledrejection', (event) => {
    // Check if it's the common browser extension error
    if (event.reason && event.reason.message && 
        event.reason.message.includes('message channel closed')) {
        event.preventDefault();
        console.log('ℹ️ Suppressed browser extension error');
        return;
    }
});

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();

    // Connect to server FIRST
    const ws = socketClient.connect();

    if (ws) {
        // Wait for connection, then set up listeners and try auto-rejoin
        socketClient.once('connected', () => {
            console.log('✅ WebSocket connected, setting up listeners...');
            setTimeout(() => {
                socketClient.getRooms();
                // If we have a saved room (e.g. after refresh), rejoin automatically
                try {
                    const savedRoom = sessionStorage.getItem('mafia_roomCode');
                    const savedName = sessionStorage.getItem('mafia_playerName');
                    if (savedRoom && savedName) {
                        app.tryRejoinFromStorage(savedRoom, savedName);
                    }
                } catch (e) { /* ignore */ }
            }, 100);
        });
    } else {
        console.error('Failed to initialize WebSocket connection');
    }
});

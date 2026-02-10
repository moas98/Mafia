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

        // Enter key handlers
        [roomCodeInput, playerNameInput].forEach(input => {
            if (input) {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        if (createRoomBtn) {
                            createRoomBtn.click();
                        } else if (joinBtn) {
                            joinBtn.click();
                        }
                    }
                });
            }
        });

        // Lobby screen
        const startGameBtn = document.getElementById('start-game-btn');
        if (startGameBtn) {
            startGameBtn.addEventListener('click', () => this.handleStartGame());
        }

        const copyRoomCodeBtn = document.getElementById('copy-room-code');
        if (copyRoomCodeBtn) {
            copyRoomCodeBtn.addEventListener('click', () => this.handleCopyRoomCode());
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
        // Room joined (for the joining player)
        socketClient.on('room-joined', (data) => {
            this.isCreator = data.isCreator;
            uiManager.updatePlayersList(data.players, data.isCreator);
        });

        // Player joined (for all players)
        socketClient.on('player-joined', (data) => {
            uiManager.updatePlayersList(data.players, this.isCreator);
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

        // Error
        socketClient.on('error', (error) => {
            alert(error.message || 'An error occurred');
        });
    }

    /**
     * Handle join room
     */
    handleJoinRoom() {
        const roomCode = document.getElementById('room-code-input')?.value.trim().toUpperCase();
        const playerName = document.getElementById('player-name-input')?.value.trim();

        if (!roomCode || roomCode.length !== 6) {
            alert('Please enter a valid 6-character room code');
            return;
        }

        if (!playerName || playerName.length < 2) {
            alert('Please enter your name (at least 2 characters)');
            return;
        }

        gameState.init(roomCode, playerName, socketClient.getId());
        socketClient.joinRoom(roomCode, playerName);
        uiManager.updateRoomCode(roomCode);
        uiManager.showScreen('lobby');
    }

    /**
     * Handle create room
     */
    handleCreateRoom() {
        const playerName = document.getElementById('player-name-input')?.value.trim();
        
        if (!playerName || playerName.length < 2) {
            alert('Please enter your name (at least 2 characters)');
            return;
        }

        // Generate room code
        const roomCode = this.generateRoomCode();
        document.getElementById('room-code-input').value = roomCode;
        this.handleJoinRoom();
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
     * Handle play again
     */
    handlePlayAgain() {
        // Reset game state
        gameState.roomCode = null;
        gameState.playerName = null;
        gameState.role = null;
        gameState.phase = 'lobby';
        gameState.players = [];

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

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    socketClient.connect();
});

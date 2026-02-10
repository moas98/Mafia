/**
 * Socket.io client connection and event handling
 */
class SocketClient {
    constructor() {
        this.socket = null;
        this.connected = false;
    }

    /**
     * Connect to server
     */
    connect() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            this.connected = true;
            console.log('Connected to server');
        });

        this.socket.on('disconnect', () => {
            this.connected = false;
            console.log('Disconnected from server');
        });

        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            alert(error.message || 'An error occurred');
        });

        return this.socket;
    }

    /**
     * Join a room
     */
    joinRoom(roomCode, playerName) {
        if (!this.socket) {
            this.connect();
        }
        this.socket.emit('join-room', { roomCode, playerName });
    }

    /**
     * Start game
     */
    startGame(roomCode) {
        this.socket.emit('start-game', { roomCode });
    }

    /**
     * Send night action
     */
    sendNightAction(roomCode, action, target) {
        this.socket.emit('night-action', { roomCode, action, target });
    }

    /**
     * Send vote
     */
    sendVote(roomCode, targetId) {
        this.socket.emit('vote', { roomCode, targetId });
    }

    /**
     * Send chat message
     */
    sendChatMessage(roomCode, message, chatType = 'public') {
        this.socket.emit('chat-message', { roomCode, message, chatType });
    }

    /**
     * Register event listener
     */
    on(event, callback) {
        if (!this.socket) {
            this.connect();
        }
        this.socket.on(event, callback);
    }

    /**
     * Remove event listener
     */
    off(event, callback) {
        if (this.socket) {
            this.socket.off(event, callback);
        }
    }

    /**
     * Get socket ID
     */
    getId() {
        return this.socket?.id || null;
    }
}

// Export singleton instance
const socketClient = new SocketClient();

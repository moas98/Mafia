/**
 * Native WebSocket client connection and event handling
 */
class SocketClient {
    constructor() {
        this.ws = null;
        this.connected = false;
        this.socketId = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.eventListeners = new Map(); // event -> Set of callbacks
        this.messageQueue = []; // Queue messages while disconnected
    }

    /**
     * Connect to server
     */
    connect() {
        try {
            // Determine WebSocket URL
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.host;
            const wsUrl = `${protocol}//${host}`;

            console.log(`🔌 Connecting to WebSocket: ${wsUrl}`);
            
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('✅ WebSocket connected');
                this.connected = true;
                this.reconnectAttempts = 0;
                
                // Send queued messages
                while (this.messageQueue.length > 0) {
                    const message = this.messageQueue.shift();
                    this.send(message.event, message.data);
                }
            };

            this.ws.onmessage = (event) => {
                try {
                    console.log('event.data', event.data); // keep it so can know ehat is event 
                    const message = JSON.parse(event.data);
                    console.log(`📥 Received: ${message.event}`, message.data);
                    this.handleMessage(message.event, message.data);
                } catch (error) {
                    console.error('❌ Error parsing WebSocket message:', error);
                }
            };

            this.ws.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
                this.connected = false;
            };

            this.ws.onclose = (event) => {
                console.log('❌ WebSocket closed:', event.code, event.reason);
                this.connected = false;
                this.socketId = null;
                
                // Attempt to reconnect
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
                    setTimeout(() => {
                        this.connect();
                    }, this.reconnectDelay * this.reconnectAttempts);
                } else {
                    console.error('❌ Max reconnection attempts reached');
                    alert('Connection lost. Please refresh the page.');
                }
            };

            return this.ws;
        } catch (error) {
            console.error('❌ Failed to initialize WebSocket:', error);
            alert('Failed to connect to server. Please check if the server is running.');
            return null;
        }
    }

    /**
     * Handle incoming message
     */
    handleMessage(event, data) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`❌ Error in ${event} handler:`, error);
                }
            });
        }
    }

    /**
     * Send message to server
     */
    send(event, data) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn(`⚠️ WebSocket not connected, queueing message: ${event}`);
            this.messageQueue.push({ event, data });
            
            // Try to reconnect if not already attempting
            if (!this.connected && this.reconnectAttempts === 0) {
                this.connect();
            }
            return;
        }

        // Format: "event@@@{\"key\":\"value\"}" — @@@ won't be stripped by proxies
        const dataObj = data !== undefined && data !== null ? data : {};
        let dataStr;
        try {
            dataStr = JSON.stringify(dataObj);
        } catch (e) {
            console.error(`❌ JSON.stringify failed for ${event}:`, e);
            return;
        }
        const text = event + '@@@' + dataStr;
        try {
            this.ws.send(text);
            console.log(`📤 Sent: ${event}`, dataObj);
        } catch (error) {
            console.error(`❌ Error sending message:`, error);
        }
    }

    /**
     * Register event listener
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event).add(callback);
        console.log(`👂 Registered listener for: ${event}`);
    }

    /**
     * Remove event listener
     */
    off(event, callback) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.delete(callback);
            if (listeners.size === 0) {
                this.eventListeners.delete(event);
            }
        }
    }

    /**
     * Register one-time event listener
     */
    once(event, callback) {
        const onceCallback = (data) => {
            callback(data);
            this.off(event, onceCallback);
        };
        this.on(event, onceCallback);
    }

    /**
     * Get socket ID
     */
    getId() {
        return this.socketId;
    }

    /**
     * Create a room
     */
    createRoom(roomCode, playerName) {
        if (!this.connected) {
            console.warn('⚠️ WebSocket not connected, connecting...');
            this.connect();
            // Wait for connection
            this.ws.onopen = () => {
                this.send('create-room', { roomCode, playerName });
            };
        } else {
            this.send('create-room', { roomCode, playerName });
        }
    }

    /**
     * Join a room
     */
    joinRoom(roomCode, playerName) {
        if (!this.connected) {
            console.warn('⚠️ WebSocket not connected, connecting...');
            this.connect();
            // Wait for connection
            this.ws.onopen = () => {
                this.send('join-room', { roomCode, playerName });
            };
        } else {
            this.send('join-room', { roomCode, playerName });
        }
    }

    /**
     * Start game
     */
    startGame(roomCode) {
        this.send('start-game', { roomCode });
    }

    /**
     * Send night action
     */
    sendNightAction(roomCode, action, target) {
        this.send('night-action', { roomCode, action, target });
    }

    /**
     * Send vote
     */
    sendVote(roomCode, targetId) {
        this.send('vote', { roomCode, targetId });
    }

    /**
     * Send chat message
     */
    sendChatMessage(roomCode, message, chatType = 'public') {
        this.send('chat-message', { roomCode, message, chatType });
    }

    /**
     * Get available rooms
     */
    getRooms() {
        if (!this.connected) {
            if (this.ws) {
                this.ws.onopen = () => {
                    this.send('get-rooms', {});
                };
            }
            return;
        }
        this.send('get-rooms', {});
    }

    /**
     * Check room status
     */
    checkRoom(roomCode) {
        if (!this.connected) {
            if (this.ws) {
                this.ws.onopen = () => {
                    this.send('check-room', { roomCode });
                };
            }
            return;
        }
        this.send('check-room', { roomCode });
    }

    /**
     * Request current room state
     */
    requestRoomState(roomCode) {
        if (!this.connected) {
            console.warn('⚠️ WebSocket not connected, cannot request room state');
            return;
        }
        console.log('📤 Requesting room state for:', roomCode);
        this.send('request-room-state', { roomCode });
    }
}

// Export singleton instance
const socketClient = new SocketClient();

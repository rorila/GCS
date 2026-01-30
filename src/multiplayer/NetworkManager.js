/**
 * NetworkManager - Handles WebSocket connection to game server
 *
 * Simple and extensible: Manages connection state and message routing.
 */
export class NetworkManager {
    constructor(serverUrl = 'ws://localhost:8080') {
        this.ws = null;
        this.eventHandlers = new Set();
        this.state = 'disconnected';
        this.roomCode = null;
        this.playerNumber = null;
        this.serverUrl = serverUrl;
    }
    /**
     * Get the HTTP base URL based on the WebSocket URL
     */
    getHttpUrl() {
        return this.serverUrl.replace('ws://', 'http://').replace('wss://', 'https://');
    }
    /**
     * Connect to the game server
     */
    connect() {
        return new Promise((resolve, reject) => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                resolve();
                return;
            }
            this.state = 'connecting';
            this.ws = new WebSocket(this.serverUrl);
            this.ws.onopen = () => {
                this.state = 'connected';
                console.log('[Network] Connected to server');
                resolve();
            };
            this.ws.onerror = (error) => {
                console.error('[Network] Connection error:', error);
                this.state = 'disconnected';
                reject(error);
            };
            this.ws.onclose = () => {
                console.log('[Network] Disconnected from server');
                this.state = 'disconnected';
                this.roomCode = null;
                this.playerNumber = null;
            };
            this.ws.onmessage = (event) => {
                this.handleMessage(event.data);
            };
        });
    }
    /**
     * Disconnect from the server
     */
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.state = 'disconnected';
        this.roomCode = null;
        this.playerNumber = null;
    }
    /**
     * Create a new game room
     */
    createRoom(gameName) {
        this.send({ type: 'create_room', gameName });
    }
    /**
     * Join an existing room
     */
    joinRoom(roomCode) {
        this.send({ type: 'join_room', roomCode: roomCode.toUpperCase() });
    }
    /**
     * Mark player as ready
     */
    ready() {
        this.send({ type: 'ready' });
    }
    /**
     * Send input event (key press/release)
     */
    sendInput(key, action) {
        this.send({ type: 'input', key, action });
    }
    /**
     * Trigger an event on a remote object (e.g., onClick for a button)
     */
    triggerRemoteEvent(objectId, eventName, params) {
        this.send({ type: 'trigger_event', objectId, eventName, params });
    }
    /**
     * Send generic state sync for any object
     */
    sendStateSync(objectId, state) {
        this.send({ type: 'state_sync', objectId, state });
    }
    /**
     * Send project JSON to server (Master only)
     */
    syncProject(project) {
        this.send({ type: 'sync_project', project });
    }
    /**
     * Broadcast an action to all players
     */
    sendBroadcastAction(action) {
        this.send({ type: 'broadcast_action', action });
    }
    /**
     * Add event listener for server messages
     */
    on(handler) {
        this.eventHandlers.add(handler);
    }
    /**
     * Remove event listener
     */
    off(handler) {
        this.eventHandlers.delete(handler);
    }
    /**
     * Send a message to the server
     */
    send(message) {
        const isSyncMessage = message.type === 'state_sync' || message.type === 'trigger_event';
        // Only send sync messages if we are actually playing
        if (isSyncMessage && this.state !== 'playing') {
            return;
        }
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const data = JSON.stringify(message);
            this.ws.send(data);
            if (message.type !== 'state_sync' && message.type !== 'trigger_event') { // Avoid spamming common logs
                console.log(`[Network] SENT: ${message.type}`, message);
            }
        }
        else if (isSyncMessage) {
            // Silently drop sync messages if not connected
        }
        else {
            console.warn('[Network] Cannot send message - not connected', this.ws?.readyState);
        }
    }
    /**
     * Handle incoming server message
     */
    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            if (message.type === 'remote_state') {
                console.log(`[Network] RECV remote_state for ${message.objectId} from P${message.player}`, message);
            }
            else if (message.type !== 'remote_input') {
                console.log(`[Network] RECV: ${message.type}`, message);
            }
            // Update internal state based on message
            switch (message.type) {
                case 'room_created':
                    this.roomCode = message.roomCode;
                    this.playerNumber = 1;
                    this.state = 'in_room';
                    break;
                case 'room_joined':
                    this.roomCode = message.roomCode;
                    this.playerNumber = message.playerNumber;
                    this.state = 'in_room';
                    break;
                case 'game_start':
                    this.playerNumber = message.yourPlayer;
                    this.state = 'playing';
                    break;
                case 'error':
                    console.error('[Network] Server error:', message.message);
                    break;
            }
            // Notify all handlers
            this.eventHandlers.forEach(handler => handler(message));
        }
        catch (error) {
            console.error('[Network] Failed to parse message:', error);
        }
    }
}
// Singleton instance for easy access
export const network = new NetworkManager();

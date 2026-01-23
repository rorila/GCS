import { ClientMessage, ServerMessage } from './Protocol';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'in_room' | 'playing';

export type NetworkEventHandler = (message: ServerMessage) => void;

/**
 * NetworkManager - Handles WebSocket connection to game server
 * 
 * Simple and extensible: Manages connection state and message routing.
 */
export class NetworkManager {
    private ws: WebSocket | null = null;
    private serverUrl: string;
    private eventHandlers: Set<NetworkEventHandler> = new Set();

    public state: ConnectionState = 'disconnected';
    public roomCode: string | null = null;
    public playerNumber: 1 | 2 | null = null;

    constructor(serverUrl: string = 'ws://localhost:8080') {
        this.serverUrl = serverUrl;
    }

    /**
     * Get the HTTP base URL based on the WebSocket URL
     */
    public getHttpUrl(): string {
        return this.serverUrl.replace('ws://', 'http://').replace('wss://', 'https://');
    }

    /**
     * Connect to the game server
     */
    connect(): Promise<void> {
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
    disconnect(): void {
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
    createRoom(gameName?: string): void {
        this.send({ type: 'create_room', gameName });
    }

    /**
     * Join an existing room
     */
    joinRoom(roomCode: string): void {
        this.send({ type: 'join_room', roomCode: roomCode.toUpperCase() });
    }

    /**
     * Mark player as ready
     */
    ready(): void {
        this.send({ type: 'ready' });
    }

    /**
     * Send input event (key press/release)
     */
    sendInput(key: string, action: 'down' | 'up'): void {
        this.send({ type: 'input', key, action } as any);
    }

    /**
     * Trigger an event on a remote object (e.g., onClick for a button)
     */
    triggerRemoteEvent(objectId: string, eventName: string, params?: any): void {
        this.send({ type: 'trigger_event', objectId, eventName, params });
    }

    /**
     * Send generic state sync for any object
     */
    sendStateSync(objectId: string, state: any): void {
        this.send({ type: 'state_sync', objectId, state });
    }

    /**
     * Send project JSON to server (Master only)
     */
    syncProject(project: any): void {
        this.send({ type: 'sync_project', project });
    }

    /**
     * Broadcast an action to all players
     */
    sendBroadcastAction(action: any): void {
        this.send({ type: 'broadcast_action', action });
    }

    /**
     * Add event listener for server messages
     */
    on(handler: NetworkEventHandler): void {
        this.eventHandlers.add(handler);
    }

    /**
     * Remove event listener
     */
    off(handler: NetworkEventHandler): void {
        this.eventHandlers.delete(handler);
    }

    /**
     * Send a message to the server
     */
    private send(message: ClientMessage): void {
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
        } else if (isSyncMessage) {
            // Silently drop sync messages if not connected
        } else {
            console.warn('[Network] Cannot send message - not connected', this.ws?.readyState);
        }
    }

    /**
     * Handle incoming server message
     */
    private handleMessage(data: string): void {
        try {
            const message = JSON.parse(data) as ServerMessage;

            if (message.type === 'remote_state') {
                console.log(`[Network] RECV remote_state for ${message.objectId} from P${message.player}`, message);
            } else if (message.type !== 'remote_input') {
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

        } catch (error) {
            console.error('[Network] Failed to parse message:', error);
        }
    }
}

// Singleton instance for easy access
export const network = new NetworkManager();

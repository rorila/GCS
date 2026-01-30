import { MultiplayerManager } from '../runtime/MultiplayerManager';
import { serviceRegistry } from './ServiceRegistry';
/**
 * RemoteGameManager - Service for multiplayer room management
 *
 * Provides a Promise-based API for dialog bindings.
 * Wraps the lower-level MultiplayerManager with service-friendly methods.
 */
export class RemoteGameManager {
    constructor() {
        this.mp = null;
        this.gameName = 'default';
        // Pending promises for async operations
        this.createRoomResolve = null;
        this.joinRoomResolve = null;
        // Event callbacks (can be set by dialogs/components)
        this.onPlayerJoined = null;
        this.onPlayerLeft = null;
        this.onGameStart = null;
        this.onError = null;
        this.onConnectionChange = null;
        console.log('[RemoteGameManager] Service created');
    }
    /**
     * Initialize connection to game server
     */
    async connect(gameName = 'default') {
        this.gameName = gameName;
        return new Promise((resolve) => {
            try {
                this.mp = new MultiplayerManager(gameName);
                // Wait for connection
                const checkInterval = setInterval(() => {
                    if (this.mp?.isConnected) {
                        clearInterval(checkInterval);
                        this.setupCallbacks();
                        if (this.onConnectionChange)
                            this.onConnectionChange(true);
                        console.log('[RemoteGameManager] Connected');
                        resolve(true);
                    }
                }, 100);
                // Timeout after 5 seconds
                setTimeout(() => {
                    clearInterval(checkInterval);
                    if (!this.mp?.isConnected) {
                        console.error('[RemoteGameManager] Connection timeout');
                        if (this.onError)
                            this.onError('Verbindung zum Server fehlgeschlagen');
                        resolve(false);
                    }
                }, 5000);
            }
            catch (error) {
                console.error('[RemoteGameManager] Connection error:', error);
                resolve(false);
            }
        });
    }
    /**
     * Setup internal callbacks
     */
    setupCallbacks() {
        if (!this.mp)
            return;
        this.mp.onRoomCreated = (msg) => {
            console.log('[RemoteGameManager] Room created:', msg.roomCode);
            if (this.createRoomResolve) {
                this.createRoomResolve({
                    success: true,
                    roomCode: msg.roomCode,
                    playerNumber: 1
                });
                this.createRoomResolve = null;
            }
        };
        this.mp.onRoomJoined = (msg) => {
            console.log('[RemoteGameManager] Room joined:', msg.roomCode, 'as Player', msg.playerNumber);
            if (this.joinRoomResolve) {
                this.joinRoomResolve({
                    success: true,
                    roomCode: msg.roomCode,
                    playerNumber: msg.playerNumber
                });
                this.joinRoomResolve = null;
            }
        };
        this.mp.onPlayerJoined = (_msg) => {
            console.log('[RemoteGameManager] Player 2 joined');
            if (this.onPlayerJoined)
                this.onPlayerJoined(2);
        };
        this.mp.onGameStart = (msg) => {
            console.log('[RemoteGameManager] Game starting, seed:', msg.seed);
            if (this.onGameStart) {
                this.onGameStart(this.mp.playerNumber, msg.seed);
            }
        };
    }
    /**
     * Check if connected to server
     */
    get isConnected() {
        return this.mp?.isConnected ?? false;
    }
    /**
     * Get current room code
     */
    get roomCode() {
        return this.mp?.roomCode ?? null;
    }
    /**
     * Get player number (1 or 2)
     */
    get playerNumber() {
        const num = this.mp?.playerNumber;
        return (num === 1 || num === 2) ? num : null;
    }
    /**
     * Create a new room
     * @param gameName Optional game name (uses default if not provided)
     */
    async createRoom(gameName) {
        // Ensure connected
        if (!this.mp) {
            const connected = await this.connect(gameName || this.gameName);
            if (!connected) {
                return { success: false, error: 'Keine Verbindung zum Server' };
            }
        }
        return new Promise((resolve) => {
            this.createRoomResolve = resolve;
            // Timeout after 10 seconds
            setTimeout(() => {
                if (this.createRoomResolve) {
                    this.createRoomResolve = null;
                    resolve({ success: false, error: 'Zeitüberschreitung beim Erstellen des Raums' });
                }
            }, 10000);
            this.mp.createRoom(gameName || this.gameName);
        });
    }
    /**
     * Join an existing room
     * @param roomCode The room code to join
     */
    async joinRoom(roomCode) {
        // Validate room code
        if (!roomCode || roomCode.length < 4) {
            return { success: false, error: 'Ungültiger Room-Code' };
        }
        const normalizedCode = roomCode.toUpperCase().trim();
        // Ensure connected
        if (!this.mp) {
            const connected = await this.connect(this.gameName);
            if (!connected) {
                return { success: false, error: 'Keine Verbindung zum Server' };
            }
        }
        return new Promise((resolve) => {
            this.joinRoomResolve = resolve;
            // Setup error handler for this specific join
            const originalOnError = this.onError;
            // Timeout after 10 seconds
            setTimeout(() => {
                if (this.joinRoomResolve) {
                    this.joinRoomResolve = null;
                    this.onError = originalOnError;
                    resolve({ success: false, error: 'Room nicht gefunden oder Zeitüberschreitung' });
                }
            }, 10000);
            this.mp.joinRoom(normalizedCode);
        });
    }
    /**
     * Validate room code format
     */
    async validateRoomCode(code) {
        if (!code) {
            return { valid: false, message: 'Bitte Room-Code eingeben' };
        }
        const normalized = code.toUpperCase().trim();
        if (normalized.length < 4) {
            return { valid: false, message: 'Room-Code ist zu kurz' };
        }
        if (normalized.length > 8) {
            return { valid: false, message: 'Room-Code ist zu lang' };
        }
        if (!/^[A-Z0-9]+$/.test(normalized)) {
            return { valid: false, message: 'Room-Code darf nur Buchstaben und Zahlen enthalten' };
        }
        return { valid: true, message: 'Room-Code ist gültig' };
    }
    /**
     * Signal that player is ready
     */
    async ready() {
        if (this.mp) {
            this.mp.ready();
        }
    }
    /**
     * Leave the current room
     */
    async leaveRoom() {
        if (this.mp) {
            this.mp.disconnect();
            this.mp = null;
        }
        if (this.onConnectionChange) {
            this.onConnectionChange(false);
        }
    }
    /**
     * Get the underlying MultiplayerManager (for advanced usage)
     */
    getMultiplayerManager() {
        return this.mp;
    }
    /**
     * Register this service with the ServiceRegistry
     */
    static register() {
        const instance = new RemoteGameManager();
        serviceRegistry.register('RemoteGameManager', instance, 'Multiplayer Room Management');
    }
}
// Auto-register when module is loaded
RemoteGameManager.register();
// Export singleton for direct access
export const remoteGameManager = serviceRegistry.get('RemoteGameManager');

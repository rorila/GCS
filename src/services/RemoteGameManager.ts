import { MultiplayerManager } from '../runtime/MultiplayerManager';
import { serviceRegistry } from './ServiceRegistry';
import { Logger } from '../utils/Logger';

/**
 * Result of room operations
 */
export interface RoomResult {
    success: boolean;
    roomCode?: string;
    playerNumber?: 1 | 2;
    error?: string;
}

/**
 * RemoteGameManager - Service for multiplayer room management
 * 
 * Provides a Promise-based API for dialog bindings.
 * Wraps the lower-level MultiplayerManager with service-friendly methods.
 */
export class RemoteGameManager {
    private logger = Logger.get('RemoteGameManager', 'API_Simulation');
    private mp: MultiplayerManager | null = null;
    private gameName: string = 'default';

    // Pending promises for async operations
    private createRoomResolve: ((result: RoomResult) => void) | null = null;
    private joinRoomResolve: ((result: RoomResult) => void) | null = null;

    // Event callbacks (can be set by dialogs/components)
    public onPlayerJoined: ((playerNumber: 2) => void) | null = null;
    public onPlayerLeft: (() => void) | null = null;
    public onGameStart: ((playerNumber: 1 | 2, seed: number) => void) | null = null;
    public onError: ((message: string) => void) | null = null;
    public onConnectionChange: ((connected: boolean) => void) | null = null;

    constructor() {
        this.logger.info('Service created');
    }

    /**
     * Initialize connection to game server
     */
    public async connect(gameName: string = 'default'): Promise<boolean> {
        this.gameName = gameName;

        return new Promise((resolve) => {
            try {
                this.mp = new MultiplayerManager(gameName);

                // Wait for connection
                const checkInterval = setInterval(() => {
                    if (this.mp?.isConnected) {
                        clearInterval(checkInterval);
                        this.setupCallbacks();
                        if (this.onConnectionChange) this.onConnectionChange(true);
                        this.logger.info('Connected');
                        resolve(true);
                    }
                }, 100);

                // Timeout after 5 seconds
                setTimeout(() => {
                    clearInterval(checkInterval);
                    if (!this.mp?.isConnected) {
                        this.logger.error('Connection timeout');
                        if (this.onError) this.onError('Verbindung zum Server fehlgeschlagen');
                        resolve(false);
                    }
                }, 5000);
            } catch (error) {
                this.logger.error('Connection error:', error);
                resolve(false);
            }
        });
    }

    /**
     * Setup internal callbacks
     */
    private setupCallbacks(): void {
        if (!this.mp) return;

        this.mp.onRoomCreated = (msg) => {
            this.logger.info('Room created:', msg.roomCode);
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
            this.logger.info('Room joined:', msg.roomCode, 'as Player', msg.playerNumber);
            if (this.joinRoomResolve) {
                this.joinRoomResolve({
                    success: true,
                    roomCode: msg.roomCode,
                    playerNumber: msg.playerNumber as 1 | 2
                });
                this.joinRoomResolve = null;
            }
        };

        this.mp.onPlayerJoined = (_msg) => {
            this.logger.info('Player 2 joined');
            if (this.onPlayerJoined) this.onPlayerJoined(2);
        };

        this.mp.onGameStart = (msg) => {
            this.logger.info('Game starting, seed:', msg.seed);
            if (this.onGameStart) {
                this.onGameStart(this.mp!.playerNumber as 1 | 2, msg.seed);
            }
        };
    }

    /**
     * Check if connected to server
     */
    public get isConnected(): boolean {
        return this.mp?.isConnected ?? false;
    }

    /**
     * Get current room code
     */
    public get roomCode(): string | null {
        return this.mp?.roomCode ?? null;
    }

    /**
     * Get player number (1 or 2)
     */
    public get playerNumber(): 1 | 2 | null {
        const num = this.mp?.playerNumber;
        return (num === 1 || num === 2) ? num : null;
    }

    /**
     * Create a new room
     * @param gameName Optional game name (uses default if not provided)
     */
    public async createRoom(gameName?: string): Promise<RoomResult> {
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

            this.mp!.createRoom(gameName || this.gameName);
        });
    }

    /**
     * Join an existing room
     * @param roomCode The room code to join
     */
    public async joinRoom(roomCode: string): Promise<RoomResult> {
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

            this.mp!.joinRoom(normalizedCode);
        });
    }

    /**
     * Validate room code format
     */
    public async validateRoomCode(code: string): Promise<{ valid: boolean; message: string }> {
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
    public async ready(): Promise<void> {
        if (this.mp) {
            this.mp.ready();
        }
    }

    /**
     * Leave the current room
     */
    public async leaveRoom(): Promise<void> {
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
    public getMultiplayerManager(): MultiplayerManager | null {
        return this.mp;
    }

    /**
     * Register this service with the ServiceRegistry
     */
    public static register(): void {
        const instance = new RemoteGameManager();
        serviceRegistry.register('RemoteGameManager', instance, 'Multiplayer Room Management');
    }
}

// Auto-register when module is loaded
RemoteGameManager.register();

// Export singleton for direct access
export const remoteGameManager = serviceRegistry.get<RemoteGameManager>('RemoteGameManager')!;

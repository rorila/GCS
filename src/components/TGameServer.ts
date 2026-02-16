import { TPropertyDef, IRuntimeComponent } from './TComponent';
import { TWindow } from './TWindow';
import { network } from '../multiplayer';

/**
 * TGameServer - A stage-placeable component that manages multiplayer server connection.
 * Place on stage, configure in Inspector, and use events to trigger Tasks.
 */
export class TGameServer extends TWindow implements IRuntimeComponent {
    // Connection settings
    public serverUrl: string = 'ws://localhost:8080';
    public autoConnect: boolean = false;

    // Runtime state (not persisted)
    private _connected: boolean = false;
    private _roomCode: string = '';
    private _playerNumber: 1 | 2 | null = null;
    private _isHost: boolean = false;
    private _lastError: string = '';

    // Event callback (set by Editor at runtime)
    private eventCallback: ((eventName: string, data?: any) => void) | null = null;

    constructor(name: string, x: number = 0, y: number = 0) {
        super(name, x, y, 3, 1);

        // Visual style - purple like multiplayer theme
        this.style.backgroundColor = '#673ab7';
        this.style.borderColor = '#512da8';
        this.style.borderWidth = 2;
        this.style.color = '#ffffff';

        // Visibility & Scoping Meta-Flags
        this.isService = true;
        this.isHiddenInRun = true;
    }

    // Getters for runtime state
    get connected(): boolean { return this._connected; }
    get roomCode(): string { return this._roomCode; }
    get playerNumber(): 1 | 2 | null { return this._playerNumber; }
    get isHost(): boolean { return this._isHost; }
    get lastError(): string { return this._lastError; }

    public getInspectorProperties(): TPropertyDef[] {
        return [
            ...super.getInspectorProperties(),
            { name: 'serverUrl', label: 'Server URL', type: 'string', group: 'Server' },
            { name: 'autoConnect', label: 'Auto Connect', type: 'boolean', group: 'Server' }
        ];
    }

    public toJSON(): any {
        return super.toJSON();
    }

    public initRuntime(callbacks: { handleEvent: any }): void {
        this.eventCallback = (ev: string, data?: any) => callbacks.handleEvent(this.id, ev, data);
    }

    public onRuntimeStart(): void {
        if (this.autoConnect) {
            this.connect();
        }
    }

    public onRuntimeStop(): void {
        this.stop();
    }

    /**
     * Set the event callback for triggering tasks
     */
    public setEventCallback(callback: (eventName: string, data?: any) => void): void {
        this.eventCallback = callback;
    }

    /**
     * Connect to the game server
     */
    public async connect(): Promise<void> {
        try {
            // Configure server URL before connecting
            (network as any).serverUrl = this.serverUrl;

            await network.connect();
            this._connected = true;
            this.triggerEvent('onConnected');
        } catch (error: any) {
            this._lastError = error.message || 'Connection failed';
            this.triggerEvent('onError', { message: this._lastError });
        }
    }

    /**
     * Disconnect from the server
     */
    public disconnect(): void {
        network.disconnect();
        this._connected = false;
        this._roomCode = '';
        this._playerNumber = null;
        this._isHost = false;
        this.triggerEvent('onDisconnected');
    }

    /**
     * Create a new game room
     */
    public createRoom(): void {
        if (!this._connected) {
            console.warn('[TGameServer] Not connected - cannot create room');
            return;
        }

        this._isHost = true;
        network.createRoom();

        // Listen for room creation response
        this.setupNetworkListeners();
    }

    /**
     * Join an existing room
     */
    public joinRoom(roomCode: string): void {
        if (!this._connected) {
            console.warn('[TGameServer] Not connected - cannot join room');
            return;
        }

        this._isHost = false;
        network.joinRoom(roomCode);

        // Listen for join response
        this.setupNetworkListeners();
    }

    /**
     * Signal that player is ready
     */
    public ready(): void {
        if (!this._connected || !this._roomCode) {
            console.warn('[TGameServer] Not in a room - cannot signal ready');
            return;
        }

        network.ready();
    }

    /**
     * Setup network event listeners
     */
    private setupNetworkListeners(): void {
        network.on((msg: any) => {
            switch (msg.type) {
                case 'room_created':
                    this._roomCode = msg.roomCode;
                    this._playerNumber = 1;
                    this.triggerEvent('onRoomCreated', { roomCode: msg.roomCode });
                    break;

                case 'room_joined':
                    this._roomCode = msg.roomCode;
                    this._playerNumber = msg.playerNumber;
                    this.triggerEvent('onRoomJoined', { roomCode: msg.roomCode, playerNumber: msg.playerNumber });
                    break;

                case 'player_joined':
                    this.triggerEvent('onPlayerJoined', { playerNumber: msg.playerNumber });
                    break;

                case 'player_left':
                    this.triggerEvent('onPlayerLeft', { playerNumber: msg.playerNumber });
                    break;

                case 'game_start':
                    this._playerNumber = msg.yourPlayer;
                    this.triggerEvent('onGameStart', { playerNumber: msg.yourPlayer, seed: msg.seed });
                    break;

                case 'error':
                    this._lastError = msg.message;
                    this.triggerEvent('onError', { message: msg.message });
                    break;
            }
        });
    }

    /**
     * Trigger an event (calls the event callback)
     */
    private triggerEvent(eventName: string, data?: any): void {
        console.log(`[TGameServer] Event: ${eventName}`, data);
        if (this.eventCallback) {
            this.eventCallback(eventName, data);
        }
    }

    /**
     * Start (called when game runs) - auto-connect if enabled
     */
    public start(callback: (eventName: string, data?: any) => void): void {
        this.eventCallback = callback;

        if (this.autoConnect) {
            this.connect();
        }
    }

    /**
     * Stop (called when game stops)
     */
    public stop(): void {
        if (this._connected) {
            this.disconnect();
        }
        this.eventCallback = null;
    }
}

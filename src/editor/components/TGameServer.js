import { TWindow } from './TWindow';
import { network } from '../multiplayer';
/**
 * TGameServer - A stage-placeable component that manages multiplayer server connection.
 * Place on stage, configure in Inspector, and use events to trigger Tasks.
 */
export class TGameServer extends TWindow {
    constructor(name, x = 0, y = 0) {
        super(name, x, y, 3, 1);
        // Connection settings
        this.serverUrl = 'ws://localhost:8080';
        this.autoConnect = false;
        // Runtime state (not persisted)
        this._connected = false;
        this._roomCode = '';
        this._playerNumber = null;
        this._isHost = false;
        this._lastError = '';
        // Event callback (set by Editor at runtime)
        this.eventCallback = null;
        // Visual style - purple like multiplayer theme
        this.style.backgroundColor = '#673ab7';
        this.style.borderColor = '#512da8';
        this.style.borderWidth = 2;
        this.style.color = '#ffffff';
    }
    // Getters for runtime state
    get connected() { return this._connected; }
    get roomCode() { return this._roomCode; }
    get playerNumber() { return this._playerNumber; }
    get isHost() { return this._isHost; }
    get lastError() { return this._lastError; }
    getInspectorProperties() {
        return [
            ...super.getInspectorProperties(),
            { name: 'serverUrl', label: 'Server URL', type: 'string', group: 'Server' },
            { name: 'autoConnect', label: 'Auto Connect', type: 'boolean', group: 'Server' }
        ];
    }
    toJSON() {
        return super.toJSON();
    }
    initRuntime(callbacks) {
        this.eventCallback = (ev, data) => callbacks.handleEvent(this.id, ev, data);
    }
    onRuntimeStart() {
        if (this.autoConnect) {
            this.connect();
        }
    }
    onRuntimeStop() {
        this.stop();
    }
    /**
     * Set the event callback for triggering tasks
     */
    setEventCallback(callback) {
        this.eventCallback = callback;
    }
    /**
     * Connect to the game server
     */
    async connect() {
        try {
            // Configure server URL before connecting
            network.serverUrl = this.serverUrl;
            await network.connect();
            this._connected = true;
            this.triggerEvent('onConnected');
        }
        catch (error) {
            this._lastError = error.message || 'Connection failed';
            this.triggerEvent('onError', { message: this._lastError });
        }
    }
    /**
     * Disconnect from the server
     */
    disconnect() {
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
    createRoom() {
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
    joinRoom(roomCode) {
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
    ready() {
        if (!this._connected || !this._roomCode) {
            console.warn('[TGameServer] Not in a room - cannot signal ready');
            return;
        }
        network.ready();
    }
    /**
     * Setup network event listeners
     */
    setupNetworkListeners() {
        network.on((msg) => {
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
    triggerEvent(eventName, data) {
        console.log(`[TGameServer] Event: ${eventName}`, data);
        if (this.eventCallback) {
            this.eventCallback(eventName, data);
        }
    }
    /**
     * Start (called when game runs) - auto-connect if enabled
     */
    start(callback) {
        this.eventCallback = callback;
        if (this.autoConnect) {
            this.connect();
        }
    }
    /**
     * Stop (called when game stops)
     */
    stop() {
        if (this._connected) {
            this.disconnect();
        }
        this.eventCallback = null;
    }
}

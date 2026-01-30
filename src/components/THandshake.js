import { TWindow } from './TWindow';
/**
 * THandshake Component
 *
 * Manages the connection handshake in multiplayer mode.
 * Only active when isMultiplayer = true.
 *
 * Events:
 * - onConnected: WebSocket connection established
 * - onRoomCreated: Host has created a room
 * - onRoomJoined: Client has joined a room
 * - onPeerJoined: Other player has joined
 * - onPeerReady: Other player is ready
 * - onGameStart: Both players ready, game starts
 * - onVersionMismatch: Protocol versions incompatible
 */
export class THandshake extends TWindow {
    constructor(name, x, y) {
        super(name, x, y, 4, 1);
        this.className = 'THandshake';
        // Status properties (readonly at runtime)
        this.protocolVersion = '1.0';
        this.peerVersion = '';
        this.isHost = false;
        this.playerNumber = 0;
        this.roomCode = '';
        this.status = 'disconnected';
        this.enabled = true; // Whether handshake is active
        // Event callback (set by GameRuntime)
        this.onEvent = null;
        this.style.backgroundColor = '#5c6bc0'; // Indigo
        this.style.borderColor = '#3949ab';
        this.style.borderWidth = 2;
    }
    getInspectorProperties() {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'protocolVersion', label: 'Protokoll-Version', type: 'string', group: 'Handshake', readonly: true },
            { name: 'enabled', label: 'Aktiviert', type: 'boolean', group: 'Handshake' },
            { name: 'status', label: 'Status', type: 'string', group: 'Handshake', readonly: true },
            { name: 'roomCode', label: 'Raum-Code', type: 'string', group: 'Handshake', readonly: true },
            { name: 'playerNumber', label: 'Spieler-Nr.', type: 'number', group: 'Handshake', readonly: true },
            { name: 'isHost', label: 'Ist Host', type: 'boolean', group: 'Handshake', readonly: true }
        ];
    }
    getEvents() {
        return [
            ...super.getEvents(),
            'onConnected',
            'onRoomCreated',
            'onRoomJoined',
            'onPeerJoined',
            'onPeerReady',
            'onGameStart',
            'onPeerLeft',
            'onVersionMismatch'
        ];
    }
    toJSON() {
        return {
            ...super.toJSON(),
            protocolVersion: this.protocolVersion,
            peerVersion: this.peerVersion,
            isHost: this.isHost,
            playerNumber: this.playerNumber,
            roomCode: this.roomCode,
            status: this.status,
            enabled: this.enabled
        };
    }
    // ─────────────────────────────────────────────
    // Methods callable via call_method action
    // ─────────────────────────────────────────────
    /**
     * Create a new room (Host)
     */
    createRoom() {
        console.log(`[THandshake] ${this.name}: createRoom() called`);
        if (this.onEvent) {
            this.onEvent('_createRoom');
        }
    }
    /**
     * Join an existing room with a code
     */
    joinRoom(code) {
        console.log(`[THandshake] ${this.name}: joinRoom(${code}) called`);
        if (this.onEvent) {
            this.onEvent('_joinRoom', { code });
        }
    }
    /**
     * Signal ready status
     */
    ready() {
        console.log(`[THandshake] ${this.name}: ready() called`);
        if (this.onEvent) {
            this.onEvent('_ready');
        }
    }
    // ─────────────────────────────────────────────
    // Internal methods (called by MultiplayerManager)
    // ─────────────────────────────────────────────
    _fireEvent(eventName, data) {
        if (this.onEvent) {
            this.onEvent(eventName, data);
        }
    }
    _setStatus(newStatus) {
        this.status = newStatus;
    }
    _setRoomInfo(roomCode, playerNumber, isHost) {
        this.roomCode = roomCode;
        this.playerNumber = playerNumber;
        this.isHost = isHost;
    }
    _setPeerVersion(version) {
        this.peerVersion = version;
    }
}

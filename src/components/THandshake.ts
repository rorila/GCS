import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';
import { Logger } from '../utils/Logger';

const logger = Logger.get('THandshake');

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
    public className: string = 'THandshake';

    // Status properties (readonly at runtime)
    public protocolVersion: string = '1.0';
    public peerVersion: string = '';
    public isHost: boolean = false;
    public playerNumber: number = 0;
    public roomCode: string = '';
    public status: 'disconnected' | 'connecting' | 'waiting' | 'ready' | 'playing' = 'disconnected';
    public enabled: boolean = true;  // Whether handshake is active

    // Event callback (set by GameRuntime)
    public onEvent: ((eventName: string, data?: any) => void) | null = null;

    constructor(name: string, x: number, y: number) {
        super(name, x, y, 4, 2);
        this.style.backgroundColor = '#5c6bc0';  // Indigo
        this.style.borderColor = '#3949ab';
        this.style.borderWidth = 2;

        // Visibility & Scoping Meta-Flags
        this.isService = true;
        this.isHiddenInRun = true;
    }

    public getInspectorProperties(): TPropertyDef[] {
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

    public getEvents(): string[] {
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

    public toDTO(): any {
        return {
            ...super.toDTO(),
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
    public createRoom(): void {
        logger.info(`[THandshake] ${this.name}: createRoom() called`);
        if (this.onEvent) {
            this.onEvent('_createRoom');
        }
    }

    /**
     * Join an existing room with a code
     */
    public joinRoom(code: string): void {
        logger.info(`[THandshake] ${this.name}: joinRoom(${code}) called`);
        if (this.onEvent) {
            this.onEvent('_joinRoom', { code });
        }
    }

    /**
     * Signal ready status
     */
    public ready(): void {
        logger.info(`[THandshake] ${this.name}: ready() called`);
        if (this.onEvent) {
            this.onEvent('_ready');
        }
    }

    // ─────────────────────────────────────────────
    // Internal methods (called by MultiplayerManager)
    // ─────────────────────────────────────────────

    public _fireEvent(eventName: string, data?: any): void {
        if (this.onEvent) {
            this.onEvent(eventName, data);
        }
    }

    public _setStatus(newStatus: typeof this.status): void {
        this.status = newStatus;
    }

    public _setRoomInfo(roomCode: string, playerNumber: number, isHost: boolean): void {
        this.roomCode = roomCode;
        this.playerNumber = playerNumber;
        this.isHost = isHost;
    }

    public _setPeerVersion(version: string): void {
        this.peerVersion = version;
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('THandshake', (objData: any) => new THandshake(objData.name, objData.x, objData.y));

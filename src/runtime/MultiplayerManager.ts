import { ClientMessage, ServerMessage } from '../../game-server/src/Protocol';
import { Logger } from '../utils/Logger';

export class MultiplayerManager {
    private static logger = Logger.get('MultiplayerManager', 'Remote_Game_Sync');
    public gameName: string;
    private ws: WebSocket | null = null;
    public roomCode: string | null = null;
    public playerNumber: number = 0;
    public isHost: boolean = false;  // true wenn playerNumber === 1
    public isConnected: boolean = false;

    public onRemoteState: ((msg: any) => void) | null = null;
    public onRemoteInput: ((msg: any) => void) | null = null;
    public onRemoteTask: ((msg: any) => void) | null = null;  // triggerMode remote execution
    public onRoomCreated: ((msg: any) => void) | null = null;
    public onRoomJoined: ((msg: any) => void) | null = null;
    public onPlayerJoined: ((msg: any) => void) | null = null;
    public onPlayerTimeout: ((msg: any) => void) | null = null;  // Heartbeat timeout
    public onPong: ((latency: number, serverTime: number) => void) | null = null;  // Pong received

    private msgQueue: ClientMessage[] = [];
    private gameStartMsg: any = null;
    private onGameStartCallback: ((msg: any) => void) | null = null;

    // Heartbeat state
    private heartbeatTimer: number | null = null;
    private lastPingTime: number = 0;
    private missedPongs: number = 0;
    public pingInterval: number = 5000;  // configurable
    public timeoutThreshold: number = 3;  // configurable

    constructor(gameName: string) {
        this.gameName = gameName;
        this.connect();
    }

    private connect() {
        // Use the same host but switch to WS protocol
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        let host = window.location.hostname + (window.location.port ? `:${window.location.port}` : '');

        // If we are on Vite dev server (5173), point WS to backend (8080)
        if (window.location.port === '5173') {
            host = window.location.hostname + ':8080';
        }

        const wsUrl = `${protocol}//${host}`;

        MultiplayerManager.logger.info(`Connecting to ${wsUrl}`);
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            MultiplayerManager.logger.info('Connected');
            this.isConnected = true;
            while (this.msgQueue.length > 0) {
                const msg = this.msgQueue.shift();
                if (msg) this.send(msg);
            }
        };

        this.ws.onclose = () => {
            MultiplayerManager.logger.info('Disconnected');
            this.isConnected = false;
        };

        this.ws.onerror = (err) => {
            MultiplayerManager.logger.error('Error:', err);
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data) as ServerMessage;
                this.handleMessage(msg);
            } catch (e) {
                MultiplayerManager.logger.error('Invalid message:', e);
            }
        };
    }

    public disconnect() {
        this.stopHeartbeat();  // Stop heartbeat on disconnect
        if (this.ws) {
            MultiplayerManager.logger.info('Manually disconnecting');
            this.ws.onclose = null;
            this.ws.onerror = null;
            this.ws.onmessage = null;
            this.ws.onopen = null;
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
    }

    public createRoom(gameName?: string) {
        this.gameStartMsg = null;
        const finalGameName = gameName || this.gameName;
        MultiplayerManager.logger.info(`createRoom request for: ${finalGameName}`);
        this.send({ type: 'create_room', gameName: finalGameName });
    }

    public joinRoom(code: string) {
        this.gameStartMsg = null;
        this.send({ type: 'join_room', roomCode: code });
    }

    public rejoinRoom(code: string, playerNumber: 1 | 2) {
        MultiplayerManager.logger.info(`Rejoining room ${code} as Player ${playerNumber}`);
        this.send({ type: 'rejoin_room', roomCode: code, playerNumber } as any);
    }

    public ready() {
        MultiplayerManager.logger.info('Sending ready');
        this.send({ type: 'ready' });
    }

    public set onGameStart(callback: ((msg: any) => void) | null) {
        this.onGameStartCallback = callback;
        if (callback && this.gameStartMsg) {
            MultiplayerManager.logger.info('Delivering buffered game_start to new handler');
            setTimeout(() => {
                if (this.onGameStartCallback === callback) {
                    callback(this.gameStartMsg);
                }
            }, 100);
        }
    }

    public get onGameStart() {
        return this.onGameStartCallback;
    }

    public send(msg: ClientMessage) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            // Reduce log spam: console.log('[MP] Sending:', msg.type, msg);
            this.ws.send(JSON.stringify(msg));
        } else {
            MultiplayerManager.logger.debug(`Queueing message (not connected yet): ${msg.type}`);
            this.msgQueue.push(msg);
        }
    }

    public sendStateSync(objectId: string, state: { x?: number, y?: number, vx?: number, vy?: number, text?: string | number, value?: number }) {
        this.send({
            type: 'state_sync',
            objectId: objectId,
            state: {
                x: state.x,
                y: state.y,
                vx: state.vx,
                vy: state.vy,
                text: state.text,
                value: state.value
            }
        });
    }

    public sendInput(key: string, action: 'down' | 'up') {
        MultiplayerManager.logger.debug(`Sending input: ${key} ${action}`);
        this.send({
            type: 'input',
            key: key,
            action: action
        });
    }

    /**
     * Send trigger_task for triggerMode: broadcast
     * Non-host sends to host who will execute and sync
     */
    public sendTriggerTask(taskName: string, params?: any) {
        MultiplayerManager.logger.info(`Sending trigger_task: ${taskName}`);
        this.send({ type: 'trigger_task', taskName, params } as any);
    }

    /**
     * Send sync_task for triggerMode: local-sync
     * After local execution, sync to other player
     */
    public sendSyncTask(taskName: string, params?: any) {
        MultiplayerManager.logger.info(`Sending sync_task: ${taskName}`);
        this.send({ type: 'sync_task', taskName, params } as any);
    }

    // ─────────────────────────────────────────────
    // Heartbeat Methods
    // ─────────────────────────────────────────────

    /**
     * Start heartbeat timer - sends ping every pingInterval ms
     */
    public startHeartbeat(): void {
        this.stopHeartbeat();
        this.missedPongs = 0;

        MultiplayerManager.logger.info(`Starting heartbeat (interval: ${this.pingInterval}ms)`);

        this.heartbeatTimer = window.setInterval(() => {
            this.sendPing();
        }, this.pingInterval);
    }

    /**
     * Stop heartbeat timer
     */
    public stopHeartbeat(): void {
        if (this.heartbeatTimer !== null) {
            window.clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    /**
     * Send a ping message to the server
     */
    public sendPing(): void {
        this.lastPingTime = Date.now();
        this.missedPongs++;

        if (this.missedPongs > this.timeoutThreshold) {
            MultiplayerManager.logger.warn(`Heartbeat timeout! ${this.missedPongs} pings without response.`);
            if (this.onPlayerTimeout) {
                this.onPlayerTimeout({ playerNumber: 0, reason: 'heartbeat' });
            }
        }

        this.send({ type: 'ping', timestamp: this.lastPingTime });
    }

    /**
     * Handle pong response from server
     */
    private handlePong(timestamp: number, serverTime: number): void {
        const latency = Date.now() - timestamp;
        this.missedPongs = 0;  // Reset missed pongs

        if (this.onPong) {
            this.onPong(latency, serverTime);
        }
    }

    private handleMessage(msg: ServerMessage) {
        // Reduce log spam: console.log('[MP] Received:', msg.type, msg);

        switch (msg.type) {
            case 'room_created':
                this.roomCode = msg.roomCode;
                this.playerNumber = 1;
                this.isHost = true;
                if (this.onRoomCreated) this.onRoomCreated(msg);
                break;

            case 'room_joined':
                // Check if this is a rejoin (we already had a room code)
                const isRejoin = this.roomCode !== null && this.roomCode === msg.roomCode;

                this.roomCode = msg.roomCode;
                this.playerNumber = msg.playerNumber;
                this.isHost = msg.playerNumber === 1;
                if (this.onRoomJoined) this.onRoomJoined(msg);

                // Auto-ready for initial join, but NOT for rejoin
                // Rejoin ready is handled by player-standalone.ts after game init
                if (!isRejoin) {
                    this.ready();
                }
                break;

            case 'player_joined':
                if (this.onPlayerJoined) this.onPlayerJoined(msg);
                this.ready();
                break;

            case 'game_start':
                MultiplayerManager.logger.info(`Game starting! Player: ${this.playerNumber}, Seed: ${msg.seed}`);
                this.gameStartMsg = msg;
                this.startHeartbeat();  // Start heartbeat on game start
                if (this.onGameStartCallback) this.onGameStartCallback(msg);
                break;

            case 'remote_state':
                if (this.onRemoteState) this.onRemoteState(msg);
                break;

            case 'remote_input':
                if (this.onRemoteInput) this.onRemoteInput(msg);
                break;

            case 'remote_task':
                MultiplayerManager.logger.info(`Remote task received: ${(msg as any).taskName} (mode: ${(msg as any).mode})`);
                if (this.onRemoteTask) this.onRemoteTask(msg);
                break;

            case 'player_left':
                MultiplayerManager.logger.info('Player left');
                alert('Gegner hat das Spiel verlassen!');
                window.location.href = '/';
                break;

            case 'error':
                alert('Fehler: ' + msg.message);
                break;

            case 'pong':
                this.handlePong((msg as any).timestamp, (msg as any).serverTime);
                break;

            case 'player_timeout':
                MultiplayerManager.logger.warn(`Player ${(msg as any).playerNumber} timeout (${(msg as any).reason})`);
                this.stopHeartbeat();
                if (this.onPlayerTimeout) this.onPlayerTimeout(msg);
                break;
        }
    }
}

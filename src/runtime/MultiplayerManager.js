export class MultiplayerManager {
    constructor(gameName) {
        this.ws = null;
        this.roomCode = null;
        this.playerNumber = 0;
        this.isHost = false; // true wenn playerNumber === 1
        this.isConnected = false;
        this.onRemoteState = null;
        this.onRemoteInput = null;
        this.onRemoteTask = null; // triggerMode remote execution
        this.onRoomCreated = null;
        this.onRoomJoined = null;
        this.onPlayerJoined = null;
        this.onPlayerTimeout = null; // Heartbeat timeout
        this.onPong = null; // Pong received
        this.msgQueue = [];
        this.gameStartMsg = null;
        this.onGameStartCallback = null;
        // Heartbeat state
        this.heartbeatTimer = null;
        this.lastPingTime = 0;
        this.missedPongs = 0;
        this.pingInterval = 5000; // configurable
        this.timeoutThreshold = 3; // configurable
        this.gameName = gameName;
        this.connect();
    }
    connect() {
        // Use the same host but switch to WS protocol
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        let host = window.location.hostname + (window.location.port ? `:${window.location.port}` : '');
        // If we are on Vite dev server (5173), point WS to backend (8080)
        if (window.location.port === '5173') {
            host = window.location.hostname + ':8080';
        }
        const wsUrl = `${protocol}//${host}`;
        console.log('[MP] Connecting to', wsUrl);
        this.ws = new WebSocket(wsUrl);
        this.ws.onopen = () => {
            console.log('[MP] Connected');
            this.isConnected = true;
            while (this.msgQueue.length > 0) {
                const msg = this.msgQueue.shift();
                if (msg)
                    this.send(msg);
            }
        };
        this.ws.onclose = () => {
            console.log('[MP] Disconnected');
            this.isConnected = false;
        };
        this.ws.onerror = (err) => {
            console.error('[MP] Error:', err);
        };
        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                this.handleMessage(msg);
            }
            catch (e) {
                console.error('[MP] Invalid message:', e);
            }
        };
    }
    disconnect() {
        this.stopHeartbeat(); // Stop heartbeat on disconnect
        if (this.ws) {
            console.log('[MP] Manually disconnecting');
            this.ws.onclose = null;
            this.ws.onerror = null;
            this.ws.onmessage = null;
            this.ws.onopen = null;
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
    }
    createRoom(gameName) {
        this.gameStartMsg = null;
        const finalGameName = gameName || this.gameName;
        console.log(`[MP] createRoom request for: ${finalGameName}`);
        this.send({ type: 'create_room', gameName: finalGameName });
    }
    joinRoom(code) {
        this.gameStartMsg = null;
        this.send({ type: 'join_room', roomCode: code });
    }
    rejoinRoom(code, playerNumber) {
        console.log(`[MP] Rejoining room ${code} as Player ${playerNumber}`);
        this.send({ type: 'rejoin_room', roomCode: code, playerNumber });
    }
    ready() {
        console.log('[MP] Sending ready');
        this.send({ type: 'ready' });
    }
    set onGameStart(callback) {
        this.onGameStartCallback = callback;
        if (callback && this.gameStartMsg) {
            console.log('[MP] Delivering buffered game_start to new handler');
            setTimeout(() => {
                if (this.onGameStartCallback === callback) {
                    callback(this.gameStartMsg);
                }
            }, 100);
        }
    }
    get onGameStart() {
        return this.onGameStartCallback;
    }
    send(msg) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            // Reduce log spam: console.log('[MP] Sending:', msg.type, msg);
            this.ws.send(JSON.stringify(msg));
        }
        else {
            console.log('[MP] Queueing message (not connected yet):', msg.type);
            this.msgQueue.push(msg);
        }
    }
    sendStateSync(objectId, state) {
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
    sendInput(key, action) {
        console.log('[MP] Sending input:', key, action);
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
    sendTriggerTask(taskName, params) {
        console.log(`[MP] Sending trigger_task: ${taskName}`);
        this.send({ type: 'trigger_task', taskName, params });
    }
    /**
     * Send sync_task for triggerMode: local-sync
     * After local execution, sync to other player
     */
    sendSyncTask(taskName, params) {
        console.log(`[MP] Sending sync_task: ${taskName}`);
        this.send({ type: 'sync_task', taskName, params });
    }
    // ─────────────────────────────────────────────
    // Heartbeat Methods
    // ─────────────────────────────────────────────
    /**
     * Start heartbeat timer - sends ping every pingInterval ms
     */
    startHeartbeat() {
        this.stopHeartbeat();
        this.missedPongs = 0;
        console.log(`[MP] Starting heartbeat (interval: ${this.pingInterval}ms)`);
        this.heartbeatTimer = window.setInterval(() => {
            this.sendPing();
        }, this.pingInterval);
    }
    /**
     * Stop heartbeat timer
     */
    stopHeartbeat() {
        if (this.heartbeatTimer !== null) {
            window.clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }
    /**
     * Send a ping message to the server
     */
    sendPing() {
        this.lastPingTime = Date.now();
        this.missedPongs++;
        if (this.missedPongs > this.timeoutThreshold) {
            console.warn(`[MP] Heartbeat timeout! ${this.missedPongs} pings without response.`);
            if (this.onPlayerTimeout) {
                this.onPlayerTimeout({ playerNumber: 0, reason: 'heartbeat' });
            }
        }
        this.send({ type: 'ping', timestamp: this.lastPingTime });
    }
    /**
     * Handle pong response from server
     */
    handlePong(timestamp, serverTime) {
        const latency = Date.now() - timestamp;
        this.missedPongs = 0; // Reset missed pongs
        if (this.onPong) {
            this.onPong(latency, serverTime);
        }
    }
    handleMessage(msg) {
        // Reduce log spam: console.log('[MP] Received:', msg.type, msg);
        switch (msg.type) {
            case 'room_created':
                this.roomCode = msg.roomCode;
                this.playerNumber = 1;
                this.isHost = true;
                if (this.onRoomCreated)
                    this.onRoomCreated(msg);
                break;
            case 'room_joined':
                // Check if this is a rejoin (we already had a room code)
                const isRejoin = this.roomCode !== null && this.roomCode === msg.roomCode;
                this.roomCode = msg.roomCode;
                this.playerNumber = msg.playerNumber;
                this.isHost = msg.playerNumber === 1;
                if (this.onRoomJoined)
                    this.onRoomJoined(msg);
                // Auto-ready for initial join, but NOT for rejoin
                // Rejoin ready is handled by player-standalone.ts after game init
                if (!isRejoin) {
                    this.ready();
                }
                break;
            case 'player_joined':
                if (this.onPlayerJoined)
                    this.onPlayerJoined(msg);
                this.ready();
                break;
            case 'game_start':
                console.log('[MP] Game starting! Player:', this.playerNumber, 'Seed:', msg.seed);
                this.gameStartMsg = msg;
                this.startHeartbeat(); // Start heartbeat on game start
                if (this.onGameStartCallback)
                    this.onGameStartCallback(msg);
                break;
            case 'remote_state':
                if (this.onRemoteState)
                    this.onRemoteState(msg);
                break;
            case 'remote_input':
                if (this.onRemoteInput)
                    this.onRemoteInput(msg);
                break;
            case 'remote_task':
                console.log(`[MP] Remote task received: ${msg.taskName} (mode: ${msg.mode})`);
                if (this.onRemoteTask)
                    this.onRemoteTask(msg);
                break;
            case 'player_left':
                console.log('[MP] Player left');
                alert('Gegner hat das Spiel verlassen!');
                window.location.href = '/';
                break;
            case 'error':
                alert('Fehler: ' + msg.message);
                break;
            case 'pong':
                this.handlePong(msg.timestamp, msg.serverTime);
                break;
            case 'player_timeout':
                console.log(`[MP] Player ${msg.playerNumber} timeout (${msg.reason})`);
                this.stopHeartbeat();
                if (this.onPlayerTimeout)
                    this.onPlayerTimeout(msg);
                break;
        }
    }
}

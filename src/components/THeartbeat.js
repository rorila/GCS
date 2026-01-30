import { TWindow } from './TWindow';
/**
 * THeartbeat Component
 *
 * Monitors connection quality during multiplayer games.
 * Starts automatically after game_start.
 *
 * Events:
 * - onPing: Ping was sent
 * - onPong: Pong was received
 * - onLatencyWarning: Latency above threshold (500ms)
 * - onMissedPong: A pong was missed
 * - onPeerTimeout: Other player not responding
 * - onReconnecting: Connection is being restored
 * - onReconnected: Connection was restored
 * - onConnectionLost: Own connection lost
 */
export class THeartbeat extends TWindow {
    constructor(name, x, y) {
        super(name, x, y, 4, 1);
        this.className = 'THeartbeat';
        // Configuration
        this.pingInterval = 5000; // in milliseconds
        this.timeoutThreshold = 3; // max missed pongs
        this.latencyWarningThreshold = 500; // ms
        this.enabled = true;
        // Status (readonly at runtime)
        this.latency = 0;
        this.missedPongs = 0;
        this.status = 'inactive';
        // Internal timer
        this.pingTimer = null;
        this.lastPingTime = 0;
        // Event callback (set by GameRuntime)
        this.onEvent = null;
        this.style.backgroundColor = '#e91e63'; // Pink
        this.style.borderColor = '#c2185b';
        this.style.borderWidth = 2;
    }
    getInspectorProperties() {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'pingInterval', label: 'Ping-Intervall (ms)', type: 'number', group: 'Heartbeat' },
            { name: 'timeoutThreshold', label: 'Max. verpasste Pongs', type: 'number', group: 'Heartbeat' },
            { name: 'latencyWarningThreshold', label: 'Latenz-Warnung (ms)', type: 'number', group: 'Heartbeat' },
            { name: 'enabled', label: 'Aktiviert', type: 'boolean', group: 'Heartbeat' },
            { name: 'latency', label: 'Aktuelle Latenz', type: 'number', group: 'Status', readonly: true },
            { name: 'missedPongs', label: 'Verpasste Pongs', type: 'number', group: 'Status', readonly: true },
            { name: 'status', label: 'Status', type: 'string', group: 'Status', readonly: true }
        ];
    }
    getEvents() {
        return [
            ...super.getEvents(),
            'onPing',
            'onPong',
            'onLatencyWarning',
            'onMissedPong',
            'onPeerTimeout',
            'onReconnecting',
            'onReconnected',
            'onConnectionLost'
        ];
    }
    toJSON() {
        return {
            ...super.toJSON(),
            pingInterval: this.pingInterval,
            timeoutThreshold: this.timeoutThreshold,
            latencyWarningThreshold: this.latencyWarningThreshold,
            enabled: this.enabled,
            latency: this.latency,
            missedPongs: this.missedPongs,
            status: this.status
        };
    }
    // ─────────────────────────────────────────────
    // Methods callable via call_method action
    // ─────────────────────────────────────────────
    /**
     * Start heartbeat manually
     */
    start() {
        console.log(`[THeartbeat] ${this.name}: start() called`);
        if (this.onEvent) {
            this.onEvent('_start');
        }
    }
    /**
     * Stop heartbeat
     */
    stop() {
        console.log(`[THeartbeat] ${this.name}: stop() called`);
        this._stopTimer();
        this.status = 'inactive';
        if (this.onEvent) {
            this.onEvent('_stop');
        }
    }
    /**
     * Send immediate ping
     */
    forcePing() {
        console.log(`[THeartbeat] ${this.name}: forcePing() called`);
        if (this.onEvent) {
            this.onEvent('_forcePing');
        }
    }
    // ─────────────────────────────────────────────
    // Internal methods (called by MultiplayerManager)
    // ─────────────────────────────────────────────
    _startTimer(sendPingFn) {
        this._stopTimer();
        this.status = 'healthy';
        this.missedPongs = 0;
        if (!this.enabled)
            return;
        this.pingTimer = window.setInterval(() => {
            this.lastPingTime = Date.now();
            this.missedPongs++;
            // Fire onPing event
            this._fireEvent('onPing', { timestamp: this.lastPingTime });
            // Check timeout
            if (this.missedPongs >= this.timeoutThreshold) {
                this.status = 'critical';
                this._fireEvent('onPeerTimeout', {
                    missedCount: this.missedPongs,
                    threshold: this.timeoutThreshold
                });
            }
            else if (this.missedPongs >= 1) {
                this.status = 'warning';
                this._fireEvent('onMissedPong', {
                    missedCount: this.missedPongs,
                    threshold: this.timeoutThreshold
                });
            }
            // Actually send the ping
            sendPingFn();
        }, this.pingInterval);
        console.log(`[THeartbeat] ${this.name}: Timer started (interval: ${this.pingInterval}ms)`);
    }
    _stopTimer() {
        if (this.pingTimer !== null) {
            window.clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
    }
    _handlePong(serverTime) {
        const now = Date.now();
        this.latency = now - this.lastPingTime;
        // Reset missed pongs
        const wasWarning = this.missedPongs > 0;
        this.missedPongs = 0;
        this.status = 'healthy';
        // Fire onPong event
        this._fireEvent('onPong', { latency: this.latency, serverTime });
        // Check latency warning
        if (this.latency > this.latencyWarningThreshold) {
            this._fireEvent('onLatencyWarning', { latency: this.latency });
        }
        // Fire reconnected if was in warning state
        if (wasWarning) {
            this._fireEvent('onReconnected', { downtime: this.latency });
        }
    }
    _fireEvent(eventName, data) {
        if (this.onEvent) {
            this.onEvent(eventName, data);
        }
    }
    _setConnectionLost() {
        this._stopTimer();
        this.status = 'critical';
        this._fireEvent('onConnectionLost');
    }
}

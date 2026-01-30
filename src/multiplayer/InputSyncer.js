import { network } from './NetworkManager';
/**
 * RemotePaddle - Handles smooth interpolation for opponent's paddle
 *
 * Uses hybrid approach:
 * 1. Input events → immediate movement start/stop
 * 2. Position sync → soft correction for drift
 */
export class RemotePaddle {
    constructor(initialY = 10, boundsTop = 0, boundsBottom = 24) {
        this.y = 0;
        this.velocity = 0;
        this.speed = 0.3;
        this.targetY = null;
        this.correctionRate = 0.15;
        this.boundsTop = 0;
        this.boundsBottom = 24;
        this.y = initialY;
        this.boundsTop = boundsTop;
        this.boundsBottom = boundsBottom;
    }
    /**
     * Handle remote input event (key press/release)
     */
    onRemoteInput(key, action) {
        if (action === 'down') {
            // Start moving based on key
            if (key === 'w' || key === 'KeyW' || key === 'ArrowUp') {
                this.velocity = -this.speed;
            }
            if (key === 's' || key === 'KeyS' || key === 'ArrowDown') {
                this.velocity = +this.speed;
            }
        }
        else {
            // Stop moving when key released
            this.velocity = 0;
        }
    }
    /**
     * Handle position sync (periodic correction)
     */
    onPositionSync(y, velocity) {
        this.targetY = y;
        this.velocity = velocity;
    }
    /**
     * Update paddle position (call every frame)
     */
    update(paddleHeight) {
        // 1. Apply velocity
        this.y += this.velocity;
        // 2. Soft correction towards target if set
        if (this.targetY !== null) {
            const error = this.targetY - this.y;
            if (Math.abs(error) > 0.1) {
                this.y += error * this.correctionRate;
            }
            else {
                this.targetY = null; // Correction complete
            }
        }
        // 3. Clamp to bounds
        this.y = Math.max(this.boundsTop, Math.min(this.boundsBottom - paddleHeight, this.y));
        return this.y;
    }
}
/**
 * InputSyncer - Bridges local input with network
 *
 * Sends local inputs to server and applies remote inputs to opponent paddle.
 */
export class InputSyncer {
    constructor() {
        this._localPlayerNumber = 1;
        this.opponentPlayerNumber = 2;
        this.positionSyncInterval = null;
        this.localPaddleGetter = null;
        this.remotePaddle = new RemotePaddle();
        // Listen for remote events
        network.on(this.handleServerMessage.bind(this));
    }
    /**
     * Initialize with player assignment
     */
    init(playerNumber, boundsTop, boundsBottom) {
        this._localPlayerNumber = playerNumber;
        this.opponentPlayerNumber = playerNumber === 1 ? 2 : 1;
        this.remotePaddle = new RemotePaddle(10, boundsTop, boundsBottom);
    }
    /**
     * Set getter for local paddle position (for sync)
     */
    setLocalPaddleGetter(getter) {
        this.localPaddleGetter = getter;
    }
    /**
     * Start periodic position sync
     */
    startPositionSync(intervalMs = 200) {
        this.stopPositionSync();
        this.positionSyncInterval = window.setInterval(() => {
            if (this.localPaddleGetter) {
                const { y, velocity } = this.localPaddleGetter();
                network.sendStateSync('paddle' + this._localPlayerNumber, { y, velocity });
            }
        }, intervalMs);
    }
    /**
     * Stop position sync
     */
    stopPositionSync() {
        if (this.positionSyncInterval !== null) {
            clearInterval(this.positionSyncInterval);
            this.positionSyncInterval = null;
        }
    }
    /**
     * Call when local player presses a key
     */
    onLocalInput(key, action) {
        // Send to server for relay to opponent
        network.sendInput(key, action);
    }
    /**
     * Update remote paddle (call every frame)
     */
    updateRemotePaddle(paddleHeight) {
        return this.remotePaddle.update(paddleHeight);
    }
    /**
     * Get current remote paddle Y position
     */
    getRemotePaddleY() {
        return this.remotePaddle.y;
    }
    /**
     * Get local player number
     */
    getLocalPlayerNumber() {
        return this._localPlayerNumber;
    }
    /**
     * Handle incoming server messages
     */
    handleServerMessage(msg) {
        switch (msg.type) {
            case 'remote_input':
                // Only apply if it's from opponent
                if (msg.player === this.opponentPlayerNumber) {
                    this.remotePaddle.onRemoteInput(msg.key, msg.action);
                }
                break;
            case 'remote_state':
                if (msg.player === this.opponentPlayerNumber && msg.objectId === 'paddle' + this.opponentPlayerNumber) {
                    this.remotePaddle.onPositionSync(msg.state.y, msg.state.velocity);
                }
                break;
        }
    }
}
// Singleton instance
export const inputSyncer = new InputSyncer();

import { network } from './NetworkManager';
import { ServerMessage } from './Protocol';

/**
 * RemotePaddle - Handles smooth interpolation for opponent's paddle
 * 
 * Uses hybrid approach:
 * 1. Input events → immediate movement start/stop
 * 2. Position sync → soft correction for drift
 */
export class RemotePaddle {
    public y: number = 0;
    public velocity: number = 0;
    public speed: number = 0.3;

    private targetY: number | null = null;
    private correctionRate: number = 0.15;
    private boundsTop: number = 0;
    private boundsBottom: number = 24;

    constructor(initialY: number = 10, boundsTop: number = 0, boundsBottom: number = 24) {
        this.y = initialY;
        this.boundsTop = boundsTop;
        this.boundsBottom = boundsBottom;
    }

    /**
     * Handle remote input event (key press/release)
     */
    onRemoteInput(key: string, action: 'down' | 'up'): void {
        if (action === 'down') {
            // Start moving based on key
            if (key === 'w' || key === 'KeyW' || key === 'ArrowUp') {
                this.velocity = -this.speed;
            }
            if (key === 's' || key === 'KeyS' || key === 'ArrowDown') {
                this.velocity = +this.speed;
            }
        } else {
            // Stop moving when key released
            this.velocity = 0;
        }
    }

    /**
     * Handle position sync (periodic correction)
     */
    onPositionSync(y: number, velocity: number): void {
        this.targetY = y;
        this.velocity = velocity;
    }

    /**
     * Update paddle position (call every frame)
     */
    update(paddleHeight: number): number {
        // 1. Apply velocity
        this.y += this.velocity;

        // 2. Soft correction towards target if set
        if (this.targetY !== null) {
            const error = this.targetY - this.y;
            if (Math.abs(error) > 0.1) {
                this.y += error * this.correctionRate;
            } else {
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
    private remotePaddle: RemotePaddle;
    private _localPlayerNumber: 1 | 2 = 1;
    private opponentPlayerNumber: 1 | 2 = 2;
    private positionSyncInterval: number | null = null;
    private localPaddleGetter: (() => { y: number, velocity: number }) | null = null;

    constructor() {
        this.remotePaddle = new RemotePaddle();

        // Listen for remote events
        network.on(this.handleServerMessage.bind(this));
    }

    /**
     * Initialize with player assignment
     */
    init(playerNumber: 1 | 2, boundsTop: number, boundsBottom: number): void {
        this._localPlayerNumber = playerNumber;
        this.opponentPlayerNumber = playerNumber === 1 ? 2 : 1;
        this.remotePaddle = new RemotePaddle(10, boundsTop, boundsBottom);
    }

    /**
     * Set getter for local paddle position (for sync)
     */
    setLocalPaddleGetter(getter: () => { y: number, velocity: number }): void {
        this.localPaddleGetter = getter;
    }

    /**
     * Start periodic position sync
     */
    startPositionSync(intervalMs: number = 200): void {
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
    stopPositionSync(): void {
        if (this.positionSyncInterval !== null) {
            clearInterval(this.positionSyncInterval);
            this.positionSyncInterval = null;
        }
    }

    /**
     * Call when local player presses a key
     */
    onLocalInput(key: string, action: 'down' | 'up'): void {
        // Send to server for relay to opponent
        network.sendInput(key, action);
    }

    /**
     * Update remote paddle (call every frame)
     */
    updateRemotePaddle(paddleHeight: number): number {
        return this.remotePaddle.update(paddleHeight);
    }

    /**
     * Get current remote paddle Y position
     */
    getRemotePaddleY(): number {
        return this.remotePaddle.y;
    }

    /**
     * Get local player number
     */
    getLocalPlayerNumber(): 1 | 2 {
        return this._localPlayerNumber;
    }

    /**
     * Handle incoming server messages
     */
    private handleServerMessage(msg: ServerMessage): void {
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

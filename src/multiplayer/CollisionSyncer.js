import { network } from './NetworkManager';
/**
 * CollisionSyncer - Handles ball collision and score synchronization
 *
 * Key principle: "Owner decides"
 * - Paddle collision: Owner of the paddle sends the event
 * - Score: The scoring player (not the one who lost) sends the event
 */
export class CollisionSyncer {
    constructor() {
        this.localPlayerNumber = 1;
        this.onBallStateUpdate = null;
        this.onScoreUpdate = null;
        network.on(this.handleServerMessage.bind(this));
    }
    /**
     * Initialize with player assignment
     */
    init(playerNumber) {
        this.localPlayerNumber = playerNumber;
    }
    /**
     * Set callback for when ball state is updated by remote
     */
    onBallUpdate(callback) {
        this.onBallStateUpdate = callback;
    }
    /**
     * Set callback for when score is updated
     */
    onScore(callback) {
        this.onScoreUpdate = callback;
    }
    /**
     * Call when ball collides with LOCAL player's paddle
     * Only the paddle owner should call this!
     */
    sendPaddleCollision(ball) {
        network.sendStateSync('ball', ball);
    }
    /**
     * Call when ball exits on opponent's side (local player scored)
     *
     * Logic:
     * - Player 1 owns left paddle → scores when ball exits RIGHT
     * - Player 2 owns right paddle → scores when ball exits LEFT
     */
    sendScore(exitSide) {
        // Determine who scored based on exit side
        // If ball exits LEFT, Player 2 scored (Player 1 missed)
        // If ball exits RIGHT, Player 1 scored (Player 2 missed)
        const scorer = exitSide === 'left' ? 2 : 1;
        // Only send if WE are the scorer (prevents duplicate events)
        if (scorer === this.localPlayerNumber) {
            network.triggerRemoteEvent('stage', 'score', { scorer });
        }
    }
    /**
     * Check if local player should handle collision for a paddle
     *
     * Player 1 owns left paddle, Player 2 owns right paddle
     */
    isLocalPaddle(paddleSide) {
        if (this.localPlayerNumber === 1) {
            return paddleSide === 'left';
        }
        else {
            return paddleSide === 'right';
        }
    }
    /**
     * Get local player number
     */
    getLocalPlayerNumber() {
        return this.localPlayerNumber;
    }
    /**
     * Handle server messages
     */
    handleServerMessage(msg) {
        switch (msg.type) {
            case 'remote_state':
                // Other player's paddle hit the ball - update our ball state
                if (msg.objectId === 'ball' && this.onBallStateUpdate) {
                    this.onBallStateUpdate(msg.state);
                }
                break;
            case 'remote_event':
                // Score update from remote
                if (msg.eventName === 'score' && this.onScoreUpdate) {
                    this.onScoreUpdate(msg.params.scorer);
                }
                break;
        }
    }
}
// Singleton instance
export const collisionSyncer = new CollisionSyncer();

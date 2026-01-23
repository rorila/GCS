"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Room = void 0;
const ws_1 = __importDefault(require("ws"));
const Protocol_1 = require("./Protocol");
/**
 * Room - Manages a single game session between 2 players
 *
 * Simple design: First player to join is Player 1, second is Player 2.
 * Extensible: Can later add spectators, reconnection, etc.
 */
class Room {
    constructor(code, gameName = '') {
        this.gameName = ''; // Which game this room is for
        this.player1 = null;
        this.player2 = null;
        this.gameStarted = false;
        this.project = null; // Stored project JSON from Master
        this.metadata = {}; // Platform metadata
        this.player1Ready = false;
        this.player2Ready = false;
        this.code = code;
        this.gameName = gameName;
    }
    /**
     * Add a player to the room
     * Returns player number (1 or 2) or null if room is full
     */
    addPlayer(ws) {
        if (!this.player1) {
            this.player1 = ws;
            return 1;
        }
        else if (!this.player2) {
            this.player2 = ws;
            // Notify player 1 that player 2 joined
            this.sendTo(1, { type: 'player_joined', playerNumber: 2 });
            return 2;
        }
        return null; // Room full
    }
    /**
     * Rejoin a player to their original slot (for reconnection after page navigation)
     * Returns true if successful
     */
    rejoinPlayer(ws, playerNumber) {
        if (playerNumber === 1) {
            // If slot is already taken by another connection, don't allow
            if (this.player1 && this.player1.readyState === ws_1.default.OPEN) {
                console.log(`[Room ${this.code}] Rejoin failed: P1 slot already has active connection`);
                return false;
            }
            this.player1 = ws;
            this.player1Ready = false; // Reset ready state on rejoin
            console.log(`[Room ${this.code}] Player 1 rejoined, ready state reset`);
            return true;
        }
        else if (playerNumber === 2) {
            if (this.player2 && this.player2.readyState === ws_1.default.OPEN) {
                console.log(`[Room ${this.code}] Rejoin failed: P2 slot already has active connection`);
                return false;
            }
            this.player2 = ws;
            this.player2Ready = false; // Reset ready state on rejoin
            console.log(`[Room ${this.code}] Player 2 rejoined, ready state reset`);
            return true;
        }
        return false;
    }
    /**
     * Remove a player from the room
     * If gameStarted is true, we expect a reconnection (navigation), so we don't fully remove
     */
    removePlayer(ws) {
        if (this.player1 === ws) {
            this.player1 = null;
            this.player1Ready = false;
            if (this.player2) {
                this.sendTo(2, { type: 'player_left', playerNumber: 1 });
            }
        }
        else if (this.player2 === ws) {
            this.player2 = null;
            this.player2Ready = false;
            if (this.player1) {
                this.sendTo(1, { type: 'player_left', playerNumber: 2 });
            }
        }
    }
    /**
     * Mark a player as ready
     */
    setReady(ws) {
        if (this.player1 === ws)
            this.player1Ready = true;
        if (this.player2 === ws)
            this.player2Ready = true;
        // If both ready, start the game
        if (this.player1Ready && this.player2Ready && !this.gameStarted) {
            this.startGame();
        }
    }
    /**
     * Start the game - send initial state to both players
     */
    startGame() {
        this.gameStarted = true;
        const seed = Math.floor(Math.random() * 1000000);
        this.sendTo(1, { type: 'game_start', yourPlayer: 1, seed });
        this.sendTo(2, { type: 'game_start', yourPlayer: 2, seed });
        console.log(`[Room ${this.code}] Game started with seed ${seed}`);
    }
    /**
     * Relay an event to the other player
     */
    relayToOther(sender, msg) {
        const target = this.player1 === sender ? this.player2 : this.player1;
        if (target && target.readyState === ws_1.default.OPEN) {
            target.send((0, Protocol_1.serialize)(msg));
        }
    }
    /**
     * Send message to specific player
     */
    sendTo(player, msg) {
        const target = player === 1 ? this.player1 : this.player2;
        if (target && target.readyState === ws_1.default.OPEN) {
            target.send((0, Protocol_1.serialize)(msg));
        }
    }
    /**
     * Check if room is empty
     */
    isEmpty() {
        return !this.player1 && !this.player2;
    }
    /**
     * Get player number for a WebSocket
     */
    getPlayerNumber(ws) {
        if (this.player1 === ws)
            return 1;
        if (this.player2 === ws)
            return 2;
        return null;
    }
    /**
     * Check if room is waiting for another player
     */
    isWaiting() {
        return this.player1 !== null && this.player2 === null && !this.gameStarted;
    }
    /**
     * Get number of players in room
     */
    playerCount() {
        return (this.player1 ? 1 : 0) + (this.player2 ? 1 : 0);
    }
}
exports.Room = Room;

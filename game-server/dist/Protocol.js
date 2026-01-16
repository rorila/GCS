"use strict";
/**
 * Event Protocol for Multiplayer Games
 *
 * Keep this in sync with client-side types!
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.serialize = serialize;
exports.parse = parse;
// Helper to send typed messages
function serialize(msg) {
    return JSON.stringify(msg);
}
function parse(data) {
    try {
        return JSON.parse(data);
    }
    catch {
        return null;
    }
}

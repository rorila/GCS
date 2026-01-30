/**
 * Event Protocol for Multiplayer Games
 *
 * Keep this in sync with client-side types!
 */
// Helper to send typed messages
export function serialize(msg) {
    return JSON.stringify(msg);
}
export function parse(data) {
    try {
        return JSON.parse(data);
    }
    catch {
        return null;
    }
}

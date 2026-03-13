/**
 * Event Protocol for Multiplayer Games
 * 
 * Keep this in sync with client-side types!
 */

// Client → Server messages
export type ClientMessage =
    | { type: 'create_room', gameName?: string }
    | { type: 'join_room', roomCode: string }
    | { type: 'rejoin_room', roomCode: string, playerNumber: 1 | 2 }
    | { type: 'ready' }
    | { type: 'input', key: string, action: 'down' | 'up' }
    | { type: 'trigger_event', objectId: string, eventName: string, params?: any }
    | { type: 'broadcast_action', action: any }
    | { type: 'state_sync', objectId: string, state: any }
    | { type: 'sync_project', project: any }  // Master sends project JSON
    | { type: 'trigger_task', taskName: string, params?: any }  // triggerMode: broadcast
    | { type: 'sync_task', taskName: string, params?: any }     // triggerMode: local-sync
    | { type: 'ping', timestamp: number }                        // Heartbeat ping
    | { type: 'agent_call', method: string, params?: any[], requestId?: string };  // Agent API call

// Server → Client messages
export type ServerMessage =
    | { type: 'room_created', roomCode: string }
    | { type: 'room_joined', roomCode: string, playerNumber: 1 | 2, gameName?: string }
    | { type: 'player_joined', playerNumber: 1 | 2 }
    | { type: 'player_left', playerNumber: 1 | 2 }
    | { type: 'game_start', yourPlayer: 1 | 2, seed: number }
    | { type: 'remote_input', player: 1 | 2, key: string, action: 'down' | 'up' }
    | { type: 'remote_event', player: 1 | 2, objectId: string, eventName: string, params?: any }
    | { type: 'remote_action', player: 1 | 2, action: any }
    | { type: 'remote_state', player: 1 | 2, objectId: string, state: any }
    | { type: 'project_data', project: any }  // Server sends project JSON to joining player
    | { type: 'remote_task', player: 1 | 2, taskName: string, params?: any, mode: 'broadcast' | 'sync' }
    | { type: 'pong', timestamp: number, serverTime: number }    // Heartbeat pong response
    | { type: 'player_timeout', playerNumber: 1 | 2, reason: 'heartbeat' | 'disconnect' }  // Timeout notification
    | { type: 'agent_result', requestId?: string, success: boolean, data?: any, error?: string }  // Agent API result
    | { type: 'error', message: string };

// Helper to send typed messages
export function serialize(msg: ServerMessage): string {
    return JSON.stringify(msg);
}

export function parse(data: string): ClientMessage | null {
    try {
        return JSON.parse(data) as ClientMessage;
    } catch {
        return null;
    }
}

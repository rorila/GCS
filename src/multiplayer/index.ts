/**
 * Multiplayer Module
 * 
 * Reusable networking for any multiplayer game.
 */

export { network, NetworkManager } from './NetworkManager';
export type { ConnectionState } from './NetworkManager';
export { lobby, MultiplayerLobby } from './MultiplayerLobby';
export { inputSyncer, InputSyncer, RemotePaddle } from './InputSyncer';
export { collisionSyncer, CollisionSyncer } from './CollisionSyncer';
export * from './Protocol';

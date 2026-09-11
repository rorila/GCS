import fs from 'fs';
import path from 'path';
import WebSocket, { WebSocketServer } from 'ws';
import { Room } from '../Room';
import { parse, serialize } from '../Protocol';
import { rooms, playerRooms, PUBLIC_DIR } from '../serverState';
import { AGENT_METHODS, createServerSideAgentController } from '../routes/agentRoutes';

/**
 * Generate a simple 6-character room code
 */
function generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 for clarity
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Ensure unique
    if (rooms.has(code)) return generateRoomCode();
    return code;
}

/**
 * Handle incoming messages from a client
 */
function handleMessage(ws: WebSocket, data: string): void {
    const msg = parse(data);
    if (!msg) {
        ws.send(serialize({ type: 'error', message: 'Invalid message format' }));
        return;
    }

    switch (msg.type) {
        case 'create_room': {
            // Create a new room (with optional game name)
            const code = generateRoomCode();
            const gameName = msg.gameName || '';
            const room = new Room(code, gameName);

            // Platform: Store host metadata
            if ((msg as any).hostName) {
                room.metadata.hostName = (msg as any).hostName;
                room.metadata.hostAvatar = (msg as any).hostAvatar;
            }

            rooms.set(code, room);

            const playerNum = room.addPlayer(ws);
            playerRooms.set(ws, room);

            ws.send(serialize({ type: 'room_created', roomCode: code }));
            console.log(`[Server] Room ${code} created for game: ${gameName}`);
            break;
        }

        case 'join_room': {
            const room = rooms.get(msg.roomCode.toUpperCase());
            if (!room) {
                ws.send(serialize({ type: 'error', message: 'Room not found' }));
                return;
            }

            const playerNum = room.addPlayer(ws);
            if (!playerNum) {
                ws.send(serialize({ type: 'error', message: 'Room is full' }));
                return;
            }

            playerRooms.set(ws, room);
            ws.send(serialize({
                type: 'room_joined',
                roomCode: room.code,
                playerNumber: playerNum,
                gameName: room.gameName
            }));

            // If the room already has project data (from P1), send it to P2 immediately
            if (room.project) {
                console.log(`[Server] Sending existing project data to Player ${playerNum} in room ${room.code}`);
                ws.send(serialize({ type: 'project_data', project: room.project }));
            }

            console.log(`[Server] Player ${playerNum} joined room ${room.code} (game: ${room.gameName})`);
            break;
        }

        case 'rejoin_room': {
            const room = rooms.get(msg.roomCode.toUpperCase());
            if (!room) {
                ws.send(serialize({ type: 'error', message: 'Room not found' }));
                return;
            }

            const success = room.rejoinPlayer(ws, msg.playerNumber);
            if (!success) {
                ws.send(serialize({ type: 'error', message: 'Cannot rejoin - slot occupied' }));
                return;
            }

            playerRooms.set(ws, room);

            // Reset game started flag so the game can restart properly
            // This ensures both players go through the ready sequence again
            room.gameStarted = false;
            console.log(`[Server] Room ${room.code} gameStarted reset to false for rejoin`);

            ws.send(serialize({
                type: 'room_joined',
                roomCode: room.code,
                playerNumber: msg.playerNumber,
                gameName: room.gameName
            }));

            // Send project data on rejoin too
            if (room.project) {
                ws.send(serialize({ type: 'project_data', project: room.project }));
            }

            console.log(`[Server] Player ${msg.playerNumber} rejoined room ${room.code}`);

            // Note: We do NOT auto-ready here anymore
            // The client will call ready() after the game is fully initialized
            break;
        }

        case 'ready': {
            const room = playerRooms.get(ws);
            if (room) {
                room.setReady(ws);
            }
            break;
        }

        case 'input': {
            const room = playerRooms.get(ws);
            console.log(`[Server] Input event received: ${msg.key} ${msg.action} (room: ${room?.code}, gameStarted: ${room?.gameStarted})`);
            if (room && room.gameStarted) {
                const player = room.getPlayerNumber(ws);
                if (player) {
                    console.log(`[Server] Relaying input from Player ${player}: ${msg.key} ${msg.action}`);
                    room.relayToOther(ws, {
                        type: 'remote_input',
                        player,
                        key: msg.key,
                        action: msg.action
                    });
                }
            }
            break;
        }

        case 'trigger_event': {
            const room = playerRooms.get(ws);
            if (room && room.gameStarted) {
                const player = room.getPlayerNumber(ws);
                if (player) {
                    console.log(`[Server] Relaying trigger_event from Player ${player}: ${msg.objectId}.${msg.eventName}`);
                    room.relayToOther(ws, {
                        type: 'remote_event',
                        player,
                        objectId: msg.objectId,
                        eventName: msg.eventName,
                        params: msg.params
                    } as any);
                }
            }
            break;
        }

        case 'state_sync': {
            const room = playerRooms.get(ws);
            if (room && room.gameStarted) {
                const player = room.getPlayerNumber(ws);
                if (player) {
                    room.relayToOther(ws, {
                        type: 'remote_state',
                        player,
                        objectId: msg.objectId,
                        state: msg.state
                    } as any);
                }
            }
            break;
        }

        case 'broadcast_action': {
            const room = playerRooms.get(ws);
            if (room) {
                const player = room.getPlayerNumber(ws);
                if (player) {
                    console.log(`[Server] Broadcasting action from Player ${player}: ${msg.action?.type || 'unknown'}`);
                    room.relayToOther(ws, {
                        type: 'remote_action',
                        player,
                        action: msg.action
                    });
                }
            }
            break;
        }

        case 'sync_project': {
            const room = playerRooms.get(ws);
            if (room) {
                const playerNum = room.getPlayerNumber(ws);
                if (playerNum === 1) {
                    console.log(`[Server] Room ${room.code}: Received project update from Master`);
                    room.project = msg.project;
                    // Relay to P2 if they are already there
                    room.relayToOther(ws, { type: 'project_data', project: msg.project });
                }
            }
            break;
        }

        case 'trigger_task': {
            // triggerMode: broadcast - Send to Host (Player 1) who will execute and sync
            const room = playerRooms.get(ws);
            if (room && room.gameStarted) {
                const player = room.getPlayerNumber(ws);
                if (player) {
                    console.log(`[Server] Trigger task from Player ${player}: ${msg.taskName} (broadcast mode)`);
                    // Send to Host (Player 1) only - Host will execute and broadcast result
                    room.sendTo(1, {
                        type: 'remote_task',
                        player,
                        taskName: msg.taskName,
                        params: msg.params,
                        mode: 'broadcast'
                    } as any);
                }
            }
            break;
        }

        case 'sync_task': {
            // triggerMode: local-sync - Relay to other player for sync
            const room = playerRooms.get(ws);
            if (room && room.gameStarted) {
                const player = room.getPlayerNumber(ws);
                if (player) {
                    console.log(`[Server] Sync task from Player ${player}: ${msg.taskName} (local-sync mode)`);
                    room.relayToOther(ws, {
                        type: 'remote_task',
                        player,
                        taskName: msg.taskName,
                        params: msg.params,
                        mode: 'sync'
                    } as any);
                }
            }
            break;
        }

        case 'agent_call': {
            // Agent API über WebSocket — ermöglicht Echtzeit-Feedback
            const agentMethod = msg.method;
            const agentParams = msg.params || [];

            if (!AGENT_METHODS[agentMethod]) {
                ws.send(serialize({ type: 'agent_result', requestId: msg.requestId, success: false, error: `Unbekannte Methode: '${agentMethod}'` } as any));
                break;
            }

            const projectPath = path.resolve(PUBLIC_DIR, 'project.json');
            try {
                const projectData = JSON.parse(fs.readFileSync(projectPath, 'utf-8'));
                const ctrl = createServerSideAgentController(projectData);
                const fn = (ctrl as any)[agentMethod];
                if (typeof fn !== 'function') throw new Error(`Methode '${agentMethod}' nicht implementiert.`);

                const result = fn.apply(ctrl, agentParams);

                const readOnly = ['listStages', 'listTasks', 'listActions', 'listVariables', 'listObjects', 'getTaskDetails', 'validate'];
                if (!readOnly.includes(agentMethod)) {
                    fs.writeFileSync(projectPath, JSON.stringify(projectData, null, 2));
                }

                ws.send(serialize({ type: 'agent_result', requestId: msg.requestId, success: true, data: result ?? null } as any));
                console.log(`[Agent WS] ${agentMethod}() → OK`);
            } catch (e: any) {
                ws.send(serialize({ type: 'agent_result', requestId: msg.requestId, success: false, error: e.message } as any));
                console.error(`[Agent WS] ${agentMethod}() → Fehler: ${e.message}`);
            }
            break;
        }

        case 'ping': {
            // Heartbeat ping - respond with pong immediately
            ws.send(serialize({
                type: 'pong',
                timestamp: msg.timestamp,
                serverTime: Date.now()
            } as any));
            break;
        }
    }
}

/**
 * Handle client disconnection
 */
function handleDisconnect(ws: WebSocket): void {
    const room = playerRooms.get(ws);
    if (room) {
        const playerNum = room.getPlayerNumber(ws);
        room.removePlayer(ws);
        playerRooms.delete(ws);

        console.log(`[Server] Player ${playerNum} disconnected from room ${room.code}`);

        // Don't delete room immediately - give time for navigation/rejoin
        // Check after 10 seconds if room is still empty
        setTimeout(() => {
            if (room.isEmpty()) {
                rooms.delete(room.code);
                console.log(`[Server] Room ${room.code} deleted after grace period (empty)`);
            } else {
                console.log(`[Server] Room ${room.code} kept alive - players reconnected`);
            }
        }, 30000); // 30 second grace period
    }
}

export function setupWebSocket(wss: WebSocketServer) {
    // WebSocket connection handler
    wss.on('connection', (ws: WebSocket) => {
        console.log('[Server] New connection');

        ws.on('message', (data: Buffer) => {
            handleMessage(ws, data.toString());
        });

        ws.on('close', () => {
            handleDisconnect(ws);
        });

        ws.on('error', (err) => {
            console.error('[Server] WebSocket error:', err);
            handleDisconnect(ws);
        });
    });
}

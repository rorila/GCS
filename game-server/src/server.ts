import WebSocket, { WebSocketServer } from 'ws';
import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import { Room } from './Room';
import { parse, serialize, ClientMessage } from './Protocol';

/**
 * Multiplayer Game Server
 * 
 * Features:
 * - WebSocket for real-time game communication
 * - REST API for lobby (game list, waiting rooms)
 * - Static file serving for games
 */

const PORT = parseInt(process.env.PORT || '3000');
const PUBLIC_DIR = path.join(__dirname, '../public');

// Builder URL for fetching runtime versions (only used when runtime is missing)
const BUILDER_URL = process.env.BUILDER_URL || 'http://localhost:5173';

const rooms = new Map<string, Room>();
const playerRooms = new Map<WebSocket, Room>();

// Platform directories - ONLY uploaded games, no demos dependency
const UPLOADED_GAMES_DIR = path.join(__dirname, '../../uploaded_games');
const RUNTIMES_DIR = path.join(__dirname, '../runtimes');

if (!fs.existsSync(UPLOADED_GAMES_DIR)) {
    fs.mkdirSync(UPLOADED_GAMES_DIR, { recursive: true });
}
if (!fs.existsSync(RUNTIMES_DIR)) {
    fs.mkdirSync(RUNTIMES_DIR, { recursive: true });
}

// ─────────────────────────────────────────────
// Express App Setup
// ─────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve static files from public folder
app.use(express.static(PUBLIC_DIR));

// Root serves the player (Game Server is standalone)
app.get('/', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'player.html'));
});

// Legacy /games endpoints removed - use /platform/games instead

/**
 * GET /rooms/active - Get all active rooms (even those with 2 players)
 */
app.get('/rooms/active', (req, res) => {
    const activeRooms: any[] = [];
    rooms.forEach((room, code) => {
        activeRooms.push({
            code: room.code,
            gameName: room.gameName,
            playerCount: room.playerCount(),
            gameStarted: room.gameStarted,
            hasProject: !!room.project
        });
    });
    res.json(activeRooms);
});

/**
 * GET /platform/games - List uploaded games only
 */
app.get('/platform/games', (req, res) => {
    try {
        if (!fs.existsSync(UPLOADED_GAMES_DIR)) {
            return res.json([]);
        }
        const games = fs.readdirSync(UPLOADED_GAMES_DIR)
            .filter(f => f.endsWith('.json'))
            .map(f => {
                try {
                    const content = JSON.parse(fs.readFileSync(path.join(UPLOADED_GAMES_DIR, f), 'utf-8'));

                    // Handle compressed format
                    if (content._compressed && content.data) {
                        // Decompress to get metadata
                        try {
                            const compressedBuffer = Buffer.from(content.data, 'base64');
                            const decompressed = zlib.gunzipSync(compressedBuffer);
                            const project = JSON.parse(decompressed.toString('utf-8'));
                            return {
                                file: f,
                                name: project.meta?.name || f.replace('.json', ''),
                                author: project.meta?.author || 'Unknown',
                                runtimeVersion: project.meta?.runtimeVersion || content._version || '1.0.0',
                                compressed: true
                            };
                        } catch (e) {
                            console.error(`[API] Error decompressing ${f} for metadata:`, e);
                            return null;
                        }
                    }

                    return {
                        file: f,
                        name: content.meta?.name || f.replace('.json', ''),
                        author: content.meta?.author || 'Unknown',
                        runtimeVersion: content.meta?.runtimeVersion || '1.0.0'
                    };
                } catch {
                    return null;
                }
            })
            .filter(g => g !== null);
        res.json(games);
    } catch (err) {
        console.error('[API] Error listing games:', err);
        res.status(500).json({ error: 'Failed to list games' });
    }
});

/**
 * GET /platform/games/:filename - Serve a specific game JSON
 */
app.get('/platform/games/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(UPLOADED_GAMES_DIR, filename);

    if (fs.existsSync(filePath)) {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        // Handle compressed format - decompress on-the-fly
        if (content._compressed && content.data) {
            try {
                const compressedBuffer = Buffer.from(content.data, 'base64');
                const decompressed = zlib.gunzipSync(compressedBuffer);
                const project = JSON.parse(decompressed.toString('utf-8'));
                console.log(`[API] Serving decompressed game: ${filename}`);
                res.json(project);
            } catch (e) {
                console.error(`[API] Error decompressing game ${filename}:`, e);
                res.status(500).json({ error: 'Failed to decompress game' });
            }
        } else {
            res.json(content);
        }
    } else {
        res.status(404).json({ error: 'Game not found' });
    }
});

/**
 * GET /api/images - List images in public/images
 */
app.get('/api/images', (req, res) => {
    const imagesDir = path.join(__dirname, '../../public/images');

    if (!fs.existsSync(imagesDir)) {
        return res.json([]);
    }

    const listFiles = (dir: string, base: string = ''): any[] => {
        const results: any[] = [];
        const files = fs.readdirSync(dir);

        files.forEach(file => {
            const filePath = path.join(dir, file);
            const relPath = base ? `${base}/${file}` : file;
            const stat = fs.statSync(filePath);

            if (stat.isDirectory()) {
                results.push({
                    name: file,
                    type: 'directory',
                    path: relPath,
                    children: listFiles(filePath, relPath)
                });
            } else if (/\.(png|jpe?g|gif|svg|webp)$/i.test(file)) {
                results.push({
                    name: file,
                    type: 'file',
                    path: relPath,
                    size: stat.size
                });
            }
        });

        return results;
    };

    try {
        const fileTree = listFiles(imagesDir);
        res.json(fileTree);
    } catch (err) {
        console.error('[API] Error listing images:', err);
        res.status(500).json({ error: 'Failed to list images' });
    }
});

/**
 * POST /platform/games - Upload a new game
 */
app.post('/platform/games', (req, res) => {
    try {
        const { filename, content, compressed } = req.body;

        if (!filename || !content) {
            return res.status(400).json({ error: 'Missing filename or content' });
        }

        // Validate filename (prevent path traversal)
        const safeName = path.basename(filename).replace(/[^a-zA-Z0-9_.-]/g, '_');
        if (!safeName.endsWith('.json')) {
            return res.status(400).json({ error: 'Filename must end with .json' });
        }

        const filePath = path.join(UPLOADED_GAMES_DIR, safeName);
        fs.writeFileSync(filePath, JSON.stringify(content, null, 2));

        // For compressed format, extract game name for response
        let gameName = safeName.replace('.json', '');
        if (compressed && content._compressed && content.data) {
            try {
                const compressedBuffer = Buffer.from(content.data, 'base64');
                const decompressed = zlib.gunzipSync(compressedBuffer);
                const project = JSON.parse(decompressed.toString('utf-8'));
                gameName = project.meta?.name || gameName;
            } catch (e) {
                console.warn(`[API] Could not extract game name from compressed content:`, e);
            }
        }

        console.log(`[API] Game uploaded: ${safeName} (compressed: ${!!compressed})`);
        res.json({ success: true, filename: safeName, gameName });
    } catch (err) {
        console.error('[API] Error uploading game:', err);
        res.status(500).json({ error: 'Failed to upload game' });
    }
});

/**
 * DELETE /platform/games/:filename - Delete a game
 */
app.delete('/platform/games/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(UPLOADED_GAMES_DIR, filename);

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[API] Game deleted: ${filename}`);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Game not found' });
    }
});

/**
 * GET /runtimes/:version - Get runtime JS for a specific version
 * Auto-fetches from Builder if not cached
 */
app.get('/runtimes/:version', async (req, res) => {
    const version = req.params.version;
    const runtimePath = path.join(RUNTIMES_DIR, `v${version}.js`);

    // Check if we have this version cached
    const isLocalhost = BUILDER_URL.includes('localhost') || BUILDER_URL.includes('127.0.0.1');
    if (fs.existsSync(runtimePath) && !isLocalhost) {
        res.setHeader('Content-Type', 'application/javascript');
        return res.sendFile(runtimePath);
    }

    if (isLocalhost) {
        console.log(`[API] Dev-Mode: Bypassing cache for runtime v${version}, fetching fresh from ${BUILDER_URL}...`);
    }

    // Fetch from Builder server
    console.log(`[API] Runtime v${version} not found, fetching from ${BUILDER_URL}...`);
    try {
        const resp = await fetch(`${BUILDER_URL}/runtime-standalone.js`);
        if (resp.ok) {
            const code = await resp.text();

            // Validate it's actual JS, not HTML error page
            if (code.trim().startsWith('<!DOCTYPE') || code.trim().startsWith('<html')) {
                console.error('[API] Builder returned HTML instead of JS');
                return res.status(502).json({ error: 'Builder returned invalid runtime' });
            }

            // Cache it
            fs.writeFileSync(runtimePath, code);
            console.log(`[API] Runtime v${version} cached`);

            res.setHeader('Content-Type', 'application/javascript');
            res.send(code);
        } else {
            console.error(`[API] Failed to fetch runtime from Builder: ${resp.status}`);
            res.status(502).json({ error: 'Failed to fetch runtime from Builder' });
        }
    } catch (err) {
        console.error('[API] Error fetching runtime:', err);
        res.status(502).json({ error: 'Builder not reachable' });
    }
});

/**
 * GET /rooms/waiting/:game - Get waiting rooms for a specific game
 */
app.get('/rooms/waiting/:game', (req, res) => {
    const gameName = req.params.game;
    const waitingRooms: { code: string, gameName: string, playerCount: number }[] = [];

    rooms.forEach((room) => {
        if (room.isWaiting() && room.gameName === gameName) {
            waitingRooms.push({
                code: room.code,
                gameName: room.gameName,
                playerCount: room.playerCount()
            });
        }
    });

    res.json(waitingRooms);
});

// ─────────────────────────────────────────────
// HTTP + WebSocket Server Setup
// ─────────────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

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

// Start server
server.listen(PORT, () => {
    console.log(`🎮 Game Server running on port ${PORT}`);
    console.log(`   WebSocket: ws://localhost:${PORT}`);
    console.log(`   REST API:  http://localhost:${PORT}`);
    console.log(`   Games dir: ${UPLOADED_GAMES_DIR}`);
    console.log(`   Runtimes:  ${RUNTIMES_DIR}`);
});

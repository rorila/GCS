"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const Room_1 = require("./Room");
const Protocol_1 = require("./Protocol");
/**
 * Multiplayer Game Server
 *
 * Features:
 * - WebSocket for real-time game communication
 * - REST API for lobby (game list, waiting rooms)
 * - Static file serving for games
 */
const PORT = parseInt(process.env.PORT || '3000');
const GAMES_DIR = process.env.GAMES_DIR || path_1.default.join(__dirname, '../../demos');
const PUBLIC_DIR = path_1.default.join(__dirname, '../public');
const rooms = new Map();
const playerRooms = new Map();
// Platform directories
const UPLOADED_GAMES_DIR = path_1.default.join(__dirname, '../../uploaded_games');
if (!fs_1.default.existsSync(UPLOADED_GAMES_DIR)) {
    fs_1.default.mkdirSync(UPLOADED_GAMES_DIR, { recursive: true });
}
// ─────────────────────────────────────────────
// Express App Setup
// ─────────────────────────────────────────────
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Serve static files from public folder
app.use(express_1.default.static(PUBLIC_DIR));
// Root redirect to lobby (or player with lobby.json)
app.get('/', (req, res) => {
    const isDev = process.env.NODE_ENV === 'development' || true; // Assume dev for now as per start script
    const port = isDev ? 5173 : PORT;
    const base = isDev ? `http://localhost:${port}` : '';
    if (fs_1.default.existsSync(path_1.default.join(GAMES_DIR, 'lobby.json'))) {
        res.redirect(`${base}/player.html?game=lobby.json`);
    }
    else {
        res.redirect(`${base}/player.html`);
    }
});
/**
 * GET /games - List available games
 */
app.get('/games', (req, res) => {
    try {
        const files = fs_1.default.readdirSync(GAMES_DIR)
            .filter(f => f.endsWith('.json') && f !== 'lobby.json')
            .map(f => {
            const content = JSON.parse(fs_1.default.readFileSync(path_1.default.join(GAMES_DIR, f), 'utf-8'));
            return {
                file: f,
                name: content.meta?.name || f.replace('.json', ''),
                author: content.meta?.author || 'Unknown'
            };
        });
        res.json(files);
    }
    catch (err) {
        console.error('[API] Error listing games:', err);
        res.status(500).json({ error: 'Failed to list games' });
    }
});
/**
 * GET /games/:name - Get a specific game
 */
app.get('/games/:name', (req, res) => {
    try {
        const filePath = path_1.default.join(GAMES_DIR, req.params.name);
        if (!fs_1.default.existsSync(filePath)) {
            return res.status(404).json({ error: 'Game not found' });
        }
        const content = fs_1.default.readFileSync(filePath, 'utf-8');
        res.json(JSON.parse(content));
    }
    catch (err) {
        console.error('[API] Error loading game:', err);
        res.status(500).json({ error: 'Failed to load game' });
    }
});
/**
 * GET /rooms/active - Get all active rooms (even those with 2 players)
 */
app.get('/rooms/active', (req, res) => {
    const activeRooms = [];
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
 * GET /platform/games - Combine demos and uploaded games
 */
app.get('/platform/games', (req, res) => {
    try {
        const getGames = (dir) => {
            if (!fs_1.default.existsSync(dir))
                return [];
            return fs_1.default.readdirSync(dir)
                .filter(f => f.endsWith('.json') && f !== 'lobby.json')
                .map(f => {
                const content = JSON.parse(fs_1.default.readFileSync(path_1.default.join(dir, f), 'utf-8'));
                return {
                    file: f,
                    name: content.meta?.name || f.replace('.json', ''),
                    author: content.meta?.author || 'Unknown',
                    type: dir.includes('uploaded') ? 'upload' : 'demo'
                };
            });
        };
        const games = [
            ...getGames(GAMES_DIR),
            ...getGames(UPLOADED_GAMES_DIR)
        ];
        res.json(games);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to list platform games' });
    }
});
/**
 * GET /platform/games/:filename - Serve a specific game JSON
 */
app.get('/platform/games/:filename', (req, res) => {
    const filename = req.params.filename;
    let filePath = path_1.default.join(GAMES_DIR, filename);
    // Check in demos first, then uploaded
    if (!fs_1.default.existsSync(filePath)) {
        filePath = path_1.default.join(UPLOADED_GAMES_DIR, filename);
    }
    if (fs_1.default.existsSync(filePath)) {
        res.json(JSON.parse(fs_1.default.readFileSync(filePath, 'utf-8')));
    }
    else {
        res.status(404).json({ error: 'Game not found' });
    }
});
/**
 * GET /rooms/waiting/:game - Get waiting rooms for a specific game
 */
app.get('/rooms/waiting/:game', (req, res) => {
    const gameName = req.params.game;
    const waitingRooms = [];
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
const server = http_1.default.createServer(app);
const wss = new ws_1.WebSocketServer({ server });
/**
 * Generate a simple 6-character room code
 */
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 for clarity
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Ensure unique
    if (rooms.has(code))
        return generateRoomCode();
    return code;
}
/**
 * Handle incoming messages from a client
 */
function handleMessage(ws, data) {
    const msg = (0, Protocol_1.parse)(data);
    if (!msg) {
        ws.send((0, Protocol_1.serialize)({ type: 'error', message: 'Invalid message format' }));
        return;
    }
    switch (msg.type) {
        case 'create_room': {
            // Create a new room (with optional game name)
            const code = generateRoomCode();
            const gameName = msg.gameName || '';
            const room = new Room_1.Room(code, gameName);
            rooms.set(code, room);
            const playerNum = room.addPlayer(ws);
            playerRooms.set(ws, room);
            ws.send((0, Protocol_1.serialize)({ type: 'room_created', roomCode: code }));
            console.log(`[Server] Room ${code} created for game: ${gameName}`);
            break;
        }
        case 'join_room': {
            const room = rooms.get(msg.roomCode.toUpperCase());
            if (!room) {
                ws.send((0, Protocol_1.serialize)({ type: 'error', message: 'Room not found' }));
                return;
            }
            const playerNum = room.addPlayer(ws);
            if (!playerNum) {
                ws.send((0, Protocol_1.serialize)({ type: 'error', message: 'Room is full' }));
                return;
            }
            playerRooms.set(ws, room);
            ws.send((0, Protocol_1.serialize)({
                type: 'room_joined',
                roomCode: room.code,
                playerNumber: playerNum,
                gameName: room.gameName
            }));
            // If the room already has project data (from P1), send it to P2 immediately
            if (room.project) {
                console.log(`[Server] Sending existing project data to Player ${playerNum} in room ${room.code}`);
                ws.send((0, Protocol_1.serialize)({ type: 'project_data', project: room.project }));
            }
            console.log(`[Server] Player ${playerNum} joined room ${room.code} (game: ${room.gameName})`);
            break;
        }
        case 'rejoin_room': {
            const room = rooms.get(msg.roomCode.toUpperCase());
            if (!room) {
                ws.send((0, Protocol_1.serialize)({ type: 'error', message: 'Room not found' }));
                return;
            }
            const success = room.rejoinPlayer(ws, msg.playerNumber);
            if (!success) {
                ws.send((0, Protocol_1.serialize)({ type: 'error', message: 'Cannot rejoin - slot occupied' }));
                return;
            }
            playerRooms.set(ws, room);
            // Reset game started flag so the game can restart properly
            // This ensures both players go through the ready sequence again
            room.gameStarted = false;
            console.log(`[Server] Room ${room.code} gameStarted reset to false for rejoin`);
            ws.send((0, Protocol_1.serialize)({
                type: 'room_joined',
                roomCode: room.code,
                playerNumber: msg.playerNumber,
                gameName: room.gameName
            }));
            // Send project data on rejoin too
            if (room.project) {
                ws.send((0, Protocol_1.serialize)({ type: 'project_data', project: room.project }));
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
        case 'position_sync': {
            const room = playerRooms.get(ws);
            if (room && room.gameStarted) {
                const player = room.getPlayerNumber(ws);
                if (player) {
                    room.relayToOther(ws, {
                        type: 'remote_position',
                        player,
                        y: msg.y,
                        velocity: msg.velocity
                    });
                }
            }
            break;
        }
        case 'paddle_collision': {
            const room = playerRooms.get(ws);
            if (room && room.gameStarted) {
                const player = room.getPlayerNumber(ws);
                if (player) {
                    room.relayToOther(ws, {
                        type: 'remote_collision',
                        player,
                        ball: msg.ball
                    });
                }
            }
            break;
        }
        case 'score': {
            const room = playerRooms.get(ws);
            if (room && room.gameStarted) {
                room.relayToOther(ws, {
                    type: 'remote_score',
                    scorer: msg.scorer
                });
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
                        x: msg.x,
                        y: msg.y,
                        vx: msg.vx,
                        vy: msg.vy,
                        text: msg.text
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
    }
}
/**
 * Handle client disconnection
 */
function handleDisconnect(ws) {
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
            }
            else {
                console.log(`[Server] Room ${room.code} kept alive - players reconnected`);
            }
        }, 30000); // 30 second grace period
    }
}
// WebSocket connection handler
wss.on('connection', (ws) => {
    console.log('[Server] New connection');
    ws.on('message', (data) => {
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
    console.log(`   Games dir: ${GAMES_DIR}`);
});

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
const zlib_1 = __importDefault(require("zlib"));
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
const PORT = parseInt(process.env.PORT || '8080');
const PUBLIC_DIR = path_1.default.join(__dirname, '../public');
// Builder URL for fetching runtime versions (only used when runtime is missing)
const BUILDER_URL = process.env.BUILDER_URL || 'http://localhost:5173';
const rooms = new Map();
const playerRooms = new Map();
// Platform directories - ONLY uploaded games, no demos dependency
const UPLOADED_GAMES_DIR = path_1.default.join(__dirname, '../../uploaded_games');
const RUNTIMES_DIR = path_1.default.join(__dirname, '../runtimes');
const DATA_DIR = path_1.default.join(__dirname, '../data');
const DB_PATH = path_1.default.join(DATA_DIR, 'db.json');
if (!fs_1.default.existsSync(UPLOADED_GAMES_DIR)) {
    fs_1.default.mkdirSync(UPLOADED_GAMES_DIR, { recursive: true });
}
if (!fs_1.default.existsSync(RUNTIMES_DIR)) {
    fs_1.default.mkdirSync(RUNTIMES_DIR, { recursive: true });
}
if (!fs_1.default.existsSync(DATA_DIR)) {
    fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
}
// ─────────────────────────────────────────────
// Platform Data Service
// ─────────────────────────────────────────────
let db = { users: [], hierarchy: { cities: [], houses: [], rooms: [] }, games: [], instances: [] };
function loadDB() {
    if (fs_1.default.existsSync(DB_PATH)) {
        try {
            db = JSON.parse(fs_1.default.readFileSync(DB_PATH, 'utf-8'));
            console.log(`[DB] Database loaded: ${db.users.length} users found.`);
        }
        catch (e) {
            console.error('[DB] Error loading database:', e);
        }
    }
    else {
        console.warn(`[DB] Database file not found at ${DB_PATH}. Using empty state.`);
    }
}
function saveDB() {
    try {
        fs_1.default.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    }
    catch (e) {
        console.error('[DB] Error saving database:', e);
    }
}
// Initial load
loadDB();
// ─────────────────────────────────────────────
// Express App Setup
// ─────────────────────────────────────────────
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '50mb' }));
// Serve static files from public folder
app.use(express_1.default.static(PUBLIC_DIR));
// Root serves the player (Game Server is standalone)
app.get('/', (req, res) => {
    res.sendFile(path_1.default.join(PUBLIC_DIR, 'player.html'));
});
// Legacy /games endpoints removed - use /platform/games instead
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
            hasProject: !!room.project,
            hostName: room.metadata.hostName,
            hostAvatar: room.metadata.hostAvatar
        });
    });
    res.json(activeRooms);
});
// ─────────────────────────────────────────────
// Platform Role Hierarchy
// ─────────────────────────────────────────────
const ROLE_HIERARCHY = ['player', 'roomadmin', 'houseadmin', 'cityadmin', 'superadmin'];
function getAvailableRoles(role) {
    const level = ROLE_HIERARCHY.indexOf(role);
    if (level === -1)
        return ['player'];
    return ROLE_HIERARCHY.slice(0, level + 1).reverse();
}
// ─────────────────────────────────────────────
// Platform API Endpoints
// ─────────────────────────────────────────────
/**
 * POST /api/platform/login - Emoji-PIN Verification
 */
app.post('/api/platform/login', (req, res) => {
    let { name, authCode } = req.body; // authCode can be array or string
    if (!authCode) {
        return res.status(400).json({ error: 'Missing authCode' });
    }
    // Convert string to emoji array if needed
    let authArray = Array.isArray(authCode) ? authCode : [...authCode];
    const user = db.users.find((u) => {
        const pinMatch = JSON.stringify(u.authCode) === JSON.stringify(authArray);
        if (!name)
            return pinMatch;
        return pinMatch && u.name.toLowerCase() === name.toLowerCase();
    });
    if (user) {
        console.log(`[Platform] User logged in: ${user.name} (${user.role})`);
        res.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                role: user.role,
                avatar: user.avatar,
                availableRoles: getAvailableRoles(user.role)
            }
        });
    }
    else {
        res.status(401).json({ error: 'Invalid name or emoji code' });
    }
});
/**
 * GET /api/platform/context/:userId - Get full hierarchy context for a user
 */
app.get('/api/platform/context/:userId', (req, res) => {
    const { userId } = req.params;
    const user = db.users.find((u) => u.id === userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    const context = {
        user: { id: user.id, name: user.name, role: user.role, avatar: user.avatar },
        city: null,
        house: null,
        room: null
    };
    // Resolve hierarchy based on primary role level
    const findRoom = (id) => db.hierarchy.rooms.find((r) => r.id === id);
    const findHouse = (id) => db.hierarchy.houses.find((h) => h.id === id);
    const findCity = (id) => db.hierarchy.cities.find((c) => c.id === id);
    const roleLevel = ROLE_HIERARCHY.indexOf(user.role);
    // Players and RoomAdmins are attached to a Room
    if (roleLevel <= 1 && user.parentId) {
        context.room = findRoom(user.parentId);
        if (context.room) {
            context.house = findHouse(context.room.houseId);
            if (context.house)
                context.city = findCity(context.house.cityId);
        }
    }
    // HouseAdmins are attached to a House
    else if (roleLevel === 2 && user.parentId) {
        context.house = findHouse(user.parentId);
        if (context.house)
            context.city = findCity(context.house.cityId);
    }
    // CityAdmins are attached to a City
    else if (roleLevel === 3 && user.parentId) {
        context.city = findCity(user.parentId);
    }
    // Superadmins (level 4) have a global context (no parentId required)
    res.json(context);
});
/**
 * GET /api/platform/children?type=cities|houses|rooms&parentId=...
 * Returns children for a specific context
 */
app.get('/api/platform/children', (req, res) => {
    const { type, parentId } = req.query;
    if (type === 'cities') {
        return res.json(db.hierarchy.cities);
    }
    if (type === 'houses' && parentId) {
        return res.json(db.hierarchy.houses.filter((h) => h.cityId === parentId));
    }
    if (type === 'rooms' && parentId) {
        return res.json(db.hierarchy.rooms.filter((r) => r.houseId === parentId));
    }
    res.status(400).json({ error: 'Invalid type or missing parentId' });
});
/**
 * GET /platform/games - List uploaded games only
 */
app.get('/platform/games', (req, res) => {
    try {
        if (!fs_1.default.existsSync(UPLOADED_GAMES_DIR)) {
            return res.json([]);
        }
        const games = fs_1.default.readdirSync(UPLOADED_GAMES_DIR)
            .filter(f => f.endsWith('.json'))
            .map(f => {
            try {
                const content = JSON.parse(fs_1.default.readFileSync(path_1.default.join(UPLOADED_GAMES_DIR, f), 'utf-8'));
                // Handle compressed format
                if (content._compressed && content.data) {
                    // Decompress to get metadata
                    try {
                        const compressedBuffer = Buffer.from(content.data, 'base64');
                        const decompressed = zlib_1.default.gunzipSync(compressedBuffer);
                        const project = JSON.parse(decompressed.toString('utf-8'));
                        return {
                            file: f,
                            name: project.meta?.name || f.replace('.json', ''),
                            author: project.meta?.author || 'Unknown',
                            runtimeVersion: project.meta?.runtimeVersion || content._version || '1.0.0',
                            compressed: true
                        };
                    }
                    catch (e) {
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
            }
            catch {
                return null;
            }
        })
            .filter(g => g !== null);
        res.json(games);
    }
    catch (err) {
        console.error('[API] Error listing games:', err);
        res.status(500).json({ error: 'Failed to list games' });
    }
});
/**
 * GET /platform/games/:filename - Serve a specific game JSON
 */
app.get('/platform/games/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path_1.default.join(UPLOADED_GAMES_DIR, filename);
    if (fs_1.default.existsSync(filePath)) {
        const content = JSON.parse(fs_1.default.readFileSync(filePath, 'utf-8'));
        // Handle compressed format - decompress on-the-fly
        if (content._compressed && content.data) {
            try {
                const compressedBuffer = Buffer.from(content.data, 'base64');
                const decompressed = zlib_1.default.gunzipSync(compressedBuffer);
                const project = JSON.parse(decompressed.toString('utf-8'));
                console.log(`[API] Serving decompressed game: ${filename}`);
                res.json(project);
            }
            catch (e) {
                console.error(`[API] Error decompressing game ${filename}:`, e);
                res.status(500).json({ error: 'Failed to decompress game' });
            }
        }
        else {
            res.json(content);
        }
    }
    else {
        res.status(404).json({ error: 'Game not found' });
    }
});
/**
 * GET /api/images - List images in public/images
 */
app.get('/api/images', (req, res) => {
    const imagesDir = path_1.default.join(__dirname, '../../public/images');
    if (!fs_1.default.existsSync(imagesDir)) {
        return res.json([]);
    }
    const listFiles = (dir, base = '') => {
        const results = [];
        const files = fs_1.default.readdirSync(dir);
        files.forEach(file => {
            const filePath = path_1.default.join(dir, file);
            const relPath = base ? `${base}/${file}` : file;
            const stat = fs_1.default.statSync(filePath);
            if (stat.isDirectory()) {
                results.push({
                    name: file,
                    type: 'directory',
                    path: relPath,
                    children: listFiles(filePath, relPath)
                });
            }
            else if (/\.(png|jpe?g|gif|svg|webp)$/i.test(file)) {
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
    }
    catch (err) {
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
        const safeName = path_1.default.basename(filename).replace(/[^a-zA-Z0-9_.-]/g, '_');
        if (!safeName.endsWith('.json')) {
            return res.status(400).json({ error: 'Filename must end with .json' });
        }
        const filePath = path_1.default.join(UPLOADED_GAMES_DIR, safeName);
        fs_1.default.writeFileSync(filePath, JSON.stringify(content, null, 2));
        // For compressed format, extract game name for response
        let gameName = safeName.replace('.json', '');
        if (compressed && content._compressed && content.data) {
            try {
                const compressedBuffer = Buffer.from(content.data, 'base64');
                const decompressed = zlib_1.default.gunzipSync(compressedBuffer);
                const project = JSON.parse(decompressed.toString('utf-8'));
                gameName = project.meta?.name || gameName;
            }
            catch (e) {
                console.warn(`[API] Could not extract game name from compressed content:`, e);
            }
        }
        console.log(`[API] Game uploaded: ${safeName} (compressed: ${!!compressed})`);
        res.json({ success: true, filename: safeName, gameName });
    }
    catch (err) {
        console.error('[API] Error uploading game:', err);
        res.status(500).json({ error: 'Failed to upload game' });
    }
});
/**
 * DELETE /platform/games/:filename - Delete a game
 */
app.delete('/platform/games/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path_1.default.join(UPLOADED_GAMES_DIR, filename);
    if (fs_1.default.existsSync(filePath)) {
        fs_1.default.unlinkSync(filePath);
        console.log(`[API] Game deleted: ${filename}`);
        res.json({ success: true });
    }
    else {
        res.status(404).json({ error: 'Game not found' });
    }
});
/**
 * POST /api/library/tasks - Add/update a task in library.json
 */
app.post('/api/library/tasks', (req, res) => {
    try {
        const task = req.body;
        if (!task || !task.name) {
            return res.status(400).json({ error: 'Missing task data or task name' });
        }
        const libraryPath = path_1.default.join(PUBLIC_DIR, 'library.json');
        let library = { tasks: [] };
        if (fs_1.default.existsSync(libraryPath)) {
            library = JSON.parse(fs_1.default.readFileSync(libraryPath, 'utf-8'));
        }
        // Find existing task or add new
        const existingIdx = library.tasks.findIndex(t => t.name === task.name);
        if (existingIdx !== -1) {
            library.tasks[existingIdx] = task;
            console.log(`[API] Library: Updated task "${task.name}"`);
        }
        else {
            library.tasks.push(task);
            console.log(`[API] Library: Added new task "${task.name}"`);
        }
        fs_1.default.writeFileSync(libraryPath, JSON.stringify(library, null, 4));
        res.json({ success: true, taskName: task.name });
    }
    catch (err) {
        console.error('[API] Error updating library:', err);
        res.status(500).json({ error: 'Failed to update library' });
    }
});
/**
 * POST /api/library/templates - Add/update a template in library.json
 */
app.post('/api/library/templates', (req, res) => {
    try {
        const template = req.body;
        if (!template || !template.name) {
            return res.status(400).json({ error: 'Missing template data or template name' });
        }
        const libraryPath = path_1.default.join(PUBLIC_DIR, 'library.json');
        let library = { tasks: [], templates: [] };
        if (fs_1.default.existsSync(libraryPath)) {
            const content = fs_1.default.readFileSync(libraryPath, 'utf-8');
            library = JSON.parse(content);
            if (!library.templates)
                library.templates = [];
        }
        // Find existing template or add new
        const existingIdx = library.templates.findIndex(t => t.name === template.name);
        if (existingIdx !== -1) {
            library.templates[existingIdx] = template;
            console.log(`[API] Library: Updated template "${template.name}"`);
        }
        else {
            library.templates.push(template);
            console.log(`[API] Library: Added new template "${template.name}"`);
        }
        fs_1.default.writeFileSync(libraryPath, JSON.stringify(library, null, 4));
        res.json({ success: true, templateName: template.name });
    }
    catch (err) {
        console.error('[API] Error updating library:', err);
        res.status(500).json({ error: 'Failed to update library' });
    }
});
/**
 * GET /runtimes/:version - Get runtime JS for a specific version
 * Auto-fetches from Builder if not cached
 */
app.get('/runtimes/:version', async (req, res) => {
    let version = req.params.version;
    // Cleanup version string (e.g. "v1.0.0.js" -> "1.0.0")
    version = version.replace(/^v/, '').replace(/\.js$/, '');
    const runtimePath = path_1.default.join(RUNTIMES_DIR, `v${version}.js`);
    const isLocalhost = BUILDER_URL.includes('localhost') || BUILDER_URL.includes('127.0.0.1');
    // Check if we have this version cached
    if (fs_1.default.existsSync(runtimePath)) {
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
            fs_1.default.writeFileSync(runtimePath, code);
            console.log(`[API] Runtime v${version} cached`);
            res.setHeader('Content-Type', 'application/javascript');
            res.send(code);
        }
        else {
            console.error(`[API] Failed to fetch runtime from Builder: ${resp.status}`);
            res.status(502).json({ error: 'Failed to fetch runtime from Builder' });
        }
    }
    catch (err) {
        console.error('[API] Error fetching runtime:', err);
        res.status(502).json({ error: 'Builder not reachable' });
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
            // Platform: Store host metadata
            if (msg.hostName) {
                room.metadata.hostName = msg.hostName;
                room.metadata.hostAvatar = msg.hostAvatar;
            }
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
                    });
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
                    });
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
                    });
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
                    });
                }
            }
            break;
        }
        case 'ping': {
            // Heartbeat ping - respond with pong immediately
            ws.send((0, Protocol_1.serialize)({
                type: 'pong',
                timestamp: msg.timestamp,
                serverTime: Date.now()
            }));
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
    console.log(`   Games dir: ${UPLOADED_GAMES_DIR}`);
    console.log(`   Runtimes:  ${RUNTIMES_DIR}`);
});

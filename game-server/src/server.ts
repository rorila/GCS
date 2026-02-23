import WebSocket, { WebSocketServer } from 'ws';
import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import { Room } from './Room';
import { parse, serialize, ClientMessage } from './Protocol';
import jwt from 'jsonwebtoken';

/**
 * Multiplayer Game Server
 * 
 * Features:
 * - WebSocket for real-time game communication
 * - REST API for lobby (game list, waiting rooms)
 * - Static file serving for games
 */

const PORT = parseInt(process.env.PORT || '8080');
const PUBLIC_DIR = path.join(__dirname, '../public');

// Builder URL for fetching runtime versions (only used when runtime is missing)
const BUILDER_URL = process.env.BUILDER_URL || 'http://localhost:5173';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-prod';

const rooms = new Map<string, Room>();
const playerRooms = new Map<WebSocket, Room>();

// Platform directories - ONLY uploaded games, no demos dependency
const UPLOADED_GAMES_DIR = path.join(__dirname, '../../uploaded_games');
const RUNTIMES_DIR = path.join(__dirname, '../runtimes');
const DATA_DIR = path.join(__dirname, '../data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(UPLOADED_GAMES_DIR)) {
    fs.mkdirSync(UPLOADED_GAMES_DIR, { recursive: true });
}
if (!fs.existsSync(RUNTIMES_DIR)) {
    fs.mkdirSync(RUNTIMES_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ─────────────────────────────────────────────
// Platform Data Service
// ─────────────────────────────────────────────
let db: any = { users: [], hierarchy: { cities: [], houses: [], rooms: [] }, games: [], instances: [] };

function loadDB() {
    if (fs.existsSync(DB_PATH)) {
        try {
            db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
            console.log(`[DB] Database loaded: ${db.users.length} users found.`);
        } catch (e) {
            console.error('[DB] Error loading database:', e);
        }
    } else {
        console.warn(`[DB] Database file not found at ${DB_PATH}. Using empty state.`);
    }
}

function saveDB() {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    } catch (e) {
        console.error('[DB] Error saving database:', e);
    }
}

// Initial load
loadDB();

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

function getAvailableRoles(role: string): string[] {
    const level = ROLE_HIERARCHY.indexOf(role);
    if (level === -1) return ['player'];
    return ROLE_HIERARCHY.slice(0, level + 1).reverse();
}

// ─────────────────────────────────────────────
// Middleware: Authenticate Token
// ─────────────────────────────────────────────
const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
        if (err) return res.sendStatus(403);
        (req as any).user = user;
        next();
    });
};

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

    const user = db.users.find((u: any) => {
        const pinMatch = JSON.stringify(u.authCode) === JSON.stringify(authArray);
        if (!name) return pinMatch;
        return pinMatch && u.name.toLowerCase() === name.toLowerCase();
    });

    if (user) {
        console.log(`[Platform] User logged in: ${user.name} (${user.role})`);

        // Generate JWT
        const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET);

        res.json({
            success: true,
            token, // Send token to client
            user: { name: user.name, role: user.role }
        });
    } else {
        res.status(401).json({ message: 'Ungültiger PIN' });
    }
});

/**
 * POST /api/dev/save-project - Speichert die project.json auf Disk
 * NUR FÜR ENTWICKLUNGSZWECKE (Dev-Mode)
 */
app.post('/api/dev/save-project', (req, res) => {
    try {
        const projectData = req.body;
        if (!projectData || typeof projectData !== 'object') {
            return res.status(400).json({ error: 'Ungültige Projektdaten' });
        }

        const projectPath = path.join(PUBLIC_DIR, 'platform/project.json');

        // Sicherheits-Check: Verzeichnis sicherstellen
        const dir = path.dirname(projectPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(projectPath, JSON.stringify(projectData, null, 2), 'utf-8');
        console.log(`[API] Project saved successfully to ${projectPath}`);
        res.json({ success: true, message: 'Projekt erfolgreich gespeichert' });
    } catch (err) {
        console.error('[API] Fehler beim Speichern des Projekts:', err);
        res.status(500).json({ error: 'Serverfehler beim Speichervorgang', details: (err as any).message });
    }
});

/**
 * GET /api/platform/context/:userId - Get full hierarchy context for a user
 */
app.get('/api/platform/context/:userId', (req, res) => {
    const { userId } = req.params;
    const user = db.users.find((u: any) => u.id === userId);

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    const context: any = {
        user: { id: user.id, name: user.name, role: user.role, avatar: user.avatar },
        city: null,
        house: null,
        room: null
    };

    // Resolve hierarchy based on primary role level
    const findRoom = (id: string) => db.hierarchy.rooms.find((r: any) => r.id === id);
    const findHouse = (id: string) => db.hierarchy.houses.find((h: any) => h.id === id);
    const findCity = (id: string) => db.hierarchy.cities.find((c: any) => c.id === id);

    const roleLevel = ROLE_HIERARCHY.indexOf(user.role);

    // Players and RoomAdmins are attached to a Room
    if (roleLevel <= 1 && user.parentId) {
        context.room = findRoom(user.parentId);
        if (context.room) {
            context.house = findHouse(context.room.houseId);
            if (context.house) context.city = findCity(context.house.cityId);
        }
    }
    // HouseAdmins are attached to a House
    else if (roleLevel === 2 && user.parentId) {
        context.house = findHouse(user.parentId);
        if (context.house) context.city = findCity(context.house.cityId);
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
        return res.json(db.hierarchy.houses.filter((h: any) => h.cityId === parentId));
    }

    if (type === 'rooms' && parentId) {
        return res.json(db.hierarchy.rooms.filter((r: any) => r.houseId === parentId));
    }

    res.status(400).json({ error: 'Invalid type or missing parentId' });
});

/**
 * POST /api/platform/rooms - Create a new room
 */
/**
 * POST /api/platform/rooms - Create a new room
 * PROTECTED: Requires valid JWT
 */
app.post('/api/platform/rooms', authenticateToken, (req, res) => {
    const { name, houseId, adminId } = req.body;

    if (!name || !houseId || !adminId) {
        return res.status(400).json({ error: 'Missing name, houseId or adminId' });
    }

    const newRoom: any = {
        id: `room_${Math.floor(Math.random() * 1000000)}`,
        name,
        houseId,
        adminId,
        config: {}
    };

    // 1. Add to hierarchy
    if (!db.hierarchy.rooms) db.hierarchy.rooms = [];
    db.hierarchy.rooms.push(newRoom);

    // 2. Update Admin User
    const admin = db.users.find((u: any) => u.id === adminId);
    if (admin) {
        if (!admin.managedRooms) admin.managedRooms = [];
        if (!admin.managedRooms.includes(newRoom.id)) {
            admin.managedRooms.push(newRoom.id);
        }
    }

    saveDB();

    console.log(`[Platform] Room created: ${newRoom.name} (${newRoom.id}) for admin ${adminId}`);
    res.json(newRoom);
});

/**
 * GET /api/dev/data/:file - Get a raw data file (Development only)
 * Used to sync server-side data (like users.json) with Editor simulator.
 */
app.get('/api/dev/data/:file', (req, res) => {
    const filename = req.params.file;
    const filePath = path.join(DATA_DIR, filename);

    if (fs.existsSync(filePath)) {
        try {
            const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            res.json(content);
        } catch (e) {
            res.status(500).json({ error: 'Failed to parse data file' });
        }
    } else {
        res.status(404).json({ error: 'Data file not found' });
    }
});

/**
 * GET /api/platform/resources - List all available data resources
 */
app.get('/api/platform/resources', (req, res) => {
    const resources = new Set<string>();

    // Top-level keys from db
    Object.keys(db).forEach(key => {
        if (Array.isArray(db[key])) resources.add(key);
    });

    // Hierarchy keys
    if (db.hierarchy) {
        Object.keys(db.hierarchy).forEach(key => {
            if (Array.isArray(db.hierarchy[key])) resources.add(key);
        });
    }

    res.json(Array.from(resources).sort());
});

/**
 * Helper: Recursively gets all paths in an object
 */
function getDeepPaths(obj: any, prefix: string = ''): string[] {
    let paths: string[] = [];
    if (!obj || typeof obj !== 'object') return paths;

    Object.keys(obj).forEach(key => {
        const path = prefix ? `${prefix}.${key}` : key;
        paths.push(path);

        const val = obj[key];
        if (val && typeof val === 'object' && !Array.isArray(val)) {
            paths = paths.concat(getDeepPaths(val, path));
        }
    });
    return paths;
}

/**
 * GET /api/platform/resources/:resource/properties - List properties of a resource
 */
app.get('/api/platform/resources/:resource/properties', (req, res) => {
    const { resource } = req.params;
    let data = db[resource];
    if (!data && db.hierarchy && db.hierarchy[resource]) {
        data = db.hierarchy[resource];
    }

    if (data && Array.isArray(data) && data.length > 0) {
        // Scan first item to get all deep paths
        const firstItem = data[0];
        const properties = getDeepPaths(firstItem).sort();
        res.json(properties);
    } else {
        res.json([]); // Return empty list if no data or not found
    }
});

/**
 * Generic Data API
 */
app.get('/api/data/:resource', (req, res) => {
    const { resource } = req.params;
    const query = req.query;

    let data = db[resource];

    if (!data && db.hierarchy && db.hierarchy[resource]) {
        data = db.hierarchy[resource];
    }

    if (data && Array.isArray(data)) {
        // Simple query filtering
        let filtered = data;
        if (Object.keys(query).length > 0) {
            filtered = data.filter((item: any) => {
                return Object.entries(query).every(([key, val]) => {
                    const itemVal = item[key];
                    // Handle array comparisons (e.g. authCode)
                    if (Array.isArray(itemVal)) {
                        try {
                            const targetArr = Array.isArray(val) ? val : (typeof val === 'string' && val.startsWith('[') ? JSON.parse(val) : [val]);
                            return JSON.stringify(itemVal) === JSON.stringify(targetArr);
                        } catch (e) { return false; }
                    }
                    return String(itemVal) === String(val);
                });
            });
        }
        res.json(filtered);
    } else {
        res.status(404).json({ error: `Resource '${resource}' not found or not an array` });
    }
});

/**
 * GET /api/data/:resource/:id - Get a specific item
 */
app.get('/api/data/:resource/:id', (req, res) => {
    const { resource, id } = req.params;
    let data = db[resource];
    if (!data && db.hierarchy && db.hierarchy[resource]) {
        data = db.hierarchy[resource];
    }

    if (data && Array.isArray(data)) {
        const item = data.find((i: any) => String(i.id) === String(id));
        if (item) res.json(item);
        else res.status(404).json({ error: 'Item not found' });
    } else {
        res.status(404).json({ error: `Resource '${resource}' not found` });
    }
});

app.post('/api/data/:resource', (req, res) => {
    const { resource } = req.params;
    const newItem = req.body;

    let target = db[resource];
    let isHierarchy = false;

    if (!target && db.hierarchy && db.hierarchy[resource]) {
        target = db.hierarchy[resource];
        isHierarchy = true;
    }

    if (target && Array.isArray(target)) {
        // Simple auto-id if missing
        if (!newItem.id) {
            newItem.id = `${resource}_${Date.now()}`;
        }
        target.push(newItem);
        saveDB();
        res.json({ success: true, item: newItem });
    } else {
        res.status(404).json({ error: `Resource '${resource}' not found` });
    }
});

app.delete('/api/data/:resource/:id', (req, res) => {
    const { resource, id } = req.params;
    let target = db[resource];

    if (!target && db.hierarchy && db.hierarchy[resource]) {
        target = db.hierarchy[resource];
    }

    if (target && Array.isArray(target)) {
        const idx = target.findIndex((item: any) => String(item.id) === String(id));
        if (idx !== -1) {
            target.splice(idx, 1);
            saveDB();
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Item not found' });
        }
    } else {
        res.status(404).json({ error: `Resource '${resource}' not found` });
    }
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
 * POST /api/library/tasks - Add/update a task in library.json
 */
app.post('/api/library/tasks', (req, res) => {
    try {
        const task = req.body;
        if (!task || !task.name) {
            return res.status(400).json({ error: 'Missing task data or task name' });
        }

        const libraryPath = path.join(PUBLIC_DIR, 'library.json');
        let library: { tasks: any[] } = { tasks: [] };

        if (fs.existsSync(libraryPath)) {
            library = JSON.parse(fs.readFileSync(libraryPath, 'utf-8'));
        }

        // Find existing task or add new
        const existingIdx = library.tasks.findIndex(t => t.name === task.name);
        if (existingIdx !== -1) {
            library.tasks[existingIdx] = task;
            console.log(`[API] Library: Updated task "${task.name}"`);
        } else {
            library.tasks.push(task);
            console.log(`[API] Library: Added new task "${task.name}"`);
        }

        fs.writeFileSync(libraryPath, JSON.stringify(library, null, 4));
        res.json({ success: true, taskName: task.name });
    } catch (err) {
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

        const libraryPath = path.join(PUBLIC_DIR, 'library.json');
        let library: { tasks: any[], templates: any[] } = { tasks: [], templates: [] };

        if (fs.existsSync(libraryPath)) {
            const content = fs.readFileSync(libraryPath, 'utf-8');
            library = JSON.parse(content);
            if (!library.templates) library.templates = [];
        }

        // Find existing template or add new
        const existingIdx = library.templates.findIndex(t => t.name === template.name);
        if (existingIdx !== -1) {
            library.templates[existingIdx] = template;
            console.log(`[API] Library: Updated template "${template.name}"`);
        } else {
            library.templates.push(template);
            console.log(`[API] Library: Added new template "${template.name}"`);
        }

        fs.writeFileSync(libraryPath, JSON.stringify(library, null, 4));
        res.json({ success: true, templateName: template.name });
    } catch (err) {
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

    const runtimePath = path.join(RUNTIMES_DIR, `v${version}.js`);

    const isLocalhost = BUILDER_URL.includes('localhost') || BUILDER_URL.includes('127.0.0.1');

    // Check if we have this version cached
    if (fs.existsSync(runtimePath)) {
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

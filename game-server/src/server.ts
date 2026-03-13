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
 * Backup-Rotation: Benennt eine vorhandene Datei in .bakN um (hochzählend).
 * Beispiel: project.json → project.json.bak1, .bak2, .bak3, ...
 */
function rotateBackup(filePath: string): string | null {
    if (!fs.existsSync(filePath)) return null;

    let bakIndex = 1;
    while (fs.existsSync(`${filePath}.bak${bakIndex}`)) {
        bakIndex++;
    }
    const bakPath = `${filePath}.bak${bakIndex}`;
    fs.renameSync(filePath, bakPath);
    console.log(`[Backup] ${path.basename(filePath)} → ${path.basename(bakPath)}`);
    return bakPath;
}

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

        const actionCount = projectData.actions?.length || 0;
        const taskCount = projectData.tasks?.length || 0;
        const stageCount = projectData.stages?.length || 0;

        console.log(`[TRACE] [API] Saving project to ${projectPath}`);
        console.log(`[TRACE] [API] Data summary: Actions=${actionCount}, Tasks=${taskCount}, Stages=${stageCount}`);

        // _sourcePath in Metadaten schreiben (damit loadProject den Quellpfad kennt)
        if (projectData.meta) {
            projectData.meta._sourcePath = 'game-server/public/platform/project.json';
        }

        // KEIN rotateBackup hier! save-project ist AutoSave und wird ständig aufgerufen.
        // Backup-Rotation nur beim expliziten Speichern via save-custom.

        fs.writeFileSync(projectPath, JSON.stringify(projectData, null, 2), 'utf-8');
        console.log(`[TRACE] [API] Project saved successfully.`);
        res.json({ success: true, message: 'Projekt erfolgreich gespeichert' });
    } catch (err) {
        console.error('[TRACE] [API] Fehler beim Speichern des Projekts:', err);
        res.status(500).json({ error: 'Serverfehler beim Speichervorgang', details: (err as any).message });
    }
});

/**
 * POST /api/dev/reset-project - Setzt die project.json auf den Template-Zustand zurück
 * NUR FÜR E2E-TESTS
 */
app.post('/api/dev/reset-project', (req, res) => {
    try {
        const projectPath = path.join(PUBLIC_DIR, 'platform/project.json');
        const templatePath = path.join(PUBLIC_DIR, 'platform/project_template.json');

        if (!fs.existsSync(templatePath)) {
            console.error(`[TRACE] [API] Reset failed: Template not found at ${templatePath}`);
            return res.status(404).json({ error: 'Projekt-Template nicht gefunden' });
        }

        fs.copyFileSync(templatePath, projectPath);
        console.log(`[TRACE] [API] Project reset to template state.`);
        res.json({ success: true, message: 'Projekt erfolgreich zurückgesetzt' });
    } catch (err) {
        console.error('[TRACE] [API] Fehler beim Reset des Projekts:', err);
        res.status(500).json({ error: 'Serverfehler beim Reset', details: (err as any).message });
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
 * GET /api/dev/list-projects - Listet alle Ordner und JSON-Dateien unter projects/
 */
app.get('/api/dev/list-projects', (_req, res) => {
    try {
        const projectsRoot = path.resolve(__dirname, '../../projects');
        if (!fs.existsSync(projectsRoot)) {
            return res.json({ folders: [] });
        }

        const entries = fs.readdirSync(projectsRoot, { withFileTypes: true });
        const folders = entries
            .filter(e => e.isDirectory())
            .map(dir => {
                const dirPath = path.join(projectsRoot, dir.name);
                const files = fs.readdirSync(dirPath)
                    .filter(f => f.endsWith('.json'));
                return { name: dir.name, files };
            });

        res.json({ folders });
    } catch (e) {
        console.error('[Dev] Error listing projects:', e);
        res.status(500).json({ error: 'Fehler beim Auflisten der Projekte' });
    }
});

/**
 * POST /api/dev/check-exists - Prüft ob eine Datei im Projekt-Verzeichnis existiert
 */
app.post('/api/dev/check-exists', (req, res) => {
    try {
        const { filePath } = req.body;
        if (!filePath || typeof filePath !== 'string') {
            return res.status(400).json({ error: 'Ungültiger Pfad' });
        }

        // Sicherheits-Check: Nur Dateien im game-builder-v1/projects zulassen
        const absolutePath = path.resolve(__dirname, '../../', filePath);
        const projectsRoot = path.resolve(__dirname, '../../projects');

        if (!absolutePath.startsWith(projectsRoot)) {
            return res.status(403).json({ error: 'Zugriff verweigert: Pfad außerhalb des Projekt-Ordners' });
        }

        const exists = fs.existsSync(absolutePath);
        res.json({ exists });
    } catch (e) {
        res.status(500).json({ error: 'Fehler beim Prüfen der Datei-Existenz' });
    }
});


/**
 * POST /api/dev/save-custom - Speichert Projektdaten an einen benutzerdefinierten Ort
 */
app.post('/api/dev/save-custom', (req, res) => {
    try {
        const { filePath, projectData } = req.body;
        if (!filePath || !projectData) {
            return res.status(400).json({ error: 'Ungültige Parameter' });
        }

        // Sicherheits-Check: Dateien im projects/ ODER game-server/public/ Ordner zulassen
        const absolutePath = path.resolve(__dirname, '../../', filePath);
        const projectsRoot = path.resolve(__dirname, '../../projects');
        const publicRoot = path.resolve(__dirname, '../public');

        if (!absolutePath.startsWith(projectsRoot) && !absolutePath.startsWith(publicRoot)) {
            return res.status(403).json({ error: 'Zugriff verweigert: Pfad außerhalb des erlaubten Bereichs' });
        }

        // Verzeichnis sicherstellen
        const dir = path.dirname(absolutePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // _sourcePath in Metadaten schreiben (damit loadProject den Quellpfad kennt)
        if (projectData.meta) {
            projectData.meta._sourcePath = filePath;
        }

        // Backup-Rotation: Vorhandene Datei umbenennen
        rotateBackup(absolutePath);

        fs.writeFileSync(absolutePath, JSON.stringify(projectData, null, 2));
        console.log(`[Dev] Project saved to custom path: ${filePath}`);
        res.json({ success: true });
    } catch (e) {
        console.error('[Dev] Error in save-custom:', e);
        res.status(500).json({ error: 'Fehler beim benutzerdefinierten Speichern' });
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
// Agent API Endpoint (Dev-Mode Only)
// ─────────────────────────────────────────────

/**
 * POST /api/agent/:method - Ruft AgentController-Methoden auf.
 * 
 * Request:  { params: [...] }
 * Response: { success: boolean, data: any, error?: string }
 * 
 * Der Endpoint lädt die project.json, erstellt einen lokalen AgentController,
 * führt die Methode aus und speichert das Ergebnis zurück.
 * NUR im Dev-Modus verfügbar!
 */

// Whitelist der erlaubten Methoden (Sicherheit)
const AGENT_METHODS: Record<string, boolean> = {
    // Projekt-Struktur
    createStage: true, addObject: true, addVariable: true,
    // Task-Management
    createTask: true, addTaskCall: true, setTaskTriggerMode: true,
    addTaskParam: true, moveActionInSequence: true,
    // Action-Management
    addAction: true, deleteAction: true,
    // Branch-Management
    addBranch: true,
    // Delete
    deleteTask: true, removeObject: true, deleteStage: true, deleteVariable: true,
    // Rename
    renameTask: true, renameAction: true,
    // Read (Inventar)
    listStages: true, listTasks: true, listActions: true, listVariables: true,
    listObjects: true, getTaskDetails: true,
    // UI
    setProperty: true, bindVariable: true, connectEvent: true,
    // Workflow
    duplicateTask: true, generateTaskFlow: true,
    // Validation
    validate: true,
};

app.post('/api/agent/:method', (req, res) => {
    const method = req.params.method;
    const params: any[] = req.body?.params || [];

    // 1. Methode prüfen
    if (!AGENT_METHODS[method]) {
        return res.status(400).json({
            success: false,
            data: null,
            error: `Unbekannte Methode: '${method}'. Erlaubt: ${Object.keys(AGENT_METHODS).join(', ')}`
        });
    }

    // 2. Projekt laden
    const projectPath = path.resolve(PUBLIC_DIR, 'project.json');
    if (!fs.existsSync(projectPath)) {
        return res.status(404).json({
            success: false,
            data: null,
            error: 'project.json nicht gefunden.'
        });
    }

    try {
        const projectData = JSON.parse(fs.readFileSync(projectPath, 'utf-8'));

        // 3. Leichtgewichtigen AgentController simulieren
        // Da der echte AgentController im Frontend-Bundle lebt,
        // simulieren wir die Methoden direkt auf dem JSON.
        const controller = createServerSideAgentController(projectData);

        // 4. Methode aufrufen
        const fn = (controller as any)[method];
        if (typeof fn !== 'function') {
            return res.status(400).json({
                success: false,
                data: null,
                error: `Methode '${method}' nicht implementiert auf dem Server.`
            });
        }

        const result = fn.apply(controller, params);

        // 5. Projekt speichern (nur bei Schreib-Methoden)
        const readOnlyMethods = ['listStages', 'listTasks', 'listActions', 'listVariables', 'listObjects', 'getTaskDetails', 'validate'];
        if (!readOnlyMethods.includes(method)) {
            fs.writeFileSync(projectPath, JSON.stringify(projectData, null, 2));
            console.log(`[Agent API] ${method}(${params.map(p => typeof p === 'string' ? `"${p}"` : JSON.stringify(p)).join(', ')}) → OK. Projekt gespeichert.`);
        } else {
            console.log(`[Agent API] ${method}() → Gelesen.`);
        }

        res.json({ success: true, data: result ?? null, error: null });
    } catch (err: any) {
        console.error(`[Agent API] Fehler bei ${method}():`, err.message);
        res.status(500).json({
            success: false,
            data: null,
            error: err.message || String(err)
        });
    }
});

/**
 * Erstellt einen serverseitigen "Mini-AgentController" der direkt auf dem JSON operiert.
 * Implementiert die wichtigsten Methoden für den REST-Zugang.
 */
function createServerSideAgentController(project: any) {
    // Hilfsfunktionen
    const findStage = (id: string) => project.stages?.find((s: any) => s.id === id || s.name === id);
    const findTask = (name: string): any => {
        const inRoot = project.tasks?.find((t: any) => t.name === name);
        if (inRoot) return inRoot;
        for (const s of (project.stages || [])) {
            const t = s.tasks?.find((t: any) => t.name === name);
            if (t) return t;
        }
        return undefined;
    };
    const findAction = (name: string): any => {
        const inRoot = project.actions?.find((a: any) => a.name === name);
        if (inRoot) return inRoot;
        for (const s of (project.stages || [])) {
            const a = s.actions?.find((a: any) => a.name === name);
            if (a) return a;
        }
        return undefined;
    };
    const blueprintStage = () => project.stages?.find((s: any) => s.type === 'blueprint');

    return {
        // === Projekt-Struktur ===
        createStage(id: string, name: string, type: string = 'standard') {
            if (!project.stages) project.stages = [];
            if (project.stages.find((s: any) => s.id === id)) return;
            project.stages.push({ id, name, type, objects: [], tasks: [], actions: [], variables: [], flowCharts: {}, events: {} });
        },
        addObject(stageId: string, objectData: any) {
            const stage = findStage(stageId);
            if (!stage) throw new Error(`Stage '${stageId}' nicht gefunden.`);
            if (!stage.objects) stage.objects = [];
            stage.objects.push(objectData);
        },
        addVariable(name: string, type: string, initialValue: any, scope: string = 'global') {
            if (!project.variables) project.variables = [];
            const existing = project.variables.find((v: any) => v.name === name);
            if (existing) { existing.type = type; existing.initialValue = initialValue; existing.defaultValue = initialValue; }
            else project.variables.push({ name, type, initialValue, defaultValue: initialValue, scope });
        },

        // === Task-Management ===
        createTask(stageId: string, taskName: string, description: string = '') {
            if (findTask(taskName)) return taskName;
            const newTask = { name: taskName, description, actionSequence: [], triggerMode: 'local-sync', params: [] };
            const stage = findStage(stageId || 'stage_blueprint');
            if (stage) { if (!stage.tasks) stage.tasks = []; stage.tasks.push(newTask); }
            else { if (!project.tasks) project.tasks = []; project.tasks.push(newTask); }
            return taskName;
        },
        addTaskCall(taskName: string, calledTaskName: string) {
            const task = findTask(taskName);
            if (!task) throw new Error(`Task '${taskName}' nicht gefunden.`);
            task.actionSequence.push({ type: 'task', name: calledTaskName });
        },
        setTaskTriggerMode(taskName: string, mode: string) {
            const task = findTask(taskName);
            if (!task) throw new Error(`Task '${taskName}' nicht gefunden.`);
            task.triggerMode = mode;
        },
        addTaskParam(taskName: string, paramName: string, type: string = 'string', defaultValue: any = '') {
            const task = findTask(taskName);
            if (!task) throw new Error(`Task '${taskName}' nicht gefunden.`);
            if (!task.params) task.params = [];
            const existing = task.params.find((p: any) => p.name === paramName);
            if (existing) { existing.type = type; existing.defaultValue = defaultValue; }
            else task.params.push({ name: paramName, type, defaultValue });
        },
        moveActionInSequence(taskName: string, fromIndex: number, toIndex: number) {
            const task = findTask(taskName);
            if (!task) throw new Error(`Task '${taskName}' nicht gefunden.`);
            const [item] = task.actionSequence.splice(fromIndex, 1);
            task.actionSequence.splice(toIndex, 0, item);
        },

        // === Action-Management ===
        addAction(taskName: string, actionType: string, actionName: string, params: any = {}) {
            const task = findTask(taskName);
            if (!task) throw new Error(`Task '${taskName}' nicht gefunden.`);
            if (!findAction(actionName)) {
                const bp = blueprintStage();
                const actionDef = { name: actionName, type: actionType, ...params };
                if (bp) { if (!bp.actions) bp.actions = []; bp.actions.push(actionDef); }
                else { if (!project.actions) project.actions = []; project.actions.push(actionDef); }
            }
            task.actionSequence.push({ type: 'action', name: actionName });
        },
        deleteAction(actionName: string) {
            project.stages?.forEach((s: any) => { if (s.actions) s.actions = s.actions.filter((a: any) => a.name !== actionName); });
            if (project.actions) project.actions = project.actions.filter((a: any) => a.name !== actionName);
        },

        // === Delete ===
        deleteTask(taskName: string) {
            project.stages?.forEach((s: any) => { if (s.tasks) s.tasks = s.tasks.filter((t: any) => t.name !== taskName); });
            if (project.tasks) project.tasks = project.tasks.filter((t: any) => t.name !== taskName);
        },
        removeObject(stageId: string, objectName: string) {
            const stage = findStage(stageId);
            if (!stage?.objects) return;
            stage.objects = stage.objects.filter((o: any) => o.name !== objectName);
        },
        deleteStage(stageId: string) {
            const stage = findStage(stageId);
            if (stage?.type === 'blueprint') throw new Error('Blueprint-Stage kann nicht gelöscht werden.');
            project.stages = project.stages?.filter((s: any) => s.id !== stageId) || [];
        },
        deleteVariable(variableName: string) {
            if (project.variables) project.variables = project.variables.filter((v: any) => v.name !== variableName);
        },

        // === Rename ===
        renameTask(oldName: string, newName: string) {
            const task = findTask(oldName);
            if (!task) return false;
            task.name = newName;
            return true;
        },
        renameAction(oldName: string, newName: string) {
            const action = findAction(oldName);
            if (!action) return false;
            action.name = newName;
            return true;
        },

        // === Read ===
        listStages() {
            return (project.stages || []).map((s: any) => ({
                id: s.id, name: s.name, type: s.type || 'standard',
                objectCount: (s.objects || []).length, taskCount: (s.tasks || []).length
            }));
        },
        listTasks(stageId?: string) {
            let tasks: any[] = [];
            if (stageId) { const s = findStage(stageId); tasks = s?.tasks || []; }
            else { tasks = [...(project.tasks || []), ...(project.stages?.flatMap((s: any) => s.tasks || []) || [])]; }
            return tasks.map((t: any) => ({ name: t.name, actionCount: t.actionSequence?.length || 0, triggerMode: t.triggerMode || 'local-sync' }));
        },
        listActions(stageId?: string) {
            let actions: any[] = [];
            if (stageId) { const s = findStage(stageId); actions = s?.actions || []; }
            else { actions = [...(project.actions || []), ...(project.stages?.flatMap((s: any) => s.actions || []) || [])]; }
            return actions.map((a: any) => ({ name: a.name, type: a.type }));
        },
        listVariables() {
            const vars: any[] = [];
            (project.variables || []).forEach((v: any) => vars.push({ name: v.name, type: v.type, value: v.defaultValue ?? v.initialValue, scope: 'global' }));
            project.stages?.forEach((s: any) => { (s.variables || []).forEach((v: any) => vars.push({ name: v.name, type: v.type, value: v.defaultValue ?? v.initialValue, scope: s.id })); });
            return vars;
        },
        listObjects(stageId: string) {
            const s = findStage(stageId);
            return (s?.objects || []).map((o: any) => ({ name: o.name, className: o.className, x: o.x || 0, y: o.y || 0, visible: o.visible !== false }));
        },
        getTaskDetails(taskName: string) {
            const task = findTask(taskName);
            if (!task) return null;
            return { name: task.name, description: task.description || '', sequence: task.actionSequence, triggerMode: task.triggerMode || 'local-sync' };
        },

        // === UI ===
        setProperty(stageId: string, objectName: string, property: string, value: any) {
            const stage = findStage(stageId);
            if (!stage) throw new Error(`Stage '${stageId}' nicht gefunden.`);
            const obj = (stage.objects || []).find((o: any) => o.name === objectName);
            if (!obj) throw new Error(`Object '${objectName}' nicht gefunden.`);
            const parts = property.split('.');
            let target = obj;
            for (let i = 0; i < parts.length - 1; i++) { if (!target[parts[i]]) target[parts[i]] = {}; target = target[parts[i]]; }
            target[parts[parts.length - 1]] = value;
        },
        bindVariable(stageId: string, objectName: string, property: string, expression: string) {
            if (!expression.startsWith('${')) expression = '${' + expression + '}';
            this.setProperty(stageId, objectName, property, expression);
        },
        connectEvent(stageId: string, objectName: string, eventName: string, taskName: string) {
            const stage = findStage(stageId);
            if (!stage) throw new Error(`Stage '${stageId}' nicht gefunden.`);
            const obj = (stage.objects || []).find((o: any) => o.name === objectName);
            if (!obj) throw new Error(`Object '${objectName}' nicht gefunden.`);
            if (!obj.events) obj.events = {};
            obj.events[eventName] = taskName;
        },

        // === Workflow ===
        duplicateTask(taskName: string, newName: string) {
            const original = findTask(taskName);
            if (!original) throw new Error(`Task '${taskName}' nicht gefunden.`);
            const clone = JSON.parse(JSON.stringify(original));
            clone.name = newName;
            if (!project.tasks) project.tasks = [];
            project.tasks.push(clone);
            return newName;
        },
        generateTaskFlow(taskName: string) {
            // Server-seitig nicht implementiert — Flow wird im Editor generiert
            console.log(`[Agent API] generateTaskFlow('${taskName}') — wird Client-seitig generiert.`);
            return null;
        },

        // === Validation ===
        validate() {
            const issues: any[] = [];
            const allActions = [...(project.actions || []), ...(project.stages?.flatMap((s: any) => s.actions || []) || [])];
            const actionNames = new Set(allActions.map((a: any) => a.name));
            const allTasks = [...(project.tasks || []), ...(project.stages?.flatMap((s: any) => s.tasks || []) || [])];
            allTasks.forEach((t: any) => {
                (t.actionSequence || []).forEach((item: any) => {
                    if (item.type === 'action' && item.name && !actionNames.has(item.name)) {
                        issues.push({ level: 'error', message: `Task '${t.name}': Action '${item.name}' referenziert aber nicht definiert.` });
                    }
                });
            });
            return issues;
        }
    };
}

/**
 * POST /api/agent/batch - Führt mehrere Agent-Methoden als Transaktion aus.
 * 
 * Request:  { operations: [{method, params}, ...] }
 * Response: { success: boolean, results: [{method, success, data, error}], rollback: boolean }
 * 
 * Bei einem Fehler wird das Projekt auf den Zustand vor dem Batch zurückgesetzt.
 */
app.post('/api/agent/batch', (req, res) => {
    const operations: Array<{ method: string; params: any[] }> = req.body?.operations || [];

    if (!Array.isArray(operations) || operations.length === 0) {
        return res.status(400).json({ success: false, results: [], rollback: false, error: 'Keine Operationen angegeben.' });
    }

    // Alle Methoden validieren
    for (const op of operations) {
        if (!AGENT_METHODS[op.method]) {
            return res.status(400).json({
                success: false, results: [], rollback: false,
                error: `Unbekannte Methode: '${op.method}'. Erlaubt: ${Object.keys(AGENT_METHODS).join(', ')}`
            });
        }
    }

    const projectPath = path.resolve(PUBLIC_DIR, 'project.json');
    if (!fs.existsSync(projectPath)) {
        return res.status(404).json({ success: false, results: [], rollback: false, error: 'project.json nicht gefunden.' });
    }

    try {
        const projectData = JSON.parse(fs.readFileSync(projectPath, 'utf-8'));
        const snapshot = JSON.stringify(projectData);
        const controller = createServerSideAgentController(projectData);

        const results: Array<{ method: string; success: boolean; data: any; error: string | null }> = [];
        let hasError = false;

        for (const op of operations) {
            try {
                const fn = (controller as any)[op.method];
                if (typeof fn !== 'function') throw new Error(`Methode '${op.method}' nicht implementiert.`);
                const result = fn.apply(controller, op.params || []);
                results.push({ method: op.method, success: true, data: result ?? null, error: null });
            } catch (e: any) {
                results.push({ method: op.method, success: false, data: null, error: e.message });
                hasError = true;
                break;
            }
        }

        if (hasError) {
            // Rollback — Projekt NICHT speichern
            console.log(`[Agent API] Batch rollback nach Fehler in '${results[results.length - 1]?.method}'.`);
            res.json({ success: false, results, rollback: true, error: null });
        } else {
            // Batch erfolgreich — Projekt speichern
            fs.writeFileSync(projectPath, JSON.stringify(projectData, null, 2));
            console.log(`[Agent API] Batch: ${operations.length} Operationen erfolgreich.`);
            res.json({ success: true, results, rollback: false, error: null });
        }
    } catch (err: any) {
        console.error('[Agent API] Batch-Fehler:', err.message);
        res.status(500).json({ success: false, results: [], rollback: false, error: err.message });
    }
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

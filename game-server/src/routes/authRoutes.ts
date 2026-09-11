import express from 'express';
import jwt from 'jsonwebtoken';
import { db, saveDB } from '../serverState';
import { authenticateToken, getDeepPaths } from '../utils/serverHelpers';

export function registerAuthRoutes(app: express.Application, JWT_SECRET: string) {
    // ─────────────────────────────────────────────
    // Platform Role Hierarchy
    // ─────────────────────────────────────────────
    const ROLE_HIERARCHY = ['player', 'roomadmin', 'houseadmin', 'cityadmin', 'superadmin'];

    function getAvailableRoles(role: string): string[] {
        const level = ROLE_HIERARCHY.indexOf(role);
        if (level === -1) return ['player'];
        return ROLE_HIERARCHY.slice(0, level + 1).reverse();
    }

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

            // Alle User-Felder zurückgeben AUSSER authCode (sensibel)
            const { authCode: _pin, ...safeUser } = user;

            res.json({
                success: true,
                token, // Send token to client
                user: safeUser
            });
        } else {
            res.status(401).json({ message: 'Ungültiger PIN' });
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
     * PROTECTED: Requires valid JWT
     */
    app.post('/api/platform/rooms', authenticateToken(JWT_SECRET), (req, res) => {
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
}

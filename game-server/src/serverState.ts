import fs from 'fs';
import path from 'path';
import WebSocket from 'ws';
import { Room } from './Room';

// Platform directories - ONLY uploaded games, no demos dependency
export const PUBLIC_DIR = path.join(__dirname, '../public');
export const ROOT_PUBLIC_DIR = path.join(__dirname, '../../public');
export const UPLOADED_GAMES_DIR = path.join(__dirname, '../../uploaded_games');
export const RUNTIMES_DIR = path.join(__dirname, '../runtimes');
export const DATA_DIR = path.join(__dirname, '../data');
export const DB_PATH = path.join(DATA_DIR, 'db.json');

export const BUILDER_URL = process.env.BUILDER_URL || 'http://localhost:5173';

if (!fs.existsSync(UPLOADED_GAMES_DIR)) {
    fs.mkdirSync(UPLOADED_GAMES_DIR, { recursive: true });
}
if (!fs.existsSync(RUNTIMES_DIR)) {
    fs.mkdirSync(RUNTIMES_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Platform Data Service
export let db: any = { users: [], hierarchy: { cities: [], houses: [], rooms: [] }, games: [], instances: [] };

export function loadDB() {
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

export function saveDB() {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    } catch (e) {
        console.error('[DB] Error saving database:', e);
    }
}

// Initial load
loadDB();

export const rooms = new Map<string, Room>();
export const playerRooms = new Map<WebSocket, Room>();

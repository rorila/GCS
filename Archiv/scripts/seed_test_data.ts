import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../game-server/data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

interface User {
    id: string;
    name: string;
    avatar: string; // New field
    role: string;
    authCode: string[]; // Correct schema: Array of strings (emojis)
    managedRooms?: string[];
    assignedRoomIds?: string[];
}

// Helper to convert string PIN to array (e.g. "🍎🍌" -> ["🍎", "🍌"])
// Note: Simple split might break combined emojis, ideally use specific array
function stringToAuthCode(str: string): string[] {
    return Array.from(str); // Array.from handles emoji surrogates better than split('')
}

const TEST_USERS: User[] = [
    {
        id: 'test-admin',
        name: 'TestAdmin',
        avatar: '🧞‍♂️',
        role: 'superadmin',
        authCode: ['🚀', '⭐'],
        managedRooms: ['room_test']
    },
    {
        id: 'test-user',
        name: 'TestUser',
        avatar: '🧪',
        role: 'user', // or 'admin' based on db.json existing roles? db.json uses 'admin', 'player'
        authCode: ['🍎', '🍌'],
        managedRooms: []
    },
    {
        id: 'test-bug',
        name: 'TestBug',
        avatar: '�',
        role: 'player',
        authCode: ['🐛', '💣'],
        assignedRoomIds: []
    }
];

function seedUsers() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    let dbData: any = { users: [] };
    if (fs.existsSync(DB_FILE)) {
        try {
            dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
        } catch (e) {
            console.error('Error reading db.json:', e);
        }
    }

    // Ensure users array exists
    if (!Array.isArray(dbData.users)) {
        dbData.users = [];
    }

    let users: User[] = dbData.users;
    let addedCount = 0;

    TEST_USERS.forEach(testUser => {
        const index = users.findIndex(u => u.id === testUser.id || u.name === testUser.name);
        if (index >= 0) {
            // Update existing
            console.log(`Updating existing test user in db.json: ${testUser.name}`);
            users[index] = { ...users[index], ...testUser };
        } else {
            // Add new
            console.log(`Adding new test user to db.json: ${testUser.name}`);
            users.push(testUser);
            addedCount++;
        }
    });

    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 4), 'utf-8');
        console.log(`✅ Successfully seeded db.json. Added/Updated users. Total users: ${users.length}`);
    } catch (e) {
        console.error('Error writing db.json:', e);
    }
}

seedUsers();

import { DataService } from '../src/services/DataService';
import * as fs from 'fs/promises';
import * as path from 'path';

async function runTest() {
    console.log("🧪 Testing DataService.getModelFields (Union Scan)...");

    // 1. Prepare dummy db.json
    const testDb = {
        users: [
            { id: "admin", name: "Admin", managedRooms: ["r1"] },
            { id: "player", name: "Player", assignedRoomIds: ["r2"], houseId: "h1" }
        ]
    };

    const dbPath = path.join(process.cwd(), 'data', 'test_db.json');
    await fs.mkdir(path.join(process.cwd(), 'data'), { recursive: true });
    await fs.writeFile(dbPath, JSON.stringify(testDb, null, 2));

    try {
        const ds = DataService.getInstance();
        const fields = await ds.getModelFields('test_db.json', 'users');

        console.log("Detected Fields:", fields);

        const expectedFields = ["id", "name", "managedRooms", "assignedRoomIds", "houseId"];
        const missingFields = expectedFields.filter(f => !fields.includes(f));

        if (missingFields.length === 0) {
            console.log("✅ SUCCESS: All heterogeneous fields detected via union scan.");
        } else {
            console.error("❌ FAILED: Missing fields:", missingFields);
            process.exit(1);
        }

    } finally {
        // Cleanup
        try { await fs.unlink(dbPath); } catch (e) { }
    }
}

runTest().catch(err => {
    console.error(err);
    process.exit(1);
});

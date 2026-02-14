import { dataService } from '../src/services/DataService.js';
import * as fs from 'fs';
import * as path from 'path';

async function verifyDataServiceSeeding() {
    console.log('--- Verifying DataService Seeding & Retrieval ---');

    // MOCK: Simulate Node.js environment (which DataService detects)
    // But we want to test the failure case of missing file -> empty object -> getModels

    // 1. Direct Test: getModels on missing file (should be handled gracefully now if readDb is robust)
    const modelsMissing = await dataService.getModels('non_existent_file.json');
    console.log('Models from missing file:', modelsMissing); // Expect []

    // 2. Direct Test: getModels on existing file (db.json)
    // Note: In Node env, DataService reads from game-server/data/ via process.cwd()
    // We need to ensure process.cwd() is correct or mock it
    // The script runs from root, so path.join(process.cwd(), 'data', storagePath) 
    // might expect a 'data' folder in root. 
    // BUT DataService uses 'data' folder relative to CWD.
    // The actual data is in 'game-server/data'. Let's check where we are running.
    console.log('CWD:', process.cwd());

    // Let's create a dummy data folder in root if needed for test, or rely on logic
    const testDataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(testDataDir)) {
        fs.mkdirSync(testDataDir);
    }
    fs.writeFileSync(path.join(testDataDir, 'test_db.json'), JSON.stringify({
        users: [{ id: '1', name: 'Test' }],
        settings: { theme: 'dark' } // Not an array, should be filtered out
    }));

    const models = await dataService.getModels('test_db.json');
    console.log('Models from test_db.json:', models);

    if (!models.includes('users')) {
        throw new Error('Failed to discover "users" model in test_db.json');
    }
    if (models.includes('settings')) {
        throw new Error('Incorrectly discovered "settings" object as model (should only be arrays)');
    }

    console.log('--- Verification Success! ---');

    // Cleanup
    try {
        fs.unlinkSync(path.join(testDataDir, 'test_db.json'));
        fs.rmdirSync(testDataDir);
    } catch (e) { }
}

verifyDataServiceSeeding().catch(err => {
    console.error('Verification failed:', err);
    process.exit(1);
});

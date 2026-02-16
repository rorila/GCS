
import { dataService } from '../src/services/DataService';
import * as path from 'path';

async function run() {
    try {
        // Mock window.fs if needed, or rely on Node environment if DataService supports it
        // DataService uses window.fs for file I/O in browser, but might need adjustment for Node test

        // Since we are in a Node environment for this script, we need to ensure DataService works or mock it.
        // DataService seems to use 'fs' from 'fs' module if available, or window.fs.
        // Let's see DataService source again to be sure.

        // For now, let's assume we can just inspect the file directly to double check keys
        console.log('Checking db.json content directly...');
        const dbPath = path.resolve(__dirname, '../game-server/data/db.json');
        const fs = require('fs');
        if (fs.existsSync(dbPath)) {
            const content = fs.readFileSync(dbPath, 'utf8');
            const json = JSON.parse(content);
            console.log('Keys in db.json:', Object.keys(json));

            const models = Object.keys(json).filter(key => Array.isArray(json[key]));
            console.log('Predicted models (Array keys):', models);
        } else {
            console.error('db.json not found at:', dbPath);
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

run();

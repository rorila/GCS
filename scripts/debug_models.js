
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
    console.log('Checking db.json content directly...');
    const dbPath = path.resolve(__dirname, '../game-server/data/db.json');

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


import fs from 'fs';

const path = './game-server/public/platform/project.json';

try {
    console.log(`Reading ${path}...`);
    const project = JSON.parse(fs.readFileSync(path, 'utf8'));

    console.log('--- SEARCH RESULTS ---');
    let foundCount = 0;

    function search(obj, currentPath) {
        if (!obj || typeof obj !== 'object') return;

        // Check current object keys
        if ('isBlueprintOnly' in obj) {
            console.log(`FOUND at: ${currentPath}.isBlueprintOnly = ${obj.isBlueprintOnly}`);
            foundCount++;
        }

        // Recurse
        if (Array.isArray(obj)) {
            obj.forEach((item, index) => search(item, `${currentPath}[${index}]`));
        } else {
            for (const key in obj) {
                if (obj[key] && typeof obj[key] === 'object') {
                    search(obj[key], `${currentPath}.${key}`);
                }
            }
        }
    }

    search(project, 'root');

    if (foundCount === 0) {
        console.log('No "isBlueprintOnly" keys found.');
    } else {
        console.log(`Total found: ${foundCount}`);
    }

} catch (e) {
    console.error('Error:', e.message);
}

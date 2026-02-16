
import fs from 'fs';

const path = './game-server/public/platform/project.json';

try {
    console.log(`Reading ${path} as raw text...`);
    let content = fs.readFileSync(path, 'utf8');

    // Count occurrences
    const matches = content.match(/"isBlueprintOnly"\s*:\s*(true|false),?/g);
    const count = matches ? matches.length : 0;

    console.log(`Found ${count} occurrences of "isBlueprintOnly" in raw text.`);

    if (count > 0) {
        // Remove lines containing "isBlueprintOnly"
        // This regex removes the key-value pair and potential trailing comma, 
        // trying to preserve valid JSON (though trailing commas might become an issue if it was the last item)
        // A safer bet for formatted JSON is often line-based removal if it's one property per line.

        const lines = content.split('\n');
        const newLines = lines.filter(line => !line.includes('"isBlueprintOnly"'));

        if (lines.length !== newLines.length) {
            console.log(`Removed ${lines.length - newLines.length} lines.`);
            fs.writeFileSync(path, newLines.join('\n'));
            console.log('File saved.');
        }
    } else {
        console.log('No raw text occurrences found.');
    }

} catch (e) {
    console.error('Error:', e.message);
}

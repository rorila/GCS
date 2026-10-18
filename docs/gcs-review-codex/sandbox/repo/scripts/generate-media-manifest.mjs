import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

/**
 * generate-media-manifest.mjs
 *
 * Scannt public/images/, public/audio/ und public/videos/ und erzeugt
 * public/media-manifest.json für den MediaPickerDialog.
 *
 * Reines Node-ESM-Skript — benötigt kein tsx/TypeScript.
 * Aufruf: node scripts/generate-media-manifest.mjs  (bzw. npm run media:manifest)
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico'];
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogv', '.mov', '.avi'];

function scanDir(baseDir, extensions) {
    const result = {};

    if (!fs.existsSync(baseDir)) {
        console.log(`  ⚠️  Ordner nicht gefunden: ${baseDir} — wird angelegt`);
        fs.mkdirSync(baseDir, { recursive: true });
        result[''] = [];
        return result;
    }

    const walk = (dir, prefix) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const files = [];

        for (const entry of entries) {
            if (entry.name.startsWith('.')) continue; // Versteckte Dateien überspringen

            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath, prefix ? `${prefix}/${entry.name}` : entry.name);
            } else if (entry.isFile() && extensions.includes(path.extname(entry.name).toLowerCase())) {
                files.push(entry.name);
            }
        }

        if (files.length > 0 || prefix === '') {
            result[prefix] = files.sort();
        }
    };

    walk(baseDir, '');
    return result;
}

console.log('🔍 Scanning media directories...\n');

const manifest = {
    images: scanDir(path.join(PUBLIC_DIR, 'images'), IMAGE_EXTENSIONS),
    audio: scanDir(path.join(PUBLIC_DIR, 'audio'), AUDIO_EXTENSIONS),
    videos: scanDir(path.join(PUBLIC_DIR, 'videos'), VIDEO_EXTENSIONS)
};

const count = (group) => Object.values(group).reduce((sum, arr) => sum + arr.length, 0);

console.log(`  🖼️  Images: ${count(manifest.images)} Dateien in ${Object.keys(manifest.images).length} Ordner(n)`);
console.log(`  🔊 Audio:  ${count(manifest.audio)} Dateien in ${Object.keys(manifest.audio).length} Ordner(n)`);
console.log(`  🎬 Videos: ${count(manifest.videos)} Dateien in ${Object.keys(manifest.videos).length} Ordner(n)`);

const outPath = path.join(PUBLIC_DIR, 'media-manifest.json');
fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2), 'utf-8');

console.log(`\n✅ Manifest geschrieben: ${outPath}`);

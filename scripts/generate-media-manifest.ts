import * as fs from 'fs';
import * as path from 'path';

/**
 * generate-media-manifest.ts
 * 
 * Scannt public/images/, public/audio/ und public/videos/ und erzeugt
 * public/media-manifest.json für den MediaPickerDialog.
 * 
 * Aufruf: npx tsx scripts/generate-media-manifest.ts
 */

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');

interface MediaManifest {
    images: Record<string, string[]>;
    audio: Record<string, string[]>;
    videos: Record<string, string[]>;
}

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico'];
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogv', '.mov', '.avi'];

function scanDir(baseDir: string, extensions: string[], relativeTo: string = ''): Record<string, string[]> {
    const result: Record<string, string[]> = {};

    if (!fs.existsSync(baseDir)) {
        console.log(`  ⚠️  Ordner nicht gefunden: ${baseDir} — wird angelegt`);
        fs.mkdirSync(baseDir, { recursive: true });
        result[''] = [];
        return result;
    }

    function walk(dir: string, prefix: string) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const files: string[] = [];

        for (const entry of entries) {
            if (entry.name.startsWith('.')) continue; // Versteckte Dateien überspringen

            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                const subPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
                walk(fullPath, subPrefix);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (extensions.includes(ext)) {
                    files.push(entry.name);
                }
            }
        }

        if (files.length > 0 || prefix === '') {
            result[prefix] = files.sort();
        }
    }

    walk(baseDir, relativeTo);
    return result;
}

// Main
console.log('🔍 Scanning media directories...\n');

const manifest: MediaManifest = {
    images: scanDir(path.join(PUBLIC_DIR, 'images'), IMAGE_EXTENSIONS),
    audio: scanDir(path.join(PUBLIC_DIR, 'audio'), AUDIO_EXTENSIONS),
    videos: scanDir(path.join(PUBLIC_DIR, 'videos'), VIDEO_EXTENSIONS),
};

// Statistiken
const imgCount = Object.values(manifest.images).reduce((sum, arr) => sum + arr.length, 0);
const audCount = Object.values(manifest.audio).reduce((sum, arr) => sum + arr.length, 0);
const vidCount = Object.values(manifest.videos).reduce((sum, arr) => sum + arr.length, 0);

console.log(`  🖼️  Images: ${imgCount} Dateien in ${Object.keys(manifest.images).length} Ordner(n)`);
console.log(`  🔊 Audio:  ${audCount} Dateien in ${Object.keys(manifest.audio).length} Ordner(n)`);
console.log(`  🎬 Videos: ${vidCount} Dateien in ${Object.keys(manifest.videos).length} Ordner(n)`);

const outPath = path.join(PUBLIC_DIR, 'media-manifest.json');
fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2), 'utf-8');

console.log(`\n✅ Manifest geschrieben: ${outPath}`);

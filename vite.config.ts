import { defineConfig, Plugin } from 'vite';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Vite-Plugin: Generiert public/media-manifest.json beim Server-Start und Build.
 * Scannt public/images/, public/audio/ und public/videos/ nach Medien-Dateien.
 */
function mediaManifestPlugin(): Plugin {
    const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico'];
    const AUDIO_EXT = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];
    const VIDEO_EXT = ['.mp4', '.webm', '.ogv', '.mov', '.avi'];

    function scanDir(baseDir: string, extensions: string[]): Record<string, string[]> {
        const result: Record<string, string[]> = {};
        if (!fs.existsSync(baseDir)) {
            fs.mkdirSync(baseDir, { recursive: true });
            result[''] = [];
            return result;
        }
        function walk(dir: string, prefix: string) {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            const files: string[] = [];
            for (const entry of entries) {
                if (entry.name.startsWith('.')) continue;
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    walk(fullPath, prefix ? `${prefix}/${entry.name}` : entry.name);
                } else if (entry.isFile() && extensions.includes(path.extname(entry.name).toLowerCase())) {
                    files.push(entry.name);
                }
            }
            if (files.length > 0 || prefix === '') result[prefix] = files.sort();
        }
        walk(baseDir, '');
        return result;
    }

    function generate(publicDir: string) {
        const manifest = {
            images: scanDir(path.join(publicDir, 'images'), IMAGE_EXT),
            audio: scanDir(path.join(publicDir, 'audio'), AUDIO_EXT),
            videos: scanDir(path.join(publicDir, 'videos'), VIDEO_EXT),
        };
        const outPath = path.join(publicDir, 'media-manifest.json');
        fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2), 'utf-8');
        const total = Object.values(manifest.images).reduce((s, a) => s + a.length, 0)
                    + Object.values(manifest.audio).reduce((s, a) => s + a.length, 0)
                    + Object.values(manifest.videos).reduce((s, a) => s + a.length, 0);
        console.log(`\x1b[36m[media-manifest]\x1b[0m ${total} Dateien → ${outPath}`);
    }

    return {
        name: 'media-manifest',
        configureServer(server) {
            // Beim Dev-Server-Start generieren
            const publicDir = path.resolve(server.config.root, 'public');
            generate(publicDir);
        },
        buildStart() {
            // Beim Production-Build generieren
            generate(path.resolve(process.cwd(), 'public'));
        }
    };
}

export default defineConfig({
    base: './', // Use relative paths
    plugins: [mediaManifestPlugin()],
    server: {
        port: 5173,
        open: true, // Auto-open browser
        proxy: {
            '/api': 'http://localhost:8080',
            '/platform': 'http://localhost:8080'
        }
    },
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: true,
        rollupOptions: {
            input: {
                main: 'index.html',
                player: 'player.html'
            }
        }
    }
});

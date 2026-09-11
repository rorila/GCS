import express from 'express';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { ROOT_PUBLIC_DIR, UPLOADED_GAMES_DIR, RUNTIMES_DIR, BUILDER_URL } from '../serverState';

// Media-Manifest (für den MediaPickerDialog im Editor)
// Muss nach jedem Upload aktualisiert werden, sonst findet der Picker
// neu erzeugte Dateien nicht. Gleiche Logik wie scripts/generate-media-manifest.ts.
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico'];
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogv', '.mov', '.avi'];

function scanMediaDir(baseDir: string, extensions: string[]): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    if (!fs.existsSync(baseDir)) {
        result[''] = [];
        return result;
    }

    const walk = (dir: string, prefix: string) => {
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

        if (files.length > 0 || prefix === '') {
            result[prefix] = files.sort();
        }
    };

    walk(baseDir, '');
    return result;
}

function regenerateMediaManifest(): void {
    try {
        const manifest = {
            images: scanMediaDir(path.join(ROOT_PUBLIC_DIR, 'images'), IMAGE_EXTENSIONS),
            audio: scanMediaDir(path.join(ROOT_PUBLIC_DIR, 'audio'), AUDIO_EXTENSIONS),
            videos: scanMediaDir(path.join(ROOT_PUBLIC_DIR, 'videos'), VIDEO_EXTENSIONS)
        };
        const outPath = path.join(ROOT_PUBLIC_DIR, 'media-manifest.json');
        fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2), 'utf-8');
        console.log(`[Server] media-manifest.json aktualisiert: ${outPath}`);
    } catch (err: any) {
        console.error('[Server] Error regenerating media manifest:', err);
    }
}

export function registerMediaRoutes(app: express.Application) {
    // Upload endpoint for generated sprite sheets (VideoToSpriteSheet tool)
    app.post('/api/upload/spritesheet', (req, res) => {
        try {
            const { fileName, imageBase64 } = req.body;
            if (!fileName || !imageBase64) {
                return res.status(400).json({ error: 'fileName and imageBase64 required' });
            }

            const match = imageBase64.match(/^data:image\/png;base64,(.+)$/);
            if (!match) {
                return res.status(400).json({ error: 'Expected data:image/png;base64,...' });
            }

            const buffer = Buffer.from(match[1], 'base64');
            const imagesDir = path.join(ROOT_PUBLIC_DIR, 'images');
            if (!fs.existsSync(imagesDir)) {
                fs.mkdirSync(imagesDir, { recursive: true });
            }

            let safeName = path.basename(fileName);
            if (!safeName.toLowerCase().endsWith('.png')) {
                safeName += '.png';
            }
            const filePath = path.join(imagesDir, safeName);
            fs.writeFileSync(filePath, buffer);

            regenerateMediaManifest();

            return res.json({ success: true, fileName: safeName, filePath, url: `/images/${safeName}` });
        } catch (err: any) {
            console.error('[Server] Error uploading sprite sheet:', err);
            return res.status(500).json({ error: err.message || 'Upload failed' });
        }
    });

    /**
     * GET /platform/games - List uploaded games only
     */
    app.get('/platform/games', (req, res) => {
        try {
            if (!fs.existsSync(UPLOADED_GAMES_DIR)) {
                return res.json([]);
            }
            const games = fs.readdirSync(UPLOADED_GAMES_DIR)
                .filter(f => f.endsWith('.json'))
                .map(f => {
                    try {
                        const content = JSON.parse(fs.readFileSync(path.join(UPLOADED_GAMES_DIR, f), 'utf-8'));

                        // Handle compressed format
                        if (content._compressed && content.data) {
                            // Decompress to get metadata
                            try {
                                const compressedBuffer = Buffer.from(content.data, 'base64');
                                const decompressed = zlib.gunzipSync(compressedBuffer);
                                const project = JSON.parse(decompressed.toString('utf-8'));
                                return {
                                    file: f,
                                    name: project.meta?.name || f.replace('.json', ''),
                                    author: project.meta?.author || 'Unknown',
                                    runtimeVersion: project.meta?.runtimeVersion || content._version || '1.0.0',
                                    compressed: true
                                };
                            } catch (e) {
                                console.error(`[API] Error decompressing ${f} for metadata:`, e);
                                return null;
                            }
                        }

                        return {
                            file: f,
                            name: content.meta?.name || f.replace('.json', ''),
                            author: content.meta?.author || 'Unknown',
                            runtimeVersion: content.meta?.runtimeVersion || '1.0.0'
                        };
                    } catch {
                        return null;
                    }
                })
                .filter(g => g !== null);
            res.json(games);
        } catch (err) {
            console.error('[API] Error listing games:', err);
            res.status(500).json({ error: 'Failed to list games' });
        }
    });

    /**
     * GET /platform/games/:filename - Serve a specific game JSON
     */
    app.get('/platform/games/:filename', (req, res) => {
        const filename = req.params.filename;
        const filePath = path.join(UPLOADED_GAMES_DIR, filename);

        if (fs.existsSync(filePath)) {
            const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

            // Handle compressed format - decompress on-the-fly
            if (content._compressed && content.data) {
                try {
                    const compressedBuffer = Buffer.from(content.data, 'base64');
                    const decompressed = zlib.gunzipSync(compressedBuffer);
                    const project = JSON.parse(decompressed.toString('utf-8'));
                    console.log(`[API] Serving decompressed game: ${filename}`);
                    res.json(project);
                } catch (e) {
                    console.error(`[API] Error decompressing game ${filename}:`, e);
                    res.status(500).json({ error: 'Failed to decompress game' });
                }
            } else {
                res.json(content);
            }
        } else {
            res.status(404).json({ error: 'Game not found' });
        }
    });

    /**
     * GET /api/images - List images in public/images
     */
    app.get('/api/images', (req, res) => {
        const imagesDir = path.join(ROOT_PUBLIC_DIR, 'images');

        if (!fs.existsSync(imagesDir)) {
            return res.json([]);
        }

        const listFiles = (dir: string, base: string = ''): any[] => {
            const results: any[] = [];
            const files = fs.readdirSync(dir);

            files.forEach(file => {
                const filePath = path.join(dir, file);
                const relPath = base ? `${base}/${file}` : file;
                const stat = fs.statSync(filePath);

                if (stat.isDirectory()) {
                    results.push({
                        name: file,
                        type: 'directory',
                        path: relPath,
                        children: listFiles(filePath, relPath)
                    });
                } else if (/\.(png|jpe?g|gif|svg|webp)$/i.test(file)) {
                    results.push({
                        name: file,
                        type: 'file',
                        path: relPath,
                        size: stat.size
                    });
                }
            });

            return results;
        };

        try {
            const fileTree = listFiles(imagesDir);
            res.json(fileTree);
        } catch (err) {
            console.error('[API] Error listing images:', err);
            res.status(500).json({ error: 'Failed to list images' });
        }
    });

    /**
     * POST /platform/games - Upload a new game
     */
    app.post('/platform/games', (req, res) => {
        try {
            const { filename, content, compressed } = req.body;

            if (!filename || !content) {
                return res.status(400).json({ error: 'Missing filename or content' });
            }

            // Validate filename (prevent path traversal)
            const safeName = path.basename(filename).replace(/[^a-zA-Z0-9_.-]/g, '_');
            if (!safeName.endsWith('.json')) {
                return res.status(400).json({ error: 'Filename must end with .json' });
            }

            const filePath = path.join(UPLOADED_GAMES_DIR, safeName);
            fs.writeFileSync(filePath, JSON.stringify(content, null, 2));

            // For compressed format, extract game name for response
            let gameName = safeName.replace('.json', '');
            if (compressed && content._compressed && content.data) {
                try {
                    const compressedBuffer = Buffer.from(content.data, 'base64');
                    const decompressed = zlib.gunzipSync(compressedBuffer);
                    const project = JSON.parse(decompressed.toString('utf-8'));
                    gameName = project.meta?.name || gameName;
                } catch (e) {
                    console.warn(`[API] Could not extract game name from compressed content:`, e);
                }
            }

            console.log(`[API] Game uploaded: ${safeName} (compressed: ${!!compressed})`);
            res.json({ success: true, filename: safeName, gameName });
        } catch (err) {
            console.error('[API] Error uploading game:', err);
            res.status(500).json({ error: 'Failed to upload game' });
        }
    });

    /**
     * DELETE /platform/games/:filename - Delete a game
     */
    app.delete('/platform/games/:filename', (req, res) => {
        const filename = req.params.filename;
        const filePath = path.join(UPLOADED_GAMES_DIR, filename);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`[API] Game deleted: ${filename}`);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Game not found' });
        }
    });

    /**
     * GET /runtimes/:version - Get runtime JS for a specific version
     * Auto-fetches from Builder if not cached
     */
    app.get('/runtimes/:version', async (req, res) => {
        let version = req.params.version;
        // Cleanup version string (e.g. "v1.0.0.js" -> "1.0.0")
        version = version.replace(/^v/, '').replace(/\.js$/, '');

        const runtimePath = path.join(RUNTIMES_DIR, `v${version}.js`);

        const isLocalhost = BUILDER_URL.includes('localhost') || BUILDER_URL.includes('127.0.0.1');

        // Check if we have this version cached
        if (fs.existsSync(runtimePath)) {
            res.setHeader('Content-Type', 'application/javascript');
            return res.sendFile(runtimePath);
        }

        if (isLocalhost) {
            console.log(`[API] Dev-Mode: Bypassing cache for runtime v${version}, fetching fresh from ${BUILDER_URL}...`);
        }

        // Fetch from Builder server
        console.log(`[API] Runtime v${version} not found, fetching from ${BUILDER_URL}...`);
        try {
            const resp = await fetch(`${BUILDER_URL}/runtime-standalone.js`);
            if (resp.ok) {
                const code = await resp.text();

                // Validate it's actual JS, not HTML error page
                if (code.trim().startsWith('<!DOCTYPE') || code.trim().startsWith('<html')) {
                    console.error('[API] Builder returned HTML instead of JS');
                    return res.status(502).json({ error: 'Builder returned invalid runtime' });
                }

                // Cache it
                fs.writeFileSync(runtimePath, code);
                console.log(`[API] Runtime v${version} cached`);

                res.setHeader('Content-Type', 'application/javascript');
                res.send(code);
            } else {
                console.error(`[API] Failed to fetch runtime from Builder: ${resp.status}`);
                res.status(502).json({ error: 'Failed to fetch runtime from Builder' });
            }
        } catch (err) {
            console.error('[API] Error fetching runtime:', err);
            res.status(502).json({ error: 'Builder not reachable' });
        }
    });
}

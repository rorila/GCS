import * as fs from 'node:fs';
import * as esbuild from 'esbuild';

/**
 * Baut public/runtime-standalone.js mit esbuild.
 * Lädt .env (sofern vorhanden) und übernimmt alle VITE_* Variablen
 * nach import.meta.env. Werte aus der Prozess-Umgebung überschreiben .env.
 */

function loadDotEnv(path) {
    const result = {};
    if (!fs.existsSync(path)) return result;
    const text = fs.readFileSync(path, 'utf-8');
    for (let line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        let key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        result[key] = value;
    }
    return result;
}

const dotenv = loadDotEnv('.env');
const env = { ...dotenv, ...process.env };

const importMetaEnv = {};
for (const key of Object.keys(env)) {
    if (key.startsWith('VITE_')) {
        importMetaEnv[key] = env[key];
    }
}

await esbuild.build({
    entryPoints: ['src/player-standalone.ts'],
    bundle: true,
    minify: true,
    outfile: 'public/runtime-standalone.js',
    format: 'iife',
    target: 'es2020',
    define: {
        'import.meta.env': JSON.stringify(importMetaEnv)
    }
});

console.log(`Built public/runtime-standalone.js (VITE_LOG_LEVEL=${importMetaEnv.VITE_LOG_LEVEL ?? 'not set'})`);

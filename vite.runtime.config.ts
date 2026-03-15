import { defineConfig } from 'vite';
import { resolve } from 'path';

/**
 * Separate Vite-Konfiguration für das Standalone-Runtime-Bundle.
 * Baut player-standalone.ts als einzelnes IIFE-Bundle OHNE Code-Splitting.
 * 
 * Aufruf: npx vite build --config vite.runtime.config.ts
 * Danach: copy dist-runtime\runtime-standalone.js public\runtime-standalone.js
 */
export default defineConfig({
    publicDir: false,
    resolve: {
        alias: {
            // Node.js-Module durch leere Browser-Stubs ersetzen
            'fs/promises': resolve(__dirname, 'src/stubs/node-stub.ts'),
            'fs': resolve(__dirname, 'src/stubs/node-stub.ts'),
            'path': resolve(__dirname, 'src/stubs/node-stub.ts'),
            'express': resolve(__dirname, 'src/stubs/node-stub.ts'),
            'http': resolve(__dirname, 'src/stubs/node-stub.ts'),
            'https': resolve(__dirname, 'src/stubs/node-stub.ts'),
            'crypto': resolve(__dirname, 'src/stubs/node-stub.ts'),
            'net': resolve(__dirname, 'src/stubs/node-stub.ts'),
        }
    },
    build: {
        outDir: 'dist-runtime',
        emptyOutDir: true,
        rollupOptions: {
            input: 'src/player-standalone.ts',
            output: {
                format: 'iife',
                inlineDynamicImports: true,
                entryFileNames: 'runtime-standalone.js',
            }
        },
        minify: 'esbuild',
        sourcemap: false
    }
});

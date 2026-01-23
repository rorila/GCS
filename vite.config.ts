import { defineConfig } from 'vite';

export default defineConfig({
    base: './', // Use relative paths
    server: {
        port: 5173,
        open: true, // Auto-open browser
        proxy: {
            '/games': 'http://localhost:8080',
            '/rooms': 'http://localhost:8080',
            '/api': 'http://localhost:8080'
        }
    },
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: true,
        rollupOptions: {
            input: {
                main: 'index.html',
                player: 'player.html',
                runtime: 'src/player-standalone.ts'
            },
            output: {
                entryFileNames: (chunkInfo) => {
                    return chunkInfo.name === 'runtime' ? 'runtime-standalone.js' : 'assets/[name]-[hash].js';
                }
            }
        }
    }
});

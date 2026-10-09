import { createTrainingRouter } from './TrainingRouter';
import { WebSocketServer } from 'ws';
import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';

import { PUBLIC_DIR, ROOT_PUBLIC_DIR, UPLOADED_GAMES_DIR, RUNTIMES_DIR } from './serverState';
import { registerMediaRoutes } from './routes/mediaRoutes';
import { registerRoomRoutes } from './routes/roomRoutes';
import { registerAuthRoutes } from './routes/authRoutes';
import { registerDataRoutes } from './routes/dataRoutes';
import { registerProjectRoutes } from './routes/projectRoutes';
import { registerAgentRoutes } from './routes/agentRoutes';
import { setupWebSocket } from './websocket/roomManager';

/**
 * Multiplayer Game Server
 *
 * Features:
 * - WebSocket for real-time game communication
 * - REST API for lobby (game list, waiting rooms)
 * - Static file serving for games
 */

const PORT = parseInt(process.env.PORT || '8080');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-prod';
// Entwicklungs-/Editor-Server: standardmäßig nur Loopback — der öffentliche
// Spielbetrieb läuft über den CMS-Server (Port 8081). GCS_HOST=0.0.0.0 öffnet
// diese Schnittstelle bewusst nach außen (z. B. LAN-Test im selben Haus).
const HOST = process.env.GCS_HOST || '127.0.0.1';

// ─────────────────────────────────────────────
// Express App Setup
// ─────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/api/training', createTrainingRouter(path.resolve(__dirname, '../..')));

// Serve static files from public folder
// Medien aus dem Editor-public-Verzeichnis (Media-Picker) vorziehen
app.use('/images', express.static(path.join(ROOT_PUBLIC_DIR, 'images')));
app.use('/audio', express.static(path.join(ROOT_PUBLIC_DIR, 'audio')));
app.use('/videos', express.static(path.join(ROOT_PUBLIC_DIR, 'videos')));
app.use(express.static(PUBLIC_DIR));

// ─────────────────────────────────────────────
// API Routes (registration order matters for route matching)
// ─────────────────────────────────────────────
registerMediaRoutes(app);

// Root serves the player (Game Server is standalone)
app.get('/', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'player.html'));
});

registerRoomRoutes(app);
registerAuthRoutes(app, JWT_SECRET);
registerDataRoutes(app);
registerProjectRoutes(app);
registerAgentRoutes(app);

// ─────────────────────────────────────────────
// HTTP + WebSocket Server Setup
// ─────────────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

setupWebSocket(wss);

// Start server
server.listen(PORT, HOST, () => {
    console.log(`🎮 Game Server running on ${HOST}:${PORT}`);
    console.log(`   WebSocket: ws://${HOST}:${PORT}`);
    console.log(`   REST API:  http://${HOST}:${PORT}`);
    console.log(`   Games dir: ${UPLOADED_GAMES_DIR}`);
    console.log(`   Runtimes:  ${RUNTIMES_DIR}`);
});

import { createTrainingRouter } from './TrainingRouter';
import { createSpeechRouter } from './tts/SpeechRouter';
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
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || '';
if (IS_PRODUCTION && !JWT_SECRET) {
    throw new Error('JWT_SECRET fehlt — in Produktion kein Development-Fallback.');
}
const EFFECTIVE_JWT_SECRET = JWT_SECRET || 'dev-secret-key-change-in-prod';
// Entwicklungs-/Editor-Server: standardmäßig nur Loopback — der öffentliche
// Spielbetrieb läuft über den CMS-Server (Port 8081). GCS_HOST=0.0.0.0 öffnet
// diese Schnittstelle bewusst nach außen (z. B. LAN-Test im selben Haus).
const HOST = process.env.GCS_HOST || '127.0.0.1';
// Editor-/Diagnose-APIs sind für den gehosteten Betrieb nicht freigegeben:
// sie sind nicht authentifiziert und nur für den lokalen Editor gedacht.
// GCS_EDITOR_APIS=off blendet Dev-/Agenten-/Upload-Routen vollständig aus.
const EDITOR_APIS_ENABLED = process.env.GCS_EDITOR_APIS !== 'off';

// ─────────────────────────────────────────────
// Express App Setup
// ─────────────────────────────────────────────
const app = express();
app.use(cors());
if (!EDITOR_APIS_ENABLED) {
    // Frühe Sperre: nicht authentifizierte Editor-/Diagnose-/Upload-Endpunkte
    // bleiben im gehosteten Betrieb unsichtbar (404 statt Auth-Trugschluss).
    const blocked = /^\/(api\/(dev|agent|data|upload|tts|training|library)|kb\/)/;
    app.use((req, res, next) => {
        if (blocked.test(req.path)) return res.status(404).json({ error: 'Nicht gefunden' });
        next();
    });
    // Mutierende Plattform-Endpunkte (Spiel-Uploads) gehören in den CMS-Upload-
    // Vertrag — lesendes /platform/games für den Standalone-Player bleibt frei.
    app.use((req, res, next) => {
        if (req.path === '/platform/games' && req.method !== 'GET') return res.status(404).json({ error: 'Nicht gefunden' });
        next();
    });
}
if (EDITOR_APIS_ENABLED) {
    app.use('/api/tts', express.json({ limit: '4kb' }), createSpeechRouter(path.resolve(process.env.TTS_CACHE_DIR || path.resolve(__dirname, '../data/tts-editor-cache'))));
    app.use('/api/training', createTrainingRouter(path.resolve(__dirname, '../..')));
}
app.use(express.json({ limit: '50mb' }));

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
registerAuthRoutes(app, EFFECTIVE_JWT_SECRET);
if (EDITOR_APIS_ENABLED) {
    registerDataRoutes(app);
    registerProjectRoutes(app);
    registerAgentRoutes(app);
}

// ─────────────────────────────────────────────
// HTTP + WebSocket Server Setup
// ─────────────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

setupWebSocket(wss);

// Kontrollierter Shutdown: der Supervisor (bzw. Fly) sendet SIGTERM — erst
// Verbindungen abbauen, dann beenden, damit keine Schreiboperation abreißt.
process.once('SIGTERM', () => {
    console.log('🎮 Game Server: SIGTERM — fahre herunter');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 10000).unref();
});
process.once('SIGINT', () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 10000).unref();
});

// Start server
server.listen(PORT, HOST, () => {
    console.log(`🎮 Game Server running on ${HOST}:${PORT}`);
    console.log(`   WebSocket: ws://${HOST}:${PORT}`);
    console.log(`   REST API:  http://${HOST}:${PORT}`);
    console.log(`   Games dir: ${UPLOADED_GAMES_DIR}`);
    console.log(`   Runtimes:  ${RUNTIMES_DIR}`);
});

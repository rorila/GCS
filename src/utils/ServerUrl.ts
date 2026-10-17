/**
 * Zentrale Server-URL-Auflösung für Editor, Runtime und Player.
 *
 * Entwicklung (Vite auf Port 5173): Der Game-Server läuft auf Port 8080,
 * der CMS-Server auf 8081 — Aufrufe werden auf den Entwicklungs-Backend-
 * Port aufgelöst.
 *
 * Produktion / Standalone: Alles läuft same-origin über den gemeinsamen
 * HTTPS-Eingang (nginx bzw. direkt den Game-Server). WebSockets zum
 * Game-Server gehen über den reservierten Pfad /ws/game, der vom
 * WebSocket-Handler ohnehin akzeptiert wird; CMS-Live-Sync nutzt
 * /api/cms/party/live (siehe CmsGameHost/TCmsLiveSync).
 */

const DEV_SERVER_PORT = '5173';
const GAME_SERVER_PORT = '8080';
export const GAME_WS_PATH = '/ws/game';

function loc(): Location | null {
    return typeof window !== 'undefined' ? window.location : null;
}

/** HTTP-Basis des Game-Servers (same-origin außerhalb der Vite-Entwicklung). */
export function gameServerBase(): string {
    const l = loc();
    if (!l) return '';
    if (l.port === DEV_SERVER_PORT) return `${l.protocol}//${l.hostname}:${GAME_SERVER_PORT}`;
    return l.origin;
}

/** Absolute URL eines Game-Server-HTTP-Endpunkts. */
export function gameServerHttp(path: string): string {
    return gameServerBase() + path;
}

/** WebSocket-URL für Multiplayer-Räume (Game-Server-Kanal). */
export function gameServerWs(path: string = GAME_WS_PATH): string {
    const l = loc();
    if (!l) return path;
    const protocol = l.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = l.port === DEV_SERVER_PORT ? `${l.hostname}:${GAME_SERVER_PORT}` : l.host;
    return `${protocol}//${host}${path}`;
}

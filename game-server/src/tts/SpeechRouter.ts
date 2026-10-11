import express from 'express';
import path from 'path';
import { SpeechCache, SpeechError } from './SpeechCache';
import { PiperSpeechEngine } from './PiperSpeechEngine';

export function createSpeechRouter(directory: string): express.Router {
    const router = express.Router();
    const voices: Record<string, string> = JSON.parse(process.env.TTS_VOICES || '{"default":"de_DE-thorsten-medium","kerstin":"de_DE-kerstin-low","ramona":"de_DE-ramona-low"}');
    const cache = new SpeechCache(directory, new PiperSpeechEngine(
        process.env.TTS_MODEL_VERSION || 'piper-thorsten-medium-v1',
        process.env.TTS_PIPER_URL || 'http://127.0.0.1:5000', voices, process.env.TTS_FFMPEG || 'ffmpeg',
        process.env.TTS_PIPER_SYNTHESIS_PATH || '/'),
        Number(process.env.TTS_CACHE_MAX_BYTES || 5 * 1024 ** 3), 32,
        new Set((process.env.TTS_PROTECTED_KEYS || '').split(',').filter(Boolean)));
    const clients = new Map<string, { count: number; until: number }>();
    router.get('/voices', (_req, res) => res.json({ voices: Object.keys(voices) }));
    router.post('/synthesize', async (req, res) => {
        try {
            const now = Date.now();
            for (const [key, item] of clients) if (item.until <= now) clients.delete(key);
            const ip = req.ip || 'unknown';
            if (!clients.has(ip) && clients.size >= 10_000) throw new SpeechError('Zu viele Clients.', 429);
            const client = clients.get(ip) || { count: 0, until: now + 60_000 };
            clients.set(ip, client);
            if (++client.count > Number(process.env.TTS_REQUESTS_PER_MINUTE || 240)) throw new SpeechError('Zu viele Sprachanfragen.', 429);
            const { text, voice = 'default' } = req.body || {};
            if (typeof text !== 'string' || typeof voice !== 'string' || !Object.prototype.hasOwnProperty.call(voices, voice)) {
                throw new SpeechError('Text oder Stimmen-ID ungültig.', 400);
            }
            const { key, cached } = await cache.get(text, voice);
            res.json({ audioUrl: `${req.baseUrl}/audio/${key}.mp3`, cached });
        } catch (error) {
            const known = error instanceof SpeechError;
            const status = known ? error.status : 503;
            if (status === 429) res.setHeader('Retry-After', '60');
            res.status(status).json({ error: known ? error.message : 'Sprachserver vorübergehend nicht verfügbar.' });
        }
    });
    router.get('/audio/:file', async (req, res) => {
        const file = req.params.file;
        if (!/^[a-f0-9]{64}\.mp3$/.test(file)) { res.sendStatus(404); return; }
        try {
            await cache.touch(file.slice(0, -4));
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            res.sendFile(path.resolve(directory, file), error => {
                if (error && !res.headersSent) res.sendStatus(404);
            });
        } catch { res.sendStatus(404); }
    });
    // Diagnose nur mit serverseitig gesetztem Token freigeben.
    router.get('/stats', async (req, res) => {
        if (!process.env.TTS_ADMIN_TOKEN || req.headers.authorization !== `Bearer ${process.env.TTS_ADMIN_TOKEN}`) {
            res.sendStatus(403); return;
        }
        try { res.json(await cache.stats()); } catch { res.sendStatus(503); }
    });
    return router;
}

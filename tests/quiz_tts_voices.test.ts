import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Readable } from 'node:stream';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { createTtsService } = require('../scripts/cms/cms-tts.cjs');
const { SpeechCache } = require('../scripts/cms/tts/SpeechCache.cjs');
const { PiperSpeechEngine } = require('../scripts/cms/tts/PiperSpeechEngine.cjs');
const { createCore } = require('../scripts/cms/cms-core.cjs');
const { buildDb } = require('../scripts/cms/cms-seed-testdata.cjs');
const launchKey = 'a'.repeat(48);
const request = (body: object, origin = 'http://localhost:8081') => Object.assign(Readable.from([Buffer.from(JSON.stringify(body))]), {
    method: 'POST', headers: { host: 'localhost:8081', origin, 'content-type': 'application/json' }
});
async function fixture() {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'gcs-tts-voices-'));
    const core = createCore(buildDb()), token = core.issueSession('child-finn', 'profile');
    core.db.playSessions = [{ id: 'voice-test', childId: 'child-finn', gameId: 'game-math', status: 'active' }];
    const launches = new Map([[launchKey, { token, playSessionId: 'voice-test', gameId: 'game-math', areaId: 'room-sun-play' }]]);
    const calls: string[] = [];
    const engine = { version: 'test-v1', async synthesize(text: string, voice: string) { calls.push(voice); return Buffer.from(voice + ':' + text); } };
    const store = { commit(db: any, _meta: any, change: (db: any) => void) { change(db); } };
    const service = createTtsService({ core, launches, store, cacheDirectory: directory, engine });
    const admin = { personId: 'super-admin', assurance: 'admin', activeRole: { role: 'superAdmin', areaId: 'root' } };
    const cleanup = async () => {
        assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(directory).startsWith('gcs-tts-voices-'));
        await fs.rm(directory, { recursive: true, force: true });
    };
    return { directory, core, launches, calls, engine, service, store, admin, cleanup };
}

test('Stimmenwahl wird im Profil gespeichert und gilt für die nächste Ansage; Stimme trennt Cache', async () => {
    const f = await fixture();
    try {
        assert.equal((await f.service.preferences(request({ launchKey, op: 'state' }))).data.voices.length, 3);
        assert.equal((await f.service.preferences(request({ launchKey, op: 'set', voice: 'kerstin' }))).status, 200);
        assert.equal(f.core.db.people.find((p: any) => p.id === 'child-finn').ttsVoice, 'kerstin');
        assert.equal((await f.service.handle(request({ launchKey, text: 'Hallo', voice: 'default' }))).data.voice, 'kerstin');
        const again = createTtsService({ core: f.core, launches: f.launches, store: f.store, cacheDirectory: f.directory, engine: f.engine });
        assert.equal((await again.preferences(request({ launchKey, op: 'state' }))).data.voice, 'kerstin');
        assert.equal((await again.handle(request({ launchKey, text: 'Hallo', voice: 'default' }))).data.cached, true);
        await f.service.preferences(request({ launchKey, op: 'set', voice: 'ramona' }));
        assert.equal((await f.service.handle(request({ launchKey, text: 'Hallo', voice: 'default' }))).data.voice, 'ramona');
        const list = (await f.service.manage(request({ op: 'list', q: 'hall', voice: 'kerstin' }), f.admin)).data;
        assert.equal(list.items.length, 1); assert.equal(list.items[0].text, 'Hallo'); assert.equal(list.stats.files, 2);
        f.core.db.playSessions[0].status = 'ended';
        assert.equal((await f.service.preferences(request({ launchKey, op: 'preview', voice: 'kerstin' }))).status, 403);
    } finally { await f.cleanup(); }
});

test('SuperAdmin-Rolle, Origin und Freigaben schützen Texte, Audio und Einstellungen', async () => {
    const f = await fixture();
    try {
        assert.equal((await f.service.manage(request({ op: 'list' }), null)).status, 403);
        assert.equal((await f.service.manage(request({ op: 'list' }), { ...f.admin, activeRole: { role: 'areaAdmin', areaId: 'root' } })).status, 403);
        assert.equal((await f.service.manage(request({ op: 'list' }), { ...f.admin, assurance: 'profile' })).status, 403);
        assert.equal((await f.service.manage(request({ op: 'list' }, 'http://evil.invalid'), f.admin)).status, 403);
        assert.equal((await f.service.manage(request({ op: 'audio', key: '../secret' }), f.admin)).status, 400);
        assert.equal((await f.service.manage(request({ op: 'settings', defaultVoice: 'kerstin', disabledVoices: ['kerstin'] }), f.admin)).status, 400);
        assert.equal((await f.service.manage(request({ op: 'settings', defaultVoice: 'ramona', disabledVoices: ['kerstin'] }), f.admin)).status, 200);
        assert.equal((await f.service.preferences(request({ launchKey, op: 'set', voice: 'kerstin' }))).status, 400);
        assert.equal((await f.service.handle(request({ launchKey, text: 'Hallo' }))).data.voice, 'ramona');
        assert.equal((await f.service.preferences(request({ launchKey, op: 'preview', voice: 'kerstin' }))).status, 400);
    } finally { await f.cleanup(); }
});

test('Legacy-MP3 wird ohne neue Synthese zugeordnet; Zuordnung übersteht Neustart', async () => {
    const f = await fixture();
    try {
        const cache = new SpeechCache(f.directory, f.engine), key = cache.keyFor('2x2', 'default', 'legacy');
        await fs.writeFile(path.join(f.directory, key + '.mp3'), 'old-audio');
        assert.equal(await cache.recover(['2x2', 'andere Frage'], ['default'], ['legacy']), 1);
        assert.equal(await cache.recover(['2x2'], ['default'], ['legacy']), 0);
        const restored = new SpeechCache(f.directory, f.engine);
        const items = await restored.list(); assert.equal(items[0].text, '2x2'); assert.equal(items[0].voice, 'default');
        assert.equal((await restored.read(key)).toString(), 'old-audio'); assert.equal(f.calls.length, 0);
        const a = new PiperSpeechEngine('v1', '', { default: 'de_DE-thorsten-medium' });
        const b = new PiperSpeechEngine('v1', '', { default: 'de_DE-thorsten-medium', kerstin: 'de_DE-kerstin-low' });
        assert.equal(a.cacheVersion('default'), b.cacheVersion('default'));
    } finally { await f.cleanup(); }
});

test('Ausfall einer gewählten Stimme verwendet die Standardstimme; erfolglose Neuerzeugung erhält Audio', async () => {
    const f = await fixture();
    try {
        const engine = { version: 'fails', async synthesize(text: string, voice: string) { if (voice === 'kerstin') throw Error('unavailable'); return Buffer.from(text); } };
        const service = createTtsService({ core: f.core, launches: f.launches, store: f.store, cacheDirectory: f.directory, engine });
        await service.preferences(request({ launchKey, op: 'set', voice: 'kerstin' }));
        const result = await service.handle(request({ launchKey, text: 'Hallo' }));
        assert.equal(result.data.fallback, true); assert.equal(result.data.voice, 'default');
        let fails = false;
        const cache = new SpeechCache(f.directory, { version: 'safe', async synthesize() { if (fails) throw Error('failed'); return Buffer.from('original'); } }, 8);
        const first = await cache.get('Sicher', 'default'); fails = true;
        await assert.rejects(() => cache.get('Sicher', 'default', true));
        assert.equal((await cache.read(first.key)).toString(), 'original');
    } finally { await f.cleanup(); }
});


test('Vorbereitung erzeugt bekannte Texte je Stimme; Neuerzeugung und Auslesen sind administrierbar', async () => {
    const f = await fixture();
    try {
        f.core.db.flashcards = [{ question: '2x2', answers: ['4'] }];
        const started = await f.service.manage(request({ op: 'prepare' }), f.admin);
        assert.equal(started.data.batch.total, 9);
        assert.equal((await f.service.manage(request({ op: 'prepare' }), f.admin)).status, 409);
        for (let i = 0; i < 100; i++) {
            const state = await f.service.manage(request({ op: 'list' }), f.admin);
            if (state.data.batch.status !== 'running') break;
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        const listed = await f.service.manage(request({ op: 'list' }), f.admin);
        assert.equal(listed.data.batch.status, 'finished'); assert.equal(listed.data.stats.files, 9);
        const item = listed.data.items[0];
        assert.equal((await f.service.manage(request({ op: 'audio', key: item.key }), f.admin)).status, 200);
        const before = f.calls.length;
        assert.equal((await f.service.manage(request({ op: 'regenerate', key: item.key }), f.admin)).status, 200);
        assert.equal(f.calls.length, before + 1);
        assert.equal((await f.service.manage(request({ op: 'list' }), f.admin)).data.stats.files, 9);
    } finally { await f.cleanup(); }
});

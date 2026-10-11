import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Readable } from 'node:stream';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { createTtsService } = require('../scripts/cms/cms-tts.cjs');
const { createCore } = require('../scripts/cms/cms-core.cjs');
const { buildDb } = require('../scripts/cms/cms-seed-testdata.cjs');
const key = 'a'.repeat(48);

test('CMS-TTS: aktive Sitzung, Cache, Grenzen und kein Cloud-Ziel', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'gcs-tts-cms-'));
    const core = createCore(buildDb()), token = core.issueSession('child-finn', 'profile');
    core.db.playSessions = [{ id: 'tts-test', childId: 'child-finn', gameId: 'game-math', status: 'active' }];
    const launches = new Map([[key, { token, playSessionId: 'tts-test', gameId: 'game-math', areaId: 'room-sun-play' }]]);
    let calls = 0;
    const service = createTtsService({ core, launches, cacheDirectory: directory,
        engine: { version: 'mock', async synthesize() { calls++; return Buffer.from('MP3-test'); } } });
    const request = (body: any = { launchKey: key, text: 'Gut gerechnet!', voice: 'default' }, origin = 'http://localhost:8081') =>
        Object.assign(Readable.from([Buffer.from(JSON.stringify(body))]), { method: 'POST', headers: { host: 'localhost:8081', origin, 'content-type': 'application/json' } });
    try {
        assert.equal((await service.handle(request())).status, 200);
        assert.equal((await service.handle(request())).data.cached, true);
        assert.equal(calls, 1);
        assert.equal((await service.handle(request(undefined, 'null'))).status, 403);
        assert.equal((await service.handle(request({ launchKey: 'wrong', text: 'Hallo' }))).status, 403);
        assert.equal((await service.handle(request({ launchKey: key, text: 'Hallo', voice: '../bad' }))).status, 400);
        assert.equal((await service.handle(request({ launchKey: key, text: 'x'.repeat(501) }))).status, 400);
        assert.equal((await service.handle(request(null))).status, 400);
        core.db.playSessions[0].status = 'ended';
        assert.equal((await service.handle(request())).status, 403);
        assert.throws(() => createTtsService({ core, launches, endpoint: 'https://external.invalid/' }), /lokalen/);
    } finally {
        const resolved = path.resolve(directory);
        assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith('gcs-tts-cms-'));
        await fs.rm(resolved, { recursive: true, force: true });
    }
});

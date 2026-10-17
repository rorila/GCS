import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { projectRoot, validateProductionEnvironment, singleFlight } from './production/runtime-config.mjs';

const require = createRequire(import.meta.url);
const { createHttpGuards } = require('./cms/cms-http-guard.cjs');
const base = {
    JWT_SECRET: 'test-only', CMS_STORAGE: 'sqlite', CMS_SQLITE_PATH: '/data/cms/cms.sqlite',
    PUBLIC_ORIGIN: 'https://games.example.org', GCS_EDITOR_APIS: 'off', CMS_EDITOR_TEST: 'off',
};
test('Production root resolves both real service entrypoints', () => {
    assert.equal(projectRoot, path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
    for (const file of ['package.json', 'scripts/cms/cms-server.cjs', 'game-server/src/server.ts'])
        assert.ok(fs.existsSync(path.join(projectRoot, file)), file);
});
test('Startup rejects missing database configuration and unsafe editor activation', () => {
    assert.doesNotThrow(() => validateProductionEnvironment(base));
    for (const env of [
        { ...base, JWT_SECRET: '' }, { ...base, CMS_STORAGE: 'json' },
        { ...base, PUBLIC_ORIGIN: 'http://games.example.org' },
        { ...base, PUBLIC_ORIGIN: 'https://<fly-app>.fly.dev' },
        { ...base, GCS_EDITOR_PUBLIC: '1' }, { ...base, GCS_EDITOR_APIS: 'on' },
    ]) assert.throws(() => validateProductionEnvironment(env));
});
test('Required external backup validates secrets before services are started', () => {
    assert.throws(() => validateProductionEnvironment({ ...base, CMS_BACKUP_REQUIRE_EXTERNAL: '1' }));
    const env = { ...base, CMS_BACKUP_REQUIRE_EXTERNAL: '1', CMS_BACKUP_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64') };
    for (const [key, value] of Object.entries({ ENDPOINT: 'https://s3.example.org', BUCKET: 'test', REGION: 'test', ACCESS_KEY: 'test', SECRET_KEY: 'test' })) env['CMS_BACKUP_S3_' + key] = value;
    assert.doesNotThrow(() => validateProductionEnvironment(env));
    assert.throws(() => validateProductionEnvironment({ ...env, CMS_BACKUP_S3_ENDPOINT: 'http://s3.example.org' }));
});
test('A slow or failed backup never overlaps and can retry', async () => {
    let finish;
    let calls = 0;
    const run = singleFlight(() => { calls++; return new Promise(resolve => { finish = resolve; }); });
    const pending = run();
    assert.deepEqual(await run(), { skipped: true });
    assert.equal(calls, 1);
    finish(); await pending;
    const next = run(); finish(); await next; assert.equal(calls, 2);
    const failure = singleFlight(async () => { throw new Error('failed'); });
    await assert.rejects(failure()); await assert.rejects(failure());
});
test('HTTPS websocket origin is accepted only for the configured public origin', () => {
    const guards = createHttpGuards({ publicOrigin: base.PUBLIC_ORIGIN, trustProxy: true });
    const req = origin => ({ headers: { host: 'games.example.org', origin } });
    assert.equal(guards.originOk(req(base.PUBLIC_ORIGIN)), true);
    assert.equal(guards.originOk(req('https://other.example.org')), false);
    assert.equal(guards.originOk(req('http://games.example.org')), false);
    assert.equal(guards.originOk(req('ftp://games.example.org')), false);
});
test('Proxy client IP accepts only a single normalized IP from loopback', () => {
    const guards = createHttpGuards({ publicOrigin: base.PUBLIC_ORIGIN, trustProxy: true });
    const req = (ip, remoteAddress = '127.0.0.1') => ({ socket: { remoteAddress }, headers: { 'x-forwarded-for': ip } });
    assert.equal(guards.clientIp(req('198.51.100.10')), '198.51.100.10');
    assert.equal(guards.clientIp(req('2001:db8::1')), '2001:db8::1');
    assert.equal(guards.clientIp(req('1.2.3.4, 198.51.100.10')), '127.0.0.1');
    assert.equal(guards.clientIp(req('not-an-ip')), '127.0.0.1');
    assert.equal(guards.clientIp(req('1.2.3.4', '198.51.100.10')), '198.51.100.10');
});

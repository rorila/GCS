import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { ensureLocalService } = require('../scripts/cms/cms-local-services.cjs');
async function directory() { return await fs.promises.mkdtemp(path.join(os.tmpdir(), 'gcs-service-owner-')); }
async function cleanup(dir: string) {
    assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(dir).startsWith('gcs-service-owner-'));
    await fs.promises.rm(dir, { recursive: true, force: true });
}
async function listeningPort() {
    const server = net.createServer(); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    return { server, port: (server.address() as net.AddressInfo).port };
}
function spec(dir: string, port: number) {
    return { name: 'Test-Service', preferredPort: port, stateFile: path.join(dir, 'service.json'), identity: 'project-v2:test',
        command: process.execPath, cwd: dir, timeoutMs: 5000, logger: () => {},
        argsForPort: (selected: number) => ['-e', "require('http').createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({voices:true}));}).listen(" + selected + ", '127.0.0.1');"],
        ready: async (selected: number) => { try { const response = await fetch('http://127.0.0.1:' + selected, { signal: AbortSignal.timeout(150) }); return !!(await response.json()).voices; } catch { return false; } }
    };
}
test('Dienststart weicht fremdem belegten Port aus und beendet nur seinen eigenen Prozess', async () => {
    const dir = await directory(), busy = await listeningPort(); let service: any;
    try {
        service = await ensureLocalService(spec(dir, busy.port));
        assert.notEqual(service.port, busy.port); assert.equal(service.owned, true);
        const state = JSON.parse(fs.readFileSync(path.join(dir, 'service.json'), 'utf8'));
        assert.ok(state.pid); await service.stop(); service = undefined;
        assert.equal(fs.existsSync(path.join(dir, 'service.json')), false);
        assert.ok(busy.server.listening);
    } finally { await service?.stop(); await new Promise<void>(resolve => busy.server.close(() => resolve())); await cleanup(dir); }
});
test('Passender v2-Dienst wird wiederverwendet; Wiederverwender beendet ihn nicht', async () => {
    const dir = await directory(), reservation = await listeningPort(), port = reservation.port;
    await new Promise<void>(resolve => reservation.server.close(() => resolve()));
    let owner: any;
    try {
        owner = await ensureLocalService(spec(dir, port));
        const borrower = await ensureLocalService(spec(dir, port));
        assert.equal(borrower.owned, false); assert.equal(borrower.port, owner.port);
        await borrower.stop(); assert.equal(await spec(dir, port).ready(owner.port), true);
        await owner.stop(); owner = undefined;
    } finally { await owner?.stop(); await cleanup(dir); }
});
test('Abgebrochener Start entfernt den eigenen Prozess und hinterlaesst keinen Dienststatus', async () => {
    const dir = await directory(), reservation = await listeningPort(), port = reservation.port;
    await new Promise<void>(resolve => reservation.server.close(() => resolve()));
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 100);
    try {
        await assert.rejects(() => ensureLocalService({ ...spec(dir, port), ready: async () => false, signal: controller.signal }), /abgebrochen/);
        assert.equal(fs.existsSync(path.join(dir, 'service.json')), false);
        const next = await ensureLocalService(spec(dir, port)); await next.stop();
    } finally { clearTimeout(timeout); await cleanup(dir); }
});

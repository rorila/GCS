// Testet den isolierten CMS-Testkontext für den Editor-RunTab:
// synthetischer Spieler + Kartenstapel pro Kontext, echte CMS-Daten bleiben
// unberührt. Berechtigung, Leitner-Logik und Sitzungsende laufen über die
// üblichen CMS-Adapter (scripts/cms/cms-editor-test.cjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import vm from 'node:vm';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(path.resolve('tests/x.ts'));
const { createEditorTestService } = require('../scripts/cms/cms-editor-test.cjs');
const { buildDb } = require('../scripts/cms/cms-seed-testdata.cjs');
const CMS_FILE = path.resolve('game-server/public/projects/GCS-CMS.json');

const request = (url: string, body?: unknown, headers: Record<string, string> = {}) => {
    const raw = JSON.stringify(body ?? {});
    const req = Object.assign(Readable.from([Buffer.from(raw)]), {
        url, method: 'POST',
        headers: { 'content-type': 'application/json', 'x-gcs-editor-test': '1', ...headers },
        socket: { remoteAddress: '127.0.0.1' },
    });
    return req;
};

const project = () => ({ id: 'p', name: 'Karteikasten-Quiz', version: '3.0.0', stages: [{ id: 's', name: 'Game', scene: { width: 1, height: 1, objects: [] }, variables: [{ name: 'CMS_LAUNCH', value: '', type: 'string' }], actions: {}, tasks: [] }], actions: {} });

async function start(service: any, extra: Record<string, unknown> = {}) {
    const res = await service.handle(request('/api/cms/editor-test/start', { project: project(), player: 'test-a', deck: 'math', ...extra }));
    assert.equal(res.status, 200, JSON.stringify(res));
    return res.data;
}

const play = (service: any, launchKey: string, action: string, extra: Record<string, unknown> = {}) =>
    service.handle(request('/api/cms/editor-test/play', { launchKey, action, ...extra }));

test('Editor-Testkontext: Start erzeugt isolierte Sitzung mit Karten', async () => {
    const service = createEditorTestService({ cmsFile: CMS_FILE });
    const data = await start(service);
    assert.match(data.launchKey, /^[a-f0-9]{48}$/);
    assert.match(data.page, /^\/api\/cms\/editor-test\/page\//);
    assert.equal(data.player, 'Testkind A');
    assert.equal(data.cards, 6);
});

test('Editor-Testkontext: Karten gehören ausschließlich dem Testspieler', async () => {
    const service = createEditorTestService({ cmsFile: CMS_FILE });
    const { launchKey } = await start(service);
    const first = await play(service, launchKey, 'cardNext');
    assert.equal(first.status, 200, JSON.stringify(first));
    assert.equal(first.data.ok, true);
    assert.ok(first.data.card.id.startsWith('tcard-math-'));
    const state = await service.handle(request('/api/cms/editor-test/state', { launchKey }));
    assert.equal(state.data.cards.length, 6);
    for (const card of state.data.cards) assert.equal(card.childId, 'test-a');
});

test('Editor-Testkontext: richtige Antwort hebt Fach, falsche legt Karte hinten in Fach 1', async () => {
    const service = createEditorTestService({ cmsFile: CMS_FILE });
    const { launchKey } = await start(service);
    const first = await play(service, launchKey, 'cardNext');
    const cardId = first.data.card.id, answer = first.data.card.answers[0];
    const correct = await play(service, launchKey, 'cardAnswer', { cardId, given: answer, correct: true });
    assert.equal(correct.data.ok, true, JSON.stringify(correct));
    let state = await service.handle(request('/api/cms/editor-test/state', { launchKey }));
    assert.equal(state.data.cards.find((c: any) => c.id === cardId).box, 2);
    const wrong = await play(service, launchKey, 'cardAnswer', { cardId, given: 'falsch', correct: false });
    assert.equal(wrong.data.ok, true);
    state = await service.handle(request('/api/cms/editor-test/state', { launchKey }));
    assert.equal(state.data.cards.find((c: any) => c.id === cardId).box, 1);
    // Zurückgelegte Karte bleibt ziehbar (nicht dauerhaft ausgeschlossen).
    const again = await play(service, launchKey, 'cardNext', { excludeIds: [] });
    assert.equal(again.data.ok, true);
});

test('Editor-Testkontext: Fremdkarte wird abgelehnt', async () => {
    const service = createEditorTestService({ cmsFile: CMS_FILE });
    const { launchKey } = await start(service);
    const res = await play(service, launchKey, 'cardAnswer', { cardId: 'card-1', given: '6', correct: true });
    assert.notEqual(res.status, 200);
    assert.equal(res.data.ok, false);
});

test('Editor-Testkontext: ungültige oder beendete Schlüssel werden abgelehnt', async () => {
    const service = createEditorTestService({ cmsFile: CMS_FILE });
    const bad = await play(service, 'f'.repeat(48), 'cardNext');
    assert.equal(bad.status, 401);
    const { launchKey } = await start(service);
    await service.handle(request('/api/cms/editor-test/close', { launchKey }));
    const after = await play(service, launchKey, 'cardNext');
    assert.equal(after.status, 401);
});

test('Editor-Testkontext: Fremdzugriff, Header-Schutz und Kontextgrenzen', async () => {
    const service = createEditorTestService({ cmsFile: CMS_FILE });
    const remote = request('/api/cms/editor-test/start', { project: project(), player: 'test-a', deck: 'math' });
    remote.socket.remoteAddress = '10.0.0.9';
    assert.equal((await service.handle(remote)).status, 403);
    const noHeader = request('/api/cms/editor-test/start', { project: project(), player: 'test-a', deck: 'math' }, { 'x-gcs-editor-test': '' });
    assert.equal((await service.handle(noHeader)).status, 403);
    const evil = await service.handle(request('/api/cms/editor-test/start', { project: project(), player: 'child-finn', deck: 'math' }));
    assert.equal(evil.status, 400);
});

test('Editor-Testkontext: Testseite enthält Projekt, Launch-Key und Sandbox-Schutz', async () => {
    const service = createEditorTestService({ cmsFile: CMS_FILE });
    const { launchKey, page } = await start(service);
    const req = Object.assign(Readable.from([]), { url: page, method: 'GET',
        headers: { 'x-gcs-editor-test': '1' }, socket: { remoteAddress: '127.0.0.1' } });
    const res = await service.handle(req);
    assert.equal(res.status, 200);
    assert.match(res.headers['Content-Security-Policy'], /sandbox allow-scripts/);
    assert.ok(res.html.includes(launchKey));
    assert.ok(res.html.includes('Karteikasten-Quiz'));
    assert.ok(res.html.includes('editor-test'));
});

test('Editor-Testkontext: Bridge bildet /api/cms/play auf den Test-Endpunkt ab', async () => {
    const service = createEditorTestService({ cmsFile: CMS_FILE });
    const { launchKey, page } = await start(service);
    const pageReq = Object.assign(Readable.from([]), { url: page, method: 'GET',
        headers: { 'x-gcs-editor-test': '1' }, socket: { remoteAddress: '127.0.0.1' } });
    const res = await service.handle(pageReq);
    const scripts = [...res.html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
    const source = scripts.find(s => s.includes('gcs-cms-bridge'));
    assert.ok(source, 'Bridge-Skript fehlt in der Testseite');

    // Minimale Host-Umgebung: fetch fängt nichts mehr ab, parent.postMessage
    // zeichnet die Weiterleitung auf, der message-Listener liefert die Antwort.
    const posted: any[] = [], listeners: ((e: any) => void)[] = [];
    const sandbox: any = {
        console, crypto, setTimeout, clearTimeout, Promise, Response, Error, JSON, URL, Map,
        document: { baseURI: 'http://localhost:5173/api/cms/editor-test/page/x' },
        parent: { postMessage: (msg: any) => posted.push(msg) },
        addEventListener: (type: string, fn: any) => { if (type === 'message') listeners.push(fn); },
        dispatchEvent: () => {}, CustomEvent: class {},
        fetch: async () => { throw new Error('Direkter Netzwerkzugriff verboten.'); },
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox);

    const pending = sandbox.window.fetch('/api/cms/play',
        { method: 'POST', body: JSON.stringify({ launchKey, action: 'cardNext', subject: 'Mathe' }) });
    assert.equal(posted.length, 1, 'Bridge hat die Anfrage nicht weitergeleitet');
    assert.equal(posted[0].type, 'gcs-cms-bridge');
    assert.equal(posted[0].route, '/api/cms/editor-test/play');

    listeners.forEach(fn => fn({ source: sandbox.parent, origin: 'http://localhost:5173',
        data: { type: 'gcs-cms-result', id: posted[0].id, status: 200, data: { ok: true, card: { id: 'tcard-math-0' } } } }));
    const response = await Promise.race([pending,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Bridge-Antwort blieb aus.')), 2000))]) as Response;
    assert.equal(response.status, 200);
    assert.equal((await response.json()).card.id, 'tcard-math-0');
});

test('Editor-Testkontext: Kontexte laufen ab und der echte Bestand bleibt unverändert', async () => {
    let t = 0;
    const service = createEditorTestService({ cmsFile: CMS_FILE, now: () => t });
    const { launchKey } = await start(service);
    t = 31 * 60_000;
    assert.equal((await play(service, launchKey, 'cardNext')).status, 401);
    // Unberührt: die synthetische Ausgangsbasis kennt die Testkarten nicht.
    const real = buildDb();
    assert.ok(!real.flashcards.some((c: any) => c.id.startsWith('tcard-')));
    assert.ok(!real.people.some((p: any) => p.id === 'test-a'));
});

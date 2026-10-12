const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const crypto = require('node:crypto'), vm = require('node:vm'), assert = require('node:assert/strict');
const { test } = require('node:test');
const { Readable } = require('node:stream');
const { EventEmitter } = require('node:events');
const { createServer } = require('./cms/cms-server.cjs');
const { buildDb } = require('./cms/cms-seed-testdata.cjs');
const project = require('../game-server/public/projects/Kopfrechnen-App.json');

const request = (app, url, body) => new Promise((resolve, reject) => {
  const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
  Object.assign(req, { url, method: body === undefined ? 'GET' : 'POST', headers: { host: 'localhost:8081', origin: 'http://localhost:8081' }, socket: { remoteAddress: '127.0.0.1' } });
  const headers = {}, res = new EventEmitter();
  res.setHeader = (name, value) => { headers[name.toLowerCase()] = value; };
  res.getHeaders = () => headers;
  res.writeHead = (status, values = {}) => { res.statusCode = status; res.headersSent = true; for (const [name, value] of Object.entries(values)) res.setHeader(name, value); };
  res.end = text => { res.emit('finish'); resolve({ status: res.statusCode, headers, text: String(text ?? '') }); };
  Promise.resolve(app.server.listeners('request')[0](req, res)).catch(reject);
});

const bridgeRuntime = (script, forward) => {
  const listeners = {}, messages = [], timers = new Set();
  let sequence = 0, directRequests = 0;
  const parent = { postMessage: message => {
    messages.push(message);
    if (forward) void forward(message).then(result => listeners.message({ source: parent, origin: 'http://localhost:8081', data: { type: 'gcs-cms-result', id: message.id, status: result.status, data: JSON.parse(result.text) } }));
  } };
  const window = { fetch: async () => { directRequests++; throw Error('Direct fetch blocked by CSP'); } };
  const context = vm.createContext({ window, parent, document: { baseURI: 'http://localhost:8081/play/test/' }, URL, Response,
    crypto: { randomUUID: () => 'request-' + ++sequence },
    addEventListener: (name, callback) => { listeners[name] = callback; },
    setTimeout: (callback, delay) => { const id = setTimeout(callback, delay); timers.add(id); return id; },
    clearTimeout: id => { clearTimeout(id); timers.delete(id); },
  });
  vm.runInContext(script, context);
  return { window, parent, listeners, messages, directRequests: () => directRequests, close: () => { for (const id of timers) clearTimeout(id); } };
};

const bridgeScript = html => [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]).find(script => script.includes('gcs-cms-bridge'));

test('Solo-GCS-Upload: geschuetzte Kartenanfragen ohne Netzwerk-Listener', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gcs-solo-bridge-'));
  let app;
  try {
    const db = buildDb();
    db.playSessions = [];
    db.parties = [];
    const game = db.games.find(item => item.id === 'game-math');
    game.storage = 'upload';
    game.file = 'game-' + crypto.randomUUID() + '.json';
    db.flashcards = ['child-finn', 'child-emil'].map(childId => ({ id: 'card-' + childId, childId, subject: 'Mathe', topic: '1x2', question: '2x2', answers: ['4'], answerFormat: 'text', box: 1, active: true, createdBy: childId, createdAt: new Date().toISOString() }));
    const dataPath = path.join(dir, 'cms.json');
    fs.writeFileSync(dataPath, JSON.stringify(db));
    fs.mkdirSync(path.join(dir, 'uploads'));
    fs.writeFileSync(path.join(dir, 'uploads', game.file), JSON.stringify(project));
    app = createServer({ dataPath });
    assert.equal(app.server.listening, false);
    const token = app.core.issueSession('child-finn', 'profile');
    const started = await request(app, '/api/cms/launch', { token, gameId: game.id, areaId: 'room-sun-play' });
    assert.equal(started.status, 200, started.text);
    const launch = JSON.parse(started.text).launch, key = launch.split('/').pop();
    const page = await request(app, launch);
    assert.equal(page.status, 200, page.text);
    await t.test('Sandbox bleibt unveraendert und Solo bekommt die Bridge', () => {
      assert.match(page.headers['content-security-policy'], /sandbox allow-scripts;/);
      assert.match(page.headers['content-security-policy'], /connect-src 'none'/);
      assert.doesNotMatch(page.headers['content-security-policy'], /allow-same-origin/);
      assert.ok(bridgeScript(page.text), 'Solo-Upload muss die Bridge enthalten');
      assert.ok(!page.text.includes(token), 'Spiel darf kein Profil-Token erhalten');
    });
    const script = bridgeScript(page.text);
    assert.ok(script, 'Bridge fuer Verhaltenstests erforderlich');
    const runtime = bridgeRuntime(script, message => request(app, message.route, message.body));
    try {
      const call = async (action, extra = {}) => {
        const response = await runtime.window.fetch('/api/cms/play', { method: 'POST', body: JSON.stringify({ launchKey: key, action, ...extra }) });
        return { status: response.status, data: await response.json() };
      };
      await t.test('cardNext und cardAnswer laufen ueber Bridge und eigenen Karteikasten', async () => {
        const next = await call('cardNext', { subject: 'Mathe', formats: ['text'] });
        assert.equal(next.status, 200);
        assert.equal(next.data.card.id, 'card-child-finn');
        const answer = await call('cardAnswer', { cardId: next.data.card.id, correct: true });
        assert.equal(answer.data.ok, true);
        assert.equal(app.core.db.flashcards.find(card => card.id === next.data.card.id).box, 2);
        assert.equal(runtime.directRequests(), 0);
      });
      await t.test('Fremde Karte und ungueltiger Schluessel werden abgelehnt', async () => {
        assert.equal((await call('cardAnswer', { cardId: 'card-child-emil', correct: true })).status, 403);
        const before = runtime.messages.length;
        await assert.rejects(() => call('cardNext', { launchKey: 'invalid' }), /Spielberechtigung/);
        assert.equal(runtime.messages.length, before);
        const invalid = await request(app, '/api/cms/play', { launchKey: 'invalid', action: 'cardNext' });
        assert.equal(invalid.status, 401);
      });
      await t.test('cardPointSummary liefert schlanke Zusammenfassung ueber die Bridge', async () => {
        // Echter Lernpunktefluss: Ziehen mit learningPoints bucht einen Versuch,
        // Antwort mit attemptId schreibt die Lernpunktebuchung.
        const draw = await call('cardNext', { subject: 'Mathe', formats: ['text'], learningPoints: true });
        assert.equal(draw.status, 200);
        assert.ok(draw.data.card.attemptId, 'Versuch wird ausgestellt');
        const booked = await call('cardAnswer', { cardId: draw.data.card.id, attemptId: draw.data.card.attemptId, correct: true, answer: '4' });
        assert.equal(booked.data.ok, true);
        assert.equal(booked.data.learningEventId, 'card-learning:' + draw.data.card.attemptId);
        assert.equal(booked.data.learning.totalPoints, 1);

        const sum = await call('cardPointSummary', { childId: 'child-emil' });
        assert.equal(sum.status, 200);
        assert.equal(sum.data.ok, true);
        // Stand des Launch-Kindes; fremde childId wirkungslos
        assert.equal(sum.data.learning.totalPoints, 1);
        assert.equal(sum.data.learning.revision, 1);
        assert.equal(sum.data.items, undefined, 'keine Ledger-Items im Spielweg');
        assert.equal(runtime.directRequests(), 0);
      });
      await t.test('Heartbeat und explizites Ende funktionieren fuer Solo', async () => {
        assert.equal((await call('heartbeat')).data.ok, true);
        const end = await call('end');
        assert.equal(end.data.status, 'ended');
        assert.equal(end.data.learning.totalPoints, 1, 'Endstand reist in der end-Antwort');
        assert.equal(app.launches.has(key), false);
        assert.equal(runtime.directRequests(), 0);
      });
      await t.test('cardPointSummary nach Ende wird vom Server abgelehnt', async () => {
        const late = await call('cardPointSummary');
        assert.equal(late.status, 401, 'Launch geloescht → Server lehnt ab');
        assert.equal(late.data.ok, false);
      });
    } finally { runtime.close(); }
    await t.test('Antworten fremder Fenster oder Origins werden ignoriert', async () => {
      const isolated = bridgeRuntime(script);
      try {
        let settled = false;
        const pending = isolated.window.fetch('/api/cms/play', { body: JSON.stringify({ launchKey: key, action: 'cardNext' }) }).then(response => { settled = true; return response; });
        const data = { type: 'gcs-cms-result', id: isolated.messages[0].id, status: 200, data: { ok: true } };
        isolated.listeners.message({ source: {}, origin: 'http://localhost:8081', data });
        isolated.listeners.message({ source: isolated.parent, origin: 'https://untrusted.invalid', data });
        await Promise.resolve();
        assert.equal(settled, false);
        isolated.listeners.message({ source: isolated.parent, origin: 'http://localhost:8081', data });
        assert.deepEqual(await (await pending).json(), { ok: true });
        const count = isolated.messages.length;
        await assert.rejects(() => isolated.window.fetch('/api/cms/play', { body: '{' }), /Spielanfrage/);
        await assert.rejects(() => isolated.window.fetch('/api/cms/admin/people', {}), /blocked by CSP/);
        assert.equal(isolated.messages.length, count);
      } finally { isolated.close(); }
    });
    await t.test('Multiplayer-Uploads behalten die Bridge', async () => {
      app.core.db.games.find(item => item.id === game.id).multiplayer = { minPlayers: 2, maxPlayers: 4, scope: 'house' };
      app.launches.set(key, { token, gameId: game.id, areaId: 'room-sun-play' });
      assert.ok(bridgeScript((await request(app, launch)).text));
    });
  } finally {
    app?.server.emit('close');
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

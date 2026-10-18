// Host-Bridge-Test: fuehrt das echte scripts/cms/cms-shell.js mit einem
// minimalen DOM in einer vm-Sandbox aus und treibt echte gcs-cms-bridge-
// Nachrichten durch den echten CMS-Server.
//
// Geprueft wird die Hostseite der Upload-Bridge (connect-src 'none'):
//   - cardPointSummary ist erlaubt und liefert die schlanke Zusammenfassung
//   - unbekannte Actions werden verworfen (kein Fetch, keine Antwort)
//   - falscher Launch-Schluessel, fremde Route, zu grosse Koerper,
//     fremde Quelle/Origin werden abgelehnt
//   - CmsGameHost.ts (zweite manuell gepflegte Allowlist) deckt dieselben
//     Actions ab — Quelltext-Abgleich, da TS nicht direkt laeuft
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const crypto = require('node:crypto'), vm = require('node:vm'), assert = require('node:assert/strict');
const { test } = require('node:test');
const { Readable } = require('node:stream');
const { EventEmitter } = require('node:events');
const { createServer } = require('./cms/cms-server.cjs');
const { buildDb } = require('./cms/cms-seed-testdata.cjs');

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

// ── Minimales Fake-DOM fuer cms-shell.js ────────────────────────────
const fakeElement = tag => {
  const el = {
    tagName: tag.toUpperCase(), children: [], attributes: {}, style: {},
    hidden: false, textContent: '', title: '', disabled: false,
    append(...c) { this.children.push(...c); },
    appendChild(c) { this.children.push(c); return c; },
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return this.attributes[k]; },
    querySelector() { return null; },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
  };
  if (tag === 'iframe') Object.defineProperty(el, 'src', { get() { return this.attributes.src; }, set(v) { this.attributes.src = v; } });
  return el;
};

// Laedt cms-shell.js, loest DOMContentLoaded aus und gibt Zugriff auf
// die produktive Message-Behandlung zurueck.
const loadShell = (fetchImpl) => {
  const listeners = {}, elements = [];
  const documentListeners = {};
  const document = {
    addEventListener: (name, fn) => { documentListeners[name] = fn; },
    createElement: tag => { const el = fakeElement(tag); elements.push(el); return el; },
    getElementById: () => null,
    body: fakeElement('body'),
  };
  const context = vm.createContext({
    document,
    window: { player: undefined, attachCmsSpeechHost: undefined },
    location: { pathname: '/', origin: 'http://localhost:8081', protocol: 'http:', host: 'localhost:8081' },
    fetch: fetchImpl,
    WebSocket: function () { throw Error('kein Websocket im Test'); },
    setInterval: () => 0,
    setTimeout: () => 0,
    clearTimeout: () => {},
    addEventListener: (name, fn) => { listeners[name] = fn; },
    console,
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'cms/cms-shell.js'), 'utf8'), context);
  assert.equal(typeof documentListeners.DOMContentLoaded, 'function');
  documentListeners.DOMContentLoaded();
  assert.equal(typeof listeners.message, 'function', 'Shell registriert message-Handler');
  const frame = elements.find(e => e.tagName === 'IFRAME');
  const layer = elements.find(e => e.tagName === 'SECTION' && e.children.includes(frame));
  assert.ok(frame && layer, 'Spiel-Layer mit iframe aufgebaut');
  frame.contentWindow = { postMessageCalls: [], postMessage(m) { this.postMessageCalls.push(m); } };
  layer.hidden = false;
  return { listeners, frame, layer };
};

test('Produktivhost cms-shell.js: cardPointSummary erlaubt, Rest abgelehnt', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gcs-host-bridge-'));
  let app;
  try {
    const db = buildDb();
    db.playSessions = [];
    db.parties = [];
    db.flashcards = [{ id: 'card-finn', childId: 'child-finn', subject: 'Mathe', topic: '1x2', question: '2x2', answers: ['4'], answerFormat: 'text', box: 3, active: true, createdBy: 'child-finn', createdAt: new Date().toISOString() }];
    const dataPath = path.join(dir, 'cms.json');
    fs.writeFileSync(dataPath, JSON.stringify(db));
    app = createServer({ dataPath });
    const token = app.core.issueSession('child-finn', 'profile');
    const started = await request(app, '/api/cms/launch', { token, gameId: 'game-math', areaId: 'room-sun-play' });
    assert.equal(started.status, 200, started.text);
    const key = JSON.parse(started.text).launch.split('/').pop();

    // fetch im Host: /api/cms/contexts lokal beantworten, Spielrouten an den echten Server.
    const fetches = [];
    const fetchImpl = async (url, opts = {}) => {
      fetches.push(url);
      if (url === '/api/cms/contexts') return { ok: true, json: async () => ({ ok: false }) };
      const r = await request(app, url, JSON.parse(opts.body || '{}'));
      return { status: r.status, ok: r.status < 300, json: async () => JSON.parse(r.text) };
    };
    const shell = loadShell(fetchImpl);
    shell.frame.src = '/play/' + key;
    const emit = data => shell.listeners.message({ source: shell.frame.contentWindow, origin: 'null', data });
    const bridge = (id, body, route = '/api/cms/play') => emit({ type: 'gcs-cms-bridge', id, route, body });
    const results = () => shell.frame.contentWindow.postMessageCalls.filter(m => m.type === 'gcs-cms-result');

    await t.test('cardPointSummary geht durch den echten Server', async () => {
      await bridge('req-summary', { launchKey: key, action: 'cardPointSummary' });
      const res = results().find(m => m.id === 'req-summary');
      assert.ok(res, 'Antwort an den Frame gesendet');
      assert.equal(res.status, 200);
      assert.equal(res.data.ok, true);
      assert.equal(typeof res.data.learning.totalPoints, 'number');
      assert.equal(res.data.learning.revision, 0);
      assert.equal(res.data.items, undefined);
      assert.ok(fetches.includes('/api/cms/play'));
    });

    await t.test('unbekannte Action wird still verworfen', async () => {
      const before = fetches.length, replies = results().length;
      await bridge('req-unknown', { launchKey: key, action: 'dropTables' });
      assert.equal(fetches.length, before, 'kein Fetch fuer unbekannte Action');
      assert.equal(results().length, replies, 'keine Antwort an den Frame');
    });

    await t.test('falscher Launch, fremde Route und zu grosser Koerper abgelehnt', async () => {
      const before = fetches.length;
      await bridge('req-wrong-key', { launchKey: 'x'.repeat(48), action: 'cardPointSummary' });
      await bridge('req-route', { launchKey: key, action: 'cardPointSummary' }, '/api/cms/admin');
      await bridge('req-huge', { launchKey: key, action: 'cardPointSummary', pad: 'x'.repeat(5000) });
      await bridge('req-party-op', { launchKey: key, op: 'destroy' }, '/api/cms/party');
      assert.equal(fetches.length, before);
    });

    await t.test('fremde Quelle oder Origin werden ignoriert', async () => {
      const before = fetches.length;
      const msg = { type: 'gcs-cms-bridge', id: 'req-foreign', route: '/api/cms/play', body: { launchKey: key, action: 'cardPointSummary' } };
      await shell.listeners.message({ source: {}, origin: 'null', data: msg });
      await shell.listeners.message({ source: shell.frame.contentWindow, origin: 'https://fremd.invalid', data: msg });
      assert.equal(fetches.length, before);
      assert.equal(results().find(m => m.id === 'req-foreign'), undefined);
    });

    await t.test('Endstand reist mit, danach verweigert der Server', async () => {
      await bridge('req-end', { launchKey: key, action: 'end' });
      const end = results().find(m => m.id === 'req-end');
      assert.equal(end.status, 200);
      assert.equal(end.data.status, 'ended');
      assert.ok(end.data.learning, 'learning im Ende-Vertrag');
      await bridge('req-after', { launchKey: key, action: 'cardPointSummary' });
      const late = results().find(m => m.id === 'req-after');
      // Die Host-Allowlist laesst die Action weiterhin durch — der Server
      // entscheidet ueber die Berechtigung (Launch geloescht → 401).
      assert.equal(late.status, 401);
    });
  } finally {
    app?.server.emit('close');
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('CmsGameHost.ts erlaubt dieselben Actions wie cms-shell.js', () => {
  const listOf = file => {
    const src = fs.readFileSync(file, 'utf8');
    const m = src.match(/\[(('[^']+',?)+)\]\.includes\(data\.body\.action\)/);
    assert.ok(m, 'Allowlist in ' + file + ' gefunden');
    return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]).sort();
  };
  const shell = listOf(path.join(__dirname, 'cms/cms-shell.js'));
  const host = listOf(path.join(__dirname, '../src/adapters/CmsGameHost.ts'));
  assert.deepEqual(host, shell, 'beide Produktivhosts muessen deckungsgleich erlauben');
  assert.ok(shell.includes('cardPointSummary'));
});

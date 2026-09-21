// P1.3 Angriffscheckliste gegen den CMS-Server (HTTP-Ebene, Demo-Daten in Temp).
// Prüft: Sitzungsgrenzen, Origin-Schutz, Rate-Limits, Größenlimits,
// Trace-Maskierung, Deaktivierung in laufender Sitzung.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { createServer } = require('./cms/cms-server.cjs');
const { redact } = require('./cms/cms-trace.cjs');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gcs-sec-'));
  const dataPath = path.join(dir, 'cms.json');
  const app = createServer({ dataPath });
  const base = 'http://127.0.0.1:15199';
  const results = [];
  const check = (n, v) => { try { assert.ok(v); results.push(['OK', n]); } catch (e) { results.push(['FEHLER', n]); } };

  const post = async (route, body = {}, headers = {}) => {
    const r = await fetch(base + '/api/cms/' + route, {
      method: 'POST',
      headers: { Connection: 'close', 'Content-Type': 'application/json', Origin: base, ...headers },
      body: JSON.stringify(body),
    });
    let data = null; try { data = await r.json(); } catch {}
    return { status: r.status, data };
  };

  try {
    await new Promise(r => app.server.listen(15199, '127.0.0.1', r));

    // --- Sitzungsgrenzen ---
    check('Ohne Token: 401', (await post('rooms', {})).status === 401);
    check('Gefälschter Token: 401', (await post('rooms', { token: 'f'.repeat(64) })).status === 401);
    check('Admin-API ohne Cookie: 401', (await post('admin/rooms', {})).status === 401);

    const login = await post('login', { areaId: 'demo-house', sequence: ['dog', 'tree', 'house', 'elephant'] });
    check('Gültige Anmeldung liefert Token', !!login.data?.token);
    const token = login.data.token;
    check('Mit Token: Räume sichtbar', (await post('rooms', { token })).status === 200);
    check('Logout invalidiert Token', (await post('logout', { token })).status === 200 && (await post('rooms', { token })).status === 401);

    // Deaktivierte Person verliert laufende Sitzung
    const login2 = await post('login', { areaId: 'demo-house', sequence: ['dog', 'tree', 'house', 'elephant'] });
    const p = app.core.db.people.find(x => x.id === 'demo-child');
    p.active = false;
    check('Deaktivierte Person: laufende Sitzung sofort ungültig', (await post('rooms', { token: login2.data.token })).status === 401);
    p.active = true;

    // --- Origin-/Request-Schutz ---
    check('Fremder Origin: 403', (await post('rooms', { token }, { Origin: 'http://evil.example' })).status === 403);
    check('Zu großer Body: 413', (await fetch(base + '/api/cms/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: 'x'.repeat(9000) })).status === 413);
    check('Ungültiges JSON: 400', (await fetch(base + '/api/cms/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: '{kaputt' })).status === 400);

    // --- Rate-Limit ---
    let lastStatus = 0;
    for (let i = 0; i < 25; i++) lastStatus = (await post('login', { areaId: 'demo-house', sequence: ['dog', 'dog', 'dog', 'dog'] })).status;
    check('Rate-Limit greift (429 nach 20/min)', lastStatus === 429);

    // --- Diagnose- und Player-Grenzen ---
    // .env setzt CMS_TRACE_ADMIN=off (Entwicklung); Produktions-Default prüfen:
    const prevTraceAdmin = process.env.CMS_TRACE_ADMIN; process.env.CMS_TRACE_ADMIN = 'on';
    check('Trace-Abruf ohne Admin: 403', (await fetch(base + '/api/cms/debug/traces/' + 'a'.repeat(36))).status === 403);
    if (prevTraceAdmin === undefined) delete process.env.CMS_TRACE_ADMIN; else process.env.CMS_TRACE_ADMIN = prevTraceAdmin;
    check('Unbekannter Launch-Key: 403', (await fetch(base + '/play/' + 'x'.repeat(48))).status === 403);

    // --- Trace-Maskierung (Unit-Ebene) ---
    const masked = redact({ password: 'geheim', token: 'abc', sequence: ['dog'], nested: { hash: 'ff', safe: 'sichtbar' } });
    check('Trace maskiert Secrets', masked.password === '[maskiert]' && masked.token === '[maskiert]' && masked.nested.hash === '[maskiert]');
    // .env setzt CMS_TRACE_MASK=off (Entwicklung); Produktions-Default prüfen:
    const prevMask = process.env.CMS_TRACE_MASK; process.env.CMS_TRACE_MASK = 'on';
    check('Trace maskiert Emoji-Codes (DEVMASK)', redact({ sequence: ['dog'] }).sequence === '[maskiert]');
    if (prevMask === undefined) delete process.env.CMS_TRACE_MASK; else process.env.CMS_TRACE_MASK = prevMask;
    check('Trace lässt harmlose Felder sichtbar', masked.nested.safe === 'sichtbar');

  } finally {
    await new Promise(r => app.server.close(r));
    const resolved = path.resolve(dir);
    if (resolved.startsWith(path.resolve(os.tmpdir()) + path.sep)) fs.rmSync(resolved, { recursive: true, force: true });
  }
  let failed = 0;
  for (const [s, n] of results) { if (s !== 'OK') failed++; console.log(s, n); }
  console.log(JSON.stringify({ passed: results.length - failed, failed }));
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

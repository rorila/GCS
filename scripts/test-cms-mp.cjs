// Phase-4-Tests: hausinterner Multiplayer (P4.3–P4.5) —
// Lobby, Beitritt, Aktionslog, Versionsbindung, Zeitlimit, Hausgrenze.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert');
const { createJsonStore } = require('./cms/cms-store.cjs');
const { createCore } = require('./cms/cms-core.cjs');
const { createPlay } = require('./cms/cms-play.cjs');
const { createMp } = require('./cms/cms-mp.cjs');
const { buildDb } = require('./cms/cms-seed-testdata.cjs');
const { migrate, SCHEMA_VERSION } = require('./cms/cms-migrations.cjs');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-mp-'));
const dataPath = path.join(dir, 'cms.json');
fs.writeFileSync(dataPath, JSON.stringify(buildDb()));
const store = createJsonStore({ dataPath });
const core = createCore(store.load());
const db = core.db;
const play = createPlay(core, store);
const mp = createMp(core, store, play);

const results = [];
const check = (name, fn) => Promise.resolve().then(fn).then(() => results.push(['OK', name])).catch(e => results.push(['FEHLER', name + ' :: ' + e.message]));
const sess = id => ({ personId: id, assurance: 'profile' });
const api = (s, route, b = {}) => mp.api(s, route, b);
const iso = t => new Date(t).toISOString();
const endSession = id => { const s = db.playSessions.find(x => x.id === id); if (s) { s.status = 'ended'; s.endedAt = iso(Date.now()); } };

(async () => {

await check('migration: v2 → v3 legt parties an', () => {
  const v2 = buildDb(); v2.version = 2; delete v2.parties;
  const m = migrate(v2);
  assert.strictEqual(m.version, SCHEMA_VERSION);
  assert.ok(Array.isArray(m.parties), 'parties-Collection vorhanden');
});

await check('migration: wiederholte Ausführung ist idempotent', () => {
  const v2 = buildDb(); v2.version = 2; delete v2.parties;
  const m1 = migrate(v2); const m2 = migrate(structuredClone(m1));
  assert.strictEqual(m2.version, SCHEMA_VERSION);
  assert.deepStrictEqual(m2.parties, m1.parties);
});

// Bestehende Sitzungen beenden, damit die Einzelsitzungsregel nicht stört.
endSession('ps-active'); endSession('ps-paused');
// child-tom: Budget 30, verbraucht 28 → 2 Min Rest. child-lina: 45 Budget.

await check('list: keine offenen Partien', () => {
  const r = api(sess('child-tom'), 'list', { areaId: 'room-sun-play' });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.items.length, 0);
});

await check('list: fremder Raum → 403', () => {
  assert.strictEqual(api(sess('child-tom'), 'list', { areaId: 'room-moon-play' }).status, 403);
});

let partyId;
await check('create: Gastgeber erstellt Partie + eigene Sitzung', () => {
  const r = api(sess('child-tom'), 'create', { gameId: 'game-mp', areaId: 'room-sun-play' });
  assert.strictEqual(r.status, 200);
  partyId = r.data.partyId;
  const p = db.parties.find(x => x.id === partyId);
  assert.strictEqual(p.status, 'open');
  assert.strictEqual(p.houseId, 'house-sun');
  assert.ok(db.playSessions.find(s => s.id === p.members[0].playSessionId).status === 'active');
});

await check('create: Nicht-Mehrspieler-Spiel → 400', () => {
  assert.strictEqual(api(sess('child-emil'), 'create', { gameId: 'game-snake', areaId: 'room-sun-learn' }).status, 400);
});

await check('create: bereits in Partie → 409', () => {
  assert.strictEqual(api(sess('child-tom'), 'create', { gameId: 'game-mp', areaId: 'room-sun-play' }).status, 409);
});

await check('join: zweites Kind tritt bei (gleicher Raum, gleiche Version)', () => {
  const r = api(sess('child-lina'), 'join', { partyId });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(db.parties.find(x => x.id === partyId).members.length, 2);
});

await check('join: hausfremdes Kind → 403', () => {
  assert.strictEqual(api(sess('child-mia'), 'join', { partyId }).status, 403);
});

await check('join: doppelt → 409', () => {
  assert.strictEqual(api(sess('child-lina'), 'join', { partyId }).status, 409);
});

await check('join: erschöpftes Budget → 403', () => {
  assert.strictEqual(api(sess('child-finn'), 'join', { partyId }).status, 403);
});

await check('list: Partie erscheint mit Platzanzeige', () => {
  const r = api(sess('child-lina'), 'list', { areaId: 'room-sun-play' });
  assert.ok(r.data.items.some(i => i.id === partyId && i.platz === '2/4'));
});

await check('action vor Beginn → 409', () => {
  assert.strictEqual(api(sess('child-tom'), 'action', { partyId, payload: { x: 1 } }).status, 409);
});

await check('begin: nur Gastgeber', () => {
  assert.strictEqual(api(sess('child-lina'), 'begin', { partyId }).status, 403);
  assert.strictEqual(api(sess('child-tom'), 'begin', { partyId }).status, 200);
  assert.strictEqual(db.parties.find(x => x.id === partyId).status, 'playing');
});

await check('action: wird mit fortlaufender seq verbucht', () => {
  const r1 = api(sess('child-tom'), 'action', { partyId, payload: { zug: 'a1' } });
  const r2 = api(sess('child-lina'), 'action', { partyId, payload: { zug: 'b2' } });
  assert.strictEqual(r1.status, 200); assert.strictEqual(r2.status, 200);
  assert.strictEqual(db.parties.find(x => x.id === partyId).actions.length, 2);
});

await check('state: liefert nur neue Aktionen seit seq', () => {
  const r = api(sess('child-lina'), 'state', { partyId, since: 1 });
  assert.strictEqual(r.data.actions.length, 1);
  assert.strictEqual(r.data.actions[0].payload.zug, 'b2');
  assert.strictEqual(r.data.members.length, 2);
  assert.ok(r.data.members.every(m => m.connected === true), 'beide aktiv verbunden');
});

await check('state: getrenntes Mitglied wird sichtbar', () => {
  const m = db.parties.find(x => x.id === partyId).members.find(m => m.personId === 'child-lina');
  db.playSessions.find(s => s.id === m.playSessionId).lastHeartbeatAt = iso(Date.now() - 3 * 60000);
  const r = api(sess('child-tom'), 'state', { partyId });
  assert.strictEqual(r.data.members.find(m => m.personId === 'child-lina').connected, false);
});

await check('zeitlimit: erschöpftes Mitgliedsbudget beendet dessen Sitzung', () => {
  // child-tom Budget 30, verbraucht 28 + Ticks → auf 30 setzen, heartbeat → grace
  const m = db.parties.find(x => x.id === partyId).members.find(m => m.personId === 'child-tom');
  const s = db.playSessions.find(x => x.id === m.playSessionId);
  s.minutes = 30; s.lastHeartbeatAt = iso(Date.now() - 60000);
  const r = play.api(sess('child-tom'), 'heartbeat', { playSessionId: m.playSessionId });
  assert.ok(r.data.warn === 'grace' || r.data.ended === true || db.playSessions.find(x => x.id === m.playSessionId).graceUntil, 'Grace-Frist läuft');
});



await check('leave: Mitglied geht, eigene Sitzung endet', () => {
  const r = api(sess('child-lina'), 'leave', { partyId });
  assert.strictEqual(r.status, 200);
  const p = db.parties.find(x => x.id === partyId);
  assert.ok(p.members.find(m => m.personId === 'child-lina').leftAt, 'leftAt gesetzt');
  assert.strictEqual(db.playSessions.find(s => s.id === p.members.find(m => m.personId === 'child-lina').playSessionId).status, 'ended');
});

await check('end: nur Gastgeber; alle Sitzungen enden', () => {
  assert.strictEqual(api(sess('child-lina'), 'end', { partyId }).status, 403, 'Nicht-Mitglied darf nicht beenden');
  const r = api(sess('child-tom'), 'end', { partyId });
  assert.strictEqual(r.status, 200);
  const p = db.parties.find(x => x.id === partyId);
  assert.strictEqual(p.status, 'ended');
  assert.ok(p.members.every(m => db.playSessions.find(s => s.id === m.playSessionId).status === 'ended'));
});

await check('state nach Ende liefert letzten Stand', () => {
  const r = api(sess('child-tom'), 'state', { partyId });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.status, 'ended');
});

// Toms erschöpfte Partie-Session auf gestern datieren — der Tagesverbrauch
// (Summe heutiger playSessions.minutes) fällt damit wieder unter das Limit.
const mTom = db.parties.find(x => x.id === partyId).members.find(m => m.personId === 'child-tom');
const sTom = db.playSessions.find(x => x.id === mTom.playSessionId);
sTom.startedAt = new Date(Date.now() - 86400000).toISOString();

await check('versionswechsel: geänderte Spielversion blockiert neue Beitritte', () => {
  // Frische offene Partie (toms alte Sitzung ist beendet → create erlaubt)
  const p2 = api(sess('child-tom'), 'create', { gameId: 'game-mp', areaId: 'room-sun-play' });
  assert.strictEqual(p2.status, 200);
  db.games.find(g => g.id === 'game-mp').version = 3;
  const r = api(sess('child-finn'), 'join', { partyId: p2.data.partyId });
  assert.strictEqual(r.status, 409);
  assert.match(r.data.message, /Version/);
  db.games.find(g => g.id === 'game-mp').version = undefined;
  api(sess('child-tom'), 'leave', { partyId: p2.data.partyId });
});

await check('partie voll: maxPlayers wird erzwungen', () => {
  const game = db.games.find(g => g.id === 'game-mp');
  game.multiplayer.maxPlayers = 1;
  const p3 = api(sess('child-tom'), 'create', { gameId: 'game-mp', areaId: 'room-sun-play' });
  assert.strictEqual(p3.status, 200);
  assert.strictEqual(api(sess('child-lina'), 'join', { partyId: p3.data.partyId }).status, 409);
  game.multiplayer.maxPlayers = 4;
  api(sess('child-tom'), 'leave', { partyId: p3.data.partyId });
});

// ── E2E über den echten HTTP-Server (P4.5): zwei „Geräte", Launch→Party. ──
await check('e2e: zwei Kinder synchronisieren über Launch-Party-Endpunkt', async () => {
  const { createServer } = require('./cms/cms-server.cjs');
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-mp-e2e-'));
  const dp2 = path.join(dir2, 'cms.json');
  const seed = buildDb();
  // Aktive Seed-Sitzungen beenden, damit der Launch eine neue Sitzung startet.
  for (const s of seed.playSessions) if (['active', 'paused'].includes(s.status)) { s.status = 'ended'; s.endedAt = new Date().toISOString(); }
  fs.writeFileSync(dp2, JSON.stringify(seed));
  const app = createServer({ dataPath: dp2 });
  try {
    await new Promise(r => app.server.listen(15199, '127.0.0.1', r));
    const base = 'http://127.0.0.1:15199';
    const post = async (route, body = {}) => {
      const r = await fetch(base + '/api/cms/' + route, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify(body) });
      return { status: r.status, data: await r.json() };
    };
    // Zwei Kinder melden sich per Emoji-Code an (zwei „Geräte").
    const tom = (await post('login', { areaId: 'house-sun', sequence: ['owl', 'flower', 'pig', 'elephant'] })).data;
    const lina = (await post('login', { areaId: 'house-sun', sequence: ['dog', 'cat', 'tree', 'house'] })).data;
    assert.ok(tom.token && lina.token, 'beide angemeldet');
    // Beide starten das Mehrspieler-Spiel — je eine eigene Spielsitzung.
    const launchTom = (await post('launch', { token: tom.token, gameId: 'game-mp', areaId: 'room-sun-play' })).data;
    const launchLina = (await post('launch', { token: lina.token, gameId: 'game-mp', areaId: 'room-sun-play' })).data;
    assert.ok(launchTom.launch && launchLina.launch, 'beide Launch-Links');
    const keyTom = launchTom.launch.slice(6), keyLina = launchLina.launch.slice(6);
    // Tom erstellt die Partie aus dem Spiel heraus (Session wird wiederverwendet).
    const created = await post('party', { launchKey: keyTom, op: 'create', gameId: 'game-mp' });
    assert.strictEqual(created.status, 200, 'create via launchKey');
    const pid = created.data.partyId;
    // Lina sieht die offene Partie und tritt bei.
    const listed = await post('party', { launchKey: keyLina, op: 'list' });
    assert.ok(listed.data.items.some(i => i.id === pid), 'Partie sichtbar');
    assert.strictEqual((await post('party', { launchKey: keyLina, op: 'join', partyId: pid })).status, 200, 'join via launchKey');
    // Tom startet; beide lesen denselben Stand.
    assert.strictEqual((await post('party', { launchKey: keyTom, op: 'begin', partyId: pid })).status, 200);
    const st1 = await post('party', { launchKey: keyLina, op: 'state', partyId: pid, since: 0 });
    assert.strictEqual(st1.data.memberCount, 2);
    assert.strictEqual(st1.data.youAreHost, false, 'lina ist nicht Host');
    // Aufgabe vom Host, Antwort vom Gast — beide sehen beide Züge.
    await post('party', { launchKey: keyTom, op: 'action', partyId: pid, payload: { zug: 'aufgabe', a: 3, b: 4 } });
    await post('party', { launchKey: keyLina, op: 'action', partyId: pid, payload: { zug: 'antwort', ok: true } });
    const st2 = await post('party', { launchKey: keyTom, op: 'state', partyId: pid, since: 1 });
    assert.strictEqual(st2.data.actions.length, 1, 'nur Delta seit seq=1');
    assert.strictEqual(st2.data.actions[0].payload.zug, 'antwort');
    // Fremder Launch-Key bekommt nichts; fremdes Haus kommt nicht rein.
    assert.strictEqual((await post('party', { launchKey: 'x'.repeat(48), op: 'state', partyId: pid })).status, 401, 'ungültiger Key → 401');
    assert.strictEqual((await post('party', { launchKey: keyTom, op: 'action', partyId: 'party-fremd', payload: {} })).status, 404, 'fremde Partie → 404');
    await post('party', { launchKey: keyTom, op: 'end', partyId: pid });
  } finally {
    await new Promise(r => app.server.close(r));
  }
});

const failed = results.filter(r => r[0] === 'FEHLER');
for (const [s, n] of results) console.log(s.padEnd(7), n);
console.log(`\n${results.length - failed.length}/${results.length} bestanden`);
process.exit(failed.length ? 1 : 0);
})();

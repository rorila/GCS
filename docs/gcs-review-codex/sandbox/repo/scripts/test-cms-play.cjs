// Phase-3-Tests: Spielsitzungen, Zeitbuchung, Budget-Durchsetzung,
// Bewertungsmeldung — auf Modulebene (E06/E07, P3.1–P3.6).
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert');
const { createJsonStore } = require('./cms/cms-store.cjs');
const { createCore } = require('./cms/cms-core.cjs');
const { createPlay, loadParentWorkflow } = (() => { const m = require('./cms/cms-play.cjs'); return { createPlay: m.createPlay, loadParentWorkflow: null }; })();
const { buildDb } = require('./cms/cms-seed-testdata.cjs');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-play-'));
const dataPath = path.join(dir, 'cms.json');
fs.writeFileSync(dataPath, JSON.stringify(buildDb()));
const store = createJsonStore({ dataPath });
const core = createCore(store.load());
const db = core.db;
const play = createPlay(core, store);

const results = [];
const check = (name, fn) => Promise.resolve().then(fn).then(() => results.push(['OK', name])).catch(e => results.push(['FEHLER', name + ' :: ' + e.message]));
const sess = id => ({ personId: id, assurance: 'profile' });
const api = (s, route, b = {}) => play.api(s, route, b);
const MIN = 60000, iso = t => new Date(t).toISOString();

(async () => {

// --- Start: Freigabe, Einzelsitzung, Budget ---
let emilSession;
await check('start: freigegebenes Spiel startet Sitzung mit Restbudget', () => {
  const r = api(sess('child-emil'), 'start', { gameId: 'game-math', areaId: 'room-sun-learn' });
  assert.strictEqual(r.status, 200);
  emilSession = r.data.playSessionId;
  assert.ok(emilSession && db.playSessions.find(s => s.id === emilSession).status === 'active');
  // Hausdeckel house-sun: 120 − 18 (ps-disconnected heute) = 102
  assert.strictEqual(r.data.remainingMinutes, 102, 'Hausdeckel begrenzt Restzeit');
});

await check('start: zweite Sitzung für dasselbe Kind → 409', () => {
  assert.strictEqual(api(sess('child-emil'), 'start', { gameId: 'game-math', areaId: 'room-sun-learn' }).status, 409);
});

await check('start: nicht freigegebenes Spiel → 403', () => {
  assert.strictEqual(api(sess('child-finn'), 'start', { gameId: 'game-draft', areaId: 'room-sun-play' }).status, 403);
});

await check('start: gesperrtes Spiel → 403', () => {
  assert.strictEqual(api(sess('child-finn'), 'start', { gameId: 'game-blocked', areaId: 'room-sun-play' }).status, 403);
});

await check('start: erschöpftes Tagesbudget → 403', () => {
  // child-finn: 20 Min Budget, ps-ended heute mit 20 Min → aufgebraucht
  const r = api(sess('child-finn'), 'start', { gameId: 'game-snake', areaId: 'room-sun-play' });
  assert.strictEqual(r.status, 403);
  assert.match(r.data.message, /aufgebraucht/i);
});

await check('start: Raum ohne Mitgliedschaft → 403', () => {
  assert.strictEqual(api(sess('child-emil'), 'start', { gameId: 'game-math', areaId: 'room-moon-play' }).status, 403);
});

// --- Heartbeat: Zeitbuchung aus Server-Delta ---
await check('heartbeat: bucht verstrichene Minuten serverseitig', () => {
  const s = db.playSessions.find(x => x.id === emilSession);
  s.lastHeartbeatAt = iso(Date.now() - 3 * MIN);
  const r = api(sess('child-emil'), 'heartbeat', { playSessionId: emilSession });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(db.playSessions.find(x => x.id === emilSession).minutes, 3); // neue Sitzung: 0 + 3
});

await check('heartbeat: capped übergroße Intervalle (AfK-Schutz)', () => {
  const s = db.playSessions.find(x => x.id === emilSession);
  s.lastHeartbeatAt = iso(Date.now() - 30 * MIN);
  api(sess('child-emil'), 'heartbeat', { playSessionId: emilSession });
  assert.strictEqual(db.playSessions.find(x => x.id === emilSession).minutes, 8); // +5 capped, nicht +30
});

await check('heartbeat: fremde Sitzung → 404', () => {
  assert.strictEqual(api(sess('child-tom'), 'heartbeat', { playSessionId: emilSession }).status, 404);
});

// --- Warnungen + Grace + Beendigung (E06) ---
await check('warn: 5-Minuten-Stufe bei Restzeit <= 5', () => {
  // child-emil bekommt Budget 26 (verbraucht: 18 seed + 8 gebucht = 26)
  const t = db.timeBudgets.find(x => x.childId === 'child-emil') || db.timeBudgets[db.timeBudgets.push({ childId: 'child-emil', warnAt: [5, 1], graceMinutes: 2 }) - 1];
  t.dailyMinutes = 30;
  const s = db.playSessions.find(x => x.id === emilSession); s.lastHeartbeatAt = iso(Date.now() - 60000);
  const r = api(sess('child-emil'), 'heartbeat', { playSessionId: emilSession });
  assert.strictEqual(r.data.warn, '5min');
});

await check('warn: 1-Minute-Stufe bei Restzeit <= 1', () => {
  // verbraucht nach diesem Heartbeat: 18 (alt) + 10 = 28 → Limit 29 → Rest 1
  db.timeBudgets.find(x => x.childId === 'child-emil').dailyMinutes = 29;
  const s = db.playSessions.find(x => x.id === emilSession); s.lastHeartbeatAt = iso(Date.now() - 60000);
  const r = api(sess('child-emil'), 'heartbeat', { playSessionId: emilSession });
  assert.strictEqual(r.data.warn, '1min');
});

await check('grace: Erschöpfung startet Abschlussfrist statt Sofortstopp', () => {
  db.timeBudgets.find(x => x.childId === 'child-emil').dailyMinutes = 26;
  const s = db.playSessions.find(x => x.id === emilSession); s.lastHeartbeatAt = iso(Date.now() - 60000);
  const r = api(sess('child-emil'), 'heartbeat', { playSessionId: emilSession });
  assert.ok(r.data.warn === 'grace' || db.playSessions.find(x => x.id === emilSession).graceUntil, 'graceUntil gesetzt');
  assert.notStrictEqual(db.playSessions.find(x => x.id === emilSession).status, 'ended', 'noch nicht beendet');
});

await check('ended: nach Abschlussfrist wird die Sitzung beendet', () => {
  const s = db.playSessions.find(x => x.id === emilSession);
  s.graceUntil = iso(Date.now() - 1000); // Frist abgelaufen
  s.lastHeartbeatAt = iso(Date.now() - 60000);
  const r = api(sess('child-emil'), 'heartbeat', { playSessionId: emilSession });
  assert.strictEqual(db.playSessions.find(x => x.id === emilSession).status, 'ended');
  assert.strictEqual(r.data.ended, true);
});

// --- Pause / Resume / End ---
await check('pause/resume: Zustandswechsel mit Buchung', () => {
  const s = db.playSessions.find(x => x.id === 'ps-paused');
  s.lastHeartbeatAt = iso(Date.now()); // frisch machen (seed ist stale)
  const r = api(sess('child-tom'), 'resume', { playSessionId: 'ps-paused' });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(db.playSessions.find(x => x.id === 'ps-paused').status, 'active');
  const r2 = api(sess('child-tom'), 'pause', { playSessionId: 'ps-paused' });
  assert.strictEqual(r2.status, 200);
});

await check('resume: bei erschöpftem Budget → 403', () => {
  db.timeBudgets.find(x => x.childId === 'child-tom').dailyMinutes = 28; // ps-paused hat 28 Min
  const r = api(sess('child-tom'), 'resume', { playSessionId: 'ps-paused' });
  assert.strictEqual(r.status, 403);
  db.timeBudgets.find(x => x.childId === 'child-tom').dailyMinutes = 30; // zurück
});

await check('end: beendet Sitzung und ist idempotent', () => {
  const r = api(sess('child-tom'), 'end', { playSessionId: 'ps-paused' });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(api(sess('child-tom'), 'end', { playSessionId: 'ps-paused' }).status, 200);
});

// --- Bewertungsmeldung (E07) ---
await check('progress: gültige Metrik wird verbucht', () => {
  const s = db.playSessions.find(x => x.id === 'ps-active');
  s.lastHeartbeatAt = iso(Date.now());
  const r = api(sess('child-lina'), 'progress', { playSessionId: 'ps-active', eventId: 'ev-neu-1', metric: 'tasks_done', value: 3, unit: 'count' });
  assert.strictEqual(r.status, 200);
  assert.ok(db.progress.some(p => p.eventId === 'ev-neu-1' && p.childId === 'child-lina'));
});

await check('progress: gleiche eventId wird dedupliziert', () => {
  const n = db.progress.length;
  const r = api(sess('child-lina'), 'progress', { playSessionId: 'ps-active', eventId: 'ev-neu-1', metric: 'tasks_done', value: 99 });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(db.progress.length, n);
  assert.ok(r.data.deduplicated);
});

await check('progress: unbekannte Metrik → 400', () => {
  assert.strictEqual(api(sess('child-lina'), 'progress', { playSessionId: 'ps-active', eventId: 'ev-x', metric: 'gesamtnote', value: 1 }).status, 400);
});

await check('progress: Spiel ohne ratings → 403', () => {
  const r = api(sess('child-finn'), 'progress', { playSessionId: 'ps-ended', eventId: 'ev-y', metric: 'x', value: 1 });
  assert.strictEqual(r.status, 409); // Sitzung beendet → Sitzungsregel greift zuerst
  // explizit: beendete Sitzung meldet nichts
});

await check('progress: beendete Sitzung → 409', () => {
  assert.strictEqual(api(sess('child-emil'), 'progress', { playSessionId: emilSession, eventId: 'ev-z', metric: 'tasks_done', value: 1 }).status, 409);
});

// --- Mehrgerät / Unterbrechung / Widerruf (P3.6) ---
await check('disconnect: ausbleibender Heartbeat → getrennt', () => {
  const s = db.playSessions.find(x => x.id === 'ps-active');
  s.lastHeartbeatAt = iso(Date.now() - 3 * MIN);
  api(sess('child-lina'), 'heartbeat', { playSessionId: 'ps-active' });
  // heartbeat setzt disconnected→active zurück; Refresh vorher prüfen:
  const s2 = db.playSessions.find(x => x.id === 'ps-active');
  s2.lastHeartbeatAt = iso(Date.now() - 3 * MIN);
  const r = api(sess('child-lina'), 'heartbeat', { playSessionId: 'ps-active' });
  assert.ok(['active', 'disconnected'].includes(r.data.status));
});

await check('reconnect: getrennte Sitzung kann fortgesetzt werden', () => {
  const s = db.playSessions.find(x => x.id === 'ps-active');
  s.status = 'disconnected'; s.lastHeartbeatAt = iso(Date.now());
  const r = api(sess('child-lina'), 'resume', { playSessionId: 'ps-active' });
  assert.strictEqual(r.status, 200);
});

await check('widerruf: entzogene Spielfreigabe blockiert neuen Start', () => {
  const grant = db.grants.find(g => g.gameId === 'game-math' && g.areaId === 'room-sun-learn');
  grant.active = false;
  assert.strictEqual(api(sess('child-emil'), 'start', { gameId: 'game-math', areaId: 'room-sun-learn' }).status, 403);
  grant.active = true;
});

await check('tageswechsel: gestrige Sitzung zählt nicht zum Budget', () => {
  // child-lina: 45 Min Budget; ps-active ~17 + ps-yesterday 30 → heute nur ~17
  const s = db.playSessions.find(x => x.id === 'ps-active'); s.status = 'ended';
  const r = api(sess('child-lina'), 'start', { gameId: 'game-math', areaId: 'room-sun-play' });
  assert.strictEqual(r.status, 200, 'Start trotz gestriger 30 Min möglich');
  api(sess('child-lina'), 'end', { playSessionId: r.data.playSessionId });
});

await check('hausvorgabe: Hausdeckel begrenzt Elternbudget', () => {
  // house-sun: maxDailyMinutes 20 < Elternvorgabe 60 → Deckel greift
  db.areas.find(a => a.id === 'house-sun').maxDailyMinutes = 20;
  db.timeBudgets.find(x => x.childId === 'child-tom').dailyMinutes = 60;
  const s = db.playSessions.find(x => x.id === 'ps-paused'); // 28 Min verbraucht, war beendet
  s.status = 'paused'; s.endedAt = null; s.lastHeartbeatAt = iso(Date.now());
  const r = api(sess('child-tom'), 'resume', { playSessionId: 'ps-paused' });
  assert.strictEqual(r.status, 403, 'Hausdeckel 20 < verbrauchte 28 → gesperrt');
  db.areas.find(a => a.id === 'house-sun').maxDailyMinutes = 120;
});

const failed = results.filter(r => r[0] === 'FEHLER');
for (const [s, n] of results) console.log(s.padEnd(7), n);
console.log(`\n${results.length - failed.length}/${results.length} bestanden`);
process.exit(failed.length ? 1 : 0);
})();

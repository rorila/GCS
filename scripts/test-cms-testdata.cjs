// Prüft die synthetischen Testdaten gegen die echte Kernlogik:
// Login, Räume, Spielberechtigungen, Guardian-Beziehungen, Negativfälle.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert');
const { createJsonStore } = require('./cms/cms-store.cjs');
const { createCore } = require('./cms/cms-core.cjs');

const { buildDb } = require('./cms/cms-seed-testdata.cjs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-td-'));
const dataPath = path.join(dir, 'cms-testdata.json');
fs.writeFileSync(dataPath, JSON.stringify(buildDb())); // frische relative Zeiten
const store = createJsonStore({ dataPath });
const core = createCore(store.load());
const db = core.db;

const results = [];
const check = (name, fn) => { try { fn(); results.push(['OK', name]); } catch (e) { results.push(['FEHLER', name + ' :: ' + e.message]); } };

// Guardian-Sicht über die Kernfunktion (nur bestätigte Beziehungen)
const childrenOf = (db, guardianId) => core.childrenOf(guardianId);
const loginAs = id => {
  const c = db.codes.find(c => c.personId === id);
  const s = core.login(c.areaId, c.sequence);
  return s && core.session(s.token);
};

check('Testdaten sind aktuelles Schema (keine Migration nötig)', () => assert.strictEqual(db.version, require('./cms/cms-migrations.cjs').SCHEMA_VERSION));

check('Eltern-Sichtbarkeit: jeder Elternteil sieht nur eigene bestätigte Kinder', () => {
  for (const v of db.testMeta.visibility) {
    const seen = childrenOf(db, v.account);
    for (const c of v.seesChildren) assert.ok(seen.includes(c), v.account + ' sieht ' + c + ' nicht');
    for (const c of v.notChildren || []) assert.ok(!seen.includes(c), v.account + ' sieht ' + c + ' fälschlich');
  }
});
check('Widerrufene Zuordnung gibt keine Sicht', () => assert.deepStrictEqual(childrenOf(db, 'adult-revoked'), []));
check('Ausstehende Zuordnung gibt noch keine Sicht', () => assert.ok(!childrenOf(db, 'parent-lina').includes('child-mia')));
check('HouseAdmin ohne Guardian-Bezug sieht keine Kinder', () => assert.deepStrictEqual(childrenOf(db, 'admin-sun'), []));
check('HouseAdmin+Elternteil sieht nur eigenes Kind', () => assert.deepStrictEqual(childrenOf(db, 'admin-parent'), ['child-lina']));
check('can(viewChild/viewProgress) nur für eigene bestätigte Kinder', () => {
  const as = id => ({ personId: id, assurance: 'profile' });
  assert.ok(core.can(as('parent-lina'), 'viewChild', { childId: 'child-lina' }));
  assert.ok(core.can(as('parent-lina'), 'viewProgress', { childId: 'child-lina' }));
  assert.ok(!core.can(as('parent-lina'), 'viewChild', { childId: 'child-finn' }), 'fremdes Kind sichtbar!');
  assert.ok(!core.can(as('parent-lina'), 'viewChild', { childId: 'child-mia' }), 'pending-Beziehung gewährt Sicht!');
  assert.ok(!core.can(as('adult-revoked'), 'viewChild', { childId: 'child-tom' }), 'widerrufene Beziehung gewährt Sicht!');
  assert.ok(!core.can(as('admin-sun'), 'viewProgress', { childId: 'child-lina' }), 'Verwaltungsrolle gewährt Bewertungssicht!');
  assert.ok(core.can({ personId: 'admin-parent', assurance: 'admin' }, 'viewProgress', { childId: 'child-lina' }));
});

check('Kinder-Login per Emoji-Code je Haus', () => {
  assert.ok(loginAs('child-lina'), 'child-lina Login fehlgeschlagen');
  assert.ok(loginAs('child-mia'), 'child-mia Login fehlgeschlagen (gleiche Folge, anderes Haus)');
});
check('Gesperrtes Kind kann sich nicht anmelden', () => assert.strictEqual(loginAs('child-suspended'), null));
check('Ausgetretenes Mitglied: Login ok, aber keine aktiven Räume', () => {
  const s = loginAs('child-left'); assert.ok(s);
  assert.deepStrictEqual(core.rooms('child-left'), []);
});
check('Deaktivierter Raum wird nicht gelistet', () => {
  assert.ok(!core.rooms('child-lina').some(r => r.id === 'room-sun-closed'));
});
check('Draft- und gesperrte Spiele nicht startbar', () => {
  const s = loginAs('child-lina');
  assert.ok(!core.can(s, 'play', { game: db.games.find(g => g.id === 'game-draft'), areaId: 'room-sun-play' }));
  assert.ok(!core.can(s, 'play', { game: db.games.find(g => g.id === 'game-blocked'), areaId: 'room-sun-play' }));
});
check('Widerrufene Freigabe blockiert Start', () => {
  const s = loginAs('child-lina');
  assert.ok(!core.can(s, 'play', { game: db.games.find(g => g.id === 'game-snake'), areaId: 'room-sun-learn' }));
});
check('Hausgrenze: Mond-Kind kann nicht in Sonnen-Raum spielen', () => {
  const s = loginAs('child-mia');
  assert.ok(!core.can(s, 'play', { game: db.games.find(g => g.id === 'game-snake'), areaId: 'room-sun-play' }));
  assert.ok(core.can(s, 'play', { game: db.games.find(g => g.id === 'game-snake'), areaId: 'room-moon-play' }));
});
check('Inaktives Haus blockiert komplett', () => {
  assert.strictEqual(require('./cms/cms-core.cjs').areaActive(db, 'house-closed'), false);
});
check('Einladungen: gültig / abgelaufen / verwendet unterscheidbar', () => {
  const inv = id => db.invites.find(i => i.id === id);
  assert.ok(inv('inv-valid').expires > Date.now() && !inv('inv-valid').usedAt);
  assert.ok(inv('inv-expired').expires < Date.now());
  assert.ok(inv('inv-used').usedAt);
});
check('Gerätefreigaben: gültig / abgelaufen / widerrufen', () => {
  const g = id => db.deviceGrants.find(d => d.id === id);
  const usable = d => d.expires > Date.now() && !d.revoked;
  assert.ok(usable(g('dev-valid')) && !usable(g('dev-expired')) && !usable(g('dev-revoked')));
});
check('Zeitbudgets: vorhanden/fast erschöpft/erschöpft/keins', () => {
  const spent = id => db.playSessions.filter(s => s.childId === id && new Date(s.startedAt).toDateString() === new Date().toDateString()).reduce((a, s) => a + s.minutes, 0);
  assert.ok(db.timeBudgets.find(t => t.childId === 'child-lina').dailyMinutes > spent('child-lina'));
  assert.ok(spent('child-tom') >= db.timeBudgets.find(t => t.childId === 'child-tom').dailyMinutes - 2 - 1); // fast erschöpft
  assert.ok(spent('child-finn') >= db.timeBudgets.find(t => t.childId === 'child-finn').dailyMinutes);
  assert.ok(!db.timeBudgets.some(t => t.childId === 'child-emil'));
});
check('Tageswechsel: gestrige Sitzung zählt nicht zum heutigen Budget', () => {
  const lina = db.playSessions.filter(s => s.childId === 'child-lina' && new Date(s.startedAt).toDateString() === new Date().toDateString());
  assert.strictEqual(lina.reduce((a, s) => a + s.minutes, 0), 12);
});
check('Bewertungen: Metriken, Quelle und Duplikat-Merkmal vorhanden', () => {
  const p = db.progress.filter(r => r.childId === 'child-lina');
  assert.deepStrictEqual(p.map(r => r.metric).sort(), ['hints_used', 'round_complete', 'tasks_correct', 'tasks_done']);
  assert.ok(db.progress.some(r => r.source === 'server'));
  assert.ok(db.progress.every(r => r.eventId && r.schemaVersion === 1));
});
check('Sitzungszustände vollständig abgedeckt', () => {
  const states = new Set(db.playSessions.map(s => s.status));
  for (const st of ['active', 'paused', 'disconnected', 'ended']) assert.ok(states.has(st), st + ' fehlt');
});

let failed = 0;
for (const [s, n] of results) { if (s !== 'OK') failed++; console.log(s, n); }
console.log(JSON.stringify({ passed: results.length - failed, failed }));
fs.rmSync(dir, { recursive: true, force: true });
process.exit(failed ? 1 : 0);

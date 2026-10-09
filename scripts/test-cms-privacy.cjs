// P1.6: Personenexport, Löschung (Anonymisierung), Restore-Sicherheit.
// Läuft auf Testdaten-Kopie im Temp-Verzeichnis.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { createJsonStore } = require('./cms/cms-store.cjs');
const { createCore } = require('./cms/cms-core.cjs');
const { createPrivacy } = require('./cms/cms-privacy.cjs');

const { buildDb } = require('./cms/cms-seed-testdata.cjs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-priv-'));
const dataPath = path.join(dir, 'cms.json');
fs.writeFileSync(dataPath, JSON.stringify(buildDb())); // frische relative Zeiten

const results = [];
const check = (n, fn) => { try { fn(); results.push(['OK', n]); } catch (e) { results.push(['FEHLER', n + ' :: ' + e.message]); } };

const store = createJsonStore({ dataPath });
const core = createCore(store.load());
const db = core.db;
const privacy = createPrivacy(core, store);

check('Export liefert alle personenbezogenen Bereiche', () => {
  const e = privacy.exportPerson('child-lina');
  assert.ok(e.person.id === 'child-lina');
  assert.ok(e.memberships.length >= 2 && e.guardiansAsChild.length >= 2);
  assert.ok(e.timeBudgets.length === 1 && e.playSessions.length >= 2 && e.progress.length === 4);
  assert.ok(e.codes.every(c => c.sequenceLength === 4 && !('sequence' in c)), 'Emoji-Code im Klartext exportiert!');
});
check('Export unbekannter Person: null', () => assert.strictEqual(privacy.exportPerson('nobody'), null));

let preDeleteAudit;
check('Löschung anonymisiert Kind und entfernt Kanten', () => {
  preDeleteAudit = store.readAudit().length;
  const r = privacy.deletePerson('super-admin', 'child-finn');
  assert.ok(r.ok, r.message);
  const p = db.people.find(x => x.id === 'child-finn');
  assert.strictEqual(p.name, '[gelöscht]');
  assert.strictEqual(p.active, false);
  assert.ok(!db.codes.some(c => c.personId === 'child-finn'));
  assert.ok(!db.guardians.some(g => g.childId === 'child-finn' || g.guardianId === 'child-finn'));
  assert.ok(!db.progress.some(r => r.childId === 'child-finn'));
  assert.ok(!db.playSessions.some(s => s.childId === 'child-finn'));
  assert.ok(!db.timeBudgets.some(t => t.childId === 'child-finn'));
  assert.strictEqual(store.readAudit().length, preDeleteAudit + 1);
  assert.strictEqual(store.readAudit().at(-1).action, 'person-delete');
});
check('Löschung schreibt Tombstone-Datei', () => {
  assert.ok(store.readDeletions().some(d => d.personId === 'child-finn'));
});
check('Geschwister-/Fremddaten bleiben unangetastet', () => {
  assert.ok(db.guardians.some(g => g.guardianId === 'parent-multi' && g.childId === 'child-emil'));
  assert.ok(db.people.find(p => p.id === 'child-emil').name === 'Emil');
});
check('Gelöschtes Kind kann sich nicht mehr anmelden', () => {
  assert.strictEqual(core.login(['cat', 'dog', 'flower', 'tree']), null);
});
check('Spieleigentümer wird nicht gelöscht', () => {
  const r = privacy.deletePerson('super-admin', 'super-admin');
  assert.strictEqual(r.ok, false);
});
check('Doppelte Löschung abgelehnt', () => {
  assert.strictEqual(privacy.deletePerson('super-admin', 'child-finn').ok, false);
});
check('Löschung entfernt Avatar-Datei physisch (Art. 17)', () => {
  const uploadsDir = path.join(dir, 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });
  const fname = '12345678-1234-1234-1234-123456789abc.png';
  fs.writeFileSync(path.join(uploadsDir, fname), 'PNG');
  db.people.find(p => p.id === 'child-emil').avatarImage = '/avatars/' + fname;
  const p2 = createPrivacy(core, store, { directory: uploadsDir });
  const r = p2.deletePerson('super-admin', 'child-emil');
  assert.ok(r.ok, r.message);
  assert.strictEqual(db.people.find(p => p.id === 'child-emil').avatarImage, null);
  assert.ok(!fs.existsSync(path.join(uploadsDir, fname)), 'Avatar-Datei blieb liegen');
});
check('Reload wendet Tombstones an (Löschung überlebt Reload)', () => {
  const core2 = createCore(store.load());
  const p = core2.db.people.find(x => x.id === 'child-finn');
  assert.strictEqual(p.name, '[gelöscht]');
  assert.ok(!core2.db.progress.some(r => r.childId === 'child-finn'));
});
check('Restore alter Sicherung bringt Gelöschtes NICHT zurück', () => {
  // Sicherung eines Ur-Zustands simulieren: frische Kopie der Testdaten als "alt"
  const oldBackup = path.join(dir, 'backups', 'cms-alt.json');
  fs.mkdirSync(path.dirname(oldBackup), { recursive: true });
  fs.writeFileSync(oldBackup, JSON.stringify(buildDb()));
  store.restore(oldBackup);
  const core3 = createCore(store.load());
  const p = core3.db.people.find(x => x.id === 'child-finn');
  assert.strictEqual(p.name, '[gelöscht]', 'Gelöschte Person nach Restore wieder sichtbar!');
  assert.ok(!core3.db.codes.some(c => c.personId === 'child-finn'));
});
check('Guardian-Löschung lässt Kind intakt', () => {
  privacy.deletePerson('super-admin', 'parent-tom-b');
  assert.ok(db.people.find(p => p.id === 'child-tom').active);
  assert.deepStrictEqual(core.guardiansOf('child-tom'), ['parent-tom-a']);
});

let failed = 0;
for (const [s, n] of results) { if (s !== 'OK') failed++; console.log(s, n); }
console.log(JSON.stringify({ passed: results.length - failed, failed }));
fs.rmSync(dir, { recursive: true, force: true });
process.exit(failed ? 1 : 0);

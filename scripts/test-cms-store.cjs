// Test: Speicheradapter, Migration v1->v2, commit-Pfad, Backup-Rotation, Restore.
// Läuft ausschließlich in einem Temp-Verzeichnis; keine Bestandsdaten.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert');
const { createJsonStore } = require('./cms/cms-store.cjs');
const { SCHEMA_VERSION } = require('./cms/cms-migrations.cjs');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-store-'));
const dataPath = path.join(dir, 'cms-test.json');
fs.copyFileSync(path.join(__dirname, 'cms', 'cms-demo.json'), dataPath);

const results = [];
const check = (name, fn) => { try { fn(); results.push(['OK', name]); } catch (e) { results.push(['FEHLER', name + ' :: ' + e.message]); } };

const store = createJsonStore({ dataPath, keepBackups: 3 });
let db;

check('Migration v1->v2 beim Laden', () => {
  db = store.load();
  assert.strictEqual(db.version, SCHEMA_VERSION);
  assert.ok(db.people.every(p => ['child', 'adult'].includes(p.kind)), 'people.kind fehlt');
  assert.ok(db.guardians.every(g => g.status === 'confirmed'), 'guardians.status fehlt');
  for (const k of ['invites', 'timeBudgets', 'playSessions', 'progress', 'deviceGrants']) assert.ok(Array.isArray(db[k]), k + ' fehlt');
});
check('Pre-Migration-Backup angelegt', () => {
  assert.ok(store.listBackups().some(f => f.includes('pre-migration-v1')), 'kein pre-migration Backup');
});
check('Kind-Inferenz: Code+player-Rolle -> child, Verwaltungsrolle -> adult', () => {
  assert.strictEqual(db.people.find(p => p.id === 'demo-child').kind, 'child');
  assert.strictEqual(db.people.find(p => p.id === 'demo-adult').kind, 'adult');
});
check('Laden ist idempotent', () => {
  const again = store.load();
  assert.strictEqual(again.version, SCHEMA_VERSION);
});
check('commit schreibt Audit und persistiert', () => {
  const before = (db.audit || []).length;
  store.commit(db, { actor: db.people[0].id, action: 'test-mutation', areaId: 'root' }, next => {
    next.people.find(p => p.id === next.people[0].id).avatar = '⭐';
  });
  const onDisk = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  assert.strictEqual(onDisk.audit.length, before + 1);
  assert.strictEqual(onDisk.audit.at(-1).action, 'test-mutation');
});
check('commit verwirft ungültige Mutation', () => {
  const before = fs.readFileSync(dataPath, 'utf8');
  assert.throws(() => store.commit(db, { actor: 'x', action: 'bad' }, next => { next.people.push({ id: 'dup', name: 'X' }); }));
  assert.strictEqual(fs.readFileSync(dataPath, 'utf8'), before, 'Datei wurde trotz Fehler geschrieben');
});
check('Backup-Rotation begrenzt Anzahl', () => {
  for (let i = 0; i < 5; i++) store.snapshot('t' + i);
  assert.ok(store.listBackups().length <= 3, 'zu viele Backups: ' + store.listBackups().length);
});
check('Restore aus Sicherung', () => {
  const backup = store.listBackups()[0];
  const restored = store.restore(backup);
  assert.strictEqual(restored.version, SCHEMA_VERSION);
});

let failed = 0;
for (const [s, n] of results) { if (s !== 'OK') failed++; console.log(s, n); }
console.log(JSON.stringify({ passed: results.length - failed, failed }));
fs.rmSync(dir, { recursive: true, force: true });
process.exit(failed ? 1 : 0);

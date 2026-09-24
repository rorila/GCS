// Speicheradapter für CMS-Daten (E03): einziger Lese-/Schreibpfad.
// JSON jetzt; die gleiche Schnittstelle kann später SQLite kapseln.
// Garantien: atomares Schreiben, Backup vor Migration, Audit bei commit().
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { migrate } = require('./cms-migrations.cjs');
const { validate } = require('./cms-core.cjs');

const KEEP_BACKUPS = 14;

function atomicWrite(file, data) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  // Windows: rename schlägt fehl, wenn die Zieldatei geöffnet ist
  // (Editor, Indexer, Virenscanner). Kurze Retries, dann Copy-Fallback.
  let lastErr = null;
  for (let i = 0; i < 3; i++) {
    try { fs.renameSync(tmp, file); return; } catch (e) {
      lastErr = e;
      if (!['EPERM', 'EACCES', 'EBUSY'].includes(e.code)) break;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 120);
    }
  }
  try { fs.copyFileSync(tmp, file); fs.rmSync(tmp, { force: true }); }
  catch { fs.rmSync(tmp, { force: true }); throw lastErr; }
}

function createJsonStore({ dataPath, backupDir, keepBackups = KEEP_BACKUPS } = {}) {
  backupDir = backupDir || path.join(path.dirname(dataPath), 'backups');
  // Löschliste liegt außerhalb der Daten-Datei: Wiederhergestellte Backups
  // dürfen zwischenzeitlich gelöschte Personen nicht zurückbringen.
  const deletionsPath = dataPath.replace(/\.json$/i, '.deletions.json');

  function readDeletions() {
    try { return JSON.parse(fs.readFileSync(deletionsPath, 'utf8')); } catch { return []; }
  }
  function addDeletion(entry) {
    const list = readDeletions().filter(d => d.personId !== entry.personId);
    list.push(entry);
    atomicWrite(deletionsPath, list);
  }
  // Anonymisiert gelöschte Personen: Datensatz bleibt (Referenzen, Audit),
  // alle personenbezogenen Kanten werden entfernt.
  function applyDeletions(data) {
    const gone = new Set(readDeletions().map(d => d.personId));
    if (!gone.size) return data;
    for (const p of data.people) if (gone.has(p.id)) Object.assign(p, { name: '[gelöscht]', avatar: '🗑', active: false, anonymizedAt: readDeletions().find(d => d.personId === p.id).at });
    data.memberships = data.memberships.filter(m => !gone.has(m.personId));
    data.roles = data.roles.filter(r => !gone.has(r.personId));
    data.codes = data.codes.filter(c => !gone.has(c.personId));
    data.guardians = data.guardians.filter(g => !gone.has(g.childId) && !gone.has(g.guardianId));
    data.timeBudgets = data.timeBudgets.filter(t => !gone.has(t.childId));
    data.playSessions = data.playSessions.filter(s => !gone.has(s.childId));
    data.progress = data.progress.filter(r => !gone.has(r.childId));
    data.profileRequests = (data.profileRequests || []).filter(r => !gone.has(r.personId));
    data.invites = data.invites.filter(i => !gone.has(i.personId));
    for (const i of data.invites) if (gone.has(i.issuer)) i.issuer = '[gelöscht]';
    for (const d of data.deviceGrants || []) if (gone.has(d.issuedBy)) d.issuedBy = '[gelöscht]';
    return data;
  }

  function backupName() {
    return 'cms-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
  }

  // Rotierende Sicherungen; die ältesten über keepBackups hinaus werden entfernt.
  function snapshot(tag) {
    if (!fs.existsSync(dataPath)) return null;
    fs.mkdirSync(backupDir, { recursive: true });
    const file = path.join(backupDir, backupName().replace('.json', tag ? '-' + tag + '.json' : ''));
    fs.copyFileSync(dataPath, file);
    const all = listBackups();
    for (const old of all.slice(keepBackups)) fs.rmSync(path.join(backupDir, old), { force: true });
    return file;
  }

  function listBackups() {
    if (!fs.existsSync(backupDir)) return [];
    return fs.readdirSync(backupDir).filter(f => f.startsWith('cms-') && f.endsWith('.json')).sort().reverse();
  }

  function load() {
    const raw = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const migrated = applyDeletions(migrate(raw));
    if (migrated.version !== raw.version) snapshot('pre-migration-v' + raw.version);
    if (migrated !== raw) atomicWrite(dataPath, migrated);
    return validate(migrated);
  }

  function save(next) {
    if (fs.existsSync(dataPath)) fs.copyFileSync(dataPath, dataPath + '.previous');
    atomicWrite(dataPath, next);
  }

  // Einziger mutierender Schreibpfad: Kopie -> Änderung -> Validierung ->
  // Audit-Eintrag -> Speichern -> In-place-Übernahme (Referenzen bleiben stabil).
  function commit(db, { actor, action, areaId }, change) {
    const next = structuredClone(db);
    change(next);
    validate(next);
    next.audit = [...(next.audit || []), {
      id: crypto.randomUUID(), at: new Date().toISOString(), actor, action, areaId,
    }];
    save(next);
    Object.keys(db).forEach(k => delete db[k]);
    Object.assign(db, next);
  }

  function restore(backupFile) {
    const file = path.isAbsolute(backupFile) ? backupFile : path.join(backupDir, backupFile);
    const data = validate(applyDeletions(migrate(JSON.parse(fs.readFileSync(file, 'utf8')))));
    snapshot('pre-restore');
    save(data);
    return data;
  }

  return { dataPath, backupDir, deletionsPath, load, save, commit, snapshot, listBackups, restore, readDeletions, addDeletion, applyDeletions };
}

module.exports = { createJsonStore, atomicWrite };

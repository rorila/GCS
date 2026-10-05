// Speicheradapter für CMS-Daten (E03): einziger Lese-/Schreibpfad.
// JSON jetzt; die gleiche Schnittstelle kann später SQLite kapseln.
// Garantien: atomares Schreiben, Backup vor Migration.
// Audit: fachliche Ereignisse landen append-only in <data>-log.jsonl —
// getrennt von der Daten-Datei, damit diese nicht waechst. Technische
// Pulse (TECHNICAL_ACTIONS bzw. commit(...,audit:false)) werden gar
// nicht erst protokolliert.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { migrate } = require('./cms-migrations.cjs');
const { validate } = require('./cms-core.cjs');

const KEEP_BACKUPS = 14;
// Hohe Schreibfrequenz ohne Audit-Wert: Minutenabrechnung/Präsenz werden
// ohnehin in playSessions persistiert; Partie-Züge liegen in parties[].actions.
const TECHNICAL_ACTIONS = new Set(['play-heartbeat', 'play-heartbeat-wait', 'party-action', 'session-sweep']);
// Betriebsdaten — gehören NICHT in die Stammdaten-Datei (Rollen/Berechtigungen/
// Auth). Sie liegen in <data>-ops.json; im Speicher bilden beide Dateien ein
// gemeinsames db-Objekt, sodass der Fachcode unveraendert bleibt. Beim spaeteren
// Umzug auf eine Datenbank werden diese Sammlungen ein eigener Store.
const OPS_KEYS = ['playSessions', 'parties', 'gameInvitations', 'notifications', 'temporaryRoomAccess', 'progress'];

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

function createJsonStore({ dataPath, backupDir, keepBackups = KEEP_BACKUPS, logPath, opsPath } = {}) {
  backupDir = backupDir || path.join(path.dirname(dataPath), 'backups');
  // Löschliste liegt außerhalb der Daten-Datei: Wiederhergestellte Backups
  // dürfen zwischenzeitlich gelöschte Personen nicht zurückbringen.
  const deletionsPath = dataPath.replace(/\.json$/i, '.deletions.json');
  // Audit-Log: JSONL (eine Zeile je Eintrag), append-only — kein Full-Rewrite
  // pro commit wie beim frueheren db.audit-Array.
  logPath = logPath || dataPath.replace(/\.json$/i, '-log.jsonl');
  // Betriebsdaten-Datei: gleicher JSON-Dokumenttyp, aber getrennter Schreibpfad.
  opsPath = opsPath || dataPath.replace(/\.json$/i, '-ops.json');
  const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
  const opsOf = next => Object.fromEntries(OPS_KEYS.map(k => [k, next[k] || []]));
  const masterOf = next => Object.fromEntries(Object.entries(next).filter(([k]) => !OPS_KEYS.includes(k)));

  function appendAudit(entry) {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, JSON.stringify(entry) + '\n', { mode: 0o600 });
  }

  function readAudit() {
    try {
      return fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
    } catch { return []; }
  }

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

  // Persistenter Zustand = Stammdatei (ohne OPS_KEYS) + Ops-Datei (nur OPS_KEYS).
  // Im Speicher bleibt es ein gemeinsames db-Objekt.
  function save(next) {
    if (fs.existsSync(opsPath)) fs.copyFileSync(opsPath, opsPath + '.previous');
    atomicWrite(opsPath, opsOf(next));
    if (fs.existsSync(dataPath)) fs.copyFileSync(dataPath, dataPath + '.previous');
    atomicWrite(dataPath, masterOf(next));
  }

  function load() {
    const raw = readJson(dataPath);
    const ops = readJson(opsPath) || {};
    let dirty = false;
    // Umzug: Betriebsdaten aus der Stammdatei in die Ops-Datei extrahieren.
    for (const k of OPS_KEYS) if (k in raw) { ops[k] = raw[k]; delete raw[k]; dirty = true; }
    const merged = { ...raw, ...opsOf(ops) };
    let migrated = migrate(merged);
    if (migrated !== merged) dirty = true;
    if (migrated.version !== raw.version) snapshot('pre-migration-v' + raw.version);
    migrated = applyDeletions(migrated);
    // Einmalige Auslagerung: Altbestand db.audit -> Log-Datei (fachliche
    // Eintraege), technische Pulse werden beim Umzug verworfen.
    if (Array.isArray(migrated.audit) && migrated.audit.length) {
      snapshot('pre-log-extract');
      for (const e of migrated.audit) if (!TECHNICAL_ACTIONS.has(e.action)) appendAudit(e);
      dirty = true;
    }
    if ('audit' in migrated) { delete migrated.audit; dirty = true; }
    if (dirty) save(migrated);
    return validate(migrated);
  }

  // Einziger mutierender Schreibpfad: Kopie -> Änderung -> Validierung ->
  // Speichern -> In-place-Übernahme -> Audit-Zeile in die Log-Datei.
  // meta.audit === false unterdrückt den Log-Eintrag (technische Writes).
  // Reihenfolge: erst persistieren, dann protokollieren — lieber eine
  // Log-Zeile verlieren als eine Aktion ohne persistierte Änderung.
  function commit(db, { actor, action, areaId, audit }, change) {
    const next = structuredClone(db);
    change(next);
    validate(next);
    save(next);
    Object.keys(db).forEach(k => delete db[k]);
    Object.assign(db, next);
    if (audit !== false) appendAudit({
      id: crypto.randomUUID(), at: new Date().toISOString(), actor, action, areaId,
    });
  }

  // Stellt Stammdaten aus einer Sicherung wieder her. Betriebsdaten sind
  // bewusst NICHT Teil des Backups (vergänglicher Zustand) — der aktuelle
  // Ops-Stand bleibt erhalten, Ops-Reste alter Backups werden verworfen.
  function restore(backupFile) {
    const file = path.isAbsolute(backupFile) ? backupFile : path.join(backupDir, backupFile);
    const restored = masterOf(applyDeletions(migrate(readJson(file))));
    const data = { ...restored, ...opsOf(readJson(opsPath) || {}) };
    validate(data);
    snapshot('pre-restore');
    save(data);
    return data;
  }

  return { dataPath, backupDir, deletionsPath, logPath, opsPath, load, save, commit, snapshot, listBackups, restore, readDeletions, addDeletion, applyDeletions, readAudit };
}

module.exports = { createJsonStore, atomicWrite };

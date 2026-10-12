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

// Sponsoring: terminale Fakten, die eine Wiederherstellung niemals
// zurückdrehen darf (beendete Begleitung bleibt beendet, erfüllter Anspruch
// bleibt erfüllt, verbrauchte Punkte bleiben verbraucht, Belege/Ereignisse
// und veröffentlichte Versionen werden vereinigt statt ersetzt).
const SPONSOR_TERMINAL = {
  sponsorships: { key: 'id', terminal: r => ['ended', 'rejected', 'withdrawn', 'expired'].includes(r.status) },
  sponsorshipRequestCapabilities: { key: 'id', terminal: r => ['consumed', 'revoked'].includes(r.status) },
  sponsorAccessVersions: { key: 'id', terminal: r => ['superseded', 'revoked'].includes(r.status) },
};
const SPONSOR_UNION = {
  sponsorAgreementVersions: v => v.agreementId + ':' + v.version,
  sponsorApprovals: v => v.targetType + ':' + v.targetId + ':' + v.version + ':' + v.actorId + ':' + v.aspect,
  performanceLedger: v => v.eventId,
  rewardPointEntries: v => v.id,
  sponsorEvents: v => v.id,
  sponsorCommandReceipts: v => v.key,
  sponsorMessages: v => v.id,
};
// Vereinigte Schreib-Locks dieses Prozesses — ein gemeinsamer Exit-Handler,
// damit viele Store-Instanzen (Tests) keine Listener-Warnung erzeugen.
const LOCKS = new Set();
let lockHookInstalled = false;
function releaseLock(lockPath) {
  try {
    if (!fs.existsSync(lockPath)) return;
    const j = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    if (j.pid === process.pid) { fs.unlinkSync(lockPath); LOCKS.delete(lockPath); }
  } catch { /* Lock-Räumen ist best-effort */ }
}
// Schreib-Lock auf der Datenbasis: eine zweite lebendige Writer-Instanz
// (anderer Prozess, z. B. doppelt gestarteter Server) wird abgelehnt.
// Gleicher Prozess darf erneut öffnen; verwaiste Locks werden übernommen.
function acquireLock(dataPath, force) {
  const lockPath = dataPath + '.lock';
  const claim = () => {
    const fd = fs.openSync(lockPath, 'wx');
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
    fs.closeSync(fd);
    LOCKS.add(lockPath);
    if (!lockHookInstalled) {
      lockHookInstalled = true;
      process.once('exit', () => { for (const p of [...LOCKS]) releaseLock(p); });
    }
    return lockPath;
  };
  try { return claim(); } catch (e) { if (e.code !== 'EEXIST') throw e; }
  let stale = null; try { stale = JSON.parse(fs.readFileSync(lockPath, 'utf8')); } catch { }
  let alive = false;
  if (stale?.pid && stale.pid !== process.pid) { try { process.kill(stale.pid, 0); alive = true; } catch { alive = false; } }
  if (alive && !force) throw Error('CMS-Datenbasis ist bereits geöffnet (PID ' + stale.pid + '). Zweite Writer-Instanz verweigert.');
  return claim();
}

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

function createJsonStore({ dataPath, backupDir, keepBackups = KEEP_BACKUPS, logPath, opsPath, lock = true, forceLock = false } = {}) {
  backupDir = backupDir || path.join(path.dirname(dataPath), 'backups');
  // Schreib-Lock: nur eine Writer-Instanz je Datenbasis.
  if (lock) acquireLock(dataPath, forceLock);
  // Pending-Journal für atomare Zwei-Dateien-Commits: vor dem Schreiben von
  // Ops- und Stammdatei liegt der komplette Zielzustand hier. Ein Abbruch
  // dazwischen wird beim nächsten Laden aus dem Journal nachgezogen.
  const pendingPath = dataPath.replace(/\.json$/i, '-pending.json');
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
    // Sponsoring: gelöschte Personen dürfen keine aktive Begleitung behalten;
    // Historie und Ansprüche bleiben als anonymisierte Fakten bestehen.
    const nowIso = new Date().toISOString();
    for (const s of data.sponsorships || []) {
      if ((gone.has(s.sponsorId) || gone.has(s.childId)) && !['ended', 'rejected', 'withdrawn', 'expired'].includes(s.status)) {
        Object.assign(s, { status: 'ended', endedAt: s.endedAt || nowIso, endReason: 'person-deleted' });
      }
    }
    for (const c of data.sponsorshipRequestCapabilities || []) {
      if ((gone.has(c.childId) || gone.has(c.issuedBy)) && c.status === 'active') { c.status = 'revoked'; c.revokedAt = c.revokedAt || nowIso; }
    }
    for (const e of data.sponsorEvents || []) if (gone.has(e.actorId)) e.actorId = '[gelöscht]';
    for (const m of data.sponsorMessages || []) if (gone.has(m.authorId)) m.authorId = '[gelöscht]';
    return data;
  }

  function backupName() {
    return 'cms-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
  }

  // Rotierende Sicherungen; die ältesten über keepBackups hinaus werden
  // entfernt. Format 2 enthält Stamm- UND Betriebsdaten, damit eine
  // vollständige Sicherung den gesamten Fachzustand abbildet. Ältere
  // Sicherungen (reine Stammdatei) bleiben lesbar.
  function snapshot(tag) {
    if (!fs.existsSync(dataPath)) return null;
    fs.mkdirSync(backupDir, { recursive: true });
    const file = path.join(backupDir, backupName().replace('.json', tag ? '-' + tag + '.json' : ''));
    const master = readJson(dataPath);
    const ops = readJson(opsPath) || {};
    atomicWrite(file, { __snapshot: 2, at: new Date().toISOString(), master, ops });
    const all = listBackups();
    for (const old of all.slice(keepBackups)) fs.rmSync(path.join(backupDir, old), { force: true });
    return file;
  }

  function listBackups() {
    if (!fs.existsSync(backupDir)) return [];
    return fs.readdirSync(backupDir).filter(f => f.startsWith('cms-') && f.endsWith('.json')).sort().reverse();
  }

  // Wendet Sponsor-Endzustände des aktuellen Bestands auf einen
  // wiederhergestellten Stand an: terminale Beziehungen und verbrauchte/
  // erfüllte Fakten werden nie durch ein altes Backup wieder geöffnet.
  function reapplySponsorTerminal(next, before) {
    if (!before) return;
    for (const [coll, rule] of Object.entries(SPONSOR_TERMINAL)) {
      const prevById = new Map((before[coll] || []).map(r => [r[rule.key], r]));
      next[coll] = (next[coll] || []).map(r => {
        const prev = prevById.get(r[rule.key]);
        return prev && rule.terminal(prev) ? prev : r;
      });
    }
    // Vereinigung: append-only-/versionsbasierte Sammlungen behalten alle
    // Einträge aus beiden Ständen (Schlüssel dedupliziert, aktueller gewinnt).
    for (const [coll, keyOf] of Object.entries(SPONSOR_UNION)) {
      const merged = new Map();
      for (const r of next[coll] || []) merged.set(keyOf(r), r);
      for (const r of before[coll] || []) merged.set(keyOf(r), r);
      next[coll] = [...merged.values()];
    }
    // Ansprüche: der weiter fortgeschrittene Zustand gewinnt je entitlementKey
    // (erfüllt/storniert schlägt angefordert/erreicht; sonst aktueller Stand).
    const CLAIM_RANK = { fulfilled: 4, cancelled: 3, released: 3, requested: 2, earned: 1, offered: 0 };
    const claims = new Map((next.rewardClaims || []).map(c => [c.entitlementKey, c]));
    for (const c of before.rewardClaims || []) {
      const cur = claims.get(c.entitlementKey);
      if (!cur || (CLAIM_RANK[c.status] || 0) > (CLAIM_RANK[cur.status] || 0)) claims.set(c.entitlementKey, c);
    }
    next.rewardClaims = [...claims.values()];
    // Begleitungen: höhere revision gewinnt (terminal bereits oben gesichert).
    const sp = new Map((next.sponsorships || []).map(s => [s.id, s]));
    for (const s of before.sponsorships || []) {
      const cur = sp.get(s.id);
      if (!cur || (s.revision || 0) > (cur.revision || 0)) sp.set(s.id, s);
    }
    next.sponsorships = [...sp.values()];
    const ag = new Map((next.sponsorAgreements || []).map(a => [a.id, a]));
    for (const a of before.sponsorAgreements || []) {
      const cur = ag.get(a.id);
      if (!cur || (a.activeVersion || 0) > (cur.activeVersion || 0)) ag.set(a.id, a);
    }
    next.sponsorAgreements = [...ag.values()];
  }

  // Persistenter Zustand = Stammdatei (ohne OPS_KEYS) + Ops-Datei (nur OPS_KEYS).
  // Im Speicher bleibt es ein gemeinsames db-Objekt. Das Pending-Journal
  // macht den Zwei-Dateien-Commit nachvollziehbar: es wird zuerst geschrieben
  // und zuletzt entfernt — ein Abbruch dazwischen wird beim Laden nachgezogen.
  function save(next) {
    atomicWrite(pendingPath, { master: masterOf(next), ops: opsOf(next) });
    if (fs.existsSync(opsPath)) fs.copyFileSync(opsPath, opsPath + '.previous');
    atomicWrite(opsPath, opsOf(next));
    if (fs.existsSync(dataPath)) fs.copyFileSync(dataPath, dataPath + '.previous');
    atomicWrite(dataPath, masterOf(next));
    fs.rmSync(pendingPath, { force: true });
  }

  function load() {
    // Abbruch mitten im Commit? Journal zuerst vollständig anwenden.
    const pending = readJson(pendingPath);
    if (pending && pending.master) {
      atomicWrite(opsPath, pending.ops || {});
      atomicWrite(dataPath, pending.master);
      fs.rmSync(pendingPath, { force: true });
    }
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
    const result = change(next);
    // Fachliche Ablehnung ist kein Schreibvorgang. Auch versehentliche
    // Teilmutationen des Callbacks dürfen dann nicht persistiert werden.
    if (result?.ok === false) return result;
    validate(next);
    save(next);
    Object.keys(db).forEach(k => delete db[k]);
    Object.assign(db, next);
    if (audit !== false) appendAudit({
      id: crypto.randomUUID(), at: new Date().toISOString(), actor, action, areaId,
    });
    return result;
  }

  // Stellt Stammdaten aus einer Sicherung wieder her. Betriebsdaten bleiben
  // bewusst auf dem aktuellen Stand (vergänglicher Zustand). Format-2-
  // Sicherungen liefern zusätzlich ihren Ops-Stand mit — er wird nur als
  // Dokumentation gelesen, nicht zurückgespielt. Sponsor-Endzustände des
  // aktuellen Bestands werden nach der Wiederherstellung erneut angewendet,
  // damit kein Backup beendete Beziehungen oder erfüllte Ansprüche öffnet.
  function restore(backupFile) {
    const file = path.isAbsolute(backupFile) ? backupFile : path.join(backupDir, backupFile);
    const parsed = readJson(file);
    const backup = parsed && parsed.__snapshot === 2 ? parsed.master : parsed;
    const before = { ...(readJson(dataPath) || {}), ...opsOf(readJson(opsPath) || {}) };
    const restored = masterOf(applyDeletions(migrate(backup)));
    const data = { ...restored, ...opsOf(readJson(opsPath) || {}) };
    reapplySponsorTerminal(data, before);
    validate(data);
    snapshot('pre-restore');
    save(data);
    return data;
  }

  return { dataPath, backupDir, deletionsPath, logPath, opsPath, load, save, commit, snapshot, listBackups, restore, readDeletions, addDeletion, applyDeletions, readAudit };
}

module.exports = { createJsonStore, atomicWrite };

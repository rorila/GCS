// CMS-Schema-Migrationen. Jede Migration ist idempotent und wird einmal pro
// Versionsgrenze ausgeführt; Reihenfolge strikt aufsteigend. Reihenfolge:
// up() arbeitet auf einer Kopie, validate() entscheidet über das Ergebnis.
const SCHEMA_VERSION = 2;

// v1 -> v2: Zielmodellkern (E02/E03/E06/E07)
// - people.kind: 'child'|'adult' (fachliche Grundlage für Eltern-/Kinderlogik)
// - guardians: Bestätigungsverfahren (status/createdBy/confirmedAt/revokedAt)
// - adminInvites -> invites (generalisiert: purpose 'admin-setup'|'parent'|...)
// - neue leere Collections: timeBudgets, playSessions, progress, deviceGrants
function v1_to_v2(db) {
  db.version = 2;
  // 'player' ist eine Kinderrolle; nur Verwaltungsrollen implizieren 'adult'.
  const ADULT_ROLES = new Set(['areaAdmin', 'superAdmin', 'oversight']);
  const codeHolders = new Set((db.codes || []).map(c => c.personId));
  const adultHolders = new Set((db.roles || []).filter(r => ADULT_ROLES.has(r.role)).map(r => r.personId));
  for (const p of db.people) {
    if (!p.kind) p.kind = codeHolders.has(p.id) && !adultHolders.has(p.id) ? 'child' : 'adult';
  }
  for (const g of db.guardians) {
    if (!g.status) g.status = 'confirmed';
    if (g.createdAt === undefined) g.createdAt = null;
    if (g.confirmedBy === undefined) g.confirmedBy = null;
    if (g.revokedAt === undefined) g.revokedAt = null;
  }
  if (Array.isArray(db.adminInvites)) {
    for (const i of db.adminInvites) {
      db.invites.push({
        id: 'invite-' + i.personId, personId: i.personId, houseId: i.houseId,
        purpose: 'admin-setup', issuer: i.issuer, hash: i.hash, expires: i.expires,
      });
    }
    delete db.adminInvites;
  }
  for (const key of ['invites', 'timeBudgets', 'playSessions', 'progress', 'deviceGrants']) {
    if (!Array.isArray(db[key])) db[key] = [];
  }
  db.meta = { ...(db.meta || {}), migratedFrom: 1, migratedAt: new Date().toISOString() };
  return db;
}

const MIGRATIONS = [{ from: 1, to: 2, up: v1_to_v2 }];

// Führt alle anstehenden Migrationen auf einer Kopie aus (das Original bleibt
// unverändert, damit Vorher-/Nachher-Vergleich und Backup korrekt greifen).
// Wirft bei Versionslücke oder unbekannter Ausgangsversion.
function migrate(db) {
  db = structuredClone(db);
  const seen = new Set();
  while (db.version !== SCHEMA_VERSION) {
    if (seen.has(db.version)) throw Error('Migrationsschleife bei Version ' + db.version);
    seen.add(db.version);
    const step = MIGRATIONS.find(m => m.from === db.version);
    if (!step) throw Error('Keine Migration von Version ' + db.version + ' bekannt');
    db = step.up(db);
  }
  return db;
}

module.exports = { SCHEMA_VERSION, MIGRATIONS, migrate };

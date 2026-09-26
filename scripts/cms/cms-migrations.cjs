// CMS-Schema-Migrationen. Jede Migration ist idempotent und wird einmal pro
// Versionsgrenze ausgeführt; Reihenfolge strikt aufsteigend. Reihenfolge:
// up() arbeitet auf einer Kopie, validate() entscheidet über das Ergebnis.
const SCHEMA_VERSION = 5;

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

// v2 -> v3: hausinterner Multiplayer (P4) — neue Collection parties.
function v2_to_v3(db) {
  db.version = 3;
  if (!Array.isArray(db.parties)) db.parties = [];
  db.meta = { ...(db.meta || {}), migratedFrom: 2, migratedAt: new Date().toISOString() };
  return db;
}

// v3 -> v4: Mitgliedschaft am Haus = Bewohner; Mitgliedschaft am Raum =
// Raumzuordnung. Bestehende Daten werden aus Raumzuordnungen, Rollen und
// Emoji-Codes abgeleitet, damit kein vorhandener Zugang verloren geht.
function v3_to_v4(db) {
  db.version = 4;
  const houseOf = areaId => {
    const seen = new Set();
    let area = db.areas.find(a => a.id === areaId);
    while (area && area.type !== 'house' && !seen.has(area.id)) {
      seen.add(area.id);
      area = db.areas.find(a => a.id === area.parentId);
    }
    return area?.type === 'house' ? area : null;
  };
  const wanted = new Map();
  const remember = (personId, areaId, active) => {
    const house = houseOf(areaId);
    if (!house) return;
    const key = personId + ':' + house.id;
    wanted.set(key, {
      personId, areaId: house.id,
      active: !!active || !!wanted.get(key)?.active,
    });
  };
  for (const m of db.memberships || []) remember(m.personId, m.areaId, m.active);
  for (const r of db.roles || []) remember(r.personId, r.areaId, r.active);
  for (const c of db.codes || []) remember(c.personId, c.areaId, true);
  for (const row of wanted.values()) {
    const current = db.memberships.find(m => m.personId === row.personId && m.areaId === row.areaId);
    if (current) current.active = current.active || row.active;
    else db.memberships.push(row);
  }
  db.meta = { ...(db.meta || {}), migratedFrom: 3, migratedAt: new Date().toISOString() };
  return db;
}

// v4 -> v5: getrennte Multiplayer-Einladungen/Benachrichtigungen sowie die
// Invariante, dass jeder aktive Raum mindestens einen aktiven RaumAdmin hat.
function v4_to_v5(db) {
  db.version = 5;
  for (const key of ['gameInvitations', 'notifications', 'temporaryRoomAccess']) {
    if (!Array.isArray(db[key])) db[key] = [];
  }
  for (const room of db.areas.filter(a => a.type === 'room' && a.active)) {
    const hasAdmin = db.roles.some(r => r.areaId === room.id && r.role === 'areaAdmin' && r.active);
    if (hasAdmin) continue;
    const fallback = db.roles.find(r => r.areaId === room.parentId && r.role === 'areaAdmin' && r.active);
    if (fallback) db.roles.push({ personId: fallback.personId, areaId: room.id, role: 'areaAdmin', active: true, primary: true });
  }
  db.meta = { ...(db.meta || {}), migratedFrom: 4, migratedAt: new Date().toISOString() };
  return db;
}

const MIGRATIONS = [
  { from: 1, to: 2, up: v1_to_v2 },
  { from: 2, to: 3, up: v2_to_v3 },
  { from: 3, to: 4, up: v3_to_v4 },
  { from: 4, to: 5, up: v4_to_v5 },
];

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

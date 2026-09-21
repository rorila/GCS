// Datenschutz-Funktionen (P1.6): personenbezogener Export und Löschung.
// Löschung = Anonymisierung + Entfernen personenbezogener Kanten; die
// Löschliste überlebt Wiederherstellungen (liegt außerhalb der Daten-Datei).
function createPrivacy(core, store) {
  const db = core.db;

  // Alle personenbezogenen Daten einer Person. Emoji-Sequenzen sind
  // Zugangsdaten — sie werden nur als Anzahl/Bereich exportiert, nie im Klartext.
  function exportPerson(personId) {
    const person = db.people.find(p => p.id === personId);
    if (!person) return null;
    return {
      exportedAt: new Date().toISOString(),
      person: { id: person.id, name: person.name, kind: person.kind, avatar: person.avatar, active: person.active, anonymizedAt: person.anonymizedAt || null },
      memberships: db.memberships.filter(m => m.personId === personId),
      roles: db.roles.filter(r => r.personId === personId),
      guardiansAsChild: db.guardians.filter(g => g.childId === personId),
      guardiansAsGuardian: db.guardians.filter(g => g.guardianId === personId),
      codes: db.codes.filter(c => c.personId === personId).map(c => ({ areaId: c.areaId, sequenceLength: c.sequence.length })),
      timeBudgets: db.timeBudgets.filter(t => t.childId === personId),
      playSessions: db.playSessions.filter(s => s.childId === personId),
      parties: db.parties.filter(p => p.hostId === personId || p.members.some(m => m.personId === personId))
        .map(p => ({ id: p.id, gameId: p.gameId, areaId: p.areaId, status: p.status, host: p.hostId === personId, actions: p.actions.filter(a => a.by === personId).length })),
      progress: db.progress.filter(r => r.childId === personId),
      profileRequests: (db.profileRequests || []).filter(r => r.personId === personId),
      invites: db.invites.filter(i => i.personId === personId).map(i => ({ id: i.id, purpose: i.purpose, houseId: i.houseId, expires: i.expires, usedAt: i.usedAt || null })),
      auditEntries: (db.audit || []).filter(a => a.actor === personId).map(a => ({ at: a.at, action: a.action, areaId: a.areaId })),
      deviceGrantsIssued: (db.deviceGrants || []).filter(d => d.issuedBy === personId).map(d => ({ id: d.id, houseId: d.houseId, label: d.label })),
    };
  }

  // Anonymisiert eine Person und entfernt ihre personenbezogenen Kanten.
  // Schlägt fehl, wenn die Person Spiele besitzt — die müssen zuerst
  // übertragen oder gesperrt entfernt werden (Eigentum ist Verwaltungsinhalt).
  function deletePerson(actor, personId) {
    const person = db.people.find(p => p.id === personId);
    if (!person) return { ok: false, message: 'Person nicht gefunden.' };
    if (person.anonymizedAt) return { ok: false, message: 'Person ist bereits gelöscht.' };
    if (db.games.some(g => g.ownerId === personId)) return { ok: false, message: 'Person besitzt Spiele — zuerst übertragen oder entfernen.' };
    store.commit(db, { actor, action: 'person-delete', areaId: null }, next => {
      const at = new Date().toISOString();
      const target = next.people.find(p => p.id === personId);
      Object.assign(target, { name: '[gelöscht]', avatar: '🗑', active: false, anonymizedAt: at });
      next.memberships = next.memberships.filter(m => m.personId !== personId);
      next.roles = next.roles.filter(r => r.personId !== personId);
      next.codes = next.codes.filter(c => c.personId !== personId);
      next.guardians = next.guardians.filter(g => g.childId !== personId && g.guardianId !== personId);
      next.timeBudgets = next.timeBudgets.filter(t => t.childId !== personId);
      next.playSessions = next.playSessions.filter(s => s.childId !== personId);
      next.progress = next.progress.filter(r => r.childId !== personId);
      next.profileRequests = (next.profileRequests || []).filter(r => r.personId !== personId);
      next.invites = next.invites.filter(i => i.personId !== personId);
      for (const i of next.invites) if (i.issuer === personId) i.issuer = '[gelöscht]';
      for (const d of next.deviceGrants || []) if (d.issuedBy === personId) d.issuedBy = '[gelöscht]';
      // Partien: offene Mitgliedschaft beenden, Aktionslog anonymisieren.
      // members.personId bleibt (Tombstone in people erhält referentielle
      // Integrität; Anzeige zeigt den Tombstone-Namen).
      for (const p of next.parties) {
        for (const m of p.members) if (m.personId === personId && !m.leftAt) m.leftAt = at;
        for (const a of p.actions) if (a.by === personId) a.by = '[gelöscht]';
      }
    });
    store.addDeletion({ personId, at: new Date().toISOString(), actor });
    core.dropPerson(personId);
    return { ok: true, message: 'Person anonymisiert; Löschung übersteht Wiederherstellungen.' };
  }

  return { exportPerson, deletePerson };
}

module.exports = { createPrivacy };

// Sponsor-Begleitungen (v8): Anfrage/Genehmigung, Sichtfreigaben,
// Vereinbarungen und Zustimmungen als atomare Fachoperationen.
// Alle Funktionen arbeiten auf dem `next`-Bestand innerhalb eines commit() —
// der Aufrufer (Komponentenmethode) wählt Transaktionsgrenze und Audit.
// Sicherheitsinvarianten (Rolle, Beziehung, Zustand, Quorum) werden hier
// erneut geprüft und sind nie nur Aufgabe des sichtbaren Flows.
const crypto = require('node:crypto');
const performance = require('./cms-performance.cjs');

const hashToken = t => crypto.createHash('sha256').update(String(t)).digest('hex');
const rid = p => p + '-' + crypto.randomBytes(6).toString('hex');
const iso = t => new Date(t).toISOString();
const TERMINAL = new Set(['ended', 'rejected', 'withdrawn', 'expired']);
const OPEN = new Set(['requested', 'active', 'paused']);

const person = (db, id) => db.people.find(p => p.id === id);
const activePerson = (db, id) => db.people.some(p => p.id === id && p.active);
const isSponsor = (db, id) => db.roles.some(r => r.personId === id && r.role === 'sponsor' && r.areaId === 'root' && r.active);
const isChild = (db, id) => person(db, id)?.kind === 'child';
// Zustimmungspflichtige Eltern: alle aktuell bestätigten, aktiven
// Erziehungsberechtigten des Kindes (D1). Die Liste wird bei Aktivierung
// in requiredGuardianIds eingefroren, damit die Zuständigkeit nachvollziehbar bleibt.
const confirmedGuardians = (db, childId) => db.guardians
  .filter(g => g.childId === childId && g.status === 'confirmed' && activePerson(db, g.guardianId))
  .map(g => g.guardianId);
const isGuardianOf = (db, childId, id) => confirmedGuardians(db, childId).includes(id);

const sponsorship = (db, id) => db.sponsorships.find(s => s.id === id);
const openBetween = (db, sponsorId, childId) => db.sponsorships.find(s => s.sponsorId === sponsorId && s.childId === childId && OPEN.has(s.status));
const agreement = (db, id) => db.sponsorAgreements.find(a => a.id === id);
const agreementsOf = (db, sid) => db.sponsorAgreements.filter(a => a.sponsorshipId === sid);
const versionOf = (db, agreementId, version) => db.sponsorAgreementVersions.find(v => v.agreementId === agreementId && v.version === version);
const activeVersionOf = (db, a) => a && a.activeVersion ? versionOf(db, a.id, a.activeVersion) : null;
const accessVersion = (db, id) => db.sponsorAccessVersions.find(v => v.id === id);

function fail(status, message) { return { ok: false, status, message }; }
function done(extra = {}) { return { ok: true, ...extra }; }

// Ablauf prüfen und ggf. lazy in 'expired' überführen (innerhalb eines commit).
function expireIfDue(db, s, now) {
  if (s && s.status === 'active' && s.periodEnd && Date.parse(s.periodEnd) <= now) {
    transition(db, s, 'expired', s.sponsorId, { reason: 'period-end' });
  }
}

// Zustandsübergang mit Ereignisprotokoll (Zeitpunkt, Person, vorher/nachher).
function transition(db, s, to, actorId, detail = {}) {
  const at = iso(Date.now());
  const prev = { status: s.status, revision: s.revision };
  s.status = to; s.revision = (s.revision || 1) + 1; s.updatedAt = at;
  if (to === 'paused') { s.pausedAt = at; s.pausedBy = actorId; (s.pauseIntervals = s.pauseIntervals || []).push({ from: at, to: null }); }
  if (to === 'active' && prev.status === 'paused') {
    const iv = (s.pauseIntervals || []).find(i => !i.to); if (iv) iv.to = at;
    s.resumedAt = at; s.pausedBy = null;
  }
  if (['ended', 'rejected', 'withdrawn', 'expired'].includes(to)) { s.endedAt = at; s.endReason = detail.reason || null; }
  db.sponsorEvents.push({
    id: rid('sev'), sponsorshipId: s.id, type: 'state-' + to, actorId, at,
    prev, next: { status: to, revision: s.revision }, detail,
  });
  return at;
}

// Familienbenachrichtigungen je konkretem Ereignis statt je Begleitung.
function notify(db, recipients, type, ref, title, body, eventKey) {
  // Jeder fachliche Vorgang besitzt einen eigenen Beleg. Wiederholte
  // Kommandos verlassen die Fachmethode bereits vor der Benachrichtigung.
  const notificationKey = eventKey || rid('notice');
  for (const r of new Set(recipients.filter(Boolean))) {
    if (db.notifications.some(n => n.recipientPersonId === r && n.notificationKey === notificationKey)) continue;
    db.notifications.push({ id: rid('ntf'), notificationKey, recipientPersonId: r, type, ref, title, body, createdAt: iso(Date.now()), readAt: null });
  }
}
const familyOf = (db, s) => [s.childId, ...s.requiredGuardianIds];

// Idempotenz: ein fachlicher Schlüssel darf nur einmal wirken; Wiederholung
// liefert den gespeicherten Beleg statt einer zweiten Änderung.
function withReceipt(db, key, fn, payload) {
  if (!key) return fn();
  const seen = db.sponsorCommandReceipts.find(r => r.key === key);
  const fingerprint = payload === undefined ? null : hashToken(JSON.stringify(payload));
  if (seen) {
    if (fingerprint && seen.fingerprint !== fingerprint) return fail(409, 'Vorgangs-ID wurde bereits für andere Eingaben verwendet.');
    return { ...seen.result, reused: true };
  }
  const result = fn();
  if (result.ok !== false) db.sponsorCommandReceipts.push({ key, fingerprint, at: iso(Date.now()), result: structuredClone(result) });
  return result;
}

// Sponsorzugriff: nur über die konkrete Beziehung, nur im Zustand 'active',
// nur innerhalb der Laufzeit und nur mit wirksamer Sichtfreigabe.
function sponsorCanView(db, s, sponsorId, now = Date.now()) {
  if (!s || s.sponsorId !== sponsorId) return false;
  if (!activePerson(db, sponsorId) || !isSponsor(db, sponsorId) || !activePerson(db, s.childId)) return false;
  if (s.status !== 'active') return false;
  if (s.periodEnd && Date.parse(s.periodEnd) <= now) return false;
  const access = accessVersion(db, s.activeAccessVersionId);
  return access?.sponsorshipId === s.id && access.status === 'active';
}

function canReadRelationship(db, s, actorId) {
  return !!s && activePerson(db, actorId) && (actorId === s.childId || isGuardianOf(db, s.childId, actorId) || sponsorCanView(db, s, actorId));
}

function normalizeScope(scope) {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) return null;
  if (!Array.isArray(scope.subjects) || !Array.isArray(scope.activities)) return null;
  if ([...scope.subjects, ...scope.activities].some(x => typeof x !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(x))) return null;
  if (scope.subjects.length > 24 || scope.activities.length > 24) return null;
  if (!['points', 'aggregates', 'summary'].includes(scope.detailLevel)) return null;
  if (!Number.isSafeInteger(scope.windowDays) || scope.windowDays < 1 || scope.windowDays > 3650) return null;
  return { subjects: [...new Set(scope.subjects)].sort(), activities: [...new Set(scope.activities)].sort(), detailLevel: scope.detailLevel, windowDays: scope.windowDays };
}

function scopeOf(db, s) {
  const v = accessVersion(db, s.activeAccessVersionId);
  return v ? v.scope : null;
}
const DEFAULT_SCOPE = () => ({ subjects: ['math'], activities: [], detailLevel: 'points', windowDays: 90 });

// Diff zweier Sichten: eingeschraenkt = neue Sicht ist Teilmenge der alten.
function scopeIsSubset(next, prev) {
  if (!prev) return false;
  if (!next.subjects.length) return true;
  // subjects=[] bedeutet keine Fächer; activities=[] bedeutet alle
  // Aktivitäten innerhalb der freigegebenen Fächer.
  return next.subjects.every(x => (prev.subjects || []).includes(x))
    && (!(prev.activities || []).length || (next.activities.length > 0 && next.activities.every(x => prev.activities.includes(x))))
    && (next.windowDays || 0) <= (prev.windowDays || Infinity)
    && detailRank(next.detailLevel) <= detailRank(prev.detailLevel);
}
const detailRank = l => ({ hidden: 0, points: 1, aggregates: 2, summary: 3 }[l] ?? 3);

// Vereinbarungsbedingungen serverseitig prüfen (Wertebereich, Regelbezug).
function validateTerms(db, terms) {
  if (!terms || typeof terms !== 'object') return 'Bedingungen fehlen.';
  if (!Number.isSafeInteger(terms.pointsTarget) || terms.pointsTarget < 1 || terms.pointsTarget > 1000000) return 'Punkteziel außerhalb 1..1000000.';
  if (!Array.isArray(terms.metricKeys) || terms.metricKeys.length < 1 || terms.metricKeys.length > 32) return 'Leistungsarten fehlen oder zu viele.';
  const published = new Set(db.performanceRuleVersions.filter(r => r.status === 'published').map(r => r.subjectKey + '.' + r.activityKey));
  for (const k of terms.metricKeys) if (!published.has(k)) return 'Unbekannte Leistungsart: ' + k;
  if (terms.from && Number.isNaN(Date.parse(terms.from))) return 'Ungültiger Beginn.';
  if (terms.until && Number.isNaN(Date.parse(terms.until))) return 'Ungültiges Ende.';
  if (terms.validUntil && Number.isNaN(Date.parse(terms.validUntil))) return 'Ungültige Gültigkeitsdauer.';
  if (terms.from && terms.until && Date.parse(terms.until) <= Date.parse(terms.from)) return 'Ende liegt vor Beginn.';
  if (typeof terms.rewardText !== 'string' || terms.rewardText.length < 3 || terms.rewardText.length > 500) return 'Belohnungstext fehlt oder zu lang (3..500).';
  if (terms.consumePoints !== undefined && typeof terms.consumePoints !== 'boolean') return 'consumePoints muss true/false sein.';
  if (terms.carryOver !== undefined && !['none', 'carry'].includes(terms.carryOver)) return 'carryOver muss none/carry sein.';
  return null;
}

// Zustimmungsquorum einer Vereinbarungsversion: alle zustimmungspflichtigen
// Eltern + der Sponsor (dessen Pflichten sich ändern). Erfasst als Liste
// fehlender Parteien, damit UI verständlich anzeigen kann, was noch fehlt.
function agreementQuorum(db, s, version) {
  const need = [];
  const has = (actorId, aspect) => db.sponsorApprovals.some(a => a.targetType === 'agreement' && a.targetId === version.agreementId && a.version === version.version && a.actorId === actorId && a.aspect === aspect);
  for (const g of s.requiredGuardianIds) if (!has(g, 'terms')) need.push({ actorId: g, aspect: 'terms', role: 'parent' });
  if (!has(s.sponsorId, 'terms')) need.push({ actorId: s.sponsorId, aspect: 'terms', role: 'sponsor' });
  return need;
}

function accessQuorum(db, s, version) {
  const need = [];
  const has = actorId => db.sponsorApprovals.some(a => a.targetType === 'access' && a.targetId === version.id && a.version === version.version && a.actorId === actorId);
  for (const g of s.requiredGuardianIds) if (!has(g)) need.push({ actorId: g, role: 'parent' });
  return need;
}

// ---- DTOs (Feld-Allowlist; nie Rohdaten an den Sponsor) ----
function sponsorDto(db, s, viewer = 'sponsor') {
  const sp = person(db, s.sponsorId), ch = person(db, s.childId);
  const base = {
    id: s.id, status: s.status, revision: s.revision,
    childName: ch?.name, childAvatar: ch?.avatar,
    periodStart: s.periodStart, periodEnd: s.periodEnd,
    activeAccessVersionId: s.activeAccessVersionId,
    pausedBy: s.pausedBy, endReason: s.endReason,
  };
  if (viewer !== 'sponsor') {
    base.sponsorName = sp?.name; base.sponsorAvatar = sp?.avatar;
    base.purpose = s.purpose; base.notes = s.notes;
    base.requiredGuardianIds = s.requiredGuardianIds;
  }
  return base;
}

function agreementDto(db, a) {
  const versions = db.sponsorAgreementVersions
    .filter(v => v.agreementId === a.id).sort((x, y) => x.version - y.version)
    .map(v => ({ id: a.id + ':' + v.version, agreementId: v.agreementId, version: v.version, status: v.status, terms: v.terms, proposedBy: v.proposedBy, createdAt: v.createdAt, activatedAt: v.activatedAt }));
  return { id: a.id, sponsorshipId: a.sponsorshipId, activeVersion: a.activeVersion, versions };
}

function createSponsor(core) {
  const db = () => core.db;

  // ---- Kontakt-Fähigkeiten (Eltern) ----
  function createContactCode(db, { actorId, childId, label, days = 90 }) {
    if (!isGuardianOf(db, childId, actorId)) return fail(403, 'Nur Erziehungsberechtigte erstellen Kontaktcodes.');
    if (!isChild(db, childId) || !activePerson(db, childId)) return fail(404, 'Kind nicht gefunden.');
    const token = crypto.randomBytes(9).toString('base64url');
    const cap = {
      id: rid('cap'), childId, tokenHash: hashToken(token), label: String(label || '').slice(0, 120),
      issuedBy: actorId, createdAt: iso(Date.now()), expiresAt: iso(Date.now() + days * 86400000),
      revokedAt: null, status: 'active', consumedBy: null,
    };
    db.sponsorshipRequestCapabilities.push(cap);
    db.sponsorEvents.push({ id: rid('sev'), sponsorshipId: null, type: 'contact-code-created', actorId, at: cap.createdAt, prev: null, next: null, detail: { childId, capabilityId: cap.id, label: cap.label } });
    return done({ capabilityId: cap.id, contactCode: token, expiresAt: cap.expiresAt, message: 'Kontaktcode erstellt — einmalig weitergeben.' });
  }
  function listContactCodes(db, { actorId, childId }) {
    if (!isGuardianOf(db, childId, actorId)) return fail(403, 'Nur Erziehungsberechtigte sehen Kontaktcodes.');
    return done({
      items: db.sponsorshipRequestCapabilities.filter(c => c.childId === childId)
        .map(c => ({ id: c.id, label: c.label, status: c.status, createdAt: c.createdAt, expiresAt: c.expiresAt, consumedBy: c.consumedBy }))
    });
  }
  function revokeContactCode(db, { actorId, capabilityId }) {
    const c = db.sponsorshipRequestCapabilities.find(x => x.id === capabilityId);
    if (!c) return fail(404, 'Kontaktcode nicht gefunden.');
    if (!isGuardianOf(db, c.childId, actorId)) return fail(403, 'Nur Erziehungsberechtigte widerrufen Kontaktcodes.');
    if (c.status !== 'active') return done({ message: 'Kontaktcode war bereits ungültig.' });
    c.status = 'revoked'; c.revokedAt = iso(Date.now());
    return done({ message: 'Kontaktcode widerrufen.' });
  }

  // ---- Anfrage ----
  function createRequest(db, { sponsorId, contactCode, purpose, periodEnd, notes, requestId, commandPayload }) {
    if (!isSponsor(db, sponsorId)) return fail(403, 'Keine Sponsor-Berechtigung.');
    return withReceipt(db, 'sponsor-request:' + sponsorId + ':' + (requestId || hashToken(contactCode)), () => {
      const cap = db.sponsorshipRequestCapabilities.find(c => c.tokenHash === hashToken(contactCode));
      if (!cap) return fail(404, 'Kontaktcode unbekannt.');
      if (cap.status !== 'active') return fail(409, 'Kontaktcode bereits verwendet oder widerrufen.');
      if (Date.parse(cap.expiresAt) < Date.now()) return fail(410, 'Kontaktcode abgelaufen.');
      if (isGuardianOf(db, cap.childId, sponsorId)) return fail(409, 'Eigene Kinder können nicht gesponsert werden.');
      if (openBetween(db, sponsorId, cap.childId)) return fail(409, 'Zwischen Sponsor und Kind besteht bereits eine offene Begleitung.');
      if (periodEnd && Number.isNaN(Date.parse(periodEnd))) return fail(400, 'Ungültiges Laufzeitende.');
      if (periodEnd && Date.parse(periodEnd) <= Date.now()) return fail(400, 'Das Laufzeitende liegt in der Vergangenheit.');
      const s = {
        id: rid('spn'), sponsorId, childId: cap.childId, status: 'requested', revision: 1,
        purpose: String(purpose || '').slice(0, 300), notes: String(notes || '').slice(0, 500),
        periodStart: iso(Date.now()), periodEnd: periodEnd ? iso(Date.parse(periodEnd)) : null,
        requiredGuardianIds: confirmedGuardians(db, cap.childId),
        activeAccessVersionId: null, capabilityId: cap.id,
        requestedAt: iso(Date.now()), createdAt: iso(Date.now()), updatedAt: iso(Date.now()),
      };
      if (!s.requiredGuardianIds.length) return fail(409, 'Das Kind hat keine bestätigten Erziehungsberechtigten.');
      db.sponsorships.push(s);
      cap.status = 'consumed'; cap.consumedBy = s.id;
      db.sponsorEvents.push({ id: rid('sev'), sponsorshipId: s.id, type: 'request-created', actorId: sponsorId, at: s.requestedAt, prev: null, next: { status: 'requested', revision: 1 }, detail: { purpose: s.purpose, periodEnd: s.periodEnd } });
      notify(db, [...s.requiredGuardianIds, s.childId], 'sponsor-request', s.id, 'Begleitungsanfrage', (person(db, sponsorId)?.name || 'Ein Sponsor') + ' möchte ' + (person(db, s.childId)?.name || 'das Kind') + ' begleiten.');
      return done({ sponsorshipId: s.id, status: 'requested', message: 'Anfrage an die Eltern gesendet.' });
    }, commandPayload || { contactCode, purpose, periodEnd, notes });
  }
  function withdrawRequest(db, { sponsorId, sponsorshipId }) {
    const s = sponsorship(db, sponsorshipId);
    if (!s || s.sponsorId !== sponsorId) return fail(404, 'Begleitung nicht gefunden.');
    if (s.status !== 'requested') return fail(409, 'Nur offene Anfragen können zurückgezogen werden.');
    transition(db, s, 'withdrawn', sponsorId, { reason: 'withdrawn-by-sponsor' });
    return done({ message: 'Anfrage zurückgezogen.' });
  }
  function decideRequest(db, { sponsorId: _ignored, sponsorshipId, guardianId, approve, scope }) {
    const s = sponsorship(db, sponsorshipId);
    if (!s) return fail(404, 'Begleitung nicht gefunden.');
    if (!isGuardianOf(db, s.childId, guardianId)) return fail(403, 'Nur Erziehungsberechtigte entscheiden über die Anfrage.');
    if (s.status !== 'requested') return fail(409, 'Die Anfrage wurde bereits entschieden.');
    if (!approve) {
      transition(db, s, 'rejected', guardianId, { reason: 'declined-by-parent' });
      notify(db, [s.sponsorId, ...familyOf(db, s).filter(x => x !== guardianId)], 'sponsor-rejected', s.id, 'Begleitung abgelehnt', 'Die Anfrage wurde abgelehnt.');
      return done({ status: 'rejected', message: 'Anfrage abgelehnt.' });
    }
    // Die erste Zustimmung fixiert den Umfang. Weitere Eltern stimmen
    // exakt dieser Version zu; abweichende Eingaben ändern sie nicht.
    const scopeV = normalizeScope({ ...DEFAULT_SCOPE(), ...(scope || {}) });
    if (!scopeV) return fail(400, 'Ungültiger Sichtumfang.');
    let av = accessVersion(db, s.requestAccessVersionId);
    if (av && scope && JSON.stringify(av.scope) !== JSON.stringify(scopeV)) return fail(409, 'Die Sicht unterscheidet sich von der bereits vorgelegten Version.');
    if (!av) {
      av = { id: rid('sav'), sponsorshipId: s.id, version: 1, scope: scopeV, status: 'proposed', createdBy: guardianId, createdAt: iso(Date.now()) };
      db.sponsorAccessVersions.push(av);
      s.requestAccessVersionId = av.id;
    }
    const has = id => db.sponsorApprovals.some(a => a.targetType === 'request' && a.targetId === av.id && a.version === av.version && a.actorId === id);
    if (!has(guardianId)) db.sponsorApprovals.push({ targetType: 'request', targetId: av.id, version: av.version, actorId: guardianId, aspect: 'approval', at: iso(Date.now()) });
    const required = confirmedGuardians(db, s.childId);
    if (!required.length) return fail(409, 'Keine bestätigten Erziehungsberechtigten.');
    const missing = required.filter(g => !has(g));
    if (missing.length) return done({ status: 'requested', pendingApprovals: missing, message: 'Zustimmung erfasst — weitere Elternzustimmung ausstehend.' });
    av.status = 'active';
    s.requiredGuardianIds = required;
    s.activeAccessVersionId = av.id;
    transition(db, s, 'active', guardianId, { reason: 'all-parents-approved', accessVersionId: av.id });
    notify(db, [s.sponsorId, s.childId], 'sponsor-activated', s.id, 'Begleitung aktiv', 'Die Begleitung wurde von allen Eltern freigegeben.');
    return done({ status: 'active', sponsorshipId: s.id, message: 'Begleitung aktiviert.' });
  }
  function childDecision(db, { childId, sponsorshipId, accept }) {
    const s = sponsorship(db, sponsorshipId);
    if (!s || s.childId !== childId) return fail(404, 'Begleitung nicht gefunden.');
    if (accept) {
      if (s.status !== 'paused' || s.pausedBy !== childId) return fail(409, 'Nur eine selbst pausierte Begleitung kann das Kind fortsetzen.');
      transition(db, s, 'active', childId, { reason: 'resumed-by-child' });
      notify(db, [...s.requiredGuardianIds, s.sponsorId], 'sponsor-resumed', s.id, 'Begleitung fortgesetzt', 'Das Kind hat die Pause beendet.');
      return done({ status: 'active', message: 'Begleitung fortgesetzt.' });
    }
    if (!['requested', 'active', 'paused'].includes(s.status)) return fail(409, 'Begleitung ist bereits abgeschlossen.');
    transition(db, s, 'rejected', childId, { reason: 'declined-by-child' });
    notify(db, [...s.requiredGuardianIds, s.sponsorId], 'sponsor-declined', s.id, 'Begleitung abgelehnt', 'Das Kind hat die Begleitung abgelehnt.');
    return done({ status: 'rejected', message: 'Begleitung abgelehnt.' });
  }
  function pause(db, { actorId, sponsorshipId }) {
    const s = sponsorship(db, sponsorshipId);
    if (!s) return fail(404, 'Begleitung nicht gefunden.');
    const allowed = actorId === s.childId || actorId === s.sponsorId || isGuardianOf(db, s.childId, actorId);
    if (!allowed) return fail(403, 'Keine Berechtigung für diese Begleitung.');
    if (s.status !== 'active') return fail(409, 'Nur aktive Begleitungen können pausiert werden.');
    transition(db, s, 'paused', actorId, { reason: 'paused-by-' + (actorId === s.childId ? 'child' : actorId === s.sponsorId ? 'sponsor' : 'parent') });
    notify(db, [...familyOf(db, s), s.sponsorId].filter(x => x !== actorId), 'sponsor-paused', s.id, 'Begleitung pausiert', 'Die Begleitung wurde pausiert.');
    return done({ status: 'paused', message: 'Begleitung pausiert — Sponsorzugriff ist sofort gesperrt.' });
  }
  function resume(db, { actorId, sponsorshipId }) {
    const s = sponsorship(db, sponsorshipId);
    if (!s) return fail(404, 'Begleitung nicht gefunden.');
    if (s.status !== 'paused') return fail(409, 'Nur pausierte Begleitungen können fortgesetzt werden.');
    // D2: Vom Kind ausgelöste Pause kann nur das Kind lösen; sonst Eltern.
    if (s.pausedBy === s.childId) {
      if (actorId !== s.childId) return fail(403, 'Nur das Kind kann diese Pause beenden.');
    } else if (!isGuardianOf(db, s.childId, actorId) && !(s.pausedBy === s.sponsorId && actorId === s.sponsorId)) {
      return fail(403, 'Keine Berechtigung zum Fortsetzen.');
    }
    transition(db, s, 'active', actorId, { reason: 'resumed' });
    notify(db, [...familyOf(db, s), s.sponsorId].filter(x => x !== actorId), 'sponsor-resumed', s.id, 'Begleitung fortgesetzt', 'Die Begleitung läuft weiter.');
    return done({ status: 'active', message: 'Begleitung fortgesetzt.' });
  }
  function end(db, { actorId, sponsorshipId, reason }) {
    const s = sponsorship(db, sponsorshipId);
    if (!s) return fail(404, 'Begleitung nicht gefunden.');
    const allowed = actorId === s.childId || actorId === s.sponsorId || isGuardianOf(db, s.childId, actorId);
    if (!allowed) return fail(403, 'Keine Berechtigung für diese Begleitung.');
    expireIfDue(db, s, Date.now());
    if (TERMINAL.has(s.status)) return done({ status: s.status, message: 'Begleitung war bereits abgeschlossen.' });
    transition(db, s, 'ended', actorId, { reason: reason || 'ended' });
    notify(db, [...familyOf(db, s), s.sponsorId].filter(x => x !== actorId), 'sponsor-ended', s.id, 'Begleitung beendet', 'Die Begleitung wurde beendet; der Zugriff ist sofort entzogen.');
    return done({ status: 'ended', message: 'Begleitung beendet — erreichte Ansprüche bleiben bestehen.' });
  }

  // ---- Sichtfreigaben (Access-Versionen) ----
  function proposeAccess(db, { actorId, sponsorshipId, scope }) {
    const s = sponsorship(db, sponsorshipId);
    if (!s) return fail(404, 'Begleitung nicht gefunden.');
    const isParent = isGuardianOf(db, s.childId, actorId);
    if (!isParent && actorId !== s.sponsorId) return fail(403, 'Nur Eltern oder Sponsor dürfen Sichtänderungen vorschlagen.');
    if (!['active', 'paused'].includes(s.status)) return fail(409, 'Keine laufende Begleitung.');
    const clean = normalizeScope(scope);
    if (!clean) return fail(400, 'Ungültiger Sichtumfang.');
    const cur = scopeOf(db, s);
    const nextVersion = (db.sponsorAccessVersions.filter(v => v.sponsorshipId === s.id).reduce((m, v) => Math.max(m, v.version), 0) || 0) + 1;
    // Einschränkung wirkt sofort (D1: jeder Elternteil kann jederzeit begrenzen).
    if (isParent && cur && scopeIsSubset(clean, cur)) {
      for (const v of db.sponsorAccessVersions.filter(v => v.sponsorshipId === s.id && v.status === 'proposed')) v.status = 'revoked';
      for (const v of db.sponsorAccessVersions.filter(v => v.sponsorshipId === s.id && v.status === 'active')) v.status = 'superseded';
      const av = { id: rid('sav'), sponsorshipId: s.id, version: nextVersion, scope: clean, status: 'active', createdBy: actorId, createdAt: iso(Date.now()) };
      db.sponsorAccessVersions.push(av);
      s.activeAccessVersionId = av.id; s.revision += 1;
      db.sponsorEvents.push({ id: rid('sev'), sponsorshipId: s.id, type: 'access-restricted', actorId, at: av.createdAt, prev: { scope: cur }, next: { scope: clean }, detail: { versionId: av.id } });
      notify(db, [s.sponsorId], 'sponsor-access-changed', s.id, 'Sicht eingeschränkt', 'Der sichtbare Umfang wurde reduziert.');
      return done({ status: 'active', accessVersionId: av.id, message: 'Sicht eingeschränkt — sofort wirksam.' });
    }
    // Erweiterung oder Vorschlag des Sponsors → Zustimmung aller Eltern nötig.
    const av = { id: rid('sav'), sponsorshipId: s.id, version: nextVersion, baseAccessVersionId: s.activeAccessVersionId, scope: clean, status: 'proposed', createdBy: actorId, createdAt: iso(Date.now()) };
    db.sponsorAccessVersions.push(av);
    if (isParent) db.sponsorApprovals.push({ targetType: 'access', targetId: av.id, version: nextVersion, actorId, aspect: 'scope', at: av.createdAt });
    db.sponsorEvents.push({ id: rid('sev'), sponsorshipId: s.id, type: 'access-proposed', actorId, at: av.createdAt, prev: { scope: cur }, next: { scope: clean }, detail: { versionId: av.id } });
    notify(db, s.requiredGuardianIds.filter(g => g !== actorId), 'sponsor-access-proposed', s.id, 'Sichterweiterung vorgeschlagen', 'Ein erweiterter Sichtumfang wartet auf Ihre Zustimmung.');
    return done({ status: 'proposed', accessVersionId: av.id, message: 'Sichtänderung vorgeschlagen — Zustimmung der Eltern ausstehend.' });
  }
  function consentAccess(db, { actorId, sponsorshipId, versionId, approve }) {
    const s = sponsorship(db, sponsorshipId);
    if (!s) return fail(404, 'Begleitung nicht gefunden.');
    if (!isGuardianOf(db, s.childId, actorId)) return fail(403, 'Nur Erziehungsberechtigte stimmen über die Sicht ab.');
    if (!['active', 'paused'].includes(s.status)) return fail(409, 'Keine laufende Begleitung.');
    const v = accessVersion(db, versionId);
    if (!v || v.sponsorshipId !== s.id || v.status !== 'proposed') return fail(409, 'Keine offene Sichtfreigabe gefunden.');
    if (v.baseAccessVersionId !== undefined && v.baseAccessVersionId !== s.activeAccessVersionId) return fail(409, 'Die aktive Sicht hat sich geändert. Bitte neuen Vorschlag erstellen.');
    if (approve === false) {
      v.status = 'revoked';
      db.sponsorEvents.push({ id: rid('sev'), sponsorshipId: s.id, type: 'access-declined', actorId, at: iso(Date.now()), prev: null, next: null, detail: { versionId: v.id } });
      notify(db, [s.sponsorId], 'sponsor-access-declined', s.id, 'Sichterweiterung abgelehnt', 'Der Vorschlag wurde abgelehnt.');
      return done({ status: 'revoked', message: 'Sichtänderung abgelehnt — bisherige Sicht bleibt.' });
    }
    const has = id => db.sponsorApprovals.some(a => a.targetType === 'access' && a.targetId === v.id && a.version === v.version && a.actorId === id);
    if (!has(actorId)) db.sponsorApprovals.push({ targetType: 'access', targetId: v.id, version: v.version, actorId, aspect: 'scope', at: iso(Date.now()) });
    const missing = accessQuorum(db, s, v).map(m => m.actorId);
    if (missing.length) return done({ status: 'proposed', pendingApprovals: missing, message: 'Zustimmung erfasst — weitere Elternzustimmung ausstehend.' });
    for (const x of db.sponsorAccessVersions.filter(x => x.sponsorshipId === s.id && x.status === 'active')) x.status = 'superseded';
    v.status = 'active';
    s.activeAccessVersionId = v.id; s.revision += 1;
    db.sponsorEvents.push({ id: rid('sev'), sponsorshipId: s.id, type: 'access-activated', actorId, at: iso(Date.now()), prev: null, next: { scope: v.scope }, detail: { versionId: v.id } });
    notify(db, [s.sponsorId], 'sponsor-access-changed', s.id, 'Sicht erweitert', 'Der neue Sichtumfang ist wirksam.');
    return done({ status: 'active', message: 'Neue Sicht wirksam.' });
  }

  // ---- Vereinbarungen ----
  function proposeAgreement(db, { actorId, sponsorshipId, terms, proposalId }) {
    const s = sponsorship(db, sponsorshipId);
    if (!s) return fail(404, 'Begleitung nicht gefunden.');
    const isParent = isGuardianOf(db, s.childId, actorId);
    if (!isParent && actorId !== s.sponsorId && actorId !== s.childId) return fail(403, 'Keine Berechtigung für Vereinbarungsvorschläge.');
    if (!['active', 'paused'].includes(s.status)) return fail(409, 'Vereinbarungen brauchen eine laufende Begleitung.');
    const invalid = validateTerms(db, terms);
    if (invalid) return fail(400, invalid);
    return withReceipt(db, proposalId ? 'agreement:' + actorId + ':' + s.id + ':' + proposalId : null, () => {
      let a = agreementsOf(db, s.id).find(x => !x.closedAt);
      if (!a) { a = { id: rid('sag'), sponsorshipId: s.id, activeVersion: 0, createdAt: iso(Date.now()) }; db.sponsorAgreements.push(a); }
      const version = db.sponsorAgreementVersions.filter(v => v.agreementId === a.id).reduce((m, v) => Math.max(m, v.version), 0) + 1;
      const clean = {
        metricKeys: terms.metricKeys.map(String),
        pointsTarget: terms.pointsTarget,
        from: terms.from ? iso(Date.parse(terms.from)) : s.periodStart,
        until: terms.until ? iso(Date.parse(terms.until)) : s.periodEnd,
        rewardText: terms.rewardText.trim(),
        consumePoints: terms.consumePoints === true,
        carryOver: terms.carryOver === 'carry' ? 'carry' : 'none',
        validUntil: terms.validUntil ? iso(Date.parse(terms.validUntil)) : null,
      };
      const v = { agreementId: a.id, version, baseVersion: a.activeVersion, status: 'proposed', terms: clean, proposedBy: actorId, createdAt: iso(Date.now()), activatedAt: null };
      db.sponsorAgreementVersions.push(v);
      // Der Vorschlagende stimmt seiner eigenen Version bereits zu.
      const aspect = 'terms';
      if (isParent) db.sponsorApprovals.push({ targetType: 'agreement', targetId: a.id, version, actorId, aspect, at: v.createdAt });
      if (actorId === s.sponsorId) db.sponsorApprovals.push({ targetType: 'agreement', targetId: a.id, version, actorId, aspect, at: v.createdAt });
      db.sponsorEvents.push({ id: rid('sev'), sponsorshipId: s.id, type: 'agreement-proposed', actorId, at: v.createdAt, prev: null, next: { version, terms: clean }, detail: { agreementId: a.id } });
      const pending = s.requiredGuardianIds.filter(g => g !== actorId);
      notify(db, [...pending, ...(actorId === s.sponsorId ? [] : [s.sponsorId])], 'sponsor-agreement-proposed', s.id, 'Vereinbarung vorgeschlagen', 'Eine Belohnungsvereinbarung wartet auf Zustimmung.');
      return done({ agreementId: a.id, version, status: 'proposed', message: 'Vereinbarung vorgeschlagen — sie wird erst wirksam, wenn alle zustimmen.' });
    }, terms);
  }
  // Zustimmung an konkrete Version gebunden; bei Quorum sofortige Aktivierung.
  // Gibt {activate:true} zurück, damit der Aufrufer die Folgeauswertung
  // (Anspruchsprüfung) noch im selben Commit auslösen kann.
  function consentAgreement(db, { actorId, agreementId, version, approve }) {
    const a = agreement(db, agreementId);
    if (!a) return fail(404, 'Vereinbarung nicht gefunden.');
    const s = sponsorship(db, a.sponsorshipId);
    if (!s || !['active', 'paused'].includes(s.status)) return fail(409, 'Keine laufende Begleitung.');
    const isParent = s && isGuardianOf(db, s.childId, actorId);
    if (!isParent && actorId !== s.sponsorId) return fail(403, 'Nur Eltern und Sponsor stimmen der Vereinbarung zu.');
    const v = versionOf(db, agreementId, version);
    if (!v || v.status !== 'proposed') return fail(409, 'Diese Version ist nicht mehr offen.');
    if (v.baseVersion !== undefined && v.baseVersion !== a.activeVersion) return fail(409, 'Die aktive Vereinbarung hat sich geändert. Bitte neuen Vorschlag erstellen.');
    if (approve === false) {
      if (!isParent) return fail(403, 'Nur Erziehungsberechtigte lehnen Vereinbarungen ab.');
      v.status = 'rejected';
      db.sponsorEvents.push({ id: rid('sev'), sponsorshipId: s.id, type: 'agreement-rejected', actorId, at: iso(Date.now()), prev: null, next: { version }, detail: { agreementId } });
      notify(db, [s.sponsorId, s.childId], 'sponsor-agreement-rejected', s.id, 'Vereinbarung abgelehnt', 'Der Vorschlag wurde abgelehnt.');
      return done({ status: 'rejected', message: 'Vereinbarung abgelehnt — die bisherige Fassung gilt weiter.' });
    }
    const has = (id, aspect) => db.sponsorApprovals.some(x => x.targetType === 'agreement' && x.targetId === agreementId && x.version === version && x.actorId === id && x.aspect === aspect);
    if (!has(actorId, 'terms')) db.sponsorApprovals.push({ targetType: 'agreement', targetId: agreementId, version, actorId, aspect: 'terms', at: iso(Date.now()) });
    const missing = agreementQuorum(db, s, v);
    if (missing.length) return done({ status: 'proposed', pendingApprovals: missing, message: 'Zustimmung erfasst — ausstehend: ' + missing.length + ' Partei(en).' });
    // Vor dem Versionswechsel bereits erreichte Ansprüche sichern.
    performance.evaluateSponsorship(db, s, { notify });
    for (const x of db.sponsorAgreementVersions.filter(x => x.agreementId === agreementId && x.status === 'active')) x.status = 'superseded';
    v.status = 'active'; v.activatedAt = iso(Date.now());
    v.countingFrom = version > 1 && v.terms.carryOver !== 'carry' ? v.activatedAt : v.terms.from;
    a.activeVersion = version;
    db.sponsorEvents.push({ id: rid('sev'), sponsorshipId: s.id, type: 'agreement-activated', actorId, at: v.activatedAt, prev: null, next: { version, terms: v.terms }, detail: { agreementId } });
    notify(db, [s.childId, s.sponsorId, ...s.requiredGuardianIds.filter(g => g !== actorId)], 'sponsor-agreement-active', s.id, 'Vereinbarung aktiv', 'Die Belohnungsvereinbarung ist jetzt wirksam.');
    return done({ status: 'active', activate: true, agreementId, version, message: 'Vereinbarung wirksam.' });
  }
  function diffAgreement(db, { actorId, agreementId, version }) {
    const a = agreement(db, agreementId);
    if (!a) return fail(404, 'Vereinbarung nicht gefunden.');
    if (!canReadRelationship(db, sponsorship(db, a.sponsorshipId), actorId)) return fail(403, 'Keine Berechtigung für diese Vereinbarung.');
    const v = versionOf(db, agreementId, version);
    if (!v) return fail(404, 'Version nicht gefunden.');
    const cur = activeVersionOf(db, a);
    const fields = ['metricKeys', 'pointsTarget', 'from', 'until', 'rewardText', 'consumePoints', 'carryOver', 'validUntil'];
    const changed = fields.filter(f => JSON.stringify(v.terms[f]) !== JSON.stringify(cur?.terms?.[f]))
      .map(f => ({ field: f, from: cur?.terms?.[f] ?? null, to: v.terms[f] }));
    return done({ agreementId, version, baseVersion: cur?.version || 0, changed });
  }

  // ---- Sichten ----
  function listForSponsor(db, { sponsorId }) {
    const now = Date.now();
    const items = db.sponsorships.filter(x => x.sponsorId === sponsorId).map(s => ({
      ...sponsorDto(db, s, 'sponsor'),
      canView: sponsorCanView(db, s, sponsorId, now),
      scope: sponsorCanView(db, s, sponsorId, now) ? scopeOf(db, s) : null,
    }));
    return done({ items });
  }
  function listForParent(db, { actorId, childId, sponsorshipId }) {
    if (!isGuardianOf(db, childId, actorId)) return fail(403, 'Nur Erziehungsberechtigte sehen Begleitungen.');
    let rows = db.sponsorships.filter(s => s.childId === childId);
    if (sponsorshipId) rows = rows.filter(s => s.id === sponsorshipId);
    return done({
      items: rows.map(s => ({
        ...sponsorDto(db, s, 'parent'),
        sponsorName: person(db, s.sponsorId)?.name,
        scope: scopeOf(db, s),
        requestScope: accessVersion(db, s.requestAccessVersionId)?.scope || null,
        pendingAccess: db.sponsorAccessVersions.filter(v => v.sponsorshipId === s.id && v.status === 'proposed').map(v => ({ id: v.id, version: v.version, scope: v.scope, createdBy: v.createdBy })),
        agreements: agreementsOf(db, s.id).map(a => agreementDto(db, a)),
      })),
      capabilities: listContactCodes(db, { actorId, childId }).items,
    });
  }
  function listForChild(db, { childId }) {
    return done({
      items: db.sponsorships.filter(s => s.childId === childId && s.status !== 'withdrawn').map(s => ({
        ...sponsorDto(db, s, 'child'),
        sponsorName: person(db, s.sponsorId)?.name,
        scope: scopeOf(db, s),
      })),
    });
  }
  function history(db, { actorId, sponsorshipId }) {
    const s = sponsorship(db, sponsorshipId);
    if (!s) return fail(404, 'Begleitung nicht gefunden.');
    const role = actorId === s.sponsorId ? 'sponsor' : actorId === s.childId ? 'child' : isGuardianOf(db, s.childId, actorId) ? 'parent' : null;
    if (!role) return fail(403, 'Keine Berechtigung für diese Historie.');
    if (role === 'sponsor' && !sponsorCanView(db, s, actorId)) return fail(403, 'Kein Zugriff — Begleitung ist nicht aktiv.');
    // Sponsor sieht die Historie nur zu eigenen Begleitungen und nur bis zum
    // Beendigungszeitpunkt (danach ist die Familienhistorie nicht mehr seiner).
    let events = db.sponsorEvents.filter(e => e.sponsorshipId === s.id || (e.sponsorshipId === null && role === 'parent' && e.detail?.childId === s.childId));
    if (role === 'sponsor' && s.endedAt) events = events.filter(e => e.at <= s.endedAt);
    const name = id => person(db, id)?.name || id;
    return done({
      items: events.sort((a, b) => a.at.localeCompare(b.at)).map(e => ({
        id: e.id, type: e.type, actor: name(e.actorId), at: e.at, prev: e.prev, next: e.next, detail: e.detail,
      })),
    });
  }
  function progress(db, { actorId, sponsorshipId }) {
    const s = sponsorship(db, sponsorshipId);
    if (!s) return fail(404, 'Begleitung nicht gefunden.');
    const role = actorId === s.sponsorId ? 'sponsor' : actorId === s.childId ? 'child' : isGuardianOf(db, s.childId, actorId) ? 'parent' : null;
    if (!role) return fail(403, 'Keine Berechtigung.');
    if (role === 'sponsor' && !sponsorCanView(db, s, actorId)) return fail(403, 'Kein Zugriff — Begleitung ist nicht aktiv.');
    const scope = scopeOf(db, s) || DEFAULT_SCOPE();
    const windowStart = Date.now() - (scope.windowDays || 90) * 86400000;
    const keys = new Set(db.performanceRuleVersions.filter(r => scope.subjects.includes(r.subjectKey) && (!scope.activities.length || scope.activities.includes(r.activityKey))).map(r => r.subjectKey + '.' + r.activityKey));
    const entries = db.performanceLedger.filter(e => e.childId === s.childId && (e.verification === 'guardian-confirmed' || (e.verification === 'verified' && e.provenance === 'server')) && keys.has(e.metricKey) && Date.parse(e.occurredAt) >= windowStart && Date.parse(e.occurredAt) <= Date.now());
    const total = entries.reduce((a, e) => a + (e.reversalOf ? -(e.points || 0) : (e.points || 0)), 0);
    const byMetric = {};
    for (const e of entries) { const k = e.metricKey; byMetric[k] = byMetric[k] || { metricKey: k, points: 0, count: 0 }; byMetric[k].points += e.reversalOf ? -(e.points || 0) : (e.points || 0); byMetric[k].count += 1; }
    // Detailgrad: 'points' zeigt Summen; 'aggregates' zusätzlich Anzahl
    // je Leistungsart; Einzelantworten/Fehler/Inhalte gibt es nie.
    const dto = { totalPoints: total, windowDays: scope.windowDays, metrics: Object.values(byMetric), scope };
    if (detailRank(scope.detailLevel) < detailRank('aggregates')) dto.metrics = dto.metrics.map(m => ({ metricKey: m.metricKey, points: m.points }));
    const ag = agreementsOf(db, s.id).find(a => a.activeVersion);
    const av = ag && activeVersionOf(db, ag);
    if (av) {
      const { points } = performance.countedPoints(db, s, { ...av.terms, from: av.countingFrom || av.terms.from });
      dto.agreement = { agreementId: ag.id, version: av.version, pointsTarget: av.terms.pointsTarget, countedPoints: points, reached: points >= av.terms.pointsTarget };
    }
    const claims = db.rewardClaims.filter(c => c.sponsorshipId === s.id);
    dto.claims = claims.map(c => ({ entitlementKey: c.entitlementKey, status: c.status, rewardText: c.snapshot?.rewardText, agreementVersion: c.agreementVersion }));
    return done(dto);
  }
  // Sponsor-Pflichten: aktive und nach Ende noch offene Erfüllungen.
  function obligations(db, { sponsorId }) {
    const items = db.rewardClaims.filter(c => c.sponsorId === sponsorId && ['released', 'fulfilled'].includes(c.status))
      .map(c => ({
        entitlementKey: c.entitlementKey, status: c.status, rewardText: c.snapshot?.rewardText,
        sponsorshipId: c.sponsorshipId, childName: person(db, c.childId)?.name,
        fulfillmentReportedAt: c.fulfillmentReportedAt || null, fulfilledAt: c.fulfilledAt || null,
      }));
    return done({ items });
  }
  // Strukturierte Kommentare statt freiem Chat: gebunden an Begleitung/
  // Vereinbarung/Anspruch und immer für die gesamte Familie sichtbar.
  function sendMessage(db, { actorId, sponsorshipId, targetType, targetId, text }) {
    const s = sponsorship(db, sponsorshipId);
    if (!s) return fail(404, 'Begleitung nicht gefunden.');
    const allowed = actorId === s.sponsorId || actorId === s.childId || isGuardianOf(db, s.childId, actorId);
    if (!allowed) return fail(403, 'Keine Berechtigung.');
    if (actorId === s.sponsorId && !sponsorCanView(db, s, actorId)) return fail(403, 'Kein Kontakt — Begleitung ist nicht aktiv.');
    if (!['sponsorship', 'agreement', 'claim'].includes(targetType)) return fail(400, 'Unzulässiger Nachrichtenbezug.');
    if (!['active', 'paused', 'ended'].includes(s.status)) return fail(409, 'Nachrichten nur zu bestehenden Begleitungen.');
    if (actorId === s.childId && s.status === 'ended') return fail(409, 'Diese Begleitung ist beendet.');
    if (targetType === 'agreement' && !agreementsOf(db, s.id).some(a => a.id === targetId)) return fail(400, 'Vereinbarung gehört nicht zu dieser Begleitung.');
    if (targetType === 'claim' && !db.rewardClaims.some(c => c.sponsorshipId === s.id && c.entitlementKey === targetId)) return fail(400, 'Anspruch gehört nicht zu dieser Begleitung.');
    const body = String(text || '').trim();
    if (body.length < 1 || body.length > 1000) return fail(400, 'Nachricht zu lang oder leer (max. 1000 Zeichen).');
    const m = { id: rid('msg'), sponsorshipId: s.id, targetType, targetId: String(targetId || ''), authorId: actorId, authorRole: actorId === s.sponsorId ? 'sponsor' : actorId === s.childId ? 'child' : 'parent', text: body, at: iso(Date.now()) };
    db.sponsorMessages.push(m);
    db.sponsorEvents.push({ id: rid('sev'), sponsorshipId: s.id, type: 'message-sent', actorId, at: m.at, prev: null, next: null, detail: { messageId: m.id, targetType: m.targetType, targetId: m.targetId } });
    notify(db, [...familyOf(db, s), s.sponsorId].filter(x => x !== actorId), 'sponsor-message', s.id, 'Neue Nachricht', 'Es gibt eine neue Mitteilung zur Begleitung.');
    return done({ messageId: m.id, message: 'Nachricht gesendet.' });
  }
  function listMessages(db, { actorId, sponsorshipId }) {
    const s = sponsorship(db, sponsorshipId);
    if (!s) return fail(404, 'Begleitung nicht gefunden.');
    const allowed = actorId === s.sponsorId || actorId === s.childId || isGuardianOf(db, s.childId, actorId);
    if (!allowed) return fail(403, 'Keine Berechtigung.');
    if (actorId === s.sponsorId && !sponsorCanView(db, s, actorId)) {
      // Nach Beendigung keine Familienkommunikation mehr sichtbar.
      return done({ items: [] });
    }
    return done({
      items: db.sponsorMessages.filter(m => m.sponsorshipId === s.id).sort((a, b) => a.at.localeCompare(b.at))
        .map(m => ({ id: m.id, targetType: m.targetType, targetId: m.targetId, author: person(db, m.authorId)?.name || m.authorId, authorRole: m.authorRole, text: m.text, at: m.at })),
    });
  }
  function notificationsFor(db, { personId }) {
    return done({
      items: db.notifications.filter(n => n.recipientPersonId === personId).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
        .map(n => ({ id: n.id, type: n.type, ref: n.ref, title: n.title, body: n.body, createdAt: n.createdAt, readAt: n.readAt })),
    });
  }
  function markNotificationRead(db, { personId, notificationId }) {
    const n = db.notifications.find(x => x.id === notificationId && x.recipientPersonId === personId);
    if (!n) return fail(404, 'Benachrichtigung nicht gefunden.');
    if (!n.readAt) n.readAt = iso(Date.now());
    return done({ message: 'Gelesen.' });
  }

  return {
    createContactCode, listContactCodes, revokeContactCode,
    createRequest, withdrawRequest, decideRequest, childDecision, pause, resume, end,
    proposeAccess, consentAccess,
    proposeAgreement, consentAgreement, diffAgreement,
    listForSponsor, listForParent, listForChild, history, progress, obligations,
    sendMessage, listMessages, notificationsFor, markNotificationRead,
    // interne Helfer für andere Fachmodule/Komponenten
    _i: { isSponsor, isGuardianOf, confirmedGuardians, sponsorCanView, canReadRelationship, scopeOf, sponsorship, agreement, agreementsOf, activeVersionOf, transition, notify, expireIfDue, sponsorDto, TERMINAL },
  };
}

module.exports = { createSponsor };

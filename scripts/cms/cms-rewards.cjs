// Belohnungsansprüche (v8): Zustandsautomat für rewardClaims +
// optionales Punktekonto (rewardPointEntries) bei consumePoints-Vereinbarungen.
// Zustände: earned -> requested -> released -> fulfilled; cancelled = storniert.
// Genau ein Anspruch je entitlementKey (validate() erzwingt Eindeutigkeit).
// Ansprüche überleben Beendigung und Versionswechsel (Anspruchserhalt).
const crypto = require('node:crypto');
const rid = p => p + '-' + crypto.randomBytes(6).toString('hex');
const iso = t => new Date(t).toISOString();

const claimOf = (db, key) => db.rewardClaims.find(c => c.entitlementKey === key);
const person = (db, id) => db.people.find(p => p.id === id);
const fail = (status, message) => ({ ok: false, status, message });
const done = (x = {}) => ({ ok: true, ...x });

// Punktekonto: reserve beim Einlösewunsch, release bei Ablehnung/Storno,
// consume bei bestätigter Erfüllung. Guthaben wird aus dem geprüften
// Leistungsledger berechnet; das Buchungsjournal protokolliert nur Einlösungen.
function addEntry(db, s, type, points, ref) {
  db.rewardPointEntries.push({ id: rid('rpe'), sponsorshipId: s.id, type, points, ref, at: iso(Date.now()) });
}

function event(db, s, type, actorId, detail) {
  db.sponsorEvents.push({ id: rid('sev'), sponsorshipId: s.id, type, actorId, at: iso(Date.now()), prev: null, next: null, detail });
}

function createRewards(sponsorMod, perf) {
  const I = sponsorMod._i;
  function balance(db, sponsorshipId, terms) {
    const s = I.sponsorship(db, sponsorshipId);
    if (!s) return 0;
    const version = I.activeVersionOf(db, I.agreementsOf(db, s.id).find(a => a.activeVersion));
    const effective = terms || (version && { ...version.terms, from: version.countingFrom || version.terms.from });
    if (!effective) return 0;
    const { points } = perf.countedPoints(db, s, effective);
    const reserved = db.rewardClaims.filter(c => c.sponsorshipId === s.id && ['requested', 'released'].includes(c.status)).reduce((sum, c) => sum + (c.reservedPoints || 0), 0);
    return Math.round((points - reserved) * 1000) / 1000;
  }

  // Einlösewunsch des Kindes (oder Elternanstoß). Bei consumePoints-
  // Vereinbarungen werden die Punkte reserviert (nicht doppelt ausgebbar).
  function requestRedemption(db, { actorId, claimKey, requestId }) {
    const c = claimOf(db, claimKey);
    if (!c) return fail(404, 'Anspruch nicht gefunden.');
    const s = I.sponsorship(db, c.sponsorshipId);
    if (actorId !== c.childId && !I.isGuardianOf(db, c.childId, actorId)) return fail(403, 'Nur das Kind oder die Eltern lösen ein.');
    if (['requested', 'released'].includes(c.status)) return done({ status: c.status, reused: true, message: 'Einlösewunsch bereits erfasst.' });
    if (c.status !== 'earned') return fail(409, 'Der Anspruch ist im Zustand "' + c.status + '" — kein Einlösewunsch möglich.');
    if (c.snapshot?.consumePoints) {
      const pts = c.snapshot.pointsTarget;
      if (balance(db, s.id, c.snapshot) < pts) return fail(409, 'Punktekonto reicht nicht für die Reservierung.');
      addEntry(db, s, 'reserve', pts, claimKey);
      c.reservedPoints = pts;
    }
    c.status = 'requested'; c.requestedAt = iso(Date.now());
    event(db, s, 'claim-requested', actorId, { entitlementKey: claimKey });
    I.notify(db, s.requiredGuardianIds, 'sponsor-claim-requested', s.id, 'Einlösung angefragt', (person(db, c.childId)?.name || 'Das Kind') + ' möchte die Belohnung einlösen.');
    return done({ status: 'requested', message: 'Einlösewunsch an die Eltern gesendet.' });
  }

  // Elterliche Entscheidung über eine Einlösung (Freigabe oder Zurückweisung).
  function guardianDecision(db, { actorId, claimKey, approve, reason }) {
    const c = claimOf(db, claimKey);
    if (!c) return fail(404, 'Anspruch nicht gefunden.');
    const s = I.sponsorship(db, c.sponsorshipId);
    if (!I.isGuardianOf(db, c.childId, actorId)) return fail(403, 'Nur Erziehungsberechtigte entscheiden über die Einlösung.');
    if (c.status !== 'requested') return fail(409, 'Es liegt kein offener Einlösewunsch vor (Zustand "' + c.status + '").');
    if (approve) {
      c.status = 'released'; c.releasedAt = iso(Date.now()); c.releasedBy = actorId;
      event(db, s, 'claim-released', actorId, { entitlementKey: claimKey });
      I.notify(db, [c.childId, c.sponsorId, ...s.requiredGuardianIds.filter(g => g !== actorId)], 'sponsor-claim-released', s.id, 'Belohnung freigegeben', 'Die Einlösung wurde freigegeben — Erfüllung durch den Sponsor.');
      return done({ status: 'released', message: 'Einlösung freigegeben.' });
    }
    // Zurückweisung: Anspruch bleibt bestehen, Reservierung wird gelöst.
    c.status = 'earned'; c.requestedAt = null;
    if (c.reservedPoints) { addEntry(db, s, 'release', c.reservedPoints, claimKey); c.reservedPoints = 0; }
    event(db, s, 'claim-request-declined', actorId, { entitlementKey: claimKey, reason: String(reason || '').slice(0, 300) });
    I.notify(db, [c.childId], 'sponsor-claim-declined', s.id, 'Einlösung zurückgewiesen', 'Der Einlösewunsch wurde zurückgewiesen — der Anspruch bleibt bestehen.');
    return done({ status: 'earned', message: 'Einlösewunsch zurückgewiesen.' });
  }

  // Storno eines Anspruchs durch die Eltern (mit Grund; Anspruch entfällt
  // nicht stillschweigend — der Vorgang ist in der Historie sichtbar).
  function cancelClaim(db, { actorId, claimKey, reason }) {
    const c = claimOf(db, claimKey);
    if (!c) return fail(404, 'Anspruch nicht gefunden.');
    const s = I.sponsorship(db, c.sponsorshipId);
    if (!I.isGuardianOf(db, c.childId, actorId)) return fail(403, 'Nur Erziehungsberechtigte stornieren Ansprüche.');
    if (['fulfilled', 'cancelled'].includes(c.status)) return fail(409, 'Der Anspruch ist bereits abgeschlossen.');
    if (typeof reason !== 'string' || !reason.trim()) return fail(400, 'Eine Begründung ist erforderlich.');
    c.status = 'cancelled'; c.cancelledAt = iso(Date.now()); c.cancelReason = String(reason || '').slice(0, 300);
    if (c.reservedPoints) { addEntry(db, s, 'release', c.reservedPoints, claimKey); c.reservedPoints = 0; }
    event(db, s, 'claim-cancelled', actorId, { entitlementKey: claimKey, reason: c.cancelReason });
    I.notify(db, [c.childId, c.sponsorId], 'sponsor-claim-cancelled', s.id, 'Anspruch storniert', 'Der Anspruch wurde mit Begründung storniert.');
    return done({ status: 'cancelled', message: 'Anspruch storniert.' });
  }

  // Sponsor meldet die Erfüllung (nachvollziehbar, ändert den Anspruch
  // noch nicht — erst die elterliche Bestätigung schließt ihn ab).
  function fulfillmentReport(db, { actorId, claimKey, note }) {
    const c = claimOf(db, claimKey);
    if (!c) return fail(404, 'Anspruch nicht gefunden.');
    const s = I.sponsorship(db, c.sponsorshipId);
    if (actorId !== c.sponsorId || s.sponsorId !== actorId) return fail(403, 'Nur der Sponsor dieser Begleitung meldet die Erfüllung.');
    if (!['released', 'fulfilled'].includes(c.status)) return fail(409, 'Erfüllung erst nach Freigabe durch die Eltern.');
    if (c.fulfillmentReportedAt) return done({ status: c.status, reused: true, message: 'Erfüllung bereits gemeldet.' });
    c.fulfillmentReportedAt = iso(Date.now()); c.fulfillmentNote = String(note || '').slice(0, 300);
    event(db, s, 'claim-fulfillment-reported', actorId, { entitlementKey: claimKey, note: c.fulfillmentNote });
    I.notify(db, [...s.requiredGuardianIds, c.childId], 'sponsor-fulfillment-reported', s.id, 'Erfüllung gemeldet', 'Der Sponsor hat die Belohnung als erfüllt gemeldet — Bestätigung prüfen.');
    return done({ status: c.status, message: 'Erfüllung gemeldet — elterliche Bestätigung ausstehend.' });
  }

  // Elterliche Bestätigung der Erfüllung — genau einmal; bei consumePoints
  // wird die Reservierung verbraucht. Danach ist der Anspruch abgeschlossen.
  function confirmFulfillment(db, { actorId, claimKey }) {
    const c = claimOf(db, claimKey);
    if (!c) return fail(404, 'Anspruch nicht gefunden.');
    const s = I.sponsorship(db, c.sponsorshipId);
    if (!I.isGuardianOf(db, c.childId, actorId)) return fail(403, 'Nur Erziehungsberechtigte bestätigen die Erfüllung.');
    if (c.status === 'fulfilled') return done({ status: 'fulfilled', reused: true, message: 'Bereits bestätigt.' });
    if (c.status !== 'released') return fail(409, 'Die Belohnung ist nicht freigegeben (Zustand "' + c.status + '").');
    if (!c.fulfillmentReportedAt) return fail(409, 'Der Sponsor hat die Erfüllung noch nicht gemeldet.');
    c.status = 'fulfilled'; c.fulfilledAt = iso(Date.now()); c.fulfilledBy = actorId;
    if (c.reservedPoints) { addEntry(db, s, 'release', c.reservedPoints, claimKey); addEntry(db, s, 'consume', c.reservedPoints, claimKey); c.consumedPoints = c.reservedPoints; c.reservedPoints = 0; }
    event(db, s, 'claim-fulfilled', actorId, { entitlementKey: claimKey });
    I.notify(db, [c.childId, c.sponsorId, ...s.requiredGuardianIds.filter(g => g !== actorId)], 'sponsor-claim-fulfilled', s.id, 'Belohnung erfüllt', 'Die Erfüllung wurde bestätigt.');
    return done({ status: 'fulfilled', message: 'Erfüllung bestätigt.' });
  }

  // Nach Beendigung: Grenz-Auswertung (Ansprüche bis zum Endzeitpunkt),
  // offene Einlösewünsche bleiben entscheidbar — kein Anspruch verfällt.
  function finalizeOnEnd(db, s) {
    const t = s.endedAt ? Date.parse(s.endedAt) : Date.now();
    return perf.evaluateSponsorship(db, s, { until: t, notify: I.notify });
  }

  function listFor(db, { actorId, sponsorshipId, role }) {
    const s = I.sponsorship(db, sponsorshipId);
    if (!s) return fail(404, 'Begleitung nicht gefunden.');
    if (!I.canReadRelationship(db, s, actorId)) return fail(403, 'Keine Berechtigung für diese Belohnungen.');
    const claims = db.rewardClaims.filter(c => c.sponsorshipId === s.id).map(c => ({
      id: c.entitlementKey, entitlementKey: c.entitlementKey, status: c.status, rewardText: c.snapshot?.rewardText,
      pointsTarget: c.snapshot?.pointsTarget, agreementVersion: c.agreementVersion,
      createdAt: c.createdAt, requestedAt: c.requestedAt, releasedAt: c.releasedAt,
      fulfillmentReportedAt: c.fulfillmentReportedAt, fulfilledAt: c.fulfilledAt,
      cancelledAt: c.cancelledAt, cancelReason: c.cancelReason,
    }));
    return done({ items: claims, pointBalance: balance(db, s.id) });
  }

  return { requestRedemption, guardianDecision, cancelClaim, fulfillmentReport, confirmFulfillment, finalizeOnEnd, listFor, balance };
}

module.exports = { createRewards };

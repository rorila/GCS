// Geprüfte Leistungspunkte (v8): nur Einträge im performanceLedger zählen
// für Belohnungen. Rohmeldungen aus progress sind KEINE Leistungspunkte —
// sie werden erst zu 'verified'-Einträgen, wenn eine veröffentlichte
// Regelversion (gameId+metric+Wertebereich+Vertrauensklasse) sie deckt.
// Eltern können zusätzlich 'guardian-confirmed'-Einträge anerkennen.
// Das Ledger ist append-only; Korrekturen sind Gegenbuchungen (reversalOf).
const crypto = require('node:crypto');
const rid = p => p + '-' + crypto.randomBytes(6).toString('hex');
const iso = t => new Date(t).toISOString();

const metricKeyOf = r => r.subjectKey + '.' + r.activityKey;
const publishedRules = db => db.performanceRuleVersions.filter(r => r.status === 'published');
const ruleByKey = (db, key) => publishedRules(db).find(r => metricKeyOf(r) === key);

// Serverseitige Prüfung einer gemeldeten Leistung gegen eine Regelversion:
// endlicher Wert, deklarierte Einheit, Wertebereich und bekannte Metrik.
// Verletzte Regeln erzeugen keinen Eintrag (und damit nie Ansprüche).
function verifyAgainstRule(row, rule) {
  if (!rule) return false;
  if (!Number.isFinite(row.value)) return false;
  if (rule.metric !== row.metric) return false;
  if (rule.gameId && rule.gameId !== row.gameId) return false;
  if (rule.unit && rule.unit !== row.unit) return false;
  if (rule.minValue != null && row.value < rule.minValue) return false;
  if (rule.maxValue != null && row.value > rule.maxValue) return false;
  return true;
}

// Nimmt eine progress-Meldung in dasselbe Commit auf: geprüfte Ledger-
// Einträge je passender Regelversion. Dedup über fachlichen Schlüssel
// (Quell-Ereignis + Regel), damit Doppelmeldungen nicht doppelt zählen.
function ingestProgress(db, row) {
  const added = [];
  for (const rule of publishedRules(db)) {
    if (rule.trustClass !== 'server-checked') continue;
    if (!verifyAgainstRule(row, rule)) continue;
    const eventId = 'led-' + row.eventId + ':' + rule.id;
    if (db.performanceLedger.some(e => e.eventId === eventId)) continue;
    const entry = {
      eventId, childId: row.childId, metricKey: metricKeyOf(rule), ruleVersionId: rule.id,
      points: Math.round((row.value * (rule.pointsPerUnit || 0)) * 1000) / 1000,
      value: row.value, unit: row.unit, sourceEventId: row.eventId,
      occurredAt: row.reportedAt || iso(Date.now()), recordedAt: iso(Date.now()),
      // Ein deklarierter Wertebereich ist kein Leistungsnachweis.
      // Nur intern erzeugte Servermeldungen sind automatisch anrechenbar.
      verification: row.source === 'server' ? 'verified' : 'reported', provenance: row.source === 'server' ? 'server' : 'reported',
      reversalOf: null,
    };
    db.performanceLedger.push(entry);
    added.push(entry);
  }
  return added;
}

// Elterliche Anerkennung (trustClass 'guardian-confirmed' bzw. explizite
// Anerkennung eines berichteten Ereignisses): erzeugt einen Eintrag, der
// zählt wie ein verifizierter — mit klarer Provenienz.
function recognize(db, { childId, actorId, metricKey, value, unit, occurredAt, progressEventId, note }) {
  const source = progressEventId && db.progress.find(e => e.eventId === progressEventId && e.childId === childId);
  const rule = source ? publishedRules(db).find(r => metricKeyOf(r) === metricKey && verifyAgainstRule(source, r)) : ruleByKey(db, metricKey);
  if (!rule) return { ok: false, status: 400, message: 'Unbekannte Leistungsart: ' + metricKey };
  if (unit && unit !== rule.unit) return { ok: false, status: 400, message: 'Einheit stimmt nicht mit der Leistungsregel überein.' };
  if (occurredAt && (Number.isNaN(Date.parse(occurredAt)) || Date.parse(occurredAt) > Date.now())) return { ok: false, status: 400, message: 'Ungültiger Leistungszeitpunkt.' };
  if (progressEventId && (!source || !verifyAgainstRule(source, rule) || source.value !== value)) return { ok: false, status: 400, message: 'Quellereignis gehört nicht zu dieser Leistung.' };
  if (!Number.isFinite(value) || value < (rule.minValue ?? -Infinity) || value > (rule.maxValue ?? Infinity)) {
    return { ok: false, status: 400, message: 'Wert außerhalb des Regelbereichs (' + (rule.minValue ?? '−∞') + '..' + (rule.maxValue ?? '∞') + ').' };
  }
  // Dedup: gleiche Anerkennung desselben Quellereignisses nur einmal.
  const eventId = 'led-gc-' + childId + ':' + (progressEventId || crypto.randomBytes(8).toString('hex')) + ':' + rule.id;
  if (source && db.performanceLedger.some(e => e.childId === childId && e.sourceEventId === progressEventId && e.metricKey === metricKey && e.verification === 'verified' && e.provenance === 'server')) return { ok: true, message: 'Bereits serverseitig bestätigt.', reused: true };
  if (db.performanceLedger.some(e => e.eventId === eventId)) return { ok: true, message: 'Bereits anerkannt.', reused: true };
  const learningSource = source && db.performanceLedger.find(e => e.childId === childId && e.sourceEventId === progressEventId && e.cardLearningEvent && e.metricKey === metricKey);
  db.performanceLedger.push({
    eventId, childId, metricKey, ruleVersionId: rule.id,
    points: Math.round((value * (rule.pointsPerUnit || 0)) * 1000) / 1000,
    value, unit: unit || rule.unit, sourceEventId: progressEventId || null,
    occurredAt: source?.reportedAt || (occurredAt ? iso(Date.parse(occurredAt)) : iso(Date.now())), recordedAt: iso(Date.now()),
    verification: 'guardian-confirmed', provenance: 'guardian:' + actorId,
    ...(learningSource ? { cardLearningDelta: learningSource.learningDelta || 0 } : {}),
    reversalOf: null, note: String(note || '').slice(0, 200),
  });
  return { ok: true, message: 'Leistung anerkannt.' };
}

// Anrechenbare Punkte: verification != reported, Regel-Schlüssel im
// Vereinbarungsumfang, Zeitfenster der Vereinbarung, minus Pausenintervalle.
function countedPoints(db, s, terms, until = Date.now()) {
  const keys = new Set(terms.metricKeys);
  const from = Math.max(terms.from ? Date.parse(terms.from) : 0, s.periodStart ? Date.parse(s.periodStart) : 0);
  const to = Math.min(until, terms.until ? Date.parse(terms.until) : Infinity, s.periodEnd ? Date.parse(s.periodEnd) : Infinity, s.endedAt ? Date.parse(s.endedAt) : Infinity);
  const pauses = (s.pauseIntervals || []).filter(i => i.from);
  const inPause = t => pauses.some(i => t >= Date.parse(i.from) && (!i.to || t < Date.parse(i.to)));
  let sum = 0, counted = 0;
  for (const e of db.performanceLedger) {
    if (e.childId !== s.childId || e.verification === 'reported' || (e.verification === 'verified' && e.provenance !== 'server') || !keys.has(e.metricKey)) continue;
    const t = Date.parse(e.occurredAt);
    if (!(t >= from && t <= to) || inPause(t)) continue;
    const base = isCardReward(terms) && e.cardLearningEvent ? e.learningDelta || 0
      : isCardReward(terms) && e.cardLearningDelta !== undefined ? e.cardLearningDelta : e.points || 0;
    const pts = e.reversalOf ? -base : base;
    sum += pts; counted += 1;
  }
  for (const c of db.rewardClaims.filter(c => c.sponsorshipId === s.id && c.status === 'fulfilled')) {
    if (c.consumedPoints) sum -= c.consumedPoints;
  }
  return { points: Math.round(sum * 1000) / 1000, entries: counted };
}

function isCardReward(terms) {
  return terms?.rewardMode === 'cardRounds';
}

function rewardProgress(db, s, v) {
  const terms = { ...v.terms, from: v.countingFrom || v.terms.from };
  const { points } = countedPoints(db, s, terms);
  const claims = db.rewardClaims.filter(c => c.sponsorshipId === s.id && c.agreementId === v.agreementId);
  const open = claims.find(c => !['fulfilled', 'cancelled'].includes(c.status));
  return { points, pointsTarget: open?.snapshot?.pointsTarget || v.terms.pointsTarget,
    round: open?.round || claims.length + 1, reached: !!open || points >= v.terms.pointsTarget,
    status: open?.status || 'collecting', pendingReward: !!open,
    completedRounds: claims.filter(c => c.status === 'fulfilled').length };
}

// Anspruchsauswertung für eine Begleitung: wenn die aktive Vereinbarung ihr
// Ziel erreicht hat, existiert genau ein Anspruch (entitlementKey eindeutig).
// Wird bei Aktivierung, Leistungseingang, Pausenende und Beendigung gerufen.
function evaluateSponsorship(db, s, { until, notify } = {}) {
  const out = { claims: [] };
  if (!s || s.status === 'requested' || s.status === 'withdrawn') return out;
  const ag = db.sponsorAgreements.find(a => a.sponsorshipId === s.id && a.activeVersion);
  if (!ag) return out;
  const v = db.sponsorAgreementVersions.find(x => x.agreementId === ag.id && x.version === ag.activeVersion);
  if (!v || v.status !== 'active') return out;
  const t = until || Date.now();
  if (v.terms.validUntil && Date.parse(v.terms.validUntil) < t) return out;
  const countingTerms = { ...v.terms, from: v.countingFrom || v.terms.from };
  const { points } = countedPoints(db, s, countingTerms, t);
  const recurring = isCardReward(v.terms);
  const existing = recurring && db.rewardClaims.find(c => c.agreementId === ag.id && !['fulfilled', 'cancelled'].includes(c.status));
  if (existing) { out.claims.push(existing); return out; }
  if (recurring && s.status !== 'active') return out;
  if (points < v.terms.pointsTarget) return out;
  const round = db.rewardClaims.filter(c => c.agreementId === ag.id).length + 1;
  const key = ag.id + ':v' + v.version + (recurring ? ':round:' + round : ':once');
  let claim = db.rewardClaims.find(c => c.entitlementKey === key);
  if (claim) { out.claims.push(claim); return out; }
  claim = {
    entitlementKey: key, sponsorshipId: s.id, agreementId: ag.id, agreementVersion: v.version,
    childId: s.childId, sponsorId: s.sponsorId, status: 'earned',
    ...(recurring ? { round, rewardMode: 'cardRounds' } : {}),
    snapshot: structuredClone(countingTerms),
    pointsAtEarn: points, createdAt: iso(t), requestedAt: null, releasedAt: null,
    fulfillmentReportedAt: null, fulfilledAt: null, cancelledAt: null, cancelReason: null, consumedPoints: 0,
  };
  db.rewardClaims.push(claim);
  db.sponsorEvents.push({ id: rid('sev'), sponsorshipId: s.id, type: 'claim-earned', actorId: 'system', at: iso(t), prev: null, next: { status: 'earned' }, detail: { entitlementKey: key, points } });
  if (notify) notify(db, [s.childId, ...s.requiredGuardianIds, s.sponsorId], 'sponsor-claim-earned', s.id, 'Belohnung erreicht', 'Die vereinbarte Punkteschwelle wurde erreicht.');
  out.claims.push(claim);
  return out;
}

// Grenz-Auswertung: beim Ende/Pausieren einer Begleitung werden Ansprüche
// bis zum Stichtag bewertet (Anspruchserhalt). Läuft im selben Commit.
function evaluateAllForChild(db, childId, opts) {
  const out = { claims: [] };
  for (const s of db.sponsorships.filter(x => x.childId === childId && ['active', 'paused', 'ended'].includes(x.status))) {
    const r = evaluateSponsorship(db, s, opts);
    out.claims.push(...r.claims);
  }
  return out;
}

module.exports = { ingestProgress, recognize, countedPoints, evaluateSponsorship, evaluateAllForChild, metricKeyOf, isCardReward, rewardProgress };

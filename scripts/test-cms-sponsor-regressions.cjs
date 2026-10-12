// Sicherheits- und Workflow-Regressionen mit synthetischen Daten.
// Keine Verbindung zu einem laufenden CMS oder produktiven Dateien.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { buildDb } = require('./cms/cms-seed-testdata.cjs');
const { createCore, validate } = require('./cms/cms-core.cjs');
const { createSponsor } = require('./cms/cms-sponsor.cjs');
const perf = require('./cms/cms-performance.cjs');
const { createRewards } = require('./cms/cms-rewards.cjs');
const { createJsonStore } = require('./cms/cms-store.cjs');
const projectPath = path.join(__dirname, '../game-server/public/projects/GCS-CMS.json');
const runtime = require('./cms/cms-runtime.cjs').loadRuntime(projectPath);
const sponsor = createSponsor(null), rewards = createRewards(sponsor, perf);
const P = 'parent-multi', P2 = 'parent-second', S = 'sponsor-fritz', STRANGER = 'sponsor-greta', K = 'child-finn';
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('OK', name); };
function fixture(twoParents = false) {
  const db = buildDb();
  if (twoParents) {
    db.people.push({ id: P2, name: 'Zweiter Elternteil', kind: 'adult', active: true });
    db.guardians.push({ childId: K, guardianId: P2, status: 'confirmed' });
  }
  db.sponsorships.push({ id: 'sp1', childId: K, sponsorId: S, status: 'active', revision: 1, periodStart: new Date(Date.now() - 86400000).toISOString(), periodEnd: null, requiredGuardianIds: twoParents ? [P, P2] : [P], activeAccessVersionId: 'access1' });
  db.sponsorAccessVersions.push({ id: 'access1', sponsorshipId: 'sp1', version: 1, status: 'active', scope: { subjects: ['math'], activities: ['tasks'], windowDays: 90, detailLevel: 'points' } });
  return db;
}
const terms = (extra = {}) => ({ metricKeys: ['math.tasks'], pointsTarget: 5, rewardText: 'Gemeinsam ein Eis essen', consumePoints: false, ...extra });
function activate(db, extra = {}) {
  const proposal = sponsor.proposeAgreement(db, { actorId: S, sponsorshipId: 'sp1', terms: terms(extra) });
  assert.equal(proposal.ok, true);
  for (const actorId of db.sponsorships[0].requiredGuardianIds) assert.equal(sponsor.consentAgreement(db, { actorId, agreementId: proposal.agreementId, version: proposal.version, approve: true }).ok, true);
  return proposal;
}
function recognize(db, value = 10) {
  assert.equal(perf.recognize(db, { actorId: P, childId: K, metricKey: 'math.tasks', value }).ok, true);
  perf.evaluateSponsorship(db, db.sponsorships[0]);
}
function api(db, route, personId, body = {}, assurance = 'account') {
  const core = createCore(db);
  const session = core.session(core.issueSession(personId, assurance));
  return runtime.run(runtime.find(route, 'POST'), { core, session, body, emit() {}, commit(_s, _a, _area, fn) {
    const next = structuredClone(db);
    const result = fn(next);
    if (result?.ok === false) return result;
    validate(next);
    Object.assign(db, next);
    return result;
  } }, { strict: true });
}

test('Fremde Konten lesen keine Vereinbarungs-Diffs oder Belohnungen', () => {
  const db = fixture(); const a = activate(db); recognize(db);
  assert.equal(api(db, '/api/cms/sponsorship/agreement-diff', STRANGER, { agreementId: a.agreementId, version: 1 }).status, 403);
  assert.equal(api(db, '/api/cms/child/sponsorship/rewards', STRANGER, { sponsorshipId: 'sp1' }).status, 403);
  assert.equal(api(db, '/api/cms/sponsorship/agreements', STRANGER, { sponsorshipId: 'sp1' }).status, 403);
  assert.equal(rewards.listFor(db, { actorId: K, sponsorshipId: 'sp1' }).items.length, 1);
});
test('Sichtvorschlag wird gespeichert und erst nach allen Eltern wirksam', () => {
  const db = fixture(true);
  const r = api(db, '/api/cms/sponsor/access-propose', S, { sponsorshipId: 'sp1', subjectsCsv: 'math,reading', activitiesCsv: '', detailLevel: 'aggregates', windowDays: 180 });
  assert.equal(r.status, 200); const versionId = r.data.accessVersionId;
  assert.equal(db.sponsorAccessVersions.find(v => v.id === versionId).status, 'proposed');
  assert.equal(api(db, '/api/cms/parent/sponsor-access-consent', P, { sponsorshipId: 'sp1', versionId, approve: true }).data.status, 'proposed');
  assert.equal(db.sponsorships[0].activeAccessVersionId, 'access1');
  assert.equal(api(db, '/api/cms/parent/sponsor-access-consent', P2, { sponsorshipId: 'sp1', versionId, approve: true }).data.status, 'active');
  validate(db);
});
test('Elternpause kann weder Sponsor noch Kind aufheben', () => {
  const db = fixture(); sponsor.pause(db, { actorId: P, sponsorshipId: 'sp1' });
  assert.equal(sponsor.resume(db, { actorId: S, sponsorshipId: 'sp1' }).status, 403);
  assert.equal(sponsor.resume(db, { actorId: K, sponsorshipId: 'sp1' }).status, 403);
  assert.equal(sponsor.resume(db, { actorId: P, sponsorshipId: 'sp1' }).ok, true);
});
test('Kindpause bleibt ausschließlich durch das Kind aufhebbar', () => {
  const db = fixture(); sponsor.pause(db, { actorId: K, sponsorshipId: 'sp1' });
  assert.equal(sponsor.resume(db, { actorId: P, sponsorshipId: 'sp1' }).status, 403);
  assert.equal(sponsor.childDecision(db, { childId: K, sponsorshipId: 'sp1', accept: true }).ok, true);
});
test('Alle Eltern stimmen exakt derselben initialen Sicht zu', () => {
  const db = fixture(true), sp = db.sponsorships[0]; sp.status = 'requested'; sp.activeAccessVersionId = null; db.sponsorAccessVersions = [];
  assert.equal(sponsor.decideRequest(db, { guardianId: P, sponsorshipId: sp.id, approve: true, scope: { subjects: ['math'], windowDays: 30 } }).status, 'requested');
  assert.equal(sponsor.decideRequest(db, { guardianId: P2, sponsorshipId: sp.id, approve: true, scope: { subjects: ['reading'], windowDays: 3650 } }).status, 409);
  assert.equal(sp.status, 'requested');
  assert.equal(sponsor.decideRequest(db, { guardianId: P2, sponsorshipId: sp.id, approve: true }).status, 'active');
  assert.equal(sponsor._i.scopeOf(db, sp).windowDays, 30);
  assert.equal(sponsor.decideRequest(fixture(), { guardianId: P, sponsorshipId: 'sp1', approve: true, scope: { windowDays: -2 } }).ok, false);
  validate(db);
});
test('Leere Aktivitäten erweitern die Sicht und benötigen Quorum', () => {
  const db = fixture(true);
  const r = sponsor.proposeAccess(db, { actorId: P, sponsorshipId: 'sp1', scope: { subjects: ['math'], activities: [], detailLevel: 'points', windowDays: 90 } });
  assert.equal(r.status, 'proposed'); assert.equal(db.sponsorships[0].activeAccessVersionId, 'access1');
});
test('Sofortige Einschränkung widerruft überholte Sichtvorschläge', () => {
  const db = fixture(true);
  const pending = sponsor.proposeAccess(db, { actorId: S, sponsorshipId: 'sp1', scope: { subjects: ['math', 'reading'], activities: [], detailLevel: 'aggregates', windowDays: 180 } });
  assert.equal(sponsor.proposeAccess(db, { actorId: P, sponsorshipId: 'sp1', scope: { subjects: [], activities: [], detailLevel: 'points', windowDays: 90 } }).status, 'active');
  assert.equal(sponsor.consentAccess(db, { actorId: P2, sponsorshipId: 'sp1', versionId: pending.accessVersionId, approve: true }).status, 409);
});
test('Zweite Vereinbarung ohne Vorgangs-ID erzeugt eine echte neue Version', () => {
  const db = fixture(); const a = activate(db);
  const b = sponsor.proposeAgreement(db, { actorId: K, sponsorshipId: 'sp1', terms: terms({ pointsTarget: 20 }) });
  assert.equal(b.version, 2); assert.equal(b.agreementId, a.agreementId);
  assert.equal(db.sponsorAgreements[0].activeVersion, 1);
});
test('Idempotenz ist akteurbezogen und weist geänderte Nutzlast zurück', () => {
  const db = fixture(); const args = { actorId: S, sponsorshipId: 'sp1', terms: terms(), proposalId: 'same' };
  const first = sponsor.proposeAgreement(db, args); const again = sponsor.proposeAgreement(db, args);
  assert.equal(again.version, first.version); assert.equal(again.reused, true);
  assert.equal(sponsor.proposeAgreement(db, { ...args, terms: terms({ pointsTarget: 12 }) }).status, 409);
  assert.equal(sponsor.proposeAgreement(db, { ...args, actorId: K }).version, 2);
});
test('UI-Zustimmung nutzt agreementId statt Zeilen-ID und funktioniert', () => {
  const db = fixture(); const a = sponsor.proposeAgreement(db, { actorId: S, sponsorshipId: 'sp1', terms: terms() });
  const list = api(db, '/api/cms/sponsorship/agreements', P, { sponsorshipId: 'sp1' }).data.items[0].versions[0];
  assert.notEqual(list.id, list.agreementId);
  assert.equal(api(db, '/api/cms/parent/sponsor-agreement-consent', P, { agreementId: list.agreementId, version: list.version, approve: true }).status, 200);
  assert.equal(db.sponsorAgreements[0].activeVersion, a.version);
});
test('Ungültige Vertragsstruktur wird ohne Mutation abgewiesen', () => {
  const db = fixture(); const before = JSON.stringify(db);
  assert.equal(api(db, '/api/cms/parent/sponsor-agreement-propose', P, { sponsorshipId: 'sp1', terms: { pointsTarget: 10 } }).status, 400);
  assert.equal(JSON.stringify(db), before);
});
test('Elternänderung übernimmt die übrigen Bedingungen der gewählten Version', () => {
  const db = fixture(); activate(db, { consumePoints: true, carryOver: 'carry', metricKeys: ['reading.session'] });
  const r = api(db, '/api/cms/parent/sponsor-agreement-propose', P, { sponsorshipId: 'sp1', baseVersion: 1, pointsTarget: 20, rewardText: 'Ausflug' });
  assert.equal(r.status, 200);
  const v = db.sponsorAgreementVersions.find(v => v.version === r.data.version);
  assert.deepEqual(v.terms.metricKeys, ['reading.session']);
  assert.equal(v.terms.consumePoints, true); assert.equal(v.terms.carryOver, 'carry');
});
test('Verbrauch: Reservierung, Zurückweisung, erneuter Wunsch und Erfüllung', () => {
  const db = fixture(); activate(db, { consumePoints: true }); recognize(db, 10); const key = db.rewardClaims[0].entitlementKey;
  assert.equal(rewards.balance(db, 'sp1'), 10);
  assert.equal(rewards.requestRedemption(db, { actorId: K, claimKey: key }).ok, true);
  assert.equal(rewards.balance(db, 'sp1'), 5);
  assert.equal(rewards.requestRedemption(db, { actorId: K, claimKey: key }).reused, true);
  rewards.guardianDecision(db, { actorId: P, claimKey: key, approve: false });
  assert.equal(rewards.balance(db, 'sp1'), 10);
  assert.equal(rewards.requestRedemption(db, { actorId: K, claimKey: key }).ok, true);
  rewards.guardianDecision(db, { actorId: P, claimKey: key, approve: true });
  rewards.fulfillmentReport(db, { actorId: S, claimKey: key });
  rewards.confirmFulfillment(db, { actorId: P, claimKey: key });
  assert.equal(rewards.balance(db, 'sp1'), 5);
  assert.equal(rewards.confirmFulfillment(db, { actorId: P, claimKey: key }).reused, true);
  assert.equal(db.rewardPointEntries.filter(e => e.type === 'consume').length, 1);
});
test('Fehlende Deckung verändert weder Anspruch noch Buchungsjournal', () => {
  const db = fixture(); activate(db, { consumePoints: true }); recognize(db); const claim = db.rewardClaims[0];
  db.performanceLedger = []; const before = JSON.stringify(db);
  assert.equal(rewards.requestRedemption(db, { actorId: K, claimKey: claim.entitlementKey }).status, 409);
  assert.equal(JSON.stringify(db), before);
});
test('Echte Store-Transaktion verwirft Teilmutationen bei fachlicher Ablehnung', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-sponsor-regression-'));
  try {
    const dataPath = path.join(dir, 'db.json'); fs.writeFileSync(dataPath, JSON.stringify(buildDb()));
    const store = createJsonStore({ dataPath }); const db = store.load(); const before = JSON.stringify(db);
    const result = store.commit(db, { actor: P, action: 'test-rejected-operation' }, next => { next.people[0].name = 'Unzulässige Teiländerung'; return { ok: false, status: 409 }; });
    assert.equal(result.ok, false); assert.equal(JSON.stringify(db), before); assert.equal(JSON.stringify(store.load()), before);
  } finally {
    assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test('Clientmeldungen zählen erst nach elterlicher Anerkennung', () => {
  const db = fixture(); activate(db);
  const row = { eventId: 'reported1', childId: K, gameId: 'game-math', metric: 'tasks_correct', value: 10, unit: 'count', source: 'game', reportedAt: new Date().toISOString() };
  db.progress.push(row); assert.equal(perf.ingestProgress(db, row)[0].verification, 'reported');
  perf.evaluateSponsorship(db, db.sponsorships[0]); assert.equal(db.rewardClaims.length, 0);
  assert.equal(perf.recognize(db, { actorId: P, childId: K, metricKey: 'math.tasks', value: 10, unit: 'count', progressEventId: row.eventId }).ok, true);
  assert.equal(perf.recognize(db, { actorId: P, childId: K, metricKey: 'math.tasks', value: 10, unit: 'count', progressEventId: row.eventId }).reused, true);
  perf.evaluateSponsorship(db, db.sponsorships[0]); assert.equal(db.rewardClaims.length, 1);
});
test('Alte als verified markierte Clientmeldungen zählen ebenfalls nicht', () => {
  const db = fixture(); activate(db); recognize(db); db.performanceLedger[0].verification = 'verified'; db.performanceLedger[0].provenance = 'reported';
  assert.equal(perf.countedPoints(db, db.sponsorships[0], terms()).points, 0);
});
test('Fremdes Quellereignis kann nicht als Leistung anerkannt werden', () => {
  const db = fixture();
  assert.equal(perf.recognize(db, { actorId: P, childId: K, metricKey: 'math.tasks', value: 10, progressEventId: 'missing' }).status, 400);
  assert.equal(perf.recognize(db, { actorId: P, childId: K, metricKey: 'math.tasks', value: 10, occurredAt: 'not-a-date' }).status, 400);
});
test('Ende und Pause sperren Sponsor-Lesen und Kontakt; Ansprüche bleiben abwickelbar', () => {
  for (const status of ['paused', 'ended']) {
    const db = fixture(); const a = activate(db); recognize(db); const key = db.rewardClaims[0].entitlementKey;
    db.sponsorships[0].status = status;
    assert.equal(sponsor.sendMessage(db, { actorId: S, sponsorshipId: 'sp1', targetType: 'sponsorship', text: 'Nicht erlaubt' }).status, 403);
    assert.equal(sponsor.history(db, { actorId: S, sponsorshipId: 'sp1' }).status, 403);
    assert.equal(api(db, '/api/cms/sponsorship/agreements', S, { sponsorshipId: 'sp1' }).status, 403);
    assert.equal(sponsor.diffAgreement(db, { actorId: S, agreementId: a.agreementId, version: 1 }).status, 403);
    assert.equal(sponsor.listMessages(db, { actorId: S, sponsorshipId: 'sp1' }).items.length, 0);
    assert.equal(rewards.requestRedemption(db, { actorId: K, claimKey: key }).ok, true);
    rewards.guardianDecision(db, { actorId: P, claimKey: key, approve: true });
    assert.equal(rewards.fulfillmentReport(db, { actorId: S, claimKey: key }).ok, true);
  }
});
test('Neue Mitteilungen und neue Vorschläge erzeugen jeweils neue Hinweise', () => {
  const db = fixture();
  for (const text of ['Erste Mitteilung', 'Zweite Mitteilung']) sponsor.sendMessage(db, { actorId: S, sponsorshipId: 'sp1', targetType: 'sponsorship', text });
  assert.equal(db.notifications.filter(n => n.type === 'sponsor-message' && n.recipientPersonId === P).length, 2);
  assert.equal(sponsor.listMessages(db, { actorId: P, sponsorshipId: 'sp1' }).items.length, 2);
  assert.equal(sponsor.history(db, { actorId: P, sponsorshipId: 'sp1' }).items.filter(e => e.type === 'message-sent').length, 2);
  sponsor.proposeAgreement(db, { actorId: S, sponsorshipId: 'sp1', terms: terms() });
  sponsor.proposeAgreement(db, { actorId: S, sponsorshipId: 'sp1', terms: terms({ pointsTarget: 12 }) });
  assert.equal(db.notifications.filter(n => n.type === 'sponsor-agreement-proposed' && n.recipientPersonId === P).length, 2);
});
test('Vertragsfortschritt berücksichtigt Vertragsmetriken statt sichtbarer Gesamtsumme', () => {
  const db = fixture(); activate(db, { metricKeys: ['reading.session'] }); recognize(db, 10);
  const p = sponsor.progress(db, { actorId: S, sponsorshipId: 'sp1' });
  assert.equal(p.totalPoints, 10); assert.equal(p.agreement.countedPoints, 0); assert.equal(p.agreement.reached, false);
});
test('Versionswechsel sichert alte Ansprüche und berücksichtigt Übertrag', () => {
  for (const carryOver of ['none', 'carry']) {
    const db = fixture(); activate(db); recognize(db); db.rewardClaims = [];
    db.performanceLedger[0].occurredAt = new Date(Date.now() - 1000).toISOString();
    const b = sponsor.proposeAgreement(db, { actorId: S, sponsorshipId: 'sp1', terms: terms({ pointsTarget: 8, carryOver }) });
    sponsor.consentAgreement(db, { actorId: P, agreementId: b.agreementId, version: b.version, approve: true });
    assert.equal(db.rewardClaims.length, 1, 'Alten Anspruch vor Wechsel sichern');
    perf.evaluateSponsorship(db, db.sponsorships[0]);
    assert.equal(db.rewardClaims.length, carryOver === 'carry' ? 2 : 1);
  }
});
test('Abgelaufene Begleitung liefert keine späteren Punkte', () => {
  const db = fixture(); const end = Date.now() - 1000; db.sponsorships[0].periodEnd = new Date(end).toISOString();
  recognize(db); assert.equal(perf.countedPoints(db, db.sponsorships[0], terms()).points, 0);
});
test('Generierte UI bindet korrekte IDs und macht Familienmitteilungen erreichbar', () => {
  const project = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
  for (const id of ['stage_sponsor_detail', 'stage_parent_sponsor_detail']) {
    const stage = project.stages.find(s => s.id === id);
    assert.equal(stage.actions.find(a => a.name === 'Act_VertragZustimmung_Server').body.agreementId, '${VertragTabelle.selectedRecord.agreementId}');
  }
  for (const id of ['stage_parent_sponsor_messages', 'stage_child_sponsor_messages']) {
    const stage = project.stages.find(s => s.id === id); assert.ok(stage);
    assert.ok(stage.actions.some(a => /messages$/.test(a.url || '')));
    assert.ok(stage.objects.some(o => o.name === 'NachrichtInhalt' && o.readOnly));
  }
  assert.ok(project.stages.find(s => s.id === 'stage_parent_sponsor_access').objects.some(o => o.name === 'Detailgrad' && o.options.includes('points')));
  assert.ok(project.stages.find(s => s.id === 'stage_parent_sponsor_performance').actions.some(a => a.url === '/api/cms/parent/sponsor-performance-recognize'));
  assert.ok(project.stages.find(s => s.id === 'stage_parent_sponsor_detail').actions.some(a => a.url === '/api/cms/parent/sponsor-resume'));
});
console.log(JSON.stringify({ passed, failed: 0 }));

// Prüft die synthetischen Testdaten gegen die echte Kernlogik:
// Login, Räume, Spielberechtigungen, Guardian-Beziehungen, Negativfälle.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert');
const { createJsonStore } = require('./cms/cms-store.cjs');
const { createCore } = require('./cms/cms-core.cjs');

const { buildDb } = require('./cms/cms-seed-testdata.cjs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-td-'));
const dataPath = path.join(dir, 'cms-testdata.json');
fs.writeFileSync(dataPath, JSON.stringify(buildDb())); // frische relative Zeiten
const store = createJsonStore({ dataPath });
const core = createCore(store.load());
const db = core.db;

const results = [];
const check = (name, fn) => { try { fn(); results.push(['OK', name]); } catch (e) { results.push(['FEHLER', name + ' :: ' + e.message]); } };

// Guardian-Sicht über die Kernfunktion (nur bestätigte Beziehungen)
const childrenOf = (db, guardianId) => core.childrenOf(guardianId);
const loginAs = id => {
  const c = db.codes.find(c => c.personId === id);
  const s = core.login(c.sequence);
  return s && core.session(s.token);
};

check('Testdaten sind aktuelles Schema (keine Migration nötig)', () => assert.strictEqual(db.version, require('./cms/cms-migrations.cjs').SCHEMA_VERSION));

check('Eltern-Sichtbarkeit: jeder Elternteil sieht nur eigene bestätigte Kinder', () => {
  for (const v of db.testMeta.visibility) {
    const seen = childrenOf(db, v.account);
    for (const c of v.seesChildren) assert.ok(seen.includes(c), v.account + ' sieht ' + c + ' nicht');
    for (const c of v.notChildren || []) assert.ok(!seen.includes(c), v.account + ' sieht ' + c + ' fälschlich');
  }
});
check('Widerrufene Zuordnung gibt keine Sicht', () => assert.deepStrictEqual(childrenOf(db, 'adult-revoked'), []));
check('Ausstehende Zuordnung gibt noch keine Sicht', () => assert.ok(!childrenOf(db, 'parent-lina').includes('child-mia')));
check('HouseAdmin ohne Guardian-Bezug sieht keine Kinder', () => assert.deepStrictEqual(childrenOf(db, 'admin-sun'), []));
check('HouseAdmin+Elternteil sieht nur eigenes Kind', () => assert.deepStrictEqual(childrenOf(db, 'admin-parent'), ['child-lina']));
check('can(viewChild/viewProgress) nur für eigene bestätigte Kinder', () => {
  const as = id => ({ personId: id, assurance: 'profile' });
  assert.ok(core.can(as('parent-lina'), 'viewChild', { childId: 'child-lina' }));
  assert.ok(core.can(as('parent-lina'), 'viewProgress', { childId: 'child-lina' }));
  assert.ok(!core.can(as('parent-lina'), 'viewChild', { childId: 'child-finn' }), 'fremdes Kind sichtbar!');
  assert.ok(!core.can(as('parent-lina'), 'viewChild', { childId: 'child-mia' }), 'pending-Beziehung gewährt Sicht!');
  assert.ok(!core.can(as('adult-revoked'), 'viewChild', { childId: 'child-tom' }), 'widerrufene Beziehung gewährt Sicht!');
  assert.ok(!core.can(as('admin-sun'), 'viewProgress', { childId: 'child-lina' }), 'Verwaltungsrolle gewährt Bewertungssicht!');
  assert.ok(core.can({ personId: 'admin-parent', assurance: 'admin' }, 'viewProgress', { childId: 'child-lina' }));
});

check('Kinder-Login per global eindeutigem Emoji-Code', () => {
  assert.ok(loginAs('child-lina'), 'child-lina Login fehlgeschlagen');
  assert.ok(loginAs('child-mia'), 'child-mia Login fehlgeschlagen');
});
check('Gesperrtes Kind kann sich nicht anmelden', () => assert.strictEqual(loginAs('child-suspended'), null));
check('Ausgetretenes Mitglied: ohne aktive Hausmitgliedschaft kein Login', () => {
  assert.strictEqual(loginAs('child-left'), null);
  assert.deepStrictEqual(core.rooms('child-left'), []);
});
check('Deaktivierter Raum wird nicht gelistet', () => {
  assert.ok(!core.rooms('child-lina').some(r => r.id === 'room-sun-closed'));
});
check('Draft- und gesperrte Spiele nicht startbar', () => {
  const s = loginAs('child-lina');
  assert.ok(!core.can(s, 'play', { game: db.games.find(g => g.id === 'game-draft'), areaId: 'room-sun-play' }));
  assert.ok(!core.can(s, 'play', { game: db.games.find(g => g.id === 'game-blocked'), areaId: 'room-sun-play' }));
});
check('Widerrufene Freigabe blockiert Start', () => {
  const s = loginAs('child-lina');
  assert.ok(!core.can(s, 'play', { game: db.games.find(g => g.id === 'game-snake'), areaId: 'room-sun-learn' }));
});
check('Raumzuordnung ist Pflicht zusätzlich zum Hauskatalog', () => {
  const s = loginAs('child-emil');
  const game = id => db.games.find(g => g.id === id);
  // game-mp ist im Hauskatalog aktiv, aber room-sun-learn ohne Zuordnung → nicht spielbar.
  assert.ok(!core.can(s, 'play', { game: game('game-mp'), areaId: 'room-sun-learn' }));
  // Gegenprobe: Hauskatalog + aktive Raumzuordnung + Mitgliedschaft → spielbar.
  assert.ok(core.can(s, 'play', { game: game('game-math'), areaId: 'room-sun-learn' }));
});
check('Hausgrenze: Mond-Kind kann nicht in Sonnen-Raum spielen', () => {
  const s = loginAs('child-mia');
  assert.ok(!core.can(s, 'play', { game: db.games.find(g => g.id === 'game-snake'), areaId: 'room-sun-play' }));
  assert.ok(core.can(s, 'play', { game: db.games.find(g => g.id === 'game-snake'), areaId: 'room-moon-play' }));
});
check('Inaktives Haus blockiert komplett', () => {
  assert.strictEqual(require('./cms/cms-core.cjs').areaActive(db, 'house-closed'), false);
});
check('Einladungen: gültig / abgelaufen / verwendet unterscheidbar', () => {
  const inv = id => db.invites.find(i => i.id === id);
  assert.ok(inv('inv-valid').expires > Date.now() && !inv('inv-valid').usedAt);
  assert.ok(inv('inv-expired').expires < Date.now());
  assert.ok(inv('inv-used').usedAt);
});
check('Gerätefreigaben: gültig / abgelaufen / widerrufen', () => {
  const g = id => db.deviceGrants.find(d => d.id === id);
  const usable = d => d.expires > Date.now() && !d.revoked;
  assert.ok(usable(g('dev-valid')) && !usable(g('dev-expired')) && !usable(g('dev-revoked')));
});
check('Zeitbudgets: vorhanden/fast erschöpft/erschöpft/keins', () => {
  const spent = id => db.playSessions.filter(s => s.childId === id && new Date(s.startedAt).toDateString() === new Date().toDateString()).reduce((a, s) => a + s.minutes, 0);
  assert.ok(db.timeBudgets.find(t => t.childId === 'child-lina').dailyMinutes > spent('child-lina'));
  assert.ok(spent('child-tom') >= db.timeBudgets.find(t => t.childId === 'child-tom').dailyMinutes - 2 - 1); // fast erschöpft
  assert.ok(spent('child-finn') >= db.timeBudgets.find(t => t.childId === 'child-finn').dailyMinutes);
  assert.ok(!db.timeBudgets.some(t => t.childId === 'child-emil'));
});
check('Tageswechsel: gestrige Sitzung zählt nicht zum heutigen Budget', () => {
  const lina = db.playSessions.filter(s => s.childId === 'child-lina' && new Date(s.startedAt).toDateString() === new Date().toDateString());
  assert.strictEqual(lina.reduce((a, s) => a + s.minutes, 0), 12);
});
check('Bewertungen: Metriken, Quelle und Duplikat-Merkmal vorhanden', () => {
  const p = db.progress.filter(r => r.childId === 'child-lina');
  assert.deepStrictEqual(p.map(r => r.metric).sort(), ['hints_used', 'round_complete', 'tasks_correct', 'tasks_done']);
  assert.ok(db.progress.some(r => r.source === 'server'));
  assert.ok(db.progress.every(r => r.eventId && r.schemaVersion === 1));
});
check('Sitzungszustände vollständig abgedeckt', () => {
  const states = new Set(db.playSessions.map(s => s.status));
  for (const st of ['active', 'paused', 'disconnected', 'ended']) assert.ok(states.has(st), st + ' fehlt');
});
check('Haus-Spieleliste erkennt Mehrspieler-Objekt und Solospiel', () => {
  const project = JSON.parse(fs.readFileSync(path.join(__dirname, '../game-server/public/projects/GCS-CMS.json'), 'utf8'));
  const action = project.stages.find(s => s.id === 'stage_server_house').actions.find(a => a.name === 'HausSpiele_Abfragen');
  const { methods } = require('./cms/cms-server-components.cjs');
  const items = methods.TServerQuery.list({ core, body: { houseId: 'house-sun' } }, null, action.params).items;
  assert.strictEqual(items.find(g => g.id === 'game-mp').multiplayer, true);
  assert.strictEqual(items.find(g => g.id === 'game-snake').multiplayer, false);
});
check('Lobby-Vorschau zeigt nur berechtigte Mehrspieler-Spiele und einladbare Hausbewohner', () => {
  const runtime = require('./cms/cms-runtime.cjs').loadRuntime(path.join(__dirname, '../game-server/public/projects/GCS-CMS.json'));
  const endpoint = runtime.find('/api/cms/mp/available', 'POST');
  assert.ok(endpoint);
  const session = loginAs('child-lina');
  const request = (areaId, actor = session) => runtime.run(endpoint, { core, session: actor, body: { areaId } }, { strict: true });
  const result = request('room-sun-play');
  assert.strictEqual(result.status, 200);
  assert.ok(result.data.games.some(g => g.id === 'game-mp'));
  assert.ok(result.data.games.every(g => g.multiplayer && !['game-snake', 'game-draft', 'game-blocked'].includes(g.id)));
  assert.ok(result.data.candidates.some(p => p.id === 'child-emil'));
  assert.ok(!result.data.candidates.some(p => p.id === 'child-lina'));
  assert.strictEqual(request('room-moon-play').status, 403);
  assert.strictEqual(request('room-sun-closed').status, 403);
  assert.strictEqual(request('room-sun-play', null).status, 401);
});
check('Ein Klick erzeugt Einladung und spielbaren Gastgeber-Link', () => {
  for (const s of db.playSessions) if (s.childId === 'child-lina' && ['active', 'paused'].includes(s.status)) s.status = 'ended';
  const launches = new Map();
  const play = require('./cms/cms-play.cjs').createPlay(core, store);
  const mp = require('./cms/cms-mp.cjs').createMp(core, store, play, undefined, launches);
  const issued = core.login(db.codes.find(c => c.personId === 'child-lina').sequence);
  const session = core.session(issued.token);
  assert.strictEqual(mp.api(session, 'start-invite', {token: issued.token, areaId: 'room-moon-play', gameId: 'game-mp', personId: 'child-emil'}).status, 403);
  assert.strictEqual(mp.api(session, 'start-invite', {token: issued.token, areaId: 'room-sun-play', gameId: 'game-snake', personId: 'child-emil'}).status, 403);
  assert.strictEqual(mp.api(session, 'start-invite', {token: issued.token, areaId: 'room-sun-play', gameId: 'game-mp', personId: 'child-mia'}).status, 403);
  assert.ok(!db.parties.some(p => p.oneClick));
  const result = mp.api(session, 'start-invite', {token: issued.token, areaId: 'room-sun-play', gameId: 'game-mp', personId: 'child-emil'});
  assert.strictEqual(result.status, 200, 'erstes Starten: ' + result.data.message);
  assert.ok(result.data.launch?.startsWith('/play/'));
  assert.strictEqual(launches.get(result.data.launch.slice(6))?.partyId, result.data.partyId);
  assert.ok(db.gameInvitations.some(i => i.id === result.data.invitationId && i.status === 'pending'));
  const hostSession = db.parties.find(p => p.id === result.data.partyId).members[0].playSessionId;
  db.playSessions.find(s => s.id === hostSession).lastHeartbeatAt = new Date(Date.now() - 60000).toISOString();
  assert.strictEqual(play.api(session, 'heartbeat', {playSessionId: hostSession}).status, 200);
  assert.strictEqual(db.playSessions.find(s => s.id === hostSession).minutes, 0);
  const repeated = mp.api(session, 'start-invite', {token: issued.token, areaId: 'room-sun-play', gameId: 'game-mp', personId: 'child-emil'});
  assert.strictEqual(repeated.status, 200);
  assert.strictEqual(repeated.data.partyId, result.data.partyId);
  assert.strictEqual(db.gameInvitations.filter(i => i.sessionId === result.data.partyId).length, 1);
  const guest = loginAs('child-emil');
  const accepted = mp.api(guest, 'respond', {token: 'guest', invitationId: result.data.invitationId, accept: true});
  assert.strictEqual(accepted.status, 200, 'Annahme: ' + accepted.data.message);
  assert.ok(accepted.data.launch?.startsWith('/play/'));
  assert.strictEqual(launches.get(accepted.data.launch.slice(6))?.partyId, result.data.partyId);
  assert.strictEqual(db.parties.find(p => p.id === result.data.partyId).status, 'playing');
  const otherHost = loginAs('child-tom');
  assert.strictEqual(mp.api(otherHost, 'start-invite', {token: 'other', areaId: 'room-sun-play', gameId: 'game-mp', personId: 'child-emil'}).status, 409);
  assert.ok(mp.api(session, 'end', {partyId: result.data.partyId}).data.ok);
  assert.strictEqual(launches.size, 0, 'Partieende entfernt Launch-Grants');
  const declined = mp.api(session, 'start-invite', {token: issued.token, areaId: 'room-sun-play', gameId: 'game-mp', personId: 'child-emil'});
  assert.strictEqual(declined.status, 200, 'zweites Starten: ' + declined.data.message);
  mp.api(guest, 'respond', {invitationId: declined.data.invitationId, accept: false});
  assert.strictEqual(db.parties.find(p => p.id === declined.data.partyId).status, 'ended');
  assert.strictEqual(launches.size, 0, 'Ablehnung entfernt Launch-Grants');
  assert.ok(mp.api(session, 'notifications').data.items.some(n => n.type === 'game-invitation-declined' && n.invitationId === declined.data.invitationId));
  const expired = mp.api(session, 'start-invite', {token: issued.token, areaId: 'room-sun-play', gameId: 'game-mp', personId: 'child-emil'});
  assert.strictEqual(expired.status, 200, 'drittes Starten: ' + expired.data.message);
  db.gameInvitations.find(i => i.id === expired.data.invitationId).expiresAt = Date.now() - 1;
  assert.ok(mp.api(session, 'notifications').data.items.some(n => n.type === 'game-invitation-expired' && n.invitationId === expired.data.invitationId));
  assert.strictEqual(db.parties.find(p => p.id === expired.data.partyId).status, 'ended');
  assert.strictEqual(mp.api(session, 'state', {partyId: expired.data.partyId}).data.invitationStatus, 'expired');
  assert.ok(!db.temporaryRoomAccess.find(a => a.invitationId === expired.data.invitationId).active);
  assert.strictEqual(launches.size, 0, 'Ablauf entfernt Launch-Grants');
  assert.ok(db.playSessions.filter(s => s.childId === 'child-lina').every(s => s.status === 'ended'));
  assert.strictEqual(mp.api(session, 'notifications').data.items.filter(n => n.type === 'game-invitation-expired' && n.invitationId === expired.data.invitationId).length, 1);
  const legacy = mp.api(session, 'create', {gameId: 'game-mp', areaId: 'room-sun-play'});
  assert.strictEqual(legacy.status, 200);
  const oldInvite = mp.api(session, 'invite', {partyId: legacy.data.partyId, personId: 'child-emil'});
  db.gameInvitations.find(i => i.id === oldInvite.data.invitationId).expiresAt = Date.now() - 1;
  const restarted = mp.api(session, 'start-invite', {token: issued.token, areaId: 'room-sun-play', gameId: 'game-mp', personId: 'child-emil'});
  assert.strictEqual(restarted.status, 200, restarted.data.message);
  assert.notStrictEqual(restarted.data.partyId, legacy.data.partyId);
  assert.strictEqual(db.parties.find(p => p.id === legacy.data.partyId).status, 'ended');
  assert.ok(mp.api(session, 'end', {partyId: restarted.data.partyId}).data.ok);
  assert.strictEqual(launches.size, 0, 'Ende nach Neuvergabe entfernt Launch-Grants');
});
check('ZahlenDuell wartet im Ein-Klick-Modus und startet erste Aufgabe nur einmal', () => {
  const project = JSON.parse(fs.readFileSync(path.join(__dirname, '../game-server/public/projects/Zahlen-Duell.json'), 'utf8'));
  const stage = project.stages.find(s => s.id === 'stage_main');
  assert.ok(stage.variables.some(v => v.name === 'CMS_AUTO_PARTY' && v.defaultValue === false));
  assert.ok(stage.variables.some(v => v.name === 'ErsteAufgabeGesendet' && v.defaultValue === false));
  assert.strictEqual(stage.objects.find(o => o.name === 'TimerPoll').maxInterval, 0);
  const poll = stage.tasks.find(t => t.name === 'PartieZustandLesen');
  const seqGuard = poll.actionSequence.find(step => step.condition?.variable === 'LastSeq');
  assert.ok(seqGuard, 'LastSeq-Guard fehlt');
  assert.strictEqual(seqGuard.body[0].name, 'Erste Aufgabe markieren');
  assert.ok(JSON.stringify(poll.actionSequence).includes('Erste Aufgabe markieren'));
  assert.ok(stage.actions.some(a => a.name === 'Erste Aufgabe markieren'));
});
check('Einladungsbutton startet Partie und öffnet Spiel in einem Schritt', () => {
  const project = JSON.parse(fs.readFileSync(path.join(__dirname, '../game-server/public/projects/GCS-CMS.json'), 'utf8'));
  const stage = project.stages.find(s => s.id === 'stage_multiplayer_lobby');
  const action = name => stage.actions.find(a => a.name === name);
  assert.strictEqual(action('Act_Spiele_Server').url, '/api/cms/mp/available');
  assert.deepStrictEqual(action('Act_Spiele_Uebernehmen').params, ['${SpielAntwort.games}']);
  assert.deepStrictEqual(action('Act_Kandidaten_Vorschau').params, ['${SpielAntwort.candidates}']);
  const load = stage.tasks.find(t => t.name === 'Spiele_Laden');
  assert.ok(load.actionSequence[1].then.some(step => step.name === 'Act_Kandidaten_Vorschau'));
  const invite = stage.tasks.find(t => t.name === 'Bewohner_Einladen');
  assert.strictEqual(invite.actionSequence[0].condition.variable, 'CMSMpRoomId');
  assert.strictEqual(action('Act_Einladen_Server').url, '/api/cms/mp/start-invite');
  assert.strictEqual(action('Act_Einladen_Fertig').changes.SpielURL, '${Antwort.launch}');
  assert.strictEqual(action('Act_ResumeInfo_Server').url, '/api/cms/mp/resume-info');
  assert.strictEqual(action('Act_Resume_Server').url, '/api/cms/mp/resume');
  assert.strictEqual(action('Act_Resume_Fertig').changes.SpielURL, '${Antwort.launch}');
  assert.strictEqual(stage.objects.find(o => o.name === 'PartieFortsetzen').visible, false);
  assert.ok(stage.tasks.find(t => t.name === 'Lobby_Init').actionSequence.some(step => step.name === 'Partie_Resume_Pruefen'));
  const mpServer = project.stages.find(s => s.id === 'stage_server_mp');
  assert.ok(mpServer.objects.some(o => o.endpointPath === '/api/cms/mp/resume-info'));
  assert.ok(mpServer.objects.some(o => o.endpointPath === '/api/cms/mp/resume'));
  const playServer = project.stages.find(s => s.id === 'stage_server_play');
  assert.ok(playServer.objects.some(o => o.endpointPath === '/api/cms/play/status'));
  const inbox = project.stages.find(s => s.id === 'stage_multiplayer_inbox');
  assert.strictEqual(inbox.actions.find(a => a.name === 'Act_Annehmen_Fertig').changes.CMSMpPartyId, '${Antwort.partyId}');
  assert.ok(!stage.objects.some(o => o.name === 'LobbyErstellen'));
  assert.ok(!stage.tasks.some(t => t.name === 'Kandidaten_Laden'));
  assert.ok(!stage.actions.some(a => ['Act_Lobby_Server', 'Act_Kandidaten_Server'].includes(a.name)));
  for (const file of ['cms/cms-shell.js', '../src/adapters/CmsGameHost.ts']) {
    const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
    for (const marker of ['Server: verbunden', 'Spiel: ', 'Partie: ', 'departedNames', 'disconnectedNames']) assert.ok(source.includes(marker), file + ' fehlt ' + marker);
  }
});

// ---- Sponsoring (v8): alle Abnahmefälle laufen über die echte GCS-Runtime —
// runtime.find/run führt die deklarierten Server-Tasks aus stage_server_sponsor
// aus (Sitzung → Fachmethode → Antwort), genau wie der HTTP-Server.
const runtime = require('./cms/cms-runtime.cjs').loadRuntime(path.join(__dirname, '../game-server/public/projects/GCS-CMS.json'));
const commit = (s, action, areaId, change) => store.commit(core.db, { actor: s?.personId || 'system', action, areaId }, change);
const acct = id => core.session(core.issueSession(id, 'account'));
// Parent-Routen laufen über denselben Modul-Adapter wie der HTTP-Server
// (403-vor-404-Gate + Runtime-Dispatch) — so wird die echte Kette geprüft.
const parentAdapter = require('./cms/cms-parent.cjs').createParent(core, path.join(dir, 'cms-admin-auth.json'), store, path.join(__dirname, '../game-server/public/projects/GCS-CMS.json'), 'stage_server_parent', {});
const api = (route, session, body = {}) => {
  if (route.startsWith('/api/cms/parent/')) return parentAdapter.api(session, route.slice('/api/cms/parent/'.length), body);
  const ep = runtime.find(route, 'POST');
  assert.ok(ep, 'Endpunkt fehlt: ' + route);
  return runtime.run(ep, { session, body, emit() {}, core, commit }, { strict: true });
};
const fritz = acct('sponsor-fritz'), greta = acct('sponsor-greta');
const martin = acct('parent-multi'), tina = acct('parent-tom-a'), tim = acct('parent-tom-b');
const finn = loginAs('child-finn'), tom = loginAs('child-tom');

let spnFinn = null, spnTom = null;
check('Sponsor: Kontaktcode → Anfrage → kein Zugriff vor Genehmigung → Quorum-Freigabe', () => {
  // Eltern stellen Kontaktcode aus; Fremd-Eltern werden abgewiesen.
  const code = api('/api/cms/parent/sponsor-contact-create', martin, { childId: 'child-finn', label: 'Patenonkel Fritz' });
  assert.strictEqual(code.status, 200, JSON.stringify(code.data));
  assert.ok(code.data.contactCode, 'Klartext-Code fehlt in der Antwort');
  assert.strictEqual(api('/api/cms/parent/sponsor-contact-create', tina, { childId: 'child-finn' }).status, 403);
  // Sponsor stellt die Anfrage über den Code — idempotent über requestId.
  const req = api('/api/cms/sponsor/request-create', fritz, { contactCode: code.data.contactCode, purpose: 'Lernpatenschaft Mathe', periodDays: 60, requestId: 'req-finn-1' });
  assert.strictEqual(req.status, 200, JSON.stringify(req.data));
  spnFinn = req.data.sponsorshipId;
  const again = api('/api/cms/sponsor/request-create', fritz, { contactCode: code.data.contactCode, purpose: 'Lernpatenschaft Mathe', periodDays: 60, requestId: 'req-finn-1' });
  assert.strictEqual(again.data.sponsorshipId, spnFinn, 'Idempotenz: wiederholte Anfrage erzeugt Duplikat');
  assert.strictEqual(db.sponsorships.filter(s => s.sponsorId === 'sponsor-fritz' && s.childId === 'child-finn').length, 1);
  // Vor Genehmigung: kein Leistungszugriff — auch nicht über direkte API-Aufrufe.
  assert.strictEqual(api('/api/cms/sponsor/progress', fritz, { sponsorshipId: spnFinn }).status, 403);
  // Zweite Anfrage mit verbrauchtem Code scheitert; fremde Codes unbekannt.
  const code2 = api('/api/cms/parent/sponsor-contact-create', martin, { childId: 'child-finn' });
  assert.strictEqual(api('/api/cms/sponsor/request-create', fritz, { contactCode: code2.data.contactCode, purpose: 'zweite', periodDays: 30, requestId: 'req-finn-2' }).status, 409);
  assert.strictEqual(api('/api/cms/sponsor/request-create', greta, { contactCode: 'sponsor-code-finn', purpose: 'altes Seed', periodDays: 30, requestId: 'req-g-1' }).status, 200);
  db.sponsorships.find(s => s.sponsorId === 'sponsor-greta' && s.childId === 'child-finn').status = 'withdrawn'; // Aufräumen: Greta bleibt für Tom
  // Elternzustimmung (Finn: ein Elternteil) → sofort aktiv + Sichtfreigabe v1.
  const dec = api('/api/cms/parent/sponsor-request-decision', martin, { sponsorshipId: spnFinn, approve: true });
  assert.strictEqual(dec.status, 200, JSON.stringify(dec.data));
  assert.strictEqual(dec.data.status, 'active');
  assert.strictEqual(db.sponsorships.find(s => s.id === spnFinn).status, 'active');
  assert.ok(db.sponsorAccessVersions.some(v => v.sponsorshipId === spnFinn && v.status === 'active'));
  // Jetzt: Sponsor sieht Leistungssicht; Fremde sehen nichts.
  assert.strictEqual(api('/api/cms/sponsor/progress', fritz, { sponsorshipId: spnFinn }).status, 200);
  assert.strictEqual(api('/api/cms/sponsor/progress', greta, { sponsorshipId: spnFinn }).status, 403);
  assert.strictEqual(api('/api/cms/parent/sponsorships', acct('parent-lina'), { childId: 'child-finn' }).status, 403);
});
check('Sponsor-Quorum: bei zwei Elternteilen wirkt Zustimmung erst gemeinsam', () => {
  const code = api('/api/cms/parent/sponsor-contact-create', tina, { childId: 'child-tom', label: 'Großtante Greta' });
  const req = api('/api/cms/sponsor/request-create', greta, { contactCode: code.data.contactCode, purpose: 'Lese-Patenschaft', periodDays: 90, requestId: 'req-tom-1' });
  spnTom = req.data.sponsorshipId;
  const first = api('/api/cms/parent/sponsor-request-decision', tina, { sponsorshipId: spnTom, approve: true });
  assert.strictEqual(first.data.status, 'requested', 'Erste von zwei Zustimmungen darf nicht aktivieren');
  assert.deepStrictEqual(first.data.pendingApprovals, ['parent-tom-b']);
  assert.strictEqual(api('/api/cms/sponsor/progress', greta, { sponsorshipId: spnTom }).status, 403);
  // Zweiter Elternteil doppelt abstimmen ändert nichts am Quorum-Stand.
  api('/api/cms/parent/sponsor-request-decision', tina, { sponsorshipId: spnTom, approve: true });
  assert.strictEqual(db.sponsorships.find(s => s.id === spnTom).status, 'requested');
  const second = api('/api/cms/parent/sponsor-request-decision', tim, { sponsorshipId: spnTom, approve: true });
  assert.strictEqual(second.data.status, 'active');
});
check('Sponsor darf keine Leistungen oder Punkte verändern', () => {
  assert.strictEqual(api('/api/cms/parent/sponsor-performance-recognize', fritz, { childId: 'child-finn', metricKey: 'math.tasks', value: 50 }).status, 403);
  assert.strictEqual(db.performanceLedger.filter(e => e.childId === 'child-finn').length, 0, 'Sponsor hat Ledger-Eintrag erzeugt');
});
let agFinn = null, claimKey = null;
check('Vereinbarung: erst wirksam, wenn alle Eltern UND Sponsor derselben Version zustimmen', () => {
  // Elterliche Leistungsanerkennung → 7 Punkte (Wert 7 × 1 Punkt/Einheit).
  assert.strictEqual(api('/api/cms/parent/sponsor-performance-recognize', martin, { childId: 'child-finn', metricKey: 'math.tasks', value: 7, note: 'Rechenblatt' }).status, 200);
  assert.strictEqual(db.performanceLedger.find(e => e.childId === 'child-finn').verification, 'guardian-confirmed');
  const prop = api('/api/cms/sponsor/agreement-propose', fritz, { sponsorshipId: spnFinn, terms: { metricKeys: ['math.tasks'], pointsTarget: 5, rewardText: 'Eis essen gehen', consumePoints: false } });
  assert.strictEqual(prop.status, 200, JSON.stringify(prop.data));
  agFinn = prop.data.agreementId;
  // Sponsor hat als Vorschlagender zugestimmt — Eltern fehlen noch.
  const noEffect = api('/api/cms/sponsorship/agreements', martin, { sponsorshipId: spnFinn });
  assert.strictEqual(noEffect.data.items.find(a => a.id === agFinn).activeVersion, 0);
  const con = api('/api/cms/parent/sponsor-agreement-consent', martin, { agreementId: agFinn, version: 1, approve: true });
  assert.strictEqual(con.data.status, 'active', JSON.stringify(con.data));
  assert.strictEqual(db.sponsorAgreements.find(a => a.id === agFinn).activeVersion, 1);
});
check('Anspruch genau einmal; Einlösen → Elternfreigabe → zweistufige Erfüllung', () => {
  // Aktivierung bewertete 7 ≥ 5 bereits → Anspruch 'earned' vorhanden.
  const claims = db.rewardClaims.filter(c => c.sponsorshipId === spnFinn);
  assert.strictEqual(claims.length, 1, 'genau ein Anspruch erwartet');
  claimKey = claims[0].entitlementKey;
  assert.strictEqual(claims[0].status, 'earned');
  // Einlösen nur durch Kind/Eltern; Sponsor wird abgewiesen.
  assert.strictEqual(api('/api/cms/sponsor/rewards', fritz, { claimKey }).status, 200); // Pflichtenliste lesbar
  const reqClaim = api('/api/cms/child/sponsorship/reward-request', finn, { claimKey });
  assert.strictEqual(reqClaim.status, 200, JSON.stringify(reqClaim.data));
  assert.strictEqual(db.rewardClaims[0].status, 'requested');
  // Eltern geben frei → Sponsor meldet Erfüllung → Eltern bestätigen.
  assert.strictEqual(api('/api/cms/parent/sponsor-reward-decision', martin, { claimKey, approve: true }).status, 200);
  assert.strictEqual(db.rewardClaims[0].status, 'released');
  assert.strictEqual(api('/api/cms/sponsor/reward-fulfillment', fritz, { claimKey, note: 'Eis gekauft' }).status, 200);
  assert.strictEqual(api('/api/cms/parent/sponsor-fulfillment-confirm', martin, { claimKey }).status, 200);
  assert.strictEqual(db.rewardClaims[0].status, 'fulfilled');
  const confirmedAt = db.rewardClaims[0].fulfilledAt;
  api('/api/cms/parent/sponsor-fulfillment-confirm', martin, { claimKey });
  assert.strictEqual(db.rewardClaims[0].fulfilledAt, confirmedAt, 'doppelte Bestätigung verändert den Anspruch');
});
check('Pause sperrt Sponsor sofort; kindseitige Pause löst nur das Kind', () => {
  api('/api/cms/child/sponsorship/pause', finn, { sponsorshipId: spnFinn });
  assert.strictEqual(db.sponsorships.find(s => s.id === spnFinn).status, 'paused');
  assert.strictEqual(api('/api/cms/sponsor/progress', fritz, { sponsorshipId: spnFinn }).status, 403);
  assert.strictEqual(api('/api/cms/parent/sponsor-resume', martin, { sponsorshipId: spnFinn }).status, 403);
  assert.strictEqual(api('/api/cms/child/sponsorship/resume', finn, { sponsorshipId: spnFinn, accept: true }).status, 200);
  assert.strictEqual(api('/api/cms/sponsor/progress', fritz, { sponsorshipId: spnFinn }).status, 200);
});
check('Beendigung entzieht Zugriff sofort; Ansprüche und Historie bleiben', () => {
  assert.strictEqual(api('/api/cms/parent/sponsor-end', martin, { sponsorshipId: spnFinn, reason: 'Laufzeit vorbei' }).status, 200);
  assert.strictEqual(api('/api/cms/sponsor/progress', fritz, { sponsorshipId: spnFinn }).status, 403);
  assert.strictEqual(api('/api/cms/sponsor/messages', fritz, { sponsorshipId: spnFinn }).data.items.length, 0);
  const parentView = api('/api/cms/parent/sponsorships', martin, { childId: 'child-finn', sponsorshipId: spnFinn });
  assert.strictEqual(parentView.data.items[0].status, 'ended');
  assert.strictEqual(db.rewardClaims[0].status, 'fulfilled', 'erfüllter Anspruch verloren');
  assert.ok(api('/api/cms/parent/sponsor-history', martin, { sponsorshipId: spnFinn }).data.items.length >= 4, 'Historie unvollständig');
});
check('Kind sieht Begleiter und kann ablehnen', () => {
  const list = api('/api/cms/child/sponsorship/list', finn, {});
  assert.ok(list.data.items.some(i => i.id === spnFinn), 'Kind sieht eigene Begleitung nicht');
  // Tom lehnt die aktive Begleitung ab → sofortiger Zugriffsentzug.
  assert.strictEqual(api('/api/cms/child/sponsorship/decline', tom, { sponsorshipId: spnTom, accept: false }).status, 200);
  assert.strictEqual(db.sponsorships.find(s => s.id === spnTom).status, 'rejected');
  assert.strictEqual(api('/api/cms/sponsor/progress', greta, { sponsorshipId: spnTom }).status, 403);
});
check('Mitteilungen sind familiensichtbar — kein Privatkanal', () => {
  api('/api/cms/child/sponsorship/resume', finn, { sponsorshipId: spnFinn, accept: true }); // ended → 409, harmlos
  const send = api('/api/cms/parent/sponsor-message-send', martin, { sponsorshipId: spnFinn, targetType: 'sponsorship', targetId: spnFinn, text: 'Danke für die Begleitung!' });
  assert.strictEqual(send.status, 200);
  const view = api('/api/cms/parent/sponsor-messages', martin, { sponsorshipId: spnFinn });
  assert.ok(view.data.items.some(m => m.text.includes('Danke')), 'Eltern sehen die Mitteilung nicht');
});
check('Sponsor-Sicht zeigt nur Feld-Allowlist, keine Rohdaten', () => {
  const list = api('/api/cms/sponsor/companionships', fritz, {});
  const item = list.data.items.find(i => i.id === spnFinn);
  for (const k of ['purpose', 'notes', 'requiredGuardianIds', 'capabilityId']) assert.ok(!(k in item), 'Sponsor sieht internes Feld: ' + k);
  const prog = api('/api/cms/parent/sponsor-progress', martin, { sponsorshipId: spnFinn });
  const json = JSON.stringify(prog.data);
  for (const forbidden of ['question', 'answers', 'hints_used']) assert.ok(!json.includes(forbidden), 'Rohinhalt in Fortschrittssicht: ' + forbidden);
});
check('Eltern erhalten Benachrichtigungen über Anfragen und Meilensteine', () => {
  const n = api('/api/cms/account/notifications', martin, {});
  const types = n.data.items.map(x => x.type);
  assert.ok(types.includes('sponsor-request'), 'Anfrage-Meldung fehlt');
  assert.ok(types.includes('sponsor-claim-earned'), 'Anspruchs-Meldung fehlt');
});

let failed = 0;
for (const [s, n] of results) { if (s !== 'OK') failed++; console.log(s, n); }
console.log(JSON.stringify({ passed: results.length - failed, failed }));
fs.rmSync(dir, { recursive: true, force: true });
process.exit(failed ? 1 : 0);

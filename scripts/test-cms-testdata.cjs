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

let failed = 0;
for (const [s, n] of results) { if (s !== 'OK') failed++; console.log(s, n); }
console.log(JSON.stringify({ passed: results.length - failed, failed }));
fs.rmSync(dir, { recursive: true, force: true });
process.exit(failed ? 1 : 0);

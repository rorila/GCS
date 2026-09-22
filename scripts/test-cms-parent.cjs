// Phase-2-Tests: Eltern-/Beobachter-Workflow (E01/E02/E06).
// Deckt Einladung, Zweitbestätigung, Elternsicht, Zeitbudget und
// sämtliche negativen Berechtigungsfälle ab — auf Modulebene, ohne Server.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto'), assert = require('node:assert');
const { createJsonStore } = require('./cms/cms-store.cjs');
const { createCore } = require('./cms/cms-core.cjs');
const { houseApi } = require('./cms/cms-house.cjs');
const { createParent, enrollParent, enrollObserver } = require('./cms/cms-parent.cjs');
const { createAdmin } = require('./cms/cms-admin.cjs');
const { buildDb, TEST_PASSWORD } = require('./cms/cms-seed-testdata.cjs');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-parent-'));
const dataPath = path.join(dir, 'cms.json');
const credentialPath = path.join(dir, 'cms-admin-auth.json');
fs.writeFileSync(dataPath, JSON.stringify(buildDb()));
fs.writeFileSync(credentialPath, '[]');
const store = createJsonStore({ dataPath });
const core = createCore(store.load());
const db = core.db;
const commit = (s, action, areaId, change) => store.commit(db, { actor: s.personId, action, areaId }, change);
const parent = createParent(core, credentialPath, store);

const results = [];
const check = (name, fn) => Promise.resolve().then(fn).then(() => results.push(['OK', name])).catch(e => results.push(['FEHLER', name + ' :: ' + e.message]));
const adminSession = id => ({ personId: id, assurance: 'admin' });
const accountSession = id => core.session(core.issueSession(id, 'account'));
const fakeReq = { socket: { remoteAddress: '127.0.0.1' } };
const enroll = (ticket, username) => enrollParent(core, credentialPath, ticket, username, TEST_PASSWORD + '-neu', commit);
const api = (sess, route, b = {}) => parent.api(sess, route, b);
const house = (sess, route, b = {}) => houseApi(core, sess, route, b, commit);

(async () => {

// --- Einladung durch HouseAdmin (E02, erster Schritt) ---
let inviteLink, inviteToken;
await check('parent-invite: HouseAdmin erzeugt gehashte, befristete Einladung', () => {
  const r = house(adminSession('admin-sun'), 'parent-invite', { houseId: 'house-sun', name: 'Neue Mutter', childId: 'child-emil' });
  assert.strictEqual(r.status, 200);
  inviteLink = r.data.link;
  inviteToken = inviteLink.split('ticket=')[1];
  const tokenHash = crypto.createHash('sha256').update(inviteToken).digest('hex');
  const inv = db.invites.find(i => i.hash === tokenHash);
  assert.ok(inv && inv.purpose === 'parent' && inv.childId === 'child-emil', 'Einladung gespeichert');
  assert.ok(!db.invites.some(i => i.hash === inviteToken), 'kein Klartext-Token in der Datenbank');
  assert.ok(inv.expires - Date.now() <= 86400000 && inv.expires > Date.now(), '24h gültig');
  const g = db.guardians.find(g => g.childId === 'child-emil' && g.guardianId === inv.personId);
  assert.strictEqual(g.status, 'pending');
});

await check('parent-invite: ohne Raumkontext (areaId) möglich', () => assert.ok(inviteLink, 'Route lief ohne areaId'));

await check('parent-invite: fremdes Haus wird abgewiesen', () => {
  const r = house(adminSession('admin-sun'), 'parent-invite', { houseId: 'house-moon', name: 'X', childId: 'child-mia' });
  assert.strictEqual(r.status, 403);
});

await check('parent-invite: Kind aus fremdem Haus wird abgewiesen', () => {
  const r = house(adminSession('admin-sun'), 'parent-invite', { houseId: 'house-sun', name: 'X', childId: 'child-mia' });
  assert.strictEqual(r.status, 403);
});

await check('parent-invite: Nicht-Admin wird abgewiesen', () => {
  const r = house(adminSession('teacher-sun'), 'parent-invite', { houseId: 'house-sun', name: 'X', childId: 'child-finn' });
  assert.strictEqual(r.status, 403);
});

// --- Einladung einlösen (E02, zweiter Schritt) ---
await check('enroll: gültiger Link richtet Zugang ein und bestätigt Zuordnung', () => {
  const r = enroll(inviteToken, 'eltern-neu');
  assert.ok(r.ok, r.message);
  const inv = db.invites.find(i => i.hash === crypto.createHash('sha256').update(inviteToken).digest('hex'));
  assert.ok(inv.usedAt, 'Link als verwendet markiert');
  const g = db.guardians.find(g => g.childId === 'child-emil' && g.guardianId === inv.personId);
  assert.strictEqual(g.status, 'confirmed', 'Zuordnung bestätigt');
  assert.ok(g.confirmedAt);
});

await check('enroll: Link ist nach Verwendung ungültig', () => {
  const r = enroll(inviteToken, 'eltern-zweit');
  assert.ok(!r.ok);
});

await check('enroll: abgelaufener Link wird abgelehnt', () => {
  assert.ok(!enroll('test-token-expired', 'eltern-tim2').ok);
});

await check('enroll: bereits verwendeter Link wird abgelehnt', () => {
  assert.ok(!enroll('test-token-used', 'eltern-tina2').ok);
});

await check('enroll: fremder/erfundener Token wird abgelehnt', () => {
  assert.ok(!enroll('a'.repeat(64), 'eltern-fake').ok);
});

// --- Eltern-Login und Sicht (E01) ---
let linaSession;
await check('account-login: Elternteil erhält Kontositzung (kein Admin-Zugang)', async () => {
  // Zugang für parent-lina anlegen (wie nach echtem Enroll)
  const entries = [{ personId: 'parent-lina', username: 'eltern.petra', salt: 's'.repeat(32), hash: crypto.scryptSync(TEST_PASSWORD, 's'.repeat(32), 64).toString('hex') }];
  fs.writeFileSync(credentialPath, JSON.stringify(entries));
  const r = await parent.login(fakeReq, { username: 'eltern.petra', password: TEST_PASSWORD });
  assert.ok(r.token, r.error);
  linaSession = core.session(r.token);
  assert.strictEqual(linaSession.assurance, 'account');
  assert.ok(!core.can(linaSession, 'manageArea', { areaId: 'house-sun' }), 'keine Verwaltungsrechte');
});

await check('account-login: falsches Passwort wird abgelehnt', async () => {
  const r = await parent.login(fakeReq, { username: 'eltern.petra', password: 'falsch-falsch-falsch' });
  assert.ok(r.error);
});

await check('my-children: nur bestätigte eigene Kinder', () => {
  const r = api(linaSession, 'my-children');
  const ids = r.data.items.map(i => i.id);
  assert.deepStrictEqual(ids, ['child-lina']);
  // pending-Zuordnung (child-mia) darf nicht auftauchen
  assert.ok(!ids.includes('child-mia'));
});

await check('child-activity: eigenes Kind liefert Spielzeit und aktuelles Spiel', () => {
  const r = api(linaSession, 'child-activity', { childId: 'child-lina' });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.playing.title, 'Mathe-Abenteuer');
  assert.ok(r.data.todayMinutes > 0);
});

await check('child-activity: fremdes Kind → 403', () => {
  assert.strictEqual(api(linaSession, 'child-activity', { childId: 'child-tom' }).status, 403);
});

await check('child-activity: Kind aus fremdem Haus → 403', () => {
  assert.strictEqual(api(linaSession, 'child-activity', { childId: 'child-mia' }).status, 403);
});

await check('child-progress: eigene Bewertungen sichtbar', () => {
  const r = api(linaSession, 'child-progress', { childId: 'child-lina' });
  assert.strictEqual(r.status, 200);
  assert.ok(r.data.items.length >= 4);
});

await check('child-progress: fremdes Kind → 403', () => {
  assert.strictEqual(api(linaSession, 'child-progress', { childId: 'child-finn' }).status, 403);
});

await check('pending-Zuordnung gewährt keine Sicht', () => {
  assert.strictEqual(api(linaSession, 'child-activity', { childId: 'child-mia' }).status, 403);
});

// --- Selbstzuordnung + Zweitbestätigung (E02) ---
await check('Selbsteinladung bleibt nach Enroll pending (Zweitbestätigung nötig)', () => {
  const r = house(adminSession('admin-parent'), 'parent-invite', { houseId: 'house-sun', name: 'Paul HausAdmin', childId: 'child-tom', personId: 'admin-parent' });
  assert.strictEqual(r.status, 200);
  const er = enrollParent(core, credentialPath, r.data.link.split('ticket=')[1], 'admin-paul', TEST_PASSWORD + '-paul', commit);
  assert.ok(er.ok, er.message);
  assert.ok(er.message.includes('zweiten Verantwortlichen'), 'Hinweis auf Zweitbestätigung');
  const g = db.guardians.find(g => g.childId === 'child-tom' && g.guardianId === 'admin-parent');
  assert.strictEqual(g.status, 'pending', 'Selbsteinladung darf nicht selbst bestätigen');
});

await check('guardian-approve: eigene Zuordnung nicht selbst bestätigbar', () => {
  const r = house(adminSession('admin-parent'), 'guardian-approve', { houseId: 'house-sun', childId: 'child-tom', guardianId: 'admin-parent' });
  assert.strictEqual(r.status, 409);
  assert.strictEqual(db.guardians.find(g => g.childId === 'child-tom' && g.guardianId === 'admin-parent').status, 'pending');
});

await check('guardian-approve: zweiter Verantwortlicher bestätigt', () => {
  const r = house(adminSession('admin-sun'), 'guardian-approve', { houseId: 'house-sun', childId: 'child-tom', guardianId: 'admin-parent' });
  assert.strictEqual(r.status, 200);
  const g = db.guardians.find(g => g.childId === 'child-tom' && g.guardianId === 'admin-parent');
  assert.strictEqual(g.status, 'confirmed');
  assert.strictEqual(g.confirmedBy, 'admin-sun');
});

await check('guardian-approve: ohne Hauszuständigkeit → 403', () => {
  const r = house(adminSession('admin-moon'), 'guardian-approve', { houseId: 'house-sun', childId: 'child-tom', guardianId: 'x' });
  assert.strictEqual(r.status, 403);
});

// --- Widerruf entzieht Sicht ---
await check('Widerruf: revoked-Beziehung entfernt die Sicht sofort', () => {
  const sess = accountSession('parent-lina');
  assert.strictEqual(api(sess, 'child-activity', { childId: 'child-lina' }).status, 200);
  store.commit(db, { actor: 'admin-sun', action: 'guardian-revoke', areaId: 'house-sun' }, next => {
    const g = next.guardians.find(g => g.childId === 'child-lina' && g.guardianId === 'parent-lina');
    g.status = 'revoked'; g.revokedAt = new Date().toISOString();
  });
  assert.strictEqual(api(sess, 'child-activity', { childId: 'child-lina' }).status, 403);
  assert.deepStrictEqual(api(sess, 'my-children').data.items, []);
});

// --- Beobachter (E01): nur aggregiert ---
await check('Beobachter: room-pulse liefert nur aggregierte Zahlen', () => {
  const r = api(accountSession('observer-sun'), 'room-pulse', { areaId: 'room-sun-play' });
  assert.strictEqual(r.status, 200);
  assert.ok(typeof r.data.connected === 'number' && typeof r.data.playing === 'number');
  assert.ok(!('items' in r.data) && !('names' in r.data), 'keine Personendaten');
});

await check('Beobachter: fremder Raum → 403', () => {
  assert.strictEqual(api(accountSession('observer-sun'), 'room-pulse', { areaId: 'room-moon-play' }).status, 403);
});

await check('Beobachter: keine privaten Bewertungen', () => {
  assert.strictEqual(api(accountSession('observer-sun'), 'child-progress', { childId: 'child-lina' }).status, 403);
});

await check('Nicht-Beobachter: room-pulse → 403', () => {
  assert.strictEqual(api(accountSession('parent-lina'), 'room-pulse', { areaId: 'room-sun-play' }).status, 403);
});

// --- Mehrfachrolle: admin-parent ist HausAdmin UND Elternteil ---
await check('Mehrfachrolle: Elternsicht nur über Guardian, nicht über areaAdmin', () => {
  const sess = accountSession('admin-parent');
  const ids = api(sess, 'my-children').data.items.map(i => i.id);
  assert.deepStrictEqual(ids.sort(), ['child-lina', 'child-tom'], 'nur bestätigte Zuordnungen');
  assert.strictEqual(api(sess, 'child-activity', { childId: 'child-finn' }).status, 403);
});

// --- Zeitbudget (E06): Verschärfung sofort, Lockerung nur mit Zweitbestätigung ---
await check('set-budget: einzelner Elternteil setzt sofort', () => {
  const r = api(accountSession('parent-multi'), 'set-budget', { childId: 'child-finn', dailyMinutes: 40 });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(db.timeBudgets.find(t => t.childId === 'child-finn').dailyMinutes, 40);
});

await check('set-budget: Verschärfung wirkt sofort auch bei zwei Eltern', () => {
  const r = api(accountSession('parent-tom-a'), 'set-budget', { childId: 'child-tom', dailyMinutes: 20 });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(db.timeBudgets.find(t => t.childId === 'child-tom').dailyMinutes, 20);
});

await check('set-budget: Lockerung braucht zweites Elternteil', () => {
  const r = api(accountSession('parent-tom-a'), 'set-budget', { childId: 'child-tom', dailyMinutes: 60 });
  assert.strictEqual(r.status, 200);
  assert.ok(r.data.pending, 'als ausstehend markiert');
  assert.strictEqual(db.timeBudgets.find(t => t.childId === 'child-tom').dailyMinutes, 20, 'strengeres Budget bleibt aktiv');
});

await check('approve-budget: eigener Vorschlag nicht selbst bestätigbar', () => {
  assert.strictEqual(api(accountSession('parent-tom-a'), 'approve-budget', { childId: 'child-tom' }).status, 409);
});

await check('approve-budget: zweites Elternteil bestätigt Lockerung', () => {
  const r = api(accountSession('parent-tom-b'), 'approve-budget', { childId: 'child-tom' });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(db.timeBudgets.find(t => t.childId === 'child-tom').dailyMinutes, 60);
});

await check('set-budget: fremdes Kind → 403', () => {
  assert.strictEqual(api(accountSession('parent-tom-a'), 'set-budget', { childId: 'child-lina', dailyMinutes: 5 }).status, 403);
});

// --- Direktaufrufe mit manipulierten IDs ---
await check('Manipulierte IDs: nichtexistierendes Kind → 403', () => {
  assert.strictEqual(api(linaSession, 'child-activity', { childId: 'child-nonexistent' }).status, 403);
});

await check('Unbekannte Route → 404 (mit berechtigtem Kind)', () => {
  assert.strictEqual(api(accountSession('parent-tom-b'), 'admin-backdoor', { childId: 'child-tom' }).status, 404);
  // ohne Berechtigung greift die 403-Hürde zuerst
  assert.strictEqual(api(linaSession, 'admin-backdoor').status, 403);
});

// --- Observer-Einladung: eigener Pfad, kein Kindbezug ---
let observerLink;
await check('observer-invite: HouseAdmin lädt Beobachter für eigenen Raum ein', () => {
  const r = house(adminSession('admin-sun'), 'observer-invite', { houseId: 'house-sun', areaId: 'room-sun-play', name: 'Neue Beobachterin' });
  assert.strictEqual(r.status, 200);
  observerLink = r.data.link;
  const tokenHash = crypto.createHash('sha256').update(observerLink.split('ticket=')[1]).digest('hex');
  const inv = db.invites.find(i => i.hash === tokenHash);
  assert.ok(inv && inv.purpose === 'observer' && inv.areaId === 'room-sun-play' && !inv.childId, 'Observer-Einladung ohne Kindbezug');
});

await check('observer-invite: fremdes Haus → 403', () => {
  assert.strictEqual(house(adminSession('admin-sun'), 'observer-invite', { houseId: 'house-moon', areaId: 'room-moon-play', name: 'X' }).status, 403);
});

await check('enrollObserver: Zugang anlegen aktiviert Beobachterrolle', () => {
  const r = enrollObserver(core, credentialPath, observerLink.split('ticket=')[1], 'beob-neu', TEST_PASSWORD + '-neu', commit);
  assert.strictEqual(r.ok, true);
  const inv = db.invites.find(i => i.link === undefined && i.purpose === 'observer' && i.usedAt);
  assert.ok(inv, 'Einladung als verwendet markiert');
  assert.ok(db.roles.some(x => x.personId === inv.personId && x.role === 'observer' && x.areaId === 'room-sun-play' && x.active), 'Beobachterrolle aktiv');
  assert.ok(!db.guardians.some(g => g.guardianId === inv.personId), 'keine Guardian-Beziehung erzeugt');
});

await check('enrollObserver: Ticket nur einmal nutzbar', () => {
  const r = enrollObserver(core, credentialPath, observerLink.split('ticket=')[1], 'beob.nochmal', TEST_PASSWORD + '-neu', commit);
  assert.strictEqual(r.ok, false);
});

await check('enrollObserver: falscher Token wird abgewiesen', () => {
  const r = enrollObserver(core, credentialPath, 'a'.repeat(64), 'beob.x', TEST_PASSWORD + '-neu', commit);
  assert.strictEqual(r.ok, false);
});

// --- HouseAdmin-Listen für die Stage ---
await check('house-children: nur aktive Kinder des eigenen Hauses', () => {
  const r = house(adminSession('admin-sun'), 'house-children', { houseId: 'house-sun' });
  assert.strictEqual(r.status, 200);
  assert.ok(r.data.items.length >= 2 && r.data.items.every(i => i.id && i.label), 'flache Kartenliste');
  assert.ok(!r.data.items.some(i => i.id === 'child-mia'), 'kein Kind aus fremdem Haus');
});

await check('guardian-pending: Composite-IDs für die Tabelle', () => {
  const r = house(adminSession('admin-sun'), 'guardian-pending', { houseId: 'house-sun' });
  assert.strictEqual(r.status, 200);
  const pending = db.guardians.filter(g => g.status === 'pending' && db.people.find(p => p.id === g.childId)?.houseId === undefined || g.status === 'pending');
  assert.ok(r.data.items.every(i => i.id.includes(':') && i.childId && i.guardianId), 'id = childId:guardianId');
});

// --- Kontext-Login (gemeinsamer Erwachsenen-Login) ---
// parent-lina ist hier unbrauchbar (Zuordnung wurde oben widerrufen) —
// parent-tom-a hat weiterhin eine bestätigte Beziehung zu child-tom.
const admin = createAdmin(core, dataPath, { store });
{
  const creds = JSON.parse(fs.readFileSync(credentialPath, 'utf8'));
  const salt = crypto.randomBytes(16).toString('hex');
  creds.push({ personId: 'parent-tom-a', username: 'eltern.tom', salt, hash: crypto.scryptSync(TEST_PASSWORD, salt, 64).toString('hex') });
  fs.writeFileSync(credentialPath, JSON.stringify(creds));
}
await check('Kontext-Login: Elternteil ohne Verwaltung → parent-Kontext, kein Admin-Token', async () => {
  const r = await admin.login(fakeReq, { username: 'eltern.tom', password: TEST_PASSWORD });
  assert.ok(r.personId && !r.token, 'keine Verwaltungssitzung');
  assert.deepStrictEqual(r.contexts, ['parent']);
});

await check('Kontext-Login: Beobachter → observer-Kontext', async () => {
  const r = await admin.login(fakeReq, { username: 'beob-neu', password: TEST_PASSWORD + '-neu' });
  assert.ok(r.personId && !r.token);
  assert.deepStrictEqual(r.contexts, ['observer']);
});

await check('Kontext-Login: HouseAdmin+Elternteil → admin und parent', async () => {
  const creds = JSON.parse(fs.readFileSync(credentialPath, 'utf8'));
  const salt = crypto.randomBytes(16).toString('hex');
  creds.push({ personId: 'admin-parent', username: 'admin.paul', salt, hash: crypto.scryptSync(TEST_PASSWORD, salt, 64).toString('hex') });
  fs.writeFileSync(credentialPath, JSON.stringify(creds));
  const r = await admin.login(fakeReq, { username: 'admin.paul', password: TEST_PASSWORD });
  assert.ok(r.token, 'Verwaltungssitzung ausgestellt');
  assert.ok(r.contexts.includes('admin') && r.contexts.includes('parent'), 'beide Kontexte gemeldet');
});

await check('Kontext-Login: falsches Passwort → generischer Fehler', async () => {
  const r = await admin.login(fakeReq, { username: 'eltern.tom', password: 'falsch-falsch-falsch' });
  assert.ok(r.error && !r.personId);
});

// --- Integrität: Endpunkte und Tasks sind in der Projektdatei verdrahtet ---
const cmsFile = path.resolve('game-server/public/projects/GCS-CMS.json');
await check('Runtime: alle Eltern-Endpunkte registriert', () => {
  const rt = require('./cms/cms-runtime.cjs').loadRuntime(cmsFile);
  for (const r of ['my-children', 'child-activity', 'child-progress', 'set-budget', 'approve-budget', 'room-pulse'])
    assert.ok(rt.find('/api/cms/parent/' + r, 'POST'), 'fehlt: ' + r);
});
await check('Integrität: stage_server_parent ist vollständig verdrahtet', () => {
  const project = JSON.parse(fs.readFileSync(cmsFile, 'utf8'));
  const issues = require('./cms/cms-project.cjs').checkIntegrity(project);
  assert.deepStrictEqual(issues.filter(i => i.level === 'fehler'), []);
});
await check('Runtime: fehlender Task wird als Serverfehler gemeldet', () => {
  const broken = JSON.parse(fs.readFileSync(cmsFile, 'utf8'));
  broken.stages.find(s => s.id === 'stage_server_parent').objects
    .find(o => o.className === 'TServerEndpoint' && o.endpointPath === '/api/cms/parent/my-children')
    .events.onRequest = 'GibtEsNicht';
  const tmp = path.join(dir, 'broken.json');
  fs.writeFileSync(tmp, JSON.stringify(broken));
  const rt = require('./cms/cms-runtime.cjs').loadRuntime(tmp);
  const r = rt.run(rt.find('/api/cms/parent/my-children', 'POST'),
    { session: accountSession('parent-lina'), body: {}, core, commit, credentialPath });
  assert.strictEqual(r.status, 500);
});

const failed = results.filter(r => r[0] === 'FEHLER');
for (const [s, n] of results) console.log(s.padEnd(7), n);
console.log(`\n${results.length - failed.length}/${results.length} bestanden`);
process.exit(failed.length ? 1 : 0);
})();

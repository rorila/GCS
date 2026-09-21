// Erzeugt synthetische CMS-Testdaten (Schema v2) + Test-Zugangsdaten.
// Niemals produktive Daten: eigene Ausgabedateien, explizites Zielverzeichnis.
// Aufruf: node scripts/cms/cms-seed-testdata.cjs [zielverzeichnis]
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { validate } = require('./cms-core.cjs');

const TEST_PASSWORD = 'Nur-Fuer-Tests!2025'; // dokumentiertes Test-Passwort, kein Geheimnis
const H = 3600000, D = 24 * H, MIN = 60000;
const iso = t => new Date(t).toISOString();
const hash = s => crypto.createHash('sha256').update(s).digest('hex');

// Zeitabhängige Daten sind relativ zu `now` — Tests rufen buildDb(Date.now())
// für immer frische Werte auf; die JSON-Datei ist das inspizierbare Artefakt.
function buildDb(now = Date.now()) {
  const NOW = now;

const person = (id, name, kind, extra = {}) => ({ id, name, avatar: extra.avatar || '👤', kind, active: extra.active !== false, ...extra });
const role = (personId, areaId, r, active = true) => ({ personId, areaId, role: r, active });
const member = (personId, areaId, active = true) => ({ personId, areaId, active });
const guardian = (childId, guardianId, status = 'confirmed', extra = {}) => ({
  childId, guardianId, status, createdAt: iso(NOW - 30 * D), confirmedBy: extra.confirmedBy ?? 'admin-sun', revokedAt: status === 'revoked' ? iso(NOW - 5 * D) : null, ...extra,
});
const code = (personId, areaId, seq) => ({ personId, areaId, sequence: seq });

const db = {
  version: 2,
  areas: [
    { id: 'root', name: 'Plattform', type: 'root', parentId: null, active: true },
    { id: 'house-sun', name: 'Haus Sonne', type: 'house', parentId: 'root', active: true, avatar: '🏡' },
    { id: 'house-moon', name: 'Haus Mond', type: 'house', parentId: 'root', active: true, avatar: '🏠' },
    { id: 'house-closed', name: 'Haus Nacht (geschlossen)', type: 'house', parentId: 'root', active: false, avatar: '🌙' },
    { id: 'room-sun-play', name: 'Spielraum', type: 'room', parentId: 'house-sun', active: true, avatar: '🎲' },
    { id: 'room-sun-learn', name: 'Lernraum', type: 'room', parentId: 'house-sun', active: true, avatar: '📚' },
    { id: 'room-sun-closed', name: 'Alter Raum (deaktiviert)', type: 'room', parentId: 'house-sun', active: false, avatar: '🚪' },
    { id: 'room-moon-play', name: 'Mondspielraum', type: 'room', parentId: 'house-moon', active: true, avatar: '🌙' },
  ],
  people: [
    person('super-admin', 'Sara SuperAdmin', 'adult'),
    person('admin-sun', 'Anna HausAdmin Sonne', 'adult'),
    person('admin-parent', 'Paul HausAdmin + Vater', 'adult'),
    person('admin-moon', 'Mia HausAdmin Mond', 'adult'),
    person('teacher-sun', 'Tobias Erzieher', 'adult'),
    person('observer-sun', 'Olga Beobachterin', 'adult'),
    person('parent-lina', 'Petra Mutter von Lina', 'adult'),
    person('parent-multi', 'Martin Vater von zwei Kindern', 'adult'),
    person('parent-tom-a', 'Tina Mutter von Tom', 'adult'),
    person('parent-tom-b', 'Tim Vater von Tom', 'adult'),
    person('adult-revoked', 'Rita früherer Kontakt', 'adult'),
    person('child-lina', 'Lina', 'child', { avatar: '🦉' }),
    person('child-tom', 'Tom', 'child', { avatar: '🐘' }),
    person('child-finn', 'Finn', 'child', { avatar: '🐷' }),
    person('child-emil', 'Emil', 'child', { avatar: '🐱' }),
    person('child-mia', 'Mia (Mond)', 'child', { avatar: '🌷' }),
    person('child-suspended', 'Sven gesperrt', 'child', { active: false }),
    person('child-left', 'Lea ausgetreten', 'child'),
  ],
  memberships: [
    member('child-lina', 'room-sun-play'), member('child-lina', 'room-sun-learn'),
    member('child-tom', 'room-sun-play'),
    member('child-finn', 'room-sun-play'),
    member('child-emil', 'room-sun-learn'),
    member('child-mia', 'room-moon-play'),
    member('child-suspended', 'room-sun-play'),
    member('child-left', 'room-sun-play', false),
  ],
  roles: [
    role('super-admin', 'root', 'superAdmin'),
    role('admin-sun', 'house-sun', 'areaAdmin'),
    role('admin-parent', 'house-sun', 'areaAdmin'),
    role('admin-moon', 'house-moon', 'areaAdmin'),
    role('teacher-sun', 'room-sun-play', 'areaAdmin'),
    role('observer-sun', 'room-sun-play', 'observer'),
    role('child-lina', 'room-sun-play', 'player'), role('child-lina', 'room-sun-learn', 'player'),
    role('child-tom', 'room-sun-play', 'player'), role('child-finn', 'room-sun-play', 'player'),
    role('child-emil', 'room-sun-learn', 'player'), role('child-mia', 'room-moon-play', 'player'),
  ],
  guardians: [
    guardian('child-lina', 'parent-lina'),
    guardian('child-lina', 'admin-parent'),               // HouseAdmin ist zugleich Elternteil
    guardian('child-finn', 'parent-multi'),
    guardian('child-emil', 'parent-multi'),               // Eltern mit mehreren Kindern
    guardian('child-tom', 'parent-tom-a'),
    guardian('child-tom', 'parent-tom-b'),                // Kind mit zwei Elternteilen
    guardian('child-tom', 'adult-revoked', 'revoked'),    // widerrufene Zuordnung
    guardian('child-mia', 'parent-lina', 'pending'),      // wartet auf zweite Bestätigung
    guardian('child-emil', 'parent-tom-b', 'pending'),    // passend zu inv-valid
  ],
  codes: [
    code('child-lina', 'house-sun', ['dog', 'cat', 'tree', 'house']),
    code('child-tom', 'house-sun', ['owl', 'flower', 'pig', 'elephant']),
    code('child-finn', 'house-sun', ['cat', 'dog', 'flower', 'tree']),
    code('child-emil', 'house-sun', ['house', 'tree', 'owl', 'pig']),
    code('child-mia', 'house-moon', ['dog', 'cat', 'tree', 'house']), // gleiche Folge, anderes Haus erlaubt
    code('child-suspended', 'house-sun', ['pig', 'pig', 'pig', 'pig']),
    code('child-left', 'house-sun', ['flower', 'flower', 'flower', 'flower']),
  ],
  games: [
    { id: 'game-snake', title: 'Snake', avatar: '🐍', ownerId: 'super-admin', status: 'published', file: 'Snake-Lernprojekt.json', ratings: false },
    { id: 'game-math', title: 'Mathe-Abenteuer', avatar: '🧮', ownerId: 'super-admin', status: 'published', file: 'Kopfrechnen.json', ratings: true, metrics: ['tasks_done', 'tasks_correct', 'hints_used', 'round_complete'] },
    { id: 'game-mp', title: 'Zahlen-Duell (Multiplayer)', avatar: '⚔️', ownerId: 'super-admin', status: 'published', file: 'Kopfrechnen.json', multiplayer: { minPlayers: 2, maxPlayers: 4, scope: 'house' } },
    { id: 'game-draft', title: 'Unfertiges Spiel', avatar: '🚧', ownerId: 'super-admin', status: 'draft', file: 'Tetris.json' },
    { id: 'game-blocked', title: 'Gesperrtes Spiel', avatar: '⛔', ownerId: 'super-admin', status: 'blocked', file: 'Tetris.json' },
  ],
  grants: [
    { gameId: 'game-snake', areaId: 'room-sun-play', active: true },
    { gameId: 'game-math', areaId: 'room-sun-play', active: true },
    { gameId: 'game-math', areaId: 'room-sun-learn', active: true },
    { gameId: 'game-mp', areaId: 'room-sun-play', active: true },
    { gameId: 'game-snake', areaId: 'room-sun-closed', active: true }, // Raum deaktiviert
    { gameId: 'game-snake', areaId: 'room-moon-play', active: true },
    { gameId: 'game-draft', areaId: 'room-sun-play', active: true },   // draft: darf nicht starten
    { gameId: 'game-snake', areaId: 'room-sun-learn', active: false }, // widerrufene Freigabe
  ],
  invites: [
    { id: 'inv-valid', personId: 'parent-tom-b', childId: 'child-emil', houseId: 'house-sun', purpose: 'parent', issuer: 'admin-sun', hash: hash('test-token-valid'), expires: NOW + 24 * H },
    { id: 'inv-expired', personId: 'parent-tom-b', childId: 'child-tom', houseId: 'house-sun', purpose: 'parent', issuer: 'admin-sun', hash: hash('test-token-expired'), expires: NOW - H },
    { id: 'inv-used', personId: 'parent-tom-a', childId: 'child-tom', houseId: 'house-sun', purpose: 'parent', issuer: 'admin-sun', hash: hash('test-token-used'), expires: NOW + 24 * H, usedAt: iso(NOW - 2 * D) },
  ],
  deviceGrants: [
    { id: 'dev-valid', houseId: 'house-sun', label: 'Tablet Spielzimmer', issuedBy: 'admin-sun', expires: NOW + 8 * H, revoked: false },
    { id: 'dev-expired', houseId: 'house-sun', label: 'Leih-Tablet', issuedBy: 'admin-sun', expires: NOW - H, revoked: false },
    { id: 'dev-revoked', houseId: 'house-sun', label: 'Altes Tablet', issuedBy: 'admin-sun', expires: NOW + 8 * H, revoked: true },
  ],
  timeBudgets: [
    { childId: 'child-lina', dailyMinutes: 45, windows: [{ from: '14:00', to: '19:00' }], tz: 'Europe/Berlin', warnAt: [5, 1], graceMinutes: 2, setBy: 'parent-lina', updatedAt: iso(NOW - D) },
    { childId: 'child-tom', dailyMinutes: 30, windows: [], tz: 'Europe/Berlin', warnAt: [5, 1], graceMinutes: 2, setBy: 'parent-tom-a', updatedAt: iso(NOW - D) },
    { childId: 'child-finn', dailyMinutes: 20, windows: [], tz: 'Europe/Berlin', warnAt: [5, 1], graceMinutes: 2, setBy: 'parent-multi', updatedAt: iso(NOW - D) },
    // child-emil: absichtlich kein Budget (unbegrenzt bis Eltern setzen)
  ],
  playSessions: [
    { id: 'ps-active', childId: 'child-lina', gameId: 'game-math', areaId: 'room-sun-play', status: 'active', startedAt: iso(NOW - 12 * MIN), lastHeartbeatAt: iso(NOW - 30000), endedAt: null, minutes: 12 },
    { id: 'ps-paused', childId: 'child-tom', gameId: 'game-snake', areaId: 'room-sun-play', status: 'paused', startedAt: iso(NOW - 40 * MIN), lastHeartbeatAt: iso(NOW - 5 * MIN), endedAt: null, minutes: 28 }, // Budget fast erschöpft
    { id: 'ps-disconnected', childId: 'child-emil', gameId: 'game-math', areaId: 'room-sun-learn', status: 'disconnected', startedAt: iso(NOW - 30 * MIN), lastHeartbeatAt: iso(NOW - 10 * MIN), endedAt: null, minutes: 18 },
    { id: 'ps-ended', childId: 'child-finn', gameId: 'game-snake', areaId: 'room-sun-play', status: 'ended', startedAt: iso(NOW - 2 * H), lastHeartbeatAt: iso(NOW - 80 * MIN), endedAt: iso(NOW - 80 * MIN), minutes: 20 }, // Budget erschöpft
    { id: 'ps-yesterday', childId: 'child-lina', gameId: 'game-math', areaId: 'room-sun-play', status: 'ended', startedAt: iso(NOW - D - H), lastHeartbeatAt: iso(NOW - D), endedAt: iso(NOW - D), minutes: 30 }, // Tageswechsel
  ],
  progress: [
    { eventId: 'ev-1', childId: 'child-lina', gameId: 'game-math', sessionId: 'ps-active', metric: 'tasks_done', value: 8, unit: 'count', reportedAt: iso(NOW - 5 * MIN), source: 'game', schemaVersion: 1 },
    { eventId: 'ev-2', childId: 'child-lina', gameId: 'game-math', sessionId: 'ps-active', metric: 'tasks_correct', value: 7, unit: 'count', reportedAt: iso(NOW - 5 * MIN), source: 'game', schemaVersion: 1 },
    { eventId: 'ev-3', childId: 'child-lina', gameId: 'game-math', sessionId: 'ps-active', metric: 'hints_used', value: 2, unit: 'count', reportedAt: iso(NOW - 5 * MIN), source: 'game', schemaVersion: 1 },
    { eventId: 'ev-4', childId: 'child-lina', gameId: 'game-math', sessionId: 'ps-active', metric: 'round_complete', value: 1, unit: 'bool', reportedAt: iso(NOW - 5 * MIN), source: 'game', schemaVersion: 1 },
    { eventId: 'ev-5', childId: 'child-finn', gameId: 'game-snake', sessionId: 'ps-ended', metric: 'round_complete', value: 1, unit: 'bool', reportedAt: iso(NOW - 80 * MIN), source: 'server', schemaVersion: 1 },
    { eventId: 'ev-dup', childId: 'child-tom', gameId: 'game-snake', sessionId: 'ps-paused', metric: 'tasks_done', value: 5, unit: 'count', reportedAt: iso(NOW - 10 * MIN), source: 'game', schemaVersion: 1 },
  ],
  profileRequests: [
    { id: 'req-1', personId: 'child-finn', type: 'access-help', status: 'open', at: iso(NOW - 2 * H) },
    { id: 'req-2', personId: 'child-emil', type: 'access-help', status: 'resolved', at: iso(NOW - 3 * D) },
  ],
  audit: [
    { id: 'audit-1', at: iso(NOW - 10 * D), actor: 'super-admin', action: 'house-create', areaId: 'root' },
    { id: 'audit-2', at: iso(NOW - 9 * D), actor: 'admin-sun', action: 'room-create', areaId: 'house-sun' },
  ],
  meta: { generatedBy: 'cms-seed-testdata.cjs', generatedAt: iso(NOW), purpose: 'synthetische Testdaten, keine echten Personen' },
  // Erwartete Sichtbarkeit pro Testkonto — Referenz für Tests und manuelle Prüfung.
  testMeta: {
    password: TEST_PASSWORD,
    inviteTokens: { valid: 'test-token-valid', expired: 'test-token-expired', used: 'test-token-used' },
    visibility: [
      { account: 'parent-lina', seesChildren: ['child-lina'], notChildren: ['child-finn', 'child-tom', 'child-emil', 'child-mia'], pendingOnly: ['child-mia'] },
      { account: 'parent-multi', seesChildren: ['child-finn', 'child-emil'], notChildren: ['child-lina', 'child-tom', 'child-mia'] },
      { account: 'parent-tom-a', seesChildren: ['child-tom'], notChildren: ['child-lina'] },
      { account: 'parent-tom-b', seesChildren: ['child-tom'], notChildren: ['child-lina'], pendingOnly: ['child-emil'] },
      { account: 'adult-revoked', seesChildren: [], notChildren: ['child-tom'] },
      { account: 'admin-sun', seesChildren: [], note: 'Verwaltungsrolle allein gibt keine Elternsicht' },
      { account: 'admin-parent', seesChildren: ['child-lina'], note: 'nur über Guardian-Beziehung, nicht über areaAdmin' },
      { account: 'observer-sun', seesChildren: [], note: 'nur aggregierte Sicht ohne Einzelberechtigung' },
    ],
    negativeCases: [
      'parent-lina fragt Fortschritt von child-finn -> 403',
      'Token test-token-expired -> Einladung abgelaufen',
      'Token test-token-used -> Einladung bereits verwendet',
      'eventId ev-dup erneut gemeldet -> kein zweiter Eintrag',
      'child-suspended meldet sich an -> abgelehnt',
      'child-left in Raum -> keine Mitgliedschaft aktiv',
      'game-draft Start -> nicht veröffentlicht',
      'game-blocked -> gesperrt',
      'deviceGrants dev-expired/dev-revoked -> keine Gerätefreigabe',
      'room-sun-closed -> inaktiv, kein Spielstart',
      'house-closed -> gesamtes Haus inaktiv',
      'ps-yesterday zählt nicht zum heutigen Budget',
    ],
  },
};

  validate(db);
  return db;
}

module.exports = { buildDb, TEST_PASSWORD };

if (require.main === module) {
const outDir = path.resolve(process.argv[2] || path.join(__dirname, '../../game-server/data/test'));
const db = buildDb();

fs.mkdirSync(outDir, { recursive: true });
const dataFile = path.join(outDir, 'cms-testdata.json');
const tmp = dataFile + '.tmp';
fs.writeFileSync(tmp, JSON.stringify(db, null, 2), { mode: 0o600 });
fs.renameSync(tmp, dataFile);

// Zugehörige Zugangsdaten (separate Datei wie cms-admin-auth.json)
const authUsers = [
  ['super-admin', 'super'], ['admin-sun', 'admin.sonne'], ['admin-parent', 'admin.paul'],
  ['admin-moon', 'admin.mond'], ['teacher-sun', 'erzieher.tobias'], ['observer-sun', 'beobachter.olga'],
  ['parent-lina', 'eltern.petra'], ['parent-multi', 'eltern.martin'],
  ['parent-tom-a', 'eltern.tina'], ['parent-tom-b', 'eltern.tim'], ['adult-revoked', 'kontakt.rita'],
];
const authFile = path.join(outDir, 'cms-testdata-auth.json');
const entries = authUsers.map(([personId, username]) => {
  const salt = crypto.randomBytes(16).toString('hex');
  return { personId, username, salt, hash: crypto.scryptSync(TEST_PASSWORD, salt, 64).toString('hex') };
});
fs.writeFileSync(authFile + '.tmp', JSON.stringify(entries, null, 2), { mode: 0o600 });
fs.renameSync(authFile + '.tmp', authFile);

console.log('Testdaten geschrieben: ' + dataFile);
console.log('Zugangsdaten:        ' + authFile + ' (Passwort: ' + TEST_PASSWORD + ')');
console.log('Personen: ' + db.people.length + ' | Bereiche: ' + db.areas.length + ' | Spiele: ' + db.games.length);
}

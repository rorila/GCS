// Baut die Phase-2-Stages in GCS-CMS.json programmatisch (kein Hand-JSON):
//   stage_server_parent — TServerParentAccount (vom Server-Modul validiert)
//   stage_parent        — Eltern: Meine Kinder (Aktivität, Bewertungen, Zeitbudget)
//   stage_observer      — Beobachter: aggregierte Raumübersicht
// Erweitert außerdem: Verwaltungs-Anmeldung (Kontext-Buttons) und
// HouseAdmin-Stage (Kinder-/Eltern-Listen, Einladen, Bestätigen, Beobachter).
// Idempotent: eigene Objekte werden vor dem Einfügen entfernt.
// Aufruf: node scripts/cms/cms-add-parent-stages.cjs
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const FILE = path.join(__dirname, '../../game-server/public/projects/GCS-CMS.json');
const uid = p => p + '-' + crypto.randomUUID();

const project = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const allObjects = project.stages.flatMap(s => s.objects || []);
const tmpl = cls => allObjects.find(o => o.className === cls);

// --- Objekt-Fabriken: gleiche Feldform wie vom Editor gespeicherte Objekte ---
const base = (cls, name, x, y, w, h, extra = {}) => {
  const t = tmpl(cls) || { style: {} };
  return { className: cls, id: uid('cms_' + cls.slice(1).toLowerCase()), name, scope: 'stage', draggable: false, droppable: false, dragMode: 'move', visible: true, x, y, width: w, height: h, zIndex: 0, rotation: 0, align: 'NONE', collisionEnabled: false, style: { ...t.style }, ...extra };
};
const label = (name, text, x, y, w, h, fontSize = 20) => base('TLabel', name, x, y, w, h, { text, style: { color: '#edf7f4', fontSize, fontWeight: 'normal', textAlign: 'center', backgroundColor: 'transparent', borderColor: 'transparent', borderWidth: 0 } });
const button = (name, text, x, y, w, h, onClick, extra = {}) => base('TButton', name, x, y, w, h, { text, icon: '', events: { onClick }, ...extra });
const edit = (name, x, y, w, h, extra = {}) => base('TEdit', name, x, y, w, h, { text: '', ...extra });
const table = (name, x, y, w, h, dataSource, columns, onSelect) => base('TTable', name, x, y, w, h, { dataSource, keyField: 'id', selectedKey: '', selectedRecord: null, data: [], columns, displayMode: 'cards', rowHeight: 58, showHeader: true, striped: true, selectedIndex: -1, events: onSelect ? { onSelect } : {} });
const objList = (name, description) => ({ className: 'TObjectList', id: uid('cms_list'), name, scope: 'stage', isVariable: true, isHiddenInRun: true, draggable: false, droppable: false, dragMode: 'move', description, visible: true, x: 1, y: 1, width: 20, height: 4, zIndex: 0, rotation: 0, align: 'NONE', collisionEnabled: false, style: { ...((tmpl('TObjectList') || {}).style || {}) }, dataSource: '', keyField: 'id', selectedKey: '', selectedRecord: null, data: [] });
const variable = (cls, name, def) => ({ className: cls, id: uid('cms_var'), name, scope: 'stage', isVariable: true, isHiddenInRun: true, draggable: false, droppable: false, dragMode: 'move', description: '', visible: true, x: 0, y: 0, width: 6, height: 2, zIndex: 0, rotation: 0, align: 'NONE', collisionEnabled: false, style: {}, type: cls.replace(/^T|Variable$/g, '').toLowerCase(), defaultValue: def, value: def, objectModel: '' });
const strVar = n => variable('TStringVariable', n, '');
const intVar = (n, d = 0) => variable('TIntegerVariable', n, d);
const boolVar = n => variable('TBooleanVariable', n, false);
const objVar = n => variable('TObjectVariable', n, null);

// --- Sequenz-Bausteine ---
const task = (name, actionSequence, description) => ({ id: uid('task'), name, description: description || name, actionSequence, triggerMode: 'local-sync', params: [], scope: 'stage' });
const callTask = name => ({ type: 'task', name });
const cond = (variable, value, then, else_ = [], operator = '==') => ({ type: 'condition', name: `Branch: ${variable} ${operator} ${value}`, condition: { variable, operator, value }, then, else: else_ });
const busyGuard = inner => [cond('Busy', 0, inner)];
const stageShell = (id, name) => ({ id, type: 'standard', name, grid: { cols: 64, rows: 40, cellSize: 18, visible: false, snapToGrid: true, backgroundColor: '#122b39' }, objects: [], tasks: [], actions: [], variables: [], flowCharts: {}, events: {}, startAnimation: 'none', features: [] });

// Stage-gebundene Action-Registrierung: def in stage.actions + Referenz in der Sequenz.
const bind = stage => ({
  prop: (name, changes) => (stage.actions.push({ id: uid('act'), name, type: 'property', changes, scope: 'stage' }), { type: 'action', name }),
  http: (name, url, body, resultVariable = 'Antwort') => (stage.actions.push({ id: uid('act'), name, type: 'http', url, method: 'POST', body, resultVariable, scope: 'stage', queryOperator: '==' }), { type: 'action', name }),
  call: (name, target, method, params = [], resultVariable) => (stage.actions.push({ id: uid('act'), name, type: 'call_method', target, method, params, ...(resultVariable ? { resultVariable } : {}), scope: 'stage' }), { type: 'action', name }),
  nav: (name, stageId) => (stage.actions.push({ id: uid('act'), name, type: 'navigate_stage', stageId, reset: false, scope: 'stage' }), { type: 'action', name }),
});

// ============================================================
// 1. Server-Stage: Eltern- und Beobachterzugang
// ============================================================
const OPS = [
  ['onChildren', 'Eltern_Kinder_Laden', 'children'],
  ['onActivity', 'Eltern_Aktivitaet_Lesen', 'activity'],
  ['onProgress', 'Eltern_Bewertungen_Lesen', 'progress'],
  ['onSetBudget', 'Eltern_Budget_Setzen', 'setBudget'],
  ['onApproveBudget', 'Eltern_Budget_Bestaetigen', 'approveBudget'],
  ['onPulse', 'Beobachter_Puls_Lesen', 'pulse'],
];
const serverStage = stageShell('stage_server_parent', 'Server · Eltern- und Beobachterzugang');
serverStage.objects.push({
  className: 'TServerParentAccount', id: 'server_parent', name: 'Elternbereich', scope: 'stage',
  isService: true, isHiddenInRun: true, executionSide: 'server',
  events: Object.fromEntries(OPS.map(([e, t]) => [e, t])),
  readMessage: 'Daten nur für bestätigt zugeordnete Kinder.',
  failureMessage: 'Aktion nicht möglich.',
  x: 0, y: 0, width: 12, height: 3,
});
for (const [, taskName, method] of OPS) {
  serverStage.actions.push({ id: uid('act'), name: 'Act_' + taskName, type: 'call_method', target: 'Elternbereich', method, params: [], scope: 'stage', target_ref: 'server_parent' });
  serverStage.tasks.push(task(taskName, [{ type: 'action', name: 'Act_' + taskName }]));
}
serverStage.features.push({ id: 'server-parent', name: 'Elternsicht und Beobachter-Aggregat', blueprintTaskNames: OPS.map(([, t]) => t) });

// Server-Stage: Spielsitzungen mit Zeitbuchung (Phase 3, E06/E07/E08).
const PLAY_OPS = [
  ['onStart', 'Sitzung_Starten', 'start'],
  ['onHeartbeat', 'Sitzung_Heartbeat', 'heartbeat'],
  ['onPause', 'Sitzung_Pausieren', 'pause'],
  ['onResume', 'Sitzung_Fortsetzen', 'resume'],
  ['onEnd', 'Sitzung_Beenden', 'end'],
  ['onProgress', 'Bewertung_Melden', 'progress'],
];
const playStage = stageShell('stage_server_play', 'Server · Spielsitzungen und Zeitbudget');
playStage.objects.push({
  className: 'TServerPlaySession', id: 'server_play', name: 'Spielsitzungen', scope: 'stage',
  isService: true, isHiddenInRun: true, executionSide: 'server',
  events: Object.fromEntries(PLAY_OPS.map(([e, t]) => [e, t])),
  heartbeatMs: 30000, disconnectGraceMs: 120000, graceMinutes: 2,
  x: 0, y: 0, width: 12, height: 3,
});
for (const [, taskName, method] of PLAY_OPS) {
  playStage.actions.push({ id: uid('act'), name: 'Act_' + taskName, type: 'call_method', target: 'Spielsitzungen', method, params: [], scope: 'stage', target_ref: 'server_play' });
  playStage.tasks.push(task(taskName, [{ type: 'action', name: 'Act_' + taskName }]));
}
playStage.features.push({ id: 'server-play', name: 'Sitzungszustände, Zeitbuchung, Bewertungsmeldung', blueprintTaskNames: PLAY_OPS.map(([, t]) => t) });

// Server-Stage: hausinterner Multiplayer (Phase 4) — Partien/Lobbys.
const MP_OPS = [
  ['onList', 'Partie_Liste', 'list'], ['onCreate', 'Partie_Erstellen', 'create'],
  ['onJoin', 'Partie_Beitreten', 'join'], ['onLeave', 'Partie_Verlassen', 'leave'],
  ['onState', 'Partie_Status', 'state'], ['onAction', 'Partie_Aktion', 'action'],
  ['onBegin', 'Partie_Beginnen', 'begin'], ['onEnd', 'Partie_Beenden', 'end'],
];
const mpStage = stageShell('stage_server_mp', 'Server · Hausinterner Mehrspieler');
mpStage.objects.push({
  className: 'TServerParty', id: 'server_mp', name: 'Partien', scope: 'stage',
  isService: true, isHiddenInRun: true, executionSide: 'server',
  events: Object.fromEntries(MP_OPS.map(([e, t]) => [e, t])),
  maxActionsPerMinute: 120,
  x: 0, y: 0, width: 12, height: 3,
});
for (const [, taskName, method] of MP_OPS) {
  mpStage.actions.push({ id: uid('act'), name: 'Act_' + taskName, type: 'call_method', target: 'Partien', method, params: [], scope: 'stage', target_ref: 'server_mp' });
  mpStage.tasks.push(task(taskName, [{ type: 'action', name: 'Act_' + taskName }]));
}
mpStage.features.push({ id: 'server-mp', name: 'Lobbys, Beitritt, Aktionslog, Partieende', blueprintTaskNames: MP_OPS.map(([, t]) => t) });

// ============================================================
// 2. Client-Stage: Eltern · Meine Kinder
// ============================================================
const parent = stageShell('stage_parent', 'Eltern · Meine Kinder');
const P = bind(parent);
parent.objects.push(
  label('Titel', 'MEINE KINDER', 4, 2, 56, 2, 28),
  label('Status', '', 4, 5, 56, 2),
  button('NeuLaden', '↻ Aktualisieren', 44, 5, 12, 2, 'Sperre_KinderLaden'),
  objList('Kinder', 'Bestätigt zugeordnete Kinder; Datenquelle der KinderTabelle.'),
  table('KinderTabelle', 4, 8, 28, 15, 'Kinder', [
    { field: 'avatar', label: '', width: '70px' }, { field: 'name', label: 'Kind' },
    { field: 'spiel', label: 'Spiel' }, { field: 'heute', label: 'Heute (Min)' },
  ], 'Kind_Auswaehlen'),
  label('DetailTitel', 'AKTIVITÄT & BEWERTUNGEN', 36, 8, 24, 2),
  objList('Sitzungen', 'Letzte Spielsitzungen des gewählten Kindes.'),
  table('SitzungTabelle', 36, 11, 24, 9, 'Sitzungen', [
    { field: 'title', label: 'Spiel' }, { field: 'status', label: 'Status' }, { field: 'minutes', label: 'Min', width: '60px' },
  ]),
  objList('Bewertungen', 'Gemeldete Bewertungen des gewählten Kindes.'),
  table('BewertungTabelle', 36, 21, 24, 9, 'Bewertungen', [
    { field: 'metric', label: 'Metrik' }, { field: 'value', label: 'Wert', width: '60px' },
    { field: 'unit', label: 'Einheit', width: '80px' }, { field: 'source', label: 'Quelle', width: '80px' },
  ]),
  label('BudgetTitel', 'ZEITBUDGET (MINUTEN PRO TAG)', 4, 25, 28, 2),
  edit('BudgetMinuten', 4, 28, 10, 3, { inputType: 'number', placeholder: 'Minuten', maxLength: 4 }),
  button('BudgetSpeichern', 'Budget speichern', 16, 28, 16, 3, 'Sperre_BudgetSpeichern'),
  button('BudgetBestaetigen', 'Änderung bestätigen', 16, 32, 16, 3, 'Sperre_BudgetBestaetigen', { visible: false }),
  label('BudgetHinweis', '', 34, 28, 26, 4, 15),
  button('Navigation_stage_admin_login', '🔑 Anmeldung', 4, 37, 14, 2, 'Navigation_stage_admin_login'),
  button('Navigation_stage_admin', '🛠 Verwaltung', 20, 37, 14, 2, 'Navigation_stage_admin'),
  button('Navigation_stage_observer', '👁 Beobachtung', 36, 37, 16, 2, 'Navigation_stage_observer'),
);
parent.variables.push(
  strVar('Kind'), objVar('KinderAntwort'), boolVar('KinderGueltig'), objVar('DetailAntwort'),
  boolVar('SitzungsGueltig'), objVar('FortschrittAntwort'), boolVar('FortschrittGueltig'),
  objVar('BudgetAntwort'), intVar('Busy'),
);
parent.tasks.push(
  task('Kinder_Laden', [
    P.prop('Act_Kinder_Warten', { Busy: 1, 'Status.text': 'Kinder werden geladen …' }),
    P.http('Act_Kinder_Server', '/api/cms/parent/my-children', {}, 'KinderAntwort'),
    cond('KinderAntwort.ok', true, [callTask('Kinder_Anzeigen')], [callTask('Kinder_Fehler')]),
  ]),
  task('Kinder_Anzeigen', [
    P.call('Act_Kinder_Uebernehmen', 'Kinder', 'tryReplaceRecords', ['${KinderAntwort.items}'], 'KinderGueltig'),
    cond('KinderGueltig', true,
      [P.prop('Act_Kinder_Fertig', { Busy: 0, 'KinderTabelle.visible': true, 'Status.text': '${KinderAntwort.message}' })],
      [P.prop('Act_Kinder_Datenfehler', { Busy: 0, 'Status.text': 'Antwortdaten ungültig.' })]),
  ]),
  task('Kinder_Fehler', [P.prop('Act_Kinder_Fehler_Anzeigen', { Busy: 0, 'Status.text': '${KinderAntwort.message}' })]),
  task('Kind_Auswaehlen', busyGuard([
    P.prop('Act_Kind_Uebernehmen', { Kind: '${KinderTabelle.selectedKey}', 'BudgetBestaetigen.visible': false, 'BudgetHinweis.text': '' }),
    callTask('Kind_Details_Laden'),
  ])),
  task('Kind_Details_Laden', [
    P.prop('Act_Details_Warten', { Busy: 1, 'Status.text': 'Aktivität wird geladen …' }),
    P.http('Act_Details_Server', '/api/cms/parent/child-activity', { childId: '${Kind}' }, 'DetailAntwort'),
    cond('DetailAntwort.ok', true, [callTask('Kind_Details_Anzeigen')], [callTask('Detail_Fehler')]),
  ]),
  task('Kind_Details_Anzeigen', [
    P.call('Act_Sitzungen_Uebernehmen', 'Sitzungen', 'tryReplaceRecords', ['${DetailAntwort.sessions}'], 'SitzungsGueltig'),
    P.prop('Act_Budget_Anzeigen', { 'BudgetMinuten.text': '${DetailAntwort.budgetMinutes}' }),
    cond('DetailAntwort.pendingApproval', true,
      [P.prop('Act_Genehmigung_Anzeigen', { 'BudgetBestaetigen.visible': true, 'BudgetHinweis.text': 'Budgetänderung wartet auf ein zweites Elternteil.' })],
      [P.prop('Act_Genehmigung_Verbergen', { 'BudgetBestaetigen.visible': false, 'BudgetHinweis.text': '' })]),
    callTask('Fortschritt_Laden'),
  ]),
  task('Fortschritt_Laden', [
    P.http('Act_Fortschritt_Server', '/api/cms/parent/child-progress', { childId: '${Kind}' }, 'FortschrittAntwort'),
    cond('FortschrittAntwort.ok', true,
      [P.call('Act_Bewertungen_Uebernehmen', 'Bewertungen', 'tryReplaceRecords', ['${FortschrittAntwort.items}'], 'FortschrittGueltig'), P.prop('Act_Details_Fertig', { Busy: 0, 'Status.text': 'Bereit.' })],
      [callTask('Detail_Fehler')]),
  ]),
  task('Detail_Fehler', [P.prop('Act_Detail_Fehler', { Busy: 0, 'Status.text': '${DetailAntwort.message}' })]),
  task('Budget_Speichern', [
    P.prop('Act_Budget_Warten', { Busy: 1, 'Status.text': 'Budget wird gespeichert …' }),
    P.http('Act_Budget_Server', '/api/cms/parent/set-budget', { childId: '${Kind}', dailyMinutes: '${BudgetMinuten.text}' }, 'BudgetAntwort'),
    cond('BudgetAntwort.ok', true, [callTask('Budget_Gespeichert')], [callTask('Budget_Fehler')]),
  ]),
  task('Budget_Gespeichert', [
    P.prop('Act_Budget_Meldung', { Busy: 0, 'Status.text': '${BudgetAntwort.message}' }),
    cond('BudgetAntwort.pending', true,
      [P.prop('Act_Budget_Pending_Anzeigen', { 'BudgetBestaetigen.visible': true, 'BudgetHinweis.text': 'Lockerung wartet auf Zustimmung eines zweiten Elternteils.' })],
      [P.prop('Act_Budget_Pending_Aus', { 'BudgetBestaetigen.visible': false, 'BudgetHinweis.text': '' })]),
  ]),
  task('Budget_Bestaetigen', [
    P.prop('Act_Bestaetigen_Warten', { Busy: 1, 'Status.text': 'Änderung wird bestätigt …' }),
    P.http('Act_Bestaetigen_Server', '/api/cms/parent/approve-budget', { childId: '${Kind}' }, 'BudgetAntwort'),
    cond('BudgetAntwort.ok', true,
      [P.prop('Act_Bestaetigt', { Busy: 0, 'BudgetBestaetigen.visible': false, 'BudgetHinweis.text': '', 'Status.text': '${BudgetAntwort.message}' })],
      [callTask('Budget_Fehler')]),
  ]),
  task('Budget_Fehler', [P.prop('Act_Budget_Fehler', { Busy: 0, 'Status.text': '${BudgetAntwort.message}' })]),
  task('Sperre_KinderLaden', busyGuard([callTask('Kinder_Laden')])),
  task('Sperre_BudgetSpeichern', busyGuard([callTask('Budget_Speichern')])),
  task('Sperre_BudgetBestaetigen', busyGuard([callTask('Budget_Bestaetigen')])),
  task('Navigation_stage_admin_login', busyGuard([P.nav('Act_Nav_Admin_Login', 'stage_admin_login')])),
  task('Navigation_stage_admin', busyGuard([P.nav('Act_Nav_Admin', 'stage_admin')])),
  task('Navigation_stage_observer', busyGuard([P.nav('Act_Nav_Observer', 'stage_observer')])),
);

// ============================================================
// 3. Client-Stage: Beobachter · Übersicht (nur Aggregate)
// ============================================================
const observer = stageShell('stage_observer', 'Beobachter · Übersicht');
const O = bind(observer);
observer.objects.push(
  label('Titel', 'BEOBACHTUNG', 4, 2, 56, 2, 28),
  label('Hinweis', 'Nur zusammengefasste Zahlen — keine Einzelpersonen.', 4, 5, 56, 2, 15),
  label('Status', '', 4, 7, 56, 2),
  button('Aktualisieren', '↻ Aktualisieren', 46, 7, 14, 2, 'Sperre_PulsLaden'),
  objList('PulsListe', 'Aggregierte Raumzahlen der eigenen Beobachtungsbereiche.'),
  table('PulsTabelle', 4, 10, 56, 20, 'PulsListe', [
    { field: 'bereich', label: 'Bereich' }, { field: 'connected', label: 'Verbunden', width: '110px' },
    { field: 'playing', label: 'Spielend', width: '100px' }, { field: 'paused', label: 'Pausiert', width: '100px' },
    { field: 'disconnected', label: 'Getrennt', width: '100px' },
  ]),
  button('Navigation_stage_admin_login', '🔑 Anmeldung', 4, 37, 14, 2, 'Navigation_stage_admin_login'),
  button('Navigation_stage_parent', '👨‍👩‍👧 Meine Kinder', 20, 37, 16, 2, 'Navigation_stage_parent'),
);
observer.variables.push(objVar('PulsAntwort'), boolVar('PulsGueltig'), intVar('Busy'));
observer.tasks.push(
  task('Puls_Laden', [
    O.prop('Act_Puls_Warten', { Busy: 1, 'Status.text': 'Übersicht wird geladen …' }),
    O.http('Act_Puls_Server', '/api/cms/parent/room-pulse', {}, 'PulsAntwort'),
    cond('PulsAntwort.ok', true, [callTask('Puls_Anzeigen')], [callTask('Puls_Fehler')]),
  ]),
  task('Puls_Anzeigen', [
    O.call('Act_Puls_Uebernehmen', 'PulsListe', 'tryReplaceRecords', ['${PulsAntwort.items}'], 'PulsGueltig'),
    cond('PulsGueltig', true,
      [O.prop('Act_Puls_Fertig', { Busy: 0, 'PulsTabelle.visible': true, 'Status.text': '${PulsAntwort.message}' })],
      [O.prop('Act_Puls_Datenfehler', { Busy: 0, 'Status.text': 'Antwortdaten ungültig.' })]),
  ]),
  task('Puls_Fehler', [O.prop('Act_Puls_Fehler_Anzeigen', { Busy: 0, 'Status.text': '${PulsAntwort.message}' })]),
  task('Sperre_PulsLaden', busyGuard([callTask('Puls_Laden')])),
  task('Navigation_stage_admin_login', busyGuard([O.nav('Act_Nav_Admin_Login_Obs', 'stage_admin_login')])),
  task('Navigation_stage_parent', busyGuard([O.nav('Act_Nav_Parent_Obs', 'stage_parent')])),
);

// ============================================================
// 4. Verwaltungs-Anmeldung: Kontext-Buttons nach erfolgreichem Login
// ============================================================
const login = project.stages.find(s => s.id === 'stage_admin_login');
const L = bind(login);
login.objects = login.objects.filter(o => !['KinderOeffnen', 'BeobachtungOeffnen'].includes(o.name));
login.objects.push(
  button('KinderOeffnen', 'Meine Kinder öffnen →', 12, 35, 40, 2, 'Navigation_stage_parent', { visible: false, style: { backgroundColor: 'transparent', borderColor: 'transparent', borderWidth: 0 } }),
  button('BeobachtungOeffnen', 'Beobachtung öffnen →', 12, 38, 40, 2, 'Navigation_stage_observer', { visible: false, style: { backgroundColor: 'transparent', borderColor: 'transparent', borderWidth: 0 } }),
);
login.tasks = login.tasks.filter(t => !['Navigation_stage_parent', 'Navigation_stage_observer', 'Kontexte_Anzeigen'].includes(t.name));
login.actions = login.actions.filter(a => !['Act_Nav_Parent_Login', 'Act_Nav_Observer_Login'].includes(a.name));
login.tasks.push(
  task('Kontexte_Anzeigen', [
    cond('Antwort.parent', true, [L.prop('Act_Kinder_Button_Anzeigen', { 'KinderOeffnen.visible': true })]),
    cond('Antwort.observer', true, [L.prop('Act_Beobachter_Button_Anzeigen', { 'BeobachtungOeffnen.visible': true })]),
  ], 'Nach erfolgreicher Anmeldung verfügbare Kontexte anbieten'),
  task('Navigation_stage_parent', [
    L.nav('Act_Nav_Parent_Login', 'stage_parent'),
    callTask('Kinder_Laden'),
  ]),
  task('Navigation_stage_observer', [
    L.nav('Act_Nav_Observer_Login', 'stage_observer'),
    callTask('Puls_Laden'),
  ]),
);
const erfolg = login.tasks.find(t => t.name === 'Anmeldung_Erfolgreich');
if (erfolg && !erfolg.actionSequence.some(s => s.name === 'Kontexte_Anzeigen')) erfolg.actionSequence.push(callTask('Kontexte_Anzeigen'));

// ============================================================
// 5. HouseAdmin-Stage: Kinder-/Eltern-Verwaltung + Beobachter
// ============================================================
const house = project.stages.find(s => s.name === 'HouseAdmin · Haus verwalten');
const H = bind(house);
const OWN_HOUSE_OBJ = ['KinderTab', 'ElternTab', 'ElternEinladen', 'BeobachterEinladen'];
const OWN_HOUSE_TASKS = ['KinderTask', 'ElternTask', 'WaehleKind', 'WaehleZuordnung', 'ElternEinladenTask', 'BeobachterEinladenTask', 'GuardianApproveTask', 'Sperre_Kinder', 'Sperre_Eltern', 'Sperre_ElternEinladen', 'Sperre_BeobachterEinladen'];
const OWN_HOUSE_ACTS = ['Act_Kinder_oeffnen', 'Act_Eltern_oeffnen', 'Act_Kind_gewaehlt', 'Act_Zuordnung_gewaehlt', 'Act_Eltern_Einladen_Warten', 'Act_Eltern_Einladen_Server', 'Act_Beobachter_Einladen_Server', 'Act_Zuordnung_Bestaetigen_Server'];
house.objects = house.objects.filter(o => !OWN_HOUSE_OBJ.includes(o.name));
house.tasks = house.tasks.filter(t => !OWN_HOUSE_TASKS.includes(t.name));
house.actions = house.actions.filter(a => !OWN_HOUSE_ACTS.includes(a.name));
house.variables = (house.variables || []).filter(v => !['Kind', 'Zuordnung'].includes(v.name));

house.objects.push(
  button('KinderTab', 'Kinder', 4, 15, 14, 2, 'Sperre_Kinder'),
  button('ElternTab', 'Eltern', 20, 15, 14, 2, 'Sperre_Eltern'),
  button('ElternEinladen', 'Einladen', 36, 15, 11, 2, 'Sperre_ElternEinladen'),
  button('BeobachterEinladen', 'Beobachter', 49, 15, 11, 2, 'Sperre_BeobachterEinladen'),
);
house.variables.push(strVar('Kind'), strVar('Zuordnung'));
house.tasks.push(
  task('KinderTask', [
    H.prop('Act_Kinder_oeffnen', { Seite: 0, 'Confirm.visible': false, VerwaltungsModus: 'house-children', 'Status.text': 'Kind wählen, Elternname eingeben, dann „Einladen“.' }),
    callTask('Laden'),
  ]),
  task('ElternTask', [
    H.prop('Act_Eltern_oeffnen', { Seite: 0, 'Confirm.visible': false, VerwaltungsModus: 'guardian-pending', 'Status.text': 'Ausstehende Zuordnung wählen und mit „Confirm“ bestätigen.' }),
    callTask('Laden'),
  ]),
  task('WaehleKind', [H.prop('Act_Kind_gewaehlt', { Kind: '${Auswahl}', 'Status.text': 'Kind ${AuswahlName} gewählt — Elternname eingeben und „Einladen“.' })]),
  task('WaehleZuordnung', [H.prop('Act_Zuordnung_gewaehlt', { Zuordnung: '${Auswahl}', 'Confirm.visible': true, 'Status.text': 'Zuordnung gewählt — mit „Confirm“ bestätigen.' })]),
  task('ElternEinladenTask', [
    H.prop('Act_Eltern_Einladen_Warten', { Busy: 1 }),
    H.http('Act_Eltern_Einladen_Server', '/api/cms/admin/parent-invite', { houseId: '${Haus}', childId: '${Kind}', name: '${NameEingabe.text}' }),
    callTask('Meldung'),
  ]),
  task('BeobachterEinladenTask', [
    { type: 'action', name: 'Act_Eltern_Einladen_Warten' },
    H.http('Act_Beobachter_Einladen_Server', '/api/cms/admin/observer-invite', { houseId: '${Haus}', areaId: '${Raum}', name: '${NameEingabe.text}' }),
    callTask('Meldung'),
  ]),
  task('GuardianApproveTask', [
    { type: 'action', name: 'Act_Eltern_Einladen_Warten' },
    H.http('Act_Zuordnung_Bestaetigen_Server', '/api/cms/admin/guardian-approve', { houseId: '${Haus}', id: '${Zuordnung}' }),
    cond('Antwort.ok', true, [callTask('ElternTask')], [callTask('Fehler')]),
  ]),
  task('Sperre_Kinder', busyGuard([callTask('KinderTask')])),
  task('Sperre_Eltern', busyGuard([callTask('ElternTask')])),
  task('Sperre_ElternEinladen', busyGuard([callTask('ElternEinladenTask')])),
  task('Sperre_BeobachterEinladen', busyGuard([callTask('BeobachterEinladenTask')])),
);
// Kartenauswahl um die neuen Modi erweitern (flache Bedingungen).
const raumOderAdmin = house.tasks.find(t => t.name === 'RaumOderAdmin');
if (raumOderAdmin) {
  raumOderAdmin.actionSequence = [
    cond('VerwaltungsModus', 'house-rooms', [callTask('WaehleRaum')]),
    cond('VerwaltungsModus', 'house-children', [callTask('WaehleKind')]),
    cond('VerwaltungsModus', 'guardian-pending', [callTask('WaehleZuordnung')]),
    cond('VerwaltungsModus', 'room-admins', [callTask('AdminFrage')]),
  ];
}
// Confirm-Button: im Eltern-Modus bestätigt er die Zuordnung statt RaumAdmin.
const adminSet = house.tasks.find(t => t.name === 'AdminSet');
if (adminSet && !adminSet.actionSequence.some(s => s.name === 'Branch: VerwaltungsModus == guardian-pending')) {
  adminSet.actionSequence = [
    cond('VerwaltungsModus', 'guardian-pending', [callTask('GuardianApproveTask')], adminSet.actionSequence),
  ];
}

// SuperAdmin landet direkt auf stage_super — der Umweg über die
// Raum-Stage ist für ihn fachlich falsch (er hat Verwaltung gewählt).
const loginStage = project.stages.find(s => s.id === 'stage_admin_login');
// SuperAdmin wird nach erfolgreicher Anmeldung sofort weitergeleitet —
// ohne den Zwischenschritt über die Erfolgsansicht (er hat Verwaltung
// gewählt, die Kontext-Auswahl ist für ihn ohne Belang).
const loginErfolg = loginStage.tasks.find(t => t.name === 'Anmeldung_Erfolgreich');
if (loginErfolg && !JSON.stringify(loginErfolg).includes('Act_Navigation_stage_super')) {
  loginErfolg.actionSequence = [
    cond('Antwort.super', true,
      [{ type: 'action', name: 'Act_Navigation_stage_super' }],
      loginErfolg.actionSequence),
  ];
}
const navVerwaltung = loginStage.tasks.find(t => t.name === 'Navigation_VerwaltungOeffnen');
if (navVerwaltung && !JSON.stringify(navVerwaltung).includes('Act_Navigation_stage_super')) {
  navVerwaltung.actionSequence = busyGuard([
    cond('Antwort.super', true,
      [{ type: 'action', name: 'Act_Navigation_stage_super' }],
      [{ type: 'action', name: 'Act_Navigation_VerwaltungOeffnen' }]),
  ]);
}

// ============================================================
// Schreiben + Referenzprüfung (Tasks/Actions müssen auflösbar sein)
// ============================================================
project.stages = project.stages.filter(s => !['stage_server_parent', 'stage_server_play', 'stage_server_mp', 'stage_parent', 'stage_observer'].includes(s.id));
serverStage.group = 'Server';
playStage.group = 'Server';
mpStage.group = 'Server';
parent.group = 'Eltern & Beobachtung';
observer.group = 'Eltern & Beobachtung';
project.stages.push(serverStage, playStage, mpStage, parent, observer);

// Fachliche Gruppierung (E04): deklaratives group-Feld, das der Editor
// als Menü-Überschrift nutzt. Ungruppierte Stages bleiben flach.
const GROUPS = {
  stage_main: 'Spiel', stage_gallery: 'Spiel', stage_library: 'Spiel', stage_profile: 'Spiel',
  stage_admin_login: 'Verwaltung', stage_admin: 'Verwaltung', stage_house: 'Verwaltung', stage_super: 'Verwaltung',
  stage_parent: 'Eltern & Beobachtung', stage_observer: 'Eltern & Beobachtung',
};
for (const s of project.stages) {
  if (s.id.startsWith('stage_server_')) s.group = 'Server';
  else if (GROUPS[s.id]) s.group = GROUPS[s.id];
}

const problems = [];
const globalTaskNames = new Set(project.stages.flatMap(x => x.tasks || []).map(t => t.name));
const globalActionNames = new Set(project.stages.flatMap(x => x.actions || []).map(a => a.name));
for (const s of project.stages) {
  const taskNames = new Set((s.tasks || []).map(t => t.name));
  const actionNames = new Set((s.actions || []).map(a => a.name));
  for (const t of s.tasks || []) {
    const walk = seq => (seq || []).forEach(step => {
      if (step.type === 'action' && !actionNames.has(step.name) && !globalActionNames.has(step.name)) problems.push(`${s.name}::${t.name} → fehlende Action ${step.name}`);
      if (step.type === 'task' && !taskNames.has(step.name) && !globalTaskNames.has(step.name)) problems.push(`${s.name}::${t.name} → fehlender Task ${step.name}`);
      walk(step.then); walk(step.else); walk(step.body); walk(step.elseBody);
    });
    walk(t.actionSequence);
  }
}
if (problems.length) { console.error('REFERENZFEHLER:\n' + problems.join('\n')); process.exit(1); }

fs.writeFileSync(FILE + '.tmp', JSON.stringify(project, null, 2));
fs.renameSync(FILE + '.tmp', FILE);
console.log('Stages eingefügt: stage_server_parent, stage_server_play, stage_parent, stage_observer');
console.log('Erweitert: stage_admin_login (Kontexte), HouseAdmin-Stage (Kinder/Eltern/Beobachter)');

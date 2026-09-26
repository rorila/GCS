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
const strVar = (n, d = '') => variable('TStringVariable', n, d);
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
  // Bereichsnavigation nur für berechtigte Kontexte — Kontexte_Pruefen
  // blendet die Buttons nach /api/cms/contexts ein (Sichtbarkeit != Recht).
  button('Navigation_stage_admin', '🛠 Verwaltung', 20, 37, 14, 2, 'Navigation_stage_admin', { visible: false }),
  button('Navigation_stage_observer', '👁 Beobachtung', 36, 37, 16, 2, 'Navigation_stage_observer', { visible: false }),
  { className: 'TTimer', id: uid('timer'), name: 'InitialLaden', scope: 'stage', isService: true, isHiddenInRun: true, draggable: false, droppable: false, dragMode: 'move', events: { onTimer: 'ElternInit' }, visible: true, x: 1, y: 1, width: 4, height: 2, zIndex: 0, rotation: 0, align: 'NONE', collisionEnabled: false, style: {}, interval: 350, enabled: true, maxInterval: 1, currentInterval: 0 },
);
parent.variables.push(
  strVar('Kind'), objVar('KinderAntwort'), boolVar('KinderGueltig'), objVar('DetailAntwort'),
  boolVar('SitzungsGueltig'), objVar('FortschrittAntwort'), boolVar('FortschrittGueltig'),
  objVar('BudgetAntwort'), intVar('Busy'), objVar('KontextAntwort'),
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
  task('Kontexte_Pruefen', [
    P.http('Act_Kontexte_der_Sitzung_lesen', '/api/cms/contexts', {}, 'KontextAntwort'),
    cond('KontextAntwort.ok', true, [P.prop('Act_Kontextnavigation_einblenden', {
      'Navigation_stage_admin.visible': '${KontextAntwort.verwaltung}',
      'Navigation_stage_observer.visible': '${KontextAntwort.observer}',
    })]),
  ]),
  // Erstladung nur solange kein Kind gewaehlt ist — ein verspaeteter Timer
  // darf eine laufende Navigation nicht zuruecksetzen.
  task('ElternInit', [callTask('Kontexte_Pruefen'), cond('Kind', '', [callTask('Sperre_KinderLaden')])]),
  task('Navigation_stage_admin_login', busyGuard([P.nav('Act_Nav_Admin_Login', 'stage_admin_login')])),
  // „Verwaltung“ führt in den höchsten verfügbaren Arbeitsbereich.
  task('Navigation_stage_admin', busyGuard([
    cond('KontextAntwort.super', true, [P.nav('Act_Nav_Super_Parent', 'stage_super')]),
    cond('KontextAntwort.house', true, [P.nav('Act_Nav_House_Parent', 'stage_house')]),
    P.nav('Act_Nav_Admin', 'stage_admin'),
  ])),
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
  // Nur bei vorhandenem Eltern- bzw. Verwaltungskontext einblenden.
  button('Navigation_stage_parent', '👨‍👩‍👧 Meine Kinder', 20, 37, 16, 2, 'Navigation_stage_parent', { visible: false }),
  button('Navigation_stage_admin', '🛠 Verwaltung', 38, 37, 14, 2, 'Navigation_stage_admin', { visible: false }),
  { className: 'TTimer', id: uid('timer'), name: 'InitialLaden', scope: 'stage', isService: true, isHiddenInRun: true, draggable: false, droppable: false, dragMode: 'move', events: { onTimer: 'BeobachterInit' }, visible: true, x: 1, y: 1, width: 4, height: 2, zIndex: 0, rotation: 0, align: 'NONE', collisionEnabled: false, style: {}, interval: 350, enabled: true, maxInterval: 1, currentInterval: 0 },
);
observer.variables.push(objVar('PulsAntwort'), boolVar('PulsGueltig'), intVar('Busy'), objVar('KontextAntwort'));
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
  task('Kontexte_Pruefen', [
    O.http('Act_Kontexte_der_Sitzung_lesen', '/api/cms/contexts', {}, 'KontextAntwort'),
    cond('KontextAntwort.ok', true, [O.prop('Act_Kontextnavigation_einblenden', {
      'Navigation_stage_parent.visible': '${KontextAntwort.parent}',
      'Navigation_stage_admin.visible': '${KontextAntwort.verwaltung}',
    })]),
  ]),
  // Aggregatliste hat keinen Auswahlzustand — die Busy-Sperre reicht.
  task('BeobachterInit', [callTask('Kontexte_Pruefen'), callTask('Sperre_PulsLaden')]),
  task('Navigation_stage_admin_login', busyGuard([O.nav('Act_Nav_Admin_Login_Obs', 'stage_admin_login')])),
  task('Navigation_stage_parent', busyGuard([O.nav('Act_Nav_Parent_Obs', 'stage_parent')])),
  task('Navigation_stage_admin', busyGuard([
    cond('KontextAntwort.super', true, [O.nav('Act_Nav_Super_Obs', 'stage_super')]),
    cond('KontextAntwort.house', true, [O.nav('Act_Nav_House_Obs', 'stage_house')]),
    O.nav('Act_Nav_Admin_Obs', 'stage_admin'),
  ])),
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
if (loginErfolg && !JSON.stringify(loginErfolg).includes('Act_Navigation_stage_house')) {
  loginErfolg.actionSequence = [
    cond('Antwort.super', true,
      [{ type: 'action', name: 'Act_Navigation_stage_super' }],
      [cond('Antwort.house', true,
        [{ type: 'action', name: 'Act_Navigation_stage_house' }],
        loginErfolg.actionSequence)]),
  ];
}
const navVerwaltung = loginStage.tasks.find(t => t.name === 'Navigation_VerwaltungOeffnen');
if (navVerwaltung && !JSON.stringify(navVerwaltung).includes('Act_Navigation_stage_house')) {
  navVerwaltung.actionSequence = busyGuard([
    cond('Antwort.super', true,
      [{ type: 'action', name: 'Act_Navigation_stage_super' }],
      [cond('Antwort.house', true,
        [{ type: 'action', name: 'Act_Navigation_stage_house' }],
        [{ type: 'action', name: 'Act_Navigation_VerwaltungOeffnen' }])]),
  ]);
}

// Nach dem Anlegen eines Hauses wird es nicht mehr sofort ausgewählt
// und in die Detailansicht gesprungen — das neue Haus erscheint nur in
// der Liste; Bearbeiten erfordert das bewusste Auswählen des Hauses.
const superStage = project.stages.find(s => s.id === 'stage_super');
const raumAngelegt = superStage.tasks.find(t => t.name === 'RaumAngelegt');
if (raumAngelegt && !JSON.stringify(raumAngelegt).includes('Act_Haus_Angelegt_Meldung_Und_Liste')) {
  const sb = bind(superStage);
  raumAngelegt.actionSequence = [
    sb.prop('Act_Haus_Angelegt_Meldung_Und_Liste', { 'Busy': 0, 'Status.text': '${Antwort.message}', 'RaumEingabe.text': '' }),
    callTask('HaeuserTask'),
  ];
}

// ============================================================
// stage_super: Listenansicht (Haeuser + Anlegen) vs. Detailansicht
// (gewaehltes Haus bearbeiten, HouseAdmins, Einladung) vs.
// plattformweite SuperAdmin-Verwaltung (Modus super-rootadmins).
// ============================================================
const ss = bind(superStage);
if (!superStage.objects.find(o => o.name === 'SuperT')) {
  // Vierter Tab: plattformweite SuperAdmin-Liste (kein Hauskontext).
  const tab = button('SuperT', 'SuperAdmins', 4, 15, 16, 2, 'Sperre_SuperT');
  superStage.objects.push(tab);
  superStage.tasks.push(task('Sperre_SuperT', busyGuard([callTask('SuperAdminsTask')])));
  superStage.tasks.push(task('SuperAdminsTask', [
    ss.prop('Act_SuperAdmin_Liste_oeffnen__Ansicht_Umschalten_Und_Seitenauswahl_Setzen', {
      'Seite': 0, 'Confirm.visible': false, 'VerwaltungsModus': 'super-rootadmins',
      'Kontext.text': 'SuperAdmins · Plattform',
      // Haus-Werkzeuge ausblenden, Personen-Werkzeuge zeigen.
      'RaumInfo.visible': false, 'RaumEingabe.visible': false,
      'RoomCreate.visible': false, 'RoomSave.visible': false, 'RoomToggle.visible': false,
      'PersonInfo.visible': true, 'NameEingabe.visible': true, 'PersonCreate.visible': true,
      'Einladung.visible': true, 'Invite.visible': true,
      'Hilfe.text': 'Person anklicken → SuperAdmin-Recht bestätigen → Zugang einrichten.',
    }),
    callTask('Laden'),
  ]));
  // Zuweisung/Entzug der superAdmin@root-Rolle und SuperAdmin-Einladung.
  ss.http('Act_SuperAdmin_Zuweisung_vergeben_oder_entziehen__Server_SuperAdmin_Zuweisung_Speichern',
    '/api/cms/admin/super-rootadmin-set',
    '{"personId":"${Person}","active":"${Ziel}","confirm":true}');
  ss.http('Act_SuperAdmin_Zugang_einrichten__Server_SuperAdmin_Einrichtungslink_Anfordern',
    '/api/cms/admin/super-invite',
    '{"houseId":"root","personId":"${Person}"}');
}

// Listenansicht: nur Hausliste + Anlegen-Feld — Haus bearbeiten,
// Personen und Einladungen gehoeren in die Detailansicht.
const listAction = superStage.actions.find(a => a.name === 'Act_Haeuserliste_oeffnen__Ansicht_Umschalten_Und_Seitenauswahl_Setzen');
if (listAction && !('RaumInfo.visible' in listAction.changes)) {
  Object.assign(listAction.changes, {
    'RaumInfo.visible': true, 'RaumInfo.text': 'Hausname · neues Haus anlegen',
    'RaumEingabe.visible': true,
    'RoomCreate.visible': true, 'RoomSave.visible': false, 'RoomToggle.visible': false,
    'PersonInfo.visible': false, 'NameEingabe.visible': false, 'PersonCreate.visible': false,
    'Einladung.visible': false, 'Invite.visible': false,
    'Hilfe.text': 'Haus wählen zum Bearbeiten · oder neuen Namen eingeben + Anlegen.',
    'Kontext.text': 'Noch kein Haus / Raum ausgewählt',
  });
}
// Detailansicht (HouseAdmins des gewaehlten Hauses): kein Haus-Anlegen,
// dafuer Umbenennen/Aktivieren, Personen und Einladungen.
for (const n of ['Act_HouseAdmin_Liste_oeffnen__Ansicht_Umschalten_Und_Seitenauswahl_Setzen',
                 'Act_HouseAdmins_des_Hauses_anzeigen__Ansicht_Umschalten_Und_Seitenauswahl_Setzen']) {
  const a = superStage.actions.find(a => a.name === n);
  if (a && !('RaumInfo.visible' in a.changes)) {
    Object.assign(a.changes, {
      'RaumInfo.visible': true, 'RaumInfo.text': 'Hausname · ausgewähltes Haus bearbeiten',
      'RaumEingabe.visible': true,
      'RoomCreate.visible': false, 'RoomSave.visible': true, 'RoomToggle.visible': true,
      'PersonInfo.visible': true, 'NameEingabe.visible': true, 'PersonCreate.visible': true,
      'Einladung.visible': true, 'Invite.visible': true,
      'Hilfe.text': 'HouseAdmin anklicken → bestätigen → Zugang einrichten.',
    });
  }
}

// AdminSet verzweigt: im Modus super-rootadmins wird die Plattform-Rolle
// gesetzt, sonst die HouseAdmin-Zustaendigkeit des gewaehlten Hauses.
const superAdminSet = superStage.tasks.find(t => t.name === 'AdminSet');
if (superAdminSet && !superAdminSet.actionSequence.some(s => s.name === 'Branch: VerwaltungsModus == super-rootadmins')) {
  const ok = seq => [cond('Antwort.ok', true, seq, [callTask('Fehler')])];
  superAdminSet.actionSequence = [
    superAdminSet.actionSequence[0], // Ziel berechnen
    superAdminSet.actionSequence[1], // Busy setzen
    cond('VerwaltungsModus', 'super-rootadmins',
      [{ type: 'action', name: 'Act_SuperAdmin_Zuweisung_vergeben_oder_entziehen__Server_SuperAdmin_Zuweisung_Speichern' },
       ...ok([callTask('SuperAdminsTask')])],
      [{ type: 'action', name: 'Act_HouseAdmin_Zuweisung_vergeben_oder_entziehen__Server_HouseAdmin_Zuweisung_Speichern' },
       ...ok([callTask('AdminsTask')])]),
  ];
}
// Einladung: im Modus super-rootadmins geht der Link auf die
// Plattform-Rolle (houseId root), sonst auf das gewaehlte Haus.
const superInvite = superStage.tasks.find(t => t.name === 'InviteTask');
if (superInvite && !superInvite.actionSequence.some(s => s.name === 'Branch: VerwaltungsModus == super-rootadmins')) {
  const ok = seq => [cond('Antwort.ok', true, seq, [callTask('Fehler')])];
  superInvite.actionSequence = [
    superInvite.actionSequence[0], // Busy setzen
    cond('VerwaltungsModus', 'super-rootadmins',
      [{ type: 'action', name: 'Act_SuperAdmin_Zugang_einrichten__Server_SuperAdmin_Einrichtungslink_Anfordern' },
       ...ok([callTask('InviteBereit')])],
      [superInvite.actionSequence[1],
       ...ok([callTask('InviteBereit')])]),
  ];
}
// Nach dem Personen-Anlegen die jeweils aktive Liste neu laden.
const personAngelegt = superStage.tasks.find(t => t.name === 'PersonAngelegt');
if (personAngelegt && !personAngelegt.actionSequence.some(s => s.name === 'Branch: VerwaltungsModus == super-rootadmins')) {
  personAngelegt.actionSequence = [
    personAngelegt.actionSequence[0], // Person merken
    cond('VerwaltungsModus', 'super-rootadmins', [callTask('SuperAdminsTask')], [callTask('AdminsTask')]),
  ];
}

// ============================================================
// UX-Umbau: rollenbasierte Navigation, Init-Timer, Auto-Auswahl,
// modusbasierte Sichtbarkeit (siehe Plan: je Rolle eigener
// Arbeitsbereich, Bereichsnavigation nur fuer berechtigte Kontexte)
// ============================================================
const uxTimer = (name, taskName) => ({ className: 'TTimer', id: uid('timer'), name, scope: 'stage', isService: true, isHiddenInRun: true, draggable: false, droppable: false, dragMode: 'move', events: { onTimer: taskName }, visible: true, x: 1, y: 1, width: 4, height: 2, zIndex: 0, rotation: 0, align: 'NONE', collisionEnabled: false, style: {}, interval: 350, enabled: true, maxInterval: 1, currentInterval: 0 });
const uxObj = (stage, name) => stage.objects.find(o => o.name === name);
const uxGate = (stage, names) => { for (const n of names) { const o = uxObj(stage, n); if (o) o.visible = false; } };
const uxMove = (stage, name, x, y, w, text) => { const o = uxObj(stage, name); if (o) { o.x = x; o.y = y; o.width = w; if (text) o.text = text; } };
const uxMerge = (stage, actName, changes) => { const a = (stage.actions || []).find(a => a.name === actName); if (a) Object.assign(a.changes, changes); };
// Kontextnavigation: /api/cms/contexts liefert die Flags der aktuellen
// Sitzung; die Prop-Action blendet nur berechtigte Bereichs-Buttons ein.
const uxContextNav = (stage, visibility) => {
  const B = bind(stage);
  stage.variables = stage.variables || [];
  if (!stage.variables.some(v => v.name === 'KontextAntwort')) stage.variables.push(objVar('KontextAntwort'));
  if (!stage.actions.some(a => a.name === 'Act_Kontexte_der_Sitzung_lesen')) B.http('Act_Kontexte_der_Sitzung_lesen', '/api/cms/contexts', {}, 'KontextAntwort');
  if (!stage.actions.some(a => a.name === 'Act_Kontextnavigation_einblenden')) B.prop('Act_Kontextnavigation_einblenden', visibility);
  if (!stage.tasks.some(t => t.name === 'Kontexte_Pruefen')) stage.tasks.push(task('Kontexte_Pruefen', [
    { type: 'action', name: 'Act_Kontexte_der_Sitzung_lesen' },
    cond('KontextAntwort.ok', true, [{ type: 'action', name: 'Act_Kontextnavigation_einblenden' }]),
  ]));
};
const ADMIN_NAV = {
  'Navigation_stage_admin.visible': '${KontextAntwort.admin}',
  'Navigation_stage_house.visible': '${KontextAntwort.house}',
  'Navigation_stage_super.visible': '${KontextAntwort.super}',
  'Navigation_stage_library.visible': '${KontextAntwort.super}',
};
const GATED_NAV = ['Navigation_stage_admin', 'Navigation_stage_house', 'Navigation_stage_super', 'Navigation_stage_library'];
// Auto-Auswahl: nach dem Laden einer Liste mit genau einem Eintrag wird
// dieser direkt geoeffnet — nur solange noch nichts gewaehlt ist.
const uxAutoSelect = (stage, mode, contextVar, slotPrefix, actionName, changes, targetTask) => {
  const laden = stage.tasks.find(t => t.name === 'Laden');
  if (!laden) return;
  const br = laden.actionSequence.find(s => s.type === 'condition' && s.condition && s.condition.variable === 'Antwort.ok');
  if (!br) return;
  // Reparaturfaehig: eine vorhandene Auto-Auswahl-Kette wird entfernt und
  // korrekt neu aufgebaut (idempotent, auch nach Strukturaenderungen).
  const strip = list => { for (let i = list.length - 1; i >= 0; i--) { const s = list[i]; if (JSON.stringify(s).includes(actionName)) { list.splice(i, 1); continue; } if (s.then) strip(s.then); if (s.else) strip(s.else); } };
  strip(br.then);
  bind(stage).prop(actionName, changes);
  br.then.push(cond('VerwaltungsModus', mode, [
    cond(contextVar, '', [
      cond('Slot1', '', [
        cond('Slot0', '', [{ type: 'action', name: actionName }, callTask(targetTask)], [], '!='),
      ]),
    ]),
  ]));
};
// Init-Schutz: die Erstladung laeuft nur, solange noch kein Kontext gewaehlt
// wurde — ein verspaeteter Timer darf eine laufende Navigation nicht
// zuruecksetzen (Race: Init-Antwort trifft nach dem ersten Klick ein).
// Reparaturfaehig: bestehende Init-Tasks werden aktualisiert.
const uxInitGuard = (stage, initName, guardVar, sperreTask) => {
  const seq = [callTask('Kontexte_Pruefen'), guardVar ? cond(guardVar, '', [callTask(sperreTask)]) : callTask(sperreTask)];
  const initTask = stage.tasks.find(t => t.name === initName);
  if (initTask) initTask.actionSequence = seq; else stage.tasks.push(task(initName, seq));
};

// ---------- stage_admin (RaumAdmin / Erzieher) ----------
const adminStage = project.stages.find(s => s.id === 'stage_admin');
if (adminStage) {
  const A = bind(adminStage);
  // Name-Variablen fuer den sichtbaren Kontext („Raum: X“).
  for (let i = 0; i < 4; i++) if (!adminStage.variables.some(v => v.name === 'Name' + i)) adminStage.variables.push(strVar('Name' + i));
  if (!adminStage.variables.some(v => v.name === 'AuswahlName')) adminStage.variables.push(strVar('AuswahlName'));
  uxMerge(adminStage, 'Act_Geladene_Eintraege_anzeigen__Listenkarten_Und_Status_Aktualisieren', { Name0: '${Antwort.slot0.name}', Name1: '${Antwort.slot1.name}', Name2: '${Antwort.slot2.name}', Name3: '${Antwort.slot3.name}' });
  for (let i = 0; i < 4; i++) {
    const sel = adminStage.actions.find(a => a.name.startsWith('Act_Listeneintrag_' + (i + 1) + '_auswaehlen'));
    if (sel && !('AuswahlName' in sel.changes)) sel.changes.AuswahlName = '${Name' + i + '}';
  }
  // Kontextnavigation + Emoji-Werkzeuge nur mit Hausrecht (der
  // Emoji-Code ist hausweit — RaumAdmin ohne Hausrecht sieht sie nicht).
  uxContextNav(adminStage, {
    ...ADMIN_NAV,
    'CodeInfo.visible': '${KontextAntwort.house}', 'Person.visible': '${KontextAntwort.house}',
    'Code.visible': '${KontextAntwort.house}', 'CodeSave.visible': '${KontextAntwort.house}',
  });
  uxGate(adminStage, [...GATED_NAV, 'CodeInfo', 'Person', 'Code', 'CodeSave', 'Backup', 'Restore']);
  for (const n of ['Act_Raeume_anzeigen__Ansicht_Umschalten_Und_Seitenauswahl_Setzen', 'Act_Spielefreigaben_des_Raumes_anzeigen__Ansicht_Umschalten_Und_Seitenauswahl_Setzen', 'Act_Raummitglieder_anzeigen__Ansicht_Umschalten_Und_Seitenauswahl_Setzen']) {
    uxMerge(adminStage, n, {
      'CodeInfo.visible': '${KontextAntwort.house}', 'Person.visible': '${KontextAntwort.house}',
      'Code.visible': '${KontextAntwort.house}', 'CodeSave.visible': '${KontextAntwort.house}',
    });
  }
  // Backup/Restore erst nach bewusster Raumwahl sichtbar; Status zeigt Kontext.
  uxMerge(adminStage, 'Act_Raum_zur_Bearbeitung_auswaehlen__Eingabe_Und_Auswahl_Aktualisieren', {
    'Backup.visible': true, 'Restore.visible': true,
    'Status.text': 'Raum: ${AuswahlName} · Spielefreigaben werden geladen …',
  });
  // Einmal-Init: Kontexte + Raumliste; bei genau einem Raum direkt oeffnen.
  if (!uxObj(adminStage, 'InitialLaden')) {
    adminStage.objects.push(uxTimer('InitialLaden', 'AdminInit'));
    const st = uxObj(adminStage, 'Status'); if (st) st.text = 'Räume werden geladen …';
  }
  uxInitGuard(adminStage, 'AdminInit', 'Raum', 'Sperre_Raeume');
  uxAutoSelect(adminStage, 'rooms', 'Raum', null, 'Act_Einzigen_Raum_automatisch_waehlen',
    { Auswahl: '${Slot0}', AuswahlName: '${Name0}', Ziel: '${Next0}' }, 'WaehleRaum');
}

// ---------- stage_house (HouseAdmin) ----------
{
  const HH = bind(house);
  uxContextNav(house, ADMIN_NAV);
  uxGate(house, [...GATED_NAV, 'RaumInfo', 'RaumEingabe', 'RoomCreate', 'RoomSave', 'RoomToggle', 'PersonInfo', 'NameEingabe', 'AvatarEingabe', 'CodeEingabe', 'PersonCreate', 'ElternEinladen', 'BeobachterEinladen']);
  // Tabs: Arbeitsbereiche oben, Rueckweg (Meine Haeuser) + Zustaendigkeiten
  // darunter — Einladen-Buttons gehoeren in den Formularbereich.
  uxMove(house, 'Haeuser', 4, 12, 13); uxMove(house, 'Raeume', 18, 12, 13);
  uxMove(house, 'KinderTab', 33, 12, 13, 'Kinder'); uxMove(house, 'ElternTab', 47, 12, 13, 'Eltern');
  uxMove(house, 'Admins', 4, 15, 16, 'Zuständigkeiten');
  uxMove(house, 'ElternEinladen', 23, 35, 18, 'Elternteil einladen');
  uxMove(house, 'BeobachterEinladen', 23, 35, 18, 'Beobachter einladen');
  // Modusbasierte Sichtbarkeit: jede Ansicht zeigt nur ihre Werkzeuge.
  const HIDE_ALL = { 'RaumInfo.visible': false, 'RaumEingabe.visible': false, 'RoomCreate.visible': false, 'RoomSave.visible': false, 'RoomToggle.visible': false, 'PersonInfo.visible': false, 'NameEingabe.visible': false, 'AvatarEingabe.visible': false, 'CodeEingabe.visible': false, 'PersonCreate.visible': false, 'ElternEinladen.visible': false, 'BeobachterEinladen.visible': false };
  uxMerge(house, 'Act_Haeuserliste_oeffnen__Ansicht_Umschalten_Und_Seitenauswahl_Setzen', { ...HIDE_ALL, 'Hilfe.text': 'Haus anklicken zum Bearbeiten.' });
  uxMerge(house, 'Act_Raeume_anzeigen__Ansicht_Umschalten_Und_Seitenauswahl_Setzen', { ...HIDE_ALL,
    'RaumInfo.visible': true, 'RaumInfo.text': 'Raumname · anlegen oder ausgewählten Raum bearbeiten', 'RaumEingabe.visible': true, 'RoomCreate.visible': true, 'RoomSave.visible': true, 'RoomToggle.visible': true,
    'Hilfe.text': 'Raum anklicken → bearbeiten. Bewohner werden unter „Bewohner“ angelegt und anschließend in der Raumverwaltung zugeordnet.' });
  uxMerge(house, 'Act_RaumAdmin_Liste_oeffnen__Ansicht_Umschalten_Und_Seitenauswahl_Setzen', { ...HIDE_ALL,
    'PersonInfo.visible': true, 'PersonInfo.text': 'Beobachter für den gewählten Raum einladen — Name eingeben', 'NameEingabe.visible': true, 'BeobachterEinladen.visible': true,
    'Hilfe.text': 'RaumAdmin anklicken → bestätigen · Beobachter: Name eingeben + „Beobachter einladen“.' });
  uxMerge(house, 'Act_Kinder_oeffnen', { ...HIDE_ALL,
    'PersonInfo.visible': true, 'PersonInfo.text': 'Elternteil einladen — zuerst Kind in der Liste wählen, dann Name eingeben', 'NameEingabe.visible': true, 'ElternEinladen.visible': true });
  uxMerge(house, 'Act_Eltern_oeffnen', { ...HIDE_ALL, 'Hilfe.text': 'Ausstehende Zuordnung anklicken und bestätigen.' });
  uxMerge(house, 'Act_Kind_gewaehlt', { 'Status.text': 'Kind ${AuswahlName} gewählt — Elternname eingeben und „Elternteil einladen“.' });
  if (!uxObj(house, 'InitialLaden')) {
    house.objects.push(uxTimer('InitialLaden', 'HausInit'));
    const st = uxObj(house, 'Status'); if (st) st.text = 'Häuser werden geladen …';
  }
  uxInitGuard(house, 'HausInit', 'Haus', 'Sperre_Haeuser');
  uxAutoSelect(house, 'houses', 'Haus', null, 'Act_Einziges_Haus_automatisch_waehlen',
    { Auswahl: '${Slot0}', AuswahlName: '${Name0}', Ziel: '${Active0}' }, 'WaehleHaus');
}

// ---------- SuperAdmin: Landing + Unter-Stages (Sidebar-Layout) ----------
// Jede Aufgabe bekommt eine eigene Stage; die Sidebar ist auf allen
// Super-Stages identisch und erlaubt direktes Springen zwischen Aufgaben.
const SUPER_TABS = [
  ['stage_super', 'Übersicht'],
  ['stage_super_houses', 'Häuser'],
  ['stage_super_admins', 'SuperAdmins'],
  ['stage_library', 'Meine Spiele'],
];
// Sidebar + Nav-Tasks auf eine Super-Stage stempeln; aktiver Eintrag mit ▸.
const uxSuperSidebar = (S, activeId) => {
  const B = bind(S);
  S.objects.push(label('SideTitel', 'AUFGABEN', 1, 2, 14, 2, 16));
  SUPER_TABS.forEach(([id, txt], i) => {
    S.objects.push(button('Navigation_' + id, (id === activeId ? '▸ ' : '') + txt, 1, 5 + i * 3, 14, 3, 'Nav_' + id));
    S.tasks.push(task('Nav_' + id, busyGuard([B.nav('Act_Nav_' + id, id)])));
  });
  S.objects.push(button('Navigation_stage_admin_login', 'Anmeldung', 1, 44, 14, 3, 'Navigation_stage_admin_login'));
  S.tasks.push(task('Navigation_stage_admin_login', busyGuard([B.nav('Act_Nav_Login', 'stage_admin_login')])));
};
// Fehleranzeige, Kontextabfrage und gemeinsame Variablen je Super-Stage.
const uxSuperBase = (S) => {
  const B = bind(S);
  S.variables.push(intVar('Busy'), objVar('KontextAntwort'), objVar('Antwort'), boolVar('DatenGueltig'));
  uxContextNav(S, {
    'Navigation_stage_super_houses.visible': '${KontextAntwort.super}',
    'Navigation_stage_super_admins.visible': '${KontextAntwort.super}',
    'Navigation_stage_library.visible': '${KontextAntwort.super}',
  });
  uxGate(S, ['Navigation_stage_super_houses', 'Navigation_stage_super_admins', 'Navigation_stage_library']);
  S.tasks.push(task('Fehler', [B.prop('Act_Fehler_Anzeige', { Busy: 0, 'Status.text': '${Antwort.message}' })]));
};
// Karten/Tabelle-Umschalter fuer eine TTable + zugehoerige Ansichtsvariable.
const uxViewToggle = (S, tableName, buttonName) => {
  const B = bind(S);
  S.variables.push(strVar('TabellenAnsicht', 'table'));
  S.tasks.push(task(buttonName + 'Task', [
    cond('TabellenAnsicht', 'table', [
      B.prop('Act_Ansicht_Karten', { TabellenAnsicht: 'cards', [tableName + '.displayMode']: 'cards', [buttonName + '.text']: '⇄ als Tabelle' }),
    ], [
      B.prop('Act_Ansicht_Tabelle', { TabellenAnsicht: 'table', [tableName + '.displayMode']: 'table', [buttonName + '.text']: '⇄ als Karten' }),
    ]),
  ]));
};

// Globale Variablen (ueberleben Stage-Wechsel): das gewaehlte Haus samt Anzeige.
// Kanonischer Ort ist der Blueprint — der Editor entfernt scope:global aus
// anderen Stages beim Laden (EditorProjectLoader), der Player wuerde sie
// dennoch importieren. Nur so verhalten sich Editor-Run und Player gleich.
const blueprintStage = project.stages.find(s => s.type === 'blueprint' || s.id === 'stage_blueprint' || s.id === 'blueprint');
if (blueprintStage) {
  blueprintStage.variables = blueprintStage.variables || [];
  const gvar = (n, def) => ({ ...variable('TStringVariable', n, def), scope: 'global' });
  [gvar('GewaehltesHaus', ''), gvar('GewaehltesHausName', ''), { ...boolVar('GewaehltesHausAktiv'), scope: 'global' }]
    .forEach(v => { if (!blueprintStage.variables.some(b => b.name === v.name)) blueprintStage.variables.push(v); });
}

// --- stage_super: Landing „Übersicht“ ---
{
  // Inhalt neu aufbauen (Shell + features bleiben erhalten).
  superStage.objects = []; superStage.tasks = []; superStage.actions = [];
  superStage.variables = [];
  const S = superStage, B = bind(S);
  uxSuperSidebar(S, 'stage_super');
  uxSuperBase(S);
  S.variables.push(intVar('HausAnzahlAktiv'), intVar('HausAnzahlGesamt'));
  S.objects.push(
    label('Titel', 'SUPERADMIN', 17, 2, 44, 2, 28),
    label('Kontext', 'Plattform › Übersicht', 17, 5, 44, 2),
    label('Status', 'Aufgabe wählen — links oder als Karte.', 17, 8, 44, 2),
    button('KarteHaeuser', '🏠  Häuser verwalten', 17, 12, 14, 7, 'Nav_stage_super_houses'),
    button('KarteAdmins', '🛡️  SuperAdmins verwalten', 32, 12, 14, 7, 'Nav_stage_super_admins'),
    button('KarteSpiele', '🎮  Meine Spiele', 47, 12, 14, 7, 'Nav_stage_library'),
    label('Kennzahlen', 'Übersicht wird geladen …', 17, 22, 44, 3, 18),
    uxTimer('InitialLaden', 'SuperInit'),
  );
  S.tasks.push(
    task('SuperInit', [callTask('Kontexte_Pruefen'), callTask('UebersichtLaden')]),
    task('UebersichtLaden', busyGuard([
      B.prop('Act_Uebersicht_Warten', { Busy: 1, 'Status.text': 'Übersicht wird geladen …' }),
      B.http('Act_Uebersicht_Haeuser', '/api/cms/admin/super-houses', {}),
      cond('Antwort.ok', true, [
        B.prop('Act_Hauszahlen', { HausAnzahlAktiv: '${Antwort.activeCount}', HausAnzahlGesamt: '${Antwort.total}' }),
        B.http('Act_Uebersicht_SuperAdmins', '/api/cms/admin/super-rootadmins', {}),
        cond('Antwort.ok', true, [
          B.prop('Act_Kennzahlen', { 'Kennzahlen.text': 'Häuser: ${HausAnzahlAktiv} aktiv von ${HausAnzahlGesamt}  ·  SuperAdmins: ${Antwort.supers}', Busy: 0, 'Status.text': 'Aufgabe wählen — links oder als Karte.' }),
        ], [callTask('Fehler')]),
      ], [callTask('Fehler')]),
    ])),
  );
}

// --- stage_super_houses: Hausliste + Anlegen ---
const housesStage = stageShell('stage_super_houses', 'SuperAdmin · Häuser');
{
  const S = housesStage, B = bind(S);
  uxSuperSidebar(S, 'stage_super_houses');
  uxSuperBase(S);
  S.variables.push(strVar('Auswahl'), strVar('AuswahlName'));
  S.objects.push(
    label('Titel', 'HÄUSER', 17, 2, 44, 2, 28),
    label('Kontext', 'Plattform › Häuser', 17, 5, 44, 2),
    label('Status', 'Haus wählen oder neu anlegen.', 17, 8, 44, 2),
    objList('HausListe', 'Häuser der Plattform'),
    table('HausTabelle', 17, 11, 44, 15, 'HausListe', [
      { field: 'name', label: 'Haus', type: 'header', x: 0, y: 0 },
      { field: 'admins', label: 'HouseAdmins', type: 'meta', x: 0, y: 1.6 },
      { field: 'belegung', label: 'Personen/Räume', type: 'meta', x: 0, y: 3.2 },
      { field: 'status', label: 'Status', type: 'badge', x: 11, y: 0.3 },
    ], 'HausZeile_Waehlen'),
    button('AnsichtToggle', '⇄ als Karten', 49, 27, 12, 3, 'AnsichtToggleTask'),
    label('HausInfo', 'Neues Haus anlegen', 17, 30, 44, 2),
    edit('HausEingabe', 17, 33, 20, 2.5, { placeholder: 'Hausname' }),
    button('HausAnlegen', 'Anlegen', 39, 33, 10, 3, 'Sperre_HausAnlegen'),
    label('Hilfe', 'Zeile anklicken → Hausdetails (Admins, Einladung, Spieler-Link).', 17, 37, 44, 2, 16),
    uxTimer('InitialLaden', 'HousesInit'),
  );
  uxViewToggle(S, 'HausTabelle', 'AnsichtToggle');
  Object.assign(uxObj(S, 'HausTabelle'), { displayMode: 'table', cardConfig: { width: 320, height: 110, gap: 14, padding: 14 } });
  S.tasks.push(
    task('HousesInit', [callTask('Kontexte_Pruefen'), callTask('Sperre_HaeuserLaden')]),
    task('Sperre_HaeuserLaden', busyGuard([callTask('HaeuserLaden')])),
    task('HaeuserLaden', [
      B.prop('Act_Haeuser_Warten', { Busy: 1, 'Status.text': 'Häuser werden geladen …' }),
      B.http('Act_Haeuser_Server', '/api/cms/admin/super-houses', {}),
      cond('Antwort.ok', true, [
        B.call('Act_Haeuser_Uebernehmen', 'HausListe', 'tryReplaceRecords', ['${Antwort.items}'], 'DatenGueltig'),
        B.prop('Act_Haeuser_Status', { Busy: 0, 'Status.text': '${Antwort.message} · ${Antwort.activeCount} aktiv von ${Antwort.total}' }),
      ], [callTask('Fehler')]),
    ]),
    task('HausZeile_Waehlen', busyGuard([
      B.prop('Act_Haus_Merken', { GewaehltesHaus: '${HausTabelle.selectedKey}', GewaehltesHausName: '${HausTabelle.selectedRecord.name}', GewaehltesHausAktiv: '${HausTabelle.selectedRecord.active}' }),
      B.nav('Act_Nav_HausDetail', 'stage_super_house'),
    ])),
    task('Sperre_HausAnlegen', busyGuard([callTask('HausAnlegenTask')])),
    task('HausAnlegenTask', [
      B.prop('Act_Anlegen_Warten', { Busy: 1, 'Status.text': 'Haus wird angelegt …' }),
      B.http('Act_Haus_Anlegen_Server', '/api/cms/admin/super-house-create', { name: '${HausEingabe.text}' }),
      cond('Antwort.ok', true, [
        B.prop('Act_Angelegt', { 'HausEingabe.text': '', 'Status.text': '${Antwort.message}' }),
        callTask('HaeuserLaden'),
      ], [callTask('Fehler')]),
    ]),
  );
}

// --- stage_super_house: Haus-Detail + HouseAdmins ---
const houseStage = stageShell('stage_super_house', 'SuperAdmin · Haus-Details');
{
  const S = houseStage, B = bind(S);
  uxSuperSidebar(S, 'stage_super_houses');
  uxSuperBase(S);
  S.variables.push(strVar('Auswahl'), strVar('AuswahlName'), boolVar('Ziel'), boolVar('ZielAktiv'), strVar('ConfirmModus'), boolVar('PersonZiel'));
  S.objects.push(
    label('Titel', 'HAUS', 17, 2, 44, 2, 28),
    label('Kontext', 'Plattform › Häuser', 17, 5, 44, 2),
    label('Status', 'Hausdetails und HouseAdmins.', 17, 8, 44, 2),
    button('Zurueck', '← Häuser', 17, 11, 10, 3, 'Nav_stage_super_houses'),
    edit('HausEingabe', 29, 11, 16, 2.5, { placeholder: 'Hausname' }),
    button('HausSpeichern', 'Speichern', 47, 11, 8, 3, 'Sperre_HausSpeichern'),
    button('HausAnAus', 'An/Aus', 56, 11, 7, 3, 'Sperre_HausAnAus'),
    button('SpielerLinkBtn', 'Spieler-Link', 17, 15, 12, 3, 'Sperre_SpielerLink'),
    edit('Link', 31, 15, 32, 2.5, { placeholder: 'Spieler-Link erscheint hier', readOnly: true }),
    label('AdminInfo', 'HouseAdmins — Zeile wählen zum Verwalten', 17, 19, 30, 2),
    objList('AdminListe', 'Erwachsene mit Hausbezug'),
    table('AdminTabelle', 17, 22, 44, 10, 'AdminListe', [
      { field: 'name', label: 'Name', type: 'header', x: 0, y: 0 },
      { field: 'zugang', label: 'Zugang', type: 'meta', x: 0, y: 1.6 },
      { field: 'andere', label: 'Weitere Häuser', type: 'meta', x: 0, y: 3.2 },
      { field: 'status', label: 'Status', type: 'badge', x: 11, y: 0.3 },
    ], 'AdminZeile_Waehlen'),
    // Person-Panel (sichtbar nach Zeilenwahl): Name/Avatar + alle Verwaltungsaktionen.
    label('PersonTitel', 'Person: —', 17, 33, 30, 2),
    label('PersonZugang', '', 48, 33, 13, 2),
    edit('PersonName', 17, 36, 20, 2.5, { placeholder: 'Anzeigename', visible: false }),
    edit('PersonAvatar', 39, 36, 6, 2.5, { placeholder: 'Avatar', visible: false }),
    button('PersonSpeichern', 'Speichern', 47, 36, 14, 3, 'Sperre_PersonSpeichern', { visible: false }),
    button('PersonRolle', 'Zuständigkeit ändern', 17, 40, 14, 3, 'PersonRolle_Vormerken', { visible: false }),
    button('PersonAktiv', 'An/Aus', 33, 40, 12, 3, 'PersonAktiv_Vormerken', { visible: false }),
    button('PersonReset', 'Zugang zurücksetzen', 47, 40, 14, 3, 'PersonReset_Vormerken', { visible: false }),
    button('Confirm', 'Bestätigen?', 17, 44, 44, 3, 'Sperre_Confirm', { visible: false }),
    button('Einladen', 'Einladen', 17, 48, 10, 3, 'Sperre_Einladen'),
    edit('Einladung', 29, 48, 32, 2.5, { placeholder: 'Einrichtungslink erscheint hier', readOnly: true }),
    edit('NameEingabe', 17, 52, 14, 2.5, { placeholder: 'Anzeigename' }),
    button('PersonAnlegen', 'Person anlegen', 33, 52, 12, 3, 'Sperre_PersonAnlegen'),
    label('Hilfe', 'Neue Person anlegen (ohne Auswahl).', 47, 52, 14, 2, 16),
    uxTimer('InitialLaden', 'HouseInit'),
  );
  uxViewToggle(S, 'AdminTabelle', 'AnsichtToggle');
  Object.assign(uxObj(S, 'AdminTabelle'), { displayMode: 'table', cardConfig: { width: 320, height: 110, gap: 14, padding: 14 } });
  S.objects.push(button('AnsichtToggle', '⇄ als Karten', 49, 19, 12, 3, 'AnsichtToggleTask'));
  for (const n of ['PersonTitel', 'PersonZugang', 'PersonName', 'PersonAvatar', 'PersonSpeichern', 'PersonRolle', 'PersonAktiv', 'PersonReset']) uxObj(S, n).visible = false;
  S.tasks.push(
    task('HouseInit', [callTask('Kontexte_Pruefen'), cond('GewaehltesHaus', '', [
      B.nav('Act_Nav_KeinHaus', 'stage_super_houses'),
    ], [
      B.prop('Act_Haus_Kontext', { 'HausEingabe.text': '${GewaehltesHausName}', 'Kontext.text': 'Plattform › Häuser › ${GewaehltesHausName}' }),
      callTask('Sperre_AdminLaden'),
    ])]),
    task('Sperre_AdminLaden', busyGuard([callTask('AdminLaden')])),
    task('AdminLaden', [
      B.prop('Act_Admins_Warten', { Busy: 1, 'Status.text': 'Personen werden geladen …' }),
      B.http('Act_Admins_Server', '/api/cms/admin/super-admins', { houseId: '${GewaehltesHaus}' }),
      cond('Antwort.ok', true, [
        B.call('Act_Admins_Uebernehmen', 'AdminListe', 'tryReplaceRecords', ['${Antwort.items}'], 'DatenGueltig'),
        B.prop('Act_Admins_Status', { Busy: 0, 'Status.text': '${Antwort.message}' }),
      ], [callTask('Fehler')]),
    ]),
    task('AdminZeile_Waehlen', busyGuard([
      B.prop('Act_Admin_Vormerken', {
        Auswahl: '${AdminTabelle.selectedKey}', AuswahlName: '${AdminTabelle.selectedRecord.name}',
        Ziel: '${AdminTabelle.selectedRecord.next}', PersonZiel: '${AdminTabelle.selectedRecord.nextActive}',
        'PersonTitel.text': 'Person: ${AdminTabelle.selectedRecord.name}', 'PersonZugang.text': '${AdminTabelle.selectedRecord.zugang}',
        'PersonName.text': '${AdminTabelle.selectedRecord.name}', 'PersonAvatar.text': '${AdminTabelle.selectedRecord.avatar}',
        'PersonTitel.visible': true, 'PersonZugang.visible': true, 'PersonName.visible': true, 'PersonAvatar.visible': true,
        'PersonSpeichern.visible': true, 'PersonRolle.visible': true, 'PersonAktiv.visible': true, 'PersonReset.visible': true,
        ConfirmModus: '', 'Confirm.visible': false, 'Status.text': 'Person gewählt — Aktion im Panel ausführen.',
      }),
    ])),
    task('PersonRolle_Vormerken', busyGuard([
      B.prop('Act_Rolle_Vormerken', { ConfirmModus: 'role', 'Confirm.text': '${AuswahlName}: HouseAdmin-Zuständigkeit ändern?', 'Confirm.visible': true }),
    ])),
    task('PersonAktiv_Vormerken', busyGuard([
      B.prop('Act_Aktiv_Vormerken', { ConfirmModus: 'active', 'Confirm.text': '${AuswahlName}: Aktivstatus umschalten?', 'Confirm.visible': true }),
    ])),
    task('PersonReset_Vormerken', busyGuard([
      B.prop('Act_Reset_Vormerken', { ConfirmModus: 'reset', 'Confirm.text': 'Zugang von ${AuswahlName} löschen und neuen Link erzeugen?', 'Confirm.visible': true }),
    ])),
    task('Sperre_PersonSpeichern', busyGuard([
      B.prop('Act_PersonSave_Warten', { Busy: 1, 'Status.text': 'Person wird gespeichert …' }),
      B.http('Act_PersonSave_Server', '/api/cms/admin/super-person-update', { houseId: '${GewaehltesHaus}', personId: '${Auswahl}', name: '${PersonName.text}', avatar: '${PersonAvatar.text}' }),
      cond('Antwort.ok', true, [
        B.prop('Act_PersonGespeichert', { 'PersonTitel.text': 'Person: ${PersonName.text}', 'AuswahlName': '${PersonName.text}', Busy: 0 }),
        callTask('AdminLaden'),
      ], [callTask('Fehler')]),
    ])),
    task('Sperre_Confirm', busyGuard([
      B.prop('Act_AdminSet_Warten', { Busy: 1, 'Confirm.visible': false, 'Status.text': 'Änderung wird gespeichert …' }),
      cond('ConfirmModus', 'active', [
        B.http('Act_PersonAktiv_Server', '/api/cms/admin/super-person-active', { houseId: '${GewaehltesHaus}', personId: '${Auswahl}', active: '${PersonZiel}', confirm: true }),
      ], [
        cond('ConfirmModus', 'reset', [
          B.http('Act_PersonReset_Server', '/api/cms/admin/super-person-reset', { houseId: '${GewaehltesHaus}', personId: '${Auswahl}', confirm: true }),
        ], [
          B.http('Act_AdminSet_Server', '/api/cms/admin/super-admin-set', { houseId: '${GewaehltesHaus}', personId: '${Auswahl}', active: '${Ziel}', confirm: true }),
        ]),
      ]),
      cond('Antwort.ok', true, [
        cond('ConfirmModus', 'reset', [B.prop('Act_Reset_Zeigen', { 'Einladung.text': '${Antwort.link}' })]),
        callTask('AdminLaden'),
      ], [callTask('Fehler')]),
    ])),
    task('Sperre_HausSpeichern', busyGuard([
      B.prop('Act_HausSave_Warten', { Busy: 1, 'Status.text': 'Haus wird gespeichert …' }),
      B.http('Act_HausSave_Server', '/api/cms/admin/super-house-update', { houseId: '${GewaehltesHaus}', name: '${HausEingabe.text}', active: '${GewaehltesHausAktiv}' }),
      cond('Antwort.ok', true, [
        B.prop('Act_HausGespeichert', { GewaehltesHausName: '${HausEingabe.text}', 'Kontext.text': 'Plattform › Häuser › ${HausEingabe.text}', Busy: 0, 'Status.text': '${Antwort.message}' }),
      ], [callTask('Fehler')]),
    ])),
    task('Sperre_HausAnAus', busyGuard([
      cond('GewaehltesHausAktiv', true, [
        B.prop('Act_Ziel_Inaktiv', { ZielAktiv: false }),
      ], [
        B.prop('Act_Ziel_Aktiv', { ZielAktiv: true }),
      ]),
      B.prop('Act_AnAus_Warten', { Busy: 1, 'Status.text': 'Hausstatus wird geändert …' }),
      B.http('Act_AnAus_Server', '/api/cms/admin/super-house-update', { houseId: '${GewaehltesHaus}', name: '${GewaehltesHausName}', active: '${ZielAktiv}' }),
      cond('Antwort.ok', true, [
        B.prop('Act_AnAus_Fertig', { GewaehltesHausAktiv: '${ZielAktiv}', Busy: 0, 'Status.text': '${Antwort.message}' }),
      ], [callTask('Fehler')]),
    ])),
    task('Sperre_SpielerLink', busyGuard([
      B.http('Act_SpielerLink_Server', '/api/cms/admin/super-player-link', { houseId: '${GewaehltesHaus}' }),
      cond('Antwort.ok', true, [
        B.prop('Act_SpielerLink_Zeigen', { 'Link.text': '${Antwort.link}', 'Status.text': '${Antwort.message}' }),
      ], [callTask('Fehler')]),
    ])),
    task('Sperre_PersonAnlegen', busyGuard([
      B.prop('Act_PersonAnlegen_Warten', { Busy: 1, 'Status.text': 'Person wird angelegt …' }),
      B.http('Act_PersonAnlegen_Server', '/api/cms/admin/super-person-create', { name: '${NameEingabe.text}' }),
      cond('Antwort.ok', true, [
        B.prop('Act_Person_Angelegt', { 'NameEingabe.text': '', 'Status.text': '${Antwort.message}' }),
        callTask('AdminLaden'),
      ], [callTask('Fehler')]),
    ])),
    task('Sperre_Einladen', [
      cond('Auswahl', '', [
        B.prop('Act_Erst_Waehlen', { 'Status.text': 'Zuerst eine Person in der Tabelle wählen.' }),
      ], busyGuard([
        B.prop('Act_Einladen_Warten', { Busy: 1, 'Status.text': 'Einladungslink wird erstellt …' }),
        B.http('Act_Einladen_Server', '/api/cms/admin/super-invite', { houseId: '${GewaehltesHaus}', personId: '${Auswahl}' }),
        cond('Antwort.ok', true, [
          B.prop('Act_Einladung_Zeigen', { 'Einladung.text': '${Antwort.link}', Busy: 0, 'Status.text': '${Antwort.message}' }),
        ], [callTask('Fehler')]),
      ])),
    ]),
  );
  S.objects.push(edit('Einladung', 17, 39, 44, 2.5, { placeholder: 'Einrichtungslink erscheint hier', readOnly: true }));
}

// --- stage_super_admins: Plattform-SuperAdmins ---
const adminsStage = stageShell('stage_super_admins', 'SuperAdmin · Plattform-Admins');
{
  const S = adminsStage, B = bind(S);
  uxSuperSidebar(S, 'stage_super_admins');
  uxSuperBase(S);
  S.variables.push(strVar('Auswahl'), strVar('AuswahlName'), boolVar('Ziel'));
  S.objects.push(
    label('Titel', 'SUPERADMINS', 17, 2, 44, 2, 28),
    label('Kontext', 'Plattform › SuperAdmins', 17, 5, 44, 2),
    label('Status', 'Person wählen, dann bestätigen.', 17, 8, 44, 2),
    objList('AdminListe', 'Erwachsene der Plattform'),
    table('AdminTabelle', 17, 11, 44, 16, 'AdminListe', [
      { field: 'name', label: 'Name', type: 'header', x: 0, y: 0 },
      { field: 'zugang', label: 'Zugang', type: 'meta', x: 0, y: 1.6 },
      { field: 'status', label: 'Status', type: 'badge', x: 11, y: 0.3 },
    ], 'AdminZeile_Waehlen'),
    button('AnsichtToggle', '⇄ als Karten', 49, 28, 12, 3, 'AnsichtToggleTask'),
    button('Confirm', 'SuperAdmin-Zuständigkeit ändern?', 17, 28, 30, 3, 'Sperre_Confirm', { visible: false }),
    edit('NameEingabe', 17, 32, 14, 2.5, { placeholder: 'Anzeigename' }),
    button('PersonAnlegen', 'Person anlegen', 33, 32, 12, 3, 'Sperre_PersonAnlegen'),
    button('Einladen', 'Einladen', 47, 32, 8, 3, 'Sperre_Einladen'),
    edit('Einladung', 17, 36, 44, 2.5, { placeholder: 'Einrichtungslink erscheint hier', readOnly: true }),
    label('Hilfe', 'Rolle: Zeile wählen → bestätigen · Einladung: erst Person wählen.', 17, 40, 44, 2, 16),
    uxTimer('InitialLaden', 'AdminsInit'),
  );
  uxViewToggle(S, 'AdminTabelle', 'AnsichtToggle');
  Object.assign(uxObj(S, 'AdminTabelle'), { displayMode: 'table', cardConfig: { width: 320, height: 110, gap: 14, padding: 14 } });
  S.tasks.push(
    task('AdminsInit', [callTask('Kontexte_Pruefen'), callTask('Sperre_AdminLaden')]),
    task('Sperre_AdminLaden', busyGuard([callTask('AdminLaden')])),
    task('AdminLaden', [
      B.prop('Act_Admins_Warten', { Busy: 1, 'Status.text': 'Personen werden geladen …' }),
      B.http('Act_Admins_Server', '/api/cms/admin/super-rootadmins', {}),
      cond('Antwort.ok', true, [
        B.call('Act_Admins_Uebernehmen', 'AdminListe', 'tryReplaceRecords', ['${Antwort.items}'], 'DatenGueltig'),
        B.prop('Act_Admins_Status', { Busy: 0, 'Status.text': '${Antwort.message} · ${Antwort.supers} SuperAdmins' }),
      ], [callTask('Fehler')]),
    ]),
    task('AdminZeile_Waehlen', busyGuard([
      B.prop('Act_Admin_Vormerken', { Auswahl: '${AdminTabelle.selectedKey}', AuswahlName: '${AdminTabelle.selectedRecord.name}', Ziel: '${AdminTabelle.selectedRecord.next}', 'Confirm.text': '${AdminTabelle.selectedRecord.name}: SuperAdmin-Zuständigkeit ändern?', 'Confirm.visible': true, 'Status.text': 'Auswahl bestätigen oder andere Zeile wählen.' }),
    ])),
    task('Sperre_Confirm', busyGuard([
      B.prop('Act_AdminSet_Warten', { Busy: 1, 'Confirm.visible': false, 'Status.text': 'Zuständigkeit wird gespeichert …' }),
      B.http('Act_AdminSet_Server', '/api/cms/admin/super-rootadmin-set', { personId: '${Auswahl}', active: '${Ziel}', confirm: true }),
      cond('Antwort.ok', true, [callTask('AdminLaden')], [callTask('Fehler')]),
    ])),
    task('Sperre_PersonAnlegen', busyGuard([
      B.prop('Act_PersonAnlegen_Warten', { Busy: 1, 'Status.text': 'Person wird angelegt …' }),
      B.http('Act_PersonAnlegen_Server', '/api/cms/admin/super-person-create', { name: '${NameEingabe.text}' }),
      cond('Antwort.ok', true, [
        B.prop('Act_Person_Angelegt', { 'NameEingabe.text': '', 'Status.text': '${Antwort.message}' }),
        callTask('AdminLaden'),
      ], [callTask('Fehler')]),
    ])),
    task('Sperre_Einladen', [
      cond('Auswahl', '', [
        B.prop('Act_Erst_Waehlen', { 'Status.text': 'Zuerst eine Person in der Tabelle wählen.' }),
      ], busyGuard([
        B.prop('Act_Einladen_Warten', { Busy: 1, 'Status.text': 'Einladungslink wird erstellt …' }),
        B.http('Act_Einladen_Server', '/api/cms/admin/super-invite', { houseId: 'root', personId: '${Auswahl}' }),
        cond('Antwort.ok', true, [
          B.prop('Act_Einladung_Zeigen', { 'Einladung.text': '${Antwort.link}', Busy: 0, 'Status.text': '${Antwort.message}' }),
        ], [callTask('Fehler')]),
      ])),
    ]),
  );
}

// ---------- stage_library ----------
const libraryStage = project.stages.find(s => s.id === 'stage_library');
if (libraryStage) {
  uxContextNav(libraryStage, ADMIN_NAV);
  uxGate(libraryStage, GATED_NAV);
  // Super-Sidebar + Layout: reparaturfaehig. Alte Fuss-Navigation, der
  // SuperAdmin-Sprung und evtl. verrueckte Sidebar-Objekte werden bei
  // jedem Lauf entfernt und sauber neu aufgebaut; Inhalte bekommen ein
  // eigenes Raster in x17-63 statt eines mechanischen Shifts.
  {
    const dropObj = new Set(['SideTitel', 'SuperAdminOeffnen',
      'Navigation_stage_main', 'Navigation_stage_admin', 'Navigation_stage_house',
      'Navigation_stage_super', 'Navigation_stage_super_houses', 'Navigation_stage_super_admins',
      'Navigation_stage_library', 'Navigation_stage_admin_login']);
    const dropTask = new Set([...dropObj, 'Navigation_SuperAdminOeffnen',
      'Nav_stage_super', 'Nav_stage_super_houses', 'Nav_stage_super_admins', 'Nav_stage_library']);
    libraryStage.objects = libraryStage.objects.filter(o => !dropObj.has(o.name));
    libraryStage.tasks = (libraryStage.tasks || []).filter(t => !dropTask.has(t.name));
    uxSuperSidebar(libraryStage, 'stage_library');
    const set = (n, x, y, w) => { const o = uxObj(libraryStage, n); if (o) { o.x = x; o.y = y; if (w) o.width = w; } };
    set('Titel', 17, 2, 44); set('Status', 17, 5, 44);
    set('SpielTitel', 17, 9, 30); set('SpielBeschreibung', 17, 13, 30);
    set('DateiWaehlen', 17, 18, 14); set('Hochladen', 33, 18, 14); set('Abbrechen', 49, 18, 12);
    set('Auswahl', 17, 23, 44);
    set('SpielKarte0', 17, 27, 21); set('SpielKarte1', 40, 27, 21); set('SpielKarte2', 17, 31, 21); set('SpielKarte3', 40, 31, 21);
    set('Veroeffentlichen', 17, 36, 21); set('Zurueckziehen', 40, 36, 21);
    set('Vorher', 17, 40, 8); set('Weiter', 26, 40, 8);
  }
  uxMerge(libraryStage, 'Act_Kontextnavigation_einblenden', {
    'Navigation_stage_super_houses.visible': '${KontextAntwort.super}',
    'Navigation_stage_super_admins.visible': '${KontextAntwort.super}',
  });
  uxGate(libraryStage, ['Navigation_stage_super_houses', 'Navigation_stage_super_admins']);
  const timer = libraryStage.objects.find(o => o.name === 'UploadInitialLaden');
  if (timer && timer.events.onTimer !== 'LibraryInit') {
    timer.events.onTimer = 'LibraryInit';
    libraryStage.tasks.push(task('LibraryInit', [callTask('Kontexte_Pruefen'), callTask('Spiele_Laden')]));
  }
}

// ============================================================
// Schreiben + Referenzprüfung (Tasks/Actions müssen auflösbar sein)
// ============================================================
// Die Admin-Verwaltung (Hausübersicht + Admin-Detailseite) wird im Projekt
// gepflegt (JSON ist Master) — vorhandene Stages bleiben unangetastet.
const existingHouse = project.stages.find(s => s.id === 'stage_super_house');
project.stages = project.stages.filter(s => !['stage_server_parent', 'stage_server_play', 'stage_server_mp', 'stage_parent', 'stage_observer', 'stage_super_houses', 'stage_super_house', 'stage_super_admins'].includes(s.id));
serverStage.group = 'Server';
playStage.group = 'Server';
mpStage.group = 'Server';
parent.group = 'Eltern & Beobachtung';
observer.group = 'Eltern & Beobachtung';
housesStage.group = 'Verwaltung';
houseStage.group = 'Verwaltung';
adminsStage.group = 'Verwaltung';
project.stages.push(serverStage, playStage, mpStage, parent, observer, housesStage, existingHouse || houseStage, adminsStage);

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

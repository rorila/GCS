// Baut die Karteikasten-Stages in GCS-CMS.json programmatisch (kein Hand-JSON):
//   stage_server_cards — Kind-/Eltern-Endpunkte /api/cms/cards/*
//   stage_cards        — Kind: „Mein Karteikasten" (ansehen, anlegen, eigene bearbeiten)
//   stage_child_cards  — Eltern: Karteikasten eines Kindes (volle Verwaltung)
// Erweitert: stage_gallery (Einstieg „Mein Karteikasten") und
// stage_parent (Button „🗂 Karteikasten" je gewähltem Kind über CMSKindId).
// Idempotent: eigene Stages/Objekte werden vor dem Einfügen entfernt.
// Aufruf: node scripts/cms/cms-add-card-stages.cjs
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const FILE = path.join(__dirname, '../../game-server/public/projects/GCS-CMS.json');

const project = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const uid = p => p + '-' + crypto.randomUUID();
const allObjects = project.stages.flatMap(s => s.objects || []);
const tmpl = cls => allObjects.find(o => o.className === cls);

const base = (cls, name, x, y, w, h, extra = {}) => {
  const t = tmpl(cls) || { style: {} };
  return { className: cls, id: uid('cms_' + cls.slice(1).toLowerCase()), name, scope: 'stage', draggable: false, droppable: false, dragMode: 'move', visible: true, x, y, width: w, height: h, zIndex: 0, rotation: 0, align: 'NONE', collisionEnabled: false, style: { ...t.style }, ...extra };
};
const label = (name, text, x, y, w, h, fontSize = 20, styleExtra = {}) => base('TLabel', name, x, y, w, h, { text, style: { color: '#edf7f4', fontSize, fontWeight: 'normal', textAlign: 'center', backgroundColor: 'transparent', borderColor: 'transparent', borderWidth: 0, ...styleExtra } });
const button = (name, text, x, y, w, h, onClick, extra = {}) => base('TButton', name, x, y, w, h, { text, icon: '', events: { onClick }, ...extra });
const edit = (name, x, y, w, h, extra = {}) => base('TEdit', name, x, y, w, h, { text: '', ...extra });
const table = (name, x, y, w, h, dataSource, columns, onSelect, extra = {}) => base('TTable', name, x, y, w, h, { dataSource, keyField: 'id', selectedKey: '', selectedRecord: null, data: [], columns, displayMode: 'cards', rowHeight: 58, showHeader: true, striped: true, selectedIndex: -1, events: onSelect ? { onSelect } : {}, ...extra });
const objList = (name, description) => ({ className: 'TObjectList', id: uid('cms_list'), name, scope: 'stage', isVariable: true, isHiddenInRun: true, draggable: false, droppable: false, dragMode: 'move', description, visible: true, x: 1, y: 1, width: 20, height: 4, zIndex: 0, rotation: 0, align: 'NONE', collisionEnabled: false, style: { ...((tmpl('TObjectList') || {}).style || {}) }, dataSource: '', keyField: 'id', selectedKey: '', selectedRecord: null, data: [] });
const variable = (cls, name, def) => ({ className: cls, id: uid('cms_var'), name, scope: 'stage', isVariable: true, isHiddenInRun: true, draggable: false, droppable: false, dragMode: 'move', description: '', visible: true, x: 0, y: 0, width: 6, height: 2, zIndex: 0, rotation: 0, align: 'NONE', collisionEnabled: false, style: {}, type: cls.replace(/^T|Variable$/g, '').toLowerCase(), defaultValue: def, value: def, objectModel: '' });
const strVar = (n, d = '') => variable('TStringVariable', n, d);
const intVar = (n, d = 0) => variable('TIntegerVariable', n, d);
const boolVar = n => variable('TBooleanVariable', n, false);
const objVar = n => variable('TObjectVariable', n, null);

const stageShell = (id, name) => ({ id, type: 'standard', name, grid: { cols: 64, rows: 40, cellSize: 18, visible: false, snapToGrid: true, backgroundColor: '#122b39' }, objects: [], tasks: [], actions: [], variables: [], flowCharts: {}, events: {}, startAnimation: 'none', features: [] });
const task = (name, actionSequence, description) => ({ id: uid('task'), name, description: description || name, actionSequence, triggerMode: 'local-sync', params: [], scope: 'stage' });
const callTask = name => ({ type: 'task', name });
const cond = (variable, value, then, else_ = [], operator = '==') => ({ type: 'condition', name: `Branch: ${variable} ${operator} ${value}`, condition: { variable, operator, value }, then, else: else_ });
const busyGuard = inner => [cond('Busy', 0, inner)];
const bind = stage => ({
  prop: (name, changes) => (stage.actions.push({ id: uid('act'), name, type: 'property', changes, scope: 'stage' }), { type: 'action', name }),
  http: (name, url, body, resultVariable = 'Antwort') => (stage.actions.push({ id: uid('act'), name, type: 'http', url, method: 'POST', body, resultVariable, scope: 'stage', queryOperator: '==' }), { type: 'action', name }),
  call: (name, target, method, params = [], resultVariable) => (stage.actions.push({ id: uid('act'), name, type: 'call_method', target, method, params, ...(resultVariable ? { resultVariable } : {}), scope: 'stage' }), { type: 'action', name }),
  nav: (name, stageId) => (stage.actions.push({ id: uid('act'), name, type: 'navigate_stage', stageId, reset: false, scope: 'stage' }), { type: 'action', name }),
});

// ============================================================
// 1. Server-Stage: stage_server_cards (Konto-Kontext — Kind oder Eltern;
//    can('viewCards'/'manageCards') liegt in den TServerCards-Methoden)
// ============================================================
const srvNs = prefix => ({
  call: name => ({ type: 'action', name: prefix + '_' + name }),
  cond: (name, variable, operator, value, then, else_) => ({ type: 'condition', name, condition: { variable, operator, value }, then, else: else_ }),
  act: (name, target, method, params, resultVariable) => ({ id: uid('srv_act'), name: prefix + '_' + name, type: 'call_method', target, method, params: params || [], resultVariable, scope: 'stage' }),
});
const srvComp = (className, name, extra = {}) => ({ className, id: uid('srv'), name, scope: 'stage', isService: true, isHiddenInRun: true, executionSide: 'server', x: 0, y: 0, width: 12, height: 3, ...extra });
const srvTask = (name, actionSequence, description) => ({ id: uid('srv_task'), name, scope: 'stage', description, actionSequence });

const cardsServer = stageShell('stage_server_cards', 'Server · Karteikästen');
{
  const tasks = [], actions = [];
  const guard = n => [
    { type: 'action', name: 'Act_KontoRolle_Pruefen' },
    n.cond('Sitzung gültig?', 'Pruefung.ok', '==', true, null, [{ type: 'action', name: 'Act_Fehler_Rolle' }]),
  ];
  const withGuard = (n, inner) => { const g = guard(n); g[1].then = inner; return g; };
  const ep = (prefix, path, method, params, taskName, desc) => {
    const n = srvNs(prefix);
    tasks.push(srvTask(taskName, withGuard(n, [
      n.call('Ausfuehren'),
      n.cond('Erfolgreich?', 'Ergebnis.ok', '==', true, [n.call('Antworten')], [n.call('Fehler')]),
    ]), desc));
    actions.push(
      n.act('Ausfuehren', 'Karten', method, [params], 'Ergebnis'),
      n.act('Antworten', 'AntwortSenden', 'send', [{ merge: '${Ergebnis}' }]),
      n.act('Fehler', 'AntwortSenden', 'fail', ['${Ergebnis.status}', '${Ergebnis.message}']),
    );
    return [path, 'Ep_' + prefix, taskName];
  };
  const endpoints = [
    ep('KartenListe', '/api/cms/cards/list', 'list',
      { childId: '$body.childId', subject: '$body.subject', topic: '$body.topic', box: '$body.box' },
      'Server_KartenListe_Verarbeiten', 'requireRole(account) → Kartenliste mit Filtern (Kind: eigener Kasten; Eltern: via Karteikasten-Stage)'),
    ep('KarteSpeichern', '/api/cms/cards/save', 'save',
      { childId: '$body.childId', cardId: '$body.cardId', question: '$body.question', answers: '$body.answers', subject: '$body.subject', topic: '$body.topic', answerFormat: '$body.answerFormat' },
      'Server_KarteSpeichern_Verarbeiten', 'requireRole(account) → Karte anlegen/ändern (Kind: nur eigene; Eltern: alle)'),
    ep('KarteLoeschen', '/api/cms/cards/delete', 'remove',
      { childId: '$body.childId', cardId: '$body.cardId' },
      'Server_KarteLoeschen_Verarbeiten', 'requireRole(account) → Karte löschen (Kind: eigene oder Fach-6-Ablage)'),
    ep('KarteInfo', '/api/cms/cards/info', 'info',
      { cardId: '$body.cardId' },
      'Server_KarteInfo_Verarbeiten', 'requireRole(account) → einzelne Karte für die Bearbeitungs-Stage'),
  ];
  cardsServer.objects = endpoints.map(([p, name, t], i) => srvComp('TServerEndpoint', name, { endpointPath: p, httpMethod: 'POST', traceEnabled: true, events: { onRequest: t }, x: 16, y: 2 + i * 4 }));
  cardsServer.objects.push(
    srvComp('TServerSession', 'Kontositzung', { x: 2, y: 2 }),
    srvComp('TServerQuery', 'Datenbestand', { x: 2, y: 7 }),
    srvComp('TServerCards', 'Karten', { x: 2, y: 12 }),
    srvComp('TServerResponse', 'AntwortSenden', { x: 2, y: 17 }),
  );
  actions.unshift(
    { id: uid('srv_act'), name: 'Act_KontoRolle_Pruefen', type: 'call_method', target: 'Kontositzung', method: 'requireRole', params: ['account'], resultVariable: 'Pruefung', scope: 'stage' },
    { id: uid('srv_act'), name: 'Act_Fehler_Rolle', type: 'call_method', target: 'AntwortSenden', method: 'fail', params: ['${Pruefung.status}', '${Pruefung.message}'], scope: 'stage' });
  const varOf = name => ({ className: 'TObjectVariable', id: uid('cms_var'), name, scope: 'stage', isVariable: true, isHiddenInRun: true, draggable: false, droppable: false, dragMode: 'move', description: '', visible: true, x: 0, y: 0, width: 6, height: 2, zIndex: 0, rotation: 0, align: 'NONE', collisionEnabled: false, style: {}, type: 'object', defaultValue: null, value: null, objectModel: '' });
  cardsServer.tasks = tasks; cardsServer.actions = actions;
  cardsServer.variables = ['Pruefung', 'Ergebnis'].map(varOf);
  cardsServer.generatedBy = 'cms-add-card-stages.cjs';
  cardsServer.group = 'Server';
  cardsServer.features = [{ id: 'server-cards', name: 'Karteikasten-Endpunkte', description: 'Deklarative Endpunkte für den persönlichen Karteikasten (Leitner).', tags: ['CMS', 'Server', 'Karteikasten'], userStoryIds: [], blueprintTaskNames: tasks.map(t => t.name) }];
}

// ============================================================
// 2. Karteikasten-UI — gemeinsamer Aufbau für Kind und Eltern.
//    parentMode=true nutzt die /api/cms/parent/*-Endpunkte mit CMSKindId.
// ============================================================
const buildCardsStage = (id, name, parentMode) => {
  const s = stageShell(id, name);
  const B = bind(s);
  const ep = parentMode
    ? { list: '/api/cms/parent/child-cards', save: '/api/cms/parent/child-card-save', del: '/api/cms/parent/child-card-delete' }
    : { list: '/api/cms/cards/list', save: '/api/cms/cards/save', del: '/api/cms/cards/delete' };
  const idBody = parentMode ? { childId: '${CMSKindId}' } : {};
  const backTarget = parentMode ? 'stage_parent' : 'stage_gallery';

  s.objects.push(
    // --- Kopfbereich ---
    label('Titel', parentMode ? 'KARTEIKASTEN DES KINDES' : 'MEIN KARTEIKASTEN', 2, 1, 40, 2, 26, { textAlign: 'left', fontWeight: 'bold' }),
    label('ProfilZeile', '', 2, 4, 34, 1.5, 14, { textAlign: 'left', opacity: '0.7' }),
    label('Status', '', 2, 6, 34, 1.5, 13, { textAlign: 'left' }),
    button('StapelGalerie', parentMode ? '🗂 Stapel zuordnen' : '🗂 Stapel finden', 40, 3, 11, 2, 'Navigation_stage_card_gallery'),
    button('Zurueck', '⬅ Zurück', 52, 3, 9, 2, 'Navigation_Zurueck'),
    // --- Filterzeile ---
    label('FilterTitel', '🔽 FILTER', 2, 8, 8, 2, 13, { textAlign: 'left' }),
    edit('FilterFach', 10, 8, 12, 2, { placeholder: 'Schulfach' }),
    edit('FilterThema', 23, 8, 12, 2, { placeholder: 'Thema' }),
    edit('FilterLernfach', 36, 8, 7, 2, { placeholder: 'Fach', inputType: 'number', maxLength: 1 }),
    button('Filtern', '🔍 Filtern', 44, 8, 9, 2, 'Sperre_KartenLaden'),
    button('FilterReset', '↺', 54, 8, 7, 2, 'Sperre_FilterLeeren'),
    label('FaecherHinweis', '', 2, 10.5, 34, 1.5, 12, { textAlign: 'left', color: '#7ee8d8', backgroundColor: 'rgba(20,184,166,0.10)', borderColor: 'rgba(20,184,166,0.35)', borderWidth: 1, borderRadius: 100 }),
    // --- Infozeile ---
    label('InfoZeile', '', 2, 12, 38, 1.5, 12, { textAlign: 'left', opacity: '0.75' }),
    label('SortZeile', 'Standard-Sortierung · Sync: ● Aktiv', 42, 12, 18, 1.5, 11, { textAlign: 'right', opacity: '0.6' }),
    // --- Kartenliste ---
    objList('Karten', 'Karten des Karteikastens (gefiltert).'),
    table('KartenTabelle', 2, 14, 60, 15, 'Karten', [
      { field: 'question', label: 'Frage' },
      { field: 'answers', label: 'Antworten' },
      { field: 'subject', label: 'Schulfach', width: '110px', type: 'badge', badgeColor: '#14b8a6' },
      { field: 'topic', label: 'Thema', width: '110px' },
      { field: 'boxLabel', label: 'Lernfach', width: '95px', type: 'badge', badgeColor: '#3b82f6', dot: true },
      { field: 'createdByName', label: 'Von', width: '90px' },
      { type: 'action', label: 'Aktionen', width: '80px', actionLabel: '✎', actionName: 'edit', title: 'Karte bearbeiten' },
    ], 'Karte_Auswaehlen', { displayMode: 'table', rowHeight: 36, events: { onSelect: 'Karte_Auswaehlen', onAction: 'Karte_Zeile_Bearbeiten' } }),
    // --- Aktionsleiste (zentriert) ---
    button('KarteBearbeiten', '✏ Bearbeiten', 20, 31, 11, 2, 'Sperre_KarteBearbeiten'),
    button('KarteNeu', '＋ Neue Karte', 32, 31, 12, 2, 'Navigation_KarteNeu'),
    ...(parentMode ? [] : [button('NeuStapel', '📦 Neuer Stapel', 45, 31, 13, 2, 'Navigation_stage_decks_create')]),
    // --- Fußzeile ---
    label('FooterLinks', '● Bereit zum Lernen / Ansehen', 2, 37, 30, 1.5, 12, { textAlign: 'left', opacity: '0.7' }),
    label('FooterVersion', 'GCS-CMS · v1', 48, 37, 12, 1.5, 11, { textAlign: 'right', opacity: '0.5' }),
    { className: 'TTimer', id: uid('timer'), name: 'InitialLaden', scope: 'stage', isService: true, isHiddenInRun: true, draggable: false, droppable: false, dragMode: 'move', events: { onTimer: 'KartenInit' }, visible: true, x: 1, y: 1, width: 4, height: 2, zIndex: 0, rotation: 0, align: 'NONE', collisionEnabled: false, style: {}, interval: 350, enabled: true, maxInterval: 1, currentInterval: 0 },
  );
  s.variables.push(
    strVar('KarteId'),
    objVar('KartenAntwort'),
    boolVar('KartenGueltig'), intVar('Busy'),
  );
  s.tasks.push(
    // --- Laden + Anzeigen ---
    task('KartenInit', [callTask('Karten_Laden')], 'Erstladung beim Betreten'),
    task('Karten_Laden', [
      B.prop('Act_Karten_Warten', { Busy: 1, 'Status.text': 'Karten werden geladen …' }),
      B.http('Act_Karten_Server', ep.list, { token: '${Token}', ...idBody, subject: '${FilterFach.text}', topic: '${FilterThema.text}', box: '${FilterLernfach.text}' }, 'KartenAntwort'),
      cond('KartenAntwort.ok', true, [callTask('Karten_Anzeigen')], [callTask('Karten_Fehler')]),
    ]),
    task('Karten_Anzeigen', [
      B.call('Act_Karten_Uebernehmen', 'Karten', 'tryReplaceRecords', ['${KartenAntwort.items}'], 'KartenGueltig'),
      cond('KartenGueltig', true,
        [B.prop('Act_Karten_Fertig', {
          Busy: 0, 'Status.text': '${KartenAntwort.message}',
          'FaecherHinweis.text': 'Fächer: ${KartenAntwort.subjectsText}',
          'ProfilZeile.text': parentMode ? 'Kind-Profil: ${KartenAntwort.childName} · Aktiv' : 'Karteikasten: ${KartenAntwort.childName}',
          'InfoZeile.text': 'ⓘ ${KartenAntwort.shown} Einträge angezeigt (von ${KartenAntwort.total} gesamt)',
        })],
        [B.prop('Act_Karten_Datenfehler', { Busy: 0, 'Status.text': 'Antwortdaten ungültig.' })]),
    ]),
    task('Karten_Fehler', [B.prop('Act_Karten_Fehler', { Busy: 0, 'Status.text': '${KartenAntwort.message}' })]),
    // --- Filter zurücksetzen ---
    task('Filter_Leeren', busyGuard([
      B.prop('Act_Filter_Leeren', { 'FilterFach.text': '', 'FilterThema.text': '', 'FilterLernfach.text': '' }),
      callTask('Karten_Laden'),
    ])),
    // --- Auswahl ---
    task('Karte_Auswaehlen', busyGuard([
      B.prop('Act_Karte_Uebernehmen', { KarteId: '${KartenTabelle.selectedKey}' }),
    ])),
    // --- Bearbeiten: eigene Stage (KarteKontextId + KarteHerkunft) ---
    task('Karte_Bearbeiten', busyGuard([
      cond('KarteId', '', [B.prop('Act_Keine_Wahl_Bearbeiten', { 'Status.text': 'Bitte zuerst eine Karte markieren.' })], [
        cond('KartenTabelle.selectedRecord.editable', true, [
          B.prop('Act_KarteKontext', { KarteKontextId: '${KarteId}', KarteHerkunft: parentMode ? 'child' : 'cards' }),
          B.nav('Act_Nav_KarteBearbeiten', 'stage_card_edit'),
        ], [B.prop('Act_NichtEditierbar', { 'Status.text': 'Diese Karte kannst du nicht ändern.' })]),
      ]),
    ])),
    // --- Zeilen-Aktions-Button (✎): Zeile wählen + direkt bearbeiten ---
    task('Karte_Zeile_Bearbeiten', busyGuard([
      B.prop('Act_Zeile_Uebernehmen', { KarteId: '${KartenTabelle.selectedKey}' }),
      callTask('Karte_Bearbeiten'),
    ])),
    // --- Neue Karte: stage_card_edit im Anlege-Modus (Kind + Eltern) ---
    task('Navigation_KarteNeu', busyGuard([
      B.prop('Act_KarteKontext_Neu', { KarteKontextId: '', KarteHerkunft: parentMode ? 'child' : 'cards' }),
      B.nav('Act_Nav_KarteNeu', 'stage_card_edit'),
    ]), 'Neue Karte anlegen'),
    // --- Neuer Stapel (nur Kind-Stage) ---
    ...(parentMode ? [] : [
      task('Navigation_stage_decks_create', busyGuard([
        B.prop('Act_Herkunft_Kasten', { DeckEditorHerkunft: 'cards' }),
        B.nav('Act_Nav_StapelNeu', 'stage_decks_create'),
      ]), 'Neuen leeren Stapel anlegen'),
    ]),
    task('Navigation_stage_card_gallery', busyGuard([B.nav('Act_Nav_StapelGalerie', 'stage_card_gallery')])),
    // --- Sperren/Navigation ---
    task('Sperre_KartenLaden', busyGuard([callTask('Karten_Laden')])),
    task('Sperre_FilterLeeren', busyGuard([callTask('Filter_Leeren')])),
    task('Sperre_KarteBearbeiten', busyGuard([callTask('Karte_Bearbeiten')])),
    task('Navigation_Zurueck', busyGuard([B.nav('Act_Nav_Zurueck', backTarget)])),
  );
  s.features = [{ id: id + '-karteikasten', name: parentMode ? 'Karteikasten des Kindes (Eltern)' : 'Mein Karteikasten', description: 'Kartenübersicht und Filter; Anlegen, Bearbeiten und Löschen in der Karten-Stage — Leitner-Fächer 1–6.', tags: ['CMS', 'Karteikasten'], userStoryIds: [], blueprintTaskNames: s.tasks.map(t => t.name) }];
  s.group = parentMode ? 'Eltern & Beobachtung' : 'Spiel';
  return s;
};

// ============================================================
// 3. stage_card_edit — markierte Karte in eigener Stage bearbeiten.
//    Kontext via KarteKontextId; Rückweg via KarteHerkunft
//    ('cards' → stage_cards, 'child' → stage_child_cards).
// ============================================================
const buildCardEditStage = () => {
  const s = stageShell('stage_card_edit', 'Karte · Bearbeiten');
  const B = bind(s);
  const back = v => [cond('KarteHerkunft', 'child', [B.nav(v + '_KindKasten', 'stage_child_cards')], [B.nav(v + '_Kasten', 'stage_cards')])];
  s.objects.push(
    label('Titel', 'KARTE BEARBEITEN', 4, 1, 40, 2, 28),
    label('Status', '', 4, 4, 40, 2),
    button('Zurueck', '⬅ Zurück', 46, 4, 14, 2, 'Navigation_Zurueck'),
    label('FrageLabel', 'FRAGE (VORDERSEITE)', 4, 8, 56, 1.5, 16),
    edit('FrageNeu', 4, 10, 56, 3, { placeholder: 'Frage' }),
    label('AntwortLabel', 'ANTWORTEN', 4, 14, 56, 1.5, 16),
    edit('AntwortenNeu', 4, 16, 56, 3, { placeholder: 'Antworten (mehrere mit ; trennen)' }),
    label('FachLabel', 'SCHULFACH UND THEMA', 4, 20, 56, 1.5, 16),
    edit('FachNeu', 4, 22, 27, 3, { placeholder: 'Schulfach, z. B. Mathe' }),
    edit('ThemaNeu', 32, 22, 28, 3, { placeholder: 'Thema (optional)' }),
    label('FormatLabel', 'ANTWORTFORMAT', 4, 26, 56, 1.5, 16),
    button('FormatText', '⌨ Eingabe', 4, 28, 13, 2, 'Format_Text_Waehlen'),
    button('FormatSelf', '🙋 Selbstbewertung', 18, 28, 16, 2, 'Format_Self_Waehlen'),
    button('KarteSpeichern', '💾 Karte speichern', 4, 31, 18, 3, 'Sperre_KarteSpeichern'),
    button('KarteLoeschen', '🗑 Löschen', 24, 31, 14, 3, 'Sperre_KarteLoeschen'),
    label('Hinweis', 'Inhaltsänderungen setzen den Lernstand der Karte zurück auf Fach 1.', 4, 36, 56, 2, 13),
    { className: 'TTimer', id: uid('timer'), name: 'InitialLaden', scope: 'stage', isService: true, isHiddenInRun: true, draggable: false, droppable: false, dragMode: 'move', events: { onTimer: 'KarteInit' }, visible: true, x: 1, y: 1, width: 4, height: 2, zIndex: 0, rotation: 0, align: 'NONE', collisionEnabled: false, style: {}, interval: 350, enabled: true, maxInterval: 1, currentInterval: 0 },
  );
  s.variables.push(strVar('Format', 'text'), objVar('KarteAntwort'), objVar('SpeicherAntwort'), objVar('LoeschAntwort'), intVar('Busy'));
  s.tasks.push(
    task('KarteInit', [
      cond('KarteKontextId', '', [
        B.prop('Act_Modus_Neu', {
          'Titel.text': 'NEUE KARTE', 'Status.text': 'Neue Karte anlegen und speichern.',
          'KarteLoeschen.visible': 0, Format: 'text',
          'FrageNeu.text': '', 'AntwortenNeu.text': '', 'FachNeu.text': '', 'ThemaNeu.text': '',
          'FormatText.text': '⌨ Eingabe ✓', 'FormatSelf.text': '🙋 Selbstbewertung',
        }),
      ], [callTask('Karte_Laden')]),
    ], 'Erstladung: Kartenkontext prüfen — leer = Neuanlage'),
    task('Karte_Laden', [
      B.prop('Act_Laden_Warten', { Busy: 1, 'Status.text': 'Karte wird geladen …' }),
      B.http('Act_Laden_Server', '/api/cms/cards/info', { token: '${Token}', cardId: '${KarteKontextId}' }, 'KarteAntwort'),
      cond('KarteAntwort.ok', true, [
        B.prop('Act_Karte_Uebernehmen', {
          Busy: 0, 'Status.text': 'Ändern und speichern.',
          'FrageNeu.text': '${KarteAntwort.card.question}',
          'AntwortenNeu.text': '${KarteAntwort.card.answersText}',
          'FachNeu.text': '${KarteAntwort.card.subject}',
          'ThemaNeu.text': '${KarteAntwort.card.topic}',
          Format: '${KarteAntwort.card.answerFormat}',
        }),
        cond('Format', 'self',
          [B.prop('Act_Format_Self_Mark', { 'FormatSelf.text': '🙋 Selbstbewertung ✓', 'FormatText.text': '⌨ Eingabe' })],
          [B.prop('Act_Format_Text_Mark', { 'FormatText.text': '⌨ Eingabe ✓', 'FormatSelf.text': '🙋 Selbstbewertung' })]),
      ], [B.prop('Act_Laden_Fehler', { Busy: 0, 'Status.text': '${KarteAntwort.message}' })]),
    ]),
    task('Karte_Speichern', [
      B.prop('Act_Speichern_Warten', { Busy: 1, 'Status.text': 'Karte wird gespeichert …' }),
      B.http('Act_Speichern_Server', '/api/cms/cards/save', { token: '${Token}', childId: '${CMSKindId}', cardId: '${KarteKontextId}', question: '${FrageNeu.text}', answers: '${AntwortenNeu.text}', subject: '${FachNeu.text}', topic: '${ThemaNeu.text}', answerFormat: '${Format}' }, 'SpeicherAntwort'),
      cond('SpeicherAntwort.ok', true, back('Act_Nav_Save'), [B.prop('Act_Speicher_Fehler', { Busy: 0, 'Status.text': '${SpeicherAntwort.message}' })]),
    ]),
    task('Karte_Loeschen', [
      B.prop('Act_Loeschen_Warten', { Busy: 1, 'Status.text': 'Karte wird gelöscht …' }),
      B.http('Act_Loeschen_Server', '/api/cms/cards/delete', { token: '${Token}', childId: '${CMSKindId}', cardId: '${KarteKontextId}' }, 'LoeschAntwort'),
      cond('LoeschAntwort.ok', true, back('Act_Nav_Del'), [B.prop('Act_Loesch_Fehler', { Busy: 0, 'Status.text': '${LoeschAntwort.message}' })]),
    ]),
    task('Format_Text_Waehlen', [B.prop('Act_Format_Text', { Format: 'text', 'FormatText.text': '⌨ Eingabe ✓', 'FormatSelf.text': '🙋 Selbstbewertung' })]),
    task('Format_Self_Waehlen', [B.prop('Act_Format_Self', { Format: 'self', 'FormatSelf.text': '🙋 Selbstbewertung ✓', 'FormatText.text': '⌨ Eingabe' })]),
    task('Sperre_KarteSpeichern', busyGuard([callTask('Karte_Speichern')])),
    task('Sperre_KarteLoeschen', busyGuard([callTask('Karte_Loeschen')])),
    task('Navigation_Zurueck', busyGuard(back('Act_Nav_Zurueck'))),
  );
  s.features = [{ id: 'card-edit', name: 'Karte bearbeiten', description: 'Markierte Karte bearbeiten oder löschen; Inhaltsänderung setzt den Lernstand zurück.', tags: ['CMS', 'Karteikasten'], userStoryIds: [], blueprintTaskNames: s.tasks.map(t => t.name) }];
  s.group = 'Spiel';
  return s;
};

// ============================================================
// 4. Stages ins Projekt einsetzen (idempotent)
// ============================================================
const removeStage = id => { const i = project.stages.findIndex(s => s.id === id); if (i >= 0) project.stages.splice(i, 1); };
const cardsExisting = project.stages.find(s => s.id === 'stage_server_cards');
if (cardsExisting && cardsExisting.generatedBy && cardsExisting.generatedBy !== 'cms-add-card-stages.cjs') { console.log('stage_server_cards wurde im Editor verändert — Abbruch.'); process.exit(1); }
removeStage('stage_server_cards');
removeStage('stage_cards');
removeStage('stage_child_cards');
removeStage('stage_card_edit');
project.stages.push(cardsServer);
project.stages.push(buildCardsStage('stage_cards', 'Kind · Mein Karteikasten', false));
project.stages.push(buildCardsStage('stage_child_cards', 'Eltern · Karteikasten des Kindes', true));
project.stages.push(buildCardEditStage());

// Blueprint-Variablen für die Bearbeitungs-Stage: KarteKontextId = gewählte
// Karte, KarteHerkunft steuert den Rückweg (Kind-Kasten oder Eltern-Kasten).
const blueprint = project.stages.find(s => s.id === 'stage_blueprint');
if (blueprint) {
  blueprint.variables = blueprint.variables || [];
  for (const [name, def] of [['KarteKontextId', ''], ['KarteHerkunft', 'cards']]) {
    if (!blueprint.variables.some(v => v.name === name)) blueprint.variables.push(variable('TStringVariable', name, def));
  }
}

// ============================================================
// 4. Navigation: Galerie-Button + Parent-Button
// ============================================================
const gallery = project.stages.find(s => s.id === 'stage_gallery');
if (gallery && !(gallery.objects || []).some(o => o.name === 'MeinKarteikasten')) {
  const G = bind(gallery);
  gallery.objects.push(button('MeinKarteikasten', '📚 Mein Karteikasten', 46, 6, 14, 3, 'Navigation_stage_cards'));
  gallery.tasks.push(task('Navigation_stage_cards', busyGuard([G.nav('Act_Nav_Karteikasten', 'stage_cards')]), 'Zum Karteikasten'));
}
const parentStage = project.stages.find(s => s.id === 'stage_parent');
if (parentStage && !(parentStage.objects || []).some(o => o.name === 'KindKarteikasten')) {
  parentStage.objects.push(button('KindKarteikasten', '🗂 Karteikasten', 36, 30, 11, 2, 'Navigation_stage_child_cards', { visible: false }));
  parentStage.tasks.push(task('Navigation_stage_child_cards', busyGuard([
    { type: 'action', name: 'Act_KindId_Setzen' },
    { type: 'action', name: 'Act_Nav_Kindkasten' },
  ]), 'Karteikasten des gewählten Kindes öffnen'));
  parentStage.actions.push(
    { id: uid('act'), name: 'Act_KindId_Setzen', type: 'property', changes: { CMSKindId: '${Kind}' }, scope: 'stage' },
    { id: uid('act'), name: 'Act_Nav_Kindkasten', type: 'navigate_stage', stageId: 'stage_child_cards', reset: false, scope: 'stage' });
  // Button einblenden sobald ein Kind gewählt ist.
  const sel = parentStage.tasks.find(t => t.name === 'Kind_Auswaehlen');
  if (sel && !JSON.stringify(sel).includes('KindKarteikasten.visible')) {
    const inner = sel.actionSequence[0];
    if (inner?.then) inner.then.push({ type: 'action', name: 'Act_Karteikasten_Einblenden' });
    parentStage.actions.push({ id: uid('act'), name: 'Act_Karteikasten_Einblenden', type: 'property', changes: { 'KindKarteikasten.visible': true }, scope: 'stage' });
  }
}

// Referenzprüfung: alle referenzierten Actions/Tasks müssen existieren.
let missing = 0;
for (const s of [cardsServer, ...project.stages.filter(x => ['stage_cards', 'stage_child_cards', 'stage_card_edit', 'stage_parent', 'stage_gallery'].includes(x.id))]) {
  const actionNames = new Set((s.actions || []).map(a => a.name));
  const taskNames = new Set((s.tasks || []).map(t => t.name));
  const walk = seq => (seq || []).forEach(step => {
    if (step.type === 'action' && !actionNames.has(step.name)) { console.error(`${s.id}: fehlende Action ${step.name}`); missing++; }
    if (step.type === 'task' && !taskNames.has(step.name) && !project.stages.some(x => (x.tasks || []).some(t => t.name === step.name))) { console.error(`${s.id}: fehlender Task ${step.name}`); missing++; }
    walk(step.then); walk(step.else); walk(step.body);
  });
  for (const t of s.tasks || []) walk(t.actionSequence);
  for (const o of s.objects || []) for (const ev of Object.values(o.events || {})) if (!taskNames.has(ev) && !project.stages.some(x => (x.tasks || []).some(t => t.name === ev))) { console.error(`${s.id}: Event-Task fehlt ${ev}`); missing++; }
}
if (missing) { console.error(missing + ' fehlende Referenzen — Abbruch.'); process.exit(1); }

// Design-System anwenden (Styles + Panel-Bänder) — siehe cms-style.cjs.
const { applyCmsTheme } = require('./cms-style.cjs');
const themeResult = applyCmsTheme(project);
console.log(`Theme: ${themeResult.styled} Objekte, ${themeResult.paneled} Panels.`);

fs.writeFileSync(FILE, JSON.stringify(project, null, 1));
console.log('Stages eingefügt: stage_server_cards, stage_cards, stage_child_cards, stage_card_edit');
console.log('Erweitert: stage_gallery (MeinKarteikasten), stage_parent (KindKarteikasten)');

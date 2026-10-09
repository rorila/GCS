// Baut die Kartenstapel-Stages in GCS-CMS.json programmatisch (kein Hand-JSON):
//   stage_server_decks  — Endpunkte /api/cms/decks/* (TServerDecks „Stapel")
//   stage_card_gallery  — Kind/Eltern: sichtbare Stapel, Vorschau, Übernehmen,
//                         Veröffentlichen eigener Stapel (Kind-Kontext CMSKindId)
//   stage_decks         — Erwachsene: Stapel pflegen, Kinder zuordnen, Freigaben
// Erweitert: stage_parent + stage_house (Einstieg „Kartenstapel"),
// stage_blueprint (Variable DeckHerkunft für die Rücknavigation).
// Idempotent: eigene Stages/Objekte werden vor dem Einfügen entfernt.
// Aufruf: node scripts/cms/cms-add-deck-stages.cjs
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
const label = (name, text, x, y, w, h, fontSize = 20) => base('TLabel', name, x, y, w, h, { text, style: { color: '#edf7f4', fontSize, fontWeight: 'normal', textAlign: 'center', backgroundColor: 'transparent', borderColor: 'transparent', borderWidth: 0 } });
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
// 1. Server-Stage: stage_server_decks — Endpunkte /api/cms/decks/*
// ============================================================
const srvNs = prefix => ({
  call: name => ({ type: 'action', name: prefix + '_' + name }),
  cond: (name, variable, operator, value, then, else_) => ({ type: 'condition', name, condition: { variable, operator, value }, then, else: else_ }),
  act: (name, target, method, params, resultVariable) => ({ id: uid('srv_act'), name: prefix + '_' + name, type: 'call_method', target, method, params: params || [], resultVariable, scope: 'stage' }),
});
const srvComp = (className, name, extra = {}) => ({ className, id: uid('srv'), name, scope: 'stage', isService: true, isHiddenInRun: true, executionSide: 'server', x: 0, y: 0, width: 12, height: 3, ...extra });
const srvTask = (name, actionSequence, description) => ({ id: uid('srv_task'), name, scope: 'stage', description, actionSequence });

const decksServer = stageShell('stage_server_decks', 'Server · Kartenstapel');
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
      n.act('Ausfuehren', 'Stapel', method, [params], 'Ergebnis'),
      n.act('Antworten', 'AntwortSenden', 'send', [{ merge: '${Ergebnis}' }]),
      n.act('Fehler', 'AntwortSenden', 'fail', ['${Ergebnis.status}', '${Ergebnis.message}']),
    );
    return [path, 'Ep_' + prefix, taskName];
  };
  const endpoints = [
    ep('StapelListe', '/api/cms/decks/list', 'decks',
      { childId: '$body.childId' },
      'Server_StapelListe_Verarbeiten', 'requireRole(account) → sichtbare Stapel eines Kasten-Kontexts'),
    ep('StapelKarten', '/api/cms/decks/cards', 'deckCards',
      { deckId: '$body.deckId', childId: '$body.childId' },
      'Server_StapelKarten_Verarbeiten', 'requireRole(account) → Stapelkarten zur Vorschau'),
    ep('StapelVerwaltung', '/api/cms/decks/manage', 'decksManage',
      {},
      'Server_StapelVerwaltung_Verarbeiten', 'requireRole(account) → verwaltbare Stapel + offene Freigaben'),
    ep('StapelInfo', '/api/cms/decks/info', 'deckInfo',
      { deckId: '$body.deckId' },
      'Server_StapelInfo_Verarbeiten', 'requireRole(account) → einzelner Stapel für die Bearbeitungs-Stage'),
    ep('StapelSpeichern', '/api/cms/decks/save', 'deckSave',
      { deckId: '$body.deckId', name: '$body.name', subject: '$body.subject', description: '$body.description' },
      'Server_StapelSpeichern_Verarbeiten', 'requireRole(account) → Stapel anlegen/umbenennen'),
    ep('StapelLoeschen', '/api/cms/decks/delete', 'deckRemove',
      { deckId: '$body.deckId' },
      'Server_StapelLoeschen_Verarbeiten', 'requireRole(account) → Stapel löschen'),
    ep('StapelKarteSpeichern', '/api/cms/decks/card-save', 'deckCardSave',
      { deckId: '$body.deckId', cardId: '$body.cardId', question: '$body.question', subject: '$body.subject', topic: '$body.topic', answers: '$body.answers', answerFormat: '$body.answerFormat' },
      'Server_StapelKarteSpeichern_Verarbeiten', 'requireRole(account) → Stapelkarte anlegen/ändern'),
    ep('StapelKarteLoeschen', '/api/cms/decks/card-delete', 'deckCardRemove',
      { deckId: '$body.deckId', cardId: '$body.cardId' },
      'Server_StapelKarteLoeschen_Verarbeiten', 'requireRole(account) → Stapelkarte löschen'),
    ep('StapelVeroeffentlichen', '/api/cms/decks/publish', 'deckPublish',
      { deckId: '$body.deckId', publish: '$body.publish' },
      'Server_StapelVeroeffentlichen_Verarbeiten', 'requireRole(account) → veröffentlichen (Kind: Freigabe anfragen)'),
    ep('StapelFreigeben', '/api/cms/decks/approve', 'deckApprove',
      { deckId: '$body.deckId', approve: '$body.approve' },
      'Server_StapelFreigeben_Verarbeiten', 'requireRole(account) → Erwachsenen-Freigabe für Kind-Stapel'),
    ep('StapelZuordnen', '/api/cms/decks/assign', 'deckAssign',
      { deckId: '$body.deckId', childId: '$body.childId', assign: '$body.assign' },
      'Server_StapelZuordnen_Verarbeiten', 'requireRole(account) → Stapel einem Kind zuordnen/entziehen'),
    ep('StapelKinder', '/api/cms/decks/assignables', 'deckAssignables',
      { deckId: '$body.deckId' },
      'Server_StapelKinder_Verarbeiten', 'requireRole(account) → Kinder im Zuordnungsbereich der Rolle'),
    ep('StapelAusThema', '/api/cms/decks/from-topic', 'deckFromTopic',
      { subject: '$body.subject', topic: '$body.topic', name: '$body.name', description: '$body.description' },
      'Server_StapelAusThema_Verarbeiten', 'requireRole(account) → Kind teilt ein Kasten-Thema als Stapel'),
    ep('StapelUebernehmen', '/api/cms/decks/import', 'deckImport',
      { deckId: '$body.deckId', childId: '$body.childId' },
      'Server_StapelUebernehmen_Verarbeiten', 'requireRole(account) → Stapelkarten in den Kasten kopieren (Dedup)'),
  ];
  decksServer.objects = endpoints.map(([p, name, t], i) => srvComp('TServerEndpoint', name, { endpointPath: p, httpMethod: 'POST', traceEnabled: true, events: { onRequest: t }, x: 16, y: 2 + i * 4 }));
  decksServer.objects.push(
    srvComp('TServerSession', 'Kontositzung', { x: 2, y: 2 }),
    srvComp('TServerQuery', 'Datenbestand', { x: 2, y: 7 }),
    srvComp('TServerDecks', 'Stapel', { x: 2, y: 12 }),
    srvComp('TServerResponse', 'AntwortSenden', { x: 2, y: 17 }),
  );
  actions.unshift(
    { id: uid('srv_act'), name: 'Act_KontoRolle_Pruefen', type: 'call_method', target: 'Kontositzung', method: 'requireRole', params: ['account'], resultVariable: 'Pruefung', scope: 'stage' },
    { id: uid('srv_act'), name: 'Act_Fehler_Rolle', type: 'call_method', target: 'AntwortSenden', method: 'fail', params: ['${Pruefung.status}', '${Pruefung.message}'], scope: 'stage' });
  const varOf = name => ({ className: 'TObjectVariable', id: uid('cms_var'), name, scope: 'stage', isVariable: true, isHiddenInRun: true, draggable: false, droppable: false, dragMode: 'move', description: '', visible: true, x: 0, y: 0, width: 6, height: 2, zIndex: 0, rotation: 0, align: 'NONE', collisionEnabled: false, style: {}, type: 'object', defaultValue: null, value: null, objectModel: '' });
  decksServer.tasks = tasks; decksServer.actions = actions;
  decksServer.variables = ['Pruefung', 'Ergebnis'].map(varOf);
  decksServer.generatedBy = 'cms-add-deck-stages.cjs';
  decksServer.group = 'Server';
  decksServer.features = [{ id: 'server-decks', name: 'Kartenstapel-Endpunkte', description: 'Deklarative Endpunkte für Kartenstapel: Sichtbarkeit, Pflege, Freigabe, Zuordnung an Kinder, Übernahme.', tags: ['CMS', 'Server', 'Kartenstapel'], userStoryIds: [], blueprintTaskNames: tasks.map(t => t.name) }];
}

// ============================================================
// 2. stage_card_gallery — Stapel-Galerie (Kind und Eltern-Kontext)
//    Kind-Kontext über ${CMSKindId} (leer = eigener Kasten).
// ============================================================
const buildGalleryStage = () => {
  const s = stageShell('stage_card_gallery', 'Kartenstapel · Galerie');
  const B = bind(s);
  s.objects.push(
    label('Titel', 'KARTENSTAPEL', 4, 1, 40, 2, 28),
    label('Status', '', 4, 4, 26, 2),
    button('NeuStapel', '＋ Neuer Stapel', 32, 4, 13, 2, 'Navigation_Neu'),
    button('Zurueck', '⬅ Zurück', 46, 4, 14, 2, 'Navigation_Zurueck'),
    objList('Stapel', 'Sichtbare Kartenstapel des Kasten-Kontexts.'),
    table('StapelTabelle', 4, 7, 56, 13, 'Stapel', [
      { field: 'name', label: 'Stapel' },
      { field: 'subject', label: 'Schulfach' },
      { field: 'status', label: 'Status' },
      { field: 'ownerName', label: 'Von' },
      { field: 'cardCount', label: 'Karten', width: '70px' },
      { field: 'newCards', label: 'Neu', width: '60px' },
    ], 'Stapel_Auswaehlen', { displayMode: 'table', rowHeight: 34 }),
    label('VorschauTitel', 'VORSCHAU', 4, 21, 15, 1.5, 16),
    button('Bearbeiten', '✏ Bearbeiten', 21, 21, 11, 2, 'Navigation_Bearbeiten', { visible: false }),
    button('Uebernehmen', '⬇ Übernehmen', 33, 21, 13, 2, 'Sperre_StapelUebernehmen', { visible: false }),
    button('Veroeffentlichen', '📢 Veröff.', 48, 21, 12, 2, 'Sperre_StapelVeroeffentlichen', { visible: false }),
    objList('StapelKarten', 'Karten des gewählten Stapels (Vorschau).'),
    table('StapelKartenTabelle', 4, 23, 56, 13, 'StapelKarten', [
      { field: 'subject', label: 'Schulfach', type: 'badge', x: 0.5, y: 0.3, width: 4, height: 1 },
      { text: '?', flipText: '!', type: 'header', x: 5.2, y: 0.15, width: 1.6, height: 1.5, style: { fontSize: 16, color: '#0ed7b5', fontWeight: 'bold', textAlign: 'center' } },
      { field: 'question', flipField: 'answers', label: 'Frage', type: 'header', x: 0.5, y: 1.9, width: 10, height: 1.8, style: { fontSize: 17, textAlign: 'center' } },
      { field: 'topic', label: 'Thema', type: 'meta', x: 0.5, y: 4.15, width: 6, height: 1 },
      { field: 'createdByName', label: 'Von', type: 'meta', x: 7, y: 4.15, width: 4, height: 1 },
    ], null, { flippable: true, cardConfig: { width: 200, height: 96, gap: 14 } }),
    label('Hinweis', 'Übernehmen legt neue Stapelkarten in den Karteikasten (Fach 1). Eigene Stapel kannst du bearbeiten — nach der Freigabe sehen sie alle Hauskinder.', 4, 37, 56, 3, 13),
    { className: 'TTimer', id: uid('timer'), name: 'InitialLaden', scope: 'stage', isService: true, isHiddenInRun: true, draggable: false, droppable: false, dragMode: 'move', events: { onTimer: 'GalerieInit' }, visible: true, x: 1, y: 1, width: 4, height: 2, zIndex: 0, rotation: 0, align: 'NONE', collisionEnabled: false, style: {}, interval: 350, enabled: true, maxInterval: 1, currentInterval: 0 },
  );
  s.variables.push(
    strVar('StapelId'),
    objVar('StapelAntwort'), objVar('KartenAntwort'), objVar('ImportAntwort'), objVar('PublishAntwort'),
    boolVar('StapelGueltig'), boolVar('KartenGueltig'), intVar('Busy'),
  );
  s.tasks.push(
    task('GalerieInit', [callTask('Stapel_Laden')], 'Erstladung beim Betreten'),
    task('Stapel_Laden', [
      B.prop('Act_Stapel_Warten', { Busy: 1, 'Status.text': 'Stapel werden geladen …' }),
      B.http('Act_Stapel_Server', '/api/cms/decks/list', { token: '${Token}', childId: '${CMSKindId}' }, 'StapelAntwort'),
      cond('StapelAntwort.ok', true, [callTask('Stapel_Anzeigen')], [B.prop('Act_Stapel_Fehler', { Busy: 0, 'Status.text': '${StapelAntwort.message}' })]),
    ]),
    task('Stapel_Anzeigen', [
      B.call('Act_Stapel_Uebernehmen', 'Stapel', 'tryReplaceRecords', ['${StapelAntwort.items}'], 'StapelGueltig'),
      cond('StapelGueltig', true,
        [B.prop('Act_Stapel_Fertig', { Busy: 0, 'Status.text': '${StapelAntwort.message}' })],
        [B.prop('Act_Stapel_Datenfehler', { Busy: 0, 'Status.text': 'Antwortdaten ungültig.' })]),
    ]),
    task('Stapel_Auswaehlen', busyGuard([
      B.prop('Act_Stapel_Wahl', {
        StapelId: '${StapelTabelle.selectedKey}',
        'VorschauTitel.text': 'VORSCHAU · ${StapelTabelle.selectedRecord.name}',
        'Bearbeiten.visible': '${StapelTabelle.selectedRecord.editable}',
        'Uebernehmen.visible': '${StapelTabelle.selectedRecord.hasNew}',
        'Veroeffentlichen.visible': '${StapelTabelle.selectedRecord.publishable}',
      }),
      callTask('StapelKarten_Laden'),
    ])),
    task('Navigation_Bearbeiten', busyGuard([
      cond('StapelId', '', [B.prop('Act_Bearbeiten_Ohne_Wahl', { 'Status.text': 'Bitte zuerst einen Stapel markieren.' })], [
        B.prop('Act_Kontext_Galerie', { DeckKontextId: '${StapelId}', DeckKontextName: '${StapelTabelle.selectedRecord.name}', DeckEditorHerkunft: 'gallery' }),
        B.nav('Act_Nav_Bearbeiten', 'stage_decks_edit'),
      ]),
    ])),
    task('Navigation_Neu', busyGuard([
      B.prop('Act_Herkunft_Galerie', { DeckEditorHerkunft: 'gallery' }),
      B.nav('Act_Nav_Neu', 'stage_decks_create'),
    ])),
    task('StapelKarten_Laden', [
      B.http('Act_StapelKarten_Server', '/api/cms/decks/cards', { token: '${Token}', childId: '${CMSKindId}', deckId: '${StapelId}' }, 'KartenAntwort'),
      cond('KartenAntwort.ok', true, [
        B.call('Act_StapelKarten_Uebernehmen', 'StapelKarten', 'tryReplaceRecords', ['${KartenAntwort.items}'], 'KartenGueltig'),
      ], [B.prop('Act_StapelKarten_Fehler', { 'Status.text': '${KartenAntwort.message}' })]),
    ]),
    task('Stapel_Uebernehmen', [
      B.prop('Act_Import_Warten', { Busy: 1, 'Status.text': 'Karten werden übernommen …' }),
      B.http('Act_Import_Server', '/api/cms/decks/import', { token: '${Token}', deckId: '${StapelId}', childId: '${CMSKindId}' }, 'ImportAntwort'),
      cond('ImportAntwort.ok', true, [
        B.prop('Act_Import_Fertig', { Busy: 0, 'Status.text': '${ImportAntwort.message}', 'Uebernehmen.visible': false }),
        callTask('Stapel_Laden'),
      ], [B.prop('Act_Import_Fehler', { Busy: 0, 'Status.text': '${ImportAntwort.message}' })]),
    ]),
    task('Stapel_Veroeffentlichen', [
      B.prop('Act_Publish_Warten', { Busy: 1, 'Status.text': 'Veröffentlichung läuft …' }),
      B.http('Act_Publish_Server', '/api/cms/decks/publish', { token: '${Token}', deckId: '${StapelId}', publish: true }, 'PublishAntwort'),
      cond('PublishAntwort.ok', true, [
        B.prop('Act_Publish_Fertig', { Busy: 0, 'Status.text': '${PublishAntwort.message}', 'Veroeffentlichen.visible': false }),
        callTask('Stapel_Laden'),
      ], [B.prop('Act_Publish_Fehler', { Busy: 0, 'Status.text': '${PublishAntwort.message}' })]),
    ]),
    task('Sperre_StapelUebernehmen', busyGuard([callTask('Stapel_Uebernehmen')])),
    task('Sperre_StapelVeroeffentlichen', busyGuard([callTask('Stapel_Veroeffentlichen')])),
    task('Navigation_Zurueck', busyGuard([
      cond('CMSKindId', '', [B.nav('Act_Nav_ZurKind', 'stage_cards')], [B.nav('Act_Nav_ZurEltern', 'stage_child_cards')]),
    ])),
  );
  s.features = [{ id: 'stage-card-gallery', name: 'Stapel-Galerie', description: 'Sichtbare Kartenstapel, flippbare Vorschau, Übernehmen in den Kasten, Veröffentlichen eigener Stapel.', tags: ['CMS', 'Kartenstapel'], userStoryIds: [], blueprintTaskNames: s.tasks.map(t => t.name) }];
  s.group = 'Spiel';
  return s;
};

// ============================================================
// 3. Kartenstapel-UI — Übersicht + drei getrennte Arbeits-Stages.
//    Der gewählte Stapel wandert via DeckKontextId/DeckKontextName
//    (Blueprint-Variablen) in die Folge-Stages.
// ============================================================

// 3a. stage_decks — Übersicht + Aufgabenwahl (Einstieg von Eltern/Haus)
const buildDecksStage = () => {
  const s = stageShell('stage_decks', 'Kartenstapel · Übersicht');
  const B = bind(s);
  s.objects.push(
    label('Titel', 'KARTENSTAPEL', 4, 1, 40, 2, 28),
    label('Status', '', 4, 4, 40, 2),
    button('Zurueck', '⬅ Zurück', 46, 4, 14, 2, 'Navigation_Zurueck'),
    objList('StapelListe', 'Verwaltbare Stapel + offene Freigaben.'),
    table('StapelTabelle', 4, 7, 56, 18, 'StapelListe', [
      { field: 'name', label: 'Stapel' },
      { field: 'subject', label: 'Schulfach', width: '120px' },
      { field: 'status', label: 'Status', width: '160px' },
      { field: 'ownerName', label: 'Von', width: '110px' },
      { field: 'cardCount', label: 'Karten', width: '70px' },
    ], 'Stapel_Auswaehlen', { displayMode: 'table', rowHeight: 34 }),
    label('AufgabeTitel', 'WAS MÖCHTEST DU TUN?', 4, 27, 56, 1.5, 16),
    button('ZuordnenNav', '👶 Kindern zuordnen', 4, 29, 16, 3, 'Navigation_Zuordnen'),
    button('BearbeitenNav', '✏ Stapel bearbeiten', 22, 29, 16, 3, 'Navigation_Bearbeiten'),
    button('NeuNav', '＋ Neuer Stapel', 40, 29, 14, 3, 'Navigation_Neu'),
    label('Hinweis', 'Markiere einen Stapel und wähle die Aufgabe. Kind-Stapel mit „wartet auf Freigabe" gibst du unter „Stapel bearbeiten" frei.', 4, 34, 56, 3, 13),
    { className: 'TTimer', id: uid('timer'), name: 'InitialLaden', scope: 'stage', isService: true, isHiddenInRun: true, draggable: false, droppable: false, dragMode: 'move', events: { onTimer: 'VerwaltungInit' }, visible: true, x: 1, y: 1, width: 4, height: 2, zIndex: 0, rotation: 0, align: 'NONE', collisionEnabled: false, style: {}, interval: 350, enabled: true, maxInterval: 1, currentInterval: 0 },
  );
  s.variables.push(strVar('StapelId'), objVar('StapelAntwort'), boolVar('StapelGueltig'), intVar('Busy'));
  s.tasks.push(
    task('VerwaltungInit', [callTask('Liste_Laden')], 'Erstladung beim Betreten'),
    task('Liste_Laden', [
      B.prop('Act_Liste_Warten', { Busy: 1, 'Status.text': 'Stapel werden geladen …' }),
      B.http('Act_Liste_Server', '/api/cms/decks/manage', { token: '${Token}' }, 'StapelAntwort'),
      cond('StapelAntwort.ok', true, [
        B.call('Act_Liste_Uebernehmen', 'StapelListe', 'tryReplaceRecords', ['${StapelAntwort.items}'], 'StapelGueltig'),
        B.prop('Act_Liste_Fertig', { Busy: 0, 'Status.text': 'Stapel markieren → Aufgabe wählen.' }),
      ], [B.prop('Act_Liste_Fehler', { Busy: 0, 'Status.text': '${StapelAntwort.message}' })]),
    ]),
    task('Stapel_Auswaehlen', busyGuard([
      B.prop('Act_Stapel_Wahl', { StapelId: '${StapelTabelle.selectedKey}', 'Status.text': 'Stapel „${StapelTabelle.selectedRecord.name}" markiert.' }),
    ])),
    task('Navigation_Zuordnen', busyGuard([
      cond('StapelId', '', [B.prop('Act_Zuordnen_Ohne_Wahl', { 'Status.text': 'Bitte zuerst einen Stapel markieren.' })], [
        B.prop('Act_Kontext_Zuordnen', { DeckKontextId: '${StapelId}', DeckKontextName: '${StapelTabelle.selectedRecord.name}' }),
        B.nav('Act_Nav_Zuordnen', 'stage_decks_assign'),
      ]),
    ])),
    task('Navigation_Bearbeiten', busyGuard([
      cond('StapelId', '', [B.prop('Act_Bearbeiten_Ohne_Wahl', { 'Status.text': 'Bitte zuerst einen Stapel markieren.' })], [
        B.prop('Act_Kontext_Bearbeiten', { DeckKontextId: '${StapelId}', DeckKontextName: '${StapelTabelle.selectedRecord.name}', DeckEditorHerkunft: 'decks' }),
        B.nav('Act_Nav_Bearbeiten', 'stage_decks_edit'),
      ]),
    ])),
    task('Navigation_Neu', busyGuard([
      B.prop('Act_Herkunft_Decks', { DeckEditorHerkunft: 'decks' }),
      B.nav('Act_Nav_Neu', 'stage_decks_create'),
    ])),
    task('Navigation_Zurueck', busyGuard([
      cond('DeckHerkunft', 'house', [B.nav('Act_Nav_ZurHaus', 'stage_house')], [B.nav('Act_Nav_ZurEltern', 'stage_parent')]),
    ])),
  );
  s.features = [{ id: 'stage-decks', name: 'Kartenstapel-Übersicht', description: 'Stapel-Liste mit Aufgabenwahl: Kindern zuordnen, bearbeiten oder neu anlegen.', tags: ['CMS', 'Kartenstapel', 'Eltern'], userStoryIds: [], blueprintTaskNames: s.tasks.map(t => t.name) }];
  s.group = 'Eltern & Beobachtung';
  return s;
};

// 3b. stage_decks_assign — nur die Zuordnung Stapel → Kind
const buildAssignStage = () => {
  const s = stageShell('stage_decks_assign', 'Kartenstapel · Kindern zuordnen');
  const B = bind(s);
  s.objects.push(
    label('Titel', 'STAPEL ZUORDNEN', 4, 1, 40, 2, 28),
    label('StapelName', '', 4, 4, 40, 2, 18),
    label('Status', '', 4, 7, 40, 2),
    button('Zurueck', '⬅ Zurück', 46, 4, 14, 2, 'Navigation_Zurueck'),
    objList('KinderListe', 'Kinder im Zuordnungsbereich dieser Rolle.'),
    table('KinderTabelle', 4, 10, 56, 20, 'KinderListe', [
      { field: 'name', label: 'Kind' },
      { field: 'assignedLabel', label: 'Zugeordnet', width: '120px' },
    ], 'Kind_Auswaehlen', { displayMode: 'table', rowHeight: 34 }),
    button('Zuordnen', '➕ Zuordnen', 4, 32, 16, 3, 'Sperre_KindZuordnen', { visible: false }),
    button('Entfernen', '➖ Entfernen', 22, 32, 16, 3, 'Sperre_KindEntfernen', { visible: false }),
    label('Hinweis', 'Zugeordnete Karten landen sofort in Fach 1 des Kindes. Beim Entfernen bleiben bereits übernommene Karten im Karteikasten erhalten.', 4, 36, 56, 3, 13),
    { className: 'TTimer', id: uid('timer'), name: 'InitialLaden', scope: 'stage', isService: true, isHiddenInRun: true, draggable: false, droppable: false, dragMode: 'move', events: { onTimer: 'ZuordnenInit' }, visible: true, x: 1, y: 1, width: 4, height: 2, zIndex: 0, rotation: 0, align: 'NONE', collisionEnabled: false, style: {}, interval: 350, enabled: true, maxInterval: 1, currentInterval: 0 },
  );
  s.variables.push(strVar('KindId'), objVar('KinderAntwort'), boolVar('KinderGueltig'), intVar('Busy'));
  s.tasks.push(
    task('ZuordnenInit', [
      B.prop('Act_Kopf_Fuellen', { 'StapelName.text': '${DeckKontextName}' }),
      cond('DeckKontextId', '', [B.prop('Act_Kein_Stapel', { 'Status.text': 'Bitte zuerst in der Übersicht einen Stapel wählen.' })], [callTask('Kinder_Laden')]),
    ], 'Erstladung: Stapelkontext prüfen, Kinder laden'),
    task('Kinder_Laden', [
      B.prop('Act_Kinder_Warten', { Busy: 1, 'Status.text': 'Kinder werden geladen …' }),
      B.http('Act_Kinder_Server', '/api/cms/decks/assignables', { token: '${Token}', deckId: '${DeckKontextId}' }, 'KinderAntwort'),
      cond('KinderAntwort.ok', true, [
        B.call('Act_Kinder_Uebernehmen', 'KinderListe', 'tryReplaceRecords', ['${KinderAntwort.items}'], 'KinderGueltig'),
        B.prop('Act_Kinder_Fertig', { Busy: 0, 'Status.text': 'Kind markieren → zuordnen oder entfernen.' }),
      ], [B.prop('Act_Kinder_Fehler', { Busy: 0, 'Status.text': '${KinderAntwort.message}' })]),
    ]),
    task('Kind_Auswaehlen', busyGuard([
      B.prop('Act_Kind_Wahl', {
        KindId: '${KinderTabelle.selectedKey}',
        'Zuordnen.visible': '${KinderTabelle.selectedRecord.canAssign}',
        'Entfernen.visible': '${KinderTabelle.selectedRecord.canUnassign}',
      }),
    ])),
    task('Kind_Zuordnen', [
      B.prop('Act_Zuordnen_Warten', { Busy: 1, 'Status.text': 'Stapel wird zugeordnet …' }),
      B.http('Act_Zuordnen_Server', '/api/cms/decks/assign', { token: '${Token}', deckId: '${DeckKontextId}', childId: '${KindId}', assign: true }, 'AktionsAntwort'),
      cond('AktionsAntwort.ok', true, [
        B.prop('Act_Zuordnen_Fertig', { 'Status.text': '${AktionsAntwort.message}' }),
        callTask('Kinder_Laden'),
      ], [B.prop('Act_Zuordnen_Fehler', { Busy: 0, 'Status.text': '${AktionsAntwort.message}' })]),
    ]),
    task('Kind_Entfernen', [
      B.prop('Act_Entfernen_Warten', { Busy: 1, 'Status.text': 'Zuordnung wird entfernt …' }),
      B.http('Act_Entfernen_Server', '/api/cms/decks/assign', { token: '${Token}', deckId: '${DeckKontextId}', childId: '${KindId}', assign: false }, 'AktionsAntwort'),
      cond('AktionsAntwort.ok', true, [
        B.prop('Act_Entfernen_Fertig', { 'Status.text': '${AktionsAntwort.message}' }),
        callTask('Kinder_Laden'),
      ], [B.prop('Act_Entfernen_Fehler', { Busy: 0, 'Status.text': '${AktionsAntwort.message}' })]),
    ]),
    task('Sperre_KindZuordnen', busyGuard([callTask('Kind_Zuordnen')])),
    task('Sperre_KindEntfernen', busyGuard([callTask('Kind_Entfernen')])),
    task('Navigation_Zurueck', busyGuard([B.nav('Act_Nav_Uebersicht', 'stage_decks')])),
  );
  s.variables.push(objVar('AktionsAntwort'));
  s.features = [{ id: 'decks-assign', name: 'Stapel einem Kind zuordnen', description: 'Kernaufgabe: gewählten Stapel einem Kind zuordnen oder die Zuordnung entfernen.', tags: ['CMS', 'Kartenstapel', 'Zuordnung'], userStoryIds: [], blueprintTaskNames: s.tasks.map(t => t.name) }];
  s.group = 'Eltern & Beobachtung';
  return s;
};

// 3c. stage_decks_create — neuen Stapel anlegen → weiter zum Befüllen
const buildCreateStage = () => {
  const s = stageShell('stage_decks_create', 'Kartenstapel · Neu anlegen');
  const B = bind(s);
  s.objects.push(
    label('Titel', 'NEUER STAPEL', 4, 1, 40, 2, 28),
    label('Status', '', 4, 4, 40, 2),
    button('Zurueck', '⬅ Zurück', 46, 4, 14, 2, 'Navigation_Zurueck'),
    label('NameLabel', 'WIE HEISST DER STAPEL?', 4, 8, 56, 1.5, 16),
    edit('NameNeu', 4, 10, 56, 3, { placeholder: 'Stapelname, z. B. Kleines Einmaleins · 11er' }),
    label('FachLabel', 'SCHULFACH UND BESCHREIBUNG', 4, 14, 56, 1.5, 16),
    edit('FachNeu', 4, 16, 27, 3, { placeholder: 'Schulfach, z. B. Mathe' }),
    edit('BeschreibungNeu', 32, 16, 28, 3, { placeholder: 'Beschreibung (optional)' }),
    button('StapelAnlegen', '＋ Stapel anlegen', 4, 21, 20, 3, 'Sperre_StapelAnlegen'),
    label('Hinweis', 'Nach dem Anlegen öffnet sich die Bearbeitung — dort fügst du die Karten hinzu.', 4, 26, 56, 3, 13),
  );
  s.variables.push(objVar('AnlegenAntwort'), intVar('Busy'));
  s.tasks.push(
    task('Stapel_Anlegen', [
      B.prop('Act_Anlegen_Warten', { Busy: 1, 'Status.text': 'Stapel wird angelegt …' }),
      B.http('Act_Anlegen_Server', '/api/cms/decks/save', { token: '${Token}', name: '${NameNeu.text}', subject: '${FachNeu.text}', description: '${BeschreibungNeu.text}' }, 'AnlegenAntwort'),
      cond('AnlegenAntwort.ok', true, [
        B.prop('Act_Kontext_Neu', { Busy: 0, DeckKontextId: '${AnlegenAntwort.deckId}', DeckKontextName: '${NameNeu.text}' }),
        B.nav('Act_Nav_Befuellen', 'stage_decks_edit'),
      ], [B.prop('Act_Anlegen_Fehler', { Busy: 0, 'Status.text': '${AnlegenAntwort.message}' })]),
    ]),
    task('Sperre_StapelAnlegen', busyGuard([callTask('Stapel_Anlegen')])),
    task('Navigation_Zurueck', busyGuard([
      cond('DeckEditorHerkunft', 'gallery', [B.nav('Act_Nav_Galerie', 'stage_card_gallery')],
        [cond('DeckEditorHerkunft', 'cards', [B.nav('Act_Nav_Kasten', 'stage_cards')], [B.nav('Act_Nav_Uebersicht', 'stage_decks')])]),
    ])),
  );
  s.features = [{ id: 'decks-create', name: 'Neuen Stapel anlegen', description: 'Metadaten des neuen Stapels erfassen; danach geht es direkt in die Bearbeitung zum Befüllen.', tags: ['CMS', 'Kartenstapel'], userStoryIds: [], blueprintTaskNames: s.tasks.map(t => t.name) }];
  s.group = 'Eltern & Beobachtung';
  return s;
};

// 3d. stage_decks_edit — Stapel-Metadaten + Karten pflegen + Zustände
const buildDeckEditStage = () => {
  const s = stageShell('stage_decks_edit', 'Kartenstapel · Bearbeiten');
  const B = bind(s);
  s.objects.push(
    label('Titel', 'STAPEL BEARBEITEN', 4, 1, 40, 2, 28),
    label('StapelName', '', 4, 4, 34, 2, 16),
    button('Zurueck', '⬅ Zurück', 46, 4, 14, 2, 'Navigation_Zurueck'),
    label('Status', '', 4, 6, 56, 1.5),
    label('StapelTitel', 'STAPEL', 4, 8, 56, 1.5, 16),
    edit('NameNeu', 4, 10, 16, 2, { placeholder: 'Stapelname' }),
    edit('FachStapel', 21, 10, 10, 2, { placeholder: 'Schulfach' }),
    edit('BeschreibungNeu', 32, 10, 28, 2, { placeholder: 'Beschreibung (optional)' }),
    button('StapelSpeichern', '💾 Speichern', 4, 13, 12, 2, 'Sperre_StapelSpeichern', { visible: false }),
    button('StapelLoeschen', '🗑 Löschen', 17, 13, 10, 2, 'Sperre_StapelLoeschen', { visible: false }),
    // Veröffentlichen und Freigeben teilen sich einen Slot — sie schließen
    // sich zustandsbedingt aus (pendingApproval XOR eigener Entwurf).
    button('Veroeffentlichen', '📢 Veröffentl.', 29, 13, 12, 2, 'Sperre_Veroeffentlichen', { visible: false }),
    button('Freigeben', '✔ Freigeben', 29, 13, 12, 2, 'Sperre_Freigeben', { visible: false }),
    button('Zurueckziehen', '⏸ Zurückziehen', 42, 13, 12, 2, 'Sperre_Zurueckziehen', { visible: false }),
    button('Ablehnen', '✖ Ablehnen', 42, 13, 12, 2, 'Sperre_Ablehnen', { visible: false }),
    // --- zwei Spalten: Stapelkarten | Karte-Formular ---
    label('KartenTitel', 'STAPELKARTEN', 4, 16, 34, 1.5, 16),
    label('KarteTitel', 'KARTE', 40, 16, 20, 1.5, 16),
    objList('StapelKarten', 'Karten des gewählten Stapels.'),
    table('StapelKartenTabelle', 4, 18, 34, 20, 'StapelKarten', [
      { field: 'question', label: 'Frage' },
      { field: 'answers', label: 'Antwort', width: '140px' },
      { field: 'topic', label: 'Thema', width: '90px' },
    ], 'Karte_Auswaehlen', { displayMode: 'table', rowHeight: 34 }),
    edit('FrageNeu', 40, 18, 20, 2, { placeholder: 'Frage' }),
    edit('AntwortenNeu', 40, 20, 20, 2, { placeholder: 'Antworten (mit ; trennen)' }),
    edit('FachKarte', 40, 22, 9, 2, { placeholder: 'Fach' }),
    edit('ThemaKarte', 51, 22, 9, 2, { placeholder: 'Thema' }),
    button('FormatText', '⌨ Eingabe', 40, 24, 9, 2, 'Format_Text_Waehlen'),
    button('FormatSelf', '🙋 Selbst', 51, 24, 9, 2, 'Format_Self_Waehlen'),
    button('KarteNeu', '↺ Neue Karte', 40, 26, 9, 2, 'Sperre_KarteNeu', { visible: false }),
    button('KarteSpeichern', '💾 Speichern', 51, 26, 9, 2, 'Sperre_KarteSpeichern', { visible: false }),
    button('KarteLoeschen', '🗑 Löschen', 40, 28, 9, 2, 'Sperre_KarteLoeschen', { visible: false }),
    label('Hinweis', 'Karten markieren zum Bearbeiten. Der Stapel erscheint zugeordneten Kindern erst nach „Veröffentlichen“.', 4, 39, 56, 1, 12),
    { className: 'TTimer', id: uid('timer'), name: 'InitialLaden', scope: 'stage', isService: true, isHiddenInRun: true, draggable: false, droppable: false, dragMode: 'move', events: { onTimer: 'BearbeitenInit' }, visible: true, x: 1, y: 1, width: 4, height: 2, zIndex: 0, rotation: 0, align: 'NONE', collisionEnabled: false, style: {}, interval: 350, enabled: true, maxInterval: 1, currentInterval: 0 },
  );
  s.variables.push(
    strVar('KarteId'), strVar('Format', 'text'), boolVar('Manageable'),
    objVar('InfoAntwort'), objVar('KartenAntwort'), objVar('MetaAntwort'), objVar('AktionsAntwort'),
    boolVar('KartenGueltig'), intVar('Busy'),
  );
  const reload = [callTask('Info_Laden')];
  s.tasks.push(
    task('BearbeitenInit', [
      B.prop('Act_Kopf_Fuellen', { 'StapelName.text': '${DeckKontextName}' }),
      cond('DeckKontextId', '', [B.prop('Act_Kein_Stapel', { 'Status.text': 'Bitte zuerst in der Übersicht einen Stapel wählen.' })], [callTask('Info_Laden')]),
    ], 'Erstladung: Stapelkontext prüfen, Stapel laden'),
    task('Info_Laden', [
      B.prop('Act_Info_Warten', { Busy: 1, 'Status.text': 'Stapel wird geladen …' }),
      B.http('Act_Info_Server', '/api/cms/decks/info', { token: '${Token}', deckId: '${DeckKontextId}' }, 'InfoAntwort'),
      cond('InfoAntwort.ok', true, [
        B.prop('Act_Info_Uebernehmen', {
          Busy: 0,
          Manageable: '${InfoAntwort.deck.manageable}',
          'StapelName.text': '${InfoAntwort.deck.name} · ${InfoAntwort.deck.status}',
          'NameNeu.text': '${InfoAntwort.deck.name}',
          'FachStapel.text': '${InfoAntwort.deck.subject}',
          'BeschreibungNeu.text': '${InfoAntwort.deck.description}',
          'StapelSpeichern.visible': '${InfoAntwort.deck.manageable}',
          'StapelLoeschen.visible': '${InfoAntwort.deck.manageable}',
          'Veroeffentlichen.visible': '${InfoAntwort.deck.canPublish}',
          'Zurueckziehen.visible': '${InfoAntwort.deck.canUnpublish}',
          'Freigeben.visible': '${InfoAntwort.deck.canApprove}',
          'Ablehnen.visible': '${InfoAntwort.deck.canApprove}',
          'KarteNeu.visible': '${InfoAntwort.deck.manageable}',
          'KarteSpeichern.visible': '${InfoAntwort.deck.manageable}',
          'Status.text': 'Bereit.',
        }),
        callTask('StapelKarten_Laden'),
      ], [B.prop('Act_Info_Fehler', { Busy: 0, 'Status.text': '${InfoAntwort.message}' })]),
    ]),
    task('StapelKarten_Laden', [
      B.http('Act_StapelKarten_Server', '/api/cms/decks/cards', { token: '${Token}', deckId: '${DeckKontextId}' }, 'KartenAntwort'),
      cond('KartenAntwort.ok', true, [
        B.call('Act_StapelKarten_Uebernehmen', 'StapelKarten', 'tryReplaceRecords', ['${KartenAntwort.items}'], 'KartenGueltig'),
      ], [B.prop('Act_StapelKarten_Fehler', { 'Status.text': '${KartenAntwort.message}' })]),
    ]),
    task('Stapel_Speichern', [
      B.prop('Act_Meta_Warten', { Busy: 1, 'Status.text': 'Stapel wird gespeichert …' }),
      B.http('Act_Meta_Server', '/api/cms/decks/save', { token: '${Token}', deckId: '${DeckKontextId}', name: '${NameNeu.text}', subject: '${FachStapel.text}', description: '${BeschreibungNeu.text}' }, 'MetaAntwort'),
      cond('MetaAntwort.ok', true, [
        B.prop('Act_Meta_Fertig', { 'Status.text': '${MetaAntwort.message}' }),
        ...reload,
      ], [B.prop('Act_Meta_Fehler', { Busy: 0, 'Status.text': '${MetaAntwort.message}' })]),
    ]),
    task('Stapel_Loeschen', [
      B.prop('Act_Loeschen_Warten', { Busy: 1, 'Status.text': 'Stapel wird gelöscht …' }),
      B.http('Act_Loeschen_Server', '/api/cms/decks/delete', { token: '${Token}', deckId: '${DeckKontextId}' }, 'AktionsAntwort'),
      cond('AktionsAntwort.ok', true, [
        B.prop('Act_Loeschen_Fertig', { Busy: 0, DeckKontextId: '', DeckKontextName: '' }),
        cond('DeckEditorHerkunft', 'gallery', [B.nav('Act_Nav_Galerie', 'stage_card_gallery')],
          [cond('DeckEditorHerkunft', 'cards', [B.nav('Act_Nav_KastenNachLoeschen', 'stage_cards')], [B.nav('Act_Nav_Nach_Loeschen', 'stage_decks')])]),
      ], [B.prop('Act_Loeschen_Fehler', { Busy: 0, 'Status.text': '${AktionsAntwort.message}' })]),
    ]),
    task('Stapel_Veroeffentlichen', [
      B.http('Act_Pub_Server', '/api/cms/decks/publish', { token: '${Token}', deckId: '${DeckKontextId}', publish: true }, 'AktionsAntwort'),
      cond('AktionsAntwort.ok', true, [B.prop('Act_Pub_Fertig', { 'Status.text': '${AktionsAntwort.message}' }), ...reload], [B.prop('Act_Pub_Fehler', { 'Status.text': '${AktionsAntwort.message}' })]),
    ]),
    task('Stapel_Zurueckziehen', [
      B.http('Act_Unpub_Server', '/api/cms/decks/publish', { token: '${Token}', deckId: '${DeckKontextId}', publish: false }, 'AktionsAntwort'),
      cond('AktionsAntwort.ok', true, [B.prop('Act_Unpub_Fertig', { 'Status.text': '${AktionsAntwort.message}' }), ...reload], [B.prop('Act_Unpub_Fehler', { 'Status.text': '${AktionsAntwort.message}' })]),
    ]),
    task('Stapel_Freigeben', [
      B.http('Act_Ok_Server', '/api/cms/decks/approve', { token: '${Token}', deckId: '${DeckKontextId}', approve: true }, 'AktionsAntwort'),
      cond('AktionsAntwort.ok', true, [B.prop('Act_Ok_Fertig', { 'Status.text': '${AktionsAntwort.message}' }), ...reload], [B.prop('Act_Ok_Fehler', { 'Status.text': '${AktionsAntwort.message}' })]),
    ]),
    task('Stapel_Ablehnen', [
      B.http('Act_No_Server', '/api/cms/decks/approve', { token: '${Token}', deckId: '${DeckKontextId}', approve: false }, 'AktionsAntwort'),
      cond('AktionsAntwort.ok', true, [B.prop('Act_No_Fertig', { 'Status.text': '${AktionsAntwort.message}' }), ...reload], [B.prop('Act_No_Fehler', { 'Status.text': '${AktionsAntwort.message}' })]),
    ]),
    task('Karte_Auswaehlen', busyGuard([
      B.prop('Act_Karte_Wahl', {
        KarteId: '${StapelKartenTabelle.selectedKey}',
        'FrageNeu.text': '${StapelKartenTabelle.selectedRecord.question}',
        'AntwortenNeu.text': '${StapelKartenTabelle.selectedRecord.answers}',
        'FachKarte.text': '${StapelKartenTabelle.selectedRecord.subject}',
        'ThemaKarte.text': '${StapelKartenTabelle.selectedRecord.topic}',
        Format: '${StapelKartenTabelle.selectedRecord.answerFormat}',
        'KarteLoeschen.visible': '${Manageable}',
      }),
    ])),
    task('Karte_Neu', busyGuard([B.prop('Act_Karte_Neu', { KarteId: '', 'FrageNeu.text': '', 'AntwortenNeu.text': '', 'ThemaKarte.text': '', 'KarteLoeschen.visible': false })])),
    task('Karte_Speichern', [
      B.prop('Act_Karte_Warten', { Busy: 1, 'Status.text': 'Stapelkarte wird gespeichert …' }),
      B.http('Act_Karte_Server', '/api/cms/decks/card-save', { token: '${Token}', deckId: '${DeckKontextId}', cardId: '${KarteId}', question: '${FrageNeu.text}', answers: '${AntwortenNeu.text}', subject: '${FachKarte.text}', topic: '${ThemaKarte.text}', answerFormat: '${Format}' }, 'AktionsAntwort'),
      cond('AktionsAntwort.ok', true, [
        B.prop('Act_Karte_Fertig', { Busy: 0, KarteId: '', 'Status.text': '${AktionsAntwort.message}', 'FrageNeu.text': '', 'AntwortenNeu.text': '', 'KarteLoeschen.visible': false }),
        callTask('StapelKarten_Laden'),
      ], [B.prop('Act_Karte_Fehler', { Busy: 0, 'Status.text': '${AktionsAntwort.message}' })]),
    ]),
    task('Karte_Loeschen', [
      B.http('Act_KarteDel_Server', '/api/cms/decks/card-delete', { token: '${Token}', deckId: '${DeckKontextId}', cardId: '${KarteId}' }, 'AktionsAntwort'),
      cond('AktionsAntwort.ok', true, [
        B.prop('Act_KarteDel_Fertig', { KarteId: '', 'Status.text': '${AktionsAntwort.message}', 'KarteLoeschen.visible': false }),
        callTask('StapelKarten_Laden'),
      ], [B.prop('Act_KarteDel_Fehler', { 'Status.text': '${AktionsAntwort.message}' })]),
    ]),
    task('Format_Text_Waehlen', [B.prop('Act_Format_Text', { Format: 'text', 'FormatText.text': '⌨ Eingabe ✓', 'FormatSelf.text': '🙋 Selbst' })]),
    task('Format_Self_Waehlen', [B.prop('Act_Format_Self', { Format: 'self', 'FormatSelf.text': '🙋 Selbst ✓', 'FormatText.text': '⌨ Eingabe' })]),
    task('Sperre_StapelSpeichern', busyGuard([callTask('Stapel_Speichern')])),
    task('Sperre_StapelLoeschen', busyGuard([callTask('Stapel_Loeschen')])),
    task('Sperre_Veroeffentlichen', busyGuard([callTask('Stapel_Veroeffentlichen')])),
    task('Sperre_Zurueckziehen', busyGuard([callTask('Stapel_Zurueckziehen')])),
    task('Sperre_Freigeben', busyGuard([callTask('Stapel_Freigeben')])),
    task('Sperre_Ablehnen', busyGuard([callTask('Stapel_Ablehnen')])),
    task('Sperre_KarteNeu', busyGuard([callTask('Karte_Neu')])),
    task('Sperre_KarteSpeichern', busyGuard([callTask('Karte_Speichern')])),
    task('Sperre_KarteLoeschen', busyGuard([callTask('Karte_Loeschen')])),
    task('Navigation_Zurueck', busyGuard([
      cond('DeckEditorHerkunft', 'gallery', [B.nav('Act_Nav_Galerie', 'stage_card_gallery')],
        [cond('DeckEditorHerkunft', 'cards', [B.nav('Act_Nav_Kasten', 'stage_cards')], [B.nav('Act_Nav_Uebersicht', 'stage_decks')])]),
    ])),
  );
  s.features = [{ id: 'decks-edit', name: 'Stapel bearbeiten', description: 'Metadaten und Karten des gewählten Stapels pflegen; veröffentlichen, zurückziehen, Kind-Stapel freigeben oder ablehnen.', tags: ['CMS', 'Kartenstapel', 'Verwaltung'], userStoryIds: [], blueprintTaskNames: s.tasks.map(t => t.name) }];
  s.group = 'Eltern & Beobachtung';
  return s;
};

// ============================================================
// 4. Stages ins Projekt einsetzen (idempotent, generatedBy-Guard)
// ============================================================
const removeStage = id => { const i = project.stages.findIndex(s => s.id === id); if (i >= 0) project.stages.splice(i, 1); };
for (const id of ['stage_server_decks', 'stage_card_gallery', 'stage_decks', 'stage_decks_assign', 'stage_decks_create', 'stage_decks_edit']) {
  const existing = project.stages.find(s => s.id === id);
  if (existing && existing.generatedBy && existing.generatedBy !== 'cms-add-deck-stages.cjs') { console.log(id + ' wurde im Editor verändert — Abbruch.'); process.exit(1); }
  removeStage(id);
}
const galleryStage = buildGalleryStage();
const decksStage = buildDecksStage();
const assignStage = buildAssignStage();
const createStage = buildCreateStage();
const editStage = buildDeckEditStage();
project.stages.push(decksServer, galleryStage, decksStage, assignStage, createStage, editStage);

// Blueprint-Variablen: DeckHerkunft für die Rücknavigation aus der Übersicht,
// DeckKontextId/DeckKontextName übergeben den gewählten Stapel an die Folge-Stages.
const blueprint = project.stages.find(s => s.id === 'stage_blueprint');
if (blueprint) {
  blueprint.variables = blueprint.variables || [];
  for (const [name, def] of [['DeckHerkunft', 'parent'], ['DeckKontextId', ''], ['DeckKontextName', ''], ['DeckEditorHerkunft', 'decks']]) {
    if (!blueprint.variables.some(v => v.name === name)) blueprint.variables.push(variable('TStringVariable', name, def));
  }
}

// Einstieg Eltern: stage_parent → „📦 Kartenstapel" (Herkunft merken).
const parentStage = project.stages.find(s => s.id === 'stage_parent');
if (parentStage && !(parentStage.objects || []).some(o => o.name === 'KartenstapelVerwalten')) {
  parentStage.objects.push(button('KartenstapelVerwalten', '📦 Kartenstapel', 48, 30, 12, 2, 'Navigation_stage_decks'));
  parentStage.tasks.push(task('Navigation_stage_decks', [
    { type: 'action', name: 'Act_Herkunft_Eltern' },
    { type: 'action', name: 'Act_Nav_StapelVerwaltung' },
  ], 'Kartenstapel-Verwaltung öffnen'));
  parentStage.actions.push(
    { id: uid('act'), name: 'Act_Herkunft_Eltern', type: 'property', changes: { DeckHerkunft: 'parent' }, scope: 'stage' },
    { id: uid('act'), name: 'Act_Nav_StapelVerwaltung', type: 'navigate_stage', stageId: 'stage_decks', reset: false, scope: 'stage' });
}

// Einstieg Hausverwaltung: Sidebar-Button in stage_house.
const houseStage = project.stages.find(s => s.id === 'stage_house');
if (houseStage && !(houseStage.objects || []).some(o => o.name === 'Navigation_stage_decks')) {
  houseStage.objects.push(button('Navigation_stage_decks', '📦 Kartenstapel', 1, 25, 12, 2.7, 'Navigation_stage_decks'));
  houseStage.tasks.push(task('Navigation_stage_decks', [
    { type: 'action', name: 'Act_Herkunft_Haus' },
    { type: 'action', name: 'Act_Nav_StapelVerwaltung' },
  ], 'Kartenstapel-Verwaltung öffnen'));
  houseStage.actions.push(
    { id: uid('act'), name: 'Act_Herkunft_Haus', type: 'property', changes: { DeckHerkunft: 'house' }, scope: 'stage' },
    { id: uid('act'), name: 'Act_Nav_StapelVerwaltung', type: 'navigate_stage', stageId: 'stage_decks', reset: false, scope: 'stage' });
}

// Referenzprüfung: alle referenzierten Actions/Tasks müssen existieren.
let missing = 0;
for (const s of [decksServer, galleryStage, decksStage, assignStage, createStage, editStage, ...project.stages.filter(x => ['stage_parent', 'stage_house'].includes(x.id))]) {
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

fs.writeFileSync(FILE, JSON.stringify(project, null, 1));
console.log('Stages eingefügt: stage_server_decks, stage_card_gallery, stage_decks, stage_decks_assign, stage_decks_create, stage_decks_edit');
console.log('Erweitert: stage_parent (KartenstapelVerwalten), stage_house (Sidebar), stage_blueprint (DeckHerkunft, DeckKontextId, DeckKontextName)');

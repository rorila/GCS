// Baut die Sponsor-Oberflächen als GCS-Stages (v8):
//   stage_sponsor            — Sponsor-Übersicht: Anfrage stellen, Begleitungen
//   stage_sponsor_detail     — Fortschritt, Vereinbarung, Nachrichten, Zustände
//   stage_sponsor_rewards    — Erfüllungspflichten melden
//   stage_parent_sponsors    — Eltern: Kontaktcodes, Anfragen, Begleitungen
//   stage_parent_sponsor_detail — Eltern: Detail, Vereinbarung, Belohnungen, Historie
//   stage_child_sponsors     — Kind: Begleiter, Belohnungen, Ablehnen/Pausieren
// Alles mit vorhandenen Komponenten (TTable/TObjectList/TLabel/TEdit/TButton/
// TTimer) — Abläufe in Tasks/Actions, Fachlogik in den Server-Endpunkten.
// Idempotent: nur eigene (namensgleiche) Einträge werden ersetzt; fremde
// Stages erhalten ausschließlich neue Nav-Objekte (Namenspräfix Sponsor*).
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const file = path.join(__dirname, '../../game-server/public/projects/GCS-CMS.json');
const project = JSON.parse(fs.readFileSync(file, 'utf8'));
const uid = p => p + '-' + crypto.randomUUID();
const base = { scope: 'stage', draggable: false, droppable: false, dragMode: 'move', visible: true, zIndex: 0, rotation: 0, align: 'NONE', collisionEnabled: false };
const textStyle = { color: '#eefafa', fontSize: 18, fontFamily: 'Segoe UI, system-ui, sans-serif' };
const buttonStyle = { ...textStyle, backgroundColor: '#1d4656', borderColor: '#58bdb2', borderWidth: 1, borderRadius: 10, fontWeight: '700' };
const activeButtonStyle = { ...buttonStyle, backgroundColor: '#2fa79b' };
const inputStyle = { color: '#10212b', fontSize: 17, fontFamily: 'Segoe UI, system-ui, sans-serif', backgroundColor: '#fff', borderColor: '#b8d4cf', borderWidth: 1, borderRadius: 8 };
const tableStyle = { ...textStyle, fontSize: 17, backgroundColor: '#193b49', borderColor: '#65b9b1', borderWidth: 1, borderRadius: 8 };
const cardStyle = { ...textStyle, color: 'transparent', fontSize: 1, backgroundColor: '#183746', borderColor: '#28505f', borderWidth: 1, borderRadius: 14 };
const sectionStyle = { ...textStyle, color: '#8fc9bf', fontSize: 13, fontWeight: 'bold' };
const hintStyle = { ...textStyle, color: '#9dbdb7', fontSize: 13 };
const obj = (className, name, x, y, width, height, extra = {}) => ({ className, id: uid('cms_obj'), name, ...base, x, y, width, height, style: {}, ...extra });
const label = (name, text, x, y, w, h, extra = {}) => obj('TLabel', name, x, y, w, h, { text, style: textStyle, ...extra });
const button = (name, text, x, y, w, h, event, active = false) => obj('TButton', name, x, y, w, h, { text, events: { onClick: event }, style: active ? activeButtonStyle : buttonStyle });
const edit = (name, placeholder, x, y, w, h = 2.6) => obj('TEdit', name, x, y, w, h, { text: '', placeholder, style: inputStyle });
const list = (name, description) => obj('TObjectList', name, 1, 1, 10, 3, { isVariable: true, isHiddenInRun: true, description, dataSource: '', keyField: 'id', selectedKey: '', selectedRecord: null, data: [], records: [], recordKey: 'id', fields: [], items: [], columns: [], displayMode: 'table', rowHeight: 28, showHeader: true, striped: true, sourceMode: 'objects', searchValue: '', searchProperty: 'name', selectedIndex: -1, recordData: {} });
const table = (name, source, columns, x, y, w, h, event) => obj('TTable', name, x, y, w, h, { events: event ? { onSelect: event } : {}, dataSource: source, keyField: 'id', selectedKey: '', selectedRecord: null, data: [], columns, displayMode: 'table', cardConfig: { width: 320, height: 110, gap: 14, padding: 14 }, rowHeight: 48, showHeader: true, striped: true, selectedIndex: -1, style: tableStyle });
const timer = taskName => obj('TTimer', 'Timer_' + taskName, 1, 45, 4, 2, { isService: true, isHiddenInRun: true, interval: 350, enabled: true, maxInterval: 1, currentInterval: 0, events: { onTimer: taskName }, style: {} });
const variable = (name, type = 'object', def = null) => ({ className: type === 'string' ? 'TStringVariable' : type === 'boolean' ? 'TBooleanVariable' : type === 'integer' ? 'TIntegerVariable' : 'TObjectVariable', id: uid('cms_var'), name, ...base, isVariable: true, isHiddenInRun: true, description: '', x: 0, y: 0, width: 6, height: 2, type, defaultValue: def, value: def, objectModel: '' });
const action = (name, type, extra) => ({ id: uid('cms_act'), name, type, scope: 'stage', ...extra });
const task = (name, seq, description = name) => ({ id: uid('cms_task'), name, description, actionSequence: seq, triggerMode: 'local-sync', params: [], scope: 'stage' });
const A = name => ({ type: 'action', name }), T = name => ({ type: 'task', name });
const C = (name, variable_, operator, value, then, else_ = []) => ({ type: 'condition', name, condition: { variable: variable_, operator, value }, then, else: else_ });
const http = (name, url, body, resultVariable = 'Antwort') => action(name, 'http', { url, method: 'POST', body, resultVariable, queryOperator: '==' });
const prop = (name, changes) => action(name, 'property', { changes });
const nav = (name, stageId) => action(name, 'navigate_stage', { stageId, reset: false });
const call = (name, target, method, params, resultVariable) => action(name, 'call_method', { target, method, params, resultVariable });
const nameOf = x => typeof x === 'string' ? x : x?.name;
const mergeByName = (existing = [], generated = []) => {
  const names = new Set(generated.map(nameOf));
  return [...existing.filter(x => !names.has(nameOf(x))), ...generated];
};
const stageOf = id => project.stages.find(s => s.id === id);
const GENERATED = 'cms-add-sponsor-stages.cjs';

// Gemeinsames Grundgerüst: Titel + Status + Seitennavigation + Abmeldung.
function shell(id, name, title, navItems, activeId) {
  const objects = [label('SidebarTitel', 'SPONSORING', 1, 1.6, 12, 1.5), label('Titel', title, 15, 1.4, 47, 2.5), label('Status', 'Bereit.', 15, 4.4, 47, 2)];
  const tasks = [], actions = [];
  navItems.forEach(([target, text], i) => { const ev = 'Navigation_' + target; objects.push(button(ev, (target === activeId ? '▸ ' : '') + text, 1, 4 + i * 3, 12, 2.7, ev, target === activeId)); actions.push(nav('Act_' + ev, target)); tasks.push(task(ev, [A('Act_' + ev)])); });
  objects.push(button('Navigation_stage_admin_login', 'Abmelden / Anmeldung', 1, 40, 12, 3, 'Navigation_stage_admin_login'));
  actions.push(nav('Act_Navigation_stage_admin_login', 'stage_admin_login'), prop('Act_Fehler_Anzeigen', { 'Status.text': '⚠ ${Antwort.message}' }));
  tasks.push(task('Navigation_stage_admin_login', [A('Act_Navigation_stage_admin_login')]), task('Fehler', [A('Act_Fehler_Anzeigen')]));
  return { id, type: 'standard', name, generatedBy: GENERATED, group: 'Sponsoring', grid: { cols: 64, rows: 48, cellSize: 18, visible: false, snapToGrid: true, backgroundColor: '#122b39' }, objects, variables: [variable('Antwort'), variable('DatenGueltig', 'boolean', false)], tasks, actions, flowCharts: [], events: {}, startAnimation: null, features: [] };
}
function addLoad(stage, { prefix, url, body, listName, into, init = 'Init_' + prefix }) {
  const steps = [prop('Act_' + prefix + '_Warten', { 'Status.text': 'Daten werden geladen …' }), http('Act_' + prefix + '_Server', url, body)];
  if (listName) steps.push(call('Act_' + prefix + '_Uebernehmen', listName, 'tryReplaceRecords', ['${Antwort.items}'], 'DatenGueltig'));
  if (into) for (const [k, v] of Object.entries(into)) steps.push(prop('Act_' + prefix + '_' + k, { [k + '.text']: v }));
  steps.push(prop('Act_' + prefix + '_Fertig', { 'Status.text': '${Antwort.message}' }));
  stage.actions.push(...steps);
  stage.tasks.push(task(prefix + '_Laden', [A('Act_' + prefix + '_Warten'), A('Act_' + prefix + '_Server'), C('Antwort ok?', 'Antwort.ok', '==', true, steps.slice(2).map(s => A(s.name)), [T('Fehler')])], prefix + ' laden'));
  if (init) { stage.tasks.push(task(init, [T(prefix + '_Laden')])); stage.objects.push(timer(init)); }
}
// Einfacher Mutations-Task: Server → Erfolg → Nachladen/Status; Fehler → Fehler.
function addMutation(stage, name, url, body, reload = []) {
  stage.actions.push(http('Act_' + name + '_Server', url, body), prop('Act_' + name + '_Ok', { 'Status.text': '${Antwort.message}' }));
  stage.tasks.push(task(name, [A('Act_' + name + '_Server'), C('Gespeichert?', 'Antwort.ok', '==', true, [A('Act_' + name + '_Ok'), ...reload.map(T)], [T('Fehler')])]));
}
function addFeature(stage, id, name, tasks_) { stage.features.push({ id: stage.id + '_' + id, name, description: 'Sponsoring-Arbeitsablauf (GCS)', tags: ['CMS', 'Sponsoring'], userStoryIds: [], blueprintTaskNames: tasks_ }); }
function put(stage) {
  const ex = stageOf(stage.id);
  if (ex && ex.generatedBy && ex.generatedBy !== GENERATED) { console.log(stage.id + ' wurde im Editor verändert — übersprungen.'); return; }
  if (ex) for (const key of ['objects', 'variables', 'tasks', 'actions', 'features']) {
    const ids = new Map((ex[key] || []).map(item => [nameOf(item), item.id]));
    for (const item of stage[key] || []) if (ids.has(nameOf(item))) item.id = ids.get(nameOf(item));
  }
  if (ex) Object.assign(ex, stage); else project.stages.push(stage);
}

const SPONSOR_NAV = [['stage_sponsor', 'Begleitungen'], ['stage_sponsor_detail', 'Details'], ['stage_sponsor_rewards', 'Belohnungen']];
const PARENT_SP_NAV = [['stage_parent', 'Kinder'], ['stage_parent_sponsors', 'Begleitungen'], ['stage_parent_sponsor_detail', 'Details'], ['stage_parent_sponsor_access', 'Sichtfreigabe'], ['stage_parent_sponsor_messages', 'Mitteilungen'], ['stage_parent_sponsor_performance', 'Leistungen']];
const CHILD_NAV = [['stage_gallery', 'Meine Spiele'], ['stage_child_sponsors', 'Meine Begleiter'], ['stage_child_sponsor_agreement', 'Vereinbarung'], ['stage_child_sponsor_messages', 'Mitteilungen']];

// ── Sponsor: Übersicht + Anfrage stellen ─────────────────────────────────────
{
  const s = shell('stage_sponsor', 'Sponsor · Begleitungen', 'Meine Begleitungen', SPONSOR_NAV, 'stage_sponsor');
  s.objects.push(
    list('BegleitungListe', 'Angefragte und laufende Begleitungen'),
    table('BegleitungTabelle', 'BegleitungListe', [
      { field: 'childName', label: 'Kind', type: 'header', x: 0, y: 0 },
      { field: 'status', label: 'Status', type: 'badge', x: 14, y: 0 },
      { field: 'periodEnd', label: 'Bis', type: 'text', x: 24, y: 0 },
    ], 15, 8, 47, 14, 'Begleitung_Waehlen'),
    label('FormTitel', 'Neue Begleitung anfragen', 15, 23.5, 47, 1.5, { style: sectionStyle }),
    label('CodeHinweis', 'Den Kontaktcode erhältst du von den Eltern des Kindes.', 15, 25, 47, 1.4, { style: hintStyle }),
    edit('KontaktCode', 'Kontaktcode der Eltern', 15, 26.6, 20),
    edit('Zweck', 'Zweck der Begleitung (z. B. Mathe fördern)', 15, 29.4, 34),
    edit('LaufzeitTage', 'Dauer in Tagen (z. B. 90)', 50, 29.4, 12),
    edit('Anmerkung', 'Erster Belohnungsvorschlag (optional)', 15, 32.2, 47),
    button('AnfrageSenden', 'Anfrage an die Eltern senden', 15, 35, 24, 3, 'Anfrage_Senden', true),
    label('AnfrageHinweis', 'Vor der Genehmigung durch alle Eltern siehst du keine Daten des Kindes.', 15, 38.4, 47, 2, { style: hintStyle }),
  );
  s.actions.push(
    prop('Act_Begleitung_Merken', { CMSBegleitungId: '${BegleitungTabelle.selectedRecord.id}', 'Status.text': 'Begleitung wird geöffnet …' }),
    nav('Act_Begleitung_Oeffnen', 'stage_sponsor_detail'),
    http('Act_Anfrage_Server', '/api/cms/sponsor/request-create', { contactCode: '${KontaktCode.text}', purpose: '${Zweck.text}', periodDays: '${LaufzeitTage.text}', notes: '${Anmerkung.text}', requestId: '${KontaktCode.text}' }),
    prop('Act_Anfrage_Ok', { 'Status.text': '${Antwort.message}', 'KontaktCode.text': '', 'Zweck.text': '', 'Anmerkung.text': '' }),
  );
  s.tasks.push(
    task('Begleitung_Waehlen', [A('Act_Begleitung_Merken'), A('Act_Begleitung_Oeffnen')]),
    task('Anfrage_Senden', [A('Act_Anfrage_Server'), C('Anfrage gesendet?', 'Antwort.ok', '==', true, [A('Act_Anfrage_Ok'), T('Begleitungen_Laden')], [T('Fehler')])]),
  );
  addLoad(s, { prefix: 'Begleitungen', url: '/api/cms/sponsor/companionships', body: {}, listName: 'BegleitungListe' });
  addFeature(s, 'request', 'Begleitung über Kontaktcode anfragen und Übersicht laden', ['Begleitungen_Laden', 'Anfrage_Senden', 'Begleitung_Waehlen']);
  put(s);
}

// ── Sponsor: Begleitungs-Detail ──────────────────────────────────────────────
{
  const s = shell('stage_sponsor_detail', 'Sponsor · Begleitung', 'Begleitung im Detail', SPONSOR_NAV, 'stage_sponsor_detail');
  s.variables.push(variable('VertragJson', 'string', ''), variable('Nachricht', 'string', ''));
  s.objects.push(
    label('KarteFortschritt', '', 15, 7, 22, 8, { style: cardStyle }), label('SektionFortschritt', 'FORTSCHRITT', 16, 7.4, 20, 1.2, { style: sectionStyle }),
    label('PunkteAnzeige', '—', 16, 8.8, 20, 2, { style: { ...textStyle, fontSize: 26 } }), label('ZielAnzeige', '—', 16, 11, 20, 1.6, { style: hintStyle }),
    label('SichtAnzeige', '—', 16, 12.8, 20, 1.6, { style: hintStyle }),
    list('MetrikListe', 'Leistungsarten im genehmigten Umfang'),
    table('MetrikTabelle', 'MetrikListe', [{ field: 'metricKey', label: 'Art', type: 'header', x: 0, y: 0 }, { field: 'points', label: 'Punkte', type: 'number', x: 12, y: 0 }, { field: 'count', label: 'Einträge', type: 'number', x: 20, y: 0 }], 39, 7, 23, 8),
    label('KarteStatus', '', 15, 16, 47, 5.6, { style: cardStyle }), label('SektionStatus', 'BEGLEITUNG', 16, 16.4, 30, 1.2, { style: sectionStyle }),
    label('ZustandAnzeige', '—', 16, 17.8, 30, 1.6, { style: { ...textStyle, fontSize: 20 } }),
    button('Pausieren', 'Pausieren', 39, 17.6, 10, 2.6, 'Begleitung_Pausieren'),
    button('Fortsetzen', 'Fortsetzen', 50, 17.6, 11, 2.6, 'Begleitung_Fortsetzen'),
    button('Beenden', 'Beenden', 39, 20.4, 10, 2.6, 'Begleitung_Beenden'),
    button('SichtVorschlag', 'Mehr Sicht vorschlagen', 50, 20.4, 11, 2.6, 'Sicht_Vorschlagen'),
    label('KarteVertrag', '', 15, 22.6, 47, 10, { style: cardStyle }), label('SektionVertrag', 'VEREINBARUNG', 16, 23, 30, 1.2, { style: sectionStyle }),
    list('VertragListe', 'Vereinbarungsversionen'),
    table('VertragTabelle', 'VertragListe', [{ field: 'version', label: 'Version', type: 'number', x: 0, y: 0 }, { field: 'status', label: 'Status', type: 'badge', x: 6, y: 0 }, { field: 'terms.pointsTarget', label: 'Ziel', type: 'number', x: 14, y: 0 }, { field: 'terms.rewardText', label: 'Belohnung', type: 'text', x: 20, y: 0 }], 16, 24.4, 46, 4.6, 'Vertrag_Waehlen'),
    edit('VertragZiel', 'Punkteziel', 16, 29.4, 10), edit('VertragBelohnung', 'Belohnung (Text)', 27, 29.4, 22),
    button('VertragVorschlagen', 'Vorschlagen', 50, 29.4, 12, 2.6, 'Vertrag_Vorschlagen'),
    button('VertragZustimmen', 'Zustimmen', 16, 32, 12, 2.6, 'Vertrag_Zustimmen', true),
    label('VertragHinweis', 'Wirksam erst, wenn alle Eltern und du zugestimmt habt.', 29, 32, 33, 2, { style: hintStyle }),
    label('KarteNachrichten', '', 15, 33.4, 47, 11, { style: cardStyle }), label('SektionNachrichten', 'MITTEILUNGEN (für die Familie sichtbar)', 16, 33.8, 45, 1.2, { style: sectionStyle }),
    list('NachrichtListe', 'Mitteilungen zur Begleitung'),
    table('NachrichtTabelle', 'NachrichtListe', [{ field: 'author', label: 'Von', type: 'header', x: 0, y: 0 }, { field: 'text', label: 'Text', type: 'text', x: 10, y: 0 }, { field: 'at', label: 'Zeit', type: 'text', x: 40, y: 0 }], 16, 35.2, 46, 5.4),
    edit('NachrichtText', 'Mitteilung an die Familie', 16, 41, 34), button('NachrichtSenden', 'Senden', 51, 41, 11, 2.6, 'Nachricht_Senden'),
    timer('SponsorDetail_Init'),
  );
  s.actions.push(
    http('Act_Fortschritt_Server', '/api/cms/sponsor/progress', { sponsorshipId: '${CMSBegleitungId}' }),
    prop('Act_Fortschritt_Anzeigen', { 'PunkteAnzeige.text': '${Antwort.totalPoints} sichtbare Punkte', 'ZielAnzeige.text': 'Für Belohnung: ${Antwort.agreement.countedPoints} / ${Antwort.agreement.pointsTarget}', 'SichtAnzeige.text': 'Sicht: ${Antwort.scope.detailLevel} · ${Antwort.scope.windowDays} Tage' }),
    prop('Act_Zustand_Anzeigen', { 'ZustandAnzeige.text': 'Status: ${Antwort.items.0.status}' }),
    http('Act_Status_Server', '/api/cms/sponsor/companionships', {}),
    http('Act_Pause_Server', '/api/cms/sponsor/pause', { sponsorshipId: '${CMSBegleitungId}' }),
    http('Act_Resume_Server', '/api/cms/sponsor/resume', { sponsorshipId: '${CMSBegleitungId}' }),
    http('Act_Ende_Server', '/api/cms/sponsor/end', { sponsorshipId: '${CMSBegleitungId}' }),
    http('Act_SichtVorschlag_Server', '/api/cms/sponsor/access-propose', { sponsorshipId: '${CMSBegleitungId}', subjectsCsv: 'math,reading', detailLevel: 'aggregates', windowDays: 180 }),
    http('Act_Vertraege_Server', '/api/cms/sponsorship/agreements', { sponsorshipId: '${CMSBegleitungId}' }),
    http('Act_VertragVorschlag_Server', '/api/cms/sponsor/agreement-propose', { sponsorshipId: '${CMSBegleitungId}', metricKeysCsv: 'math.tasks', pointsTarget: '${VertragZiel.text}', rewardText: '${VertragBelohnung.text}' }),
    http('Act_VertragZustimmung_Server', '/api/cms/sponsor/agreement-consent', { agreementId: '${VertragTabelle.selectedRecord.agreementId}', version: '${VertragTabelle.selectedRecord.version}', approve: true }),
    http('Act_Nachrichten_Server', '/api/cms/sponsor/messages', { sponsorshipId: '${CMSBegleitungId}' }),
    http('Act_NachrichtSenden_Server', '/api/cms/sponsor/message-send', { sponsorshipId: '${CMSBegleitungId}', text: '${NachrichtText.text}' }),
    prop('Act_Nachricht_Gesendet', { 'Status.text': '${Antwort.message}', 'NachrichtText.text': '' }),
    call('Act_Metriken_Uebernehmen', 'MetrikListe', 'tryReplaceRecords', ['${Antwort.metrics}'], 'DatenGueltig'),
    call('Act_Vertraege_Uebernehmen', 'VertragListe', 'tryReplaceRecords', ['${Antwort.items.0.versions}'], 'DatenGueltig'),
    call('Act_Nachrichten_Uebernehmen', 'NachrichtListe', 'tryReplaceRecords', ['${Antwort.items}'], 'DatenGueltig'),
  );
  s.tasks.push(
    task('SponsorDetail_Init', [T('Fortschritt_Laden'), T('Status_Laden'), T('Vertraege_Laden'), T('Nachrichten_Laden')]),
    task('Fortschritt_Laden', [A('Act_Fortschritt_Server'), C('Fortschritt ok?', 'Antwort.ok', '==', true, [A('Act_Metriken_Uebernehmen'), A('Act_Fortschritt_Anzeigen')], [T('Fehler')])]),
    task('Status_Laden', [A('Act_Status_Server'), C('Status ok?', 'Antwort.ok', '==', true, [A('Act_Zustand_Anzeigen')], [T('Fehler')])]),
    task('Vertraege_Laden', [A('Act_Vertraege_Server'), C('Verträge ok?', 'Antwort.ok', '==', true, [A('Act_Vertraege_Uebernehmen')], [T('Fehler')])]),
    task('Nachrichten_Laden', [A('Act_Nachrichten_Server'), C('Nachrichten ok?', 'Antwort.ok', '==', true, [A('Act_Nachrichten_Uebernehmen')], [T('Fehler')])]),
    task('Begleitung_Pausieren', [A('Act_Pause_Server'), C('Pausiert?', 'Antwort.ok', '==', true, [A('Act_Nachricht_Gesendet'), T('Status_Laden')], [T('Fehler')])]),
    task('Begleitung_Fortsetzen', [A('Act_Resume_Server'), C('Fortgesetzt?', 'Antwort.ok', '==', true, [A('Act_Nachricht_Gesendet'), T('Status_Laden')], [T('Fehler')])]),
    task('Begleitung_Beenden', [A('Act_Ende_Server'), C('Beendet?', 'Antwort.ok', '==', true, [A('Act_Nachricht_Gesendet'), T('Status_Laden')], [T('Fehler')])]),
    task('Sicht_Vorschlagen', [A('Act_SichtVorschlag_Server'), C('Vorgeschlagen?', 'Antwort.ok', '==', true, [A('Act_Nachricht_Gesendet')], [T('Fehler')])]),
    task('Vertrag_Vorschlagen', [A('Act_VertragVorschlag_Server'), C('Vorgeschlagen?', 'Antwort.ok', '==', true, [A('Act_Nachricht_Gesendet'), T('Vertraege_Laden')], [T('Fehler')])]),
    task('Vertrag_Zustimmen', [A('Act_VertragZustimmung_Server'), C('Zugestimmt?', 'Antwort.ok', '==', true, [A('Act_Nachricht_Gesendet'), T('Vertraege_Laden')], [T('Fehler')])]),
    task('Nachricht_Senden', [A('Act_NachrichtSenden_Server'), C('Gesendet?', 'Antwort.ok', '==', true, [A('Act_Nachricht_Gesendet'), T('Nachrichten_Laden')], [T('Fehler')])]),
  );
  addFeature(s, 'detail', 'Fortschritt, Vereinbarung und Mitteilungen der Begleitung', ['SponsorDetail_Init']);
  put(s);
}

// ── Sponsor: Belohnungen ─────────────────────────────────────────────────────
{
  const s = shell('stage_sponsor_rewards', 'Sponsor · Belohnungen', 'Erfüllungspflichten', SPONSOR_NAV, 'stage_sponsor_rewards');
  s.objects.push(
    label('Hinweis', 'Freigegebene Belohnungen erfüllst du außerhalb des Systems — melde die Erfüllung hier, die Eltern bestätigen sie.', 15, 7, 47, 2.6, { style: hintStyle }),
    list('PflichtListe', 'Freigegebene und erfüllte Belohnungen'),
    table('PflichtTabelle', 'PflichtListe', [
      { field: 'rewardText', label: 'Belohnung', type: 'header', x: 0, y: 0 },
      { field: 'childName', label: 'Kind', type: 'text', x: 24, y: 0 },
      { field: 'status', label: 'Status', type: 'badge', x: 34, y: 0 },
    ], 15, 10, 47, 16, 'Pflicht_Waehlen'),
    edit('ErfuellungNotiz', 'Kurze Notiz zur Erfüllung (optional)', 15, 28, 34),
    button('ErfuellungMelden', 'Erfüllung melden', 50, 28, 12, 2.8, 'Erfuellung_Melden', true),
  );
  s.actions.push(
    prop('Act_Pflicht_Merken', { CMSAnspruchKey: '${PflichtTabelle.selectedRecord.entitlementKey}', 'Status.text': 'Anspruch gewählt: ${PflichtTabelle.selectedRecord.rewardText}' }),
    http('Act_Erfuellung_Server', '/api/cms/sponsor/reward-fulfillment', { claimKey: '${CMSAnspruchKey}', note: '${ErfuellungNotiz.text}' }),
    prop('Act_Erfuellung_Ok', { 'Status.text': '${Antwort.message}', 'ErfuellungNotiz.text': '' }),
  );
  s.tasks.push(
    task('Pflicht_Waehlen', [A('Act_Pflicht_Merken')]),
    task('Erfuellung_Melden', [A('Act_Erfuellung_Server'), C('Gemeldet?', 'Antwort.ok', '==', true, [A('Act_Erfuellung_Ok'), T('Pflichten_Laden')], [T('Fehler')])]),
  );
  addLoad(s, { prefix: 'Pflichten', url: '/api/cms/sponsor/rewards', body: {}, listName: 'PflichtListe' });
  addFeature(s, 'fulfill', 'Erfüllung einer freigegebenen Belohnung melden', ['Pflichten_Laden', 'Erfuellung_Melden']);
  put(s);
}

// ── Eltern: Sponsoren des gewählten Kindes ───────────────────────────────────
{
  const s = shell('stage_parent_sponsors', 'Eltern · Sponsoren', 'Begleitungen von ${CMSKindName}', PARENT_SP_NAV, 'stage_parent_sponsors');
  s.objects.push(
    label('KarteCodes', '', 15, 7, 47, 8.6, { style: cardStyle }), label('SektionCodes', 'KONTAKTCODES (an den Sponsor weitergeben)', 16, 7.4, 45, 1.2, { style: sectionStyle }),
    edit('CodeLabel', 'Bezeichnung (z. B. Patentante)', 16, 8.8, 22),
    button('CodeErstellen', 'Code erstellen', 39, 8.8, 12, 2.6, 'Code_Erstellen', true),
    label('NeuerCode', '—', 16, 11.8, 30, 1.6, { style: { ...textStyle, color: '#ffe9a8', fontSize: 20 } }),
    label('CodeHinweis', 'Der Code wird nur einmal angezeigt — sicher weitergeben.', 16, 13.6, 45, 1.4, { style: hintStyle }),
    list('CodeListe', 'Ausgestellte Kontaktcodes'),
    table('CodeTabelle', 'CodeListe', [{ field: 'label', label: 'Code', type: 'header', x: 0, y: 0 }, { field: 'status', label: 'Status', type: 'badge', x: 20, y: 0 }, { field: 'expiresAt', label: 'Gültig bis', type: 'text', x: 30, y: 0 }], 15, 16.4, 47, 6, 'Code_Waehlen'),
    button('CodeWiderrufen', 'Widerrufen', 53, 22.6, 9, 2.6, 'Code_Widerrufen'),
    label('SektionBegleitungen', 'ANFRAGEN UND BEGLEITUNGEN', 15, 25.6, 47, 1.2, { style: sectionStyle }),
    list('BegleitungListe', 'Begleitungen des Kindes'),
    table('BegleitungTabelle', 'BegleitungListe', [
      { field: 'sponsorName', label: 'Sponsor', type: 'header', x: 0, y: 0 },
      { field: 'status', label: 'Status', type: 'badge', x: 20, y: 0 },
      { field: 'purpose', label: 'Zweck', type: 'text', x: 30, y: 0 },
    ], 15, 27, 47, 9, 'Begleitung_Waehlen'),
    button('AnfrageAnnehmen', 'Annehmen (alle Eltern nötig)', 15, 36.6, 20, 2.8, 'Anfrage_Annehmen', true),
    button('AnfrageAblehnen', 'Ablehnen', 36, 36.6, 12, 2.8, 'Anfrage_Ablehnen'),
    button('BegleitungOeffnen', 'Details öffnen', 49, 36.6, 13, 2.8, 'Begleitung_Oeffnen'),
    label('FreigabeHinweis', 'Mit Zustimmung: Punkte nach Fach Mathematik, alle Aktivitäten, letzte 90 Tage. Abweichende bereits vorgelegte Sicht wird unten angezeigt.', 15, 40, 47, 3, { style: hintStyle }),
    label('VorgelegteSicht', '', 15, 43, 47, 3, { style: hintStyle }),
    timer('ParentSponsoren_Init'),
  );
  s.actions.push(
    http('Act_Liste_Server', '/api/cms/parent/sponsorships', { childId: '${CMSKindId}' }),
    call('Act_Begleitungen_Uebernehmen', 'BegleitungListe', 'tryReplaceRecords', ['${Antwort.items}'], 'DatenGueltig'),
    call('Act_Codes_Uebernehmen', 'CodeListe', 'tryReplaceRecords', ['${Antwort.capabilities}'], 'DatenGueltig'),
    prop('Act_Liste_Fertig', { 'Status.text': '${Antwort.message}' }),
    http('Act_Code_Server', '/api/cms/parent/sponsor-contact-create', { childId: '${CMSKindId}', label: '${CodeLabel.text}' }),
    prop('Act_Code_Anzeigen', { 'NeuerCode.text': 'Neuer Code: ${Antwort.contactCode}', 'Status.text': '${Antwort.message}' }),
    prop('Act_Code_Merken', { CMSCapabilityId: '${CodeTabelle.selectedRecord.id}', 'Status.text': 'Kontaktcode gewählt.' }),
    http('Act_CodeWiderruf_Server', '/api/cms/parent/sponsor-contact-revoke', { capabilityId: '${CMSCapabilityId}' }),
    prop('Act_Begleitung_Merken', { CMSBegleitungId: '${BegleitungTabelle.selectedRecord.id}', 'Status.text': 'Begleitung gewählt: ${BegleitungTabelle.selectedRecord.sponsorName}', 'VorgelegteSicht.text': 'Vorgelegte Sicht: ${BegleitungTabelle.selectedRecord.requestScope.subjects} · ${BegleitungTabelle.selectedRecord.requestScope.activities} · ${BegleitungTabelle.selectedRecord.requestScope.detailLevel} · ${BegleitungTabelle.selectedRecord.requestScope.windowDays} Tage' }),
    nav('Act_Begleitung_Oeffnen', 'stage_parent_sponsor_detail'),
    http('Act_Annehmen_Server', '/api/cms/parent/sponsor-request-decision', { sponsorshipId: '${CMSBegleitungId}', approve: true }),
    http('Act_Ablehnen_Server', '/api/cms/parent/sponsor-request-decision', { sponsorshipId: '${CMSBegleitungId}', approve: false }),
    prop('Act_Entscheidung_Ok', { 'Status.text': '${Antwort.message}' }),
  );
  s.tasks.push(
    task('ParentSponsoren_Init', [T('Liste_Laden')]),
    task('Liste_Laden', [A('Act_Liste_Server'), C('Liste ok?', 'Antwort.ok', '==', true, [A('Act_Begleitungen_Uebernehmen'), A('Act_Codes_Uebernehmen'), A('Act_Liste_Fertig')], [T('Fehler')])]),
    task('Code_Erstellen', [A('Act_Code_Server'), C('Erstellt?', 'Antwort.ok', '==', true, [A('Act_Code_Anzeigen'), T('Liste_Laden')], [T('Fehler')])]),
    task('Code_Waehlen', [A('Act_Code_Merken')]),
    task('Code_Widerrufen', [A('Act_CodeWiderruf_Server'), C('Widerrufen?', 'Antwort.ok', '==', true, [A('Act_Entscheidung_Ok'), T('Liste_Laden')], [T('Fehler')])]),
    task('Begleitung_Waehlen', [A('Act_Begleitung_Merken')]),
    task('Begleitung_Oeffnen', [A('Act_Begleitung_Oeffnen')]),
    task('Anfrage_Annehmen', [A('Act_Annehmen_Server'), C('Entschieden?', 'Antwort.ok', '==', true, [A('Act_Entscheidung_Ok'), T('Liste_Laden')], [T('Fehler')])]),
    task('Anfrage_Ablehnen', [A('Act_Ablehnen_Server'), C('Entschieden?', 'Antwort.ok', '==', true, [A('Act_Entscheidung_Ok'), T('Liste_Laden')], [T('Fehler')])]),
  );
  addFeature(s, 'codes', 'Kontaktcode ausstellen und über Anfragen entscheiden', ['ParentSponsoren_Init', 'Code_Erstellen', 'Anfrage_Annehmen']);
  put(s);
}

// ── Eltern: Begleitungs-Detail ───────────────────────────────────────────────
{
  const s = shell('stage_parent_sponsor_detail', 'Eltern · Begleitung', 'Begleitung im Detail', PARENT_SP_NAV, 'stage_parent_sponsor_detail');
  s.grid.rows = 57;
  s.objects.push(
    label('KarteFortschritt', '', 15, 7, 22, 6.4, { style: cardStyle }), label('SektionFortschritt', 'SPONSOR SIEHT', 16, 7.4, 20, 1.2, { style: sectionStyle }),
    label('PunkteAnzeige', '—', 16, 8.8, 20, 1.8, { style: { ...textStyle, fontSize: 22 } }), label('SichtAnzeige', '—', 16, 10.8, 20, 2, { style: hintStyle }),
    label('KarteStatus', '', 39, 7, 23, 6.4, { style: cardStyle }), label('SektionStatus', 'ZUSTAND', 40, 7.4, 20, 1.2, { style: sectionStyle }),
    label('ZustandAnzeige', '—', 40, 8.8, 20, 1.6, { style: { ...textStyle, fontSize: 20 } }),
    button('Pausieren', 'Pausieren', 40, 10.6, 10, 2.6, 'Begleitung_Pausieren'), button('Beenden', 'Beenden', 51, 10.6, 11, 2.6, 'Begleitung_Beenden'),
    label('SektionSicht', 'SICHTFREIGABE-ÄNDERUNGEN', 15, 14.4, 47, 1.2, { style: sectionStyle }),
    list('SichtListe', 'Vorgeschlagene Sichtfreigaben'),
    table('SichtTabelle', 'SichtListe', [{ field: 'version', label: 'V', type: 'number', x: 0, y: 0 }, { field: 'scope.detailLevel', label: 'Detail', type: 'text', x: 4, y: 0 }, { field: 'scope.windowDays', label: 'Tage', type: 'number', x: 16, y: 0 }, { field: 'createdBy', label: 'Von', type: 'text', x: 24, y: 0 }], 15, 15.8, 32, 5, 'Sicht_Waehlen'),
    button('SichtZustimmen', 'Zustimmen', 49, 15.8, 13, 2.6, 'Sicht_Zustimmen', true), button('SichtAblehnen', 'Ablehnen', 49, 18.6, 13, 2.6, 'Sicht_Ablehnen'),
    label('SektionVertrag', 'VEREINBARUNG', 15, 21.8, 47, 1.2, { style: sectionStyle }),
    list('VertragListe', 'Vereinbarungsversionen'),
    table('VertragTabelle', 'VertragListe', [{ field: 'version', label: 'V', type: 'number', x: 0, y: 0 }, { field: 'status', label: 'Status', type: 'badge', x: 4, y: 0 }, { field: 'terms.pointsTarget', label: 'Ziel', type: 'number', x: 14, y: 0 }, { field: 'terms.rewardText', label: 'Belohnung', type: 'text', x: 20, y: 0 }], 15, 23.2, 47, 4.6, 'Vertrag_Waehlen'),
    edit('VertragZiel', 'Punkteziel', 15, 28.2, 10), edit('VertragBelohnung', 'Belohnung', 26, 28.2, 22),
    button('VertragVorschlagen', 'Vorschlagen', 49, 28.2, 13, 2.6, 'Vertrag_Vorschlagen'),
    button('VertragZustimmen', 'Zustimmen', 15, 31, 12, 2.6, 'Vertrag_Zustimmen', true), button('VertragAblehnen', 'Ablehnen', 28, 31, 12, 2.6, 'Vertrag_Ablehnen'),
    label('SektionBelohnung', 'BELOHNUNGEN', 15, 34.4, 47, 1.2, { style: sectionStyle }),
    list('AnspruchListe', 'Belohnungsansprüche'),
    table('AnspruchTabelle', 'AnspruchListe', [{ field: 'rewardText', label: 'Belohnung', type: 'header', x: 0, y: 0 }, { field: 'status', label: 'Status', type: 'badge', x: 24, y: 0 }], 15, 35.8, 47, 5, 'Anspruch_Waehlen'),
    button('EinloeseFreigeben', 'Einlösung freigeben', 15, 41.2, 15, 2.6, 'Einloese_Freigeben', true),
    button('EinloeseAblehnen', 'Zurückweisen', 31, 41.2, 14, 2.6, 'Einloese_Ablehnen'),
    button('ErfuellungBestaetigen', 'Erfüllung bestätigen', 46, 41.2, 16, 2.6, 'Erfuellung_Bestaetigen'),
    label('SektionHistorie', 'HISTORIE', 15, 44.4, 47, 1.2, { style: sectionStyle }),
    list('HistorieListe', 'Nachvollziehbare Ereignisse'),
    table('HistorieTabelle', 'HistorieListe', [{ field: 'at', label: 'Zeit', type: 'header', x: 0, y: 0 }, { field: 'type', label: 'Ereignis', type: 'text', x: 14, y: 0 }, { field: 'actor', label: 'Von', type: 'text', x: 34, y: 0 }], 15, 45.8, 47, 6),
    timer('ParentDetail_Init'),
  );
  s.actions.push(
    http('Act_Fortschritt_Server', '/api/cms/parent/sponsor-progress', { sponsorshipId: '${CMSBegleitungId}' }),
    prop('Act_Fortschritt_Anzeigen', { 'PunkteAnzeige.text': '${Antwort.totalPoints} sichtbare Punkte', 'SichtAnzeige.text': 'Belohnung: ${Antwort.agreement.countedPoints} / ${Antwort.agreement.pointsTarget} · ${Antwort.scope.detailLevel} · ${Antwort.scope.windowDays} Tage' }),
    http('Act_Liste_Server', '/api/cms/parent/sponsorships', { childId: '${CMSKindId}', sponsorshipId: '${CMSBegleitungId}' }),
    prop('Act_Zustand_Anzeigen', { 'ZustandAnzeige.text': 'Status: ${Antwort.items.0.status}' }),
    http('Act_Pause_Server', '/api/cms/parent/sponsor-pause', { sponsorshipId: '${CMSBegleitungId}' }),
    http('Act_Ende_Server', '/api/cms/parent/sponsor-end', { sponsorshipId: '${CMSBegleitungId}' }),
    http('Act_SichtZustimmung_Server', '/api/cms/parent/sponsor-access-consent', { sponsorshipId: '${CMSBegleitungId}', versionId: '${SichtTabelle.selectedRecord.id}', approve: true }),
    http('Act_SichtAblehnung_Server', '/api/cms/parent/sponsor-access-consent', { sponsorshipId: '${CMSBegleitungId}', versionId: '${SichtTabelle.selectedRecord.id}', approve: false }),
    http('Act_Vertraege_Server', '/api/cms/sponsorship/agreements', { sponsorshipId: '${CMSBegleitungId}' }),
    http('Act_VertragVorschlag_Server', '/api/cms/parent/sponsor-agreement-propose', { sponsorshipId: '${CMSBegleitungId}', baseVersion: '${VertragTabelle.selectedRecord.version}', pointsTarget: '${VertragZiel.text}', rewardText: '${VertragBelohnung.text}' }),
    http('Act_VertragZustimmung_Server', '/api/cms/parent/sponsor-agreement-consent', { agreementId: '${VertragTabelle.selectedRecord.agreementId}', version: '${VertragTabelle.selectedRecord.version}', approve: true }),
    http('Act_VertragAblehnung_Server', '/api/cms/parent/sponsor-agreement-consent', { agreementId: '${VertragTabelle.selectedRecord.agreementId}', version: '${VertragTabelle.selectedRecord.version}', approve: false }),
    http('Act_Ansprueche_Server', '/api/cms/parent/sponsor-rewards', { sponsorshipId: '${CMSBegleitungId}' }),
    http('Act_EinloeseOk_Server', '/api/cms/parent/sponsor-reward-decision', { claimKey: '${AnspruchTabelle.selectedRecord.entitlementKey}', approve: true }),
    http('Act_EinloeseNo_Server', '/api/cms/parent/sponsor-reward-decision', { claimKey: '${AnspruchTabelle.selectedRecord.entitlementKey}', approve: false }),
    http('Act_ErfuellungOk_Server', '/api/cms/parent/sponsor-fulfillment-confirm', { claimKey: '${AnspruchTabelle.selectedRecord.entitlementKey}' }),
    http('Act_Historie_Server', '/api/cms/parent/sponsor-history', { sponsorshipId: '${CMSBegleitungId}' }),
    call('Act_Sicht_Uebernehmen', 'SichtListe', 'tryReplaceRecords', ['${Antwort.items.0.pendingAccess}'], 'DatenGueltig'),
    call('Act_Vertraege_Uebernehmen', 'VertragListe', 'tryReplaceRecords', ['${Antwort.items.0.versions}'], 'DatenGueltig'),
    call('Act_Ansprueche_Uebernehmen', 'AnspruchListe', 'tryReplaceRecords', ['${Antwort.items}'], 'DatenGueltig'),
    call('Act_Historie_Uebernehmen', 'HistorieListe', 'tryReplaceRecords', ['${Antwort.items}'], 'DatenGueltig'),
    prop('Act_Meldung', { 'Status.text': '${Antwort.message}' }),
  );
  const reload = [T('Fortschritt_Laden'), T('Vertraege_Laden'), T('Ansprueche_Laden'), T('Historie_Laden'), T('Liste_Laden')];
  s.tasks.push(
    task('ParentDetail_Init', [T('Fortschritt_Laden'), T('Vertraege_Laden'), T('Ansprueche_Laden'), T('Historie_Laden'), T('Liste_Laden')]),
    task('Fortschritt_Laden', [A('Act_Fortschritt_Server'), C('Fortschritt ok?', 'Antwort.ok', '==', true, [A('Act_Fortschritt_Anzeigen')], [T('Fehler')])]),
    task('Liste_Laden', [A('Act_Liste_Server'), C('Liste ok?', 'Antwort.ok', '==', true, [A('Act_Zustand_Anzeigen'), A('Act_Sicht_Uebernehmen')], [T('Fehler')])]),
    task('Vertraege_Laden', [A('Act_Vertraege_Server'), C('Verträge ok?', 'Antwort.ok', '==', true, [A('Act_Vertraege_Uebernehmen')], [T('Fehler')])]),
    task('Ansprueche_Laden', [A('Act_Ansprueche_Server'), C('Ansprüche ok?', 'Antwort.ok', '==', true, [A('Act_Ansprueche_Uebernehmen')], [T('Fehler')])]),
    task('Historie_Laden', [A('Act_Historie_Server'), C('Historie ok?', 'Antwort.ok', '==', true, [A('Act_Historie_Uebernehmen')], [T('Fehler')])]),
    task('Begleitung_Pausieren', [A('Act_Pause_Server'), C('Pausiert?', 'Antwort.ok', '==', true, [A('Act_Meldung'), ...reload], [T('Fehler')])]),
    task('Begleitung_Beenden', [A('Act_Ende_Server'), C('Beendet?', 'Antwort.ok', '==', true, [A('Act_Meldung'), ...reload], [T('Fehler')])]),
    task('Sicht_Zustimmen', [A('Act_SichtZustimmung_Server'), C('Zugestimmt?', 'Antwort.ok', '==', true, [A('Act_Meldung'), T('Liste_Laden')], [T('Fehler')])]),
    task('Sicht_Ablehnen', [A('Act_SichtAblehnung_Server'), C('Abgelehnt?', 'Antwort.ok', '==', true, [A('Act_Meldung'), T('Liste_Laden')], [T('Fehler')])]),
    task('Vertrag_Vorschlagen', [A('Act_VertragVorschlag_Server'), C('Vorgeschlagen?', 'Antwort.ok', '==', true, [A('Act_Meldung'), T('Vertraege_Laden')], [T('Fehler')])]),
    task('Vertrag_Zustimmen', [A('Act_VertragZustimmung_Server'), C('Zugestimmt?', 'Antwort.ok', '==', true, [A('Act_Meldung'), T('Vertraege_Laden')], [T('Fehler')])]),
    task('Vertrag_Ablehnen', [A('Act_VertragAblehnung_Server'), C('Abgelehnt?', 'Antwort.ok', '==', true, [A('Act_Meldung'), T('Vertraege_Laden')], [T('Fehler')])]),
    task('Einloese_Freigeben', [A('Act_EinloeseOk_Server'), C('Freigegeben?', 'Antwort.ok', '==', true, [A('Act_Meldung'), T('Ansprueche_Laden')], [T('Fehler')])]),
    task('Einloese_Ablehnen', [A('Act_EinloeseNo_Server'), C('Zurückgewiesen?', 'Antwort.ok', '==', true, [A('Act_Meldung'), T('Ansprueche_Laden')], [T('Fehler')])]),
    task('Erfuellung_Bestaetigen', [A('Act_ErfuellungOk_Server'), C('Bestätigt?', 'Antwort.ok', '==', true, [A('Act_Meldung'), T('Ansprueche_Laden')], [T('Fehler')])]),
    task('Vertrag_Waehlen', []), task('Anspruch_Waehlen', []), task('Sicht_Waehlen', []),
  );
  addFeature(s, 'manage', 'Begleitung steuern, Vereinbarung und Belohnungen freigeben', ['ParentDetail_Init']);
  for (const object of s.objects) if (object.y >= 14.4) object.y += 3;
  s.objects.push(button('Fortsetzen', 'Begleitung fortsetzen', 40, 13.6, 22, 2.6, 'Begleitung_Fortsetzen'));
  s.actions.push(http('Act_Resume_Server', '/api/cms/parent/sponsor-resume', { sponsorshipId: '${CMSBegleitungId}' }));
  s.tasks.push(task('Begleitung_Fortsetzen', [A('Act_Resume_Server'), C('Fortgesetzt?', 'Antwort.ok', '==', true, [A('Act_Meldung'), ...reload], [T('Fehler')])]));
  put(s);
}

// ── Kind: Meine Begleiter ────────────────────────────────────────────────────
{
  const s = shell('stage_child_sponsors', 'Kind · Begleiter', 'Meine Begleiter', CHILD_NAV, 'stage_child_sponsors');
  s.objects.push(
    label('Hinweis', 'Hier siehst du, wer dich begleitet und welche Belohnungen vereinbart sind. Du darfst ablehnen und pausieren — deine Eltern sehen alles.', 15, 7, 47, 3, { style: hintStyle }),
    list('BegleitungListe', 'Begleiter'),
    table('BegleitungTabelle', 'BegleitungListe', [
      { field: 'sponsorName', label: 'Begleiter', type: 'header', x: 0, y: 0 },
      { field: 'status', label: 'Status', type: 'badge', x: 20, y: 0 },
    ], 15, 10.6, 47, 8, 'Begleitung_Waehlen'),
    button('Ablehnen', 'Ablehnen', 15, 19.2, 12, 2.8, 'Begleitung_Ablehnen'),
    button('Pausieren', 'Pausieren', 28, 19.2, 12, 2.8, 'Begleitung_Pausieren'),
    button('Fortsetzen', 'Weitermachen', 41, 19.2, 13, 2.8, 'Begleitung_Fortsetzen', true),
    label('SektionBelohnung', 'BELOHNUNGEN', 15, 23.6, 47, 1.2, { style: sectionStyle }),
    list('AnspruchListe', 'Erreichte Belohnungen'),
    table('AnspruchTabelle', 'AnspruchListe', [{ field: 'rewardText', label: 'Belohnung', type: 'header', x: 0, y: 0 }, { field: 'status', label: 'Status', type: 'badge', x: 30, y: 0 }], 15, 25, 47, 7, 'Anspruch_Waehlen'),
    button('Einloesen', 'Belohnung einlösen', 15, 32.6, 16, 2.8, 'Belohnung_Einloesen', true),
    label('SichtHinweis', '—', 15, 36, 47, 2, { style: hintStyle }),
    timer('KindSponsoren_Init'),
  );
  s.actions.push(
    http('Act_Liste_Server', '/api/cms/child/sponsorship/list', { token: '${Token}' }),
    call('Act_Begleitungen_Uebernehmen', 'BegleitungListe', 'tryReplaceRecords', ['${Antwort.items}'], 'DatenGueltig'),
    prop('Act_Begleitung_Merken', { CMSBegleitungId: '${BegleitungTabelle.selectedRecord.id}', 'Status.text': 'Begleiter gewählt.' }),
    http('Act_Vorschau_Server', '/api/cms/child/sponsorship/access-preview', { token: '${Token}', sponsorshipId: '${CMSBegleitungId}' }),
    prop('Act_Vorschau_Anzeigen', { 'SichtHinweis.text': 'Der Begleiter sieht: ${Antwort.scope.detailLevel} über ${Antwort.scope.windowDays} Tage — keine einzelnen Antworten oder Fehler.' }),
    http('Act_Ablehnen_Server', '/api/cms/child/sponsorship/decline', { token: '${Token}', sponsorshipId: '${CMSBegleitungId}', accept: false }),
    http('Act_Pause_Server', '/api/cms/child/sponsorship/pause', { token: '${Token}', sponsorshipId: '${CMSBegleitungId}' }),
    http('Act_Fortsetzen_Server', '/api/cms/child/sponsorship/resume', { token: '${Token}', sponsorshipId: '${CMSBegleitungId}', accept: true }),
    http('Act_Ansprueche_Server', '/api/cms/child/sponsorship/rewards', { token: '${Token}', sponsorshipId: '${CMSBegleitungId}' }),
    call('Act_Ansprueche_Uebernehmen', 'AnspruchListe', 'tryReplaceRecords', ['${Antwort.items}'], 'DatenGueltig'),
    http('Act_Einloesen_Server', '/api/cms/child/sponsorship/reward-request', { token: '${Token}', claimKey: '${AnspruchTabelle.selectedRecord.entitlementKey}' }),
    prop('Act_Meldung', { 'Status.text': '${Antwort.message}' }),
  );
  s.tasks.push(
    task('KindSponsoren_Init', [T('Liste_Laden'), T('Vorschau_Laden')]),
    task('Liste_Laden', [A('Act_Liste_Server'), C('Liste ok?', 'Antwort.ok', '==', true, [A('Act_Begleitungen_Uebernehmen')], [T('Fehler')])]),
    task('Begleitung_Waehlen', [A('Act_Begleitung_Merken'), T('Vorschau_Laden'), T('Ansprueche_Laden')]),
    task('Vorschau_Laden', [A('Act_Vorschau_Server'), C('Vorschau ok?', 'Antwort.ok', '==', true, [A('Act_Vorschau_Anzeigen')], [])]),
    task('Ansprueche_Laden', [A('Act_Ansprueche_Server'), C('Ansprüche ok?', 'Antwort.ok', '==', true, [A('Act_Ansprueche_Uebernehmen')], [T('Fehler')])]),
    task('Begleitung_Ablehnen', [A('Act_Ablehnen_Server'), C('Abgelehnt?', 'Antwort.ok', '==', true, [A('Act_Meldung'), T('Liste_Laden')], [T('Fehler')])]),
    task('Begleitung_Pausieren', [A('Act_Pause_Server'), C('Pausiert?', 'Antwort.ok', '==', true, [A('Act_Meldung'), T('Liste_Laden')], [T('Fehler')])]),
    task('Begleitung_Fortsetzen', [A('Act_Fortsetzen_Server'), C('Fortgesetzt?', 'Antwort.ok', '==', true, [A('Act_Meldung'), T('Liste_Laden')], [T('Fehler')])]),
    task('Belohnung_Einloesen', [A('Act_Einloesen_Server'), C('Angemeldet?', 'Antwort.ok', '==', true, [A('Act_Meldung'), T('Ansprueche_Laden')], [T('Fehler')])]),
    task('Anspruch_Waehlen', []),
  );
  addFeature(s, 'child', 'Begleiter sehen, ablehnen, pausieren und Belohnung einlösen', ['KindSponsoren_Init']);
  put(s);
}

// Familienkommunikation: dieselben Inhalte für Eltern und Kind; kein
// privater Kanal. Lange Texte werden zusätzlich nach Auswahl angezeigt.
for (const [id, title, navItems, prefix, withToken] of [
  ['stage_parent_sponsor_messages', 'Mitteilungen zur Begleitung', PARENT_SP_NAV, '/api/cms/parent/sponsor-', false],
  ['stage_child_sponsor_messages', 'Mitteilungen mit deinen Begleitern', CHILD_NAV, '/api/cms/child/sponsorship/', true],
]) {
  const s = shell(id, title, title, navItems, id);
  const auth = withToken ? { token: '${Token}' } : {};
  s.objects.push(
    label('Hinweis', 'Alle Mitteilungen sind für das Kind und seine Eltern sichtbar. Wähle zuerst eine Begleitung in der Übersicht.', 15, 7, 47, 3, { style: hintStyle }),
    list('NachrichtListe', 'Vollständige Familienmitteilungen'),
    table('NachrichtTabelle', 'NachrichtListe', [{ field: 'author', label: 'Von', type: 'header', x: 0, y: 0 }, { field: 'text', label: 'Mitteilung', type: 'text', x: 10, y: 0 }, { field: 'at', label: 'Zeit', type: 'text', x: 36, y: 0 }], 15, 11, 47, 12, 'Nachricht_Waehlen'),
    obj('TMemo', 'NachrichtInhalt', 15, 24, 47, 7, { text: '', readOnly: true, style: inputStyle }),
    edit('NachrichtText', 'Mitteilung an die Familie', 15, 33, 34),
    button('NachrichtSenden', 'Senden', 50, 33, 12, 2.8, 'Nachricht_Senden', true),
    button('Aktualisieren', 'Aktualisieren', 15, 38, 14, 2.8, 'Nachrichten_Laden'), timer('Mitteilungen_Init'),
  );
  s.actions.push(
    http('Act_Nachrichten_Server', prefix + 'messages', { ...auth, sponsorshipId: '${CMSBegleitungId}' }),
    call('Act_Nachrichten_Uebernehmen', 'NachrichtListe', 'tryReplaceRecords', ['${Antwort.items}'], 'DatenGueltig'),
    prop('Act_Nachricht_Anzeigen', { 'NachrichtInhalt.text': '${NachrichtTabelle.selectedRecord.author} · ${NachrichtTabelle.selectedRecord.at}\n${NachrichtTabelle.selectedRecord.text}' }),
    http('Act_NachrichtSenden_Server', prefix + 'message-send', { ...auth, sponsorshipId: '${CMSBegleitungId}', text: '${NachrichtText.text}' }),
    prop('Act_Nachricht_Ok', { 'NachrichtText.text': '', 'Status.text': '${Antwort.message}' }),
  );
  s.tasks.push(
    task('Mitteilungen_Init', [T('Nachrichten_Laden')]),
    task('Nachrichten_Laden', [A('Act_Nachrichten_Server'), C('Mitteilungen ok?', 'Antwort.ok', '==', true, [A('Act_Nachrichten_Uebernehmen')], [T('Fehler')])]),
    task('Nachricht_Waehlen', [A('Act_Nachricht_Anzeigen')]),
    task('Nachricht_Senden', [A('Act_NachrichtSenden_Server'), C('Gesendet?', 'Antwort.ok', '==', true, [A('Act_Nachricht_Ok'), T('Nachrichten_Laden')], [T('Fehler')])]),
  );
  put(s);
}

// Eltern können den konkreten Umfang bearbeiten. Einschränkungen wirken
// sofort, Erweiterungen benötigen die Zustimmung aller Eltern.
{
  const s = shell('stage_parent_sponsor_access', 'Eltern · Sichtfreigabe', 'Sichtfreigabe bearbeiten', PARENT_SP_NAV, 'stage_parent_sponsor_access');
  s.objects.push(
    label('Hinweis', 'Fächer leer: keine Leistungsdaten. Aktivitäten leer: alle Aktivitäten der gewählten Fächer. Erweiterungen brauchen alle Eltern.', 15, 7, 47, 4, { style: hintStyle }),
    label('AktuelleSicht', '—', 15, 12, 47, 3),
    edit('Faecher', 'Fächer, z. B. math,reading', 15, 17, 47),
    edit('Aktivitaeten', 'Aktivitäten, z. B. tasks,round (leer = alle)', 15, 21, 47),
    obj('TDropdown', 'Detailgrad', 15, 25, 22, 3, { options: ['points', 'aggregates', 'summary'], selectedIndex: 0, selectedValue: 'points', style: inputStyle }),
    obj('TNumberInput', 'Zeitraum', 40, 25, 22, 3, { value: 90, min: 1, max: 3650, style: inputStyle }),
    button('SichtSpeichern', 'Änderung vorschlagen', 15, 30, 22, 3, 'Sicht_Vorschlagen', true),
    label('Info', 'points: Punkte pro Leistungsart. aggregates/summary: zusätzlich Anzahl der Einträge. Keine Antworten oder Fehler.', 15, 35, 47, 4, { style: hintStyle }), timer('Sicht_Init'),
  );
  s.actions.push(
    http('Act_Sicht_Server', '/api/cms/parent/sponsor-progress', { sponsorshipId: '${CMSBegleitungId}' }),
    prop('Act_Sicht_Anzeigen', { 'AktuelleSicht.text': 'Freigegeben: ${Antwort.scope.subjects} · Aktivitäten: ${Antwort.scope.activities} · ${Antwort.scope.detailLevel} · ${Antwort.scope.windowDays} Tage' }),
    http('Act_SichtVorschlag_Server', '/api/cms/parent/sponsor-access-propose', { sponsorshipId: '${CMSBegleitungId}', subjectsCsv: '${Faecher.text}', activitiesCsv: '${Aktivitaeten.text}', detailLevel: '${Detailgrad.selectedValue}', windowDays: '${Zeitraum.value}' }),
    prop('Act_Sicht_Meldung', { 'Status.text': '${Antwort.message}' }),
  );
  s.tasks.push(task('Sicht_Init', [T('Sicht_Laden')]), task('Sicht_Laden', [A('Act_Sicht_Server'), C('Sicht ok?', 'Antwort.ok', '==', true, [A('Act_Sicht_Anzeigen')], [T('Fehler')])]), task('Sicht_Vorschlagen', [A('Act_SichtVorschlag_Server'), C('Vorgeschlagen?', 'Antwort.ok', '==', true, [A('Act_Sicht_Meldung'), T('Sicht_Laden')], [T('Fehler')])]));
  put(s);
}

// Nicht nachweisbare Spielermeldungen sind für Eltern prüfbar. Anerkennung
// referenziert das konkrete Quellereignis und ist dadurch wiederholbar sicher.
{
  const s = shell('stage_parent_sponsor_performance', 'Eltern · Leistungen', 'Leistungen prüfen und anerkennen', PARENT_SP_NAV, 'stage_parent_sponsor_performance');
  s.objects.push(
    label('Hinweis', 'Gemeldete Leistungen zählen erst nach Ihrer Prüfung für Belohnungen. Wählen Sie einen Eintrag und prüfen Sie Art und Wert.', 15, 7, 47, 3, { style: hintStyle }),
    list('LeistungListe', 'Gemeldete und anerkannte Leistungen'),
    table('LeistungTabelle', 'LeistungListe', [{ field: 'metricKey', label: 'Art', type: 'header', x: 0, y: 0 }, { field: 'value', label: 'Wert', type: 'number', x: 12, y: 0 }, { field: 'verification', label: 'Prüfung', type: 'badge', x: 21, y: 0 }, { field: 'occurredAt', label: 'Zeit', type: 'text', x: 32, y: 0 }], 15, 11, 47, 18),
    edit('Notiz', 'Notiz zur Anerkennung', 15, 31, 47),
    button('Anerkennen', 'Leistung anerkennen', 15, 36, 22, 3, 'Leistung_Anerkennen', true),
    button('Aktualisieren', 'Aktualisieren', 40, 36, 22, 3, 'Leistungen_Laden'), timer('Leistungen_Init'),
  );
  s.actions.push(
    http('Act_Leistungen_Server', '/api/cms/parent/sponsor-performance-ledger', { childId: '${CMSKindId}' }),
    call('Act_Leistungen_Uebernehmen', 'LeistungListe', 'tryReplaceRecords', ['${Antwort.items}'], 'DatenGueltig'),
    http('Act_Anerkennen_Server', '/api/cms/parent/sponsor-performance-recognize', { childId: '${CMSKindId}', metricKey: '${LeistungTabelle.selectedRecord.metricKey}', value: '${LeistungTabelle.selectedRecord.value}', unit: '${LeistungTabelle.selectedRecord.unit}', progressEventId: '${LeistungTabelle.selectedRecord.sourceEventId}', note: '${Notiz.text}' }),
    prop('Act_Anerkennen_Meldung', { 'Status.text': '${Antwort.message}' }),
  );
  s.tasks.push(task('Leistungen_Init', [T('Leistungen_Laden')]), task('Leistungen_Laden', [A('Act_Leistungen_Server'), C('Leistungen ok?', 'Antwort.ok', '==', true, [A('Act_Leistungen_Uebernehmen')], [T('Fehler')])]), task('Leistung_Anerkennen', [A('Act_Anerkennen_Server'), C('Anerkannt?', 'Antwort.ok', '==', true, [A('Act_Anerkennen_Meldung'), T('Leistungen_Laden')], [T('Fehler')])]));
  put(s);
}

{
  const s = shell('stage_child_sponsor_agreement', 'Kind · Vereinbarung', 'Deine Belohnungsvereinbarung', CHILD_NAV, 'stage_child_sponsor_agreement');
  s.objects.push(
    label('Hinweis', 'Du kannst ein anderes Ziel oder eine andere Belohnung vorschlagen. Erst wenn deine Eltern und der Sponsor zustimmen, gilt die Änderung.', 15, 7, 47, 4, { style: hintStyle }),
    list('VertragListe', 'Vereinbarungsversionen'),
    table('VertragTabelle', 'VertragListe', [{ field: 'version', label: 'Version', type: 'number', x: 0, y: 0 }, { field: 'status', label: 'Status', type: 'badge', x: 7, y: 0 }, { field: 'terms.pointsTarget', label: 'Ziel', type: 'number', x: 17, y: 0 }, { field: 'terms.rewardText', label: 'Belohnung', type: 'text', x: 24, y: 0 }], 15, 12, 47, 12, 'Vertrag_Waehlen'),
    edit('VertragZiel', 'Dein Punkteziel', 15, 27, 18), edit('VertragBelohnung', 'Dein Belohnungsvorschlag', 35, 27, 27),
    button('Vorschlagen', 'Änderung vorschlagen', 15, 33, 22, 3, 'Vertrag_Vorschlagen', true), timer('Vertrag_Init'),
  );
  s.actions.push(
    http('Act_Vertraege_Server', '/api/cms/sponsorship/agreements', { token: '${Token}', sponsorshipId: '${CMSBegleitungId}' }),
    call('Act_Vertraege_Uebernehmen', 'VertragListe', 'tryReplaceRecords', ['${Antwort.items.0.versions}'], 'DatenGueltig'),
    http('Act_Vorschlag_Server', '/api/cms/child/sponsorship/agreement-propose', { token: '${Token}', sponsorshipId: '${CMSBegleitungId}', baseVersion: '${VertragTabelle.selectedRecord.version}', pointsTarget: '${VertragZiel.text}', rewardText: '${VertragBelohnung.text}' }),
    prop('Act_Vorschlag_Meldung', { 'Status.text': '${Antwort.message}' }),
  );
  s.tasks.push(task('Vertrag_Init', [T('Vertraege_Laden')]), task('Vertraege_Laden', [A('Act_Vertraege_Server'), C('Verträge ok?', 'Antwort.ok', '==', true, [A('Act_Vertraege_Uebernehmen')], [T('Fehler')])]), task('Vertrag_Waehlen', []), task('Vertrag_Vorschlagen', [A('Act_Vorschlag_Server'), C('Vorgeschlagen?', 'Antwort.ok', '==', true, [A('Act_Vorschlag_Meldung'), T('Vertraege_Laden')], [T('Fehler')])]));
  put(s);
}

// ── Navigation verdrahten (nur neue, namensgebende Objekte) ──────────────────
function addNavButton(stageId, btnName, text, targetStage, y) {
  const st = stageOf(stageId);
  if (!st) { console.log('Stage fehlt: ' + stageId); return; }
  st.objects = mergeByName(st.objects, [button(btnName, text, 1, y, 12, 2.7, 'Sponsor_' + btnName)]);
  st.actions = mergeByName(st.actions, [nav('Act_Sponsor_' + btnName, targetStage)]);
  st.tasks = mergeByName(st.tasks, [task('Sponsor_' + btnName, [A('Act_Sponsor_' + btnName)])]);
}
addNavButton('stage_parent', 'NavSponsoren', 'Sponsoren', 'stage_parent_sponsors', 37);
addNavButton('stage_gallery', 'NavBegleiter', 'Meine Begleiter', 'stage_child_sponsors', 37);

// Globale Kontextvariable für die gewählte Begleitung (wie CMSKindId).
const bp = stageOf('stage_blueprint');
if (bp) {
  bp.variables = mergeByName(bp.variables, [
    variable('CMSBegleitungId', 'string', ''),
    variable('CMSCapabilityId', 'string', ''),
    variable('CMSAnspruchKey', 'string', ''),
  ]);
}

fs.writeFileSync(file, JSON.stringify(project, null, 1));
console.log('Sponsor-Stages erzeugt: ' + project.stages.filter(s => s.generatedBy === GENERATED).map(s => s.id).join(', '));

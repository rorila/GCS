// Baut game-server/public/projects/Karteikasten-Quiz.json — eigenständig
// spielbares Muster-Spiel, das den persönlichen Karteikasten „andockt".
// Es zeigt die Konvention für alle kartenbasierten Spiele:
//   KartenFach/KartenThema = die „Art der Karten" (dynamische Fächer)
//   THttpRequest → /api/cms/play {action:'cardNext'}  → nächste Karte
//   THttpRequest → /api/cms/play {action:'cardAnswer'} → Leitner-Buchung
// Die Ziehregel selbst liegt deklarativ in stage_server_play des CMS-Projekts.
// Idempotent. Aufruf: node scripts/cms/cms-add-quiz-demo.cjs
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const FILE = path.join(__dirname, '../../game-server/public/projects/Karteikasten-Quiz.json');

const uid = p => p + '-' + crypto.randomUUID();
const label = (name, text, x, y, w, h, fontSize = 22, extra = {}) => ({ className: 'TLabel', id: uid('q_lbl'), name, scope: 'stage', draggable: false, droppable: false, dragMode: 'move', text, visible: true, x, y, width: w, height: h, zIndex: 0, rotation: 0, align: 'NONE', collisionEnabled: false, style: { color: '#edf7f4', fontSize, textAlign: 'center', backgroundColor: 'transparent', borderColor: 'transparent', borderWidth: 0 }, ...extra });
const button = (name, text, x, y, w, h, onClick, extra = {}) => ({ className: 'TButton', id: uid('q_btn'), name, scope: 'stage', draggable: false, droppable: false, dragMode: 'move', text, icon: '', visible: true, x, y, width: w, height: h, zIndex: 0, rotation: 0, align: 'NONE', collisionEnabled: false, style: {}, events: { onClick }, ...extra });
const edit = (name, x, y, w, h, extra = {}) => ({ className: 'TEdit', id: uid('q_edit'), name, scope: 'stage', draggable: false, droppable: false, dragMode: 'move', text: '', visible: true, x, y, width: w, height: h, zIndex: 0, rotation: 0, align: 'NONE', collisionEnabled: false, style: {}, ...extra });
const variable = (cls, name, def, extra = {}) => ({ className: cls, id: uid('q_var'), name, scope: 'stage', isVariable: true, isHiddenInRun: true, draggable: false, droppable: false, dragMode: 'move', description: '', visible: true, x: 0, y: 0, width: 6, height: 2, zIndex: 0, rotation: 0, align: 'NONE', collisionEnabled: false, style: {}, type: cls.replace(/^T|Variable$/g, '').toLowerCase(), defaultValue: def, value: def, objectModel: '', ...extra });
const strVar = (n, d = '') => variable('TStringVariable', n, d);
const intVar = (n, d = 0) => variable('TIntegerVariable', n, d);
const boolVar = n => variable('TBooleanVariable', n, false);
const objVar = n => variable('TObjectVariable', n, null);
const timer = (name, onTimer, interval = 400) => ({ className: 'TTimer', id: uid('q_timer'), name, scope: 'stage', isService: true, isHiddenInRun: true, draggable: false, droppable: false, dragMode: 'move', visible: true, x: 1, y: 1, width: 4, height: 2, zIndex: 0, rotation: 0, align: 'NONE', collisionEnabled: false, style: {}, interval, enabled: true, maxInterval: 1, currentInterval: 0, events: { onTimer } });

const actions = [];
const prop = (name, changes) => (actions.push({ id: uid('q_act'), name, type: 'property', changes, scope: 'stage' }), { type: 'action', name });
const http = (name, body, resultVariable) => (actions.push({ id: uid('q_act'), name, type: 'http', url: '/api/cms/play', method: 'POST', body, resultVariable, scope: 'stage', queryOperator: '==' }), { type: 'action', name });
const calc = (name, formula, resultVariable) => (actions.push({ id: uid('q_act'), name, type: 'calculate', formula, resultVariable, scope: 'stage' }), { type: 'action', name });
const varset = (name, source, sourceProperty, variableName) => (actions.push({ id: uid('q_act'), name, type: 'variable', source, sourceProperty, variableName, scope: 'stage' }), { type: 'action', name });
const call = (name, target, method, params, resultVariable) => (actions.push({ id: uid('q_act'), name, type: 'call_method', target, method, params: params || [], ...(resultVariable ? { resultVariable } : {}), scope: 'stage' }), { type: 'action', name });
const task = (name, actionSequence, description) => ({ id: uid('q_task'), name, description: description || name, actionSequence, triggerMode: 'local-sync', params: [], scope: 'stage' });
const cond = (name, variable, operator, value, body, elseBody) => ({ type: 'condition', name, condition: { variable, operator, value }, body, elseBody });

const stage = {
  id: 'stage_quiz', type: 'standard', name: 'Karteikasten-Quiz',
  grid: { cols: 64, rows: 40, cellSize: 18, visible: false, snapToGrid: true, backgroundColor: '#122b39' },
  objects: [
    label('Titel', 'KARTEIKASTEN-QUIZ', 4, 2, 56, 3, 30),
    label('FachLabel', '', 4, 5, 56, 2, 16),
    label('ZaehlerLabel', 'Richtig: 0 · Falsch: 0', 4, 7, 56, 2, 14),
    label('FrageLabel', '', 8, 11, 48, 6, 24),
    label('LoesungLabel', '', 8, 17, 48, 4, 18),
    edit('AntwortEdit', 12, 22, 24, 3, { placeholder: 'Deine Antwort …', visible: false }),
    button('AntwortZeigen', '👁 Antwort zeigen', 40, 22, 16, 3, 'Antwort_Zeigen', { visible: false }),
    button('Pruefen', '✔ Prüfen', 12, 26, 12, 3, 'Antwort_Pruefen', { visible: false }),
    button('Richtig', '👍 Richtig', 26, 26, 12, 3, 'Selbst_Richtig', { visible: false }),
    button('FalschSelbst', '👎 Falsch', 40, 26, 12, 3, 'Selbst_Falsch', { visible: false }),
    button('Naechste', '➡ Nächste Karte', 26, 31, 16, 3, 'Karte_Ziehen', { visible: false }),
    button('Beenden', '🏁 Beenden', 8, 36, 14, 3, 'Quiz_Beenden'),
    label('StatusLabel', '', 8, 33, 48, 3, 18),
    timer('QuizInit', 'Quiz_Start'),
  ],
  variables: [
    strVar('CMS_LAUNCH', '', { description: 'Wird vom Server beim /play-Render mit dem Launch-Schlüssel befüllt.' }),
    strVar('KartenFach', 'Mathe', { description: '„Art der Karten" — hier andocken: Schulfach frei wählbar, leer = alle Fächer.' }),
    strVar('KartenThema', '', { description: 'Optionales Thema innerhalb des Fachs, leer = alle.' }),
    strVar('GezogeneIds', '', { description: 'Temporäre Runden-Liste: schon gezogene Karten werden nicht erneut gezogen.' }),
    objVar('AktuelleKarte'), objVar('KartenAntwort'), objVar('BewertungAntwort'), objVar('EndeAntwort'),
    intVar('Richtig'), intVar('Falsch'), intVar('Busy'),
    strVar('AktuelleAntwort'),
  ],
  tasks: [
    // --- Start: erste Karte ordern ---
    task('Quiz_Start', [{ type: 'task', name: 'Karte_Ziehen' }], 'Erstladung: erste Karte aus dem Karteikasten ordern'),

    // --- Kernschleife: nächste Karte ---
    task('Karte_Ziehen', [
      cond('Runde läuft?', 'Busy', '==', 0, [
        prop('Act_Ziehen_Start', { Busy: 1, 'StatusLabel.text': 'Karte wird geladen …', 'LoesungLabel.text': '', 'Naechste.visible': false, 'Pruefen.visible': false, 'Richtig.visible': false, 'FalschSelbst.visible': false, 'AntwortZeigen.visible': false, 'AntwortEdit.visible': false, 'AntwortEdit.text': '' }),
        http('Act_Karte_Server', '{"launchKey":"${CMS_LAUNCH}","action":"cardNext","subject":"${KartenFach}","topic":"${KartenThema}","formats":["text","self"],"excludeIds":"${GezogeneIds}"}', 'KartenAntwort'),
        cond('Server antwortet?', 'KartenAntwort.ok', '!=', true, [
          prop('Act_ZiehFehler', { Busy: 0, 'FrageLabel.text': '⚠️ Verbindungsproblem', 'StatusLabel.text': '${KartenAntwort.message}', 'FachLabel.text': '' }),
        ], [
          cond('Karte gefunden?', 'KartenAntwort.card', 'truthy', true, [
            varset('Act_Karte_Objekt', 'KartenAntwort', 'card', 'AktuelleKarte'),
            prop('Act_Karte_Uebernehmen', { 'FrageLabel.text': '${KartenAntwort.card.question}', 'FachLabel.text': '${KartenAntwort.card.subject} · ${KartenAntwort.card.topic} · Fach ${KartenAntwort.card.box}', Busy: 0 }),
            cond('Eingabe-Format?', 'KartenAntwort.card.answerFormat', '==', 'text', [
              prop('Act_TextBereit', { 'AntwortEdit.visible': true, 'Pruefen.visible': true, 'AntwortEdit.text': '' }),
            ], [
              prop('Act_SelfBereit', { 'AntwortZeigen.visible': true }),
            ]),
          ], [
            prop('Act_QuizEnde', { Busy: 0, 'FrageLabel.text': '🎉 Fertig!', 'StatusLabel.text': 'Keine passenden Karten mehr — Richtig: ${Richtig} · Falsch: ${Falsch}', 'FachLabel.text': '' }),
          ]),
        ]),
      ]),
    ], 'Server ordert die nächste Karte: Fach aufsteigend, je Fach älteste zuerst'),

    // --- text-Format: Eingabe gegen akzeptierte Antworten ---
    task('Antwort_Pruefen', [
      cond('Antwort akzeptiert?', 'AntwortEdit.text', 'in', '${AktuelleKarte.answers}', [
        { type: 'task', name: 'Bewerten_Richtig' },
      ], [
        { type: 'task', name: 'Bewerten_Falsch' },
      ]),
    ], 'Texteingabe gegen answers-Array prüfen (case-sensitiv; Varianten einzeln hinterlegen)'),

    // --- self-Format: Kind bewertet selbst ---
    task('Antwort_Zeigen', [
      prop('Act_Loesung_Anzeigen', { 'LoesungLabel.text': '${AktuelleKarte.answers}', 'Richtig.visible': true, 'FalschSelbst.visible': true, 'AntwortZeigen.visible': false }),
    ], 'Selbstbewertung: Lösung aufdecken, Richtig/Falsch-Buttons'),
    task('Selbst_Richtig', [{ type: 'task', name: 'Bewerten_Richtig' }]),
    task('Selbst_Falsch', [{ type: 'task', name: 'Bewerten_Falsch' }]),

    // --- Leitner-Buchung + Rundenliste aktualisieren ---
    task('Bewerten_Richtig', [
      prop('Act_BewertenR_Start', { Busy: 1, 'StatusLabel.text': 'Wird gebucht …' }),
      http('Act_BewertungR_Server', '{"launchKey":"${CMS_LAUNCH}","action":"cardAnswer","cardId":"${AktuelleKarte.id}","correct":true}', 'BewertungAntwort'),
      cond('Gebucht?', 'BewertungAntwort.ok', '==', true, [
        calc('Act_Richtig_Plus', 'Richtig + 1', 'Richtig'),
        prop('Act_BewertetR', { Busy: 0, 'ZaehlerLabel.text': 'Richtig: ${Richtig} · Falsch: ${Falsch}', 'StatusLabel.text': '${BewertungAntwort.message}', 'Naechste.visible': true, 'LoesungLabel.text': '${AktuelleKarte.answers}', 'Pruefen.visible': false, 'AntwortEdit.visible': false, 'Richtig.visible': false, 'FalschSelbst.visible': false, GezogeneIds: '${GezogeneIds}${AktuelleKarte.id},' }),
      ], [
        prop('Act_BuchFehler', { Busy: 0, 'StatusLabel.text': '${BewertungAntwort.message}' }),
      ]),
    ], 'Richtig: Lernfach +1 (Fach 5 → Ablage 6), Karte in Rundenliste'),
    task('Bewerten_Falsch', [
      prop('Act_BewertenF_Start', { Busy: 1, 'StatusLabel.text': 'Wird gebucht …' }),
      http('Act_BewertungF_Server', '{"launchKey":"${CMS_LAUNCH}","action":"cardAnswer","cardId":"${AktuelleKarte.id}","correct":false}', 'BewertungAntwort'),
      cond('Gebucht?', 'BewertungAntwort.ok', '==', true, [
        calc('Act_Falsch_Plus', 'Falsch + 1', 'Falsch'),
        prop('Act_BewertetF', { Busy: 0, 'ZaehlerLabel.text': 'Richtig: ${Richtig} · Falsch: ${Falsch}', 'StatusLabel.text': '${BewertungAntwort.message}', 'Naechste.visible': true, 'LoesungLabel.text': '${AktuelleKarte.answers}', 'Pruefen.visible': false, 'AntwortEdit.visible': false, 'Richtig.visible': false, 'FalschSelbst.visible': false, GezogeneIds: '${GezogeneIds}${AktuelleKarte.id},' }),
      ], [
        prop('Act_BuchFehlerF', { Busy: 0, 'StatusLabel.text': '${BewertungAntwort.message}' }),
      ]),
    ], 'Falsch: zurück auf Lernfach 1, Karte in Rundenliste'),

    // --- Ende ---
    task('Quiz_Beenden', [
      http('Act_Sitzung_Ende', '{"launchKey":"${CMS_LAUNCH}","action":"end"}', 'EndeAntwort'),
    ], 'Spielsitzung sauber beenden (Zeitbuchung abschließen)'),
  ],
  actions,
  events: {},
  features: [{ id: 'quiz-karteikasten', name: 'Karteikasten-Quiz', description: 'Muster: Karteikasten andocken (KartenFach/KartenThema), cardNext-Loop, Leitner-Buchung. Als Overlay-Blaupause für andere Spiele gedacht.', tags: ['Karteikasten', 'Quiz', 'Muster'], userStoryIds: [], blueprintTaskNames: ['Quiz_Start', 'Karte_Ziehen', 'Antwort_Pruefen', 'Bewerten_Richtig', 'Bewerten_Falsch'] }],
};

const project = {
  meta: { name: 'Karteikasten-Quiz', description: 'Eigenständiges Muster-Quiz: zieht Karten aus dem persönlichen Karteikasten des angemeldeten Kindes (Leitner 1–5, Ablage 6). KartenFach/KartenThema = Art der Karten; leer = alles. Zum Kopieren in eigene Spiele oder als Overlay-Stage gedacht.', generatedBy: 'cms-add-quiz-demo.cjs', generatedAt: new Date().toISOString() },
  activeStageId: 'stage_quiz',
  schemaVersion: 3,
  flow: {},
  stages: [stage],
  userStories: [],
  objects: [],
  variables: [],
  tasks: [],
  actions: [],
};

// Referenzprüfung
require('./cms-quiz-speech.cjs').configureSpeechQuiz(project);
const actionNames = new Set(actions.map(a => a.name));
const taskNames = new Set(stage.tasks.map(t => t.name));
let missing = 0;
const walk = seq => (seq || []).forEach(st => {
  if (st.type === 'action' && !actionNames.has(st.name)) { console.error('fehlende Action ' + st.name); missing++; }
  if (st.type === 'task' && !taskNames.has(st.name)) { console.error('fehlender Task ' + st.name); missing++; }
  walk(st.body); walk(st.elseBody);
});
stage.tasks.forEach(t => walk(t.actionSequence));
for (const o of stage.objects) for (const ev of Object.values(o.events || {})) if (!taskNames.has(ev)) { console.error('Event-Task fehlt ' + ev); missing++; }
if (missing) { console.error(missing + ' fehlende Referenzen — Abbruch.'); process.exit(1); }

fs.writeFileSync(FILE, JSON.stringify(project, null, 1));
console.log('Karteikasten-Quiz.json geschrieben: stage_quiz mit ' + stage.tasks.length + ' Tasks, ' + actions.length + ' Actions');

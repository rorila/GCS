// Baut game-server/public/projects/Kopfrechnen-App.json — eigenständig
// spielbare Kopfrechen-App, die den persönlichen Karteikasten andockt.
// Quiz-Mechanik (cardNext/cardAnswer via /api/cms/play) + Kopfrechen-UI:
//   3 Antwort-Buttons, Distraktoren aus der Karten-Antwort berechnet
//   (Ergebnis+1, Ergebnis±…), Richtig = sofort weiter, Falsch = Lösung zeigen.
// KartenFach/KartenThema = „Art der Karten" (z. B. Mathe / 1x7), leer = alle.
// Die Ziehregel liegt deklarativ in stage_server_play des CMS-Projekts.
// Idempotent. Aufruf: node scripts/cms/cms-add-kopfrechen-app.cjs
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const FILE = path.join(__dirname, '../../game-server/public/projects/Kopfrechnen-App.json');

const uid = p => p + '-' + crypto.randomUUID();
const label = (name, text, x, y, w, h, fontSize = 22, extra = {}) => ({ className: 'TLabel', id: uid('kr_lbl'), name, scope: 'stage', draggable: false, droppable: false, dragMode: 'move', text, visible: true, x, y, width: w, height: h, zIndex: 0, rotation: 0, align: 'NONE', collisionEnabled: false, style: { color: '#edf7f4', fontSize, textAlign: 'center', backgroundColor: 'transparent', borderColor: 'transparent', borderWidth: 0 }, ...extra });
const button = (name, text, x, y, w, h, onClick, extra = {}) => ({ className: 'TButton', id: uid('kr_btn'), name, scope: 'stage', draggable: false, droppable: false, dragMode: 'move', text, icon: '', visible: true, x, y, width: w, height: h, zIndex: 0, rotation: 0, align: 'NONE', collisionEnabled: false, matchValue: '', style: { color: '#ffffff', fontSize: 28, fontWeight: '700', backgroundColor: '#2f6fed', borderColor: '#1d4fb8', borderWidth: 2, borderRadius: 12 }, events: { onClick }, ...extra });
const variable = (cls, name, def, extra = {}) => ({ className: cls, id: uid('kr_var'), name, scope: 'stage', isVariable: true, isHiddenInRun: true, draggable: false, droppable: false, dragMode: 'move', description: '', visible: true, x: 0, y: 0, width: 6, height: 2, zIndex: 0, rotation: 0, align: 'NONE', collisionEnabled: false, style: {}, type: cls.replace(/^T|Variable$/g, '').toLowerCase(), defaultValue: def, value: def, objectModel: '', ...extra });
const strVar = (n, d = '') => variable('TStringVariable', n, d);
const intVar = (n, d = 0) => variable('TIntegerVariable', n, d);
const objVar = n => variable('TObjectVariable', n, null);
const timer = (name, onTimer, interval = 400) => ({ className: 'TTimer', id: uid('kr_timer'), name, scope: 'stage', isService: true, isHiddenInRun: true, draggable: false, droppable: false, dragMode: 'move', visible: true, x: 1, y: 1, width: 4, height: 2, zIndex: 0, rotation: 0, align: 'NONE', collisionEnabled: false, style: {}, interval, enabled: true, maxInterval: 1, currentInterval: 0, events: { onTimer } });

const actions = [];
const prop = (name, changes) => (actions.push({ id: uid('kr_act'), name, type: 'property', changes, scope: 'stage' }), { type: 'action', name });
const http = (name, body, resultVariable) => (actions.push({ id: uid('kr_act'), name, type: 'http', url: '/api/cms/play', method: 'POST', body, resultVariable, scope: 'stage', queryOperator: '==' }), { type: 'action', name });
const calc = (name, formula, resultVariable) => (actions.push({ id: uid('kr_act'), name, type: 'calculate', formula, resultVariable, scope: 'stage' }), { type: 'action', name });
const varset = (name, source, sourceProperty, variableName) => (actions.push({ id: uid('kr_act'), name, type: 'variable', source, sourceProperty, variableName, scope: 'stage' }), { type: 'action', name });
const overlay = (name, result) => (actions.push({ id: uid('kr_act'), name, type: 'close_overlay', result, scope: 'stage' }), { type: 'action', name });
const task = (name, actionSequence, description) => ({ id: uid('kr_task'), name, description: description || name, actionSequence, triggerMode: 'local-sync', params: [], scope: 'stage' });
const cond = (name, variable, operator, value, body, elseBody, rightType) => ({ type: 'condition', name, condition: { variable, operator, value, ...(rightType ? { rightType } : {}) }, body, elseBody });

const stage = {
  id: 'stage_rechnen', type: 'standard', name: 'Kopfrechnen',
  grid: { cols: 64, rows: 40, cellSize: 18, visible: false, snapToGrid: true, backgroundColor: '#122b39' },
  objects: [
    label('Titel', 'KOPFRECHNEN', 4, 2, 56, 3, 30),
    label('FachLabel', '', 4, 5, 56, 2, 16),
    label('FortschrittLabel', '', 4, 7, 56, 2, 14),
    label('ZaehlerLabel', 'Richtig: 0 · Falsch: 0', 4, 9, 56, 2, 14),
    label('FrageLabel', '', 8, 13, 48, 6, 34),
    button('BtnAntwortA', '?', 8, 22, 15, 4, 'Antwort_Gewaehlt', { visible: false }),
    button('BtnAntwortB', '?', 24.5, 22, 15, 4, 'Antwort_Gewaehlt', { visible: false }),
    button('BtnAntwortC', '?', 41, 22, 15, 4, 'Antwort_Gewaehlt', { visible: false }),
    label('LoesungLabel', '', 8, 28, 48, 3, 20),
    label('StatusLabel', '', 8, 31, 48, 3, 18),
    button('Naechste', '➡ Nächste Aufgabe', 26, 34, 16, 3, 'Aufgabe_Ziehen', { visible: false, style: { color: '#ffffff', fontSize: 18, fontWeight: '600', backgroundColor: '#1d9e77', borderColor: '#147a5d', borderWidth: 2, borderRadius: 10 } }),
    button('Beenden', '🏁 Beenden', 8, 34, 12, 3, 'App_Beenden', { style: { color: '#ffffff', fontSize: 18, fontWeight: '600', backgroundColor: '#3d4c5c', borderColor: '#2b3844', borderWidth: 2, borderRadius: 10 } }),
    timer('AppInit', 'App_Start'),
  ],
  variables: [
    strVar('CMS_LAUNCH', '', { description: 'Wird vom Server beim /play-Render mit dem Launch-Schlüssel befüllt.' }),
    strVar('KartenFach', 'Mathe', { description: '„Art der Karten" — Schulfach frei wählbar, leer = alle Fächer.' }),
    strVar('KartenThema', '', { description: 'Optionales Thema innerhalb des Fachs (z. B. 1x7), leer = alle.' }),
    intVar('Aufgaben', 10, { description: 'Anzahl Aufgaben pro Runde; als Overlay-Übergabe {aufgaben:N} möglich.' }),
    strVar('GezogeneIds', '', { description: 'Runden-Liste: schon gezogene Karten werden nicht erneut gezogen.' }),
    objVar('AktuelleKarte'), objVar('KartenAntwort'), objVar('BewertungAntwort'), objVar('EndeAntwort'),
    intVar('Richtig'), intVar('Falsch'), intVar('Busy'),
    intVar('AufgabenNr'), intVar('Ergebnis'), intVar('Distrakt1'), intVar('Distrakt2'), intVar('Pos'),
  ],
  tasks: [
    // --- Start: erste Aufgabe ordern ---
    task('App_Start', [{ type: 'task', name: 'Aufgabe_Ziehen' }], 'Erstladung: erste Karte aus dem Karteikasten ordern'),

    // --- Kernschleife: nächste Karte als Rechenaufgabe ---
    task('Aufgabe_Ziehen', [
      cond('Rundenlimit erreicht?', 'AufgabenNr', '>=', '${Aufgaben}', [
        { type: 'task', name: 'Abschluss' },
      ], [
        cond('Runde läuft?', 'Busy', '==', 0, [
          prop('Act_Ziehen_Start', { Busy: 1, 'StatusLabel.text': 'Aufgabe wird geladen …', 'LoesungLabel.text': '', 'Naechste.visible': false, 'BtnAntwortA.visible': false, 'BtnAntwortB.visible': false, 'BtnAntwortC.visible': false }),
          http('Act_Karte_Server', '{"launchKey":"${CMS_LAUNCH}","action":"cardNext","subject":"${KartenFach}","topic":"${KartenThema}","formats":["text"],"excludeIds":"${GezogeneIds}"}', 'KartenAntwort'),
          cond('Server antwortet?', 'KartenAntwort.ok', '!=', true, [
            prop('Act_ZiehFehler', { Busy: 0, 'FrageLabel.text': '⚠️ Verbindungsproblem', 'StatusLabel.text': '${KartenAntwort.message}', 'FachLabel.text': '' }),
          ], [
          cond('Karte gefunden?', 'KartenAntwort.card', 'truthy', true, [
            varset('Act_Karte_Objekt', 'KartenAntwort', 'card', 'AktuelleKarte'),
            calc('Act_Nr_Plus', 'AufgabenNr + 1', 'AufgabenNr'),
            prop('Act_Karte_Uebernehmen', { 'FrageLabel.text': '${KartenAntwort.card.question}', 'FachLabel.text': '${KartenAntwort.card.subject} · ${KartenAntwort.card.topic} · Fach ${KartenAntwort.card.box}', 'FortschrittLabel.text': 'Aufgabe ${AufgabenNr} von ${Aufgaben}' }),
            calc('Act_Ergebnis', 'parseInt(AktuelleKarte.answers[0])', 'Ergebnis'),
            calc('Act_Distraktor1', 'Ergebnis + 1', 'Distrakt1'),
            calc('Act_Distraktor2', 'Ergebnis > 1 ? Ergebnis - 1 : Ergebnis + 2', 'Distrakt2'),
            calc('Act_Position', 'Math.floor(Math.random() * 3) + 1', 'Pos'),
            cond('Pos 1?', 'Pos', '==', 1, [
              prop('Act_VarianteA', { 'BtnAntwortA.text': '${Ergebnis}', 'BtnAntwortA.matchValue': '${Ergebnis}', 'BtnAntwortB.text': '${Distrakt1}', 'BtnAntwortB.matchValue': '${Distrakt1}', 'BtnAntwortC.text': '${Distrakt2}', 'BtnAntwortC.matchValue': '${Distrakt2}' }),
            ], [
              cond('Pos 2?', 'Pos', '==', 2, [
                prop('Act_VarianteB', { 'BtnAntwortA.text': '${Distrakt1}', 'BtnAntwortA.matchValue': '${Distrakt1}', 'BtnAntwortB.text': '${Ergebnis}', 'BtnAntwortB.matchValue': '${Ergebnis}', 'BtnAntwortC.text': '${Distrakt2}', 'BtnAntwortC.matchValue': '${Distrakt2}' }),
              ], [
                prop('Act_VarianteC', { 'BtnAntwortA.text': '${Distrakt1}', 'BtnAntwortA.matchValue': '${Distrakt1}', 'BtnAntwortB.text': '${Distrakt2}', 'BtnAntwortB.matchValue': '${Distrakt2}', 'BtnAntwortC.text': '${Ergebnis}', 'BtnAntwortC.matchValue': '${Ergebnis}' }),
              ]),
            ]),
            prop('Act_Buttons_Bereit', { Busy: 0, 'StatusLabel.text': '', 'BtnAntwortA.visible': true, 'BtnAntwortB.visible': true, 'BtnAntwortC.visible': true }),
          ], [
            { type: 'task', name: 'Abschluss' },
          ]),
          ]),
        ]),
      ], 'variable'),
    ], 'Server ordert die nächste Karte; Distraktoren = Ergebnis±1 bzw. +2, Position zufällig'),

    // --- Antwort geklickt: matchValue gegen Ergebnis ---
    task('Antwort_Gewaehlt', [
      cond('Runde läuft?', 'Busy', '==', 0, [
        cond('Treffer?', 'self.matchValue', '==', '${Ergebnis}', [
          { type: 'task', name: 'Bewerten_Richtig' },
        ], [
          { type: 'task', name: 'Bewerten_Falsch' },
        ], 'variable'),
      ]),
    ], 'matchValue des geklickten Buttons mit dem Ergebnis vergleichen'),

    // --- Leitner-Buchung ---
    task('Bewerten_Richtig', [
      prop('Act_BewertenR_Start', { Busy: 1, 'BtnAntwortA.visible': false, 'BtnAntwortB.visible': false, 'BtnAntwortC.visible': false, 'StatusLabel.text': '✔ Richtig!' }),
      http('Act_BewertungR_Server', '{"launchKey":"${CMS_LAUNCH}","action":"cardAnswer","cardId":"${AktuelleKarte.id}","correct":true}', 'BewertungAntwort'),
      cond('Gebucht?', 'BewertungAntwort.ok', '==', true, [
        calc('Act_Richtig_Plus', 'Richtig + 1', 'Richtig'),
        prop('Act_BewertetR', { Busy: 0, 'ZaehlerLabel.text': 'Richtig: ${Richtig} · Falsch: ${Falsch}', GezogeneIds: '${GezogeneIds}${AktuelleKarte.id},' }),
        { type: 'task', name: 'Aufgabe_Ziehen' },
      ], [
        prop('Act_BuchFehler', { Busy: 0, 'StatusLabel.text': '${BewertungAntwort.message}' }),
      ]),
    ], 'Richtig: Lernfach +1 (Fach 5 → Ablage 6), direkt nächste Aufgabe'),
    task('Bewerten_Falsch', [
      prop('Act_BewertenF_Start', { Busy: 1, 'BtnAntwortA.visible': false, 'BtnAntwortB.visible': false, 'BtnAntwortC.visible': false }),
      http('Act_BewertungF_Server', '{"launchKey":"${CMS_LAUNCH}","action":"cardAnswer","cardId":"${AktuelleKarte.id}","correct":false}', 'BewertungAntwort'),
      cond('Gebucht?', 'BewertungAntwort.ok', '==', true, [
        calc('Act_Falsch_Plus', 'Falsch + 1', 'Falsch'),
        prop('Act_BewertetF', { Busy: 0, 'ZaehlerLabel.text': 'Richtig: ${Richtig} · Falsch: ${Falsch}', 'LoesungLabel.text': '${AktuelleKarte.question} = ${AktuelleKarte.answers}', 'StatusLabel.text': 'Fast — schau dir die Lösung an.', 'Naechste.visible': true, GezogeneIds: '${GezogeneIds}${AktuelleKarte.id},' }),
      ], [
        prop('Act_BuchFehlerF', { Busy: 0, 'StatusLabel.text': '${BewertungAntwort.message}' }),
      ]),
    ], 'Falsch: zurück auf Lernfach 1, Lösung zeigen, per Button weiter'),

    // --- Ende ---
    task('Abschluss', [
      prop('Act_Abschluss', { Busy: 0, 'FrageLabel.text': '🎉 Geschafft!', 'FachLabel.text': '', 'FortschrittLabel.text': '', 'StatusLabel.text': 'Richtig: ${Richtig} · Falsch: ${Falsch}', 'LoesungLabel.text': '', 'Naechste.visible': false, 'BtnAntwortA.visible': false, 'BtnAntwortB.visible': false, 'BtnAntwortC.visible': false }),
      http('Act_Sitzung_Ende', '{"launchKey":"${CMS_LAUNCH}","action":"end"}', 'EndeAntwort'),
      overlay('Act_Ergebnis_Rueckmelden', '{"richtig": ${Richtig}, "fehler": ${Falsch}, "gesamt": ${AufgabenNr}}'),
    ], 'Ergebnis anzeigen, Spielsitzung beenden (Zeitbuchung), Ergebnis ans Hauptspiel zurückmelden'),
    task('App_Beenden', [
      http('Act_Ende_Server', '{"launchKey":"${CMS_LAUNCH}","action":"end"}', 'EndeAntwort'),
      prop('Act_Beendet', { 'StatusLabel.text': 'Sitzung beendet.' }),
    ], 'Manuell beenden: Zeitbuchung abschließen'),
  ],
  actions,
  events: {},
  features: [{ id: 'kopfrechnen-karteikasten', name: 'Kopfrechnen-App', description: 'Karteikasten andocken (KartenFach/KartenThema), cardNext-Loop, 3-Button-Antworten mit berechneten Distraktoren, Leitner-Buchung über cardAnswer. Eigenständig oder als Overlay nutzbar.', tags: ['Karteikasten', 'Kopfrechnen', 'Muster'], userStoryIds: [], blueprintTaskNames: ['App_Start', 'Aufgabe_Ziehen', 'Antwort_Gewaehlt', 'Bewerten_Richtig', 'Bewerten_Falsch', 'Abschluss'] }],
};

const project = {
  meta: { id: 'kopfrechnen-app', name: 'Kopfrechnen-App', version: '0.1.0', description: 'Kopfrechen-App mit Karteikasten-Anbindung: Karten aus dem Leitner-Kasten des Kindes (z. B. 1xN-Stapel), 3 Antwort-Buttons, richtig/falsch wird per cardAnswer gebucht. Übergabedaten als Overlay: { "aufgaben": 10 }.', generatedBy: 'cms-add-kopfrechen-app.cjs', generatedAt: new Date().toISOString() },
  activeStageId: 'stage_rechnen',
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
console.log('Kopfrechnen-App.json geschrieben: stage_rechnen mit ' + stage.tasks.length + ' Tasks, ' + actions.length + ' Actions');

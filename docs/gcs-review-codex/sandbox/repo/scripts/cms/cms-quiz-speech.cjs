function configureSpeechQuiz(project) {
  const stage = project.stages.find(s => s.id === 'stage_quiz');
  if (!stage) throw new Error('Quiz-Stage fehlt.');
  project.meta.description = 'Karteikasten-Quiz mit Spracheingabe oder Tastatur. Richtig: automatisch weiter. Falsch: Lösung zwei Sekunden zeigen und Karte hinten in Fach 1 wieder vorlegen.';
  const upsert = (list, name, definition) => {
    const existing = list.find(item => item.name === name);
    if (existing) Object.assign(existing, definition);
    else list.push({ id: 'quiz_speech_' + name, name, scope: 'stage', ...definition });
  };
  const action = (name, type, fields) => { upsert(stage.actions, name, { type, ...fields }); return { type: 'action', name }; };
  const prop = (name, changes) => action(name, 'property', { changes });
  const call = (name, target, method, params = []) => action(name, 'call_method', { target, method, params });
  const run = name => ({ type: 'task', name });
  const cond = (variable, operator, value, then, otherwise = []) => ({ type: 'condition', condition: { variable, operator, value }, body: then, elseBody: otherwise });
  const task = (name, sequence) => upsert(stage.tasks, name, { actionSequence: sequence, triggerMode: 'local-sync', params: [] });
  const variable = (name, value, className) => upsert(stage.variables, name, { className, isVariable: true, isHiddenInRun: true, defaultValue: value, value, type: className.replace(/^T|Variable$/g, '').toLowerCase() });
  const button = (name, text, x, y, event, visible = true) => upsert(stage.objects, name, { className: 'TButton', text, visible, x, y, width: 20, height: 3, events: { onClick: event } });
  for (const [name, value, type] of [['Phase', 'idle', 'TStringVariable'], ['EingabeModus', 'speech', 'TStringVariable'], ['AntwortPruefung', null, 'TObjectVariable'], ['FeedbackFertig', false, 'TBooleanVariable'], ['BuchungFertig', false, 'TBooleanVariable']]) variable(name, value, type);
  const init = stage.objects.find(o => o.name === 'QuizInit');
  if (init) init.enabled = false;
  upsert(stage.objects, 'Spracheingabe', { className: 'TSpeechRecognition', isService: true, isHiddenInRun: true, x: 1, y: 1, width: 4, height: 2, language: 'de-DE', maxDurationMs: 12000, silenceMs: 1000, events: { onReady: 'Sprache_Bereit', onResult: 'Sprachantwort_Pruefen', onNoSpeech: 'Antwort_Unverstanden', onError: 'Sprachfehler' } });
  upsert(stage.objects, 'LoesungsTimer', { className: 'TTimer', isService: true, isHiddenInRun: true, x: 1, y: 3, width: 4, height: 2, interval: 2000, enabled: false, maxInterval: 1, currentInterval: 0, events: { onTimer: 'Loesungszeit_Vorbei' } });
  button('Start', 'Start', 22, 22, 'Quiz_Start');
  button('Tastatur', 'Tastatur verwenden', 40, 36, 'Tastatur_Waehlen');
  button('Wiederholen', 'Noch einmal sprechen', 22, 27, 'Sprache_Wiederholen', false);
  const status = stage.objects.find(o => o.name === 'StatusLabel');
  if (status) status.text = 'Klicke auf Start und gib das Mikrofon frei.';
  const copySpeech = action('Act_Sprachantwort', 'variable', { source: 'Spracheingabe', sourceProperty: 'transcript', variableName: 'AktuelleAntwort' });
  const cancel = call('Act_Sprache_Abbrechen', 'Spracheingabe', 'cancel');
  const listen = call('Act_Sprache_Hoeren', 'Spracheingabe', 'start');
  const prepare = call('Act_Sprache_Vorbereiten', 'Spracheingabe', 'prepare', ['${CMS_LAUNCH}']);
  const next = prop('Act_Naechste_Bereit', { Phase: 'next', Busy: 0 });
  const hideInput = { 'Start.visible': false, 'Pruefen.visible': false, 'AntwortEdit.visible': false, 'AntwortZeigen.visible': false, 'Richtig.visible': false, 'FalschSelbst.visible': false, 'Naechste.visible': false, 'Wiederholen.visible': false };
  task('Quiz_Start', [cond('Phase', 'in', ['idle', 'speech-error'], [
    prop('Act_Start_Sprache', { Phase: 'preparing', EingabeModus: 'speech', 'Start.visible': false, 'StatusLabel.text': 'Mikrofon im Spielhost freigeben.' }), prepare,
  ])]);
  task('Sprache_Bereit', [cond('Phase', '==', 'preparing', [cond('AktuelleKarte', 'truthy', true, [prop('Act_Sprache_Fortsetzen', { Phase: 'answering' }), run('Eingabe_Bereit')], [next, run('Karte_Ziehen')])])]);
  task('Tastatur_Waehlen', [cond('Phase', 'in', ['idle', 'preparing', 'answering', 'speech-error'], [cancel, prop('Act_Tastatur_Waehlen', { EingabeModus: 'keyboard', 'Start.visible': false }), cond('AktuelleKarte', 'truthy', true, [prop('Act_Tastatur_Fortsetzen', { Phase: 'answering' }), run('Eingabe_Bereit')], [next, run('Karte_Ziehen')])])]);
  task('Karte_Ziehen', [cond('Phase', '==', 'next', [cancel,
    prop('Act_Ziehen_Start', { ...hideInput, Phase: 'loading', Busy: 1, 'StatusLabel.text': 'Aufgabe wird geladen.', 'LoesungLabel.text': '', 'AntwortEdit.text': '', AktuelleAntwort: '', 'LoesungsTimer.enabled': false }),
    runAction('Act_Karte_Server'),
    cond('Phase', '==', 'loading', [cond('KartenAntwort.ok', '==', true, [cond('KartenAntwort.card', 'truthy', true, [
      runAction('Act_Karte_Objekt'), prop('Act_Karte_Uebernehmen', { 'FrageLabel.text': '${KartenAntwort.card.question}', 'FachLabel.text': '${KartenAntwort.card.subject} · ${KartenAntwort.card.topic} · Fach ${KartenAntwort.card.box}', Busy: 0, Phase: 'answering' }), run('Eingabe_Bereit'),
    ], [prop('Act_QuizEnde', { Phase: 'complete', 'FrageLabel.text': 'Fertig!', 'StatusLabel.text': 'Alle Karten dieser Runde richtig beantwortet.', 'FachLabel.text': '' }), run('Quiz_Beenden')])], [prop('Act_ZiehFehler', { Phase: 'load-error', Busy: 0, 'StatusLabel.text': '${KartenAntwort.message}', 'Naechste.visible': true })])]),
  ])]);
  task('Laden_Wiederholen', [cond('Phase', '==', 'load-error', [next, run('Karte_Ziehen')])]);
  const nextButton = stage.objects.find(o => o.name === 'Naechste');
  if (nextButton) { nextButton.text = 'Erneut laden'; nextButton.events = { onClick: 'Laden_Wiederholen' }; }
  task('Eingabe_Bereit', [prop('Act_Eingabe_Zuruecksetzen', { ...hideInput, 'StatusLabel.text': '', 'AntwortEdit.text': '' }), cond('AktuelleKarte.answerFormat', '==', 'self', [prop('Act_SelfBereit', { 'AntwortZeigen.visible': true, 'StatusLabel.text': 'Antwort aussprechen, dann Lösung aufdecken.' })], [cond('EingabeModus', '==', 'speech', [prop('Act_Sprechbereit', { 'StatusLabel.text': 'Bitte antworte laut.' }), listen], [prop('Act_TextBereit', { 'AntwortEdit.visible': true, 'Pruefen.visible': true, 'StatusLabel.text': 'Antwort eingeben und prüfen.' })])])]);
  task('Sprachantwort_Pruefen', [cond('Phase', '==', 'answering', [cond('EingabeModus', '==', 'speech', [copySpeech, run('Antwort_Auswerten')])])]);
  task('Antwort_Pruefen', [cond('Phase', '==', 'answering', [action('Act_Texteingabe', 'variable', { source: 'AntwortEdit', sourceProperty: 'text', variableName: 'AktuelleAntwort' }), run('Antwort_Auswerten')])]);
  task('Antwort_Auswerten', [cond('Phase', '==', 'answering', [action('Act_Zahlantwort_Pruefen', 'calculate', { formula: 'checkNumberAnswer(AktuelleAntwort, AktuelleKarte.value.answers)', resultVariable: 'AntwortPruefung' }), cond('AntwortPruefung.valid', '==', true, [cond('AntwortPruefung.correct', '==', true, [run('Bewerten_Richtig')], [run('Bewerten_Falsch')])], [run('Antwort_Unverstanden')])])]);
  task('Antwort_Unverstanden', [cond('Phase', '==', 'answering', [prop('Act_Unverstanden', { 'StatusLabel.text': 'Keine eindeutige Zahl verstanden. Bitte auf „Noch einmal sprechen“ klicken.', 'Wiederholen.visible': false }), cond('EingabeModus', '==', 'speech', [prop('Act_Wiederholen_Sichtbar', { 'Wiederholen.visible': true })])])]);
  task('Sprachfehler', [cond('Phase', 'in', ['preparing', 'answering'], [prop('Act_Sprachfehler', { Phase: 'speech-error', 'StatusLabel.text': '${Spracheingabe.errorMessage}', 'Start.visible': true, 'Wiederholen.visible': false })])]);
  task('Sprache_Wiederholen', [cond('Phase', '==', 'answering', [cond('EingabeModus', '==', 'speech', [prop('Act_Erneut_Hoeren', { 'Wiederholen.visible': false, 'StatusLabel.text': 'Bitte antworte laut.' }), listen])])]);
  task('Antwort_Zeigen', [cond('Phase', '==', 'answering', [prop('Act_Loesung_Anzeigen', { 'LoesungLabel.text': '${AktuelleKarte.answers}', 'Richtig.visible': true, 'FalschSelbst.visible': true, 'AntwortZeigen.visible': false })])]);
  task('Bewerten_Richtig', [cond('Phase', '==', 'answering', [cancel, prop('Act_BewertenR_Start', { ...hideInput, Phase: 'saving', Busy: 1, 'StatusLabel.text': 'Richtig. Lernstand wird gespeichert.' }), runAction('Act_BewertungR_Server'), cond('Phase', '==', 'saving', [cond('BewertungAntwort.ok', '==', true, [runAction('Act_Richtig_Plus'), prop('Act_BewertetR', { GezogeneIds: '${GezogeneIds}${AktuelleKarte.id},', 'ZaehlerLabel.text': 'Richtig: ${Richtig} · Falsch: ${Falsch}' }), next, run('Karte_Ziehen')], [run('Buchungsfehler')])])])]);
  task('Bewerten_Falsch', [cond('Phase', '==', 'answering', [cancel, prop('Act_BewertenF_Start', { ...hideInput, Phase: 'feedback', Busy: 1, FeedbackFertig: false, BuchungFertig: false, 'LoesungLabel.text': 'Richtige Antwort: ${AktuelleKarte.answers}', 'StatusLabel.text': 'Die Karte kommt hinten in Fach 1.', 'LoesungsTimer.currentInterval': 0, 'LoesungsTimer.enabled': true }), runAction('Act_BewertungF_Server'), cond('Phase', '==', 'feedback', [cond('BewertungAntwort.ok', '==', true, [runAction('Act_Falsch_Plus'), prop('Act_BewertetF', { BuchungFertig: true, 'ZaehlerLabel.text': 'Richtig: ${Richtig} · Falsch: ${Falsch}' }), run('Weiter_Nach_Feedback')], [run('Buchungsfehler')])])])]);
  task('Loesungszeit_Vorbei', [cond('Phase', '==', 'feedback', [prop('Act_Feedback_Ende', { FeedbackFertig: true, 'LoesungsTimer.enabled': false }), run('Weiter_Nach_Feedback')])]);
  task('Weiter_Nach_Feedback', [cond('Phase', '==', 'feedback', [cond('FeedbackFertig', '==', true, [cond('BuchungFertig', '==', true, [next, run('Karte_Ziehen')])])])]);
  task('Buchungsfehler', [prop('Act_Buchungsfehler', { Phase: 'save-error', 'LoesungsTimer.enabled': false, 'StatusLabel.text': 'Lernstand konnte nicht sicher gespeichert werden. Bitte Spiel beenden und Verbindung prüfen.' })]);
  task('Quiz_Beenden', [cond('Phase', '!=', 'ended', [prop('Act_Quiz_Stop', { ...hideInput, Phase: 'ended', Busy: 1, 'LoesungsTimer.enabled': false, 'Tastatur.visible': false, 'StatusLabel.text': 'Spiel beendet. Richtig: ${Richtig} · Falsch: ${Falsch}' }), cancel, runAction('Act_Sitzung_Ende'), cond('EndeAntwort.ok', '!=', true, [prop('Act_Ende_Fehler', { 'StatusLabel.text': 'Sitzungsende nicht bestätigt. Bitte über den Spielhost schließen.' })])])]);
  const configured=require('./cms-quiz-tts.cjs').configureQuizTts(project);
  if(project.meta?.cardLearningPoints)require('./cms-quiz-points.cjs').configureQuizPoints(configured);
  return configured;
}
function runAction(name) { return { type: 'action', name }; }
module.exports = { configureSpeechQuiz };
if (require.main === module) {
  const fs = require('node:fs'), path = require('node:path');
  const file = path.join(__dirname, '../../game-server/public/projects/Karteikasten-Quiz.json');
  const raw = fs.readFileSync(file, 'utf8');
  const project = configureSpeechQuiz(JSON.parse(raw));
  fs.writeFileSync(file, JSON.stringify(project, null, 1) + (raw.endsWith('\n') ? '\n' : ''));
}

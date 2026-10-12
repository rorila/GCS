/** Deklarative Erweiterung: Vorlesen und Aufnahme/Feedback über Ereignisse koordinieren. */
function configureQuizTts(project) {
  const stage = project.stages.find(item => item.id === 'stage_quiz');
  if (!stage) throw new Error('Quiz-Stage fehlt.');
  let blueprint = project.stages.find(item => item.id === 'stage_blueprint' || item.type === 'blueprint');
  if (!blueprint) {
    blueprint = { id: 'stage_blueprint', name: 'Blueprint', type: 'blueprint', grid: { cols: 64, rows: 40, cellSize: 18 }, objects: [], variables: [], tasks: [], actions: [] };
    project.stages.push(blueprint);
  }
  const upsert = (items, name, data) => { const old = items.find(item => item.name === name); if (old) Object.assign(old, data); else items.push({ id: 'quiz_tts_' + name, name, scope: 'stage', ...data }); };
  const reference = name => ({ type: 'action', name });
  const action = (name, type, data) => { upsert(stage.actions, name, { type, ...data }); return reference(name); };
  const prop = (name, changes) => action(name, 'property', { changes });
  const speak = (name, text) => action(name, 'call_method', { target: 'SprachAusgabe', method: 'speak', params: [text] });
  const stop = action('Act_Ansage_Stop', 'call_method', { target: 'SprachAusgabe', method: 'stop', params: [] });
  const run = name => ({ type: 'task', name });
  const cond = (variable, value, body, elseBody = []) => ({ type: 'condition', condition: { variable, operator: '==', value }, body, elseBody });
  const task = (name, actionSequence) => upsert(stage.tasks, name, { actionSequence, triggerMode: 'local-sync', params: [] });
  for (const [name, value, className] of [['AnsageArt', '', 'TStringVariable'], ['SprachFeedbackFertig', true, 'TBooleanVariable']]) {
    upsert(stage.variables, name, { value, defaultValue: value, className, type: typeof value, isVariable: true, isHiddenInRun: true });
  }
  upsert(blueprint.objects, 'SprachAusgabe', { className: 'TTextToSpeech', scope: 'global', x: 1, y: 5, width: 4, height: 2,
    isService: true, isHiddenInRun: true, endpoint: '/api/tts', voice: 'default', volume: 1, active: true,
    events: { onEnded: 'Ansage_Ende', onError: 'Ansage_Fehler' } });
  upsert(stage.objects, 'SprachStatus', { className: 'TLabel', x: 4, y: 36, width: 56, height: 2, visible: true, text: '',
    style: { color: '#edf7f4', fontSize: 14, backgroundColor: 'transparent', textAlign: 'center' } });
  // Beim wiederholten Ausführen des Generators wird der ursprüngliche Eingabe-Task neu angelegt.
  const input = stage.tasks.find(item => item.name === 'Eingabe_Bereit');
  if (!input.actionSequence[0]?.body?.some(item => item.name === 'Act_Frage_Sprechen')) {
    task('AntwortEingabe_Bereit', structuredClone(input.actionSequence));
  }
  task('Eingabe_Bereit', [cond('Phase', 'answering', [stop, reference('Act_Sprache_Abbrechen'),
    prop('Act_Frage_Vorlesen', { Phase: 'reading', AnsageArt: 'question', 'SprachStatus.text': '',
      'StatusLabel.text': 'Die Frage wird vorgelesen.', 'AntwortEdit.visible': false, 'Pruefen.visible': false,
      'AntwortZeigen.visible': false, 'Wiederholen.visible': false }),
    speak('Act_Frage_Sprechen', '${AktuelleKarte.question}')])]);
  task('Ansage_Ende', [cond('AnsageArt', 'question', [cond('Phase', 'reading', [
    prop('Act_Frage_Gelesen', { Phase: 'answering', AnsageArt: '' }), run('AntwortEingabe_Bereit')])], [
    cond('AnsageArt', 'solution', [prop('Act_Loesung_Gelesen', { AnsageArt: '', SprachFeedbackFertig: true }), run('Weiter_Nach_Feedback')])])]);
  task('Ansage_Fehler', [prop('Act_Ansage_Fehler', { 'SprachStatus.text': 'Sprachausgabe nicht verfügbar. Bitte den Text lesen.' }), run('Ansage_Ende')]);
  const wrong = stage.tasks.find(item => item.name === 'Bewerten_Falsch').actionSequence[0].body;
  const wrongStart = wrong.findIndex(item => item.name === 'Act_BewertenF_Start');
  if (!wrong.some(item => item.name === 'Act_Loesung_Sprechen')) wrong.splice(wrongStart + 1, 0,
    prop('Act_Loesung_Vorlesen', { AnsageArt: 'solution', SprachFeedbackFertig: false }),
    speak('Act_Loesung_Sprechen', 'Die richtige Antwort ist ${AktuelleKarte.answers.0}.'));
  const show = stage.tasks.find(item => item.name === 'Antwort_Zeigen').actionSequence[0].body;
  if (!show.some(item => item.name === 'Act_SelbstLoesung_Sprechen')) show.push(
    prop('Act_SelbstLoesung_Vorlesen', { AnsageArt: 'self' }),
    speak('Act_SelbstLoesung_Sprechen', 'Die Antwort ist ${AktuelleKarte.answers.0}.'));
  const next = stage.tasks.find(item => item.name === 'Weiter_Nach_Feedback');
  if (next.actionSequence[0]?.condition?.variable !== 'SprachFeedbackFertig') next.actionSequence = [cond('SprachFeedbackFertig', true, next.actionSequence)];
  for (const name of ['Karte_Ziehen', 'Quiz_Beenden', 'Bewerten_Richtig', 'Bewerten_Falsch', 'Tastatur_Waehlen']) {
    const body = stage.tasks.find(item => item.name === name).actionSequence[0].body;
    if (!body.some(item => item.name === 'Act_Ansage_Stop')) body.unshift(stop);
  }
  // Tastatur darf das Vorlesen abbrechen, ohne eine neue Karte zu ziehen.
  const keyboard = stage.tasks.find(item => item.name === 'Tastatur_Waehlen').actionSequence[0];
  if (!keyboard.condition.value.includes('reading')) keyboard.condition.value.push('reading');
  project.meta.description = 'Karteikasten-Quiz mit serverseitigem Vorlesen, lokaler Spracheingabe oder Tastatur. Mikrofon erst nach der Frage; falsche Lösungen mindestens zwei Sekunden und bis zum Ende der Ansage.';
  if(project.meta?.cardLearningPoints)require('./cms-quiz-points.cjs').configureQuizPoints(project);
  return project;
}
module.exports = { configureQuizTts };

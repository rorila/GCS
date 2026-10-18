// Strukturtest für Kopfrechnen-App.json (Generator: scripts/cms/cms-add-kopfrechen-app.cjs)
// Prüft Referenzen, Karteikasten-Verdrahtung (cardNext/cardAnswer/end),
// Distraktor-Berechnung und den Leitner-Flow. Aufruf: node scripts/test-kopfrechen-app.cjs
const project = require('../game-server/public/projects/Kopfrechnen-App.json');

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) pass++; else { fail++; console.log('  ✗', name); } };
const section = t => console.log('\n== ' + t);

const stage = project.stages[0];
const flat = seq => (seq || []).flatMap(i => [i, ...(i.body ? flat(i.body) : []), ...(i.elseBody ? flat(i.elseBody) : [])]);
const taskByName = Object.fromEntries(stage.tasks.map(t => [t.name, t]));
const actionByName = Object.fromEntries(stage.actions.map(a => [a.name, a]));
const taskItems = n => flat(taskByName[n]?.actionSequence);

section('Struktur');
const names = new Set(), dup = [];
for (const o of stage.objects) { const k = 'o:' + o.name; if (names.has(k)) dup.push(o.name); names.add(k); }
for (const a of stage.actions) { const k = 'a:' + a.name; if (names.has(k)) dup.push(a.name); names.add(k); }
for (const t of stage.tasks) { const k = 't:' + t.name; if (names.has(k)) dup.push(t.name); names.add(k); }
ok(dup.length === 0, 'keine doppelten Objekt-/Action-/Task-Namen (' + dup.join(', ') + ')');
const missing = [];
const chk = (seq, w) => { for (const i of seq || []) {
  if (i.type === 'action' && !names.has('a:' + i.name)) missing.push(i.name + ' @' + w);
  if (i.type === 'task' && !names.has('t:' + i.name)) missing.push('task ' + i.name + ' @' + w);
  chk(i.body, w); chk(i.elseBody, w);
} };
for (const t of stage.tasks) chk(t.actionSequence, t.name);
for (const o of stage.objects) for (const ev of Object.values(o.events || {})) if (!taskByName[ev]) missing.push('event ' + ev + ' @' + o.name);
ok(missing.length === 0, 'alle Action-/Task-/Event-Referenzen vorhanden (' + missing.join(', ') + ')');

section('Oberfläche');
const btns = stage.objects.filter(o => o.className === 'TButton');
const antworten = btns.filter(b => b.name.startsWith('BtnAntwort'));
ok(antworten.length === 3 && antworten.every(b => b.events?.onClick === 'Antwort_Gewaehlt' && 'matchValue' in b), '3 Antwort-Buttons mit matchValue → Antwort_Gewaehlt');
ok(btns.find(b => b.name === 'Naechste')?.events?.onClick === 'Aufgabe_Ziehen', 'Naechste-Button → Aufgabe_Ziehen');
ok(btns.find(b => b.name === 'Beenden')?.events?.onClick === 'App_Beenden', 'Beenden-Button → App_Beenden');
const initTimer = stage.objects.find(o => o.className === 'TTimer');
ok(initTimer?.events?.onTimer === 'App_Start' && initTimer.maxInterval === 1, 'Init-Timer feuert einmalig → App_Start');
ok(['FrageLabel', 'FachLabel', 'FortschrittLabel', 'ZaehlerLabel', 'LoesungLabel', 'StatusLabel'].every(n => stage.objects.some(o => o.name === n)), 'alle Anzeige-Labels vorhanden');

section('Karteikasten-Verdrahtung');
const httpActions = stage.actions.filter(a => a.type === 'http' && a.url === '/api/cms/play');
ok(httpActions.filter(a => a.body?.includes('cardNext')).length === 1, 'genau ein cardNext-Aufruf');
const next = httpActions.find(a => a.body?.includes('cardNext'));
ok(next.body.includes('"subject":"${KartenFach}"') && next.body.includes('"topic":"${KartenThema}"'), 'cardNext nutzt KartenFach/KartenThema');
ok(next.body.includes('"formats":["text"]') && !next.body.includes('self'), 'nur text-Format (keine Selbstbewertung)');
ok(next.body.includes('"excludeIds":"${GezogeneIds}"'), 'cardNext schließt gezogene Karten aus');
const answers = httpActions.filter(a => a.body?.includes('cardAnswer'));
ok(answers.length === 2 && answers.some(a => a.body.includes('"correct":true')) && answers.some(a => a.body.includes('"correct":false')), 'cardAnswer für richtig und falsch');
ok(answers.every(a => a.body.includes('"cardId":"${AktuelleKarte.id}"') && a.body.includes('"launchKey":"${CMS_LAUNCH}"')), 'cardAnswer bucht auf AktuelleKarte.id + Launch-Key');
const endCalls = httpActions.filter(a => a.body?.includes('"end"'));
ok(endCalls.length === 2, 'Sitzungsende in Abschluss und App_Beenden');
ok(stage.actions.some(a => a.type === 'close_overlay' && a.result?.includes('richtig')), 'close_overlay meldet Ergebnis ans Hauptspiel');

section('Distraktor-Logik');
ok(actionByName.Act_Ergebnis?.formula === 'parseInt(AktuelleKarte.answers[0])', 'Ergebnis aus answers[0] geparst');
ok(actionByName.Act_Distraktor1?.formula === 'Ergebnis + 1', 'Distraktor 1 = Ergebnis + 1');
ok(actionByName.Act_Distraktor2?.formula === 'Ergebnis > 1 ? Ergebnis - 1 : Ergebnis + 2', 'Distraktor 2 = Ergebnis − 1 (keine 0/negativ)');
ok(actionByName.Act_Position?.formula === 'Math.floor(Math.random() * 3) + 1', 'Position zufällig 1–3');
for (const v of ['A', 'B', 'C']) {
  const ch = actionByName['Act_Variante' + v]?.changes || {};
  ok(Object.keys(ch).filter(k => k.endsWith('.matchValue')).length === 3, 'Variante ' + v + ' belegt alle 3 matchValues');
  ok(Object.values(ch).filter(val => val === '${Ergebnis}').length === 2, 'Variante ' + v + ' setzt Ergebnis genau einmal (text + matchValue)');
}

section('Leitner-Flow');
const gewaehlt = taskItems('Antwort_Gewaehlt');
ok(gewaehlt.some(i => i.condition?.variable === 'self.matchValue' && i.condition?.value === '${Ergebnis}' && i.condition?.rightType === 'variable'), 'Antwort_Gewaehlt vergleicht matchValue mit Ergebnis');
ok(gewaehlt.some(i => i.condition?.variable === 'Busy'), 'Busy-Guard gegen Doppelklick');
ok(taskItems('Bewerten_Richtig').some(i => i.type === 'task' && i.name === 'Aufgabe_Ziehen'), 'Richtig → automatisch nächste Aufgabe');
ok(taskItems('Bewerten_Falsch').some(i => i.type === 'action' && i.name === 'Act_BewertetF') && actionByName.Act_BewertetF?.changes?.['LoesungLabel.text'], 'Falsch → Lösung wird gezeigt');
ok(actionByName.Act_BewertetF?.changes?.['Naechste.visible'] === true, 'Falsch → Naechste-Button');
const ziehen = taskItems('Aufgabe_Ziehen');
ok(ziehen.some(i => i.condition?.variable === 'AufgabenNr' && i.condition?.operator === '>='), 'Rundenlimit prüft vor dem Ziehen');
ok(ziehen.some(i => i.condition?.variable === 'KartenAntwort.card' && i.condition?.operator === 'truthy'), 'keine Karte mehr → Abschluss');
ok(['Act_BewertetR', 'Act_BewertetF'].every(n => actionByName[n]?.changes?.GezogeneIds?.includes('${AktuelleKarte.id}')), 'beide Bewertungen pflegen GezogeneIds');
ok(stage.objects.every(o => !o.isVariable), 'keine Variablen-Duplikate in stage.objects (Konvention: stage.variables)');
ok(stage.variables.some(v => v.name === 'CMS_LAUNCH') && stage.variables.some(v => v.name === 'AktuelleKarte'), 'CMS_LAUNCH + AktuelleKarte als Variablen');

console.log('\nErgebnis:', pass, 'bestanden,', fail, 'fehlgeschlagen.');
process.exit(fail ? 1 : 0);

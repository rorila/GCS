// Ergänzt stage_gallery (Editor-Stage — gezielt, idempotent, kein Rebuild):
//   Button „⏹ Laufendes Spiel beenden" (versteckt) + Task „Sitzung_Beenden"
//   → POST /api/cms/session-stop; plus der fehlende Task „Fehler", den
//   SpielStarten bereits referenziert: zeigt Antwort.message und blendet bei
//   conflict:true den Beenden-Button ein.
// Aufruf: node scripts/cms/cms-patch-gallery-session-stop.cjs
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const file = path.join(__dirname, '../../game-server/public/projects/GCS-CMS.json');
const project = JSON.parse(fs.readFileSync(file, 'utf8'));
const stage = project.stages.find(s => s.id === 'stage_gallery');
if (!stage) { console.error('stage_gallery fehlt'); process.exit(1); }

const uid = p => p + '-' + crypto.randomUUID();
const has = (list, name) => list.some(x => x.name === name);
let added = [];

// Objekt: Beenden-Button (zunächst versteckt)
if (!has(stage.objects, 'SitzungBeenden')) {
  stage.objects.push({
    className: 'TButton', id: uid('gallery_btn'), name: 'SitzungBeenden', scope: 'stage',
    draggable: false, droppable: false, dragMode: 'move',
    events: { onClick: 'Sitzung_Beenden' },
    visible: false, x: 18, y: 10, width: 24, height: 3, zIndex: 5, rotation: 0, align: 'NONE', collisionEnabled: false,
    style: { color: '#ffffff', fontSize: 18, fontWeight: '600', textAlign: 'center', backgroundColor: '#b3543f', borderColor: '#8f4130', borderWidth: 0, borderRadius: 9, boxShadow: '0 4px 6px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08)' },
    text: '⏹ Laufendes Spiel beenden', icon: ''
  });
  added.push('Objekt SitzungBeenden');
}

// Actions
const act = (name, def) => { if (!has(stage.actions, name)) { stage.actions.push({ id: uid('gallery_act'), scope: 'stage', ...def, name }); added.push('Action ' + name); } };
act('Act_StartFehler_Anzeigen', { type: 'property', changes: { Busy: 0, 'Hinweis.text': '${Antwort.message}' } });
act('Act_Beenden_Anzeigen', { type: 'property', changes: { 'SitzungBeenden.visible': true } });
act('Act_Sitzung_Stoppen', { type: 'http', url: '/api/cms/session-stop', method: 'POST', body: '{"token":"${Token}"}', resultVariable: 'StopAntwort', queryOperator: '==' });
act('Act_Gestoppt', { type: 'property', changes: { Busy: 0, 'Hinweis.text': 'Spiel beendet. Wähle es erneut zum Starten.', 'SitzungBeenden.visible': false } });
act('Act_StopFehler', { type: 'property', changes: { Busy: 0, 'Hinweis.text': '${StopAntwort.message}' } });

// Tasks
if (!has(stage.tasks, 'Fehler')) {
  stage.tasks.push({
    id: uid('gallery_task'), name: 'Fehler', description: 'Start-Fehler anzeigen; bei laufender Sitzung den Beenden-Button einblenden', scope: 'stage', triggerMode: 'local-sync', params: [],
    actionSequence: [
      { type: 'action', name: 'Act_StartFehler_Anzeigen' },
      { type: 'condition', name: 'Konflikt?', condition: { variable: 'Antwort.conflict', operator: '==', value: true }, then: [{ type: 'action', name: 'Act_Beenden_Anzeigen' }], else: [] },
    ],
  });
  added.push('Task Fehler');
}
if (!has(stage.tasks, 'Sitzung_Beenden')) {
  stage.tasks.push({
    id: uid('gallery_task'), name: 'Sitzung_Beenden', description: 'Eigene laufende Spielsitzung über /api/cms/session-stop beenden', scope: 'stage', triggerMode: 'local-sync', params: [],
    actionSequence: [
      { type: 'action', name: 'Act_Sitzung_Stoppen' },
      { type: 'condition', name: 'Beendet?', condition: { variable: 'StopAntwort.ok', operator: '==', value: true }, then: [{ type: 'action', name: 'Act_Gestoppt' }], else: [{ type: 'action', name: 'Act_StopFehler' }] },
    ],
  });
  added.push('Task Sitzung_Beenden');
}

// Referenzprüfung nur für die neu ergänzten Teile (die Stage enthält
// bereits bestehende, vom Editor erzeugte tote Referenzen — nur melden).
const names = new Set([...stage.objects, ...stage.actions, ...stage.tasks].map(x => x.name));
let missing = 0;
const walk = (seq, w) => (seq || []).forEach(i => {
  if ((i.type === 'action' || i.type === 'task') && !names.has(i.name)) { console.error('fehlt: ' + i.name + ' @' + w); missing++; }
  walk(i.then, w); walk(i.else, w); walk(i.body, w); walk(i.elseBody, w);
});
for (const t of stage.tasks.filter(t => ['Fehler', 'Sitzung_Beenden'].includes(t.name))) walk(t.actionSequence, t.name);
const btn = stage.objects.find(o => o.name === 'SitzungBeenden');
if (btn?.events?.onClick && !names.has(btn.events.onClick)) { console.error('Event-Task fehlt: ' + btn.events.onClick); missing++; }
if (missing) { console.error(missing + ' fehlende Referenzen in den neuen Teilen — Abbruch.'); process.exit(1); }

fs.writeFileSync(file, JSON.stringify(project, null, 1));
console.log(added.length ? 'stage_gallery ergänzt: ' + added.join(', ') : 'stage_gallery bereits vollständig');

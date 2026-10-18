const { randomUUID } = require('node:crypto');
const { bindActions } = require('./cms-ui-integrity.cjs');
const clone = value => structuredClone(value);
const action = name => ({ type: 'action', name });
const call = name => ({ type: 'task', name });
const task = (name, actionSequence) => ({ id: 'task-' + randomUUID(), name, scope: 'stage', triggerMode: 'local-sync', params: [], actionSequence });
const condition = (variable, value, then, otherwise = []) => ({ type: 'condition', condition: { variable, operator: '==', value }, then, else: otherwise });

function pruneActions(stage) {
  const used = new Set();
  const walk = steps => { for (const step of steps || []) {
    if (step.type === 'action') used.add(step.name);
    for (const key of ['then', 'else', 'body', 'elseBody']) walk(step[key]);
  } };
  stage.tasks.forEach(t => walk(t.actionSequence));
  stage.actions = stage.actions.filter(a => used.has(a.name));
}

function layout(overview, details) {
  const table = overview.objects.find(o => o.name === 'KinderTabelle');
  table.columns = table.columns.filter(c => ['avatarImage', 'name'].includes(c.field));
  table.columns.find(c => c.field === 'name').width = 8;
  table.cardConfig = { width: 240, height: 100, gap: 14 };
  ['NavAktivitaet', 'NavRaeume', 'NavBudget', 'KindKarteikasten', 'KartenstapelVerwalten', 'NavSponsoren', 'KindExport', 'KindLoeschen'].forEach((name, i) => {
    const o = details.objects.find(o => o.name === name);
    if (o) Object.assign(o, { x: 36, y: 9 + i * 3.35, width: 24, height: 2.8 });
  });
  const reset = details.actions.find(a => a.name === 'Act_KindDetail_Reset');
  reset.changes.CMSKindName = '';
  details.actions.find(a => a.name === 'Act_KindDetail_Zeigen').changes.CMSKindName = '${KindAntwort.name}';
  const init = details.tasks.find(t => t.name === 'KindDetailInit');
  if (!details.actions.some(a => a.name === 'Act_KindBudget_Offen')) {
    const D = bindActions(details);
    init.actionSequence.push(condition('KindAntwort.ok', true, [condition('KindAntwort.budgetMinutes', null, [
      D.prop('Act_KindBudget_Offen', { 'KindBudget.text': 'Tagesbudget: nicht festgelegt' }),
    ])]));
  }
}

function apply(project) {
  const overview = project.stages.find(s => s.id === 'stage_parent');
  if (!overview) return;
  const existing = project.stages.find(s => s.id === 'stage_parent_child');
  if (existing && !overview.objects.some(o => o.name === 'NavAktivitaet')) { layout(overview, existing); return; }
  const details = clone(overview);
  details.id = 'stage_parent_child';
  details.name = 'Eltern · Kind: Daten & Aufgaben';
  details.group = 'Eltern & Beobachtung';
  details.flowCharts = {}; details.features = [];
  const listTasks = new Set(['Kinder_Laden', 'Kinder_Anzeigen', 'Kinder_Fehler', 'Sperre_KinderLaden', 'Kind_Auswaehlen', 'ElternInit']);
  const listObjects = new Set(['Kinder', 'KinderTabelle', 'NeuLaden']);
  details.objects = details.objects.filter(o => !listObjects.has(o.name) && o.className !== 'TPanel');
  for (const item of [...details.objects, ...details.variables, ...details.actions, ...details.tasks]) item.id = 'child-' + randomUUID();
  // References to old object IDs must resolve within the cloned stage.
  for (const a of details.actions) if (a.target_ref) {
    const target = details.objects.find(o => o.name === a.target);
    if (target) a.target_ref = target.id; else delete a.target_ref;
  }
  details.tasks = details.tasks.filter(t => !listTasks.has(t.name));
  details.variables = details.variables.filter(v => !['KinderAntwort', 'KinderGueltig'].includes(v.name));
  const D = bindActions(details);
  const labelTemplate = details.objects.find(o => o.name === 'Titel');
  const label = (name, text, x, y, width, height, size = 17) => ({ ...clone(labelTemplate), id: 'child-' + randomUUID(), name, text, x, y, width, height, style: { ...labelTemplate.style, fontSize: size } });
  details.objects.find(o => o.name === 'Titel').text = 'DATEN & AUFGABEN';
  details.objects.push(
    { ...label('KindBild', '', 4, 8, 6, 6), className: 'TImage', src: '/images/default-avatar.svg' },
    label('KindName', '', 12, 8, 20, 3, 24),
    label('KindSpiel', '', 4, 15, 28, 2),
    label('KindHeute', '', 4, 17, 28, 2),
    label('KindBudget', '', 4, 19, 28, 2),
    { ...clone(details.objects.find(o => o.className === 'TButton')), id: 'child-' + randomUUID(), name: 'ZurKinderliste', text: '← Meine Kinder', x: 45, y: 1, width: 15, height: 2.5, visible: true, events: { onClick: 'ZurKinderliste' } },
  );
  // Keep confirmation controls below the summary.
  for (const name of ['LoeschenFrage', 'LoeschenJa', 'LoeschenNein']) details.objects.find(o => o.name === name).y = 22;
  const timer = details.objects.find(o => o.name === 'InitialLaden');
  timer.events.onTimer = 'KindDetailInit';
  details.variables.push({ ...clone(details.variables.find(v => v.className === 'TObjectVariable')), id: 'child-' + randomUUID(), name: 'KindAntwort', value: null, defaultValue: null });
  const buttons = ['NavAktivitaet', 'NavRaeume', 'NavBudget', 'KindKarteikasten', 'KartenstapelVerwalten', 'KindExport', 'KindLoeschen', 'NavSponsoren'];
  for (const name of buttons) { const o = details.objects.find(o => o.name === name); if (o) o.visible = false; }
  const visibility = visible => Object.fromEntries(buttons.filter(n => details.objects.some(o => o.name === n)).map(n => [n + '.visible', visible]));
  details.tasks.push(task('ZurKinderliste', [D.nav('Act_ZurKinderliste', 'stage_parent')]),
    task('KindDetailInit', [
      D.prop('Act_KindDetail_KontextLeeren', { CMSKindName: '' }),
      D.prop('Act_KindDetail_Reset', { Busy: 1, Kind: '${CMSKindId}', ...visibility(false), 'KindName.text': '', 'KindSpiel.text': '', 'KindHeute.text': '', 'KindBudget.text': '', 'KindBild.src': '/images/default-avatar.svg', 'ExportAnzeige.visible': false, 'LoeschenFrage.visible': false, 'LoeschenJa.visible': false, 'LoeschenNein.visible': false, 'Status.text': 'Kind wird geladen …' }),
      D.http('Act_KindDetail_Laden', '/api/cms/parent/child-activity', { childId: '${CMSKindId}' }, 'KindAntwort'),
      condition('KindAntwort.ok', true, [D.prop('Act_KindDetail_Zeigen', { Busy: 0, ...visibility(true), 'KindName.text': '${KindAntwort.name}', 'KindBild.src': '${KindAntwort.avatarImage}', 'KindSpiel.text': 'Aktuelles Spiel: ${KindAntwort.spiel}', 'KindHeute.text': 'Heute gespielt: ${KindAntwort.todayMinutes} Minuten', 'KindBudget.text': 'Tagesbudget: ${KindAntwort.budgetMinutes} Minuten', 'Status.text': '' })],
        [D.prop('Act_KindDetail_Fehler', { Busy: 0, 'Status.text': '${KindAntwort.message}' })]),
      call('Kontexte_Pruefen'),
    ]));
  details.actions.find(a => a.name === 'Act_KindDetail_Zeigen').changes.CMSKindName = '${KindAntwort.name}';
  // A deleted child cannot remain selected; return to the refreshed overview.
  const replaceReload = steps => { for (const step of steps || []) {
    if (step.type === 'task' && step.name === 'Sperre_KinderLaden') Object.assign(step, call('ZurKinderliste'));
    for (const key of ['then', 'else', 'body', 'elseBody']) replaceReload(step[key]);
  } };
  details.tasks.forEach(t => replaceReload(t.actionSequence));
  pruneActions(details);

  overview.objects = overview.objects.filter(o => ['Titel', 'Status', 'NeuLaden', 'Kinder', 'KinderTabelle', 'InitialLaden'].includes(o.name));
  overview.objects.find(o => o.name === 'KinderTabelle').width = 56;
  overview.objects.find(o => o.name === 'KinderTabelle').height = 30;
  overview.objects.find(o => o.name === 'NeuLaden').x = 46;
  overview.tasks = overview.tasks.filter(t => listTasks.has(t.name));
  overview.variables = overview.variables.filter(v => ['Kind', 'KinderAntwort', 'KinderGueltig', 'Busy'].includes(v.name));
  overview.tasks.find(t => t.name === 'ElternInit').actionSequence = [call('Sperre_KinderLaden')];
  const O = bindActions(overview);
  overview.actions = overview.actions.filter(a => a.name !== 'Act_Kind_Uebernehmen');
  overview.tasks.find(t => t.name === 'Kind_Auswaehlen').actionSequence = [condition('Busy', 0, [
    O.prop('Act_Kind_Uebernehmen', { CMSKindId: '${KinderTabelle.selectedKey}', Kind: '${KinderTabelle.selectedKey}' }),
    O.nav('Act_Kind_Details_Oeffnen', details.id),
  ])];
  pruneActions(overview);
  overview.flowCharts = {}; overview.features = [];
  project.stages = project.stages.filter(s => s.id !== details.id);
  project.stages.splice(project.stages.indexOf(overview) + 1, 0, details);
  layout(overview, details);
  for (const s of project.stages) {
    if (['stage_child_activity', 'stage_child_rooms', 'stage_child_budget', 'stage_child_cards'].includes(s.id)) {
      for (const a of s.actions || []) if (a.type === 'navigate_stage' && a.stageId === 'stage_parent') a.stageId = details.id;
    }
    if (s.id === 'stage_decks') for (const a of s.actions || []) if (a.name === 'Act_Nav_ZurEltern') a.stageId = details.id;
  }
}
module.exports = { apply };
if (require.main === module) {
  const fs = require('node:fs'), path = require('node:path');
  const file = path.join(__dirname, '../../game-server/public/projects/GCS-CMS.json');
  const project = JSON.parse(fs.readFileSync(file, 'utf8'));
  apply(project);
  fs.writeFileSync(file, JSON.stringify(project, null, 2) + '\n');
}

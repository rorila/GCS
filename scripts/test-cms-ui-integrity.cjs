const assert = require('node:assert/strict');
const { test } = require('node:test');
const { checkIntegrity } = require('./cms/cms-project.cjs');
const { applyCmsTheme } = require('./cms/cms-style.cjs');
const project = require('../game-server/public/projects/GCS-CMS.json');
const { bindActions, panelName, cleanRetiredProperties, repairUiIntegrity } = require('./cms/cms-ui-integrity.cjs');

test('Bereinigung bewahrt Layout, IDs, Editorverknuepfungen und fremde Inhalte', () => {
  const action = { id: 'a1', name: 'Nav', type: 'navigate_stage', stageId: 'stage_main' };
  const panels = [{ id: 'p1', name: 'Panel', className: 'TPanel', x: 3, y: 8, width: 12, height: 5, style: { color: 'red' } },
    { id: 'p2', name: 'Panel', className: 'TPanel', parentId: 'p1' }];
  const fixture = { stages: [{ id: 'stage_main', objects: structuredClone(panels),
    actions: [action, { ...action, id: 'a2' }, { id: 'editor', name: 'EditorAction', type: 'property', changes: { Custom: 1 } }],
    tasks: [{ name: 'Start', actionSequence: [{ type: 'action', name: 'Nav' }] }],
    flowCharts: { Start: { nodes: [{ id: 'node', data: { actionId: 'a2' } }], connections: [{ startTargetId: 'node', endTargetId: 'a2' }] } },
  }] };
  assert.deepEqual(repairUiIntegrity(fixture), { actions: 1, panels: 2, properties: 0 });
  const stage = fixture.stages[0];
  assert.equal(stage.actions[0].id, 'a1');
  assert.equal(stage.actions[1].id, 'editor');
  assert.equal(stage.flowCharts.Start.nodes[0].data.actionId, 'a1');
  assert.equal(stage.flowCharts.Start.connections[0].startTargetId, 'node');
  assert.equal(stage.flowCharts.Start.connections[0].endTargetId, 'a1');
  assert.deepEqual(stage.objects.map(({ name, ...o }) => o), panels.map(({ name, ...o }) => o));
  assert.deepEqual(stage.tasks[0].actionSequence, [{ type: 'action', name: 'Nav' }]);
  const once = JSON.stringify(fixture);
  assert.deepEqual(repairUiIntegrity(fixture), { actions: 0, panels: 0, properties: 0 });
  assert.equal(JSON.stringify(fixture), once);
});

test('Widerspruechliche Duplikate werden ohne Aenderung abgewiesen', () => {
  const fixture = { stages: [{ id: 'stage_main', actions: [
    { id: 'a1', name: 'Nav', type: 'navigate_stage', stageId: 'one' },
    { id: 'a2', name: 'Nav', type: 'navigate_stage', stageId: 'two' },
  ] }] };
  const before = JSON.stringify(fixture);
  assert.throws(() => repairUiIntegrity(fixture), /Widerspruechliche/);
  assert.equal(JSON.stringify(fixture), before);
});

test('Generator-Registrierung ist idempotent und behaelt bestehende IDs', () => {
  const stage = { id: 'stage_test', actions: [] };
  const bind = bindActions(stage);
  for (let i = 0; i < 2; i++) {
    bind.prop('Show', { 'Status.visible': true });
    bind.nav('Nav', 'stage_main');
    bind.http('Load', '/api/cms/contexts', {});
    bind.call('Call', 'Service', 'run', [], 'Result');
  }
  assert.equal(stage.actions.length, 4);
  const before = JSON.stringify(stage);
  bind.nav('Nav', 'stage_main');
  assert.equal(JSON.stringify(stage), before);
  assert.throws(() => bind.nav('Nav', 'stage_other'), /Abweichende Action/);
  assert.equal(JSON.stringify(stage), before);
});

test('Bereinigung entfernt nur bekannte veraltete Property-Ziele', () => {
  const fixture = { stages: [{ id: 'stage_admin', objects: [{ name: 'Code' }], actions: [
    { name: 'Act_Kontextnavigation_einblenden', type: 'property', changes: { 'CodeInfo.visible': true, 'Code.visible': true, 'EditorControl.visible': true } },
    { name: 'EditorAction', type: 'property', changes: { 'CodeInfo.visible': true } },
  ] }] };
  assert.equal(cleanRetiredProperties(fixture), 1);
  assert.deepEqual(fixture.stages[0].actions[0].changes, { 'Code.visible': true, 'EditorControl.visible': true });
  assert.deepEqual(fixture.stages[0].actions[1].changes, { 'CodeInfo.visible': true });
});

test('Panelnamen kollidieren weder mit Editorobjekten noch mit Blueprintnamen', () => {
  const names = new Set(['Panel_stage_test_1']);
  assert.equal(panelName('stage_test', names), 'Panel_stage_test_2');
  assert.equal(panelName('stage_test', names), 'Panel_stage_test_3');
  assert.notEqual(panelName('stage_blueprint', new Set()), panelName('stage_test', new Set()));
});

function generateInMemory(filename, input) {
  const fs = require('node:fs');
  const path = require('node:path');
  const { createRequire } = require('node:module');
  const vm = require('node:vm');
  const file = path.join(__dirname, 'cms', filename);
  const target = path.resolve(__dirname, '../game-server/public/projects/GCS-CMS.json');
  const files = new Map([[target, JSON.stringify(input)]]);
  const localRequire = createRequire(file);
  const memoryFs = {
    readFileSync: name => { assert.ok(files.has(name), name); return files.get(name); },
    writeFileSync: (name, data) => { assert.ok(name === target || name === target + '.tmp'); files.set(name, data); },
    renameSync: (from, to) => { assert.equal(from, target + '.tmp'); assert.equal(to, target); files.set(to, files.get(from)); },
  };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), {
    require: name => name === 'node:fs' ? memoryFs : localRequire(name),
    __dirname: path.dirname(file), console: { log() {}, warn() {}, error() {} },
    process: { exit: code => { throw new Error('Generator exit ' + code); } },
  }, { filename: file, timeout: 10000 });
  return JSON.parse(files.get(target));
}

test('Deck-Generator erzeugt auch nach zwei Laeufen keine doppelten Actions', () => {
  let generated = structuredClone(project);
  for (let i = 0; i < 2; i++) {
    generated = generateInMemory('cms-add-deck-stages.cjs', generated);
    assert.deepEqual(checkIntegrity(generated), []);
  }
});

test('Eltern-Generator erzeugt auch nach zwei Laeufen keine doppelten Actions', () => {
  let generated = structuredClone(project);
  for (let i = 0; i < 2; i++) {
    generated = generateInMemory('cms-add-parent-stages.cjs', generated);
    for (const stage of generated.stages) {
      const names = (stage.actions || []).map(a => a.name);
      assert.equal(new Set(names).size, names.length, stage.id);
    }
    assert.equal(checkIntegrity(generated).filter(i => i.message.includes('Property-Ziel fehlt')).length, 0);
  }
});

test('CMS-Master hat weder Integritaetsfehler noch Warnungen', () => {
  assert.deepEqual(checkIntegrity(project), []);
});

test('Theme erzeugt eindeutige Panelnamen auch bei Wiederholung', () => {
  const stage = { id: 'stage_test', grid: { rows: 40 }, objects: [
    { id: 'label1', name: 'Titel', className: 'TLabel', y: 2, height: 2 },
    { id: 'label2', name: 'Status', className: 'TLabel', y: 20, height: 2 },
  ] };
  const fixture = { stages: [stage] };
  for (let i = 0; i < 2; i++) {
    applyCmsTheme(fixture);
    const panels = stage.objects.filter(o => o.cmsChrome);
    assert.equal(panels.length, 2);
    assert.equal(new Set(stage.objects.map(o => o.name)).size, stage.objects.length);
  }
});

test('Galerie-Tasks sind im Blueprint definiert und vollstaendig verdrahtet', () => {
  const blueprint = project.stages.find(s => s.type === 'blueprint');
  const gallery = project.stages.find(s => s.id === 'stage_gallery');
  const tasks = new Map([...blueprint.tasks, ...gallery.tasks].map(t => [t.name, t]));
  const actions = new Set([...blueprint.actions, ...gallery.actions].map(a => a.name));
  const visited = new Set();
  const walk = steps => {
    for (const step of steps || []) {
      if (step.type === 'action') assert.ok(actions.has(step.name), step.name);
      if (step.type === 'task' && !visited.has(step.name)) {
        assert.ok(tasks.has(step.name), step.name);
        visited.add(step.name);
        walk(tasks.get(step.name).actionSequence);
      }
      walk(step.then); walk(step.else); walk(step.body); walk(step.elseBody);
    }
  };
  for (const name of ['Profil_Anzeigen', 'Profil_Fehler', 'Sperre_AbmeldenTask']) {
    assert.ok(blueprint.tasks.some(t => t.name === name), name);
    walk(tasks.get(name).actionSequence);
  }
});

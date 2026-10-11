const fs = require('node:fs');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');
const { randomUUID } = require('node:crypto');

const actionContent = ({ id, ...definition }) => JSON.parse(JSON.stringify(definition));
const sameAction = (a, b) => isDeepStrictEqual(actionContent(a), actionContent(b));

function bindActions(stage) {
  const register = (name, definition) => {
    stage.actions ||= [];
    const action = { name, ...definition, scope: 'stage' };
    const existing = stage.actions.filter(a => a.name === name);
    if (existing.some(a => !sameAction(a, action))) {
      throw new Error(`Abweichende Action erhalten: ${stage.id}/${name}`);
    }
    if (!existing.length) stage.actions.push({ id: 'act-' + randomUUID(), ...action });
    return { type: 'action', name };
  };
  return {
    prop: (name, changes) => register(name, { type: 'property', changes }),
    http: (name, url, body, resultVariable = 'Antwort') => register(name, { type: 'http', url, method: 'POST', body, resultVariable, queryOperator: '==' }),
    call: (name, target, method, params = [], resultVariable) => register(name, { type: 'call_method', target, method, params, ...(resultVariable ? { resultVariable } : {}) }),
    nav: (name, stageId) => register(name, { type: 'navigate_stage', stageId, reset: false }),
  };
}

function panelName(stageId, names) {
  const prefix = 'Panel_' + stageId.replace(/[^a-zA-Z0-9_]/g, '_') + '_';
  let index = 1;
  while (names.has(prefix + index)) index++;
  const name = prefix + index;
  names.add(name);
  return name;
}

function remapIds(value, aliases) {
  if (!value || typeof value !== 'object') return;
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string' && aliases.has(entry)) value[key] = aliases.get(entry);
    else remapIds(entry, aliases);
  }
}

const retiredTargets = {
  stage_admin: { Act_Kontextnavigation_einblenden: ['CodeInfo', 'Person', 'Code', 'CodeSave'] },
  stage_house: {
    Act_Kinder_oeffnen: ['RaumInfo', 'RaumEingabe', 'RoomCreate', 'RoomSave', 'RoomToggle', 'PersonInfo', 'AvatarEingabe', 'PersonCreate'],
    Act_Eltern_oeffnen: ['RaumInfo', 'RaumEingabe', 'RoomCreate', 'RoomSave', 'RoomToggle', 'PersonInfo', 'AvatarEingabe', 'PersonCreate'],
  },
};

function cleanRetiredProperties(project) {
  let removed = 0;
  const names = new Set((project.stages || []).flatMap(s => s.objects || []).map(o => o.name));
  for (const stage of project.stages || []) {
    for (const action of stage.actions || []) {
      const retired = retiredTargets[stage.id]?.[action.name];
      if (!retired || action.type !== 'property') continue;
      for (const key of Object.keys(action.changes || {})) {
        const target = key.split('.')[0];
        if (key.includes('.') && retired.includes(target) && !names.has(target)) {
          delete action.changes[key];
          removed++;
        }
      }
    }
  }
  return removed;
}

function repairUiIntegrity(project) {
  const result = { actions: 0, panels: 0, properties: 0 };
  const aliases = new Map();
  const plans = [];
  for (const stage of project.stages || []) {
    if (stage.id?.startsWith('stage_server_')) continue;
    const seen = new Map();
    const actions = [];
    for (const action of stage.actions || []) {
      const existing = action.name && seen.get(action.name);
      if (!existing) {
        if (action.name) seen.set(action.name, action);
        actions.push(action);
      } else {
        if (!sameAction(existing, action)) throw new Error(`Widerspruechliche Actions: ${stage.id}/${action.name}`);
        if (action.id && action.id !== existing.id) {
          if (!existing.id) throw new Error(`Action ohne Ziel-ID: ${stage.id}/${action.name}`);
          aliases.set(action.id, existing.id);
        }
        result.actions++;
      }
    }
    plans.push({ stage, actions });
  }
  for (const { stage, actions } of plans) stage.actions = actions;
  remapIds(project, aliases);
  for (const stage of project.stages || []) {
    const names = new Set((stage.objects || []).map(o => o.name));
    for (const object of stage.objects || []) {
      if (object.className === 'TPanel' && object.name === 'Panel') {
        object.name = panelName(stage.id, names);
        result.panels++;
      }
    }
  }
  result.properties = cleanRetiredProperties(project);
  return result;
}

module.exports = { bindActions, panelName, cleanRetiredProperties, repairUiIntegrity };

if (require.main === module) {
  const file = path.join(__dirname, '../../game-server/public/projects/GCS-CMS.json');
  const raw = fs.readFileSync(file, 'utf8');
  const project = JSON.parse(raw);
  const result = repairUiIntegrity(project);
  const issues = require('./cms-project.cjs').checkIntegrity(project);
  if (issues.length) throw new Error(JSON.stringify(issues));
  const indent = raw.match(/\n([ \t]+)"/)?.[1] || ' ';
  const next = JSON.stringify(project, null, indent) + (raw.endsWith('\n') ? '\n' : '');
  if (next !== raw) fs.writeFileSync(file, next);
  console.log(JSON.stringify(result));
}

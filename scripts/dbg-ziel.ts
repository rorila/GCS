import * as fs from 'node:fs';
import * as path from 'node:path';
import { TObjectList } from '../src/components/TObjectList';
import { ActionExecutor } from '../src/runtime/ActionExecutor';
import { TaskExecutor } from '../src/runtime/TaskExecutor';
import { TaskConditionEvaluator } from '../src/runtime/executor/TaskConditionEvaluator';
const root = path.resolve(process.cwd());
const project = JSON.parse(fs.readFileSync(path.join(root, 'game-server/public/projects/Madn.json'), 'utf8'));
const stage = project.stages[0];
const objects: any[] = stage.objects.map((o: any) => {
    if (o.className === 'TObjectList') { const l = new TObjectList(o.name, o.x, o.y); Object.assign(l, o); l.ensureDefaults?.(); (l as any).rebuildData?.(); return l; }
    return { ...o, style: { ...(o.style || {}) } };
});
const ae = new ActionExecutor(objects);
const te = new TaskExecutor(project, stage.actions, ae, undefined, undefined, stage.tasks);
ae.setTaskExecutor(te);
const objectMap: Record<string, any> = {};
for (const o of objects) { if (o.id) objectMap[o.id] = o; if (o.name) objectMap[o.name] = o; }
const isVarLike = (o: any) => o && typeof o === 'object' && o.className !== 'TTimer' && o.className !== 'TIntervalTimer'
    && (o.isVariable === true || (o.className && (o.className.includes('Variable') || o.className === 'TStringMap' || o.className === 'TObjectList')));
const store: Record<string, any> = {};
const contextVars = new Proxy(store, {
    get: (t, p: string) => {
        const o = objectMap[p];
        if (isVarLike(o)) {
            if (o.sourceMode === 'records') return o.records || o.data;
            if (Array.isArray(o.items)) return o.items;
            if (Array.isArray(o.data)) return o.data;
            if (o.records) return o.records;
            if (o.entries !== undefined) return o.entries;
            return o.value;
        }
        if (o !== undefined) return o;
        return t[p];
    },
    set: (t, p: string, v: any) => {
        const o = objectMap[p];
        if (isVarLike(o)) { if (o.className === 'TObjectList' && Array.isArray(v)) o.items = v; else o.value = v; return true; }
        t[p] = v;
        return true;
    }
});
const keys = ['Var_PSlot', 'Var_PColor', 'Var_Eingang', 'Var_Dist', 'Var_ZielRing', 'Var_Gefunden', 'Var_GefundenFarbe', 'Var_Ziel', 'Var_ZielCapture', 'Var_WegFrei', 'Var_Gi', 'Var_GoalNeu', 'Var_GoalNeuSlot', 'Var_GIdx', 'Var_SlotZiel', 'Var_GVon'];
const prim = (v: any) => (v && typeof v === 'object' && 'value' in v) ? v.value : v;
const dump = () => keys.map(k => `${k.replace('Var_', '')}=${JSON.stringify(prim(contextVars[k]))}`).join(' ');
const newVars = () => Object.create(objectMap);
(async () => {
    const vars = newVars();
    const origEval = TaskConditionEvaluator.evaluateCondition.bind(TaskConditionEvaluator);
    (TaskConditionEvaluator as any).evaluateCondition = (cond: any, v: any, g: any) => {
        const r = origEval(cond, v, g);
        if (trace) {
            const l = cond?.leftValue ?? cond?.variable ?? cond;
            const op = cond?.operator ?? '==';
            const rr = cond?.rightValue ?? cond?.value ?? '';
            const lv = (TaskConditionEvaluator as any).resolveValue(l, v, g);
            const rv = (TaskConditionEvaluator as any).resolveValue(rr, v, g);
            console.log(`   ? ${JSON.stringify(l)}[=${JSON.stringify(lv)}] ${op} ${JSON.stringify(rr)}[=${JSON.stringify(rv)}] => ${r}`);
        }
        return r;
    };
    const origExec = ae.execute.bind(ae);
    let trace = false;
    (ae as any).execute = async (action: any, ...rest: any[]) => {
        if (trace) console.log('   >', action?.name || action?.type);
        return origExec(action, ...rest);
    };
    for (const [slot, wurf] of [[56, 5], [56, 6], [0, 3], [40, 2], [41, 3], [36, 4]]) {
        contextVars['Var_PSlot'] = slot; contextVars['Var_PColor'] = 0; contextVars['Var_Wurf'] = wurf; contextVars['Var_Ziel'] = -99;
        if (slot === 56 && wurf === 6) {
            console.log('   SET-CHECK obj.value =', objectMap['Var_Wurf']?.value,
                '| contextVars =', contextVars['Var_Wurf'],
                '| vars own?', Object.prototype.hasOwnProperty.call(vars, 'Var_Wurf'), vars['Var_Wurf']);
        }
        trace = (slot === 40 && wurf === 2) || (slot === 36 && wurf === 4);
        await te.execute('ZielPruefen', vars, contextVars, null, 0);
        trace = false;
        console.log(`slot=${slot} wurf=${wurf} | ${dump()}`);
    }
})();

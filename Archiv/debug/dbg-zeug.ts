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
        if (isVarLike(o)) { if (o.sourceMode === 'records') return o.records || o.data; if (Array.isArray(o.items)) return o.items; if (Array.isArray(o.data)) return o.data; if (o.records) return o.records; if (o.entries !== undefined) return o.entries; return o.value; }
        if (o !== undefined) return o;
        return t[p];
    },
    set: (t, p: string, v: any) => { const o = objectMap[p]; if (isVarLike(o)) { if (o.className === 'TObjectList' && Array.isArray(v)) o.items = v; else o.value = v; return true; } t[p] = v; return true; }
});
const vars = Object.create(objectMap);
let trace = false;
const origExec = ae.execute.bind(ae);
(ae as any).execute = async (a: any, ...r: any[]) => { if (trace) console.log('   >', a?.name || a?.type, a?.type==='record_get'?`field=${a.field} idx=${a.index} -> ${a.resultVariable}`:''); return origExec(a, ...r); };
const origEval = TaskConditionEvaluator.evaluateCondition.bind(TaskConditionEvaluator);
(TaskConditionEvaluator as any).evaluateCondition = (c: any, v: any, g: any) => {
    const r = origEval(c, v, g);
    if (trace) { const l = c?.leftValue ?? c?.variable ?? c; const rv = c?.rightValue ?? c?.value ?? '';
        const lvr=(TaskConditionEvaluator as any).resolveValue(l,v,g); const rvr=(TaskConditionEvaluator as any).resolveValue(rv,v,g);
        console.log(`   ? ${JSON.stringify(l)}[=${JSON.stringify(lvr)}] ${c?.operator ?? '=='} ${JSON.stringify(rv)}[=${JSON.stringify(rvr)}] => ${r}`); }
    return r;
};
(async () => {
    const setVar = (k: string, v: any) => { contextVars[k] = v; delete vars[k]; };
    await te.execute('Anzahl2', vars, contextVars, null, 0);
    const fl: any = objectMap['FigurenListe'];
    console.log('items:', JSON.stringify(fl.items?.slice(0,3)), 'len', fl.items?.length, 'data len', fl.data?.length, 'rec0:', JSON.stringify(fl.recordData?.[fl.items?.[0]]));
    setVar('Var_Wurf', 6); setVar('Var_CurrPlayer', 1);
    trace = true;
    await te.execute('ZuegeErmitteln', vars, contextVars, null, 0);
    trace = false;
    console.log('Moveable =', contextVars['Var_Moveable']);
    // Klick auf Figur_4 (blau, moveable) -> sollte auf Ring-Startfeld 10 landen
    const f4 = objectMap['Figur_4'];
    vars.self = f4; vars.sender = f4;
    setVar('Var_Phase', 'pick');
    trace = true;
    await te.execute('FigurGewaehlt', vars, contextVars, f4, 0);
    trace = false;
    const fl2: any = objectMap['FigurenListe'];
    const r4 = fl2.recordData[fl2.items[4]];
    console.log('Figur_4 record:', JSON.stringify(r4));
    console.log('Figur_4 pos:', f4.x, f4.y, 'visible:', f4.visible);
    console.log('Phase:', contextVars['Var_Phase'], '| Status:', objectMap['StatusLabel']?.text);
})();

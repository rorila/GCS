import * as fs from 'node:fs';
import * as path from 'node:path';
import { TObjectList } from '../src/components/TObjectList';
import { ActionExecutor } from '../src/runtime/ActionExecutor';
import { TaskExecutor } from '../src/runtime/TaskExecutor';
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
const newEventVars = (ctxObj: any, data: any = {}) => {
    const ev = Object.create(objectMap);
    Object.assign(ev, data);
    ev.eventData = data; ev.sender = ctxObj; ev.$event = data; ev.self = ctxObj;
    return ev;
};
(async () => {
    const btn2 = objectMap['Btn2'];
    const wbtn = objectMap['WuerfelnBtn'];
    console.log('--- Klick Btn2 -> Anzahl2');
    await te.execute('Anzahl2', newEventVars(btn2), contextVars, btn2, 0);
    console.log('Var_Phase nach Start: obj.value =', objectMap['Var_Phase'].value, '| contextVars =', contextVars['Var_Phase']);
    console.log('--- Klick WuerfelnBtn -> Wuerfeln');
    await te.execute('Wuerfeln', newEventVars(wbtn), contextVars, wbtn, 0);
    console.log('Var_Phase:', objectMap['Var_Phase'].value, '| Var_Wurf:', objectMap['Var_Wurf'].value, '| Moveable:', contextVars['Var_Moveable'], '| Status:', objectMap['StatusLabel'].text);
})();

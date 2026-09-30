/** Headless-Debug: fuehrt die Madn-Tasks mit dem echten TaskExecutor aus.
 *  Vars-Modell wie die echte Runtime: contextVars = Proxy auf Objekt-.value,
 *  eventVars = Object.create(objectMap).
 *  Aufruf: npx tsx scripts/debug-madn-runtime.ts */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { TObjectList } from '../src/components/TObjectList';
import { ActionExecutor } from '../src/runtime/ActionExecutor';
import { TaskExecutor } from '../src/runtime/TaskExecutor';

const root = path.resolve(process.cwd());
const project = JSON.parse(fs.readFileSync(path.join(root, 'game-server/public/projects/Madn.json'), 'utf8'));
const stage = project.stages[0];

const objects: any[] = stage.objects.map((o: any) => {
    if (o.className === 'TObjectList') {
        const l = new TObjectList(o.name, o.x, o.y);
        Object.assign(l, o);
        l.ensureDefaults?.();
        (l as any).rebuildData?.();
        return l;
    }
    return { ...o, style: { ...(o.style || {}) } };
});

const actionExecutor = new ActionExecutor(objects);
const taskExecutor = new TaskExecutor(project, stage.actions, actionExecutor, undefined, undefined, stage.tasks);
actionExecutor.setTaskExecutor(taskExecutor);

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
const vars = Object.create(objectMap);
const gv = contextVars;

const dump = () => {
    console.log('--- Zustand ---');
    for (const k of ['Var_Phase', 'Var_CurrPlayer', 'Var_PlayerCount', 'Var_Wurf', 'Var_Moveable', 'Var_Versuche', 'Var_Sechser', 'Var_Gewaehlt', 'Var_Ziel', 'Var_GoalCount'])
        console.log(`  ${k} =`, JSON.stringify(contextVars[k]));
    const figs = objects.filter(o => /^Figur_/.test(o.name));
    console.log('  Sichtbar:', figs.filter(f => f.visible !== false).map(f => `${f.name}@${f.x},${f.y}`).join(' | ') || 'keine');
    console.log('  WuerfelBild:', objects.find(o => o.name === 'WuerfelBild')?.visible, objects.find(o => o.name === 'WuerfelBild')?.src);
    console.log('  Status:', objects.find(o => o.name === 'StatusLabel')?.text);
};

const setWurf = (n: number) => { contextVars['Var_Wurf'] = n; };
const click = async (name: string) => {
    const obj = objectMap[name];
    vars.self = obj; vars.sender = obj;
    await taskExecutor.execute('FigurGewaehlt', vars, gv, obj, 0);
};

(async () => {
    try {
        console.log('>>> Anzahl2 (Spielstart, 2 Spieler)');
        await taskExecutor.execute('Anzahl2', vars, gv, null, 0);
        dump();
        const fl = objectMap['FigurenListe'];
        console.log('  Records:', (fl.records || fl.data || []).map((r: any) => `${r.name ?? r.figurName}:slot=${r.slot},c=${r.colorIdx},m=${r.moveable}`).join(' | '));

        console.log('>>> Wuerfeln (erzwinge 5 — kein Home-Zug moeglich)');
        // deterministisch: Var_Wurf nach dem Wurf ueberschreiben geht nicht — stattdessen
        // Wuerfeln ausfuehren und den Zufallswert anschliessend loggen.
        await taskExecutor.execute('Wuerfeln', vars, gv, null, 0);
        dump();
        console.log('>>> Wuerfeln (2. Versuch)');
        await taskExecutor.execute('Wuerfeln', vars, gv, null, 0);
        dump();
        console.log('>>> Wuerfeln (3. Versuch)');
        await taskExecutor.execute('Wuerfeln', vars, gv, null, 0);
        dump();

        console.log('>>> FigurGewaehlt (Klick Figur_0)');
        await click('Figur_0');
        dump();
        console.log('>>> FigurGewaehlt (Klick Figur_4 = blau)');
        await click('Figur_4');
        dump();

        // --- Erzwungener 6er-Pfad: Var_Wurf=6 + ZuegeErmitteln manuell ---
        console.log('>>> Erzwinge 6: ZuegeErmitteln fuer Blau (CurrPlayer=1)');
        contextVars['Var_Wurf'] = 6;
        await taskExecutor.execute('ZuegeErmitteln', vars, gv, null, 0);
        dump();
        console.log('  Records:', (fl.records || fl.data || []).map((r: any) => `${r.name ?? r.figurName}:slot=${r.slot},c=${r.colorIdx},m=${r.moveable}`).join(' | '));
        console.log('>>> Klick Figur_4 (blau, moveable) -> sollte auf Slot 10');
        await click('Figur_4');
        dump();
        console.log('  Records:', (fl.records || fl.data || []).map((r: any) => `${r.name ?? r.figurName}:slot=${r.slot},c=${r.colorIdx},m=${r.moveable}`).join(' | '));
        console.log('>>> Erzwinge 6 nochmal (Sechser-Regel: Blau darf nochmal)');
        contextVars['Var_Wurf'] = 6;
        await taskExecutor.execute('ZuegeErmitteln', vars, gv, null, 0);
        dump();
    } catch (e) {
        console.error('FEHLER:', e);
    }
})();

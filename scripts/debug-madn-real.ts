/** Headless-Debug mit ECHTER Runtime-Pipeline:
 *  - hydrateObjects (wie RuntimeStageManager.getMergedStageData)
 *  - RuntimeVariableManager.contextVars (echter Proxy)
 *  - eventVars = Object.create(objectMap) (wie RuntimeEventService)
 *  Aufruf: npx tsx scripts/debug-madn-real.ts */
import * as fs from 'node:fs';
import * as path from 'node:path';
import assert from 'node:assert/strict';
import { hydrateObjects } from '../src/utils/Serialization';
import { RuntimeVariableManager } from '../src/runtime/RuntimeVariableManager';
import { ActionExecutor } from '../src/runtime/ActionExecutor';
import { TaskExecutor } from '../src/runtime/TaskExecutor';

const root = path.resolve(process.cwd());
const project = JSON.parse(fs.readFileSync(path.join(root, 'game-server/public/projects/Madn.json'), 'utf8'));
const stage = project.stages[0];

const objects: any[] = hydrateObjects(stage.objects);
for (const o of objects) { if (o.className === 'TObjectList') o.rebuildData?.(); }
for (const action of stage.actions) {
    for (const field of ['resultVariable', 'variableName']) {
        const target = objects.find(o => o.name === action[field]);
        if (target) action[`${field}_ref`] = target.id;
    }
}

const host: any = {
    project, stage, objects,
    taskExecutor: null,
    reactiveRuntime: { setVariable() { } },
    startTimer() { },
    log() { },
    render() { }
};
const vm = new RuntimeVariableManager(host);
vm.initializeVariables(project);
vm.importVariablesFromObjects(objects);

const actionExecutor = new ActionExecutor(objects);
const taskExecutor = new TaskExecutor(project, stage.actions, actionExecutor, undefined, undefined, stage.tasks);
actionExecutor.setTaskExecutor(taskExecutor);
host.taskExecutor = taskExecutor;

const objectMap: Record<string, any> = {};
for (const o of objects) { if (o.id) objectMap[o.id] = o; if (o.name) objectMap[o.name] = o; }

const gv = vm.contextVars; // ECHTER Proxy

const dump = () => {
    console.log('--- Zustand ---');
    for (const k of ['Var_Phase', 'Var_CurrPlayer', 'Var_PlayerCount', 'Var_Wurf', 'Var_Moveable', 'Var_Versuche', 'Var_Sechser', 'Var_Gewaehlt', 'Var_Ziel', 'Var_GoalCount', 'Var_PSlot', 'Var_PColor'])
        console.log(`  ${k} =`, JSON.stringify(objectMap[k]?.value));
    const figs = objects.filter(o => /^Figur_/.test(o.name));
    console.log('  Sichtbar:', figs.filter(f => f.visible !== false).map(f => `${f.name}@${f.x},${f.y}`).join(' | ') || 'keine');
    console.log('  Status:', objects.find(o => o.name === 'StatusLabel')?.text);
};

const click = async (name: string) => {
    const obj = objectMap[name];
    const vars = Object.create(objectMap);
    vars.self = obj; vars.sender = obj;
    await taskExecutor.execute('FigurGewaehlt', vars, gv, obj, 0);
};
const runEvent = async (taskName: string, contextObj: any = null) => {
    const vars = Object.create(objectMap);
    if (contextObj) { vars.self = contextObj; vars.sender = contextObj; }
    await taskExecutor.execute(taskName, vars, gv, contextObj, 0);
};

(async () => {
    try {
        console.log('>>> Anzahl2 (Spielstart, 2 Spieler)');
        await runEvent('Anzahl2');
        dump();

        console.log('>>> Wuerfeln #1');
        await runEvent('Wuerfeln');
        dump();
        console.log('>>> Wuerfeln #2');
        await runEvent('Wuerfeln');
        dump();
        console.log('>>> Wuerfeln #3');
        await runEvent('Wuerfeln');
        dump();

        // deterministischer 6er-Pfad: Var_Wurf direkt setzen, dann ZuegeErmitteln
        console.log('>>> Erzwinge Wurf=6 -> ZuegeErmitteln');
        objectMap['Var_Wurf'].value = 6;
        objectMap['Var_Phase'].value = 'wurf';
        await runEvent('ZuegeErmitteln');
        dump();
        const fl = objectMap['FigurenListe'];
        console.log('  moveable-Flags:', (fl.data || []).map((r: any) => `${r.name}:${r.moveable}`).join(' | '));
        console.log('>>> Klick Figur_0');
        await click('Figur_0');
        dump();
        await runEvent('SpielStarten');
        gv.Var_Wurf = 5;
        await runEvent('ZuegeErmitteln');
        assert.equal(objectMap.Var_Moveable.value, 0);
        assert.equal(objectMap.Var_Phase.value, 'wurf');
        await runEvent('SpielStarten');
        gv.Var_Wurf = 6;
        await runEvent('ZuegeErmitteln');
        assert.equal(objectMap.Var_Moveable.value, 4);
        assert.equal(objectMap.Var_Phase.value, 'pick');
        assert.equal(objectMap.FigurenListe.recordData[objectMap.FigurenListe.items[4]].moveable, false);
        await click('Figur_4');
        assert.equal(objectMap.Var_Phase.value, 'pick');
        await click('Figur_0');
        assert.equal(objectMap.FigurenListe.recordData[objectMap.FigurenListe.items[0]].slot, 0);
        assert.equal(objectMap.Var_Phase.value, 'wurf');
        assert.match(objectMap.StatusLabel.text, /nochmal würfeln/);
        await runEvent('SpielStarten');
        gv.Var_CurrPlayer = 1;
        gv.Var_Wurf = 6;
        await runEvent('ZuegeErmitteln');
        assert.equal(objectMap.Var_Moveable.value, 4);
        assert.equal(objectMap.Var_Phase.value, 'pick');
        assert.equal(objectMap.Var_Ziel.value, 10);
        await click('Figur_4');
        assert.equal(objectMap.FigurenListe.recordData[objectMap.FigurenListe.items[4]].slot, 10);
        assert.equal(objectMap.Var_Phase.value, 'wurf');
        console.log('Editor-Referenzen: 5 aus Home ungültig, 6 für Rot/Blau gültig, fremde Figur ignoriert, weiterer Wurf möglich.');
    } catch (e) {
        process.exitCode = 1;
        console.error('FEHLER:', e);
    }
})();

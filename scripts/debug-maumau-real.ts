import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { hydrateObjects } from '../src/utils/Serialization';
import { RuntimeVariableManager } from '../src/runtime/RuntimeVariableManager';
import { ActionExecutor } from '../src/runtime/ActionExecutor';
import { TaskExecutor } from '../src/runtime/TaskExecutor';

const require = createRequire(import.meta.url);
const { createMauMauProject } = require('./build-maumau.cjs');
const { project } = createMauMauProject();
const stage = project.stages[0];

const objects: any[] = hydrateObjects(stage.objects);
for (const o of objects) if (o.className === 'TObjectList') o.rebuildData?.(objects);
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
const gv = vm.contextVars;
const karten = objectMap.KartenListe;
const stapel = objectMap.StapelListe;
const ablage = objectMap.AblageListe;
const cardIdByIdx = (idx: number) => `Karte_${String(idx).padStart(2, '0')}`;
const rowByIdx = (idx: number) => karten.recordData[cardIdByIdx(idx)];
const setVar = (name: string, value: any) => { objectMap[name].value = value; gv[name] = value; };
const runTask = async (name: string, contextObj: any = null) => {
    const vars = Object.create(objectMap);
    if (contextObj) { vars.self = contextObj; vars.sender = contextObj; }
    await taskExecutor.execute(name, vars, gv, contextObj, 0);
};
const clickCard = async (idx: number) => {
    const row = rowByIdx(idx);
    const zone = objectMap[`Hand${row.owner}Zone`];
    zone.selectedRecord = row;
    zone.selectedIndex = 0;
    zone.selectedKey = row.cardId;
    await runTask('KarteGewaehlt', zone);
};

function scenario(topIdx: number, hand0: number[], hand1: number[], stack: number[], extraDiscard: number[] = []) {
    for (const row of Object.values<any>(karten.recordData)) {
        row.owner = -1; row.handIndex = -1; row.pileIndex = -1; row.playable = false; row.faceUp = false;
    }
    const discard = [...extraDiscard, topIdx];
    discard.forEach((idx, pileIndex) => {
        const row = rowByIdx(idx);
        row.owner = 4;
        row.pileIndex = pileIndex;
    });
    hand0.forEach((idx, i) => { const row = rowByIdx(idx); row.owner = 0; row.handIndex = i; });
    hand1.forEach((idx, i) => { const row = rowByIdx(idx); row.owner = 1; row.handIndex = i; });
    stapel.items = stack.map(cardIdByIdx);
    ablage.items = discard.map(cardIdByIdx);
    karten.rebuildData(objects);
    const topRow = rowByIdx(topIdx);
    setVar('Var_PlayerCount', 2); setVar('Var_CurrPlayer', 0); setVar('Var_NextPlayer', 0);
    setVar('Var_Richtung', 1); setVar('Var_Skip', 0); setVar('Var_Phase', 'play');
    setVar('Var_ZiehPflicht', 0); setVar('Var_Wunsch', -1);
    setVar('Var_AblageSuit', topRow.suit); setVar('Var_AblageRank', topRow.rank);
}

(async () => {
    try {
        await runTask('Anzahl2');
        assert.equal(stapel.items.length, 21);
        assert.equal(ablage.items.length, 1);
        assert.deepEqual(objectMap.HandCounts.items.slice(0, 2).map(Number), [5, 5]);
        assert.equal(objectMap.Var_Phase.value, 'play');

        scenario(2, [0, 10, 16, 4], [24], [17, 18, 19]);
        await runTask('RundeAktualisieren');
        const playableOf = (idx: number) => rowByIdx(idx).playable;
        assert.equal(playableOf(0), true);
        assert.equal(playableOf(10), true);
        assert.equal(playableOf(16), false);
        assert.equal(playableOf(4), true);
        assert.equal(objectMap.Var_PlayableCount.value, 3);
        await clickCard(16);
        assert.equal(rowByIdx(16).owner, 0);
        assert.equal(ablage.items.length, 1);
        await clickCard(10);
        assert.equal(rowByIdx(10).owner, 4);
        assert.equal(ablage.items.length, 2);
        assert.equal(objectMap.Var_CurrPlayer.value, 1);
        assert.equal(objectMap.Var_Phase.value, 'play');

        scenario(0, [24], [16, 14], [18, 19]);
        setVar('Var_CurrPlayer', 1);
        await runTask('RundeAktualisieren');
        await clickCard(16);
        assert.equal(objectMap.Var_ZiehPflicht.value, 2);
        assert.equal(objectMap.Var_CurrPlayer.value, 0);
        assert.equal(objectMap.Var_Phase.value, 'draw');
        await runTask('Nachziehen');
        assert.equal(objectMap.Var_ZiehPflicht.value, 0);
        assert.equal(objectMap.Var_CurrPlayer.value, 1);
        assert.equal(objectMap.Var_Phase.value, 'play');
        assert.equal(rowByIdx(18).owner, 0);
        assert.equal(rowByIdx(19).owner, 0);
        assert.equal(stapel.items.length, 0);

        scenario(1, [9, 3], [12], [20, 21]);
        await runTask('RundeAktualisieren');
        await clickCard(9);
        assert.equal(objectMap.Var_CurrPlayer.value, 0);
        assert.equal(objectMap.Var_Phase.value, 'play');

        scenario(2, [4, 5], [12], [20, 21]);
        await runTask('RundeAktualisieren');
        await clickCard(4);
        assert.equal(objectMap.Var_Phase.value, 'wish');
        assert.equal(objectMap.WunschKaro.visible, true);
        await runTask('WunschKaro');
        assert.equal(objectMap.Var_Wunsch.value, 1);
        assert.equal(objectMap.Var_CurrPlayer.value, 1);
        assert.equal(objectMap.Var_Phase.value, 'play');

        scenario(0, [3], [12], [], [1, 8, 9]);
        await runTask('RundeAktualisieren');
        await runTask('Nachziehen');
        assert.equal(stapel.items.length, 2);
        assert.equal(ablage.items.length, 1);
        assert.equal(rowByIdx(0).owner, 4);
        assert.equal([1, 8, 9].filter(idx => rowByIdx(idx).owner === 0).length, 1);

        scenario(2, [0], [12], [20]);
        await runTask('RundeAktualisieren');
        await clickCard(0);
        assert.equal(objectMap.Var_Phase.value, 'ende');
        assert.match(objectMap.StatusLabel.text, /gewonnen/);

        console.log('MauMau Runtime-Harness: Setup, Spielbarkeit, 7/8/Bube, Ziehen, Nachmischen und Gewinn bestanden.');
    } catch (e) {
        process.exitCode = 1;
        console.error('FEHLER:', e);
    }
})();

import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { createAnswerChoices } from '../src/utils/AnswerChoices';
import { TaskExecutor } from '../src/runtime/TaskExecutor';
import { ActionExecutor } from '../src/runtime/ActionExecutor';
import { PropertyHelper } from '../src/runtime/PropertyHelper';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

test('8 × 7 yields 56, 54, 60; custom alternatives exclude accepted variants and duplicates', () => {
    assert.deepEqual(createAnswerChoices({ answers: ['56'] }, () => .999).options, ['56', '54', '60']);
    const out = createAnswerChoices({ answers: ['56', '56.0'], wrongAnswers: ['56,0', '54', '54.0', '60'] }, () => .999);
    assert.deepEqual(out.options, ['56', '54', '60']);
    assert.deepEqual(createAnswerChoices({ answers: ['Paris'], wrongAnswers: ['Berlin', 'London'] }, () => 0).options, ['Berlin', 'London', 'Paris']);
    assert.equal(createAnswerChoices({ answers: ['Paris'] }).valid, false);
    for (const solution of ['0', '1', '-7', '1,5']) {
        const result = createAnswerChoices({ answers: [solution] });
        assert.equal(result.valid, true, solution);assert.equal(new Set(result.options).size, 3);
    }
});

function fixture({ hold = false, ok = true } = {}) {
    const project = JSON.parse(fs.readFileSync(new URL('../game-server/public/projects/Kopfrechnen-App.json', import.meta.url), 'utf8'));
    const stage = project.stages[0], objects = [...stage.objects, ...stage.variables];
    const vars = Object.fromEntries(stage.variables.map((v: any) => [v.name, v.value]));
    const get = (name: string) => objects.find(o => o.name === name);
    const requests: any[] = [];
    let release: (() => void) | undefined;
    const actions = new ActionExecutor(objects), execute = actions.execute.bind(actions);
    actions.execute = async (action, local, global, ...rest) => {
        if (action.type !== 'http') return execute(action, local, global, ...rest);
        const body = JSON.parse(PropertyHelper.interpolate(typeof action.body === 'string' ? action.body : JSON.stringify(action.body), local, objects));
        requests.push(body);
        if (body.action === 'cardAnswer' && hold) await new Promise<void>(resolve => { release = resolve; });
        const result = body.action === 'cardNext' ? { ok: true, card: { id: 'card-'+requests.length, attemptId: 'attempt-'+requests.length, question: '8 × 7', answers: ['56'], wrongAnswers: ['54', '60'], box: 1 } } : { ok };
        local[action.resultVariable] = result;if(global)global[action.resultVariable]=result;get(action.resultVariable).value=result;
    };
    const tasks = new TaskExecutor(project, stage.actions, actions, undefined, undefined, stage.tasks);
    actions.setTaskExecutor(tasks);
    const run = (name: string, self?: any) => tasks.execute(name, vars, vars, self);
    return { vars, get, requests, run, release: () => release?.() };
}

for (const correct of [true, false]) test(`choice ${correct ? 'correct' : 'incorrect'}: locked, exact feedback, once-only booking, wait for feedback`, async () => {
    const q = fixture();await q.run('App_Start');
    assert.equal(q.vars.Phase, 'answering');
    const buttons = ['BtnAntwortA','BtnAntwortB','BtnAntwortC'].map(q.get);
    assert.deepEqual(buttons.map(b => String(b.text)).sort(), ['54','56','60']);
    await q.run('Antwort_Gewaehlt', buttons.find(b => (String(b.matchValue) === '56') === correct));
    assert.equal(q.vars.Phase, 'feedback');
    assert.equal(q.get('LoesungLabel').text, 'Die richtige Antwort ist 56.');
    assert.ok(buttons.every(b => b.enabled === false));
    await q.run('Antwort_Gewaehlt', buttons[0]);
    const saved = q.requests.filter(r => r.action === 'cardAnswer');
    assert.equal(saved.length, 1);assert.equal(saved[0].correct, correct);assert.ok(saved[0].attemptId);
    assert.equal(q.requests.filter(r => r.action === 'cardNext').length, 1);
    await q.run('Antwortzeit_Vorbei');assert.equal(q.vars.Phase, 'answering');
    assert.equal(q.requests.filter(r => r.action === 'cardNext').length, 2);
    await q.run('Antwortzeit_Vorbei');assert.equal(q.requests.filter(r => r.action === 'cardNext').length, 2);
});

test('rapid double click and early timer wait for server; failed save never advances', async () => {
    const q=fixture({hold:true});await q.run('App_Start');
    const button=q.get('BtnAntwortA');
    const first=q.run('Antwort_Gewaehlt',button);
    const immediateSecond=q.run('Antwort_Gewaehlt',button);
    for(let i=0;i<30;i++)await Promise.resolve();
    await immediateSecond;await q.run('Antwort_Gewaehlt',button);await q.run('Antwortzeit_Vorbei');
    assert.equal(q.requests.filter(r=>r.action==='cardAnswer').length,1);
    assert.equal(q.requests.filter(r=>r.action==='cardNext').length,1);
    q.release();await first;assert.equal(q.requests.filter(r=>r.action==='cardNext').length,2);
    const failed=fixture({ok:false});await failed.run('App_Start');await failed.run('Antwort_Gewaehlt',failed.get('BtnAntwortA'));
    await failed.run('Antwortzeit_Vorbei');assert.equal(failed.vars.Phase,'save-error');
    assert.equal(failed.requests.filter(r=>r.action==='cardNext').length,1);
});

test('ending during a pending save ignores the late response; configuration is idempotent', async () => {
    const configure=require('../scripts/cms/cms-quiz-choice.cjs').configureMathChoices;
    const project=JSON.parse(fs.readFileSync(new URL('../game-server/public/projects/Kopfrechnen-App.json', import.meta.url),'utf8'));
    configure(project);const once=JSON.stringify(project);configure(project);assert.equal(JSON.stringify(project),once);
    const q=fixture({hold:true});await q.run('App_Start');
    const pending=q.run('Antwort_Gewaehlt',q.get('BtnAntwortA'));
    for(let i=0;i<30;i++)await Promise.resolve();
    await q.run('App_Beenden');q.release();await pending;await q.run('Antwortzeit_Vorbei');
    assert.equal(q.vars.Phase,'ended');assert.equal(q.requests.filter(r=>r.action==='cardNext').length,1);
    await q.run('App_Beenden');assert.equal(q.requests.filter(r=>r.action==='end').length,1);
});

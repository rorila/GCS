import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { TaskExecutor } from '../src/runtime/TaskExecutor';
import { ActionExecutor } from '../src/runtime/ActionExecutor';
import { PropertyHelper } from '../src/runtime/PropertyHelper';
import { TTimer } from '../src/components/TTimer';

function quiz(deckMetadata = false) {
    const project = JSON.parse(fs.readFileSync(new URL('../game-server/public/projects/Karteikasten-Quiz.json', import.meta.url), 'utf8'));
    const stage = project.stages[0];
    const flatten=(items:any[]):any[]=>items.flatMap(o=>[o,...flatten(o.children||[])]);
    const objects: any[] = [...flatten(stage.objects), ...stage.variables, ...project.stages.filter((s: any) => s.type === 'blueprint').flatMap((s: any) => s.objects)];
    const vars: Record<string, any> = Object.fromEntries(stage.variables.map((v: any) => [v.name, v.value]));
    const get = (name: string) => objects.find(o => o.name === name);
    const requests: any[] = [];
    let clock = 0, interval: (() => void) | undefined, due = 0;
    const previousWindow = (globalThis as any).window;
    (globalThis as any).window = { setInterval: (fn: () => void, ms: number) => { interval = fn; due = clock + ms; return 1; }, clearInterval: () => { interval = undefined; } };
    const timer = Object.assign(new TTimer('LoesungsTimer', 1, 3), get('LoesungsTimer'));
    objects[objects.findIndex(o => o.name === 'LoesungsTimer')] = timer;
    const speech = get('Spracheingabe');
    speech.prepare = () => {}; speech.start = () => {}; speech.cancel = () => {};
    const queue = ['a', 'b'].map((id, i) => ({ id, question: i ? '3+3' : '2+2', answers: [i ? '6' : '4'], answerFormat: 'text', box: 1, subject: 'Mathe', topic: 'Plus', createdByName:'Kartenautorin', ...(deckMetadata?{deckName:'Rechnen bis 20',deckSubject:'Mathematik',deckOwnerName:'Stapelerstellerin'}:{}) }));
    const actions = new ActionExecutor(objects);
    const execute = actions.execute.bind(actions);
    let bookingOK = true;
    let releaseBooking: (() => void) | undefined;
    let pauseBooking = false, holdFlip = false, flips = 0;
    actions.execute = async (action, local, global, ...rest) => {
        if (action.type === 'animate' && action.effect === 'flip3d') { flips++; if (!holdFlip) await run('Kartenrueckseite_Zeigen'); return; }
        if (action.type !== 'http') return execute(action, local, global, ...rest);
        const body = JSON.parse(PropertyHelper.interpolate(typeof action.body === 'string' ? action.body : JSON.stringify(action.body), local, objects));
        requests.push(body);
        let result: any = { ok: true };
        if (body.action === 'cardNext') {
            const excluded = String(body.excludeIds || '').split(',');
            const card = queue.find(c => !excluded.includes(c.id));
            result = card ? { ok: true, card: structuredClone(card) } : { ok: true, empty: true };
        }
        if (body.action === 'cardAnswer') {
            if (pauseBooking) await new Promise<void>(resolve => { releaseBooking = resolve; });
            result = { ok: bookingOK };
            if (!body.correct && bookingOK) { const index = queue.findIndex(c => c.id === body.cardId); queue.push(queue.splice(index, 1)[0]); }
        }
        local[action.resultVariable] = result;
        if (global) global[action.resultVariable] = result;
        get(action.resultVariable).value = result;
    };
    const tasks = new TaskExecutor(project, stage.actions, actions, undefined, undefined, stage.tasks);
    actions.setTaskExecutor(tasks);
    const run = (name: string) => tasks.execute(name, vars, vars);
    get('SprachAusgabe').stop = () => {};
    let holdSpeech = false, listenCount = 0;
    speech.start = () => { listenCount++; };
    get('SprachAusgabe').speak = () => holdSpeech ? undefined : run('Ansage_Ende');
    let tick = Promise.resolve();
    timer.initRuntime({ handleEvent: (_id: string, event: string) => { if (event === 'onTimer') tick = run('Loesungszeit_Vorbei'); } });
    timer.onRuntimeStart();
    return { vars, get, requests, run,
        holdFlip: () => { holdFlip = true; }, finishFlip: () => run('Kartenrueckseite_Zeigen'), flips: () => flips,
        holdSpeech: () => { holdSpeech = true; },
        finishSpeech: () => run('Ansage_Ende'),
        listenCount: () => listenCount,
        advance: async (ms: number) => { clock += ms; if (interval && clock >= due) interval(); await tick; },
        setBookingOK: (ok: boolean) => { bookingOK = ok; },
        holdBooking: () => { pauseBooking = true; },
        releaseBooking: () => releaseBooking?.(),
        close: () => { timer.onRuntimeStop(); (globalThis as any).window = previousWindow; },
    };
}

test('footer displays deck metadata and supports legacy card responses', async () => {
    for(const metadata of [false,true]) {
        const q=quiz(metadata);
        try {
            await q.run('Tastatur_Waehlen');
            assert.equal(q.get('KartenStapel').text,metadata?'Rechnen bis 20':'Plus');
            assert.equal(q.get('KartenArt').text,metadata?'Mathematik':'Mathe');
            assert.equal(q.get('KartenAutor').text,metadata?'Stapelerstellerin':'Kartenautorin');
        } finally {q.close();}
    }
});

test('Start ist manuell; richtige Sprachantwort bucht und zieht automatisch weiter', async () => {
    const q = quiz();
    try {
        assert.equal(q.get('QuizInit').enabled, false);
        assert.equal(q.requests.length, 0);
        await q.run('Quiz_Start');
        assert.equal(q.vars.Phase, 'preparing');
        await q.run('Sprache_Bereit');
        assert.equal(q.vars.AktuelleKarte.id, 'a');
        q.get('Spracheingabe').transcript = 'vier';
        await q.run('Sprachantwort_Pruefen');
        assert.equal(q.vars.QuizRichtig, 1);
        assert.equal(q.vars.AktuelleKarte.id, 'b');
        assert.equal(q.vars.GezogeneIds, 'a,');
        assert.equal(q.flips(), 0, 'correct answers never flip the card');
    } finally { q.close(); }
});

test('wrong answer flips at midpoint; reverse contains only solution and next card restores front', async () => {
    const project=JSON.parse(fs.readFileSync(new URL('../game-server/public/projects/Karteikasten-Quiz.json',import.meta.url),'utf8'));
    const stage=project.stages.find((s:any)=>s.id==='stage_quiz');
    const flip=stage.actions.find((a:any)=>a.name==='Act_Karte_Umdrehen');
    assert.equal(flip.effect,'flip3d');assert.equal(flip.duration,1100);
    assert.equal(stage.objects.find((o:any)=>o.name==='LoesungsTimer').interval-flip.duration/2,2000);
    const q=quiz();
    try {
        await q.run('Tastatur_Waehlen');q.holdFlip();q.holdSpeech();
        q.get('AntwortEdit').text='9';await q.run('Antwort_Pruefen');
        assert.equal(q.flips(),1);assert.equal(q.get('LoesungLabel').visible,false);
        assert.equal(q.get('FrageLabel').visible,true);assert.equal(q.get('LoesungsTimer').enabled,false);
        await q.finishFlip();assert.equal(String(q.get('LoesungLabel').text),'4');
        for(const name of ['FrageLabel','KartenSymbol','KartenStapel','KartenArt','KartenAutor'])assert.equal(q.get(name).visible,false,name);
        assert.equal(q.get('LoesungLabel').visible,true);
        await q.advance(2550);assert.equal(q.vars.Phase,'feedback','speech still pending');
        await q.finishSpeech();assert.equal(q.get('LoesungLabel').visible,false);assert.equal(q.get('FrageLabel').visible,true);
    } finally {q.close();}
});

test('ending during the flip prevents a late midpoint from restarting feedback', async () => {
    const q=quiz();
    try {
        await q.run('Tastatur_Waehlen');q.holdFlip();q.get('AntwortEdit').text='9';
        await q.run('Antwort_Pruefen');await q.run('Quiz_Beenden');await q.finishFlip();
        assert.equal(q.vars.Phase,'ended');assert.equal(q.get('LoesungsTimer').enabled,false);
        assert.equal(q.get('QuizKarte').visible,false);
    } finally {q.close();}
});

test('Falsch: zwei Sekunden Loesung, dann andere Karte, spaeter Wiedervorlage', async () => {
    const q = quiz();
    try {
        await q.run('Tastatur_Waehlen');
        q.get('AntwortEdit').text = '5';
        await q.run('Antwort_Pruefen');
        assert.equal(q.vars.Phase, 'feedback');
        assert.equal(String(q.get('LoesungLabel').text), '4');
        assert.equal(q.get('LoesungLabel').visible, true);
        assert.equal(q.get('FrageLabel').visible, false);
        assert.equal(q.vars.GezogeneIds, '');
        await q.run('Bewerten_Falsch');
        assert.equal(q.requests.filter(r => r.action === 'cardAnswer').length, 1);
        await q.advance(2549);
        assert.equal(q.vars.AktuelleKarte.id, 'a');
        await q.advance(1);
        assert.equal(q.vars.AktuelleKarte.id, 'b');
        q.get('AntwortEdit').text = '6';
        await q.run('Antwort_Pruefen');
        assert.equal(q.vars.AktuelleKarte.id, 'a');
    } finally { q.close(); }
});

test('Unverstandene Aufnahme und Buchungsfehler buchen nicht falsch oder gehen weiter', async () => {
    const q = quiz();
    try {
        await q.run('Tastatur_Waehlen');
        q.get('AntwortEdit').text = '';
        await q.run('Antwort_Pruefen');
        assert.equal(q.vars.Phase, 'answering');
        assert.equal(q.requests.filter(r => r.action === 'cardAnswer').length, 0);
        q.setBookingOK(false);
        q.get('AntwortEdit').text = '5';
        await q.run('Antwort_Pruefen');
        await q.advance(2550);
        assert.equal(q.vars.Phase, 'save-error');
        assert.equal(q.vars.QuizFalsch, 0);
        assert.equal(q.vars.AktuelleKarte.id, 'a');
    } finally { q.close(); }
});

test('Self-Karten behalten Aufdecken; leere Runde endet ohne weitere Aufnahme', async () => {
    const q = quiz();
    try {
        await q.run('Tastatur_Waehlen');
        q.vars.AktuelleKarte.answerFormat = 'self';
        await q.run('Eingabe_Bereit');
        assert.equal(q.get('AntwortZeigen').visible, true);
        await q.run('Antwort_Zeigen');
        assert.equal(q.get('Richtig').visible, true);
        await q.run('Selbst_Richtig');
        assert.equal(q.vars.AktuelleKarte.id, 'b');
        q.get('AntwortEdit').text = '6';
        await q.run('Antwort_Pruefen');
        assert.equal(q.vars.Phase, 'ended');
        assert.equal(q.vars.QuizRichtig, 2);
        assert.equal(q.requests.filter(r => r.action === 'end').length, 1);
    } finally { q.close(); }
});

test('Timer wartet auf Speicherung; Beenden verwirft spaete Antworten', async () => {
    const q = quiz();
    try {
        await q.run('Tastatur_Waehlen');
        q.holdBooking(); q.get('AntwortEdit').text = '5';
        const pending = q.run('Antwort_Pruefen');
        await new Promise(resolve => setImmediate(resolve));
        await q.advance(2550);
        assert.equal(q.vars.AktuelleKarte.id, 'a');
        await q.run('Quiz_Beenden');
        q.releaseBooking(); await pending;
        assert.equal(q.vars.Phase, 'ended');
        assert.equal(q.vars.QuizFalsch, 0);
        assert.equal(q.requests.filter(r => r.action === 'cardNext').length, 1);
    } finally { q.close(); }
});

test('Vorlesen: Mikrofon wartet auf Audio-Ende; falsche Lösung wird nicht abgeschnitten', async () => {
    const q = quiz();
    try {
        q.holdSpeech();
        await q.run('Quiz_Start');
        await q.run('Sprache_Bereit');
        assert.equal(q.vars.Phase, 'reading');
        assert.equal(q.listenCount(), 0);
        await q.finishSpeech();
        assert.equal(q.vars.Phase, 'answering');
        assert.equal(q.listenCount(), 1);
        q.get('Spracheingabe').transcript = 'fünf';
        await q.run('Sprachantwort_Pruefen');
        await q.advance(2550);
        assert.equal(q.vars.AktuelleKarte.id, 'a');
        assert.equal(q.vars.Phase, 'feedback');
        await q.finishSpeech();
        assert.equal(q.vars.AktuelleKarte.id, 'b');
        assert.equal(q.vars.Phase, 'reading');
        assert.equal(q.listenCount(), 1);
    } finally { q.close(); }
});

test('Audiofehler gibt Texteingabe frei; Generator erhält TTS ohne Duplikate', async () => {
    const q = quiz();
    try {
        q.holdSpeech();
        await q.run('Tastatur_Waehlen');
        assert.equal(q.vars.Phase, 'reading');
        await q.run('Ansage_Fehler');
        assert.equal(q.vars.Phase, 'answering');
        assert.equal(q.get('AntwortEdit').visible, true);
        assert.match(q.get('SprachStatus').text, /Text lesen/);
    } finally { q.close(); }
});

test('Unverstandene Sprache bietet einen sichtbaren Wiederholen-Button und wertet den zweiten Versuch aus', async () => {
    const q = quiz();
    try {
        await q.run('Quiz_Start'); await q.run('Sprache_Bereit');
        q.get('Spracheingabe').transcript = 'weiss nicht';
        await q.run('Sprachantwort_Pruefen');
        assert.equal(q.vars.Phase, 'answering');
        assert.equal(q.get('Wiederholen').visible, true);
        const count = q.listenCount();
        await q.run('Sprache_Wiederholen');
        assert.equal(q.listenCount(), count + 1);
        assert.equal(q.get('Wiederholen').visible, false);
        q.get('Spracheingabe').transcript = 'vier';
        await q.run('Sprachantwort_Pruefen');
        assert.equal(q.vars.QuizRichtig, 1);
        assert.equal(q.vars.AktuelleKarte.id, 'b');
    } finally { q.close(); }
});

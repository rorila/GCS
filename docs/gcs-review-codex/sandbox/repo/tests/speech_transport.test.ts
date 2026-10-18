import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Readable } from 'node:stream';
import { createRequire } from 'node:module';
import { encodeSpeechWav, SpeechAudioCapture, type SpeechInputLevel } from '../src/adapters/SpeechAudioCapture';
import { validSpeechMessage } from '../src/adapters/CmsSpeechHost';
import { makeReactive } from '../src/runtime/ReactiveProperty';
import { PropertyWatcher } from '../src/runtime/PropertyWatcher';
import { TTextToSpeech } from '../src/components/TTextToSpeech';
const require = createRequire(import.meta.url);
const { createSpeechService, validWav, MAX_BYTES } = require('../scripts/cms/cms-speech.cjs');
const { buildDb } = require('../scripts/cms/cms-seed-testdata.cjs');
const { createCore } = require('../scripts/cms/cms-core.cjs');
const key = 'a'.repeat(48);
const wav = Buffer.from(encodeSpeechWav(new Float32Array(48000).fill(0.2), 48000));
function fixture(fetchImpl: any = async () => Response.json({ text: ' vier ' }), endpoint = 'http://127.0.0.1:8178/inference') {
    const core = createCore(buildDb());
    const token = core.issueSession('child-finn', 'profile');
    core.db.playSessions = [{ id: 'speech-test', childId: 'child-finn', gameId: 'game-math', areaId: 'room-sun-play', status: 'active' }];
    const launches = new Map([[key, { token, playSessionId: 'speech-test', gameId: 'game-math', areaId: 'room-sun-play' }]]);
    const service = createSpeechService({ core, launches, endpoint, fetchImpl });
    const request = (options: any = {}) => Object.assign(Readable.from([options.body ?? wav]), { method: options.method ?? 'POST', url: options.url ?? '/api/cms/speech', headers: { host: 'localhost:8081', origin: 'http://localhost:8081', 'x-gcs-launch': key, 'content-type': 'audio/wav', ...options.headers } });
    return { core, launches, service, request };
}

test('Audio wird als begrenztes PCM16/16kHz/Mono-WAV kodiert', () => {
    assert.equal(wav.length, 57644); // 1 s Sprache + je 400 ms Stille vorne/hinten
    assert.equal(wav.readUInt32LE(40), wav.length - 44);
    assert.equal(wav.readInt16LE(44), 0); // gepolsterte Stille am Anfang
    assert.ok(validWav(wav));
    assert.equal(validWav(Buffer.alloc(43)), false);
    const invalid = Buffer.from(wav); invalid.writeUInt32LE(44100, 24);
    assert.equal(validWav(invalid), false);
    assert.equal(validWav(Buffer.alloc(MAX_BYTES + 2)), false);
});

test('Aktives eigenes Spiel darf Audio nur an den konfigurierten lokalen Dienst senden', async () => {
    const f = fixture(async (url: URL, options: any) => {
        assert.equal(url.hostname, '127.0.0.1');
        assert.equal(options.redirect, 'error');
        assert.equal(options.body.get('language'), 'de');
        assert.equal(options.body.has('prompt'), false);
        assert.equal(options.body.has('launchKey'), false);
        assert.ok(validWav(Buffer.from(await options.body.get('file').arrayBuffer())));
        return Response.json({ text: ' vier ' });
    });
    assert.deepEqual(await f.service.handle(f.request()), { status: 200, data: { ok: true, text: 'vier' } });
});

test('Erkennungshinweis des Spiels wird bereinigt an den lokalen Dienst weitergereicht', async () => {
    const f = fixture(async (url: URL, options: any) => {
        assert.equal(options.body.get('prompt'), 'Antwort ist eine Zahl.');
        return Response.json({ text: 'sieben' });
    });
    const request = f.request({ headers: { 'x-speech-prompt': encodeURIComponent(' Antwort ist eine Zahl. ') } });
    assert.deepEqual(await f.service.handle(request), { status: 200, data: { ok: true, text: 'sieben' } });
});

test('Kein Cloud-Fallback und keine vom Client bestimmte Zieladresse', async () => {
    const f = fixture(undefined, '');
    assert.equal((await f.service.handle(f.request())).status, 503);
    assert.throws(() => fixture(undefined, 'https://external.invalid/inference'), /lokalen/);
    assert.throws(() => fixture(undefined, 'http://127.0.0.1:8178/inference?target=x'), /lokalen/);
});

test('Ungueltige Schluessel, fremde Origins, fremde und beendete Sitzungen gesperrt', async () => {
    const f = fixture(() => { throw new Error('Darf nicht aufgerufen werden'); });
    assert.equal((await f.service.handle(f.request({ headers: { 'x-gcs-launch': 'invalid' } }))).status, 403);
    assert.equal((await f.service.handle(f.request({ headers: { origin: 'null' } }))).status, 403);
    f.core.db.playSessions[0].childId = 'child-emil';
    assert.equal((await f.service.handle(f.request())).status, 403);
    f.core.db.playSessions[0].childId = 'child-finn'; f.core.db.playSessions[0].status = 'ended';
    assert.equal((await f.service.handle(f.request())).status, 403);
});

test('Audioformat, Groesse, Sprache und Parallelitaet werden begrenzt', async () => {
    const f = fixture();
    assert.equal((await f.service.handle(f.request({ headers: { 'content-type': 'text/html' } }))).status, 415);
    assert.equal((await f.service.handle(f.request({ headers: { 'x-speech-language': 'invalid' } }))).status, 400);
    assert.equal((await f.service.handle(f.request({ body: Buffer.alloc(MAX_BYTES + 1) }))).status, 413);
    assert.equal((await f.service.handle(f.request())).status, 429);
    const g = fixture();
    assert.equal((await g.service.handle(g.request({ body: Buffer.alloc(5000) }))).status, 400);
});

test('Spaete Erkennung nach Sitzungsende wird nicht ausgeliefert', async () => {
    const f = fixture(async () => { f.core.db.playSessions[0].status = 'ended'; return Response.json({ text: 'vier' }); });
    assert.equal((await f.service.handle(f.request())).status, 403);
});

test('Dienstfehler und ungueltige Ausgabe sind keine Antworten', async () => {
    const f = fixture(async () => { throw Error('offline'); });
    assert.equal((await f.service.handle(f.request())).status, 503);
    const g = fixture(async () => Response.json({ text: 'x'.repeat(600) }));
    assert.equal((await g.service.handle(g.request())).status, 502);
});

test('Statusabfrage verlangt dieselbe aktive Berechtigung, benoetigt kein Audio', async () => {
    const f = fixture();
    assert.equal((await f.service.handle(f.request({ url: '/api/cms/speech/status', body: Buffer.alloc(0) }))).status, 200);
    assert.equal((await f.service.handle(f.request({ method: 'GET' }))).status, 405);
});

test('Aufnahme endet nach Sprechpause und gibt Tracks bei Abbruch frei', async () => {
    const globals = ['window', 'navigator', 'AudioContext'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const);
    let stopped = 0;
    let processor: any;
    const node = () => ({ connect() {}, disconnect() {} });
    class AudioContextMock {
        sampleRate = 16000; destination = {};
        resume() { return Promise.resolve(); }
        close() { return Promise.resolve(); }
        createMediaStreamSource() { return node(); }
        createScriptProcessor() { processor = { ...node(), onaudioprocess: null }; return processor; }
        createGain() { return { ...node(), gain: { value: 1 } }; }
    }
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { isSecureContext: true, setTimeout, clearTimeout } });
    Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: AudioContextMock });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop: () => { stopped++; } }] }) } } });
    const capture = new SpeechAudioCapture();
    try {
        await capture.prepare();
        assert.equal(stopped, 1);
        const controller = new AbortController();
        const levels: SpeechInputLevel[] = [];
        const recording = capture.capture(12000, 1000, controller.signal, level => levels.push(level));
        await new Promise(resolve => setImmediate(resolve));
        const feed = (level: number) => processor.onaudioprocess?.({ inputBuffer: { getChannelData: () => new Float32Array(2048).fill(level) } });
        feed(0);
        assert.equal(levels[0].rms, 0);
        assert.equal(levels[0].speechDetected, false);
        feed(0.2); feed(0.2);
        assert.ok(Math.abs(levels.at(-1)!.rms - 0.2) < 0.00001);
        assert.equal(levels.at(-1)!.speechDetected, true);
        for (let i = 0; i < 8; i++) feed(0);
        const bytes = await recording;
        assert.ok(bytes && validWav(Buffer.from(bytes)));
        assert.equal(levels.at(-1)!.rms, 0);
        assert.ok(levels.at(-1)!.peakRms > 0.19);
        assert.ok(levels.at(-1)!.audioMs > 1000);
        assert.ok(stopped > 1);
        const cancelled = capture.capture(12000, 1000, controller.signal);
        await new Promise(resolve => setImmediate(resolve));
        controller.abort();
        await assert.rejects(cancelled, /abgebrochen/);
        assert.equal(processor.onaudioprocess, null);
    } finally {
        capture.dispose();
        for (const [name, descriptor] of globals) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else delete (globalThis as any)[name];
        }
    }
});

test('Host akzeptiert nur das aktive Spielfenster mit passendem Schluessel', () => {
    const frame = {} as Window;
    const origin = 'https://cms.example.test';
    const event = { source: frame, origin: 'null', data: { type: 'gcs-speech', launchKey: key, clientId: 'a'.repeat(36), id: 'b'.repeat(36), operation: 'listen' } } as MessageEvent;
    assert.ok(validSpeechMessage(event, frame, origin, key));
    assert.equal(validSpeechMessage({ ...event, source: {} } as MessageEvent, frame, origin, key), false);
    assert.equal(validSpeechMessage({ ...event, origin: 'https://foreign.invalid' } as MessageEvent, frame, origin, key), false);
    assert.equal(validSpeechMessage(event, frame, origin, 'b'.repeat(48)), false);
    assert.equal(validSpeechMessage(event, frame, origin, undefined), false);
});

test('Reaktive Sprachausgabe darf native Requests beim Bewerten und Beenden abbrechen', () => {
    const descriptors = ['HTMLElement', 'Node'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const);
    for (const [name] of descriptors) Object.defineProperty(globalThis, name, { configurable: true, value: class {} });
    try {
        const speech = new TTextToSpeech();
        const controller = new AbortController();
        (speech as any).request = controller;
        const reactive = makeReactive(speech, new PropertyWatcher());
        assert.equal((reactive as any).request, controller);
        assert.doesNotThrow(() => reactive.stop());
        assert.equal(controller.signal.aborted, true);
        assert.equal((speech as any).request, undefined);
        assert.doesNotThrow(() => reactive.stop());
    } finally {
        for (const [name, descriptor] of descriptors) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else delete (globalThis as any)[name];
        }
    }
});
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeSpokenNumber, checkNumberAnswer } from '../src/utils/SpokenNumber';
import { TSpeechRecognition } from '../src/components/TSpeechRecognition';
import type { ISpeechRecognitionAdapter } from '../src/ports/ISpeechRecognitionAdapter';

test('Deutsche Zahlwoerter werden exakt normalisiert, unklare Aussagen nicht geraten', () => {
    for (const [text, expected] of [['sechsundfünfzig', 56], ['56.', 56], ['ein hundert zwei und dreißig', 132], ['minus zwölf', -12], ['null', 0], ['eins komma fünf', 1.5], ['1,5', 1.5], ['zweitausendvier', 2004], ['nacht', 8], ['nein', 9], ['für', 4], ['sex', 6], ['einst', 1], ['zahn', 10]] as const) {
        assert.equal(normalizeSpokenNumber(text), expected, text);
    }
    for (const text of ['', 'vier oder fünf', '14 2', 'achtund', 'keine Ahnung', 'vier plus zwei']) assert.equal(normalizeSpokenNumber(text), null, text);
    assert.equal(checkNumberAnswer('vier', ['42']).correct, false);
    assert.equal(checkNumberAnswer('vier', ['4', 'vier']).correct, true);
    assert.equal(checkNumberAnswer('', ['0']).valid, false);
    assert.equal(checkNumberAnswer('vier', ['Katze']).valid, false);
});

test('Nicht verstandene Aufnahme und verweigerte Freigabe liefern keine Antwort', async () => {
    const events: string[] = [];
    let denied = true;
    const adapter: ISpeechRecognitionAdapter = { prepare: async () => { if (denied) throw Error('Mikrofon verweigert'); }, listen: async () => ({ text: '' }), stop() {}, cancel() {} };
    const speech = new TSpeechRecognition('Sprache', 0, 0, adapter);
    speech.initRuntime({ handleEvent: (_id, event) => events.push(event) });
    speech.prepare('secret-launch');
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(events, ['onError']);
    assert.equal(speech.available, false);
    denied = false;
    speech.prepare('secret-launch');
    await new Promise(resolve => setImmediate(resolve));
    speech.start();
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(events.includes('onNoSpeech'));
    assert.ok(!events.includes('onResult'));
    speech.transcript = 'sensitive-transcript';
    const serialized = JSON.stringify(speech.toDTO());
    assert.ok(!serialized.includes('secret-launch'));
    assert.ok(!serialized.includes('sensitive-transcript'));
});

test('Sprachkomponente liefert nur aktuelle Ergebnisse und stoppt beim Runtime-Ende', async () => {
    let finish!: (result: { text: string }) => void;
    let cancellations = 0;
    const adapter: ISpeechRecognitionAdapter = {
        prepare: async () => {},
        listen: () => new Promise(resolve => { finish = resolve; }),
        stop: () => {}, cancel: () => { cancellations++; },
    };
    const speech = new TSpeechRecognition('Sprache', 0, 0, adapter);
    const events: string[] = [];
    speech.initRuntime({ handleEvent: (_id: string, event: string) => events.push(event) });
    speech.prepare('launch');
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(events.includes('onReady'));
    speech.start();
    finish({ text: 'vier' });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(speech.transcript, 'vier');
    assert.equal(events.filter(e => e === 'onResult').length, 1);
    speech.start();
    speech.onRuntimeStop();
    finish({ text: 'fünf' });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(events.filter(e => e === 'onResult').length, 1);
    assert.ok(cancellations > 0);
});

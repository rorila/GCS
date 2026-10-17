import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeImageSource } from '../src/utils/ImageSource';

test('ZIP counting assets resolve inside the current launch without doubling images/', () => {
    const base = 'https://gcs.example/play/launch-key/';
    for (const file of ['fox.svg', 'elephant.png', 'panda.png', 'parrot.png']) {
        const resolved = new URL(normalizeImageSource('images/counting/' + file), base);
        assert.equal(resolved.href, base + 'images/counting/' + file);
    }
});
test('explicit relative paths and asset directories stay relative', () => {
    for (const value of ['./images/a.png', '../images/a.png']) assert.equal(normalizeImageSource(value), value);
    assert.equal(normalizeImageSource('assets/animals/a.png'), './assets/animals/a.png');
    assert.equal(normalizeImageSource('a.png'), './images/a.png');
    assert.equal(normalizeImageSource('/images/a.png'), './images/a.png');
    assert.equal(normalizeImageSource(''), '');
});
test('embedded images and external or blob sources are not rewritten', () => {
    for (const value of ['data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,AAAA', 'blob:https://gcs.example/id', 'https://gcs.example/a.png', '//gcs.example/a.png', '/avatars/a.png']) assert.equal(normalizeImageSource(value), value);
});

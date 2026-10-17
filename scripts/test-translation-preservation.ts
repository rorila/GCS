import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { setRenderedContent } from '../src/editor/services/renderers/RenderedContent';

for (const mode of ['innerText', 'textContent', 'innerHTML'] as const) {
    test(`${mode}: preserve translations, apply real source changes and clear empty values`, () => {
        const element = { [mode]: '' } as unknown as HTMLElement;
        setRenderedContent(element, 'Anmelden', mode, true);
        element[mode] = mode === 'innerHTML' ? '<font>Sign in</font>' : 'Sign in';
        const translated = element[mode];
        setRenderedContent(element, 'Anmelden', mode, true);
        assert.equal(element[mode], translated);
        setRenderedContent(element, 'Abmelden', mode, true);
        assert.equal(element[mode], 'Abmelden');
        setRenderedContent(element, null, mode, true);
        assert.equal(element[mode], '');
    });
}

test('editor restores source content and new elements initialize independently', () => {
    const first = { textContent: '' } as unknown as HTMLElement;
    const second = { textContent: '' } as unknown as HTMLElement;
    setRenderedContent(first, 'Anmelden', 'textContent', true);
    first.textContent = 'Sign in';
    setRenderedContent(second, 'Anmelden', 'textContent', true);
    assert.equal(second.textContent, 'Anmelden');
    setRenderedContent(first, 'Anmelden', 'textContent', false);
    assert.equal(first.textContent, 'Anmelden');
});

test('CMS polling preserves unchanged translated messages and applies changed status', () => {
    const shell = fs.readFileSync('scripts/cms/cms-shell.js', 'utf8');
    const helper = shell.match(/const sourceTexts=new WeakMap\(\);\s*const setText=[^\r\n]+/)?.[0];
    assert.ok(helper);
    const setText = vm.runInNewContext(`${helper}\nsetText;`);
    const line = { textContent: '' };
    setText(line, 'Server: verbunden');
    line.textContent = 'Server: connected';
    for (let i = 0; i < 3; i++) setText(line, 'Server: verbunden');
    assert.equal(line.textContent, 'Server: connected');
    setText(line, 'Server: nicht erreichbar');
    assert.equal(line.textContent, 'Server: nicht erreichbar');
    setText(line, '');
    assert.equal(line.textContent, '');
});

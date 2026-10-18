import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { hydrateObjects } from '../src/utils/Serialization';
import { componentRegistry } from '../src/services/ComponentRegistry';
import { TImageSplitter } from '../src/components/TImageSplitter';
import { createImagePieces, resolveSplitterImageSource, validateImageSplit } from '../src/utils/ImageSplitterModel';
import { TObjectList } from '../src/components/TObjectList';

const config = { id: 'splitter', imageSource: './images/test.png', rows: 2, columns: 3 };

test('Toolbox-Erzeugung und Speichern/Laden erhalten die Konfiguration', () => {
    const instance = componentRegistry.createInstance({ type: 'ImageSplitter', name: 'Bildaufteiler', x: 2, y: 2 }) as TImageSplitter;
    assert.ok(instance instanceof TImageSplitter);
    Object.assign(instance, config, { showLines: false, previewGap: 12, outputList: 'Teile' });
    const dto = JSON.parse(JSON.stringify(instance.toDTO()));
    const [restored] = hydrateObjects([dto]) as TImageSplitter[];
    assert.ok(restored instanceof TImageSplitter);
    for (const field of ['id', 'imageSource', 'rows', 'columns', 'showLines', 'previewGap', 'outputList'] as const) {
        assert.equal(restored[field], instance[field]);
    }
});

test('PuzzleNeu ist ein separates Minimalprojekt mit konsistenter Ausgabeliste', () => {
    const project = JSON.parse(readFileSync(new URL('../public/test-projects/PuzzleNeu.json', import.meta.url), 'utf8'));
    assert.equal(project.meta.id, 'puzzle-neu');
    const main = project.stages.find((s: any) => s.id === 'stage_main');
    assert.equal(main.type, 'main');
    const objects = hydrateObjects(main.objects);
    const splitter = objects.find(o => o.className === 'TImageSplitter') as TImageSplitter;
    const list = objects.find(o => o.name === splitter.outputList) as TObjectList;
    assert.ok(list instanceof TObjectList);
    assert.equal(validateImageSplit(splitter), null);
    assert.equal(splitter.pieceCount, splitter.rows * splitter.columns);
    if (list.records.length) {
        assert.equal(list.records.length, splitter.pieceCount);
    }
    assert.ok(readFileSync(new URL('../public/images/puzzle-neu.svg', import.meta.url), 'utf8').includes('viewBox="0 0 900 600"'));
});

test('Aufteilung deckt auch nicht teilbare Bildmasse lueckenlos ab', () => {
    const pieces = createImagePieces(config, 1000, 701);
    assert.equal(pieces.length, 6);
    assert.equal(new Set(pieces.map(p => p.id)).size, 6);
    assert.equal(new Set(pieces.map(p => p.matchValue)).size, 6);
    assert.deepEqual(pieces.map(p => [p.row, p.column]), [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]]);
    for (const piece of pieces) {
        assert.equal(piece.source, config.imageSource);
        assert.equal(piece.width, 1000 / 3);
        assert.equal(piece.height, 701 / 2);
    }
    assert.ok(Math.abs(pieces[5].x + pieces[5].width - 1000) < 1e-9);
    assert.equal(pieces[5].y + pieces[5].height, 701);
    assert.equal(pieces[0].x + pieces[0].width, pieces[1].x);
});

test('Ein einzelnes Teil enthaelt das vollstaendige Bild', () => {
    const [piece] = createImagePieces({ ...config, rows: 1, columns: 1 }, 300, 900);
    assert.deepEqual([piece.x, piece.y, piece.width, piece.height], [0, 0, 300, 900]);
});

test('Ungueltige und uebergrosse Raster werden abgewiesen', () => {
    for (const rows of [0, -1, 1.5, NaN, Infinity, 33]) {
        assert.ok(validateImageSplit({ ...config, rows }));
        assert.throws(() => createImagePieces({ ...config, rows }, 100, 100));
    }
    assert.ok(validateImageSplit({ ...config, columns: 0 }));
    assert.ok(validateImageSplit({ ...config, imageSource: '' }));
    assert.throws(() => createImagePieces(config, 0, 10));
    assert.equal(createImagePieces({ ...config, rows: 32, columns: 32 }, 1024, 1024).length, 1024);
});

test('Bildpfade unterstuetzen Medienauswahl und Data-URIs ohne doppelte Encodierung', () => {
    assert.equal(resolveSplitterImageSource('mein Bild.png'), './images/mein%20Bild.png');
    assert.equal(resolveSplitterImageSource('/images/mein%20Bild.png'), './images/mein%20Bild.png');
    assert.equal(resolveSplitterImageSource('images/test.png'), './images/test.png');
    const data = 'data:image/png;base64,AA==';
    assert.equal(resolveSplitterImageSource(data), data);
    assert.throws(() => resolveSplitterImageSource('javascript:alert(1)'));
    assert.throws(() => resolveSplitterImageSource('file:///private/image.png'));
});

test('Inspector beschreibt Live-Konfiguration und explizite Ausgabe', () => {
    const splitter = new TImageSplitter('Bildaufteiler', 1, 1);
    const props = splitter.getInspectorProperties();
    assert.equal(props.find(p => p.name === 'imageSource')?.type, 'image_picker');
    assert.equal(props.find(p => p.name === 'rows')?.min, 1);
    assert.equal(props.find(p => p.name === 'columns')?.step, 1);
    assert.equal(props.find(p => p.name === 'outputList')?.source, 'object_lists');
    assert.equal(props.find(p => p.type === 'button')?.action, 'generateImageSplitterPieces');
    assert.equal(splitter.pieceCount, 6);
    splitter.rows = 4;
    splitter.columns = 6;
    assert.equal(splitter.pieceCount, 24);
    assert.equal(splitter.applyChange('rows', 4), true);
    assert.equal(splitter.toDTO().imageSource, '');
    assert.equal('pieceCount' in splitter.toDTO(), false);
});

test('Erzeugung schreibt erst nach Erfolg; Vorschau-Einstellungen aendern die Ausschnitte nicht', async () => {
    const list = new TObjectList('Teile', 0, 0);
    list.recordKey = 'id';
    list.replaceRecords([{ id: 'existing', name: 'Unveraendert' }]);
    const splitter = new TImageSplitter('Splitter', 0, 0);
    Object.assign(splitter, config, { outputList: list.name });
    splitter.initRuntime({ objects: [list] });
    const originalImage = globalThis.Image;
    class TestImage {
        naturalWidth = 1000;
        naturalHeight = 701;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(value: string) { queueMicrotask(() => value.includes('missing') ? this.onerror?.() : this.onload?.()); }
    }
    globalThis.Image = TestImage as any;
    try {
        splitter.previewGap = 20;
        splitter.showLines = false;
        assert.equal(list.records[0].id, 'existing');
        await splitter.generatePieces();
        assert.equal(list.records.length, 6);
        assert.equal(list.records[0].width, 1000 / 3);
        const previous = JSON.stringify(list.records);
        splitter.imageSource = './images/missing.png';
        await assert.rejects(splitter.generatePieces());
        assert.equal(JSON.stringify(list.records), previous);
        splitter.imageSource = config.imageSource;
        const changing = splitter.generatePieces();
        splitter.rows = 4;
        await assert.rejects(changing, /Konfiguration/);
        assert.equal(JSON.stringify(list.records), previous);
        const stopped = splitter.generatePieces();
        splitter.onRuntimeStop();
        await assert.rejects(stopped, /Konfiguration/);
        assert.equal(JSON.stringify(list.records), previous);
        const [reloaded] = hydrateObjects([JSON.parse(JSON.stringify(list.toDTO()))]) as TObjectList[];
        assert.deepEqual(reloaded.records, list.records);
        splitter.outputList = 'MissingList';
        await assert.rejects(splitter.generatePieces(), /TObjectList/);
    } finally {
        globalThis.Image = originalImage;
    }
});

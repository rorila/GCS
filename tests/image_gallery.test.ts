import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { hydrateObjects } from '../src/utils/Serialization';
import { componentRegistry } from '../src/services/ComponentRegistry';
import { TImageGallery } from '../src/components/TImageGallery';
import { TImageSplitter } from '../src/components/TImageSplitter';
import { TObjectList } from '../src/components/TObjectList';
import { getGalleryItems, hasGalleryFolder, listGalleryFolders } from '../src/utils/ImageGalleryModel';

const project = JSON.parse(readFileSync(new URL('../game-server/public/projects/PuzzleNeu.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(readFileSync(new URL('../public/media-manifest.json', import.meta.url), 'utf8'));
const FOLDER = 'memory Tierbilder für kleine Kinder';

test('Toolbox-Erzeugung und Speichern/Laden erhalten die Galerie-Konfiguration', () => {
    const instance = componentRegistry.createInstance({ type: 'ImageGallery', name: 'Galerie', x: 2, y: 4 }) as TImageGallery;
    assert.ok(instance instanceof TImageGallery);
    Object.assign(instance, { folder: FOLDER, columns: 5, tileHeight: 6.5, gap: 8, selectionColor: '#00ff00', showFileNames: true, selectedImage: './images/x/y.png' });
    const [restored] = hydrateObjects([JSON.parse(JSON.stringify(instance.toDTO()))]) as TImageGallery[];
    assert.ok(restored instanceof TImageGallery);
    for (const field of ['id', 'folder', 'columns', 'tileHeight', 'gap', 'selectionColor', 'showFileNames', 'selectedImage'] as const) {
        assert.equal(restored[field], instance[field]);
    }
    assert.ok(restored.getEvents().includes('onSelectionChanged'));
});

test('Inspector beschreibt Ordner, Raster und Auswahl', () => {
    const gallery = new TImageGallery('Galerie', 0, 0);
    const props = gallery.getInspectorProperties();
    assert.equal(props.find(p => p.name === 'folder')?.type, 'string');
    assert.equal(props.find(p => p.name === 'columns')?.max, 10);
    assert.equal(props.find(p => p.name === 'selectionColor')?.type, 'color');
    assert.equal(props.find(p => p.name === 'selectedImage')?.readonly, true);
});

test('Manifest-Auflistung liefert kodierte URLs und rohe Projektpfade', () => {
    const fake = { images: { 'tier bilder': ['katze.png', 'hund.jpg'], '': ['root.png'] } };
    assert.deepEqual(listGalleryFolders(fake), ['tier bilder', '']);
    assert.ok(hasGalleryFolder(fake, 'tier bilder'));
    assert.ok(!hasGalleryFolder(fake, 'fehlt'));
    const items = getGalleryItems(fake, 'tier bilder');
    assert.equal(items.length, 2);
    assert.equal(items[0].path, './images/tier bilder/katze.png');
    assert.equal(items[0].url, './images/tier%20bilder/katze.png');
    assert.equal(getGalleryItems(fake, '')[0].path, './images/root.png');
    assert.deepEqual(getGalleryItems(fake, 'fehlt'), []);
});

test('Der konfigurierte Tierbilder-Ordner existiert im echten Medienmanifest', () => {
    assert.ok(hasGalleryFolder(manifest, FOLDER));
    const items = getGalleryItems(manifest, FOLDER);
    assert.ok(items.length >= 30, `erwartet >= 30 Bilder, gefunden: ${items.length}`);
    for (const item of items) {
        assert.ok(item.path.startsWith(`./images/${FOLDER}/`));
        assert.ok(!item.url.includes(' '));
    }
});

test('selectImage setzt die Auswahl und rendert neu', () => {
    const gallery = new TImageGallery('Galerie', 0, 0);
    let renders = 0;
    gallery.initRuntime({ render: () => renders++ });
    gallery.selectImage('./images/a.png');
    assert.equal(gallery.selectedImage, './images/a.png');
    assert.equal(gallery.getSelectedImage(), './images/a.png');
    assert.equal(renders, 1);
});

test('PuzzleNeu enthaelt Galerie-Stage, Navigation und unveraenderte Splitter-Daten', () => {
    assert.ok(['stage_galerie', 'stage_main'].includes(project.activeStageId));
    assert.equal(project.stages.length, 3);
    const blueprint = project.stages.find((s: any) => s.type === 'blueprint');
    const main = project.stages.find((s: any) => s.id === 'stage_main');
    const galerie = project.stages.find((s: any) => s.id === 'stage_galerie');
    assert.equal(main.type, 'main');
    assert.equal(galerie.type, 'standard');

    const bpObjects = hydrateObjects(blueprint.objects);
    assert.ok(bpObjects.find(o => o.className === 'TStageController'));
    const bpVars = hydrateObjects(blueprint.variables);
    const bildVar = bpVars.find((v: any) => v.name === 'GewaehltesBild');
    assert.ok(bildVar && bildVar.isVariable);
    const taskNames = blueprint.tasks.map((t: any) => t.name);
    for (const name of ['GalerieOeffnen', 'GalerieInit', 'BildGewaehlt', 'BildUebernehmen', 'SplitterInit', 'ZurueckZumSplitter']) {
        assert.ok(taskNames.includes(name), `Task ${name} fehlt`);
    }
    const uebernehmen = blueprint.tasks.find((t: any) => t.name === 'BildUebernehmen');
    assert.deepEqual(uebernehmen.actionSequence.map((a: any) => a.type), ['property', 'navigate_stage']);
    assert.equal(uebernehmen.actionSequence[1].stageId, 'stage_main');
    const init = blueprint.tasks.find((t: any) => t.name === 'SplitterInit');
    assert.equal(init.actionSequence[0].type, 'condition');
    assert.equal(init.actionSequence[0].then[0].changes['Bildaufteiler.imageSource'], '${GewaehltesBild}');

    const galleryObjects = hydrateObjects(galerie.objects);
    const gallery = galleryObjects.find(o => o.className === 'TImageGallery') as TImageGallery;
    assert.equal(gallery.folder, FOLDER);
    assert.equal(gallery.events.onSelectionChanged, 'BildGewaehlt');
    assert.equal(galleryObjects.find(o => o.name === 'BtnBildNehmen').events.onClick, 'BildUebernehmen');
    assert.equal(galleryObjects.find(o => o.name === 'GalerieStart').events.onStart, 'GalerieInit');

    const mainObjects = hydrateObjects(main.objects);
    const splitter = mainObjects.find(o => o.className === 'TImageSplitter') as TImageSplitter;
    const list = mainObjects.find(o => o.className === 'TObjectList') as TObjectList;
    const navBtn = mainObjects.find(o => o.name === 'BtnBildAuswaehlen');
    assert.equal(navBtn.events.onClick, 'GalerieOeffnen');
    assert.equal(mainObjects.find(o => o.name === 'SplitterStart').events.onStart, 'SplitterInit');
    assert.equal(splitter.rows, 5);
    assert.equal(splitter.columns, 5);
    assert.equal(list.records.length, 25);
    assert.equal(new Set(list.records.map((r: any) => r.matchValue)).size, 25);
});

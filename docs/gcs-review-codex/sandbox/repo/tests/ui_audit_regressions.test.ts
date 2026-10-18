import test from 'node:test';
import assert from 'node:assert/strict';
import { SpriteRenderer } from '../src/editor/services/renderers/SpriteRenderer';
import { collectShelfItems } from '../src/editor/EditorShelfModel';

// Exercise the actual painter; these controls only supply the DOM surface it uses.
function surface(image = false) {
    const layer: any = { tagName: 'IMG', dataset: {}, style: {}, getAttribute: () => null };
    const element: any = { style: {}, querySelector: (selector: string) => image && selector === '.sprite-image-layer' ? layer : null };
    return { element, layer };
}
const context: any = { host: { runMode: false, lastRenderedObjects: [] } };

test('UI-03: spriteColor wins over a persisted stale style and updates on repaint', () => {
    const { element } = surface();
    const sprite: any = { name: 'Baum', spriteColor: '#2d8a3e', style: { backgroundColor: '#ff6b6b' } };
    SpriteRenderer.render(context, element, sprite);
    assert.equal(element.style.backgroundColor, '#2d8a3e');
    sprite.spriteColor = '#123456';
    SpriteRenderer.render(context, element, sprite);
    assert.equal(element.style.backgroundColor, '#123456');
    assert.equal(sprite.style.backgroundColor, '#ff6b6b', 'Rendering must not mutate saved style data');
});

test('UI-03: legacy style fallback and image transparency remain available', () => {
    const legacy = surface();
    SpriteRenderer.render(context, legacy.element, { name: 'Alt', style: { backgroundColor: '#abcdef' } });
    assert.equal(legacy.element.style.backgroundColor, '#abcdef');
    const image = surface(true);
    SpriteRenderer.render(context, image.element, { name: 'Bild', appearanceMode: 'simple', backgroundImage: '/images/test.png', spriteColor: '#2d8a3e' });
    assert.equal(image.element.style.backgroundColor, 'transparent');
    assert.equal(image.layer.src, './images/test.png');
});

test('UI-04: refreshed shelf reflects name, type and current zero instead of a nonzero default', () => {
    const variable: any = { id: 'water', className: 'TVariable', name: 'Variable_1', type: 'integer', defaultValue: 7, value: 3 };
    const stage: any = { id: 'wiese', name: 'Die Wiese', objects: [variable] };
    const project: any = { activeStageId: 'wiese', stages: [stage] };
    assert.equal(collectShelfItems(project, stage)[0].detail, 'integer · 3');
    variable.name = 'Wasser'; variable.type = 'real'; variable.value = 0;
    const item = collectShelfItems(project, stage)[0];
    assert.equal(item.name, 'Wasser');
    assert.equal(item.detail, 'real · 0');
    assert.equal(variable.defaultValue, 7);
});

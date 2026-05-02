import { TSprite } from '../src/components/TSprite';
import { SpriteRenderer } from '../src/editor/services/renderers/SpriteRenderer';
import { PropertyHelper } from '../src/runtime/PropertyHelper';
import { InspectorSectionRenderer } from '../src/editor/inspector/renderers/InspectorSectionRenderer';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`);
(global as any).document = dom.window.document;

// Mock context
const ctx: any = {
    host: {
        lastRenderedObjects: [],
        runMode: false
    }
};

const sprite = new TSprite('Sprite1', 0, 0, 100, 100);

// Mock element
const el = document.createElement('div');
document.body.appendChild(el);

console.log("1. Initiales Rendering (sollte keine Bild-Eigenschaften haben)");
SpriteRenderer.render(ctx, el, sprite);
console.log("Sprite DOM nach Render:", el.innerHTML);

console.log("\n2. Simuliere Inspector 'Browse Image' Klick für backgroundImage...");
// Der InspectorActionHandler setzt die Property backgroundImage
PropertyHelper.setPropertyValue(sprite, 'backgroundImage', 'test.png');
console.log("sprite.backgroundImage =", sprite.backgroundImage);

console.log("\n3. Rendering nach Inspector-Zuweisung...");
SpriteRenderer.render(ctx, el, sprite);
console.log("Sprite DOM nach Render:", el.innerHTML);

const imgEl = el.querySelector('img');
if (imgEl) {
    console.log("IMG src:", imgEl.src);
    console.log("IMG style:", imgEl.getAttribute('style'));
} else {
    console.log("FEHLER: Kein IMG-Tag erzeugt!");
}

console.log("\n4. Simuliere Inspector Input Change (Text-Input)...");
// Das war unser behobener Bug: `handleControlChange` im InspectorSectionRenderer.
// Testen, ob sich obj.backgroundImage aendert, wenn input.name statt propDef.name verwendet wuerde.
const obj: any = sprite;
const inputName = 'backgroundImageInput';
const propDefName = 'backgroundImage';

// Simulation des fehlerhaften Codes:
// obj[inputName] = 'fehler.png'; // FALSCH
PropertyHelper.setPropertyValue(obj, propDefName, 'richtig.png'); // RICHTIG

console.log("Nach manuellem input change: backgroundImage =", sprite.backgroundImage);

SpriteRenderer.render(ctx, el, sprite);
const imgEl2 = el.querySelector('img');
if (imgEl2) {
    console.log("IMG src:", imgEl2.src);
}


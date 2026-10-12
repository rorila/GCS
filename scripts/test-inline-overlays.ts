import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { TInlineOverlay } from '../src/components/TInlineOverlay';
import { TLearningPointsOverlay } from '../src/components/TLearningPointsOverlay';
import { GameLoopManager } from '../src/runtime/GameLoopManager';
import { LearningPointsController } from '../src/runtime/services/LearningPointsController';
import { StageOverlayRenderer } from '../src/editor/services/renderers/StageOverlayRenderer';
import { attachCmsGameHost } from '../src/adapters/CmsGameHost';
import { hydrateObjects } from '../src/utils/Serialization';
import { makeReactive } from '../src/runtime/ReactiveProperty';
import { PropertyWatcher } from '../src/runtime/PropertyWatcher';
import { OverlayPlacementValidator } from '../src/editor/services/OverlayPlacementValidator';

type Handler = (event: any) => any;
class FakeElement {
    style: any = {};
    attributes = new Map<string, string>();
    children: FakeElement[] = [];
    parentElement?: FakeElement;
    listeners = new Map<string, Set<Handler>>();
    className = '';
    hidden = false;
    disabled = false;
    isConnected = true;
    offsetParent = {};
    onkeydown?: Handler;
    onclick?: Handler;
    contentWindow = { messages: [] as any[], postMessage: (m: any) => this.contentWindow.messages.push(m) };
    private text = '';
    constructor(public tagName = 'DIV') {}
    get textContent() { return this.text + this.children.map(c => c.textContent).join(''); }
    set textContent(value: string) { this.text = value; this.children = []; }
    get src() { return this.getAttribute('src'); }
    set src(value: string | null) { this.setAttribute('src', value || ''); }
    classList = { contains: (name: string) => this.className.split(' ').includes(name), add: (...names: string[]) => { this.className += ' ' + names.join(' '); } };
    setAttribute(key: string, value: string) { this.attributes.set(key, value); }
    getAttribute(key: string) { return this.attributes.get(key) ?? null; }
    removeAttribute(key: string) { this.attributes.delete(key); }
    appendChild(child: FakeElement) { child.parentElement = this; this.children.push(child); return child; }
    append(...children: FakeElement[]) { children.forEach(c => this.appendChild(c)); }
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(c => c !== this); this.isConnected = false; }
    contains(child: FakeElement): boolean { return this === child || this.children.some(c => c.contains(child)); }
    querySelectorAll(selector: string): FakeElement[] {
        const matches = (el: FakeElement) => selector.startsWith('button:') ? el.tagName === 'BUTTON' && !el.disabled
            : selector.startsWith('[') ? el.attributes.has(selector.slice(1, -1).split('=')[0])
            : selector.includes('.') ? el.classList.contains(selector.split('.').pop()!) : el.tagName.toLowerCase() === selector;
        const all = this.children.flatMap(c => [c, ...c.querySelectorAll('*')]);
        return selector === '*' ? all : all.filter(matches);
    }
    querySelector(selector: string) { return this.querySelectorAll(selector)[0] ?? null; }
    addEventListener(name: string, fn: Handler) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name)!.add(fn); }
    removeEventListener(name: string, fn: Handler) { this.listeners.get(name)?.delete(fn); }
    emit(name: string, event: any = {}) { return Promise.all([...this.listeners.get(name) || []].map(fn => fn({ target: this, stopPropagation() {}, preventDefault() {}, ...event }))); }
    focus() { dom.activeElement = this; }
    getBoundingClientRect() { return { width: 400, height: 240 }; }
}

let dom: any;
let windowEvents: FakeElement;
let timers: Map<number, { fn: () => any; delay: number }>;
let overlays: TInlineOverlay[];
let controllers: LearningPointsController[];
let timerId = 0;
const loop = GameLoopManager.getInstance();
const grid = { cols: 64, rows: 40, cellSize: 20, snapToGrid: true, visible: false, backgroundColor: '' };
const summary = (totalPoints = 2, revision = 2, modeRevision = 0) => ({ totalPoints, revision, modeRevision, mode: 'progress' as const, modeLabel: '', completedCards: 0 });
const controller = () => { const c = LearningPointsController.forRuntimeObjects([{ name: 'CMS_LAUNCH', value: 'test' }]); controllers.push(c); return c; };
const overlay = (name = 'Overlay') => { const o = new TInlineOverlay(name, 2, 2); overlays.push(o); return o; };
const elementFor = (o: TInlineOverlay) => { const el = new FakeElement(); el.setAttribute('data-id', o.id); dom.body.append(el); return el; };
const render = (o: any, el: FakeElement) => StageOverlayRenderer.render({ host: { runMode: true } } as any, el as any, o);
const key = (target: FakeElement, extra: any = {}) => ({ key: 'Enter', target, repeat: false, preventDefault() {}, stopPropagation() {}, ...extra });

beforeEach(() => {
    overlays = []; controllers = []; timers = new Map(); windowEvents = new FakeElement();
    const events = new FakeElement();
    dom = { body: new FakeElement('BODY'), activeElement: null, visibilityState: 'visible',
        createElement: (tag: string) => new FakeElement(tag.toUpperCase()), getElementById: () => null,
        querySelector: (s: string) => s.startsWith('[data-id=') ? dom.body.children.find((c: FakeElement) => c.getAttribute('data-id') === s.match(/"([^"]+)"/)?.[1]) ?? null : null,
        addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events), emit: events.emit.bind(events), listeners: events.listeners };
    Object.assign(globalThis, { document: dom, window: { addEventListener: windowEvents.addEventListener.bind(windowEvents), removeEventListener: windowEvents.removeEventListener.bind(windowEvents),
        setInterval: (fn: () => any, delay: number) => { timers.set(++timerId, { fn, delay }); return timerId; }, clearInterval: (id: number) => timers.delete(id),
        setTimeout: (fn: () => any, delay: number) => { timers.set(++timerId, { fn, delay }); return timerId; }, clearTimeout: (id: number) => timers.delete(id) },
        location: { origin: 'http://localhost:8081', protocol: 'http:', host: 'localhost:8081' }, requestAnimationFrame: () => 1, cancelAnimationFrame: () => {} });
});
afterEach(() => {
    overlays.forEach(o => o.onRuntimeStop()); controllers.forEach(c => c.dispose());
    LearningPointsController.setPortFactory(null); loop.stop();
});

test('Higher dialog keeps focus and Escape; hidden dialog does not suppress inline modality', async () => {
    const o = overlay(), el = elementFor(o);
    o.expandedModal = true;
    o.initRuntime({ handleEvent() {}, render() { render(o, el); } } as any);
    render(o, el); o.expand();
    const dialog = new FakeElement(), button = new FakeElement('BUTTON');
    dialog.style.zIndex = '20000'; dialog.append(button); dom.body.append(dialog);
    button.focus(); await dom.emit('focusin', { target: button });
    assert.equal(dom.activeElement === button, true);
    await dom.emit('keydown', { key: 'Escape', target: button });
    assert.equal(o.isExpanded, true);
    dialog.style.display = 'none';
    await dom.emit('focusin', { target: button });
    assert.equal(dom.activeElement === button, false);
    await dom.emit('keydown', { key: 'Escape', target: el });
    assert.equal(o.isExpanded, false);
});

test('Placement checks nested protected controls in stage coordinates and hidden parents', () => {
    const o = overlay(); o.expandedBounds = { x: 14, y: 12, width: 3, height: 3 };
    const panel = { id: 'panel', className: 'TPanel', x: 10, y: 10, width: 10, height: 10, visible: true };
    const group = { id: 'group', parentId: 'panel', className: 'TPanel', x: 2, y: 1, width: 8, height: 8 };
    const button = { id: 'button', name: 'Nested button', parentId: 'group', className: 'TButton', x: 2, y: 1, width: 2, height: 2, protectFromOverlay: true };
    assert.deepEqual(OverlayPlacementValidator.validate(o, [panel, group, button], grid), ['Detailansicht überdeckt „Nested button“.']);
    panel.visible = false;
    assert.deepEqual(OverlayPlacementValidator.validate(o, [panel, group, button], grid), []);
    panel.visible = true; button.x = 20;
    assert.deepEqual(OverlayPlacementValidator.validate(o, [panel, group, button], grid), []);
});

test('Overlay none and passthrough never activate a registered click task', () => {
    const o = overlay(); const events: any[] = [];
    o.events = { onClick: 'ClickTask' }; o.interactionMode = 'interactive'; o.activationAction = 'none';
    o.initRuntime({ handleEvent: (...args: any[]) => events.push(args) } as any);
    for (const source of ['mouse', 'touch', 'keyboard'] as const) o.activate(source);
    o.activationAction = 'eventOnly'; o.interactionMode = 'passthrough'; o.activate('mouse');
    assert.equal(events.length, 0); assert.equal(o.isExpanded, false);
});

test('Detailflaeche: Mausdelta bleibt getrennt von Rasterkoordinaten', async () => {
    const o = overlay(), frame = new FakeElement(); o.expandedBounds = { x: 10, y: 6, width: 20, height: 12 };
    const commits: any[] = [], ctx = { host: { grid, onObjectBoundsEdit: (_id: string, b: any) => commits.push(b) } };
    (StageOverlayRenderer as any).bindFrameDrag(ctx, frame, o, 20);
    await frame.emit('pointerdown', { button: 0, clientX: 400, clientY: 300 });
    await windowEvents.emit('pointermove', { clientX: 420, clientY: 300 });
    assert.deepEqual(o.expandedBounds, { x: 10, y: 6, width: 20, height: 12 });
    assert.equal(commits.length, 0);
    await windowEvents.emit('pointerup');
    assert.deepEqual(commits, [{ x: 11, y: 6, width: 20, height: 12 }]);
});

test('Detailflaeche: Drag beruecksichtigt den Editorzoom', async () => {
    const o = overlay(), frame = new FakeElement(); o.expandedBounds = { x: 10, y: 6, width: 20, height: 12 };
    frame.getBoundingClientRect = () => ({ width: 200, height: 120 });
    const commits: any[] = [];
    (StageOverlayRenderer as any).bindFrameDrag({ host: { grid, onObjectBoundsEdit: (_id: string, b: any) => commits.push(b) } }, frame, o, 20);
    await frame.emit('pointerdown', { button: 0, clientX: 400, clientY: 300 });
    await windowEvents.emit('pointermove', { clientX: 410, clientY: 300 });
    await windowEvents.emit('pointerup');
    assert.deepEqual(commits, [{ x: 11, y: 6, width: 20, height: 12 }]);
});

test('Detailflaeche: Resize und pointercancel bereinigen Listener ohne Commit', async () => {
    const o = overlay(), frame = new FakeElement(), grip = new FakeElement(); grip.className = 'overlay-frame-grip';
    o.expandedBounds = { x: 50, y: 30, width: 10, height: 8 };
    const commits: any[] = [];
    (StageOverlayRenderer as any).bindFrameDrag({ host: { grid, onObjectBoundsEdit: (_id: string, b: any) => commits.push(b) } }, frame, o, 20);
    await frame.emit('pointerdown', { button: 0, clientX: 400, clientY: 300, target: grip });
    await windowEvents.emit('pointermove', { clientX: 800, clientY: 700 });
    await windowEvents.emit('pointercancel');
    await windowEvents.emit('pointerup');
    assert.deepEqual(commits, []);
    assert.equal(windowEvents.listeners.get('pointermove')?.size, 0);
    await frame.emit('pointerdown', { button: 0, clientX: 400, clientY: 300, target: grip });
    await windowEvents.emit('pointermove', { clientX: 800, clientY: 700 });
    await windowEvents.emit('pointerup');
    assert.deepEqual(commits, [{ x: 50, y: 30, width: 14, height: 10 }]);
});

test('Geometrie nutzt die echte Stage und behaelt Designwerte', () => {
    const o = overlay(); o.x = 63; o.y = 39; o.width = 20; o.height = 12;
    o.initRuntime({ gridConfig: { ...grid, cols: 24, rows: 18 } } as any);
    assert.deepEqual(o.getEffectiveBounds(), { x: 4, y: 6, width: 20, height: 12 });
    assert.equal(o.x, 63); assert.equal(o.y, 39);
    o.expandedBounds = { x: -4, y: 30, width: 40, height: 50 }; o.expand();
    assert.deepEqual(o.getEffectiveBounds(), { x: 0, y: 0, width: 24, height: 18 });
});

test('Endantwort invalidiert laufenden Poll und spaete Buchungsantworten', async () => {
    let resolve!: (v: any) => void, signal: AbortSignal | undefined;
    LearningPointsController.setPortFactory(() => ({ fetchSummary: s => { signal = s; return new Promise(r => { resolve = r; }); } }));
    const c = controller(), pending = c.refresh();
    c.freezeWithEndResponse({ ok: true, learning: summary() });
    assert.equal(signal?.aborted, true);
    resolve({ ok: true, learning: summary(3, 3) }); await pending;
    assert.equal(c.applyLearningResult({ ok: true, learning: summary(4, 4), learningEventId: 'late', pointsDelta: 1 }), null);
    assert.equal(c.snapshot().summary?.totalPoints, 2); assert.equal(c.snapshot().state, 'final');
});

test('Nur erfolgreiche Endantworten frieren ein', () => {
    const c = controller();
    for (const data of [undefined, null, {}, { ok: false }]) { c.freezeWithEndResponse(data); assert.equal(c.snapshot().frozen, false); }
});

test('Berechtigungsverlust friert letzten Stand ein und beendet Timer', async () => {
    LearningPointsController.setPortFactory(() => ({ fetchSummary: async () => ({ ok: false, status: 401 }) }));
    const c = controller(); c.applyLearningResult({ learning: summary() });
    const release = c.acquire(() => {}, 15); assert.equal(timers.size, 1);
    await c.refresh(); assert.equal(c.snapshot().state, 'final'); assert.equal(timers.size, 0); release();
});

test('Ohne geladenen Stand liefert Berechtigungsverlust keine Punkte', async () => {
    LearningPointsController.setPortFactory(() => ({ fetchSummary: async () => ({ ok: false, status: 403 }) }));
    const c = controller(); await c.refresh(); assert.equal(c.snapshot().summary, null); assert.equal(c.snapshot().state, 'unavailable');
});

test('Controller-Dedup und Versionsschutz erhalten neuesten Stand', () => {
    const c = controller(), result = { learning: summary(), learningEventId: 'one', pointsDelta: 1, previousBox: 5, box: 6 };
    assert.ok(c.applyLearningResult(result)); assert.equal(c.applyLearningResult(result), null);
    c.applyLearningResult({ learning: summary(1, 1) }); assert.equal(c.snapshot().summary?.totalPoints, 2);
});

test('Dispose wird nicht als toter Controller wiederverwendet', async () => {
    let calls = 0; LearningPointsController.setPortFactory(() => ({ fetchSummary: async () => { calls++; return { ok: true, learning: summary() }; } }));
    const objects = [{ name: 'CMS_LAUNCH', value: 'test' }], c = LearningPointsController.forRuntimeObjects(objects); controllers.push(c);
    await c.refresh(); c.dispose();
    const fresh = LearningPointsController.forRuntimeObjects(objects); controllers.push(fresh); await fresh.refresh();
    assert.notEqual(fresh, c); assert.equal(calls, 2);
});

test('Overlay hebt keine bereits bestehende Pause auf', () => {
    loop.start(); loop.pause(); const o = overlay(); o.pauseGame = true; o.expand(); o.collapse(); assert.equal(loop.getState(), 'paused');
});

test('Zwei Overlays und nachtraegliche externe Pause besitzen eigene Sperren', () => {
    loop.start(); const a = overlay('A'), b = overlay('B'); a.pauseGame = b.pauseGame = true;
    a.expand(); b.expand(); a.collapse(); assert.equal(loop.getState(), 'paused');
    loop.pause(); b.collapse(); assert.equal(loop.getState(), 'paused'); loop.resume(); assert.equal(loop.getState(), 'running');
});

test('Externes Resume loest keine Overlaypause', () => {
    loop.start(); const o = overlay(); o.pauseGame = true; o.expand(); loop.resume();
    assert.equal(loop.getState(), 'paused'); o.collapse(); assert.equal(loop.getState(), 'running');
});

test('Initial expanded erzeugt Pause, Backdrop und Fokus auch nach Loop-Initialisierung', () => {
    const o = overlay(), el = elementFor(o); o.initialState = 'expanded'; o.expandedModal = o.pauseGame = true;
    const events: string[] = []; o.initRuntime({ gridConfig: grid, handleEvent: (_id, name) => events.push(name) });
    loop.init([o], grid, () => {}); loop.start(); render(o, el);
    assert.equal(loop.getState(), 'paused'); assert.equal(dom.body.children.length, 2);
    assert.equal(dom.activeElement, el.querySelector('[data-overlay-close]')); assert.deepEqual(events, []);
    o.collapse(); assert.equal(loop.getState(), 'running');
});

test('Enter und Leertaste aktivieren genau einmal ohne Tastaturrepeat', () => {
    const el = new FakeElement(); let calls = 0;
    render({ isExpanded: false, isActivatable: () => true, activate: () => calls++, renderCompactContent() {} }, el);
    el.onkeydown!(key(el)); el.onkeydown!(key(el, { repeat: true })); assert.equal(calls, 1);
    el.onkeydown!(key(el, { key: ' ' })); assert.equal(calls, 2);
});

test('Detail-Button bekommt seine Tastaturereignisse und bleibt bei Updates erhalten', () => {
    const o = overlay(), el = elementFor(o); o.interactionMode = 'interactive'; o.expand(); render(o, el);
    const button = el.querySelector('[data-overlay-close]')!;
    el.onkeydown?.(key(button)); assert.equal(o.isExpanded, true);
    button.focus(); render(o, el); assert.equal(el.querySelector('[data-overlay-close]'), button); assert.equal(dom.activeElement, button);
});

test('Escape schliesst nur oberste Ansicht und Stop entfernt Listener und Backdrops', async () => {
    const a = overlay('A'), b = overlay('B'), ae = elementFor(a), be = elementFor(b);
    a.expandedModal = b.expandedModal = true; a.initRuntime({}); b.initRuntime({});
    a.expand(); render(a, ae); b.expand(); render(b, be);
    assert.ok(Number(be.style.zIndex) > Number(ae.style.zIndex));
    await dom.emit('keydown', key(be, { key: 'Escape' })); assert.equal(a.isExpanded, true); assert.equal(b.isExpanded, false);
    a.onRuntimeStop(); b.onRuntimeStop(); assert.equal(dom.body.children.length, 2);
    assert.equal(dom.listeners.get('keydown')?.size, 0);
});

test('Modale Detailansicht haelt Tab-Fokus innerhalb ihrer Bedienflaeche', async () => {
    const o = overlay(), el = elementFor(o); o.expandedModal = true; o.initRuntime({}); o.expand(); render(o, el);
    const button = el.querySelector('[data-overlay-close]')!; button.focus(); let prevented = false;
    await dom.emit('keydown', key(button, { key: 'Tab', preventDefault: () => { prevented = true; } }));
    assert.equal(prevented, true); assert.equal(dom.activeElement, button);
});

test('Lernpunkte-Updates feuern Datenereignisse und Stop entfernt Hinweis-Timer', () => {
    const o = new TLearningPointsOverlay('Points', 2, 2); overlays.push(o); o.refreshIntervalSeconds = 0;
    const events: string[] = []; o.initRuntime({ handleEvent: (_id, name) => events.push(name), objects: [] });
    o.applyLearningResult({ learning: summary() }); o.applyLearningResult({ learning: summary(3, 3), learningEventId: 'booked', pointsDelta: 1 });
    assert.equal(events.filter(e => e === 'onDataUpdated').length, 2);
    o.onRuntimeStop(); assert.equal(timers.size, 0);
});

test('Zwei Anzeigen teilen Abruf und Timer auch bei Intervall 0 einer Anzeige', async () => {
    let calls = 0;
    LearningPointsController.setPortFactory(() => ({ fetchSummary: async () => { calls++; return { ok: true, learning: summary() }; } }));
    const c = controller(), releaseA = c.acquire(() => {}, 15), releaseB = c.acquire(() => {}, 0);
    await c.refresh(); assert.equal(calls, 1); assert.equal(timers.size, 1);
    releaseB(); releaseB(); assert.equal(timers.size, 1);
    await c.refresh(); assert.equal(calls, 2);
    releaseA(); assert.equal(timers.size, 0);
});

test('Deklaratives Ausblenden entfernt Modalitaet und eigene Pause', () => {
    loop.start(); const o = overlay(), el = elementFor(o); o.pauseGame = o.expandedModal = true;
    o.initRuntime({}); o.expand(); render(o, el); o.visible = false;
    assert.equal(o.isExpanded, false); assert.equal(dom.body.children.length, 1);
    assert.equal(loop.getState(), 'running'); assert.equal(TInlineOverlay.topExpanded(), undefined);
});

test('DTO-Roundtrip bewahrt beide Geometrien, aber keine Laufzeitdaten', () => {
    const o = overlay(); o.interactionMode = 'interactive'; o.expandedBounds = { x: 10, y: 8, width: 24, height: 16 };
    o.previewExpanded = true; o.expand();
    const dto = o.toDTO(); assert.equal(dto.isExpanded, undefined); assert.equal(dto.previewExpanded, undefined);
    const restored = hydrateObjects([JSON.parse(JSON.stringify(dto))])[0] as TInlineOverlay; overlays.push(restored);
    assert.deepEqual(restored.expandedBounds, o.expandedBounds); assert.equal(restored.isExpanded, false);
    assert.equal(restored.activationAction, o.activationAction); assert.equal(restored.x, o.x);
});

test('Pausebesitz bleibt auch mit echten ReactiveRuntime-Proxies erhalten', () => {
    Object.assign(globalThis, { HTMLElement: FakeElement, Node: FakeElement });
    const raw = overlay(), o = makeReactive(raw, new PropertyWatcher());
    o.initialState = 'expanded'; o.pauseGame = true; o.initRuntime({ gridConfig: grid });
    loop.init([o], grid, () => {}); loop.start(); assert.equal(loop.getState(), 'paused');
    raw.collapse(); assert.equal(loop.getState(), 'running');
    assert.equal(TInlineOverlay.topExpanded(), undefined);
});

test('CmsGameHost fuehrt echte Weiterleitung und Frame-/Launch-/Actionpruefungen aus', async () => {
    const originalFetch = globalThis.fetch, keyValue = 'a'.repeat(48), sent: any[] = [];
    const launch = { name: 'SpielURL', value: '/play/' + keyValue };
    const runtime = { getObjects: () => [{ name: 'CMSServerPruefung' }, launch], stage: { id: 'stage_gallery' } };
    globalThis.fetch = (async (url: string, options?: any) => { sent.push({ url, body: options?.body }); return { ok: true, status: 200, headers: { get: () => 'text/html' }, json: async () => ({ ok: true, learning: summary() }) }; }) as any;
    const dispose = attachCmsGameHost(() => runtime);
    try {
        await [...timers.values()].find(t => t.delay === 100)!.fn();
        const frame = dom.body.querySelector('iframe')!; assert.ok(frame);
        const body = { launchKey: keyValue, action: 'cardPointSummary' }, message = { type: 'gcs-cms-bridge', id: 'summary', route: '/api/cms/play', body };
        await windowEvents.emit('message', { source: frame.contentWindow, origin: 'null', data: message });
        assert.equal(frame.contentWindow.messages.find((m: any) => m.id === 'summary')?.data.learning.totalPoints, 2);
        const count = sent.length;
        for (const data of [{ ...message, body: { ...body, action: 'unknown' } }, { ...message, body: { ...body, launchKey: 'b'.repeat(48) } }, { ...message, route: '/api/cms/admin' }]) {
            await windowEvents.emit('message', { source: frame.contentWindow, origin: 'null', data });
        }
        await windowEvents.emit('message', { source: {}, origin: 'null', data: message });
        await windowEvents.emit('message', { source: frame.contentWindow, origin: 'https://foreign.invalid', data: message });
        assert.equal(sent.length, count);
    } finally { dispose(); globalThis.fetch = originalFetch; }
});

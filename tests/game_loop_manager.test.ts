import { GameLoopManager } from '../src/runtime/GameLoopManager';
import { TSprite } from '../src/components/TSprite';
import { TGroupPanel } from '../src/components/TGroupPanel';

export function runTests() {
    let passed = 0;
    let failed = 0;

    const assert = (condition: boolean, message: string) => {
        if (condition) {
            passed++;
        } else {
            console.error(`❌ FAILED: ${message}`);
            failed++;
        }
    };

    const runTest = (name: string, fn: () => void) => {
        try {
            fn();
        } catch (e) {
            console.error(`❌ Error in test "${name}":`, e);
            failed++;
        } finally {
            GameLoopManager.getInstance().stop();
        }
    };

    const gridConfig = {
        cols: 64, rows: 40, cellSize: 16,
        snapToGrid: false, visible: true, backgroundColor: '#000000'
    };

    runTest('init erhält den Fast-Path für processFrame und requestRender', () => {
        const glm = GameLoopManager.getInstance();
        const moving = new TSprite('Moving', 5, 5, 2, 2);
        const stationary = new TSprite('Stationary', 20, 20, 2, 2);
        moving.velocityX = 1;
        const frames: { sprites: TSprite[]; dirty: TSprite[] | undefined }[] = [];
        let fullRenders = 0;
        glm.init([moving, stationary], gridConfig, () => { fullRenders++; }, undefined,
            (sprites, dirty) => frames.push({ sprites: [...sprites], dirty: dirty?.slice() }));

        glm.markSpriteDirty(moving);
        glm.markSpriteDirty(moving);
        assert(glm.processFrame(1, 0.5, 1 / 60), 'Ein bewegtes Sprite muss einen Frame erzeugen.');
        assert(frames.length === 1, 'processFrame muss den Fast-Path genau einmal aufrufen.');
        assert(frames[0]?.sprites.length === 2 && frames[0]?.sprites[0] === moving &&
            frames[0]?.sprites[1] === stationary, 'Fast-Path muss die echten Sprite-Referenzen erhalten.');
        assert(frames[0]?.dirty?.length === 1 && frames[0]?.dirty[0] === moving,
            'Fast-Path muss das markierte Sprite genau einmal als dirty erhalten.');
        assert(moving.x === 6 && moving.renderX === 6.5, 'Der echte Frame muss Bewegung und Interpolation anwenden.');

        glm.requestRender();
        assert(frames.length === 2, 'requestRender muss nach init ebenfalls den Fast-Path aufrufen.');
        assert(frames[1]?.sprites.length === 2 && frames[1]?.sprites[0] === moving &&
            frames[1]?.sprites[1] === stationary, 'requestRender muss die initialisierten Sprites erhalten.');
        assert(frames[1]?.dirty?.length === 0, 'Dirty-Sprites dürfen nicht in den nächsten Render-Aufruf durchsickern.');
        assert(moving.renderX === moving.x, 'requestRender muss Render-Koordinaten synchronisieren.');

        glm.markSpriteDirty(stationary);
        glm.requestRender();
        assert(frames.length === 3 && frames[2]?.dirty?.length === 1 && frames[2]?.dirty[0] === stationary,
            'requestRender muss neue Dirty-Sprites weiterreichen.');
        assert(fullRenders === 0, 'Mit Fast-Path darf kein vollständiger Render ausgelöst werden.');
    });

    runTest('init erhält den vollständigen Render-Fallback', () => {
        const glm = GameLoopManager.getInstance();
        const sprite = new TSprite('Fallback', 5, 5, 2, 2);
        sprite.velocityX = 1;
        let fullRenders = 0;
        glm.init([sprite], gridConfig, () => { fullRenders++; });
        assert(glm.processFrame(1, 0, 1 / 60), 'Der Fallback-Test muss einen echten Frame verarbeiten.');
        assert(fullRenders === 1, 'Ohne Fast-Path muss processFrame den vollständigen Render aufrufen.');
        glm.requestRender();
        assert(fullRenders === 2, 'Ohne Fast-Path muss requestRender den vollständigen Render aufrufen.');
    });

    runTest('Erneutes init ersetzt Callbacks, Sprites und Dirty-Zustand', () => {
        const glm = GameLoopManager.getInstance();
        const oldSprite = new TSprite('Old', 5, 5, 2, 2);
        const newSprite = new TSprite('New', 10, 10, 2, 2);
        newSprite.velocityX = 1;
        let oldFastRenders = 0;
        let oldFullRenders = 0;
        let newFullRenders = 0;
        const frames: { sprites: TSprite[]; dirty: TSprite[] | undefined }[] = [];
        glm.init([oldSprite], gridConfig, () => { oldFullRenders++; }, undefined,
            () => { oldFastRenders++; });
        glm.requestRender();
        assert(oldFastRenders === 1, 'Der ursprüngliche Callback muss vor erneutem init aktiv sein.');
        glm.markSpriteDirty(oldSprite);

        glm.init([newSprite], gridConfig, () => { oldFullRenders++; }, undefined,
            (sprites, dirty) => frames.push({ sprites: [...sprites], dirty: dirty?.slice() }));
        glm.processFrame(1, 0, 1 / 60);
        glm.requestRender();
        assert(frames.length === 2, 'Nach erneutem init muss nur der neue Fast-Path aktiv sein.');
        assert(frames.length === 2 && frames.every(frame => frame.sprites.length === 1 &&
            frame.sprites[0] === newSprite && frame.dirty?.length === 0),
            'Erneutes init darf weder alte Sprites noch Dirty-Markierungen weiterreichen.');
        assert(oldFastRenders === 1 && oldFullRenders === 0, 'Alte Callbacks dürfen nicht erneut aufgerufen werden.');

        glm.init([newSprite], gridConfig, () => { newFullRenders++; });
        glm.processFrame(1, 0, 1 / 60);
        glm.requestRender();
        assert(newFullRenders === 2, 'Erneutes init ohne Fast-Path muss den neuen Fallback aktivieren.');
        assert(frames.length === 2 && oldFastRenders === 1 && oldFullRenders === 0,
            'Beim Wechsel zum Fallback müssen alle vorherigen Callbacks ersetzt sein.');
    });

    for (const useFastPath of [true, false]) {
        runTest(`stop löst Render-Callbacks und RAF (${useFastPath ? 'Fast-Path' : 'Fallback'})`, () => {
            const glm = GameLoopManager.getInstance();
            const originalRequest = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame');
            const originalCancel = Object.getOwnPropertyDescriptor(globalThis, 'cancelAnimationFrame');
            const scheduled = new Map<number, FrameRequestCallback>();
            let nextId = 0;
            try {
                Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, writable: true,
                    value: (callback: FrameRequestCallback) => { scheduled.set(++nextId, callback); return nextId; } });
                Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true, writable: true,
                    value: (id: number) => { scheduled.delete(id); } });
                const sprite = new TSprite('Stopped', 5, 5, 2, 2);
                sprite.velocityX = 1;
                let fastRenders = 0;
                let fullRenders = 0;
                glm.init([sprite], gridConfig, () => { fullRenders++; }, undefined,
                    useFastPath ? () => { fastRenders++; } : undefined);
                glm.start();
                glm.requestRender();
                assert(scheduled.size === 1, 'start muss einen Browser-Frame planen.');
                assert(useFastPath ? fastRenders === 1 && fullRenders === 0 : fullRenders === 1 && fastRenders === 0,
                    'Vor stop muss der gewählte Render-Callback aktiv sein.');
                glm.markSpriteDirty(sprite);
                glm.stop();
                assert(glm.getState() === 'stopped' && scheduled.size === 0, 'stop muss den geplanten Browser-Frame entfernen.');
                assert(glm.getAndClearDirtySprites().length === 0, 'stop muss Dirty-Sprite-Referenzen entfernen.');
                assert(!glm.processFrame(1, 0, 1 / 60), 'Nach stop dürfen alte bewegte Sprites nicht weiterlaufen.');
                glm.requestRender();
                glm.enqueueTimerTick(() => {});
                assert(glm.processFrame(1, 0, 1 / 60), 'Der Callback-Test nach stop muss den Render-Pfad tatsächlich erreichen.');
                assert(useFastPath ? fastRenders === 1 && fullRenders === 0 : fullRenders === 1 && fastRenders === 0,
                    'Nach stop dürfen weder Fast-Path noch Fallback erneut aufgerufen werden.');
            } finally {
                glm.stop();
                if (originalRequest) Object.defineProperty(globalThis, 'requestAnimationFrame', originalRequest);
                else Reflect.deleteProperty(globalThis, 'requestAnimationFrame');
                if (originalCancel) Object.defineProperty(globalThis, 'cancelAnimationFrame', originalCancel);
                else Reflect.deleteProperty(globalThis, 'cancelAnimationFrame');
            }
        });
    }

    console.log('🧪 GameLoopManager Physics Collision Tests starten...');

    runTest('Coordinate Space Isolation: Sprite skips collision with its own parent Panel', () => {
        const glm = GameLoopManager.getInstance();
        let collisionEventFired = false;

        const panel = new TGroupPanel('Panel1', 10, 10, 100, 100);
        panel.id = 'panel_1';
        
        const childSprite = new TSprite('ChildSprite', 5, 5, 20, 20); // Relative coordinates inside panel
        childSprite.id = 'sprite_1';
        (childSprite as any).parentId = 'panel_1'; // Set parent relationship

        glm.init(
            [panel, childSprite] as any, 
            { cols: 64, rows: 40 } as any, 
            () => {}, 
            (id, eventName, args) => {
                if (eventName === 'onCollision') collisionEventFired = true;
            }
        );

        // Run the collision check loop
        (glm as any).checkCollisions();

        assert(!collisionEventFired, 'Child Sprite should NOT trigger onCollision with its own parent panel.');
    });

    runTest('Coordinate Space Isolation: Sprites in different coordinate spaces skip collision', () => {
        const glm = GameLoopManager.getInstance();
        let collisionEventFired = false;

        // Sprite 1 is on the Root Stage
        const rootSprite = new TSprite('RootSprite', 50, 50, 20, 20);
        rootSprite.id = 'sprite_root';
        
        // Sprite 2 is inside a Panel
        const panelSprite = new TSprite('PanelSprite', 50, 50, 20, 20); // Exactly same numbers, but different coordinate space
        panelSprite.id = 'sprite_panel';
        (panelSprite as any).parentId = 'some_panel_id';
        
        glm.init(
            [rootSprite, panelSprite] as any, 
            { cols: 64, rows: 40 } as any, 
            () => {}, 
            (id, eventName, args) => {
                if (eventName === 'onCollision') collisionEventFired = true;
            }
        );

        // Run the collision check loop
        (glm as any).checkCollisions();

        assert(!collisionEventFired, 'Sprites in different coordinate spaces should NOT collide, even if coordinates overlap numerically.');
    });

    runTest('Coordinate Space Isolation: Sprite vs Panel on different coordinate spaces skip collision', () => {
        const glm = GameLoopManager.getInstance();
        let collisionEventFired = false;

        // Panel is on Root Stage
        const rootPanel = new TGroupPanel('RootPanel', 10, 10, 100, 100);
        rootPanel.id = 'panel_root';
        
        // Sprite is inside ANOTHER Panel
        const otherPanelSprite = new TSprite('OtherPanelSprite', 15, 15, 20, 20);
        otherPanelSprite.id = 'sprite_other_panel';
        (otherPanelSprite as any).parentId = 'some_other_panel_id'; // Not the rootPanel!
        
        glm.init(
            [rootPanel, otherPanelSprite] as any, 
            { cols: 64, rows: 40 } as any, 
            () => {}, 
            (id, eventName, args) => {
                if (eventName === 'onCollision') collisionEventFired = true;
            }
        );

        // Run the collision check loop
        (glm as any).checkCollisions();

        assert(!collisionEventFired, 'Sprite inside a nested panel should NOT collide with a root panel, even if coordinates overlap.');
    });

    console.log(`\n  GameLoopManager Physics: ${passed} bestanden, ${failed} fehlgeschlagen`);
    if (failed > 0) {
        throw new Error('GameLoopManager Tests failed');
    }
}

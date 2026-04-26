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
        }
    };

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

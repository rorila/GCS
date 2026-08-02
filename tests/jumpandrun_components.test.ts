import { ComponentRegistry } from '../src/utils/ComponentRegistry';
import { TParallaxBackground } from '../src/components/TParallaxBackground';
import { TSpawner } from '../src/components/TSpawner';
import { TSpeedlines } from '../src/components/TSpeedlines';
import { TSpriteTemplate } from '../src/components/TSpriteTemplate';
import { actionRegistry } from '../src/runtime/ActionRegistry';
import { registerEffectActions } from '../src/runtime/actions/handlers/EffectActions';
import { pathToFileURL } from 'url';

export interface TestResult {
    name: string;
    type: string;
    expectedSuccess: boolean;
    actualSuccess: boolean;
    passed: boolean;
    details?: string;
}

function fakeElement(): any {
    const children: any[] = [];
    return {
        style: {} as Record<string, any>,
        clientWidth: 1280,
        clientHeight: 800,
        innerHTML: '',
        children,
        appendChild: (c: any) => { children.push(c); return c; },
        querySelector: () => null,
        querySelectorAll: () => [],
        classList: { add: () => {}, remove: () => {}, contains: () => false }
    };
}

function addResult(results: TestResult[], name: string, passed: boolean, details?: string): void {
    results.push({
        name,
        type: 'JumpAndRunComponents',
        expectedSuccess: true,
        actualSuccess: passed,
        passed,
        details
    });
}

export async function runTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // ═══════════════════════════════════════════════════════
    // 1. Neue Komponenten sind im ComponentRegistry registriert
    // ═══════════════════════════════════════════════════════
    try {
        const names = ComponentRegistry.getRegisteredComponents();
        if (!names.includes('TParallaxBackground')) throw new Error('TParallaxBackground fehlt');
        if (!names.includes('TSpawner')) throw new Error('TSpawner fehlt');
        if (!names.includes('TSpeedlines')) throw new Error('TSpeedlines fehlt');
        addResult(results, 'JumpAndRun Komponenten registriert', true);
    } catch (e: any) {
        addResult(results, 'JumpAndRun Komponenten registriert', false, e.message);
    }

    // ═══════════════════════════════════════════════════════
    // 2. TParallaxBackground: lokale Zeit-Integration
    // ═══════════════════════════════════════════════════════
    try {
        const bg = new TParallaxBackground('ParallaxBg', 0, 0, 64, 40);
        bg.baseSpeed = 10;
        (bg as any).running = true;
        (bg as any).runMode = true;
        (bg as any).element = fakeElement();
        bg.onRuntimeUpdate(0.1);
        const scrollX = (bg as any).scrollX;
        if (Math.abs(scrollX - 1.0) > 0.001) throw new Error(`scrollX=${scrollX}, erwartet 1.0`);
        addResult(results, 'TParallaxBackground lokale Scroll-Integration', true);
    } catch (e: any) {
        addResult(results, 'TParallaxBackground lokale Scroll-Integration', false, e.message);
    }

    // ═══════════════════════════════════════════════════════
    // 3. TParallaxBackground: scrollSource Binding
    // ═══════════════════════════════════════════════════════
    try {
        const bg = new TParallaxBackground('ParallaxBg', 0, 0, 64, 40);
        bg.scrollSource = '${gameTime}';
        bg.initRuntime({ contextVars: { gameTime: 42 } } as any);
        (bg as any).running = true;
        (bg as any).runMode = true;
        (bg as any).element = fakeElement();
        bg.onRuntimeUpdate(0.1);
        const scrollX = (bg as any).scrollX;
        if (scrollX !== 42) throw new Error(`scrollX=${scrollX}, erwartet 42`);
        addResult(results, 'TParallaxBackground scrollSource Binding', true);
    } catch (e: any) {
        addResult(results, 'TParallaxBackground scrollSource Binding', false, e.message);
    }

    // ═══════════════════════════════════════════════════════
    // 4. TSpawner: findet Template, spawnt und recyclet
    // ═══════════════════════════════════════════════════════
    try {
        const template = new TSpriteTemplate('PlatformTemplate', 0, 0, 4, 1);
        template.id = 'tpl_platform';
        template.velocityX = -4;

        const spawned: any[] = [];
        const destroyed: string[] = [];

        const spawner = new TSpawner('PlatformSpawner', 0, 0, 4, 2);
        spawner.templateName = 'PlatformTemplate';
        spawner.spawnInterval = 1;
        spawner.spawnX = 70;
        spawner.spawnYMin = 30;
        spawner.spawnYMax = 34;
        spawner.spawnCountStart = 1;
        spawner.velocityX = -5;
        spawner.recycleOffScreen = true;

        spawner.initRuntime({
            objects: [template],
            spawnObject: (tid: string, x?: number, y?: number) => {
                if (tid !== 'tpl_platform') return null;
                const inst = { id: `inst_${spawned.length}`, name: `Platform_${spawned.length}`, x, y, width: 4, velocityX: 0 };
                spawned.push(inst);
                return inst;
            },
            destroyObject: (id: string) => destroyed.push(id)
        } as any);

        spawner.onRuntimeStart();
        if (spawned.length !== 1) throw new Error(`Start-Spawns=${spawned.length}, erwartet 1`);
        if (spawned[0].velocityX !== -5) throw new Error('velocityX nicht überschrieben');

        // Simuliere Intervallablauf
        spawner.onRuntimeUpdate(2.0);
        const afterInterval = spawned.length as number;
        if (afterInterval !== 2) throw new Error(`Nach Intervall=${afterInterval}, erwartet 2`);

        // Bewege Instanz links aus dem Bild
        spawned[0].x = -10;
        spawner.onRuntimeUpdate(0.016);
        if (!destroyed.includes(spawned[0].id)) throw new Error('Instanz wurde nicht recyclet');

        addResult(results, 'TSpawner Spawn & Recycle', true);
    } catch (e: any) {
        addResult(results, 'TSpawner Spawn & Recycle', false, e.message);
    }

    // ═══════════════════════════════════════════════════════
    // 5. TSpeedlines: Eigenschaften korrekt gesetzt
    // ═══════════════════════════════════════════════════════
    try {
        const sl = new TSpeedlines('Speedlines', 0, 0, 64, 40);
        sl.lineCount = 16;
        sl.speed = 0.3;
        sl.lineColor = 'rgba(255,255,255,0.7)';
        if (sl.className !== 'TSpeedlines') throw new Error('className falsch');
        if (sl.lineCount !== 16) throw new Error('lineCount falsch');
        addResult(results, 'TSpeedlines Properties', true);
    } catch (e: any) {
        addResult(results, 'TSpeedlines Properties', false, e.message);
    }

    // ═══════════════════════════════════════════════════════
    // 6. EffectActions: shake_screen Action registriert
    // ═══════════════════════════════════════════════════════
    try {
        registerEffectActions();
        if (!actionRegistry.hasHandler('shake_screen')) {
            throw new Error('shake_screen nicht registriert');
        }
        const meta = actionRegistry.getMetadata('shake_screen');
        if (!meta || meta.type !== 'shake_screen') throw new Error('shake_screen Metadata fehlt');
        addResult(results, 'EffectActions shake_screen Registration', true);
    } catch (e: any) {
        addResult(results, 'EffectActions shake_screen Registration', false, e.message);
    }

    return results;
}

const isMainModule = import.meta.url === pathToFileURL(process.argv[1] || '').href;
if (isMainModule) {
    runTests().then(results => {
        const passed = results.filter(r => r.passed).length;
        const total = results.length;
        console.log(`Jump & Run Components: ${passed}/${total} Tests bestanden`);
        results.forEach(r => {
            console.log(`${r.passed ? '✅' : '❌'} ${r.name}${r.details ? ' - ' + r.details : ''}`);
        });
        if (passed !== total) process.exit(1);
    });
}

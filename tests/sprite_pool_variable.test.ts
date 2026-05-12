import { GameRuntime } from '../src/runtime/GameRuntime';
import { TSpriteTemplate } from '../src/components/TSpriteTemplate';
import { TVariable } from '../src/components/TVariable';
import { GameProject } from '../src/model/types';

/**
 * Test für SpritePool Variablen-Auflösung.
 * Verifiziert, dass poolSize Ausdrücke wie ${MaxCannons} korrekt aufgelöst werden,
 * auch wenn die Variable aus der Blueprint-Stage kommt.
 */
async function testSpritePoolVariable() {
    console.log('🧪 SpritePool Variable Tests starten...');

    // 1. Projekt-Setup mit Blueprint und Variable
    const project: GameProject = {
        meta: { name: 'PoolTest', version: '1.0' },
        activeStageId: 'main',
        stages: [
            {
                id: 'blueprint',
                name: 'Blueprint',
                type: 'blueprint',
                objects: [
                    {
                        className: 'TVariable',
                        id: 'var_max',
                        name: 'MaxPool',
                        scope: 'stage', // "stage" scope in Blueprint means it's inherited as local stage var
                        isVariable: true,
                        value: 25
                    }
                ],
                variables: []
            },
            {
                id: 'main',
                name: 'Main',
                type: 'main',
                objects: [
                    {
                        className: 'TSpriteTemplate',
                        id: 'tpl_ufo',
                        name: 'UfoTemplate',
                        poolSize: '${MaxPool}', // Hier ist die Variable!
                        autoRecycle: true
                    }
                ],
                variables: []
            }
        ]
    };

    // 2. Runtime initialisieren
    // Hinweis: Wir müssen Mocking für DOM/window betreiben, da GameRuntime darauf zugreift
    (global as any).window = {
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => {},
        location: { href: 'http://localhost' }
    };
    (global as any).document = {
        createElement: () => ({ style: {}, appendChild: () => {} }),
        body: { appendChild: () => {} }
    };

    const runtime = new GameRuntime(project, undefined, { makeReactive: false });
    
    // 3. Verifizieren
    const objects = runtime.getObjects();
    const template = objects.find(o => o.name === 'UfoTemplate') as TSpriteTemplate;
    
    // Der SpritePool sollte nun 25 Instanzen erzeugt haben
    // Wir prüfen die interne Liste der Sprites im Runtime (oder via SpritePool wenn zugänglich)
    // Da SpritePool privat ist, schauen wir uns die Objekte an, die registriert wurden.
    
    // In der GameRuntime werden die Pool-Instanzen in this.objects aufgenommen.
    const poolSprites = objects.filter(o => o.name && o.name.startsWith('UfoTemplate_pool_'));
    
    console.log(`Gefundene Pool-Sprites: ${poolSprites.length}`);

    if (poolSprites.length === 25) {
        console.log('✅ SpritePool Variable Resolution: ERFOLGREICH (25 Sprites)');
    } else {
        console.log(`❌ SpritePool Variable Resolution: FEHLGESCHLAGEN (Erwartet 25, erhalten ${poolSprites.length})`);
        process.exit(1);
    }
}

testSpritePoolVariable().catch(err => {
    console.error('Test-Error:', err);
    process.exit(1);
});

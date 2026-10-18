import { ActionExecutor } from '../src/runtime/ActionExecutor';
import { actionRegistry } from '../src/runtime/ActionRegistry';

export interface TestResult {
    name: string;
    passed: boolean;
    details?: string;
}

export async function runSpawnObjectVariableTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const addResult = (name: string, passed: boolean, details?: string) => results.push({ name, passed, details });

    let spawnedTemplateId: string | null = null;
    let spawnedX: number | undefined;
    let spawnedY: number | undefined;

    const mockObjects = [
        { id: 'bullet_id', name: 'BulletTemplate', className: 'TSpriteTemplate' },
        { id: 'player_id', name: 'Player', x: 100, y: 200 }
    ];

    const executor = new ActionExecutor(
        mockObjects,
        null,
        () => {},
        (id, x, y) => {
            spawnedTemplateId = id;
            spawnedX = x;
            spawnedY = y;
            return { id: 'spawned_inst' };
        }
    );

    // Test 1: Resolve templateId from variable
    try {
        spawnedTemplateId = null;
        const vars = { MyTemplate: 'BulletTemplate' };
        const action = { type: 'spawn_object', templateId: '${MyTemplate}', x: 50, y: 60 };
        await executor.execute(action, vars);
        
        const passed = spawnedTemplateId === 'bullet_id' && spawnedX === 50 && spawnedY === 60;
        addResult('spawn_object: Resolve templateId from variable', passed, `Expected bullet_id/50/60, got ${spawnedTemplateId}/${spawnedX}/${spawnedY}`);
    } catch (e: any) {
        addResult('spawn_object: Resolve templateId from variable', false, `Exception: ${e.message}`);
    }

    // Test 2: Resolve referenceObject from variable
    try {
        spawnedTemplateId = null;
        const vars = { TargetObj: 'Player' };
        const action = { type: 'spawn_object', templateId: 'BulletTemplate', referenceObject: '${TargetObj}', offsetX: 10, offsetY: 20 };
        await executor.execute(action, vars);
        
        const passed = spawnedTemplateId === 'bullet_id' && spawnedX === 110 && spawnedY === 220;
        addResult('spawn_object: Resolve referenceObject from variable', passed, `Expected bullet_id/110/220, got ${spawnedTemplateId}/${spawnedX}/${spawnedY}`);
    } catch (e: any) {
        addResult('spawn_object: Resolve referenceObject from variable', false, `Exception: ${e.message}`);
    }

    // Test 3: Metadata check
    try {
        const meta = actionRegistry.getMetadata('spawn_object');
        const templateParam = meta?.parameters.find(p => p.name === 'templateId');
        const refObjParam = meta?.parameters.find(p => p.name === 'referenceObject');
        
        const passed = templateParam?.type === 'string' && templateParam?.allowVariableBinding === true && 
                       refObjParam?.type === 'string' && refObjParam?.allowVariableBinding === true;
        addResult('spawn_object: Metadata check', passed, `templateId type: ${templateParam?.type}, refObj type: ${refObjParam?.type}`);
    } catch (e: any) {
        addResult('spawn_object: Metadata check', false, `Exception: ${e.message}`);
    }

    return results;
}

// Standalone execution
if (import.meta.url.includes(process.argv[1].replace(/\\/g, '/')) || process.argv[1].endsWith('spawn_object_variable.test.ts')) {
    runSpawnObjectVariableTests().then(results => {
        results.forEach(r => console.log(`${r.passed ? '✅' : '❌'} ${r.name}: ${r.details || ''}`));
        process.exit(results.every(r => r.passed) ? 0 : 1);
    });
}

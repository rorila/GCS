
import { dataService } from '../src/services/DataService';
import { InspectorContextBuilder } from '../src/editor/inspector/InspectorContextBuilder';
import { ReactiveRuntime } from '../src/runtime/ReactiveRuntime';

// --- environment Mocking ---
const mockStorage: Record<string, string> = {};
(global as any).window = {
    localStorage: {
        getItem: (key: string) => mockStorage[key] || null,
        setItem: (key: string, value: string) => { mockStorage[key] = value; },
        removeItem: (key: string) => { delete mockStorage[key]; }
    }
};
(global as any).localStorage = (global as any).window.localStorage;


export interface TestResult {
    name: string;
    type: string;
    expectedSuccess: boolean;
    actualSuccess: boolean;
    passed: boolean;
    details?: string;
}

async function runInspectorDiscoveryTests(): Promise<TestResult[]> {
    console.log("🧪 Testing Model Discovery Regression...");
    const results: TestResult[] = [];

    const addResult = (name: string, passed: boolean, details?: string) => {
        results.push({
            name,
            type: 'Discovery',
            expectedSuccess: true,
            actualSuccess: passed,
            passed,
            details
        });
    };

    try {
        // 1. Setup Mock Data in LocalStorage
        const testDb = {
            users: [{ id: 1, name: "Admin" }],
            rooms: [{ id: 101, title: "Lobby" }],
            config: { version: "1.0" } // Not a list, should be ignored by getModels
        };
        mockStorage['gcs_db_db.json'] = JSON.stringify(testDb);

        // 2. Test DataService.getModelsSync
        const models = dataService.getModelsSync('db.json');
        const modelsOk = models.includes('users') && models.includes('rooms') && !models.includes('config');
        addResult("DataService.getModelsSync", modelsOk, `Found: ${models.join(', ')}`);

        // 3. Test InspectorContextBuilder (Plural for object_list)
        // Needs ProjectRegistry setup
        const { ProjectRegistry } = await import('../src/services/ProjectRegistry');
        const project = {
            objects: [{ className: 'TDataStore', name: 'LocalStore', storagePath: 'db.json' }],
            variables: [],
            stages: []
        } as any;
        ProjectRegistry.getInstance().setProject(project);

        const selObjPlural = { type: 'object_list' };
        const contextPlural = InspectorContextBuilder.build(selObjPlural);
        const pluralOk = contextPlural.availableModels.includes('users');
        addResult("InspectorContextBuilder Plural Mapping", pluralOk, `Models: ${contextPlural.availableModels.join(', ')}`);

        // 4. Test InspectorContextBuilder (Singular for object)
        const selObjSingular = { type: 'object' };
        const contextSingular = InspectorContextBuilder.build(selObjSingular);
        const singularOk = contextSingular.availableModels.includes('user') && !contextSingular.availableModels.includes('users');
        addResult("InspectorContextBuilder Singular Mapping", singularOk, `Models: ${contextSingular.availableModels.join(', ')}`);

        // 5. Test getModelFieldsSync (Singular Fallback)
        const fields = dataService.getModelFieldsSync('db.json', 'user'); // Requesting 'user', should find 'users'
        const fieldsOk = fields.includes('name');
        addResult("Model Field Singular Fallback", fieldsOk, `Fields: ${fields.join(', ')}`);

    } catch (e: any) {
        addResult("Regression Test Execution", false, e.message);
    }

    return results;
}

// Standalone execution if called directly
const isMain = import.meta.url.includes(process.argv[1].replace(/\\/g, '/')) || process.argv[1].endsWith('inspector_discovery.test.ts');
if (isMain) {
    runInspectorDiscoveryTests().then(results => {
        const allPassed = results.every(r => r.passed);
        console.log(allPassed ? "✅ SUCCESS" : "❌ FAILED");
        process.exit(allPassed ? 0 : 1);
    });
}

export { runInspectorDiscoveryTests };

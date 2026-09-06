import { PropertyHelper } from '../src/runtime/PropertyHelper.js';
import { ExpressionParser } from '../src/runtime/ExpressionParser.js';
import { TestResult } from './test_login_logic.js';

/**
 * Verifiziert die Vereinheitlichung der Pfad-Auflösung und das automatische Unwrapping.
 */
export async function runUnificationTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // --- CASE 1: Unified Traversal (PropertyHelper + Variable + Array) ---
    const mockUserVar = {
        name: 'currentUser',
        isVariable: true,
        value: [{ id: 'u1', name: 'Rolf' }]
    };
    const context = { currentUser: mockUserVar };

    const nameValue = PropertyHelper.getPropertyValue(context, 'currentUser.name');
    const passed1 = nameValue === 'Rolf';
    results.push({
        name: 'Unification: PropertyHelper Traversal',
        type: 'Smart Mapping',
        passed: passed1,
        expectedSuccess: true,
        actualSuccess: passed1,
        details: `Value: ${nameValue} (Expected: 'Rolf')`
    });

    // --- CASE 2: ExpressionParser Integration ---
    const interpResult = ExpressionParser.interpolate('Hello ${currentUser.name}', context);
    const passed2 = interpResult === 'Hello Rolf';
    results.push({
        name: 'Unification: ExpressionParser Interpolation',
        type: 'Smart Mapping',
        passed: passed2,
        expectedSuccess: true,
        actualSuccess: passed2,
        details: `Result: ${interpResult}`
    });

    // --- CASE 3: Source unwrapping simulation (StandardActions Logic) ---
    // Wir simulieren hier die Logik aus StandardActions.ts:367
    let apiResponse: any = [{ id: 'u1', name: 'Rolf' }];
    let storedValue: any = apiResponse;

    // Simulate Smart-Unwrap
    if (Array.isArray(storedValue) && storedValue.length === 1) {
        storedValue = storedValue[0];
    }

    const passed3 = !Array.isArray(storedValue) && (storedValue as any)?.id === 'u1';
    results.push({
        name: 'Unification: Source-Level Unwrapping (Sim)',
        type: 'Smart Mapping',
        passed: passed3,
        expectedSuccess: true,
        actualSuccess: passed3,
        details: `Type: ${typeof storedValue}, IsArray: ${Array.isArray(storedValue)}`
    });

    // --- CASE 4: Deep Traversal Protection ---
    const deepData = {
        data: {
            items: [
                { meta: { version: 123 } }
            ]
        }
    };
    const ver = PropertyHelper.getPropertyValue(deepData, 'data.items.meta.version');
    const passed4 = ver === 123;
    results.push({
        name: 'Unification: Deep Path Auto-Unwrap',
        type: 'Smart Mapping',
        passed: passed4,
        expectedSuccess: true,
        actualSuccess: passed4,
        details: `Version: ${ver}`
    });

    return results;
}

// Direkte Ausführung
if (process.argv[1]?.endsWith('test_unification_regression.ts')) {
    runUnificationTests().then(res => {
        res.forEach(r => console.log(`${r.passed ? '✅' : '❌'} ${r.name}`));
    });
}

import { TTimer } from '../src/components/TTimer';

export interface TestResult {
    name: string;
    type: string;
    expectedSuccess: boolean;
    actualSuccess: boolean;
    passed: boolean;
    details?: string;
}

// Minimal Mocking für window.setInterval (da wir in Node laufen)
if (typeof (global as any).window === 'undefined') {
    (global as any).window = {} as any;
}
if (!(global as any).window.setInterval) {
    (global as any).window.setInterval = (() => 1) as any;
}
if (!(global as any).window.clearInterval) {
    (global as any).window.clearInterval = (() => {}) as any;
}

export async function runTimerVariableTests(): Promise<TestResult[]> {
    console.log("🧪 TTimer Variable Tests starten...");
    const results: TestResult[] = [];

    const addResult = (name: string, passed: boolean, details?: string) => {
        results.push({
            name,
            type: 'TTimer',
            expectedSuccess: true,
            actualSuccess: passed,
            passed,
            details
        });
    };

    // --- Test 1: Auflösung von maxInterval aus contextVars ---
    try {
        const timer = new TTimer('MyTimer', 0, 0);
        timer.maxInterval = '${maxTicks}';
        
        const contextVars = {
            maxTicks: 5
        };
        
        timer.initRuntime({ 
            handleEvent: () => {},
            contextVars,
            render: () => {},
            gridConfig: { cols: 10, rows: 10, cellSize: 20 },
            objects: []
        });
        
        timer.onRuntimeStart();
        
        const ok = timer.maxInterval === 5;
        addResult('TTimer: Auflösung aus contextVars', ok, `Ergebnis: ${timer.maxInterval} (erwartet: 5)`);
    } catch (e: any) {
        addResult('TTimer: Auflösung aus contextVars', false, `Exception: ${e.message}`);
    }

    // --- Test 2: Mathematische Ausdrücke in maxInterval ---
    try {
        const timer = new TTimer('MyTimer', 0, 0);
        timer.maxInterval = '${base} + 3';
        
        const contextVars = {
            base: 10
        };
        
        timer.initRuntime({ 
            handleEvent: () => {},
            contextVars,
            render: () => {},
            gridConfig: { cols: 10, rows: 10, cellSize: 20 },
            objects: []
        });
        
        timer.onRuntimeStart();
        
        const ok = timer.maxInterval === 13;
        addResult('TTimer: Mathematische Ausdrücke', ok, `Ergebnis: ${timer.maxInterval} (erwartet: 13)`);
    } catch (e: any) {
        addResult('TTimer: Mathematische Ausdrücke', false, `Exception: ${e.message}`);
    }

    // --- Test 3: Fallback bei fehlenden Variablen ---
    try {
        const timer = new TTimer('MyTimer', 0, 0);
        timer.maxInterval = '${nonExistent}';
        
        const contextVars = {};
        
        timer.initRuntime({ 
            handleEvent: () => {},
            contextVars,
            render: () => {},
            gridConfig: { cols: 10, rows: 10, cellSize: 20 },
            objects: []
        });
        
        timer.onRuntimeStart();
        
        const ok = timer.maxInterval === 0;
        addResult('TTimer: Fallback bei fehlenden Variablen', ok, `Ergebnis: ${timer.maxInterval} (erwartet: 0)`);
    } catch (e: any) {
        addResult('TTimer: Fallback bei fehlenden Variablen', false, `Exception: ${e.message}`);
    }

    return results;
}

// Standalone execution
const isMain = import.meta.url.includes(process.argv[1]?.replace(/\\/g, '/')) || process.argv[1]?.endsWith('timer_variable.test.ts');
if (isMain) {
    runTimerVariableTests().then(results => {
        results.forEach(r => {
            console.log(`${r.passed ? '✅' : '❌'} ${r.name}: ${r.details}`);
        });
        const allPassed = results.every(r => r.passed);
        console.log(`\n🧪 TTimer: ${results.filter(r => r.passed).length}/${results.length} bestanden.`);
        process.exit(allPassed ? 0 : 1);
    });
}

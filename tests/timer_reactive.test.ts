import { TTimer } from '../src/components/TTimer';
import { TIntervalTimer } from '../src/components/TIntervalTimer';
import { TestResult } from './timer_variable.test';

// Mocking für window (Node-Umgebung)
if (typeof (global as any).window === 'undefined') {
    (global as any).window = {} as any;
}

let activeIntervals = new Set<any>();
let activeTimeouts = new Set<any>();

(global as any).window.setInterval = ((cb: any, ms: number) => {
    const id = { cb, ms, type: 'interval' };
    activeIntervals.add(id);
    return id;
}) as any;

(global as any).window.clearInterval = ((id: any) => {
    activeIntervals.delete(id);
}) as any;

(global as any).window.setTimeout = ((cb: any, ms: number) => {
    const id = { cb, ms, type: 'timeout' };
    activeTimeouts.add(id);
    return id;
}) as any;

(global as any).window.clearTimeout = ((id: any) => {
    activeTimeouts.delete(id);
}) as any;

export async function runTimerReactiveTests(): Promise<TestResult[]> {
    console.log("🧪 TTimer/TIntervalTimer Reactive Tests starten...");
    const results: TestResult[] = [];

    const addResult = (name: string, passed: boolean, details?: string) => {
        results.push({
            name,
            type: 'TimerReactive',
            expectedSuccess: true,
            actualSuccess: passed,
            passed,
            details
        });
    };

    // Reset mocks
    activeIntervals.clear();
    activeTimeouts.clear();

    // --- Test 1: TTimer Default-Zustand ---
    try {
        const timer = new TTimer('TestTimer', 0, 0);
        const ok = timer.enabled === false;
        addResult('TTimer: Standardmäßig nicht aktiviert (enabled=false)', ok, `enabled: ${timer.enabled}`);
    } catch (e: any) {
        addResult('TTimer: Standardmäßig nicht aktiviert (enabled=false)', false, `Exception: ${e.message}`);
    }

    // --- Test 2: TIntervalTimer Default-Zustand ---
    try {
        const timer = new TIntervalTimer('TestIntervalTimer', 0, 0);
        const ok = timer.enabled === false;
        addResult('TIntervalTimer: Standardmäßig nicht aktiviert (enabled=false)', ok, `enabled: ${timer.enabled}`);
    } catch (e: any) {
        addResult('TIntervalTimer: Standardmäßig nicht aktiviert (enabled=false)', false, `Exception: ${e.message}`);
    }

    // --- Test 3: TTimer reaktives Starten ---
    try {
        activeIntervals.clear();
        const timer = new TTimer('TestTimer', 0, 0);
        timer.initRuntime({
            handleEvent: () => {},
            render: () => {},
            gridConfig: { cols: 10, rows: 10, cellSize: 20 },
            objects: []
        });

        timer.onRuntimeStart();
        // Da enabled false ist, sollte kein Interval gestartet sein
        const initiallyNoInterval = activeIntervals.size === 0;

        // Nun auf enabled = true setzen
        timer.enabled = true;

        const intervalStarted = activeIntervals.size === 1;
        const ok = initiallyNoInterval && intervalStarted;

        addResult('TTimer: Reaktives Starten bei enabled = true zur Laufzeit', ok, 
            `Vorher Intervalle: ${initiallyNoInterval ? '0' : activeIntervals.size}, Nachher: ${activeIntervals.size}`);
    } catch (e: any) {
        addResult('TTimer: Reaktives Starten bei enabled = true zur Laufzeit', false, `Exception: ${e.message}`);
    }

    // --- Test 4: TTimer reaktives Stoppen ---
    try {
        activeIntervals.clear();
        const timer = new TTimer('TestTimer', 0, 0);
        timer.initRuntime({
            handleEvent: () => {},
            render: () => {},
            gridConfig: { cols: 10, rows: 10, cellSize: 20 },
            objects: []
        });

        timer.enabled = true; // noch vor runtime start gesetzt
        timer.onRuntimeStart(); // Startet den timer

        const initiallyStarted = activeIntervals.size === 1;
        
        // Nun stoppen durch enabled = false
        timer.enabled = false;
        const stopped = activeIntervals.size === 0;
        const ok = initiallyStarted && stopped;

        addResult('TTimer: Reaktives Stoppen bei enabled = false zur Laufzeit', ok, 
            `Gestartet: ${initiallyStarted}, Nach enabled=false Intervalle: ${activeIntervals.size}`);
    } catch (e: any) {
        addResult('TTimer: Reaktives Stoppen bei enabled = false zur Laufzeit', false, `Exception: ${e.message}`);
    }

    // --- Test 5: TIntervalTimer reaktives Starten ---
    try {
        activeTimeouts.clear();
        const timer = new TIntervalTimer('TestIntervalTimer', 0, 0);
        timer.initRuntime({
            handleEvent: () => {}
        });

        timer.onRuntimeStart();
        const initiallyNoTimeout = activeTimeouts.size === 0;

        timer.enabled = true;
        const timeoutStarted = activeTimeouts.size === 1;
        const ok = initiallyNoTimeout && timeoutStarted;

        addResult('TIntervalTimer: Reaktives Starten bei enabled = true zur Laufzeit', ok, 
            `Vorher Timeouts: ${initiallyNoTimeout ? '0' : activeTimeouts.size}, Nachher: ${activeTimeouts.size}`);
    } catch (e: any) {
        addResult('TIntervalTimer: Reaktives Starten bei enabled = true zur Laufzeit', false, `Exception: ${e.message}`);
    }

    // --- Test 6: TIntervalTimer reaktives Stoppen ---
    try {
        activeTimeouts.clear();
        const timer = new TIntervalTimer('TestIntervalTimer', 0, 0);
        timer.initRuntime({
            handleEvent: () => {}
        });

        timer.enabled = true;
        timer.onRuntimeStart();

        const initiallyStarted = activeTimeouts.size === 1;
        
        timer.enabled = false;
        const stopped = activeTimeouts.size === 0;
        const ok = initiallyStarted && stopped;

        addResult('TIntervalTimer: Reaktives Stoppen bei enabled = false zur Laufzeit', ok, 
            `Gestartet: ${initiallyStarted}, Nach enabled=false Timeouts: ${activeTimeouts.size}`);
    } catch (e: any) {
        addResult('TIntervalTimer: Reaktives Stoppen bei enabled = false zur Laufzeit', false, `Exception: ${e.message}`);
    }

    // --- Test 7: TTimer currentInterval reaktive Updates ---
    try {
        activeIntervals.clear();
        const timer = new TTimer('TestTimer', 0, 0);
        
        // Simuliere ReactiveRuntime Registrierung
        const { PropertyWatcher } = await import('../src/runtime/PropertyWatcher.js');
        const { makeReactive } = await import('../src/runtime/ReactiveProperty.js');
        
        const watcher = new PropertyWatcher();
        const proxy = makeReactive(timer, watcher);
        (timer as any).__proxy__ = proxy; // Setze Proxy-Verbindung
        
        let watcherTriggeredCount = 0;
        watcher.watch(timer, 'currentInterval', () => {
            watcherTriggeredCount++;
        });

        // initRuntime mit dummy callbacks
        timer.initRuntime({
            handleEvent: () => {},
            render: () => {},
            gridConfig: { cols: 10, rows: 10, cellSize: 20 },
            objects: []
        });

        timer.onRuntimeStart();
        timer.enabled = true; // Setter läuft jetzt auf dem Proxy-Kontext dank __proxy__

        const interval = Array.from(activeIntervals)[0] as any;
        if (!interval) {
            throw new Error("Interval wurde nicht registriert");
        }

        // Ticks simulieren
        interval.cb();
        interval.cb();

        const ok = timer.currentInterval === 2 && watcherTriggeredCount === 2;
        addResult('TTimer: currentInterval Tick-Updates lösen reaktiv Watcher aus', ok,
            `Intervals: ${timer.currentInterval} (erwartet: 2), Watcher-Triggers: ${watcherTriggeredCount} (erwartet: 2)`);
    } catch (e: any) {
        addResult('TTimer: currentInterval Tick-Updates lösen reaktiv Watcher aus', false, `Exception: ${e.message}`);
    }

    // --- Test 8: TLabel Binding an TTimer.currentInterval ---
    try {
        activeIntervals.clear();
        const timer = new TTimer('StageTimer', 0, 0);
        const { TLabel } = await import('../src/components/TLabel.js');
        const label = new TLabel('ScoreLabel', 0, 0, '${StageTimer.currentInterval}');
        
        const { ReactiveRuntime } = await import('../src/runtime/ReactiveRuntime.js');
        const runtime = new ReactiveRuntime();
        
        const timerProxy = runtime.registerObject('StageTimer', timer);
        const labelProxy = runtime.registerObject('ScoreLabel', label);
        
        // Binding aufbauen
        runtime.bind(labelProxy, 'text', '${StageTimer.currentInterval}');
        
        // Initialer Wert sollte "0" sein
        const initOk = labelProxy.text === '0' || labelProxy.text === 0;
        
        timerProxy.initRuntime({
            handleEvent: () => {},
            render: () => {},
            gridConfig: { cols: 10, rows: 10, cellSize: 20 },
            objects: []
        });
        
        timerProxy.onRuntimeStart();
        timerProxy.enabled = true;
        
        const interval = Array.from(activeIntervals)[0] as any;
        if (!interval) {
            throw new Error("Interval für StageTimer nicht gestartet!");
        }
        
        // Ticks simulieren
        interval.cb();
        const tick1Ok = labelProxy.text === '1' || labelProxy.text === 1;
        
        interval.cb();
        const tick2Ok = labelProxy.text === '2' || labelProxy.text === 2;
        
        const ok = initOk && tick1Ok && tick2Ok;
        addResult('TTimer: TLabel Binding an StageTimer.currentInterval wird reaktiv aktualisiert', ok,
            `Initial: "${labelProxy.text}" (erwartet: 0), Tick 1: "${labelProxy.text}" (erwartet: 1), Tick 2: "${labelProxy.text}" (erwartet: 2)`);
    } catch (e: any) {
        addResult('TTimer: TLabel Binding an StageTimer.currentInterval wird reaktiv aktualisiert', false, `Exception: ${e.message}`);
    }

    return results;
}

// Standalone execution
const isMain = import.meta.url.includes(process.argv[1]?.replace(/\\/g, '/')) || process.argv[1]?.endsWith('timer_reactive.test.ts');
if (isMain) {
    runTimerReactiveTests().then(results => {
        results.forEach(r => {
            console.log(`${r.passed ? '✅' : '❌'} ${r.name}: ${r.details}`);
        });
        const allPassed = results.every(r => r.passed);
        console.log(`\n🧪 TTimer Reactive: ${results.filter(r => r.passed).length}/${results.length} bestanden.`);
        process.exit(allPassed ? 0 : 1);
    });
}

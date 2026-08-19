import { TestResult } from '../scripts/test_login_logic.js';
import { ReactiveRuntime } from '../src/runtime/ReactiveRuntime.js';

/**
 * Sichert das gezielte Auffrischen ab.
 *
 * Vorher frischte jede Variablenaenderung ALLE Objekte der Buehne auf. Bei einer
 * Zeitanzeige im Sekundentakt fuehrte das zu sekuendlichen Aussetzern. Diese Tests
 * halten fest, dass nur noch die abhaengigen Objekte ermittelt werden -- und dass
 * eine Variable ohne bekannte Bindung erkennbar bleibt, damit der Aufrufer auf das
 * alte Verhalten zurueckfallen kann.
 */
export async function runReactiveTargetedUpdateTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    const makeBinding = (targetObj: any, dependencies: string[]) => ({
        id: `b_${Math.random()}`,
        targetObj,
        targetProp: 'caption',
        expression: '${x}',
        dependencies,
        update: () => { }
    });

    const label = { id: 'lbl1', name: 'Zeitanzeige' };
    const other = { id: 'lbl2', name: 'Punktestand' };

    const rt = new ReactiveRuntime();
    const bindings: Map<string, any[]> = (rt as any).bindings;
    bindings.set('b1', [makeBinding(label, ['timeLeft'])]);
    bindings.set('b2', [makeBinding(other, ['score'])]);
    // Zweite Bindung auf dasselbe Objekt: darf nicht doppelt gemeldet werden.
    bindings.set('b3', [makeBinding(label, ['timeLeft', 'score'])]);

    // --- Test 1: Nur das abhaengige Objekt wird gemeldet ---
    const deps = rt.getObjectsDependingOn('timeLeft');
    const p1 = deps.length === 1 && deps[0] === label;

    results.push({
        name: 'ReactiveRuntime: nur abhaengige Objekte je Variable',
        type: 'Happy Path',
        passed: p1,
        expectedSuccess: true,
        actualSuccess: p1,
        details: `${deps.length} Objekt(e) fuer "timeLeft" (erwartet 1: Zeitanzeige)`
    });

    // --- Test 2: Mehrere Abhaengige werden vollstaendig gemeldet ---
    const scoreDeps = rt.getObjectsDependingOn('score');
    const p2 = scoreDeps.length === 2
        && scoreDeps.includes(label)
        && scoreDeps.includes(other);

    results.push({
        name: 'ReactiveRuntime: alle Abhaengigen einer Variable',
        type: 'Happy Path',
        passed: p2,
        expectedSuccess: true,
        actualSuccess: p2,
        details: `${scoreDeps.length} Objekt(e) fuer "score" (erwartet 2)`
    });

    // --- Test 3: Unbekannte Variable ergibt eine leere Liste ---
    // Das ist das Signal fuer den Aufrufer, auf das alte Verhalten zurueckzufallen.
    const unknown = rt.getObjectsDependingOn('gibtEsNicht');
    const p3 = unknown.length === 0;

    results.push({
        name: 'ReactiveRuntime: unbekannte Variable meldet leer',
        type: 'Edge Case',
        passed: p3,
        expectedSuccess: true,
        actualSuccess: p3,
        details: `${unknown.length} Objekt(e) (erwartet 0 als Rueckfall-Signal)`
    });

    // --- Test 4: Zusammengesetzte Abhaengigkeit wird erkannt ---
    // Die Zeitanzeige bindet oft ${StageTimer.currentInterval}.
    const timerLabel = { id: 'lbl3', name: 'TimerAnzeige' };
    bindings.set('b4', [makeBinding(timerLabel, ['StageTimer.currentInterval'])]);
    const timerDeps = rt.getObjectsDependingOn('StageTimer');
    const p4 = timerDeps.length === 1 && timerDeps[0] === timerLabel;

    results.push({
        name: 'ReactiveRuntime: zusammengesetzte Abhaengigkeit erkannt',
        type: 'Happy Path',
        passed: p4,
        expectedSuccess: true,
        actualSuccess: p4,
        details: `${timerDeps.length} Objekt(e) fuer "StageTimer" (erwartet 1)`
    });

    // --- Test 5: Ersparnis gegenueber dem Rundumschlag ---
    // 30 Memory-Karten, von denen keine die Zeitanzeige bindet.
    const cards = Array.from({ length: 30 }, (_, i) => ({ id: `card${i}`, name: `Karte${i}` }));
    const allObjects = [...cards, label, other, timerLabel];
    const refreshed = rt.getObjectsDependingOn('timeLeft').length;
    const p5 = refreshed === 1 && allObjects.length === 33;

    results.push({
        name: 'ReactiveRuntime: Zeitanzeige frischt nicht die Karten auf',
        type: 'Happy Path',
        passed: p5,
        expectedSuccess: true,
        actualSuccess: p5,
        details: `${refreshed} von ${allObjects.length} Objekten (vorher alle ${allObjects.length})`
    });

    return results;
}

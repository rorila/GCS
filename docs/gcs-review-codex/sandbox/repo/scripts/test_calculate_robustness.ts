import { ExpressionParser } from '../src/runtime/ExpressionParser';
import { PropertyHelper } from '../src/runtime/PropertyHelper';

/**
 * TEST: Calculate Variable Robustness (v2.18.9)
 * 🔬 Prüft die Kern-Logik des ExpressionParsers und der Variablen-Synchronisation.
 */
async function runTest() {
    console.log("===================================================");
    console.log("🧪 TEST: CALCULATE VARIABLE ROBUSTNESS");
    console.log("===================================================");

    let successCount = 0;
    let failCount = 0;

    const test = (name: string, fn: () => void) => {
        try {
            fn();
            console.log(`✅ ${name}`);
            successCount++;
        } catch (e: any) {
            console.log(`❌ ${name}: ${e.message}`);
            failCount++;
        }
    };

    // 1. Kontext mit Proxy simulieren (wie contextVars in der Runtime)
    const rawVars: Record<string, any> = { score: 10 };
    const proxyContext = new Proxy(rawVars, {
        get: (target, prop: string) => target[prop],
        set: (target, prop: string, val) => { target[prop] = val; return true; }
    });

    // 2. Tests für den ExpressionParser
    test("Sollte Variablen in einem Proxy finden (Dependencies)", () => {
        const result = ExpressionParser.evaluate("score + 5", proxyContext);
        if (result !== 15) throw new Error(`Erwartet 15, erhalten ${result}`);
    });

    test("Sollte undefined als leeren String behandeln (String-Konkatenation)", () => {
        // currentPIN ist nicht im Proxy/Target definiert -> undefined
        const result = ExpressionParser.evaluate("currentPIN + '🍎'", proxyContext);
        if (result !== "🍎") throw new Error(`Erwartet "🍎", erhalten "${result}" (Prüfen auf "undefined🍎")`);
    });

    test("Sollte Emojis korrekt konkatenieren", () => {
        proxyContext.currentPIN = "🍎";
        const result = ExpressionParser.evaluate("currentPIN + '🍌'", proxyContext);
        if (result !== "🍎🍌") throw new Error(`Erwartet "🍎🍌", erhalten "${result}"`);
    });

    test("Sollte komplexe Pfade auflösen (PinPicker.selectedEmoji)", () => {
        proxyContext.currentPIN = "🍎🍌"; // Fix state for this test
        const objects = [
            { name: 'PinPicker', selectedEmoji: '🍇' }
        ];
        // Simuliere den evalContext aus StandardActions.ts
        const evalContext = {
            PinPicker: objects[0],
            ...proxyContext
        };
        const result = ExpressionParser.evaluate("currentPIN + PinPicker.selectedEmoji", evalContext);
        if (result !== "🍎🍌🍇") throw new Error(`Erwartet "🍎🍌🍇", erhalten "${result}"`);
    });

    test("Sollte mathematische Operationen weiterhin korrekt ausführen", () => {
        const result = ExpressionParser.evaluate("score * 2", proxyContext);
        if (result !== 20) throw new Error(`Erwartet 20, erhalten ${result}`);
    });

    console.log("\n---------------------------------------------------");
    console.log(`ERGEBNIS: ${successCount} erfolgreich, ${failCount} fehlgeschlagen`);
    console.log("---------------------------------------------------");

    if (failCount > 0) process.exit(1);
}

runTest().catch(e => {
    console.error("Test-Runner Fehler:", e);
    process.exit(1);
});

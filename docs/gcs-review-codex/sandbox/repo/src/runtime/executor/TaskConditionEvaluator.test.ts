import { TaskConditionEvaluator } from './TaskConditionEvaluator';
import kopfrechnen from '../../../game-server/public/projects/Kopfrechnen-App.json';

/**
 * Tests fuer die Bedingungs-Operatoren truthy/falsy/in/not in.
 * Run with: npx tsx src/runtime/executor/TaskConditionEvaluator.test.ts
 */

let passCount = 0;
let failCount = 0;

const check = (name: string, actual: boolean, expected: boolean) => {
    if (actual === expected) {
        console.log(`✅ PASS: ${name}`);
        passCount++;
    } else {
        console.error(`❌ FAIL: ${name} — erwartet ${expected}, erhalten ${actual}`);
        failCount++;
    }
};

const card = { id: 'card-1', question: '2x2', answers: ['4', 'vier'], answerFormat: 'text' };
const vars: Record<string, any> = {
    KartenAntwort: { ok: true, card },
    LeereAntwort: { ok: true, empty: true },
    FehlerAntwort: { ok: false, message: 'nicht erreichbar' },
    AktuelleKarte: card,
    Eingabe: '4',
    TextEingabe: 'vier',
    FalscheEingabe: '5',
};
const globals: Record<string, any> = {};
const ev = (condition: any) => TaskConditionEvaluator.evaluateCondition(condition, vars, globals);

// --- truthy ---
check('truthy: Objekt ist truthy', ev({ variable: 'KartenAntwort.card', operator: 'truthy' }), true);
check('truthy: fehlende Karte ist falsy', ev({ variable: 'LeereAntwort.card', operator: 'truthy' }), false);
check('truthy: nicht vorhandene Variable ist falsy', ev({ variable: 'NichtVorhanden', operator: 'truthy' }), false);
check('truthy: nicht-leerer String ist truthy', ev({ variable: 'Eingabe', operator: 'truthy' }), true);
check('truthy: String „false" ist falsy (Server-Semantik)', ev({ variable: 'FehlerAntwort.ok', operator: 'truthy' }), false);
check('falsy: String „false" ist falsy', ev({ variable: 'FehlerAntwort.ok', operator: 'falsy' }), true);

// --- falsy ---
check('falsy: fehlende Karte ist falsy', ev({ variable: 'LeereAntwort.card', operator: 'falsy' }), true);
check('falsy: Objekt ist nicht falsy', ev({ variable: 'KartenAntwort.card', operator: 'falsy' }), false);

// --- in ---
check('in: Wert in answers-Array', ev({ variable: 'Eingabe', operator: 'in', value: '${AktuelleKarte.answers}' }), true);
check('in: Textvariante aus der Antwortliste', ev({ variable: 'TextEingabe', operator: 'in', value: '${AktuelleKarte.answers}' }), true);
check('in: nicht enthaltener Wert ist false', ev({ variable: 'FalscheEingabe', operator: 'in', value: '${AktuelleKarte.answers}' }), false);
check('in: Teiltext ist KEIN Treffer („4" nicht in „42")', ev({ variable: 'Eingabe', operator: 'in', value: '42' }), false);
check('in: String ist keine Liste (Server-Semantik)', ev({ variable: 'Eingabe', operator: 'in', value: '4, 8, 15' }), false);
check('in: unaufgeloester Pfad ist false', ev({ variable: 'Eingabe', operator: 'in', value: '${Fehlt.Komplett}' }), false);
check('in: Zahlen/String-Typmischung wird verglichen', ev({ variable: 'Eingabe', operator: 'in', value: [4, 8, 15] }), true);

// --- not in ---
check('not in: nicht enthaltener Wert', ev({ variable: 'FalscheEingabe', operator: 'not in', value: '${AktuelleKarte.answers}' }), true);
check('not in: enthaltener Wert ist false', ev({ variable: 'Eingabe', operator: 'not in', value: '${AktuelleKarte.answers}' }), false);

// --- Regression: bestehende Operatoren unveraendert ---
check('==: ok true erkannt', ev({ variable: 'KartenAntwort.ok', operator: '==', value: true }), true);
check('!=: ok false != true', ev({ variable: 'FehlerAntwort.ok', operator: '!=', value: true }), true);
check('==: Fehler ok ist nicht true', ev({ variable: 'FehlerAntwort.ok', operator: '==', value: true }), false);
check('!=: Zahl', ev({ variable: 'Eingabe', operator: '!=', value: 5 }), true);

const ziehen = kopfrechnen.stages[0].tasks.find(t => t.name === 'Aufgabe_Ziehen')!.actionSequence[0] as any;
for (const [aufgabenNr, aufgaben, beendet] of [[0, 10, false], [9, 10, false], [10, 10, true], [11, 10, true], [2, 3, false], [3, 3, true]] as const) {
    const result = TaskConditionEvaluator.evaluateCondition(ziehen.condition, { AufgabenNr: aufgabenNr, Aufgaben: aufgaben }, {});
    check(`Kopfrechnen: Abschluss bei ${aufgabenNr} von ${aufgaben}`, result, beendet);
    const branch = result ? ziehen.body : ziehen.elseBody;
    check(`Kopfrechnen: Abschluss-Task bei ${aufgabenNr} von ${aufgaben}`, branch.some((item: any) => item.type === 'task' && item.name === 'Abschluss'), beendet);
}
check('Kopfrechnen: Rundenlimit als Textwert', TaskConditionEvaluator.evaluateCondition(ziehen.condition, { AufgabenNr: '10', Aufgaben: '10' }, {}), true);

console.log(`\n${passCount} bestanden, ${failCount} fehlgeschlagen.`);
process.exit(failCount ? 1 : 0);

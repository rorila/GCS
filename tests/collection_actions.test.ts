/**
 * Test: Feature B — Collection-Actions (14 ActionTypes)
 * 
 * Testet alle 14 Collection-Actions über den ActionExecutor.
 */
import { ActionExecutor } from '../src/runtime/ActionExecutor';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
    if (condition) {
        console.log(`  ✅ ${testName}`);
        passed++;
    } else {
        console.error(`  ❌ ${testName}`);
        failed++;
    }
}

// ActionExecutor initialisiert automatisch registerStandardActions() inkl. CollectionActions
const executor = new ActionExecutor([]);
const vars: Record<string, any> = {};
const globalVars: Record<string, any> = {};

console.log('═══════════════════════════════════════');
console.log('TEST: Feature B — Collection-Actions');
console.log('═══════════════════════════════════════');

// ─── Test 1: list_push ───
console.log('\n[Test 1: list_push]');
{
    globalVars['myList'] = [];
    await executor.execute({ type: 'list_push', target: 'myList', value: 'apple' }, vars, globalVars);
    await executor.execute({ type: 'list_push', target: 'myList', value: 'banana' }, vars, globalVars);
    assert(Array.isArray(globalVars['myList']), 'myList ist ein Array');
    assert(globalVars['myList'].length === 2, 'myList hat 2 Elemente');
    assert(globalVars['myList'][0] === 'apple', 'Element 0 = apple');
    assert(globalVars['myList'][1] === 'banana', 'Element 1 = banana');
}

// ─── Test 2: list_pop ───
console.log('\n[Test 2: list_pop]');
{
    await executor.execute({ type: 'list_pop', target: 'myList', resultVariable: 'popped' }, vars, globalVars);
    assert(globalVars['popped'] === 'banana', 'Popped = banana');
    assert(globalVars['myList'].length === 1, 'myList hat 1 Element');
}

// ─── Test 3: list_get ───
console.log('\n[Test 3: list_get]');
{
    globalVars['fruits'] = ['🍎', '🍊', '🍋'];
    await executor.execute({ type: 'list_get', target: 'fruits', index: '1', resultVariable: 'got' }, vars, globalVars);
    assert(globalVars['got'] === '🍊', 'Index 1 = 🍊');
}

// ─── Test 4: list_get out-of-bounds → defaultValue ───
console.log('\n[Test 4: list_get out-of-bounds]');
{
    await executor.execute({ type: 'list_get', target: 'fruits', index: '99', resultVariable: 'oob', defaultValue: 'N/A' }, vars, globalVars);
    assert(globalVars['oob'] === 'N/A', 'Out-of-bounds → defaultValue "N/A"');
}

// ─── Test 5: list_set ───
console.log('\n[Test 5: list_set]');
{
    globalVars['nums'] = [10, 20, 30];
    await executor.execute({ type: 'list_set', target: 'nums', index: '1', value: '99' }, vars, globalVars);
    assert(globalVars['nums'][1] === '99', 'Index 1 = 99 (gesetzt)');
}

// ─── Test 6: list_remove ───
console.log('\n[Test 6: list_remove]');
{
    globalVars['letters'] = ['a', 'b', 'c', 'd'];
    await executor.execute({ type: 'list_remove', target: 'letters', index: '1', resultVariable: 'removed' }, vars, globalVars);
    assert(globalVars['removed'] === 'b', 'Entfernt: b');
    assert(globalVars['letters'].length === 3, 'Länge = 3');
    assert(globalVars['letters'][1] === 'c', 'Index 1 ist jetzt c');
}

// ─── Test 7: list_clear ───
console.log('\n[Test 7: list_clear]');
{
    globalVars['toClear'] = [1, 2, 3];
    await executor.execute({ type: 'list_clear', target: 'toClear' }, vars, globalVars);
    assert(Array.isArray(globalVars['toClear']), 'Ist noch Array');
    assert(globalVars['toClear'].length === 0, 'Länge = 0');
}

// ─── Test 8: list_shuffle (mit seed für Determinismus) ───
console.log('\n[Test 8: list_shuffle mit seed]');
{
    globalVars['deck1'] = [1, 2, 3, 4, 5, 6, 7, 8];
    globalVars['deck2'] = [1, 2, 3, 4, 5, 6, 7, 8];
    await executor.execute({ type: 'list_shuffle', target: 'deck1', seed: '42' }, vars, globalVars);
    await executor.execute({ type: 'list_shuffle', target: 'deck2', seed: '42' }, vars, globalVars);
    const d1 = JSON.stringify(globalVars['deck1']);
    const d2 = JSON.stringify(globalVars['deck2']);
    assert(d1 === d2, `Gleicher Seed → gleiche Reihenfolge: ${d1}`);
    assert(d1 !== '[1,2,3,4,5,6,7,8]', 'Liste wurde tatsächlich gemischt');
}

// ─── Test 9: list_contains ───
console.log('\n[Test 9: list_contains]');
{
    globalVars['colors'] = ['red', 'green', 'blue'];
    await executor.execute({ type: 'list_contains', target: 'colors', value: 'green', resultVariable: 'hasGreen' }, vars, globalVars);
    assert(globalVars['hasGreen'] === true, 'Enthält "green" → true');
    await executor.execute({ type: 'list_contains', target: 'colors', value: 'yellow', resultVariable: 'hasYellow' }, vars, globalVars);
    assert(globalVars['hasYellow'] === false, 'Enthält "yellow" → false');
}

// ─── Test 10: list_length ───
console.log('\n[Test 10: list_length]');
{
    globalVars['items'] = ['a', 'b', 'c', 'd', 'e'];
    await executor.execute({ type: 'list_length', target: 'items', resultVariable: 'count' }, vars, globalVars);
    assert(globalVars['count'] === 5, 'Länge = 5');
}

// ─── Test 11: map_set + map_get ───
console.log('\n[Test 11: map_set + map_get]');
{
    globalVars['config'] = {};
    await executor.execute({ type: 'map_set', target: 'config', key: 'theme', value: 'dark' }, vars, globalVars);
    await executor.execute({ type: 'map_set', target: 'config', key: 'lang', value: 'de' }, vars, globalVars);
    await executor.execute({ type: 'map_get', target: 'config', key: 'theme', resultVariable: 'readTheme' }, vars, globalVars);
    assert(globalVars['readTheme'] === 'dark', 'theme = dark');
}

// ─── Test 12: map_get mit defaultValue ───
console.log('\n[Test 12: map_get missing key]');
{
    await executor.execute({ type: 'map_get', target: 'config', key: 'missing', resultVariable: 'miss', defaultValue: 'fallback' }, vars, globalVars);
    assert(globalVars['miss'] === 'fallback', 'Fehlender Key → defaultValue "fallback"');
}

// ─── Test 13: map_delete + map_has ───
console.log('\n[Test 13: map_delete + map_has]');
{
    await executor.execute({ type: 'map_has', target: 'config', key: 'lang', resultVariable: 'beforeDelete' }, vars, globalVars);
    assert(globalVars['beforeDelete'] === true, 'lang existiert vor Delete');
    await executor.execute({ type: 'map_delete', target: 'config', key: 'lang' }, vars, globalVars);
    await executor.execute({ type: 'map_has', target: 'config', key: 'lang', resultVariable: 'afterDelete' }, vars, globalVars);
    assert(globalVars['afterDelete'] === false, 'lang existiert NICHT nach Delete');
}

// ─── Test 14: map_keys ───
console.log('\n[Test 14: map_keys]');
{
    globalVars['inventory'] = { sword: 1, shield: 2, potion: 5 };
    await executor.execute({ type: 'map_keys', target: 'inventory', resultVariable: 'invKeys' }, vars, globalVars);
    assert(Array.isArray(globalVars['invKeys']), 'invKeys ist ein Array');
    assert(globalVars['invKeys'].includes('sword'), 'Enthält "sword"');
    assert(globalVars['invKeys'].includes('shield'), 'Enthält "shield"');
    assert(globalVars['invKeys'].includes('potion'), 'Enthält "potion"');
    assert(globalVars['invKeys'].length === 3, 'Hat 3 Keys');
}

// ─── Zusammenfassung ───
console.log('\n═══════════════════════════════════════');
console.log(`Collection-Actions Tests: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════');

if (failed > 0) process.exit(1);

/**
 * Test: Feature A — Event-Context ($event + self)
 * 
 * Testet die korrekte Erzeugung, Injektion und Auflösung
 * von $event und self Magic-Variablen.
 */
import { buildEventContext, EMPTY_EVENT_CONTEXT, RESERVED_VARIABLE_NAMES } from '../src/runtime/EventContext';
import { ExpressionParser } from '../src/runtime/ExpressionParser';

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

console.log('═══════════════════════════════════════');
console.log('TEST: Feature A — Event-Context');
console.log('═══════════════════════════════════════');

// ─── Test 1: buildEventContext erzeugt korrekten Kontext ───
console.log('\n[Test 1: buildEventContext]');
{
    const ctx = buildEventContext(
        { name: 'Card_3', className: 'TButton', stageId: 'stage_main' },
        'onClick',
        { x: 100, y: 200 }
    );
    assert(ctx.source.name === 'Card_3', 'source.name = Card_3');
    assert(ctx.source.className === 'TButton', 'source.className = TButton');
    assert(ctx.source.stageId === 'stage_main', 'source.stageId = stage_main');
    assert(ctx.event === 'onClick', 'event = onClick');
    assert(ctx.data.x === 100, 'data.x = 100');
    assert(ctx.data.y === 200, 'data.y = 200');
    assert(ctx.timestamp > 0, 'timestamp > 0');
}

// ─── Test 2: EMPTY_EVENT_CONTEXT ───
console.log('\n[Test 2: EMPTY_EVENT_CONTEXT]');
{
    assert(EMPTY_EVENT_CONTEXT.source.name === '__system__', 'source.name = __system__');
    assert(EMPTY_EVENT_CONTEXT.event === '__none__', 'event = __none__');
    assert(Object.keys(EMPTY_EVENT_CONTEXT.data).length === 0, 'data ist leer');
}

// ─── Test 3: $event.source.name wird im ExpressionParser aufgelöst ───
console.log('\n[Test 3: ExpressionParser mit $event.source.name]');
{
    const $event = buildEventContext(
        { name: 'Btn_Start', className: 'TButton', stageId: 'stage_main' },
        'onClick',
        { value: 42 }
    );
    const context: Record<string, any> = { $event };

    const result = ExpressionParser.evaluate('$event.source.name', context);
    assert(result === 'Btn_Start', `$event.source.name = "Btn_Start" (got: ${result})`);

    const eventName = ExpressionParser.evaluate('$event.event', context);
    assert(eventName === 'onClick', `$event.event = "onClick" (got: ${eventName})`);

    const dataVal = ExpressionParser.evaluate('$event.data.value', context);
    assert(dataVal === 42, `$event.data.value = 42 (got: ${dataVal})`);
}

// ─── Test 4: self.x wird aufgelöst ───
console.log('\n[Test 4: ExpressionParser mit self.x]');
{
    const self = { name: 'Player', x: 150, y: 300, className: 'TSprite' };
    const context: Record<string, any> = { self };

    const x = ExpressionParser.evaluate('self.x', context);
    assert(x === 150, `self.x = 150 (got: ${x})`);

    const name = ExpressionParser.evaluate('self.name', context);
    assert(name === 'Player', `self.name = "Player" (got: ${name})`);
}

// ─── Test 5: Interpolation mit $event in Strings ───
console.log('\n[Test 5: String-Interpolation mit $event]');
{
    const $event = buildEventContext(
        { name: 'Card_7', className: 'TButton', stageId: 'stage_game' },
        'onClick',
        {}
    );
    const context: Record<string, any> = { $event };

    const result = ExpressionParser.interpolate('Geklickt: ${$event.source.name}', context);
    assert(result === 'Geklickt: Card_7', `Interpolation = "Geklickt: Card_7" (got: ${result})`);
}

// ─── Test 6: Reserved Names ───
console.log('\n[Test 6: Reservierte Variablen-Namen]');
{
    assert(RESERVED_VARIABLE_NAMES.has('$event'), '$event ist reserviert');
    assert(RESERVED_VARIABLE_NAMES.has('self'), 'self ist reserviert');
    assert(RESERVED_VARIABLE_NAMES.has('$index'), '$index ist reserviert');
    assert(RESERVED_VARIABLE_NAMES.has('$item'), '$item ist reserviert');
    assert(!RESERVED_VARIABLE_NAMES.has('score'), 'score ist NICHT reserviert');
}

// ─── Zusammenfassung ───
console.log('\n═══════════════════════════════════════');
console.log(`Event-Context Tests: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════');

if (failed > 0) process.exit(1);

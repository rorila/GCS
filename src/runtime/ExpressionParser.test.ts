import { ExpressionParser } from './ExpressionParser';

/**
 * Test suite for ExpressionParser
 * Run with: npx ts-node src/runtime/ExpressionParser.test.ts
 */

async function runTests() {
    console.log('--- Running ExpressionParser Tests ---');
    let passCount = 0;
    let failCount = 0;

    const assert = (name: string, actual: any, expected: any) => {
        if (JSON.stringify(actual) === JSON.stringify(expected)) {
            console.log(`✅ PASS: ${name}`);
            passCount++;
        } else {
            console.error(`❌ FAIL: ${name}`);
            console.error(`   Expected: ${JSON.stringify(expected)}`);
            console.error(`   Actual:   ${JSON.stringify(actual)}`);
            failCount++;
        }
    };

    const context = {
        value: 'click',
        selectedObject: {
            events: {
                click: 'handleLogin'
            }
        },
        user: {
            name: 'Rolf',
            stats: {
                score: 100
            }
        }
    };

    // 1. Simple Interpolation
    assert('Simple variable', ExpressionParser.interpolate('Hello ${user.name}', context), 'Hello Rolf');

    // 2. Nested Property
    assert('Nested property', ExpressionParser.interpolate('Score: ${user.stats.score}', context), 'Score: 100');

    // 3. Nested Interpolation (The Crash Cause)
    // Current Parser will fail here because regex stops at the first '}'
    assert('Nested interpolation',
        ExpressionParser.interpolate('Event: ${selectedObject.events.${value}}', context),
        'Event: handleLogin'
    );

    // 4. Arithmetic
    assert('Arithmetic', ExpressionParser.interpolate('Next: ${user.stats.score + 1}', context), 'Next: 101');

    // 5. Raw Evaluation
    assert('Raw numeric', ExpressionParser.evaluateRaw('${user.stats.score}', context), 100);

    // 6. Unresolved Nested Interpolation (Resilience Fix)
    // If 'value' is missing, it should NOT crash with SyntaxError, 
    // but keep the original tag for later resolution.
    assert('Unresolved nested interpolation',
        ExpressionParser.interpolate('${selectedObject.events.${missingValue} || \'\'}', context),
        '${selectedObject.events.${missingValue} || \'\'}'
    );

    console.log(`\nTests finished: ${passCount} passed, ${failCount} failed.`);
    if (failCount > 0) process.exit(1);
}

runTests().catch(console.error);

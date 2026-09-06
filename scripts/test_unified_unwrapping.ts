import { PropertyHelper } from '../src/runtime/PropertyHelper';
import { ExpressionParser } from '../src/runtime/ExpressionParser';

async function testUnifiedUnwrapping() {
    console.log('--- Testing Universal Unwrapping & Unified Traversal ---');

    // Scenario: Variable component with a single-item array value
    const mockUserVar = {
        name: 'currentUser',
        isVariable: true,
        value: [
            { id: 'u1', name: 'Rolf' }
        ]
    };

    const context = {
        currentUser: mockUserVar,
        params: { userId: 'u1' }
    };

    // Test 1: PropertyHelper Traversal (already fixed, but verifying consistency)
    const name = PropertyHelper.getPropertyValue(context, 'currentUser.name');
    console.log('Test 1 (PropertyHelper):', name === 'Rolf' ? 'PASSED' : `FAILED (Got: ${name})`);

    // Test 2: ExpressionParser (now using PropertyHelper)
    const result = ExpressionParser.interpolate('Hello ${currentUser.name}', context);
    console.log('Test 2 (ExpressionParser):', result === 'Hello Rolf' ? 'PASSED' : `FAILED (Got: ${result})`);

    // Test 3: Multiple levels
    const mockRoot = {
        data: {
            items: [
                { meta: { version: 1 } }
            ]
        }
    };
    const version = PropertyHelper.getPropertyValue(mockRoot, 'data.items.meta.version');
    console.log('Test 3 (Deep Smart-Unwrap):', version === 1 ? 'PASSED' : `FAILED (Got: ${version})`);
}

testUnifiedUnwrapping();

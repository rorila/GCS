import { PropertyHelper } from '../src/runtime/PropertyHelper';

async function testPropertyHelperVariables() {
    console.log('--- Testing PropertyHelper Variable Traversal ---');

    // Mock variable component
    const mockComponent = {
        name: 'currentUser',
        className: 'TObjectVariable',
        isVariable: true,
        value: [
            { id: 'u1', name: 'Rolf' }
        ]
    };

    // Test 1: Resolve property from variable component with single-element array (Smart-Access)
    const val1 = PropertyHelper.getPropertyValue(mockComponent, 'name');
    console.log('Test 1 (Component -> Array[0].name):', val1 === 'Rolf' ? 'PASSED' : `FAILED (Got: ${val1})`);

    // Test 2: Resolve nested property
    const mockComponentNested = {
        isVariable: true,
        value: {
            user: { details: { role: 'admin' } }
        }
    };
    const val2 = PropertyHelper.getPropertyValue(mockComponentNested, 'user.details.role');
    console.log('Test 2 (Nested resolve):', val2 === 'admin' ? 'PASSED' : `FAILED (Got: ${val2})`);

    // Test 3: Normal object property (no variable)
    const normalObj = { style: { color: 'red' } };
    const val3 = PropertyHelper.getPropertyValue(normalObj, 'style.color');
    console.log('Test 3 (Normal object):', val3 === 'red' ? 'PASSED' : `FAILED (Got: ${val3})`);

    // Test 4: Array unwrap without variable
    const arrayObj = [{ title: 'Hello' }];
    const val4 = PropertyHelper.getPropertyValue(arrayObj, 'title');
    console.log('Test 4 (Direct Array unwrap):', val4 === 'Hello' ? 'PASSED' : `FAILED (Got: ${val4})`);
}

testPropertyHelperVariables();

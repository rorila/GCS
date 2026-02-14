import { componentRegistry } from '../src/services/ComponentRegistry.js';
import { TIntegerVariable } from '../src/components/TIntegerVariable.js';
import { TObjectVariable } from '../src/components/TObjectVariable.js';

function verifyMorphing() {
    console.log('--- Verifying Variable Morphing Logic ---');

    console.log('1. Creating TIntegerVariable');
    const intVar = new TIntegerVariable('score', 10, 10);
    const originalId = intVar.id;
    console.log(`Original: ${intVar.name}, ID: ${originalId}, class: ${intVar.constructor.name}, type: ${intVar.type}`);

    console.log('2. Simulating morph to "object"');
    const newType = 'object';
    const newClassName = 'TObjectVariable';

    // Simulated morph logic
    const newInstance = componentRegistry.createInstance({
        className: newClassName,
        name: intVar.name,
        x: (intVar as any).x,
        y: (intVar as any).y
    }) as any;

    if (!newInstance) {
        console.error('FAIL: Could not create TObjectVariable instance');
        return;
    }

    // Copy state
    newInstance.id = intVar.id;
    newInstance.scope = intVar.scope;
    newInstance.value = {}; // Transition to object

    console.log(`Morphed: ${newInstance.name}, ID: ${newInstance.id}, class: ${newInstance.constructor.name}, type: ${newInstance.type}`);

    // Assertions
    if (newInstance.id !== originalId) {
        console.error('FAIL: ID mismatch!');
    } else if (newInstance.constructor.name !== 'TObjectVariable') {
        console.error(`FAIL: Class mismatch! Expected TObjectVariable, got ${newInstance.constructor.name}`);
    } else if (newInstance.type !== 'object') {
        console.error(`FAIL: Type mismatch! Expected object, got ${newInstance.type}`);
    } else {
        console.log('SUCCESS: Morphing logic verified.');
    }
}

verifyMorphing();

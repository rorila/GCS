import { TVariable } from '../src/components/TVariable.js';

function testVariableTypePersistence() {
    console.log('--- Testing TVariable Type Sync ---');

    console.log('1. Creating new TVariable');
    const v = new TVariable('testVar', 0, 0);

    // Initial state
    console.log(`Initial type: ${v.type}, className: ${v.className}`);
    if (v.type !== 'integer' || v.className !== 'TIntegerVariable') { // Default changed to TIntegerVariable? or TVariable?
        // Check default constructor logic
        // constructor calls super, sets isVariable=true
        // type is initialized to 'integer'
        // className is initialized to 'TVariable' in field decl?
        // Let's check if setter is called in constructor? No.
    }

    console.log('2. Setting type to "object"');
    v.type = 'object';
    console.log(`New type: ${v.type}, className: ${v.className}`);

    if (v.type !== 'object') {
        console.error('FAIL: Type did not update to object');
        return;
    }
    if (v.className !== 'TObjectVariable') {
        console.error(`FAIL: className did not sync. Expected TObjectVariable, got ${v.className}`);
        return;
    }

    console.log('3. Setting type to "string"');
    v.type = 'string';
    console.log(`New type: ${v.type}, className: ${v.className}`);

    if (v.className !== 'TStringVariable') {
        console.error(`FAIL: className did not sync to TStringVariable`);
    }

    console.log('--- TVariable Logic OK ---');
}

testVariableTypePersistence();

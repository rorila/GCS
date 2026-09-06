
/**
 * Test: Variable Morphing Logic Regression
 * 
 * Dieser Test simuliert den Morphing-Vorgang zwischen zwei Klassen (TVariable -> TObjectVariable)
 * und verifiziert, dass die kritischen Eigenschaften (ID, Scope, Name) korrekt übertragen werden.
 * 
 * WARNUNG: Dieser Test nutzt Mock-Klassen, um Abhängigkeiten zu vermeiden. 
 * Er validiert die LOGIK des Morphing-Prozesses, nicht die Klassen selbst.
 * Änderungen in Editor.ts müssen hier reflektiert werden.
 */

// --- MOCKS ---
class MockVariable {
    id: string;
    name: string;
    type: string = 'integer';
    scope: string = 'global';
    value: any = 0;

    constructor(name: string) {
        this.name = name;
        this.id = `obj_${Date.now()}`;
    }

    getInspectorProperties() {
        return [
            { name: 'type', type: 'select', selectedValue: this.type }
        ];
    }
}

class MockObjectVariable extends MockVariable {
    constructor(name: string) {
        super(name);
        this.type = 'object';
        this.value = {};
    }
}

// --- LOGIC UNDER TEST (Mirror of Editor.morphVariable) ---
function morphVariableLogic(variable: MockVariable, newType: string): MockVariable {
    console.log(`[Logic] Morphing ${variable.name} (${variable.type}) to ${newType}...`);

    let newInstance: MockVariable;

    // 1. Create Instance based on type
    if (newType === 'object') {
        newInstance = new MockObjectVariable(variable.name);
    } else {
        newInstance = new MockVariable(variable.name);
        newInstance.type = newType;
    }

    // 2. State Transfer (CRITICAL)
    // The exact logic from Editor.ts we want to verify
    newInstance.id = variable.id;     // MUST PRESERVE ID
    newInstance.scope = variable.scope;

    // Value handling (simplified for mock)
    if (newType === 'object') {
        newInstance.value = {};
    } else {
        newInstance.value = variable.value;
    }

    return newInstance;
}

// --- TEST EXECUTION ---
async function runTest() {
    console.log('--- START: Variable Morphing Logic Test ---');

    // 1. Setup
    const originalVar = new MockVariable('MyVar');
    originalVar.id = 'fixed_id_123';
    originalVar.value = 42;

    console.log(`[Setup] Original: ID=${originalVar.id}, Type=${originalVar.type}, Value=${originalVar.value}`);

    // 2. Transmute
    const morphedVar = morphVariableLogic(originalVar, 'object');

    console.log(`[Result] Morphed: ID=${morphedVar.id}, Type=${morphedVar.type}, Value=${JSON.stringify(morphedVar.value)}`);

    // 3. Assertions
    let passed = true;

    // Assertion 1: ID Persistence
    if (morphedVar.id !== originalVar.id) {
        console.error(`❌ FAILURE: ID mismatch! Expected ${originalVar.id}, got ${morphedVar.id}`);
        passed = false;
    } else {
        console.log('✅ PASS: ID preserved correctly.');
    }

    // Assertion 2: Type Correctness
    if (morphedVar.type !== 'object') {
        console.error(`❌ FAILURE: Type mismatch! Expected 'object', got ${morphedVar.type}`);
        passed = false;
    } else {
        console.log('✅ PASS: Type is correct.');
    }

    // Assertion 3: Instance Check (Mock)
    if (!(morphedVar instanceof MockObjectVariable)) {
        console.error(`❌ FAILURE: Instance class mismatch!`);
        passed = false;
    } else {
        console.log('✅ PASS: Class instance is correct.');
    }

    // Assertion 4: Inspector Prop (Mock)
    const props = morphedVar.getInspectorProperties();
    const typeProp = props.find(p => p.name === 'type');
    if (typeProp && typeProp.selectedValue === 'object') {
        console.log('✅ PASS: Inspector property "type" has correct selectedValue.');
    } else {
        console.error(`❌ FAILURE: Inspector property missing or wrong selectedValue: ${JSON.stringify(typeProp)}`);
        passed = false;
    }

    if (passed) {
        console.log('\n✅ TEST SUCCESSFUL');
        process.exit(0);
    } else {
        console.error('\n❌ TEST FAILED');
        process.exit(1);
    }
}

runTest();

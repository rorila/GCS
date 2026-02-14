import { TVariable } from '../src/components/TVariable.js';
import { hydrateObjects } from '../src/utils/Serialization.js';

async function verifyVariableTyping() {
    console.log('--- Verifying Variable Typing Persistence ---');

    // 1. Create a variable and change its type
    const v = new TVariable('testVar', 0, 0);
    console.log(`Initial: className=${v.className}, type=${v.type}`);

    v.type = 'object';
    console.log(`After change: className=${v.className}, type=${v.type}`);

    if (v.className !== 'TObjectVariable') {
        throw new Error(`className sync failed! Expected TObjectVariable, got ${v.className}`);
    }

    // 2. Simulate JSON serialization (standard JSON.stringify)
    const json = JSON.parse(JSON.stringify(v));
    console.log('Serialized JSON (extract):', { className: json.className, type: json.type, variableType: json.variableType });

    // 3. Hydrate back
    const hydrated = hydrateObjects([json])[0];
    console.log(`Hydrated: className=${hydrated.className}, type=${(hydrated as any).type}`);

    if ((hydrated as any).type !== 'object') {
        throw new Error(`Type revert detected after hydration! Expected object, got ${(hydrated as any).type}`);
    }

    // 4. Test legacy property protection
    const legacyData = {
        className: 'TIntegerVariable',
        name: 'legacyVar',
        type: 'string', // New field
        variableType: 'integer', // Old field
        isVariable: true
    };

    const hydratedLegacy = hydrateObjects([legacyData])[0] as TVariable;
    console.log(`Hydrated Legacy: className=${hydratedLegacy.className}, type=${hydratedLegacy.type}`);

    if (hydratedLegacy.type !== 'string') {
        throw new Error(`Legacy field "variableType" overwrote "type"! Expected string, got ${hydratedLegacy.type}`);
    }

    console.log('--- Verification Success! ---');
}

verifyVariableTyping().catch(err => {
    console.error('Verification failed:', err);
    process.exit(1);
});

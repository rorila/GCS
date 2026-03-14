/**
 * FlowDataAction Inspector-Test
 * Prüft: Sektionen-Reihenfolge, neue Properties, Source-Typen, Farb-Mapping
 * 
 * HINWEIS: FlowDataAction braucht DOM → Test prüft getInspectorSections() über Prototyp.
 */

import { GROUP_COLORS } from '../src/components/TComponent';

// --- environment Mocking ---
const mockStorage: Record<string, string> = {};
(global as any).window = {
    localStorage: {
        getItem: (key: string) => mockStorage[key] || null,
        setItem: (key: string, value: string) => { mockStorage[key] = value; },
        removeItem: (key: string) => { delete mockStorage[key]; }
    }
};
(global as any).localStorage = (global as any).window.localStorage;

export interface TestResult {
    name: string;
    type: string;
    expectedSuccess: boolean;
    actualSuccess: boolean;
    passed: boolean;
    details?: string;
}

async function runFlowDataActionTests(): Promise<TestResult[]> {
    console.log("🧪 Testing FlowDataAction Inspector...");
    const results: TestResult[] = [];

    const addResult = (name: string, passed: boolean, details?: string) => {
        results.push({
            name,
            type: 'FlowDataAction',
            expectedSuccess: true,
            actualSuccess: passed,
            passed,
            details
        });
    };

    try {
        // Import FlowDataAction
        const { FlowDataAction } = await import('../src/editor/flow/FlowDataAction');

        // getInspectorSections() über Prototyp aufrufen (DOM-unabhängig)
        const mockThis = {
            data: { type: 'data_action', name: 'Test' },
            getActionDefinition: () => null,
            type: 'data_action',
            Name: 'TestAction'
        };
        const sections = FlowDataAction.prototype.getInspectorSections.call(mockThis);

        // Alle Properties aus Sections extrahieren (Legacy-Kompatibilität)
        const props: any[] = [];
        for (const section of sections) {
            for (const prop of section.properties) {
                props.push({ ...prop, group: section.label });
            }
        }

        // 1. Test: selectFields existiert
        const hasSelectFields = props.some((p: any) => p.name === 'selectFields');
        addResult('Inspector enthält selectFields', hasSelectFields,
            `selectFields: ${hasSelectFields ? 'vorhanden' : 'FEHLT'}`);

        // 2. Test: Sektionen-Reihenfolge (ALLGEMEIN → FROM → SELECT → INTO → WHERE → HTTP)
        const sectionLabels = sections.map((s: any) => s.label);
        const expectedOrder = ['Allgemein', 'FROM / Datenquelle', 'SELECT / Felder', 'INTO / Ergebnis', 'WHERE / Filter', 'HTTP / Request', 'Aktionen'];
        const orderCorrect = expectedOrder.every((expected: string, i: number) => sectionLabels[i] === expected);
        addResult('Sektionen-Reihenfolge korrekt', orderCorrect,
            `Erwartet: ${expectedOrder.join(' → ')}, Gefunden: ${sectionLabels.join(' → ')}`);

        // 3. Test: dataStore hat source 'dataStores'
        const dataStoreProp = props.find((p: any) => p.name === 'dataStore');
        const dsSourceOk = dataStoreProp?.source === 'dataStores';
        addResult('dataStore source=dataStores', dsSourceOk,
            `Source: ${dataStoreProp?.source}`);

        // 4. Test: queryProperty hat source 'dataStoreFields'
        const queryProp = props.find((p: any) => p.name === 'queryProperty');
        const qpSourceOk = queryProp?.source === 'dataStoreFields';
        addResult('queryProperty source=dataStoreFields', qpSourceOk,
            `Source: ${queryProp?.source}`);

        // 5. Test: queryProperty ist Select
        const qpTypeOk = queryProp?.type === 'select';
        addResult('queryProperty type=select', qpTypeOk,
            `Type: ${queryProp?.type}`);

        // 6. Test: resultVariable ist in INTO-Sektion
        const resultVarProp = props.find((p: any) => p.name === 'resultVariable');
        const rvGroupOk = resultVarProp?.group === 'INTO / Ergebnis';
        addResult('resultVariable in INTO-Sektion', rvGroupOk,
            `Sektion: ${resultVarProp?.group}`);

        // 7. Test: GROUP_COLORS vorhanden und korrekt
        const colorsExist = Object.keys(GROUP_COLORS).length >= 5;
        const hasFromColor = 'FROM / DATENQUELLE' in GROUP_COLORS;
        const hasWhereColor = 'WHERE / FILTER' in GROUP_COLORS;
        addResult('GROUP_COLORS Mapping', colorsExist && hasFromColor && hasWhereColor,
            `Einträge: ${Object.keys(GROUP_COLORS).length}, FROM: ${hasFromColor}, WHERE: ${hasWhereColor}`);

        // 8. Test: Erweiterte Operatoren (CONTAINS, IN)
        const queryOpProp = props.find((p: any) => p.name === 'queryOperator');
        const opOptions = queryOpProp?.options || [];
        const hasContains = opOptions.some((o: any) => (typeof o === 'string' ? o : o.value) === 'CONTAINS');
        const hasIn = opOptions.some((o: any) => (typeof o === 'string' ? o : o.value) === 'IN');
        addResult('Erweiterte Operatoren (CONTAINS, IN)', hasContains && hasIn,
            `CONTAINS: ${hasContains}, IN: ${hasIn}`);

    } catch (e: any) {
        addResult('FlowDataAction Test Execution', false, e.message);
    }

    return results;
}

// Standalone execution
const isMain = import.meta.url.includes(process.argv[1].replace(/\\\\/g, '/')) || process.argv[1].endsWith('flow_data_action.test.ts');
if (isMain) {
    runFlowDataActionTests().then(results => {
        results.forEach(r => {
            console.log(`  ${r.passed ? '✅' : '❌'} ${r.name}${r.details ? ' | ' + r.details : ''}`);
        });
        const allPassed = results.every(r => r.passed);
        console.log(allPassed ? "\n✅ ALL TESTS PASSED" : "\n❌ SOME TESTS FAILED");
        process.exit(allPassed ? 0 : 1);
    });
}

export { runFlowDataActionTests };

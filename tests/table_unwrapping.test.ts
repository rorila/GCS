import { TestResult } from '../scripts/test_login_logic.js';

/**
 * Simuliert die Logik von Stage.renderTable für das Unwrapping.
 * (Da Stage.ts DOM-Abhängigkeiten hat, testen wir die Logik isoliert)
 */
function simulateTableUnwrap(obj: any): { finalData: any[], finalCols: any[] } {
    let rawData = obj.data;
    let sourceObj = null;

    if (rawData && typeof rawData === 'object' && !Array.isArray(rawData)) {
        sourceObj = rawData;
        if (Array.isArray(sourceObj.data)) {
            rawData = sourceObj.data;
        } else if (Array.isArray(sourceObj.items)) {
            rawData = sourceObj.items;
        }
    }
    if (!Array.isArray(rawData)) rawData = [];

    let cols: any[] = obj.columns || [];
    if (typeof cols === 'string' && (cols as string).startsWith('[')) {
        cols = JSON.parse(cols);
    }

    // Column Inheritance
    if ((!Array.isArray(cols) || cols.length === 0) && sourceObj && Array.isArray(sourceObj.columns)) {
        cols = sourceObj.columns;
    }

    return { finalData: rawData, finalCols: cols };
}

export async function runTableUnwrapTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // --- Test 1: Binding an TObjectList (currentRooms Scenario) ---
    const mockObjectList = {
        className: 'TObjectList',
        data: [{ id: 1, name: 'Room 1' }],
        columns: [{ property: 'name', label: 'Name' }]
    };
    const tableObj = {
        className: 'TTable',
        data: mockObjectList,
        columns: []
    };

    const { finalData: d1, finalCols: c1 } = simulateTableUnwrap(tableObj);
    const p1 = d1.length === 1 && d1[0].name === 'Room 1' && c1.length === 1 && c1[0].label === 'Name';

    results.push({
        name: 'TTable: Smart-Unwrap TObjectList',
        type: 'Smart Mapping',
        passed: p1,
        expectedSuccess: true,
        actualSuccess: p1,
        details: `Data: ${d1.length}, Cols: ${c1.length} (Inherited: ${c1[0]?.label})`
    });

    // --- Test 2: Binding an TListVariable (.items Scenario) ---
    const mockListVar = {
        className: 'TListVariable',
        items: ['Value 1', 'Value 2']
    };
    const tableObj2 = {
        className: 'TTable',
        data: mockListVar
    };

    const { finalData: d2 } = simulateTableUnwrap(tableObj2);
    const p2 = d2.length === 2 && d2[0] === 'Value 1';

    results.push({
        name: 'TTable: Smart-Unwrap TListVariable',
        type: 'Smart Mapping',
        passed: p2,
        expectedSuccess: true,
        actualSuccess: p2,
        details: `Data: ${d2.length}, First: ${d2[0]}`
    });

    return results;
}

// Runnable for dev
if (process.argv[1]?.includes('table_unwrapping')) {
    runTableUnwrapTests().then(res => {
        res.forEach(r => console.log(`${r.passed ? '✅' : '❌'} ${r.name}: ${r.details}`));
    });
}

import { TestResult } from '../scripts/test_login_logic.js';

/**
 * Simuliert die SQL-Projektions-Logik aus StandardActions.ts
 */
function simulateSqlProjection(result: any, selectFields: string): any {
    if (!selectFields || selectFields === '*' || !result) return result;

    const fields = selectFields.split(',').map((f: string) => f.trim()).filter((f: string) => f);
    const isCountOnly = fields.length === 1 && fields[0] === 'count(*)';

    if (isCountOnly && Array.isArray(result)) {
        return result.length;
    } else {
        const project = (obj: any) => {
            if (typeof obj !== 'object' || obj === null) return obj;
            const partial: any = {};
            fields.forEach((f: string) => {
                if (f === 'count(*)' || f === 'count') {
                    partial['count'] = 1;
                } else if (f in obj) {
                    partial[f] = obj[f];
                }
            });
            return partial;
        };
        return Array.isArray(result) ? result.map(project) : project(result);
    }
}

export async function runSelectCountTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // --- Test 1: Aggregation Only (SELECT count(*)) ---
    const mockData = [
        { id: 1, name: 'Room 1' },
        { id: 2, name: 'Room 2' },
        { id: 3, name: 'Room 3' }
    ];

    const countResult = simulateSqlProjection(mockData, 'count(*)');
    const p1 = countResult === 3;

    results.push({
        name: 'TDataAction: SELECT count(*) Only',
        type: 'Happy Path',
        passed: p1,
        expectedSuccess: true,
        actualSuccess: p1,
        details: `Expected: 3, Got: ${countResult}`
    });

    // --- Test 2: Aggregation Mix (SELECT id, count(*)) ---
    const mixResult = simulateSqlProjection(mockData, 'id, count(*)');
    const p2 = Array.isArray(mixResult) && mixResult.length === 3 && mixResult[0].count === 1 && mixResult[0].id === 1;

    results.push({
        name: 'TDataAction: SELECT id, count(*)',
        type: 'Happy Path',
        passed: p2,
        expectedSuccess: true,
        actualSuccess: p2,
        details: `Expected: Array(3) with count:1, Got: ${JSON.stringify(mixResult[0])}`
    });

    return results;
}

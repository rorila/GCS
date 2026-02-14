import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { TestResult } from './test_login_logic.js';

/**
 * Simuliert die Smart-Mapping Extraktionslogik
 */
function extractPath(data: any, resultPath: string): any {
    if (!resultPath || !data) return data;
    const parts = resultPath.split('.');
    let current = data;
    for (const part of parts) {
        if (current && current[part] !== undefined) {
            current = current[part];
        } else {
            return undefined;
        }
    }
    return current;
}

export async function runSmartMappingTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // --- 1. Smart Mapping Tests ---
    const rawResponse = {
        success: true,
        data: {
            user: { id: 'u1', name: 'Rolf' },
            token: 'secret'
        }
    };

    const mappingCases = [
        { name: 'Root Extraction', path: '', expected: rawResponse },
        { name: 'Single Level', path: 'success', expected: true },
        { name: 'Nested Level', path: 'data.user', expected: { id: 'u1', name: 'Rolf' } },
        { name: 'Deep Property', path: 'data.user.name', expected: 'Rolf' },
        { name: 'Invalid Path', path: 'data.unknown', expected: undefined }
    ];

    for (const c of mappingCases) {
        const actual = extractPath(rawResponse, c.path);
        const passed = JSON.stringify(actual) === JSON.stringify(c.expected);
        results.push({
            name: `SmartMapping: ${c.name}`,
            type: 'Smart Mapping',
            passed: passed,
            expectedSuccess: true,
            actualSuccess: passed,
            details: `Path: ${c.path}`
        });
    }

    // --- 2. Discovery Tests ---
    // Wir prüfen hier, ob wir die db.json lesen und Keys finden können
    const DB_FILE = path.join(__dirname, '../game-server/data/db.json');
    if (fs.existsSync(DB_FILE)) {
        try {
            const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
            const keys = Object.keys(db).filter(k => Array.isArray(db[k]));

            const hasUsers = keys.includes('users');
            results.push({
                name: 'Discovery: DB Keys found',
                type: 'Discovery',
                passed: keys.length > 0,
                expectedSuccess: true,
                actualSuccess: keys.length > 0,
                details: `Keys: ${keys.join(', ')}`
            });

            results.push({
                name: 'Discovery: Users collection exists',
                type: 'Discovery',
                passed: hasUsers,
                expectedSuccess: true,
                actualSuccess: hasUsers
            });
        } catch (e) {
            results.push({
                name: 'Discovery: Read DB',
                type: 'Discovery',
                passed: false,
                expectedSuccess: true,
                actualSuccess: false,
                details: 'Error parsing db.json'
            });
        }
    }

    return results;
}

// Execute if run directly
const isMain = process.argv[1] && (path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url)));
if (isMain) {
    runSmartMappingTests().then(results => {
        results.forEach(r => {
            console.log(`${r.passed ? '✅' : '❌'} ${r.name}`);
        });
    });
}

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../game-server/data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

export interface TestResult {
    name: string;
    type: 'Happy Path' | 'Security' | 'Edge Case' | 'Smart Mapping' | 'Discovery';
    pin?: string;
    expectedSuccess: boolean;
    actualSuccess: boolean;
    foundUserId?: string;
    passed: boolean;
    details?: string;
}

// Mock params simulating a request
const TEST_CASES: ReadonlyArray<{ name: string, type: 'Happy Path' | 'Security' | 'Edge Case', pin: string, expectedIds: string[], expectedSuccess: boolean }> = [
    { name: 'TestUser Login', type: 'Happy Path', pin: '🍎🍌', expectedIds: ['test-user', 'u_rolf'], expectedSuccess: true },
    { name: 'Admin Login', type: 'Happy Path', pin: '🚀⭐', expectedIds: ['test-admin', 'u_admin'], expectedSuccess: true },
    { name: 'Bug User Login', type: 'Edge Case', pin: '🐛💣', expectedIds: ['test-bug'], expectedSuccess: true },
    { name: 'Ungültiger PIN', type: 'Security', pin: '❌❌', expectedIds: [], expectedSuccess: false },
    { name: 'Teil-Eingabe (Prefix)', type: 'Security', pin: '🍎', expectedIds: [], expectedSuccess: false }
];

export async function runLoginTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    if (!fs.existsSync(DB_FILE)) {
        throw new Error(`db.json not found at ${DB_FILE}`);
    }

    let dbData: any;
    try {
        dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    } catch (e) {
        throw new Error('Failed to parse db.json');
    }

    const users = dbData.users || [];

    for (const testCase of TEST_CASES) {
        // --- LOGIC UNDER TEST (Simulates ActionApiHandler) ---
        const foundUser = users.find((user: any) => {
            let userPin = '';
            if (Array.isArray(user.authCode)) {
                userPin = user.authCode.join('');
            } else if (user.authCode) { // Legacy string
                userPin = user.authCode;
            } else if (user.pin) { // Legacy pin
                userPin = user.pin;
            }
            return userPin === testCase.pin;
        });
        // -----------------------------------------------------

        const actualSuccess = !!foundUser;
        const isCorrectId = actualSuccess && (testCase.expectedIds.length === 0 || testCase.expectedIds.includes(foundUser.id));
        const passed = (actualSuccess === testCase.expectedSuccess) && (testCase.expectedIds.length === 0 || isCorrectId);

        results.push({
            name: testCase.name,
            type: testCase.type,
            pin: testCase.pin,
            expectedSuccess: testCase.expectedSuccess,
            actualSuccess: actualSuccess,
            foundUserId: foundUser?.id,
            passed: passed
        });
    }

    return results;
}

// Execute if run directly
const isMain = process.argv[1] && (path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url)));
if (isMain) {
    runLoginTests().then(results => {
        results.forEach(r => {
            console.log(`${r.passed ? '✅' : '❌'} ${r.name}: ${r.passed ? 'PASS' : 'FAIL'}`);
        });
        console.log(`\n🧪 Overall: ${results.filter(r => r.passed).length}/${results.length} passed.`);
        process.exit(results.every(r => r.passed) ? 0 : 1);
    }).catch(err => {
        console.error(err);
        process.exit(1);
    });
}

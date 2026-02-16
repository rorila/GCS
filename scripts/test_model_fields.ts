
import { dataService } from '../src/services/DataService';
import fs from 'fs';
import path from 'path';

async function runTest() {
    console.log('🛡️ Testing DataService.getModelFields...');

    // 1. Setup Test Data
    const testFile = 'test_schema.json';
    const testData = {
        "users": [
            { "id": "u1", "name": "Rolf", "email": "rolf@example.com", "role": "admin" }
        ],
        "empty": []
    };

    const dbPath = path.join(process.cwd(), 'data', testFile);
    await fs.promises.writeFile(dbPath, JSON.stringify(testData, null, 2));

    try {
        // 2. Test: Fetch fields for existing items
        console.log('👉 Testing model "users"...');
        const userFields = await dataService.getModelFields(testFile, 'users');
        console.log('   Fields:', userFields.join(', '));

        const expected = ['id', 'name', 'email', 'role'];
        const missing = expected.filter(k => !userFields.includes(k));

        if (missing.length === 0 && userFields.length === expected.length) {
            console.log('✅ "users" schema detected correctly.');
        } else {
            console.error('❌ Schema mismatch!', { visited: userFields, expected });
            process.exit(1);
        }

        // 3. Test: Empty collection
        console.log('👉 Testing model "empty"...');
        const emptyFields = await dataService.getModelFields(testFile, 'empty');
        if (emptyFields.length === 0) {
            console.log('✅ Empty collection handled correctly.');
        } else {
            console.error('❌ Empty collection should return 0 fields, got:', emptyFields);
            process.exit(1);
        }

        // 4. Test: Non-existent model
        console.log('👉 Testing non-existent model...');
        const ghostFields = await dataService.getModelFields(testFile, 'ghost');
        if (ghostFields.length === 0) {
            console.log('✅ Non-existent model handled correctly.');
        } else {
            console.error('❌ Ghost model should return 0 fields.');
            process.exit(1);
        }

    } catch (e) {
        console.error('❌ Unexpected Error:', e);
        process.exit(1);
    } finally {
        // Cleanup
        await fs.promises.unlink(dbPath);
    }
}

runTest();

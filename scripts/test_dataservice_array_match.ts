import { DataService } from '../src/services/DataService';

async function testArrayMatch() {
    console.log('--- Testing DataService Array Match ---');
    const dataService = DataService.getInstance();

    // Mock local storage for the test if in browser context, 
    // but DataService handles Node.js 'fs' too. We'll use a temp test file.
    const testFile = 'test_match.json';
    const collection = 'users';
    const testData = {
        users: [
            { id: 'u1', name: 'Rolf', authCode: ['🍎', '🍌'] },
            { id: 'u2', name: 'Admin', authCode: ['🚀', '⭐'] }
        ]
    };

    // Note: In Node.js environment, readDb/writeDb use process.cwd()/data/test_match.json
    // We need to ensure we can write/read this.

    try {
        // Save test data directly via internal mechanism (simulated)
        // Since writeDb is private, we'll use saveItem to populate
        await dataService.saveItem(testFile, collection, testData.users[0]);
        await dataService.saveItem(testFile, collection, testData.users[1]);

        console.log('Data seeded.');

        // Test 1: Match concatenated string
        const matches1 = await dataService.findItems(testFile, collection, { authCode: '🍎🍌' });
        console.log('Test 1 (🍎🍌):', matches1.length === 1 && matches1[0].name === 'Rolf' ? 'PASSED' : 'FAILED');

        // Test 2: Match second user
        const matches2 = await dataService.findItems(testFile, collection, { authCode: '🚀⭐' });
        console.log('Test 2 (🚀⭐):', matches2.length === 1 && matches2[0].name === 'Admin' ? 'PASSED' : 'FAILED');

        // Test 3: Negative test
        const matches3 = await dataService.findItems(testFile, collection, { authCode: '🍎🚀' });
        console.log('Test 3 (Mismatch):', matches3.length === 0 ? 'PASSED' : 'FAILED');

        // Test 4: Normal loose matching (String id)
        const matches4 = await dataService.findItems(testFile, collection, { id: 'u1' });
        console.log('Test 4 (ID Match):', matches4.length === 1 ? 'PASSED' : 'FAILED');

    } catch (e) {
        console.error('Test failed with error:', e);
    }
}

testArrayMatch();

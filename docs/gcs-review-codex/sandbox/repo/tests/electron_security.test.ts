import path from 'path';

import securityModule from '../electron/security.cjs';
const { ElectronSecurity } = securityModule;

export async function runElectronSecurityTests(): Promise<{ passed: boolean, type: string, expectedSuccess: boolean, actualSuccess: boolean, name: string, details?: string }[]> {
    const results: any[] = [];
    console.log('\n🛡️  Starte Electron Security (Path Traversal) Tests...');

    const baseDir = path.resolve('/mock/base/app');
    const userDataDir = path.resolve('/mock/user/data');
    const tempDir = path.resolve('/mock/temp/dir');
    const cwd = path.resolve('/mock/cwd');

    const security = new ElectronSecurity([baseDir, userDataDir, tempDir, cwd]);

    // Test 1: Basis-Inklusion - Valid Paths
    let testName = 'Safe Path Access (Inside UserData)';
    let validPath = path.resolve(userDataDir, 'project', 'game.json');
    try {
        const allowed = security.isPathAllowed(validPath);
        results.push({ name: testName, type: 'Security', passed: allowed === true, expectedSuccess: true, actualSuccess: allowed });
    } catch (e: any) {
        results.push({ name: testName, type: 'Security', passed: false, expectedSuccess: true, actualSuccess: false, details: e.message });
    }

    // Test 2: Path Traversal Attack 1 (Ausbrechen aus dem App-Verzeichnis)
    testName = 'Path Traversal Breakout 1 (../ trick)';
    let maliciousPath = path.resolve(userDataDir, '../../windows/system32/config/sam');
    try {
        const allowed = security.isPathAllowed(maliciousPath);
        results.push({ name: testName, type: 'Security', passed: allowed === false, expectedSuccess: false, actualSuccess: allowed });
    } catch (e: any) {
        results.push({ name: testName, type: 'Security', passed: false, expectedSuccess: false, actualSuccess: false, details: e.message });
    }

    // Test 3: System-weite absolute Pfade (die nicht gewhitelisted sind)
    testName = 'Arbitrary Absolute File Path Access';
    let absoluteUnsafe = path.resolve('/etc/shadow');
    try {
        const allowed = security.isPathAllowed(absoluteUnsafe);
        results.push({ name: testName, type: 'Security', passed: allowed === false, expectedSuccess: false, actualSuccess: allowed });
    } catch (e: any) {
        results.push({ name: testName, type: 'Security', passed: false, expectedSuccess: false, actualSuccess: false, details: e.message });
    }

    // Test 4: Temporäres Verzeichnis (Erlaubt)
    testName = 'Temp Directory Access';
    let tempFile = path.resolve(tempDir, 'cache', 'test.tmp');
    try {
        const allowed = security.isPathAllowed(tempFile);
        results.push({ name: testName, type: 'Security', passed: allowed === true, expectedSuccess: true, actualSuccess: allowed });
    } catch (e: any) {
        results.push({ name: testName, type: 'Security', passed: false, expectedSuccess: true, actualSuccess: false, details: e.message });
    }

    // Test 5: Dynamische Whitelist (Dialog Simulation)
    testName = 'Dynamic Whitelist (Dialog File Selection)';
    let explicitFile = path.resolve('/arbitrary/path/user_selected.png');
    security.addAllowedPath(explicitFile);
    try {
        const allowed = security.isPathAllowed(explicitFile);
        
        // Versuche den Nachbarn zu lesen (sollte verboten sein!)
        const maliciousNeighbor = path.resolve('/arbitrary/path/secret.txt');
        const neighborAllowed = security.isPathAllowed(maliciousNeighbor);

        results.push({ 
            name: testName, 
            type: 'Security', 
            passed: (allowed === true && neighborAllowed === false), 
            expectedSuccess: true, 
            actualSuccess: allowed,
            details: neighborAllowed ? 'Fail: Neighbor access was granted!' : ''
        });
    } catch (e: any) {
        results.push({ name: testName, type: 'Security', passed: false, expectedSuccess: true, actualSuccess: false, details: e.message });
    }

    // Result Zusammenfassung
    const passedLength = results.filter(r => r.passed).length;
    console.log(`  ElectronSecurity: ${passedLength} bestanden, ${results.length - passedLength} fehlgeschlagen`);

    return results;
}

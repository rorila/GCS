/**
 * Export Integrity Test
 * 
 * Prüft per SHA-256-Checksumme, ob Export-relevante Dateien geändert wurden.
 * Bei bewussten Änderungen: npx tsx tests/export_integrity.test.ts --update
 * 
 * Überwachte Dateien (Kategorie 1+2):
 * - src/export/GameExporter.ts (Export-Kernlogik)
 * - src/services/ProjectPersistenceService.ts (Export-Delegation)
 * - src/player-standalone.ts (Runtime Entry-Point)
 * - src/runtime/GameRuntime.ts (Spiel-Logik Runtime)
 * - src/runtime/GameLoopManager.ts (Physik-Loop Runtime)
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '..');
const CHECKSUMS_FILE = path.join(__dirname, 'export_checksums.json');

interface TestResult {
    name: string;
    passed: boolean;
    type: string;
    expectedSuccess: boolean;
    actualSuccess: boolean;
    details?: string;
}

function computeSHA256(filePath: string): string {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex').toUpperCase();
}

function loadBaseline(): any {
    if (!fs.existsSync(CHECKSUMS_FILE)) {
        throw new Error('export_checksums.json nicht gefunden!');
    }
    return JSON.parse(fs.readFileSync(CHECKSUMS_FILE, 'utf-8'));
}

/**
 * Aktualisiert die Baseline-Checksummen (CLI: npx tsx tests/export_integrity.test.ts --update)
 */
function updateBaseline(): void {
    const baseline = loadBaseline();
    const files = baseline.files as Record<string, string>;
    let updated = 0;

    for (const relativePath of Object.keys(files)) {
        const fullPath = path.join(ROOT, relativePath);
        if (!fs.existsSync(fullPath)) {
            console.warn(`⚠️  Datei nicht gefunden: ${relativePath}`);
            continue;
        }
        const newHash = computeSHA256(fullPath);
        if (newHash !== files[relativePath]) {
            console.log(`🔄 ${relativePath}: ${files[relativePath].substring(0, 12)}... → ${newHash.substring(0, 12)}...`);
            files[relativePath] = newHash;
            updated++;
        }
    }

    baseline._lastUpdated = new Date().toISOString().split('T')[0];
    fs.writeFileSync(CHECKSUMS_FILE, JSON.stringify(baseline, null, 4) + '\n');

    if (updated > 0) {
        console.log(`\n✅ ${updated} Checksumme(n) aktualisiert in export_checksums.json`);
    } else {
        console.log('\n✅ Alle Checksummen sind bereits aktuell.');
    }
}

/**
 * Führt den Checksummen-Test aus und gibt TestResult[] zurück (für test_runner.ts).
 */
export function runExportIntegrityTests(): TestResult[] {
    console.log('🔒 Export Integrity Tests starten...');
    const results: TestResult[] = [];

    const baseline = loadBaseline();
    const files = baseline.files as Record<string, string>;

    let passed = 0;
    let failed = 0;

    for (const [relativePath, expectedHash] of Object.entries(files)) {
        const fullPath = path.join(ROOT, relativePath);
        const shortName = path.basename(relativePath);

        if (!fs.existsSync(fullPath)) {
            results.push({
                name: `Export-Integrität: ${shortName}`,
                passed: false,
                type: 'Export-Integrität',
                expectedSuccess: true,
                actualSuccess: false,
                details: `Datei nicht gefunden: ${relativePath}`
            });
            failed++;
            continue;
        }

        const actualHash = computeSHA256(fullPath);
        const isMatch = actualHash === expectedHash;

        results.push({
            name: `Export-Integrität: ${shortName}`,
            passed: isMatch,
            type: 'Export-Integrität',
            expectedSuccess: true,
            actualSuccess: isMatch,
            details: isMatch
                ? undefined
                : `Hash geändert! Erwartet: ${(expectedHash as string).substring(0, 16)}..., Aktuell: ${actualHash.substring(0, 16)}... → npx tsx tests/export_integrity.test.ts --update`
        });

        if (isMatch) {
            passed++;
        } else {
            failed++;
        }
    }

    console.log(`\n  Export Integrity: ${passed} bestanden, ${failed} fehlgeschlagen`);

    if (failed > 0) {
        console.log('  ⚠️  Falls beabsichtigt: npx tsx tests/export_integrity.test.ts --update');
    }

    return results;
}

// --- CLI-Modus ---
if (process.argv.includes('--update')) {
    updateBaseline();
} else if (process.argv[1]?.includes('export_integrity')) {
    // Direkt aufgerufen → Test ausführen
    const results = runExportIntegrityTests();
    const failed = results.filter(r => !r.passed).length;
    if (failed > 0) {
        process.exit(1);
    }
}

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runLoginTests, TestResult } from './test_login_logic.js'; // Note the .js extension for ESM imports
import { runSmartMappingTests } from './test_smart_mapping.js';
import { runUnificationTests } from './test_unification_regression.js';
import { runTableUnwrapTests } from '../tests/table_unwrapping.test.js';
import { runSelectCountTests } from '../tests/select_count.test.js';
// Neue Sicherheitsnetz-Tests (v3.7.0)
import { runSerializationTests } from '../tests/serialization.test.js';
import { runRefactoringTests } from '../tests/refactoring_manager.test.js';
import { runTaskExecutorTests } from '../tests/task_executor.test.js';
import { runFlowSyncTests } from '../tests/flow_sync.test.js';
import { runProjectIntegrityTests } from '../tests/project_integrity.test.js';
import { runRenamingRobustnessTests } from '../tests/renaming_robustness.test.js';
import { runTests as runActionRegistrationTests } from '../tests/action_registration.test.js';
import { runTests as runActionCRUDTests } from '../tests/action_crud.test.js';
import { runTests as runCoordinateTests } from '../src/runtime/CoordinateBinding.test.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPORT_FILE = path.join(__dirname, '../docs/QA_Report.md');

function generateMermaidChart(results: TestResult[]): string {
    const passed = results.filter(r => r.passed).length;
    const failed = results.length - passed;
    return `
\`\`\`mermaid
pie title Test-Status (Gesamt: ${results.length})
    "Bestanden ✅" : ${passed}
    "Fehlgeschlagen ❌" : ${failed}
\`\`\`
`.trim();
}

function generateReport(results: TestResult[]) {
    const timestamp = new Date().toLocaleString('de-DE');
    const allPassed = results.every(r => r.passed);
    const passedCount = results.filter(r => r.passed).length;

    let markdown = `# 🛡️ QA Test Report\n\n`;
    markdown += `**Generiert am**: ${timestamp}\n`;
    markdown += `**Status**: ${allPassed ? '✅ ALLE TESTS BESTANDEN' : '❌ FEHLER GEFUNDEN'}\n\n`;

    markdown += `## 📊 Visuelle Übersicht\n`;
    markdown += generateMermaidChart(results);
    markdown += `\n\n`;

    markdown += `## 🧪 Test-Details\n`;
    markdown += `| Test-Fall | Kategorie | Typ | Erwartet | Ergebnis | Status |\n`;
    markdown += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;

    results.forEach(r => {
        const gutSchlecht = (r.type === 'Happy Path' || r.type === 'Smart Mapping' || r.type === 'Discovery') ? '✅ **Gut-Test**' : '🛡️ **Schlecht-Test**';
        const detailInfo = r.details ? `<br><small>${r.details}</small>` : '';
        markdown += `| ${r.name}${detailInfo} | ${r.type} | ${gutSchlecht} | ${r.expectedSuccess ? 'OK/Erwartet' : 'Abgelehnt'} | ${r.actualSuccess ? 'OK/Erhalten' : 'Abgelehnt'} | ${r.passed ? '✅' : '❌'} |\n`;
    });

    markdown += `\n---\n*Hinweis: Dieser Bericht wurde automatisch vom GCS Regression Test Runner erstellt.*`;

    if (!fs.existsSync(path.dirname(REPORT_FILE))) {
        fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
    }

    fs.writeFileSync(REPORT_FILE, markdown, 'utf-8');
    console.log(`\n📄 Report generiert: ${REPORT_FILE}`);
}

import { execSync } from 'child_process';

async function main() {
    console.log('===================================================');
    console.log('🛡️  GCS REGRESSION TEST SUITE');
    console.log('===================================================\n');

    const allResults: TestResult[] = [];

    try {
        // 1. Logic Tests
        console.log('🏃 Starte Logik-Tests (Login)...');
        allResults.push(...await runLoginTests());

        // 2. Smart Mapping & Discovery Tests
        console.log('🏃 Starte Smart Mapping & Discovery Tests...');
        allResults.push(...await runSmartMappingTests());

        // 3. Unification & Auto-Unwrap Tests
        console.log('🏃 Starte Unification & Auto-Unwrap Tests...');
        allResults.push(...await runUnificationTests());

        // 4. TTable Smart-Unwrap Tests
        console.log('🏃 Starte TTable Smart-Unwrap Tests...');
        allResults.push(...await runTableUnwrapTests());

        // 5. SELECT COUNT(*) Tests
        console.log('🏃 Starte SELECT COUNT(*) Tests...');
        allResults.push(...await runSelectCountTests());

        // 13. Action Registration Tests
        console.log('🏃 Starte Action Registration Tests...');
        allResults.push(...await runActionRegistrationTests());

        // 14. Action CRUD Tests
        console.log('🏃 Starte Action CRUD Tests...');
        allResults.push(...await runActionCRUDTests());

        // 15. Coordinate Binding Tests
        console.log('🏃 Starte Coordinate Binding Tests...');
        allResults.push(...await runCoordinateTests());

        // 6. Serialization Tests
        console.log('🏃 Starte Serialization Tests...');
        allResults.push(...await runSerializationTests());

        // 7. RefactoringManager Tests
        console.log('🏃 Starte RefactoringManager Tests...');
        allResults.push(...await runRefactoringTests());

        // 8. TaskExecutor Tests
        console.log('🏃 Starte TaskExecutor Tests...');
        allResults.push(...await runTaskExecutorTests());

        // 9. FlowSync Tests
        console.log('🏃 Starte FlowSync Tests...');
        allResults.push(...await runFlowSyncTests());

        // 10. Project Integrity Tests
        console.log('🏃 Starte Project Integrity Tests...');
        allResults.push(...await runProjectIntegrityTests());

        // 11. Renaming Robustness Tests
        console.log('🏃 Starte Renaming Robustness Tests...');
        allResults.push(...await runRenamingRobustnessTests());

        // 🌐 12. Browser E2E Tests (Playwright)
        console.log('\n🌐 Starte Browser E2E Tests (Playwright)...');
        try {
            const e2eOutput = execSync('npx playwright test --reporter=json', { encoding: 'utf-8', stdio: 'pipe' });
            const e2eData = JSON.parse(e2eOutput);

            e2eData.suites.forEach((suite: any) => {
                suite.specs.forEach((spec: any) => {
                    spec.tests.forEach((test: any) => {
                        const result = test.results[0];
                        allResults.push({
                            name: `E2E: ${spec.title}`,
                            type: 'E2E Browser',
                            passed: result.status === 'passed',
                            expectedSuccess: true,
                            actualSuccess: result.status === 'passed',
                            details: `Browser: ${test.projectName}`
                        });
                    });
                });
            });
            console.log('✅ Browser-Tests abgeschlossen.');
        } catch (e2eErr: any) {
            console.warn('⚠️ Playwright Tests fehlgeschlagen oder mit Warnungen abgeschlossen.');
            if (e2eErr.stdout) {
                try {
                    const e2eData = JSON.parse(e2eErr.stdout);
                    // Add failed tests to report anyway
                    e2eData.suites?.forEach((suite: any) => {
                        suite.specs?.forEach((spec: any) => {
                            spec.tests?.forEach((testItem: any) => {
                                const result = testItem.results[0];
                                allResults.push({
                                    name: `E2E: ${spec.title}`,
                                    type: 'E2E Browser',
                                    passed: result.status === 'passed',
                                    expectedSuccess: true,
                                    actualSuccess: result.status === 'passed',
                                    details: `Browser: ${testItem.projectName} - ${result.error?.message || 'Fehler'}`
                                });
                            });
                        });
                    });
                } catch (parseErr) {
                    console.error('❌ Fehler beim Parsen der Playwright-Ergebnisse.');
                }
            }
        }

        // Report Generation
        generateReport(allResults);

        if (allResults.every(r => r.passed)) {
            console.log('\n✅ ALLE KRITISCHEN PFADE VERIFIZIERT');
            process.exit(0);
        } else {
            console.error('\n⚠️ EINIGE TESTS FEHLGESCHLAGEN');
            process.exit(1);
        }
    } catch (err) {
        console.error('\n❌ Schwerwiegender Fehler im Test-Runner:', err);
        process.exit(1);
    }
}

main();

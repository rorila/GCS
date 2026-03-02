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

async function main() {
    console.log('===================================================');
    console.log('🛡️  GCS REGRESSION TEST SUITE');
    console.log('===================================================\n');

    try {
        // 1. Logic Tests
        console.log('🏃 Starte Logik-Tests (Login)...');
        const loginResults = await runLoginTests();

        // 2. Smart Mapping & Discovery Tests
        console.log('🏃 Starte Smart Mapping & Discovery Tests...');
        const smartResults = await runSmartMappingTests();

        // 3. Unification & Auto-Unwrap Tests (v2.18.12.2)
        console.log('🏃 Starte Unification & Auto-Unwrap Tests...');
        const unificationResults = await runUnificationTests();

        // 4. TTable Smart-Unwrap Tests
        console.log('🏃 Starte TTable Smart-Unwrap Tests...');
        const tableResults = await runTableUnwrapTests();

        // 5. SELECT COUNT(*) Tests
        console.log('🏃 Starte SELECT COUNT(*) Tests...');
        const countResults = await runSelectCountTests();

        // 13. Action Registration Tests
        console.log('🏃 Starte Action Registration Tests...');
        const registrationResults = await runActionRegistrationTests();

        // 14. Action CRUD Tests
        console.log('🏃 Starte Action CRUD Tests...');
        const crudResults = await runActionCRUDTests();

        // 6. Serialization Tests (v3.7.0)
        console.log('🏃 Starte Serialization Tests...');
        const serializationResults = await runSerializationTests();

        // 7. RefactoringManager Tests (v3.7.0)
        console.log('🏃 Starte RefactoringManager Tests...');
        const refactoringResults = await runRefactoringTests();

        // 8. TaskExecutor Tests (v3.7.0)
        console.log('🏃 Starte TaskExecutor Tests...');
        const executorResults = await runTaskExecutorTests();

        // 9. FlowSync Tests (v3.7.0)
        console.log('🏃 Starte FlowSync Tests...');
        const flowSyncResults = await runFlowSyncTests();

        // 10. Project Integrity Tests (v3.7.0)
        console.log('🏃 Starte Project Integrity Tests...');
        const integrityResults = await runProjectIntegrityTests();

        // 11. Renaming Robustness Tests (v3.14.1)
        console.log('🏃 Starte Renaming Robustness Tests...');
        const robustnessResults = await runRenamingRobustnessTests();

        const allResults = [
            ...loginResults,
            ...smartResults,
            ...unificationResults,
            ...tableResults,
            ...countResults,
            ...serializationResults,
            ...refactoringResults,
            ...executorResults,
            ...flowSyncResults,
            ...integrityResults,
            ...robustnessResults,
            ...registrationResults,
            ...crudResults
        ];

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

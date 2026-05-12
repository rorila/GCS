import fs from 'fs';
import path from 'path';
import net from 'net';
import { fileURLToPath } from 'url';
import { runLoginTests, TestResult } from './test_login_logic.js'; // Note the .js extension for ESM imports
import { runSmartMappingTests } from './test_smart_mapping.js';
import { runUnificationTests } from './test_unification_regression.js';
import { runTableUnwrapTests } from '../tests/table_unwrapping.test.js';
import { runSelectCountTests } from '../tests/select_count.test.js';
// Neue Sicherheitsnetz-Tests (v3.7.0)
import { runGuardTests } from '../tests/guards.test.js';
import { runSerializationTests } from '../tests/serialization.test.js';
import { runRefactoringTests } from '../tests/refactoring_manager.test.js';
import { runTaskExecutorTests } from '../tests/task_executor.test.js';
import { runFlowSyncTests } from '../tests/flow_sync.test.js';
import { runProjectIntegrityTests } from '../tests/project_integrity.test.js';
import { runRenamingRobustnessTests } from '../tests/renaming_robustness.test.js';
import { runTests as runActionRegistrationTests } from '../tests/action_registration.test.js';
import { runTests as runActionCRUDTests } from '../tests/action_crud.test.js';
import { runTests as runCoordinateTests } from '../src/runtime/CoordinateBinding.test.js';
import { runTests as runGameLoopManagerTests } from '../tests/game_loop_manager.test.js';
import { runTests as runAgentControllerTests } from '../tests/agent_controller.test.js';
import { runTests as runRocketCountdownTests } from '../tests/rocket_countdown.test.js';
import { runSyncValidatorTests } from '../tests/sync_validator.test.js';
import { runSnapshotTests } from '../tests/snapshot_manager.test.js';
import { runProjectStoreTests } from '../tests/project_store.test.js';
import { runFlowDataActionTests } from '../tests/flow_data_action.test.js';
import { runExportIntegrityTests } from '../tests/export_integrity.test.js';
import { runPascalGeneratorTests } from '../tests/logic/PascalCodeGenerator.test.js';
import { runStageImportTests } from '../tests/stage_import.test.js';
import { runTests as runMatheQuizTests } from '../tests/mathe_quiz.test.js';
import { runTests as runVirtualGamepadTests } from '../tests/virtual_gamepad.test.js';
import { runElectronSecurityTests } from '../tests/electron_security.test.js';
import { runStageTransitionRegressionTests } from '../tests/stage_transition_regression.test.js';
import { runTests as runSidePanelTests } from '../tests/side_panel.test.js';
import { runComponentEventsTests } from '../tests/component_events.test.js';
import { runEventActionsTests } from '../tests/event_actions.test.js';
import { runActionStageRoutingTests } from '../tests/action_stage_routing.test.js';
// Phase 0 — SYNC_REFACTOR Test-Netz
import { runStoreSetPropertyTests } from '../tests/sync/store_set_property.test.js';
import { runSyncValidatorStrictTests } from '../tests/sync/sync_validator_strict.test.js';
import { runFlowActionAliasTests } from '../tests/sync/flowaction_aliases.test.js';
import { runInspectorWritebackTests } from '../tests/sync/inspector_writeback.test.js';
// Phase 1 — SYNC_REFACTOR Schema-Normalisierung
import { runSchemaMigratorTests } from '../tests/sync/schema_migrator.test.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPORT_FILE = path.join(__dirname, '../docs/QA_Report.md');

// ═══════════════════════════════════════════════════════════════════
// Timing-Budgets (Warnschwellen, KEIN Fail)
// ═══════════════════════════════════════════════════════════════════
const SUITE_BUDGET_MS = 180_000; // Gesamtlauf: 3 Min Warnschwelle
const SLOW_SUITE_MS = 5_000;     // Einzelsuite: 5s Warnschwelle

interface SuiteTiming {
    name: string;
    durationMs: number;
    failed: boolean;
}

/**
 * Misst die Laufzeit einzelner Test-Suiten. Fehler werden durchgereicht —
 * bestehendes main()-try/catch-Verhalten bleibt unverändert.
 */
class SuiteTimer {
    private timings: SuiteTiming[] = [];

    async measure<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
        const t0 = performance.now();
        try {
            const result = await fn();
            const durationMs = performance.now() - t0;
            this.timings.push({ name, durationMs, failed: false });
            const flag = durationMs > SLOW_SUITE_MS ? ' 🐌' : '';
            console.log(`  ⏱  ${name}: ${durationMs.toFixed(0)}ms${flag}`);
            return result;
        } catch (e) {
            const durationMs = performance.now() - t0;
            this.timings.push({ name, durationMs, failed: true });
            console.log(`  ⏱  ${name}: ${durationMs.toFixed(0)}ms (❌ crashed)`);
            throw e;
        }
    }

    getTimings(): SuiteTiming[] { return this.timings; }
    getTotalMs(): number { return this.timings.reduce((sum, t) => sum + t.durationMs, 0); }
}

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

function generateReport(results: TestResult[], timer: SuiteTimer, totalDurationMs: number) {
    const timestamp = new Date().toLocaleString('de-DE');
    const allPassed = results.every(r => r.passed);
    const overBudget = totalDurationMs > SUITE_BUDGET_MS;

    let markdown = `# 🛡️ QA Test Report\n\n`;
    markdown += `**Generiert am**: ${timestamp}\n`;
    markdown += `**Status**: ${allPassed ? '✅ ALLE TESTS BESTANDEN' : '❌ FEHLER GEFUNDEN'}\n`;
    markdown += `**Gesamtlauf**: ${(totalDurationMs / 1000).toFixed(1)}s`;
    if (overBudget) {
        markdown += ` ⚠️ (Budget ${(SUITE_BUDGET_MS / 1000).toFixed(0)}s überschritten)`;
    }
    markdown += `\n\n`;

    markdown += `## 📊 Visuelle Übersicht\n`;
    markdown += generateMermaidChart(results);
    markdown += `\n\n`;

    // ─── Timing-Übersicht (neu) ────────────────────────────────────
    const timings = timer.getTimings().slice().sort((a, b) => b.durationMs - a.durationMs);
    markdown += `## ⏱ Timing-Übersicht (sortiert nach Dauer)\n\n`;
    markdown += `| Suite | Dauer | Status |\n|:---|---:|:---:|\n`;
    for (const t of timings) {
        const flag = t.durationMs > SLOW_SUITE_MS ? ' 🐌' : '';
        markdown += `| ${t.name} | ${t.durationMs.toFixed(0)}ms${flag} | ${t.failed ? '❌' : '✅'} |\n`;
    }
    markdown += `\n**Summe Suiten**: ${timer.getTotalMs().toFixed(0)}ms\n`;
    markdown += `**Gesamtlauf inkl. Setup/Report**: ${totalDurationMs.toFixed(0)}ms\n`;
    markdown += `**Budget-Warnschwelle**: ${SUITE_BUDGET_MS}ms (Einzelsuite 🐌 ab ${SLOW_SUITE_MS}ms)\n\n`;

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
    const timer = new SuiteTimer();
    const t0Total = performance.now();

    try {
        await timer.measure('Login-Logic', async () => {
            console.log('🏃 Starte Logik-Tests (Login)...');
            allResults.push(...await runLoginTests());
        });

        await timer.measure('Smart-Mapping & Discovery', async () => {
            console.log('🏃 Starte Smart Mapping & Discovery Tests...');
            allResults.push(...await runSmartMappingTests());
        });

        await timer.measure('Unification & Auto-Unwrap', async () => {
            console.log('🏃 Starte Unification & Auto-Unwrap Tests...');
            allResults.push(...await runUnificationTests());
        });

        await timer.measure('TTable Smart-Unwrap', async () => {
            console.log('🏃 Starte TTable Smart-Unwrap Tests...');
            allResults.push(...await runTableUnwrapTests());
        });

        await timer.measure('SELECT COUNT(*)', async () => {
            console.log('🏃 Starte SELECT COUNT(*) Tests...');
            allResults.push(...await runSelectCountTests());
        });

        await timer.measure('Action Registration', async () => {
            console.log('🏃 Starte Action Registration Tests...');
            allResults.push(...await runActionRegistrationTests());
        });

        await timer.measure('Action CRUD', async () => {
            console.log('🏃 Starte Action CRUD Tests...');
            allResults.push(...await runActionCRUDTests());
        });

        await timer.measure('Coordinate Binding', async () => {
            console.log('🏃 Starte Coordinate Binding Tests...');
            allResults.push(...await runCoordinateTests());
        });

        await timer.measure('GameLoopManager Physics', async () => {
            console.log('🏃 Starte GameLoopManager Physics Tests...');
            try {
                runGameLoopManagerTests();
                allResults.push({ name: 'GameLoopManager Tests', passed: true, type: 'Physics', expectedSuccess: true, actualSuccess: true });
            } catch (e: any) {
                allResults.push({ name: 'GameLoopManager Tests', passed: false, type: 'Physics', expectedSuccess: true, actualSuccess: false, details: e.message });
            }
        });

        await timer.measure('AgentController', async () => {
            console.log('🏃 Starte AgentController Tests...');
            allResults.push(...await runAgentControllerTests());
        });

        await timer.measure('Raketen-Countdown', async () => {
            console.log('🏃 Starte Raketen-Countdown Tests...');
            allResults.push(...await runRocketCountdownTests());
        });

        await timer.measure('Mathe-Quiz', async () => {
            console.log('🏃 Starte Mathe-Quiz Tests...');
            allResults.push(...await runMatheQuizTests());
        });

        await timer.measure('Virtual Gamepad', async () => {
            console.log('🏃 Starte Virtual Gamepad Tests...');
            allResults.push(...await runVirtualGamepadTests());
        });

        await timer.measure('Serialization', async () => {
            console.log('🏃 Starte Serialization Tests...');
            allResults.push(...await runSerializationTests());
        });

        await timer.measure('Code Quality & Security Guards', async () => {
            console.log('🛡️  Starte Code Quality & Security Guards...');
            allResults.push(...await runGuardTests());
        });

        await timer.measure('RefactoringManager', async () => {
            console.log('🏃 Starte RefactoringManager Tests...');
            allResults.push(...await runRefactoringTests());
        });

        await timer.measure('TaskExecutor', async () => {
            console.log('🏃 Starte TaskExecutor Tests...');
            allResults.push(...await runTaskExecutorTests());
        });

        await timer.measure('FlowSync', async () => {
            console.log('🏃 Starte FlowSync Tests...');
            allResults.push(...await runFlowSyncTests());
        });

        await timer.measure('Project Integrity', async () => {
            console.log('🏃 Starte Project Integrity Tests...');
            allResults.push(...await runProjectIntegrityTests());
        });

        await timer.measure('Renaming Robustness', async () => {
            console.log('🏃 Starte Renaming Robustness Tests...');
            allResults.push(...await runRenamingRobustnessTests());
        });

        await timer.measure('SyncValidator', async () => {
            console.log('🏃 Starte SyncValidator Tests...');
            allResults.push(...await runSyncValidatorTests());
        });

        await timer.measure('SnapshotManager', async () => {
            console.log('🏃 Starte SnapshotManager Tests...');
            try {
                runSnapshotTests();
                allResults.push({ name: 'SnapshotManager Tests', passed: true, type: 'Undo/Redo', expectedSuccess: true, actualSuccess: true });
            } catch (e: any) {
                allResults.push({ name: 'SnapshotManager Tests', passed: false, type: 'Undo/Redo', expectedSuccess: true, actualSuccess: false, details: e.message });
            }
        });

        await timer.measure('ProjectStore', async () => {
            console.log('🏃 Starte ProjectStore Tests...');
            try {
                runProjectStoreTests();
                allResults.push({ name: 'ProjectStore Tests', passed: true, type: 'State-Management', expectedSuccess: true, actualSuccess: true });
            } catch (e: any) {
                allResults.push({ name: 'ProjectStore Tests', passed: false, type: 'State-Management', expectedSuccess: true, actualSuccess: false, details: e.message });
            }
        });

        await timer.measure('FlowDataAction Inspector', async () => {
            console.log('🏃 Starte FlowDataAction Inspector Tests...');
            allResults.push(...await runFlowDataActionTests());
        });

        await timer.measure('Export Integrity', async () => {
            console.log('🏃 Starte Export Integrity Tests...');
            allResults.push(...await runExportIntegrityTests());
        });

        await timer.measure('Pascal Code Generator', async () => {
            console.log('🏃 Starte Pascal Code Generator Tests...');
            allResults.push(...await runPascalGeneratorTests());
        });

        await timer.measure('Stage-Import', async () => {
            console.log('🏃 Starte Stage-Import Tests...');
            allResults.push(...await runStageImportTests());
        });

        await timer.measure('Electron Security', async () => {
            allResults.push(...await runElectronSecurityTests());
        });

        await timer.measure('Stage-Transition Regression', async () => {
            console.log('🏃 Starte Stage-Transition Regressions-Tests...');
            allResults.push(...await runStageTransitionRegressionTests());
        });

        await timer.measure('SidePanel', async () => {
            console.log('🏃 Starte SidePanel Tests...');
            allResults.push(...await runSidePanelTests());
        });

        await timer.measure('Component Events', async () => {
            console.log('🏃 Starte Component Events Tests...');
            allResults.push(...await runComponentEventsTests());
        });

        await timer.measure('Event Actions (bind/unbind)', async () => {
            console.log('🏃 Starte Event-Action Tests (bind_event / unbind_event)...');
            allResults.push(...await runEventActionsTests());
        });

        await timer.measure('Action Stage Routing & Duplicates', async () => {
            console.log('🏃 Starte Action-Stage-Routing & Duplikat-Tests...');
            allResults.push(...await runActionStageRoutingTests());
        });

        // ═══════════════════════════════════════════════════════
        // Phase 0 — SYNC_REFACTOR Test-Netz
        // ═══════════════════════════════════════════════════════
        await timer.measure('SyncRefactor P0: Store SET_PROPERTY', async () => {
            console.log('🏃 Starte Sync-Refactor Phase 0: Store SET_PROPERTY Tests...');
            allResults.push(...await runStoreSetPropertyTests());
        });

        await timer.measure('SyncRefactor P0: SyncValidator Strict', async () => {
            console.log('🏃 Starte Sync-Refactor Phase 0: SyncValidator Strict Tests...');
            allResults.push(...await runSyncValidatorStrictTests());
        });

        await timer.measure('SyncRefactor P0: FlowAction Aliases', async () => {
            console.log('🏃 Starte Sync-Refactor Phase 0: FlowAction Alias Tests...');
            allResults.push(...await runFlowActionAliasTests());
        });

        await timer.measure('SyncRefactor P0: Inspector Writeback', async () => {
            console.log('🏃 Starte Sync-Refactor Phase 0: Inspector Writeback Tests...');
            allResults.push(...await runInspectorWritebackTests());
        });

        await timer.measure('SyncRefactor P1: SchemaMigrator', async () => {
            console.log('🏃 Starte Sync-Refactor Phase 1: SchemaMigrator Tests...');
            allResults.push(...await runSchemaMigratorTests());
        });

        // 🌐 Browser E2E Tests (Playwright)
        console.log('\n🌐 Starte Browser E2E Tests (Playwright)...');

        // Check if Game Server (Port 8080) is running
        const isServerRunning = await new Promise((resolve) => {
            const client = new net.Socket();
            client.setTimeout(1000);
            client.on('connect', () => { client.destroy(); resolve(true); });
            client.on('error', () => { client.destroy(); resolve(false); });
            client.on('timeout', () => { client.destroy(); resolve(false); });
            client.connect(8080, 'localhost');
        });

        if (!isServerRunning) {
            console.warn('⚠️  [WARNUNG] Game-Server (Port 8080) läuft nicht!');
            console.warn('   E2E-Tests werden wahrscheinlich fehlschlagen, da /platform nicht erreichbar ist.');
            console.warn('   Starte den Server mit: cd game-server && npm run dev\n');
        }

        const playwrightT0 = performance.now();
        try {
            const e2eOutput = execSync('npx playwright test --reporter=json', { encoding: 'utf-8', stdio: 'pipe' });
            const e2eData = JSON.parse(e2eOutput);

            const extractResults = (suites: any[]) => {
                suites.forEach((suite: any) => {
                    if (suite.specs) {
                        suite.specs.forEach((spec: any) => {
                            spec.tests.forEach((test: any) => {
                                const result = test.results[0];
                                // Übersprungene Tests ignorieren (z.B. test.describe.skip)
                                if (result.status === 'skipped') return;
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
                    }
                    if (suite.suites) {
                        extractResults(suite.suites);
                    }
                });
            };

            extractResults(e2eData.suites);
            timer.getTimings().push({ name: 'Playwright E2E', durationMs: performance.now() - playwrightT0, failed: false });
            console.log(`  ⏱  Playwright E2E: ${(performance.now() - playwrightT0).toFixed(0)}ms`);
            console.log('✅ Browser-Tests abgeschlossen.');
        } catch (e2eErr: any) {
            console.warn('⚠️ Playwright Tests fehlgeschlagen oder mit Warnungen abgeschlossen.');
            if (e2eErr.stdout) {
                try {
                    const e2eData = JSON.parse(e2eErr.stdout);

                    const extractFailedResults = (suites: any[]) => {
                        suites.forEach((suite: any) => {
                            if (suite.specs) {
                                suite.specs.forEach((spec: any) => {
                                    spec.tests.forEach((testItem: any) => {
                                        const result = testItem.results[0];
                                        // Übersprungene Tests ignorieren (z.B. test.describe.skip)
                                        if (result.status === 'skipped') return;
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
                            }
                            if (suite.suites) {
                                extractFailedResults(suite.suites);
                            }
                        });
                    };

                    extractFailedResults(e2eData.suites);
                } catch (parseErr) {
                    console.error('❌ Fehler beim Parsen der Playwright-Ergebnisse.');
                }
            }
            timer.getTimings().push({ name: 'Playwright E2E', durationMs: performance.now() - playwrightT0, failed: true });
            console.log(`  ⏱  Playwright E2E: ${(performance.now() - playwrightT0).toFixed(0)}ms (❌ mit Fehlern)`);
        }

        // Report Generation
        const totalDurationMs = performance.now() - t0Total;
        generateReport(allResults, timer, totalDurationMs);

        // Timing-Zusammenfassung auf Konsole
        console.log(`\n⏱  Gesamtlauf: ${(totalDurationMs / 1000).toFixed(1)}s (Suiten: ${(timer.getTotalMs() / 1000).toFixed(1)}s)`);
        if (totalDurationMs > SUITE_BUDGET_MS) {
            console.warn(`⚠️  Budget ${(SUITE_BUDGET_MS / 1000).toFixed(0)}s überschritten — siehe Timing-Übersicht im Report.`);
        }

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

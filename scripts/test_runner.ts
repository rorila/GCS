import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runLoginTests, TestResult } from './test_login_logic.js'; // Note the .js extension for ESM imports
import { runSmartMappingTests } from './test_smart_mapping.js';
import { runUnificationTests } from './test_unification_regression.js';
import { runTableUnwrapTests } from '../tests/table_unwrapping.test.js';
import { runSelectCountTests } from '../tests/select_count.test.js';
import { runSpriteGeometryTests } from '../tests/sprite_geometry.test.js';
import { runReactiveTargetedUpdateTests } from '../tests/reactive_targeted_update.test.js';
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
import { runTests as runJumpAndRunComponentTests } from '../tests/jumpandrun_components.test.js';
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
import { runNonvisualInspectorTests } from '../tests/nonvisual_inspector.test.js';
import { runEventActionsTests } from '../tests/event_actions.test.js';
import { runActionStageRoutingTests } from '../tests/action_stage_routing.test.js';
// Phase 0 — SYNC_REFACTOR Test-Netz
import { runStoreSetPropertyTests } from '../tests/sync/store_set_property.test.js';
import { runSyncValidatorStrictTests } from '../tests/sync/sync_validator_strict.test.js';
import { runFlowActionAliasTests } from '../tests/sync/flowaction_aliases.test.js';
import { runInspectorWritebackTests } from '../tests/sync/inspector_writeback.test.js';
// Phase 1 — SYNC_REFACTOR Schema-Normalisierung
import { runSchemaMigratorTests } from '../tests/sync/schema_migrator.test.js';
import { runTimerVariableTests } from '../tests/timer_variable.test.js';
import { runSpawnObjectVariableTests } from '../tests/spawn_object_variable.test.js';
import { runTimerReactiveTests } from '../tests/timer_reactive.test.js';
import { runVideoToSpriteSheetTests } from '../tests/video_to_spritesheet.test.js';
import { runTests as runAgentScriptIOTests } from '../tests/agent_script_io.test.js';

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

    constructor(private observedResults?: TestResult[]) {}

    /** Markiert alle seit `before` hinzugekommenen Ergebnisse mit dem Suiten-Namen. */
    private tagSuite(before: number, name: string) {
        if (!this.observedResults) return;
        for (let i = before; i < this.observedResults.length; i++) {
            const r = this.observedResults[i] as TestResult & { suite?: string };
            if (!r.suite) r.suite = name;
        }
    }

    async measure<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
        const t0 = performance.now();
        const before = this.observedResults?.length ?? 0;
        try {
            const result = await fn();
            this.tagSuite(before, name);
            const durationMs = performance.now() - t0;
            this.timings.push({ name, durationMs, failed: false });
            const flag = durationMs > SLOW_SUITE_MS ? ' 🐌' : '';
            console.log(`  ⏱  ${name}: ${durationMs.toFixed(0)}ms${flag}`);
            return result;
        } catch (e) {
            this.tagSuite(before, name);
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

    generateHtmlReport(results, timer, totalDurationMs);
}

// ═══════════════════════════════════════════════════════════════════
// HTML-Report — thematisch gegliederte Sicht fuer den Anwender
// ═══════════════════════════════════════════════════════════════════
const HTML_REPORT_FILE = path.join(__dirname, '../docs/QA_Report.html');

const AUFBAU_ORDER = [
    'Basis & SuperAdmin', 'Haus & HouseAdmin', 'Räume', 'Bewohner · Raumzuordnung · Eltern · Beobachter',
    'Mandantentrennung', 'Spiele & Freigaben', 'Konten & Sitzungen'
];

const THEME_LABEL: Record<string, string> = {
    VORAUS: 'Voraussetzung', HAUS: 'Haus', SUPER: 'SuperAdmin', ADMIN: 'HouseAdmin',
    RAUM: 'Raum', KIND: 'Kind', ELTERN: 'Eltern', OBS: 'Beobachter', ERZ: 'Erzieher',
    GRENZE: 'Mandant', MULTI: 'Mehrfachrolle', SPIEL: 'Spiel', LEBEN: 'Lebenszyklus',
    SESSION: 'Sitzung', LOGIN: 'Anmeldung', BASIS: 'Basis', DATEN: 'Daten'
};

function esc(s: string): string {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function resultStatus(r: TestResult): 'ok' | 'fail' | 'blocked' {
    if (r.passed) return 'ok';
    return r.details?.startsWith('blockiert') ? 'blocked' : 'fail';
}

function generateHtmlReport(results: TestResult[], timer: SuiteTimer, totalDurationMs: number) {
    const timestamp = new Date().toLocaleString('de-DE');
    const total = results.length;
    const passed = results.filter(r => r.passed).length;
    const blocked = results.filter(r => resultStatus(r) === 'blocked').length;
    const failed = total - passed - blocked;

    // ─── Gruppierung: CMS-Aufbau (thematisch sortiert) → E2E-Dateien → Logik-Suiten
    const groups = new Map<string, TestResult[]>();
    for (const r of results) {
        const suite = (r as TestResult & { suite?: string }).suite;
        const key = suite ?? (r.type || 'Sonstige');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(r);
    }
    const rank = (t: string): [number, number] => {
        if (t.startsWith('CMS Aufbau · ')) {
            const i = AUFBAU_ORDER.indexOf(t.replace('CMS Aufbau · ', ''));
            return [0, i === -1 ? 99 : i];
        }
        if (t.startsWith('E2E Browser')) return [1, 0];
        return [2, 0];
    };
    const sorted = [...groups.entries()].sort((a, b) => {
        const ra = rank(a[0]), rb = rank(b[0]);
        return ra[0] - rb[0] || ra[1] - rb[1] || a[0].localeCompare(b[0], 'de');
    });

    const chip = (items: TestResult[]) => {
        const ok = items.filter(r => r.passed).length;
        const bl = items.filter(r => resultStatus(r) === 'blocked').length;
        const fe = items.length - ok - bl;
        let s = `<span class="chip ok">${ok} ✓</span>`;
        if (fe) s += `<span class="chip fail">${fe} ✗</span>`;
        if (bl) s += `<span class="chip blocked">${bl} ⏸</span>`;
        return s;
    };

    const row = (r: TestResult) => {
        const st = resultStatus(r);
        const badge = st === 'ok' ? '<span class="badge ok">✓ Bestanden</span>'
            : st === 'blocked' ? '<span class="badge blocked">⏸ Blockiert</span>'
            : '<span class="badge fail">✗ Fehlgeschlagen</span>';
        // Aufbau-Namen haben die Form "ID — Beschreibung"
        const m = r.name.match(/^([A-ZÄÖÜ]+[-\w]*) — (.+)$/s);
        const id = m ? m[1] : '—';
        const desc = m ? m[2] : r.name;
        const theme = m ? (THEME_LABEL[id.split('-')[0]] ?? '') : '';
        const detail = r.details ? `<div class="detail">${esc(r.details)}</div>` : '';
        return `<tr class="row ${st}"><td>${badge}</td><td class="id">${esc(id)}${theme ? `<span class="theme">${theme}</span>` : ''}</td><td>${esc(desc)}${detail}</td></tr>`;
    };

    const sections = sorted.map(([key, items]) => `
    <details class="group" open>
      <summary><span class="gname">${esc(key)}</span><span class="chips">${chip(items)}</span></summary>
      <table><thead><tr><th>Ergebnis</th><th>Test</th><th>Beschreibung</th></tr></thead>
      <tbody>${items.map(row).join('\n')}</tbody></table>
    </details>`).join('\n');

    const timings = timer.getTimings().slice().sort((a, b) => b.durationMs - a.durationMs)
        .map(t => `<tr><td>${esc(t.name)}</td><td class="num">${(t.durationMs / 1000).toFixed(1)}s</td><td>${t.failed ? '❌' : '✅'}</td></tr>`).join('\n');

    const html = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>GCS QA-Bericht — ${timestamp}</title>
<style>
:root{--bg:#0f1420;--card:#182130;--line:#2a3547;--txt:#e6ecf5;--mut:#8fa0b8;--ok:#34d399;--fail:#f87171;--blocked:#fbbf24;--acc:#60a5fa}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--txt);font:14px/1.5 system-ui,"Segoe UI",sans-serif}
header{position:sticky;top:0;z-index:5;background:linear-gradient(180deg,#141b2b,#141b2bee);backdrop-filter:blur(6px);border-bottom:1px solid var(--line);padding:14px 24px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
h1{font-size:18px;margin:0;font-weight:650}
.meta{color:var(--mut);font-size:12.5px}
.pill{padding:4px 12px;border-radius:999px;font-weight:600;font-size:12.5px}
.pill.ok{background:#34d39922;color:var(--ok);border:1px solid #34d39955}
.pill.fail{background:#f8717122;color:var(--fail);border:1px solid #f8717155}
main{max-width:1100px;margin:0 auto;padding:20px 24px 60px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin:18px 0 26px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.kpi .v{font-size:24px;font-weight:700}.kpi .l{color:var(--mut);font-size:12px}
.kpi.ok .v{color:var(--ok)}.kpi.fail .v{color:var(--fail)}.kpi.blocked .v{color:var(--blocked)}
.controls{display:flex;gap:10px;margin-bottom:18px}
.controls input{flex:1;background:var(--card);border:1px solid var(--line);border-radius:8px;color:var(--txt);padding:8px 12px;font:inherit}
.controls input:focus{outline:1px solid var(--acc)}
.controls button{background:var(--card);border:1px solid var(--line);border-radius:8px;color:var(--txt);padding:8px 14px;cursor:pointer;font:inherit}
.controls button:hover{border-color:var(--acc)}
details.group{background:var(--card);border:1px solid var(--line);border-radius:12px;margin-bottom:14px;overflow:hidden}
details.group>summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 16px;font-weight:600}
details.group>summary::-webkit-details-marker{display:none}
details.group>summary::before{content:'▸';color:var(--mut);transition:transform .15s}
details.group[open]>summary::before{transform:rotate(90deg)}
.gname{flex:1}.chips{display:flex;gap:6px}
.chip{font-size:11.5px;padding:2px 8px;border-radius:999px;font-weight:600}
.chip.ok{background:#34d3991e;color:var(--ok)}.chip.fail{background:#f871711e;color:var(--fail)}.chip.blocked{background:#fbbf241e;color:var(--blocked)}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;color:var(--mut);font-weight:600;font-size:11.5px;text-transform:uppercase;letter-spacing:.4px;padding:8px 16px;border-top:1px solid var(--line)}
td{padding:9px 16px;border-top:1px solid var(--line);vertical-align:top}
tr.row.fail td{background:#f8717108}
.badge{white-space:nowrap;font-size:12px;font-weight:600;padding:3px 9px;border-radius:6px}
.badge.ok{background:#34d3991e;color:var(--ok)}.badge.fail{background:#f871711e;color:var(--fail)}.badge.blocked{background:#fbbf241e;color:var(--blocked)}
td.id{font-family:ui-monospace,Consolas,monospace;font-size:12px;white-space:nowrap;color:var(--acc)}
.theme{display:block;color:var(--mut);font-size:11px;font-family:inherit}
.detail{color:var(--mut);font-size:12px;margin-top:3px}
h2{font-size:14px;color:var(--mut);margin:28px 0 10px;text-transform:uppercase;letter-spacing:.5px}
td.num{text-align:right;font-variant-numeric:tabular-nums}
footer{color:var(--mut);font-size:12px;text-align:center;padding:20px}
.hidden{display:none}
</style></head><body>
<header>
  <h1>🛡️ GCS QA-Bericht</h1>
  <span class="pill ${failed ? 'fail' : 'ok'}">${failed ? `${failed} FEHLER` : 'ALLE TESTS BESTANDEN'}</span>
  <span class="meta">${esc(timestamp)} · Gesamtlauf ${(totalDurationMs / 1000).toFixed(1)}s</span>
</header>
<main>
  <section class="kpis">
    <div class="kpi"><div class="v">${total}</div><div class="l">Prüfungen gesamt</div></div>
    <div class="kpi ok"><div class="v">${passed}</div><div class="l">Bestanden</div></div>
    <div class="kpi fail"><div class="v">${failed}</div><div class="l">Fehlgeschlagen</div></div>
    <div class="kpi blocked"><div class="v">${blocked}</div><div class="l">Blockiert</div></div>
    <div class="kpi"><div class="v">${sorted.length}</div><div class="l">Themenbereiche</div></div>
  </section>
  <div class="controls">
    <input id="q" type="search" placeholder="Tests durchsuchen … (z.B. ELTERN, Spiel, Sitzung)">
    <button id="onlyFail">Nur offene Punkte</button>
  </div>
  ${sections}
  <h2>Laufzeiten der Suiten</h2>
  <details class="group"><summary><span class="gname">Timing-Übersicht</span></summary>
    <table><thead><tr><th>Suite</th><th>Dauer</th><th>Status</th></tr></thead><tbody>${timings}</tbody></table>
  </details>
</main>
<footer>Automatisch erstellt vom GCS Test Runner · QA_Report.html</footer>
<script>
const q=document.getElementById('q'),of=document.getElementById('onlyFail');
let failOnly=false;
function apply(){
  const term=q.value.toLowerCase();
  document.querySelectorAll('tr.row').forEach(r=>{
    const txt=r.textContent.toLowerCase();
    const okTxt=!term||txt.includes(term);
    const okFail=!failOnly||!r.classList.contains('ok');
    r.classList.toggle('hidden',!(okTxt&&okFail));
  });
  document.querySelectorAll('details.group').forEach(g=>{
    const vis=g.querySelectorAll('tr.row:not(.hidden)').length;
    g.classList.toggle('hidden',vis===0);
  });
}
q.addEventListener('input',apply);
of.addEventListener('click',()=>{failOnly=!failOnly;of.style.borderColor=failOnly?'var(--fail)':'';apply();});
</script>
</body></html>`;

    // Variante B: Historie mit Zeitstempel + stabile Datei mit dem letzten Stand
    const stamp = new Date().toLocaleString('sv-SE').replace(' ', '_').replaceAll(':', '-');
    const historyFile = path.join(path.dirname(HTML_REPORT_FILE), `QA_Report_${stamp}.html`);
    fs.writeFileSync(historyFile, html, 'utf-8');
    fs.writeFileSync(HTML_REPORT_FILE, html, 'utf-8');
    console.log(`📄 HTML-Report generiert: ${historyFile} (+ ${path.basename(HTML_REPORT_FILE)})`);
}

import { execSync } from 'child_process';

async function main() {
    console.log('===================================================');
    console.log('🛡️  GCS REGRESSION TEST SUITE');
    console.log('===================================================\n');

    const allResults: TestResult[] = [];
    const timer = new SuiteTimer(allResults);
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

        await timer.measure('Sprite-Geometrie', async () => {
            console.log('🏃 Starte Sprite-Geometrie Tests...');
            allResults.push(...await runSpriteGeometryTests());
        });

        await timer.measure('Gezieltes Auffrischen', async () => {
            console.log('🏃 Starte Tests zum gezielten Auffrischen...');
            allResults.push(...await runReactiveTargetedUpdateTests());
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

        await timer.measure('AgentScriptIO', async () => {
            console.log('🏃 Starte AgentScriptIO Tests (Feature-Gruppierung)...');
            allResults.push(...await runAgentScriptIOTests());
        });

        await timer.measure('Raketen-Countdown', async () => {
            console.log('🏃 Starte Raketen-Countdown Tests...');
            allResults.push(...await runRocketCountdownTests());
        });

        await timer.measure('Jump & Run Components', async () => {
            console.log('🏃 Starte Jump & Run Component Tests...');
            allResults.push(...await runJumpAndRunComponentTests());
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
            allResults.push(...runNonvisualInspectorTests());
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

        await timer.measure('TTimer Variable Resolution', async () => {
            allResults.push(...await runTimerVariableTests());
        });

        await timer.measure('SpawnObject Variable Support', async () => {
            allResults.push(...(await runSpawnObjectVariableTests()).map(r => ({
                ...r, type: 'SpawnObject', expectedSuccess: true, actualSuccess: r.passed
            })));
        });

        await timer.measure('TTimer/TIntervalTimer Reactive Properties', async () => {
            allResults.push(...await runTimerReactiveTests());
        });

        await timer.measure('VideoToSpriteSheet Tool', async () => {
            try {
                runVideoToSpriteSheetTests();
                allResults.push({ name: 'VideoToSpriteSheet Tool', passed: true, type: 'Media-Tool', expectedSuccess: true, actualSuccess: true });
            } catch (e: any) {
                allResults.push({ name: 'VideoToSpriteSheet Tool', passed: false, type: 'Media-Tool', expectedSuccess: true, actualSuccess: false, details: e.message });
            }
        });

        // 🌐 Browser E2E Tests (Playwright)
        // Die Server startet Playwright selbst ueber webServer in playwright.config.ts
        // (Vite 5173 + Game-Server 8080); ein Vorab-Portcheck ist nicht noetig.
        console.log('\n🌐 Starte Browser E2E Tests (Playwright)...');

        if (process.env.SKIP_E2E === '1') {
            console.log('ℹ️  Schnelllauf (--fast) — E2E- und Aufbau-Tests werden übersprungen.\n');
            timer.getTimings().push({ name: 'Playwright E2E', durationMs: 0, failed: false });
        } else {
            const playwrightT0 = performance.now();
            try {
                const e2eOutput = execSync('npx playwright test --reporter=json', { encoding: 'utf-8', stdio: 'pipe', maxBuffer: 32 * 1024 * 1024 });
                const e2eData = JSON.parse(e2eOutput);

            const extractResults = (suites: any[], file: string) => {
                suites.forEach((suite: any) => {
                    const currentFile = typeof suite.title === 'string' && suite.title.includes('.spec.') ? suite.title : file;
                    const shortFile = currentFile ? path.basename(currentFile) : 'unbekannt';
                    if (suite.specs) {
                        suite.specs.forEach((spec: any) => {
                            spec.tests.forEach((test: any) => {
                                const result = test.results[0];
                                // Übersprungene Tests ignorieren (z.B. test.describe.skip)
                                if (result.status === 'skipped') return;
                                allResults.push({
                                    name: `E2E: ${spec.title}`,
                                    type: `E2E Browser · ${shortFile}`,
                                    passed: result.status === 'passed',
                                    expectedSuccess: true,
                                    actualSuccess: result.status === 'passed',
                                    details: `Browser: ${test.projectName}`
                                });
                            });
                        });
                    }
                    if (suite.suites) {
                        extractResults(suite.suites, currentFile);
                    }
                });
            };

            extractResults(e2eData.suites, '');
            timer.getTimings().push({ name: 'Playwright E2E', durationMs: performance.now() - playwrightT0, failed: false });
            console.log(`  ⏱  Playwright E2E: ${(performance.now() - playwrightT0).toFixed(0)}ms`);
            console.log('✅ Browser-Tests abgeschlossen.');
        } catch (e2eErr: any) {
            console.warn('⚠️ Playwright Tests fehlgeschlagen oder mit Warnungen abgeschlossen.');
            if (e2eErr.stdout) {
                try {
                    const e2eData = JSON.parse(e2eErr.stdout);

                    const extractFailedResults = (suites: any[], file: string) => {
                        suites.forEach((suite: any) => {
                            const currentFile = typeof suite.title === 'string' && suite.title.includes('.spec.') ? suite.title : file;
                            const shortFile = currentFile ? path.basename(currentFile) : 'unbekannt';
                            if (suite.specs) {
                                suite.specs.forEach((spec: any) => {
                                    spec.tests.forEach((testItem: any) => {
                                        const result = testItem.results[0];
                                        // Übersprungene Tests ignorieren (z.B. test.describe.skip)
                                        if (result.status === 'skipped') return;
                                        allResults.push({
                                            name: `E2E: ${spec.title}`,
                                            type: `E2E Browser · ${shortFile}`,
                                            passed: result.status === 'passed',
                                            expectedSuccess: true,
                                            actualSuccess: result.status === 'passed',
                                            details: `Browser: ${testItem.projectName} - ${result.error?.message || 'Fehler'}`
                                        });
                                    });
                                });
                            }
                            if (suite.suites) {
                                extractFailedResults(suite.suites, currentFile);
                            }
                        });
                    };

                    extractFailedResults(e2eData.suites, '');
                } catch (parseErr) {
                    console.error('❌ Fehler beim Parsen der Playwright-Ergebnisse.');
                }
            }
            timer.getTimings().push({ name: 'Playwright E2E', durationMs: performance.now() - playwrightT0, failed: true });
            console.log(`  ⏱  Playwright E2E: ${(performance.now() - playwrightT0).toFixed(0)}ms (❌ mit Fehlern)`);
        }
    }

        // 🧱 CMS-Aufbauläufe (jede Suite startet ihren eigenen isolierten Minimalserver)
        if (process.env.SKIP_E2E === '1') {
            timer.getTimings().push({ name: 'CMS-Aufbauläufe', durationMs: 0, failed: false });
        } else {
            console.log('\n🧱 Starte CMS-Aufbauläufe (Minimalbestand → Lebenszyklus)...');
            const AUFBAU_SUITES = [
                'test-aufbau-0-basis.cjs', 'test-aufbau-1-admin.cjs', 'test-aufbau-2-raeume.cjs',
                'test-aufbau-3-personen.cjs', 'test-aufbau-4-mandant.cjs', 'test-aufbau-5-spiele.cjs',
                'test-aufbau-6-leben.cjs'
            ];
            const AUFGABE_LABEL: Record<string, string> = {
                '0-basis': 'Basis & SuperAdmin', '1-admin': 'Haus & HouseAdmin', '2-raeume': 'Räume',
                '3-personen': 'Bewohner · Raumzuordnung · Eltern · Beobachter', '4-mandant': 'Mandantentrennung',
                '5-spiele': 'Spiele & Freigaben', '6-leben': 'Konten & Sitzungen'
            };
            const collectAufbau = (suite: string, out: string): number => {
                const short = suite.replace('test-aufbau-', '').replace('.cjs', '');
                const label = `CMS Aufbau · ${AUFGABE_LABEL[short] ?? short}`;
                const body = out.split('Aufgabenbericht')[0];
                let parsed = 0;
                for (const line of body.split(/\r?\n/)) {
                    const m = line.match(/^(OK|FEHLER|BLOCKIERT)\s+(\S+)\s+(.+)$/);
                    if (!m) continue;
                    parsed++;
                    allResults.push({
                        name: `${m[2]} — ${m[3].slice(0, 90)}`,
                        type: label,
                        passed: m[1] === 'OK',
                        expectedSuccess: true,
                        actualSuccess: m[1] === 'OK',
                        details: m[1] === 'BLOCKIERT' ? 'blockiert (Abhängigkeit fehlt)' : undefined
                    });
                }
                return parsed;
            };
            for (const suite of AUFBAU_SUITES) {
                const suiteT0 = performance.now();
                let out = '';
                let suiteFailed = false;
                try {
                    out = execSync(`"${process.execPath}" scripts/${suite}`, { encoding: 'utf-8', stdio: 'pipe', maxBuffer: 16 * 1024 * 1024 });
                } catch (e: any) {
                    suiteFailed = true;
                    out = String(e.stdout || '') + String(e.stderr || '');
                }
                process.stdout.write(out.endsWith('\n') ? out : out + '\n');
                const parsed = collectAufbau(suite, out);
                if (parsed === 0) {
                    const short = suite.replace('test-aufbau-', '').replace('.cjs', '');
                    allResults.push({
                        name: `Suite ${suite}`, type: `CMS Aufbau · ${AUFGABE_LABEL[short] ?? short}`, passed: false,
                        expectedSuccess: true, actualSuccess: false,
                        details: 'Suite ohne Aufgabenbericht abgebrochen'
                    });
                }
                const suiteMs = performance.now() - suiteT0;
                timer.getTimings().push({ name: `Aufbau ${suite}`, durationMs: suiteMs, failed: suiteFailed || parsed === 0 });
                console.log(`  ⏱  Aufbau ${suite}: ${suiteMs.toFixed(0)}ms${suiteFailed ? ' (❌ mit Fehlern)' : ''}`);
            }
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

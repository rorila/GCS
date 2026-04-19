import * as fs from 'fs';
import * as path from 'path';

function getFiles(dir: string, extension: string, ignorePatterns: string[] = []): string[] {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
        let fullPath = path.posix.join(dir, file);
        if (ignorePatterns.some(p => fullPath.includes(p))) continue;
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getFiles(fullPath, extension, ignorePatterns));
        } else if (fullPath.endsWith(extension)) {
            if (!ignorePatterns.some(p => file.includes(p))) {
                results.push(fullPath);
            }
        }
    }
    return results;
}

export interface TestResult {
    name: string;
    type: string;
    expectedSuccess: boolean;
    actualSuccess: boolean;
    passed: boolean;
    details?: string;
}

export async function runGuardTests(): Promise<TestResult[]> {
    console.log("🛡️ Starte System-Guards...");
    const results: TestResult[] = [];

    const addResult = (name: string, passed: boolean, details?: string) => {
        results.push({ name, type: 'System-Guard', expectedSuccess: true, actualSuccess: passed, passed, details });
    };

    // --- T-11: Component-Registrierung (Barrel + ComponentRegistry) ---
    try {
        const componentFiles = getFiles('src/components', '.ts');
        const barrelSource = fs.readFileSync('src/components/index.ts', 'utf-8');

        // Klassen, die bewusst nicht als hydrierbare Komponenten registriert sind:
        const NON_HYDRATABLE = [
            'TComponent',       // Abstrakte Basisklasse
            'TWindow',          // Basisklasse
            'TTextControl',     // Abstrakte Zwischenklasse
            'TVariable',        // Basisklasse fuer Variablen-Typen
            'index',            // Barrel-File selbst
            'ActionApiHandler', // Kein T-Prefix, Helper
            'ImageCapable',     // Mixin
            'PlaybackControls', // Helper-Komponente
            'PlaybackOverlay',  // Helper-Komponente
            'ExpertDialog',     // UI-Helper
            'TStage',           // Factory-verwaltet in GameRuntime / ProjectLoader
            'TFlowStage',       // Factory-verwaltet in GameRuntime / ProjectLoader
            'TDebugLog',        // Reines Singleton-Utility (kein TComponent)
        ];

        const missingInBarrel: string[] = [];
        const missingInRegistry: string[] = [];

        for (const file of componentFiles) {
            const className = path.basename(file, '.ts');
            if (NON_HYDRATABLE.includes(className)) continue;

            // 1. Prüfe Barrel-Re-Export
            const barrelPattern = new RegExp(`export\\s*\\*\\s*from\\s*['"]\\./${className}['"]`);
            if (!barrelPattern.test(barrelSource)) {
                missingInBarrel.push(className);
            }

            // 2. Prüfe echte ComponentRegistry-Registrierung IN der Datei selbst
            const fileContent = fs.readFileSync(file, 'utf-8');
            const registryPattern = new RegExp(`ComponentRegistry\\.register\\(\\s*['"]${className}['"]`);
            if (!registryPattern.test(fileContent)) {
                missingInRegistry.push(className);
            }
        }

        const ok = missingInBarrel.length === 0 && missingInRegistry.length === 0;
        const details: string[] = [];
        if (missingInBarrel.length > 0) {
            details.push(`Fehlt im Barrel (components/index.ts): ${missingInBarrel.join(', ')}`);
        }
        if (missingInRegistry.length > 0) {
            details.push(`Fehlt in ComponentRegistry.register(): ${missingInRegistry.join(', ')}`);
        }
        addResult('Guard: Component Registrierung (Barrel + Registry)', ok,
            ok ? `Alle ${componentFiles.length - NON_HYDRATABLE.length} Komponenten korrekt registriert` : details.join(' | '));
    } catch (e: any) {
        addResult('Guard: Component Registrierung', false, e.message);
    }

    // --- T-11b: DTO-to-Registry Compliance (Structural Check) ---
    try {
        const componentFiles = getFiles('src/components', '.ts');
        
        // Klassen, die `toDTO` haben (weil sie Properties/Save-States exportieren),
        // aber bewusst manuell und außerhalb der Registry hydriert werden:
        const NON_HYDRATABLE_HAS_DTO = [
            'TStage',       
            'TFlowStage',
            'TComponent',  // Abstrakte Klasse hat base toDTO
            'TWindow'      // Basisklasse hat base toDTO
        ];

        const missingRegistry: string[] = [];

        for (const file of componentFiles) {
            const className = path.basename(file, '.ts');
            if (NON_HYDRATABLE_HAS_DTO.includes(className)) continue;

            const fileContent = fs.readFileSync(file, 'utf-8');
            const hasToDto = /toDTO\s*\(/.test(fileContent);
            const hasRegistry = new RegExp(`ComponentRegistry\\.register\\(\\s*['"]${className}['"]`).test(fileContent);

            if (hasToDto && !hasRegistry) {
                // Ist es eine abstrakte Klasse?
                if (!/export\\s+abstract\\s+class/.test(fileContent)) {
                    missingRegistry.push(className);
                }
            }
        }

        const ok = missingRegistry.length === 0;
        addResult('Guard: DTO-to-Registry Compliance (T-11b)', ok,
            ok ? 'Alle serialisierbaren Klassen haben eine Factory' : `Zwingende Factory fehlt für: ${missingRegistry.join(', ')}`);
    } catch (e: any) {
        addResult('Guard: DTO-to-Registry Compliance (T-11b)', false, e.message);
    }

    // --- T-13: Kein console.* im src/ ---
    try {
        const files = getFiles('src', '.ts', ['.test.ts', 'Logger.ts', 'engine', 'stubs']);
        const offenders: string[] = [];
        for (const file of files) {
            const lines = fs.readFileSync(file, 'utf-8').split('\n');
            lines.forEach((line, i) => {
                if (/\bconsole\.(log|warn|error|info|debug)\b/.test(line) && !line.trim().startsWith('//')) {
                    offenders.push(`${file}:${i + 1}`);
                }
            });
        }
        const ok = offenders.length <= 32; // Baseline
        addResult('Guard: Keine unerlaubten console.* Aufrufe', ok, ok ? `Erlaubt (Baseline 32), Aktuell: ${offenders.length}` : `Zu viele: ${offenders.join(', ')}`);
    } catch (e: any) {
        addResult('Guard: console.* Checker', false, e.message);
    }

    // --- T-14: Dateigroesse (< 1000 Zeilen) ---
    try {
        const files = getFiles('src', '.ts', ['.test.ts']);
        const oversized: string[] = [];
        for (const file of files) {
            const lines = fs.readFileSync(file, 'utf-8').split('\n').length;
            if (lines > 1000) oversized.push(`${file} (${lines})`);
        }
        const ok = oversized.length <= 5; // Baseline
        addResult('Guard: Dateigroesse < 1000 Zeilen', ok, ok ? `Baseline 5 eingehalten, Aktuell: ${oversized.length}` : `Zu gross: ${oversized.join(', ')}`);
    } catch (e: any) {
        addResult('Guard: Dateigroesse', false, e.message);
    }

    // --- T-06: bundle:runtime Freshness ---
    try {
        // Alle Quellen, die tatsächlich im runtime-standalone.js gebundelt werden
        const srcFiles = [
            ...getFiles('src/runtime', '.ts', ['.test.ts']),
            ...getFiles('src/components', '.ts', ['.test.ts']),
            ...getFiles('src/multiplayer', '.ts', ['.test.ts']),
            'src/player-standalone.ts',
            'src/utils/Serialization.ts',
            'src/utils/ComponentRegistry.ts',
            'src/utils/SecurityUtils.ts',
            'src/editor/services/StageRenderer.ts',
        ];

        let maxSrcMtime = 0;
        let latestFile = '';
        for (const file of srcFiles) {
            if (!fs.existsSync(file)) continue;
            const mtime = fs.statSync(file).mtimeMs;
            if (mtime > maxSrcMtime) {
                maxSrcMtime = mtime;
                latestFile = file;
            }
        }

        if (fs.existsSync('public/runtime-standalone.js')) {
            const bundleMtime = fs.statSync('public/runtime-standalone.js').mtimeMs;
            // Tolerance of 5 seconds for git-checkout inconsistencies
            const ok = bundleMtime >= maxSrcMtime || (maxSrcMtime - bundleMtime <= 5000);
            const ageSeconds = Math.round((maxSrcMtime - bundleMtime) / 1000);
            addResult('Guard: bundle:runtime Freshness', ok,
                ok ? 'Bundle aktuell' : `Bundle ${ageSeconds}s veraltet (juengste Quelle: ${latestFile}). Bitte "npm run bundle:runtime" ausfuehren!`);
        } else {
            addResult('Guard: bundle:runtime Freshness', false, 'Bundle public/runtime-standalone.js fehlt komplett!');
        }
    } catch (e: any) {
        addResult('Guard: bundle:runtime Freshness', false, e.message);
    }

    // --- T-15: Kein new Function() Security Guard ---
    try {
        const ALLOWED = ['DialogDOMBuilder.ts'];
        const files = getFiles('src', '.ts', ['.test.ts']);
        const offenders: string[] = [];
        
        for (const file of files) {
            if (ALLOWED.some(a => file.replace(/\\/g, '/').endsWith(a))) continue;
            const content = fs.readFileSync(file, 'utf-8');
            if (content.match(/new\s+Function\s*\(/)) {
                offenders.push(file);
            }
        }
        const ok = offenders.length === 0;
        addResult('Guard: Kein new Function() RCE-Risiko', ok, ok ? 'Sauber' : `Gefunden in: ${offenders.join(', ')}`);
    } catch (e: any) {
        addResult('Guard: Kein new Function()', false, e.message);
    }

    return results;
}

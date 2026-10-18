/**
 * dump-action-metadata.cjs — Dokumentationswerkzeug (AP 3)
 *
 * Extrahiert die tatsächlich registrierten Action-Metadaten aus der
 * Runtime-Registry, indem die TypeScript-Quellen per esbuild gebündelt
 * und die Registry in Node ausgeführt wird. So entstehen die Parameter-
 * Tabellen in docs/reference/actions.md aus der Quelle, nicht aus
 * geratenen Listen.
 *
 * Aufruf:  node scripts/docs/dump-action-metadata.cjs
 * Ausgabe: docs/inventory/action-metadata.json  (maschinenlesbar, reproduzierbar)
 *          + Konsolen-Zusammenfassung
 *
 * Keine Änderung an der Anwendungslogik — liest nur Quellen.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const esbuild = require('esbuild');

const ROOT = path.resolve(__dirname, '..', '..');
const ENTRY = path.join(ROOT, '.tmp-action-meta-entry.ts');
const BUNDLE = path.join(ROOT, '.tmp-action-meta-bundle.cjs');
const OUT = path.join(ROOT, 'docs', 'inventory', 'action-metadata.json');

const ENTRY_SRC = `// GENERIERT von scripts/docs/dump-action-metadata.cjs — nicht committen
import { registerStandardActions } from './src/runtime/actions/StandardActions';
import { actionRegistry } from './src/runtime/ActionRegistry';
registerStandardActions();
const all = actionRegistry.getAllMetadata();
console.log(JSON.stringify(all, null, 2));
`;

function main() {
    fs.writeFileSync(ENTRY, ENTRY_SRC, 'utf8');
    try {
        esbuild.buildSync({
            entryPoints: [ENTRY],
            bundle: true,
            platform: 'node',
            format: 'cjs',
            outfile: BUNDLE,
            logLevel: 'warning'
        });
        const out = execFileSync('node', [BUNDLE], { cwd: ROOT, encoding: 'utf8' });
        const meta = JSON.parse(out);
        fs.mkdirSync(path.dirname(OUT), { recursive: true });
        fs.writeFileSync(OUT, JSON.stringify({
            generated: new Date().toISOString(),
            tool: 'scripts/docs/dump-action-metadata.cjs',
            source: 'ActionRegistry.getAllMetadata() via esbuild-Bundle',
            count: meta.length,
            types: meta
        }, null, 2));
        console.log(`${meta.length} Action-Typen → ${path.relative(ROOT, OUT)}`);
    } finally {
        for (const f of [ENTRY, BUNDLE]) if (fs.existsSync(f)) fs.unlinkSync(f);
    }
}

main();

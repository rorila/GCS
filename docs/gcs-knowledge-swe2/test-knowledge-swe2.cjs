#!/usr/bin/env node
/**
 * test-knowledge-swe2.cjs — Regressionstests zur SWE-2-Wissensbasis.
 *
 * Jeder Test bezieht sich auf einen Codex-Befund (siehe FINDINGS-CODEX.json).
 * Negativtests bauen manipulierte Snapshot-Kopien in ./_test-tmp/ und
 * erwarten, dass der Validator mit Exit != 0 abbricht.
 *
 * Aufruf:  node docs/gcs-knowledge-swe2/test-knowledge-swe2.cjs
 * Voraussetzung: Build wurde zuvor ausgeführt.
 * Exit 1 bei Fehlschlag.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const OUT = __dirname;
const ROOT = path.join(OUT, '..', '..');
const TMP = path.join(OUT, '_test-tmp');
const read = (p) => fs.readFileSync(p, 'utf-8');
const load = (rel) => JSON.parse(read(path.join(OUT, rel)));

let passed = 0, failed = 0;
const ok = (cond, label) => {
    if (cond) { passed++; console.log(`  PASS  ${label}`); }
    else { failed++; console.log(`  FAIL  ${label}`); }
};

const index = load('knowledge-index-swe2.json');
const comps = load('entities/components-swe2.json');
const actions = load('entities/action-types-swe2.json');
const byName = Object.fromEntries(comps.map(c => [c.name, c]));
const chunkLines = read(path.join(OUT, 'chunks/chunks-swe2.jsonl')).trim().split('\n')
    .map(l => JSON.parse(l));

console.log('=== POSITIVTESTS ===\n');

/* ── A07: Event-Vererbung (Referenzfälle aus dem Codex-Audit) ── */
console.log('-- A07 Event-Vererbung --');
const tComp = byName['TComponent'], tWin = byName['TWindow'], tSpr = byName['TSprite'];
ok(tComp.events.length === 11 && tComp.events.every(e => e.origin === 'own'),
    'TComponent: 11 eigene Events');
ok(tWin.events.length === 13
    && tWin.events.filter(e => e.origin === 'own').length === 3
    && tWin.events.filter(e => e.origin === 'inherited').length === 10,
    'TWindow: 3 eigene + 10 geerbte Events');
ok(tWin.events.every(e => (e.conditions || []).some(c => c.guard === 'isHiddenInRun' && c.availableWhen === false)),
    'TWindow: alle Events mit Bedingung isHiddenInRun=false');
ok(tSpr.events.length === 23
    && tSpr.events.filter(e => e.origin === 'own').length === 10
    && tSpr.events.filter(e => e.origin === 'inherited').length === 13,
    'TSprite: 10 eigene + 13 geerbte Events (= 23, Codex-Erwartung)');
ok(tSpr.events.filter(e => e.origin === 'inherited').every(e => (e.conditions || []).length > 0)
    && tSpr.events.filter(e => e.origin === 'own').every(e => !(e.conditions || []).length),
    'TSprite: isHiddenInRun gilt nur für geerbte Events');
const tBtn = byName['TButton'];
ok(tBtn.events.length === 13 && tBtn.events.every(e => e.origin === 'inherited'),
    'TButton ohne eigenes getEvents: komplette Elternkette (13 geerbte)');

/* ── A05: Chunk-ID-Eindeutigkeit ── */
console.log('-- A05 Chunk-IDs --');
const ids = new Set(); let dups = 0;
for (const c of chunkLines) { if (ids.has(c.chunkId)) dups++; ids.add(c.chunkId); }
ok(dups === 0, `chunkIds eindeutig (${ids.size} IDs, ${dups} Kollisionen)`);
ok(chunkLines.every(c => c.metadata && c.metadata.sourceDoc),
    'Jeder Chunk trägt metadata.sourceDoc');

/* ── A06: Action-Parameter-Vollständigkeit ── */
console.log('-- A06 Action-Parameter --');
const actionMeta = JSON.parse(read(path.join(ROOT, 'docs/inventory/action-metadata.json')));
const metaByType = new Map(actionMeta.types.map(t => [t.type, t]));
let loss = 0;
for (const a of actions) {
    const meta = metaByType.get(a.name);
    if (!meta) continue;
    const ep = new Map((a.parameters || []).map(p => [p.name, p]));
    for (const rp of meta.parameters || []) {
        const e = ep.get(rp.name);
        if (!e) { loss++; continue; }
        for (const [f, v] of Object.entries(rp)) {
            if (v !== undefined && JSON.stringify(e[f]) !== JSON.stringify(v)) loss++;
        }
    }
}
ok(loss === 0, `Registry-Metadaten verlustfrei (${loss} Feldverluste)`);
const animate = actions.find(a => a.name === 'animate');
ok(animate.parameters.find(p => p.name === 'duration')?.defaultValue === 500
    && animate.parameters.find(p => p.name === 'effect')?.defaultValue === 'shake',
    'animate: defaultValue duration=500, effect=shake');
ok(animate.parameters.find(p => p.name === 'target')?.allowVariableBinding === true
    && animate.parameters.find(p => p.name === 'target')?.source === 'objects',
    'animate: target mit source/allowVariableBinding');
ok(animate.parameters.find(p => p.name === 'source')?.visibleWhen?.field === 'effect',
    'animate: visibleWhen-Bedingung erhalten');

/* ── A08: Vertrauensstufen ── */
console.log('-- A08 Vertrauensstufen --');
const allEntities = ['components', 'features', 'action-types', 'methods', 'events',
    'schemas', 'guide-chapters', 'documents', 'concepts']
    .flatMap(f => load(`entities/${f}-swe2.json`));
const CONF_RANK = { inferred: 0, documented: 1, verified: 2 };
const maxOf = (facts) => Object.values(facts).filter(Boolean)
    .reduce((m, v) => CONF_RANK[v] > CONF_RANK[m] ? v : m, 'inferred');
ok(allEntities.every(e => e.provenance?.facts && Object.keys(e.provenance.facts).length > 0),
    'Jede Entity besitzt provenance.facts');
ok(allEntities.every(e => e.provenance.confidence === maxOf(e.provenance.facts)),
    'confidence == max(facts) für alle Entities');
ok(comps.every(c => Object.values(c.properties || {}).every(p => ['verified', 'documented', 'inferred'].includes(p.confidence))),
    'Jede Komponenten-Eigenschaft trägt eigene confidence');
ok(comps.every(c => (c.events || []).every(e => e.confidence)),
    'Jedes Komponenten-Event trägt eigene confidence');

/* ── A04/A14: Manifest-Integrität + Snapshot-Bindung ── */
console.log('-- A04/A14 Manifest --');
ok(index.schemaVersion === '1.1.0', 'schemaVersion 1.1.0');
ok(index.counts.entities === allEntities.length, 'counts.entities stimmt');
ok(index.counts.chunks === chunkLines.length, 'counts.chunks stimmt');
ok(index.checksums && Object.keys(index.checksums).length >= 10,
    'index.checksums bindet alle Nutzdaten');

/* ── Negativtests: manipulierte Snapshot-Kopien müssen scheitern ── */
console.log('\n=== NEGATIVTESTS (Validator muss Exit != 0 liefern) ===\n');
const copySnapshot = (name) => {
    const dst = path.join(TMP, name);
    fs.rmSync(dst, { recursive: true, force: true });
    fs.mkdirSync(path.join(dst, 'entities'), { recursive: true });
    fs.mkdirSync(path.join(dst, 'chunks'), { recursive: true });
    for (const f of fs.readdirSync(path.join(OUT, 'entities'))) {
        fs.copyFileSync(path.join(OUT, 'entities', f), path.join(dst, 'entities', f));
    }
    fs.copyFileSync(path.join(OUT, 'chunks', 'chunks-swe2.jsonl'), path.join(dst, 'chunks', 'chunks-swe2.jsonl'));
    for (const f of ['knowledge-index-swe2.json', 'id-map-swe2.json', 'knowledge-schema-swe2.json']) {
        fs.copyFileSync(path.join(OUT, f), path.join(dst, f));
    }
    return dst;
};
// Bei Mutationen einer Datei muss auch deren Checksumme im Manifest
// entfernt oder angepasst werden — sonst schlägt der Checksum-Test vor
// dem eigentlichen Negativaspekt zu. Wir passen die Checksumme an, damit
// jeder Test genau einen Fehler isoliert.
const refreshChecksum = (dir, file) => {
    const idx = JSON.parse(read(path.join(dir, 'knowledge-index-swe2.json')));
    idx.checksums[file] = 'sha256:' + require('crypto').createHash('sha256')
        .update(fs.readFileSync(path.join(dir, file))).digest('hex');
    fs.writeFileSync(path.join(dir, 'knowledge-index-swe2.json'), JSON.stringify(idx, null, 1) + '\n');
};
const runValidator = (dir) => spawnSync(process.execPath,
    [path.join(OUT, 'validate-knowledge-swe2.cjs'), `--dir=${dir}`],
    { encoding: 'utf-8' });

const negTests = [
    {
        name: 'A04: fehlendes version.extractedAt',
        mutate: (d) => {
            const f = 'entities/components-swe2.json';
            const p = path.join(d, f);
            const list = JSON.parse(read(p));
            delete list[0].version.extractedAt;
            fs.writeFileSync(p, JSON.stringify(list, null, 1));
            refreshChecksum(d, f);
        },
        expect: /extractedAt/
    },
    {
        name: 'A04: doppelte Entity-ID',
        mutate: (d) => {
            const f = 'entities/components-swe2.json';
            const p = path.join(d, f);
            const list = JSON.parse(read(p));
            list.push({ ...list[0], name: 'TDuplicate' });
            fs.writeFileSync(p, JSON.stringify(list, null, 1));
            refreshChecksum(d, f);
        },
        expect: /Doppelte ID|counts\.entities/
    },
    {
        name: 'A04: unauflösbare Relation',
        mutate: (d) => {
            const f = 'entities/components-swe2.json';
            const p = path.join(d, f);
            const list = JSON.parse(read(p));
            list[0].relations = [{ type: 'inherits', target: 'COMP-9999' }];
            fs.writeFileSync(p, JSON.stringify(list, null, 1));
            refreshChecksum(d, f);
        },
        expect: /nicht auflösbar/
    },
    {
        name: 'A04: fehlender status.dev',
        mutate: (d) => {
            const f = 'entities/components-swe2.json';
            const p = path.join(d, f);
            const list = JSON.parse(read(p));
            delete list[0].status.dev;
            fs.writeFileSync(p, JSON.stringify(list, null, 1));
            refreshChecksum(d, f);
        },
        expect: /status\.dev/
    },
    {
        name: 'A04: ungültige schemaVersion',
        mutate: (d) => {
            const p = path.join(d, 'knowledge-index-swe2.json');
            const idx = JSON.parse(read(p));
            idx.schemaVersion = '1.broken';
            fs.writeFileSync(p, JSON.stringify(idx, null, 1));
        },
        expect: /SemVer/
    },
    {
        name: 'A04: falscher Manifestzähler',
        mutate: (d) => {
            const p = path.join(d, 'knowledge-index-swe2.json');
            const idx = JSON.parse(read(p));
            idx.counts.entities = 9999;
            fs.writeFileSync(p, JSON.stringify(idx, null, 1));
        },
        expect: /counts\.entities/
    },
    {
        name: 'A05: doppelte chunkId',
        mutate: (d) => {
            const f = 'chunks/chunks-swe2.jsonl';
            const p = path.join(d, f);
            const lines = read(p).trim().split('\n');
            lines.push(lines[0]); // chunkId duplizieren
            fs.writeFileSync(p, lines.join('\n') + '\n');
            refreshChecksum(d, f);
            // counts.chunks ebenfalls anpassen, sonst greift der Zähler-Fehler
            const ip = path.join(d, 'knowledge-index-swe2.json');
            const idx = JSON.parse(read(ip));
            idx.counts.chunks = lines.length;
            fs.writeFileSync(ip, JSON.stringify(idx, null, 1));
        },
        expect: /Doppelte chunkId/
    },
    {
        name: 'A14: manipulierter Snapshot ohne Manifest-Update',
        mutate: (d) => {
            const f = 'entities/components-swe2.json';
            const p = path.join(d, f);
            const list = JSON.parse(read(p));
            list[0].description = 'MANIPULIERT';
            fs.writeFileSync(p, JSON.stringify(list, null, 1));
            // Checksum absichtlich NICHT erneuern
        },
        expect: /Checksum-Mismatch/
    },
    {
        name: 'A08: confidence != max(facts)',
        mutate: (d) => {
            const f = 'entities/components-swe2.json';
            const p = path.join(d, f);
            const list = JSON.parse(read(p));
            list[0].provenance.confidence = 'inferred';
            fs.writeFileSync(p, JSON.stringify(list, null, 1));
            refreshChecksum(d, f);
        },
        expect: /confidence/
    }
];

for (const t of negTests) {
    const dir = copySnapshot(t.name.replace(/[^a-z0-9]/gi, '-'));
    t.mutate(dir);
    const r = runValidator(dir);
    const out = (r.stdout || '') + (r.stderr || '');
    const rejected = r.status !== 0;
    ok(rejected && (!t.expect || t.expect.test(out)),
        `${t.name} → Exit ${r.status}${rejected && !t.expect.test(out) ? ', aber unerwartete Meldung' : ''}`);
}
fs.rmSync(TMP, { recursive: true, force: true });

/* ── A14: Byte-Reproduzierbarkeit bei fixiertem Buildzeitpunkt ── */
console.log('\n-- A14 Byte-Reproduzierbarkeit --');
const snapshotFiles = () => {
    const files = ['knowledge-index-swe2.json', 'id-map-swe2.json', 'chunks/chunks-swe2.jsonl'];
    for (const f of fs.readdirSync(path.join(OUT, 'entities'))) files.push(`entities/${f}`);
    const map = new Map();
    for (const f of files) map.set(f, require('crypto').createHash('sha256')
        .update(fs.readFileSync(path.join(OUT, f))).digest('hex'));
    return map;
};
const before = snapshotFiles();
execFileSync(process.execPath, [path.join(OUT, 'build-knowledge-swe2.cjs')],
    { env: { ...process.env, SWE2_BUILD_TIME: '2026-01-01T00:00:00.000Z' }, stdio: 'pipe' });
const after1 = snapshotFiles();
execFileSync(process.execPath, [path.join(OUT, 'build-knowledge-swe2.cjs')],
    { env: { ...process.env, SWE2_BUILD_TIME: '2026-01-01T00:00:00.000Z' }, stdio: 'pipe' });
const after2 = snapshotFiles();
const diff = [...after2.keys()].filter(f => after1.get(f) !== after2.get(f));
ok(diff.length === 0, `Zwei Builds mit fixiertem SWE2_BUILD_TIME → ${diff.length} byteverschiedene Dateien${diff.length ? ': ' + diff.join(', ') : ''}`);
// ID-Stabilität über den Rebuild hinweg
const idsAfter = new Set();
for (const f of fs.readdirSync(path.join(OUT, 'entities'))) {
    for (const e of JSON.parse(read(path.join(OUT, 'entities', f)))) idsAfter.add(e.id);
}
ok(before.size === after2.size && idsAfter.size === allEntities.length,
    `Entity-IDs nach Rebuild unverändert (${idsAfter.size})`);
// Rückbau auf tatsächlichen Zeitpunkt
execFileSync(process.execPath, [path.join(OUT, 'build-knowledge-swe2.cjs')], { stdio: 'pipe' });

console.log(`\n=== ERGEBNIS: ${passed} PASS / ${failed} FAIL ===`);
process.exit(failed ? 1 : 0);

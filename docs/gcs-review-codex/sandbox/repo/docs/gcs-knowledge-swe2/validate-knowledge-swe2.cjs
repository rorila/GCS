#!/usr/bin/env node
/**
 * validate-knowledge-swe2.cjs — Prüft die generierte Wissensbasis.
 *
 * Prüfungen:
 *   1. Schema-Integrität (Pflichtfelder, Enum-Werte, ID-Muster)
 *   2. ID-Stabilität (Vergleich mit id-map-swe2.json aus letztem Build)
 *   3. Beziehungs-Auflösbarkeit (alle relations.target existieren)
 *   4. Quellen-Existenz (code/docs/tests-Dateien vorhanden)
 *   5. Vollständigkeit (≥ Inventar-Zähler: 128 COMP / 12 FEAT / 59 ACT)
 *   6. Action-Existenz (Action-Typen gegen action-metadata.json)
 *   7. Parameter-Gültigkeit (bekannte Typen aus Registries)
 *   8. Status-Kennzeichnung (geplant/veraltet konsistent)
 *   9. Chunk-Integrität (entityId auflösbar, keine leeren Texte)
 *
 * Aufruf: node docs/gcs-knowledge-swe2/validate-knowledge-swe2.cjs
 * Exit-Code 1 bei Fehlern.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const OUT = __dirname;
const read = (p) => fs.readFileSync(p, 'utf-8');
const exists = (p) => fs.existsSync(p);

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

/* ── Laden ── */
const index = JSON.parse(read(path.join(OUT, 'knowledge-index-swe2.json')));
const idMap = JSON.parse(read(path.join(OUT, 'id-map-swe2.json')));
const entityFiles = fs.readdirSync(path.join(OUT, 'entities')).filter(f => f.endsWith('.json'));
const entities = [];
for (const f of entityFiles) {
    entities.push(...JSON.parse(read(path.join(OUT, 'entities', f))));
}
const chunks = read(path.join(OUT, 'chunks', 'chunks-swe2.jsonl'))
    .trim().split('\n').map(l => JSON.parse(l));

const inventory = JSON.parse(read(path.join(ROOT, 'docs', 'inventory', 'FEATURE-INVENTORY.json')));
const actionMeta = JSON.parse(read(path.join(ROOT, 'docs', 'inventory', 'action-metadata.json')));

/* ── 1. Schema-Integrität ── */
const ID_RE = /^(COMP|FEAT|DOC|ACT|MTH|EVT|SCM|GUIDE|CON)-[A-Za-z0-9_-]+$/;
const KINDS = new Set(['component', 'feature', 'action-type', 'method', 'event', 'schema', 'guide-chapter', 'document', 'concept']);
const DEV = new Set(['geplant', 'experimentell', 'implementiert', 'veraltet']);
const TEST = new Set(['nicht getestet', 'test vorhanden', 'test fehlgeschlagen', 'automatisiert erfolgreich', 'manuell geprüft']);
const DOC = new Set(['entwurf', 'technisch geprüft', 'fachlich freigegeben']);
const CONF = new Set(['verified', 'documented', 'inferred']);
const RELTYPES = new Set(['inherits', 'hasSchema', 'dependsOn', 'documentedIn', 'seeAlso', 'declaresEvent', 'hasMethod', 'usedIn']);

const seenIds = new Set();
for (const e of entities) {
    if (!e.id || !ID_RE.test(e.id)) err(`Ungültige ID: ${e.id} (${e.name})`);
    if (seenIds.has(e.id)) err(`Doppelte ID: ${e.id}`);
    seenIds.add(e.id);
    if (!KINDS.has(e.kind)) err(`${e.id}: unbekanntes kind '${e.kind}'`);
    if (!e.name) err(`${e.id}: name fehlt`);
    const s = e.status || {};
    if (!DEV.has(s.dev)) err(`${e.id}: status.dev '${s.dev}' ungültig`);
    if (!TEST.has(s.test)) err(`${e.id}: status.test '${s.test}' ungültig`);
    if (!DOC.has(s.doc)) err(`${e.id}: status.doc '${s.doc}' ungültig`);
    const p = e.provenance || {};
    if (!Array.isArray(p.method) || !p.method.length) err(`${e.id}: provenance.method fehlt`);
    if (!CONF.has(p.confidence)) err(`${e.id}: provenance.confidence '${p.confidence}' ungültig`);
    if (!e.sources || typeof e.sources !== 'object') err(`${e.id}: sources fehlt`);
    if (!e.version?.contentHash) err(`${e.id}: version.contentHash fehlt`);
    for (const r of e.relations || []) {
        if (!RELTYPES.has(r.type)) err(`${e.id}: unbekannter relation.type '${r.type}'`);
        if (!r.target || !ID_RE.test(r.target)) err(`${e.id}: ungültiges relation.target '${r.target}'`);
    }
    for (const ev of e.events || []) {
        if (!ev.name) err(`${e.id}: Event ohne name`);
    }
    for (const pm of e.parameters || []) {
        if (!pm.name || !pm.type) err(`${e.id}: Parameter ohne name/type`);
    }
}

/* ── 2. ID-Stabilität ── */
// Jede vergebene ID in id-map muss einer Entity entsprechen und umgekehrt
// müssen ACT/MTH/EVT/SCM/GUIDE/CON-IDs in der Map stehen.
const mapValues = new Set(Object.values(idMap.keys));
for (const e of entities) {
    if (/^(ACT|MTH|EVT|SCM|GUIDE|CON)-/.test(e.id) && !mapValues.has(e.id)) {
        err(`${e.id}: nicht in id-map-swe2.json — ID nicht persistent?`);
    }
}
const mapEntityIds = new Set(entities.map(e => e.id));
for (const [k, v] of Object.entries(idMap.keys)) {
    if (!mapEntityIds.has(v)) warn(`id-map Schlüssel '${k}' → ${v} zeigt auf keine Entity (veralteter Eintrag?)`);
}

/* ── 3. Beziehungs-Auflösbarkeit ── */
let unresolved = 0;
for (const e of entities) {
    for (const r of e.relations || []) {
        if (!mapEntityIds.has(r.target)) {
            err(`${e.id}: relation.target ${r.target} (${r.type}) nicht auflösbar`);
            unresolved++;
        }
    }
}

/* ── 4. Quellen-Existenz ── */
let missingSrc = 0;
const globMatch = (s) => {
    const dir = path.join(ROOT, path.dirname(s));
    if (!exists(dir)) return false;
    const re = new RegExp('^' + path.basename(s).replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
    return fs.readdirSync(dir).some(f => re.test(f));
};
for (const e of entities) {
    const all = [...(e.sources?.code || []), ...(e.sources?.docs || []), ...(e.sources?.tests || [])];
    for (const s of all) {
        const p = path.join(ROOT, s);
        // Verzeichnis-Angaben (enden auf '/') und Glob-Muster ('*') erlauben
        if (s.endsWith('/')) { if (!exists(p)) { err(`${e.id}: Quellverzeichnis fehlt: ${s}`); missingSrc++; } continue; }
        if (s.includes('*')) { if (!globMatch(s)) { warn(`${e.id}: Glob-Quelle ohne Treffer: ${s}`); } continue; }
        if (!exists(p)) {
            // Als `missing` markierte Dokumente sind bekannt gelöscht → Warnung
            if (e.missing) { warn(`${e.id}: Quelldatei (bekannt) fehlt: ${s}`); continue; }
            err(`${e.id}: Quelldatei fehlt: ${s}`); missingSrc++;
        }
    }
}

/* ── 5. Vollständigkeit ── */
const count = (kind) => entities.filter(e => e.kind === kind).length;
if (count('component') < inventory.components.length) err(`components: ${count('component')} < Inventar ${inventory.components.length}`);
if (count('feature') < inventory.features.length) err(`features: ${count('feature')} < Inventar ${inventory.features.length}`);
if (count('action-type') < actionMeta.types.length) err(`action-types: ${count('action-type')} < Metadaten ${actionMeta.types.length}`);
if (count('document') < inventory.documents.length) err(`documents: ${count('document')} < Inventar ${inventory.documents.length}`);

// Alle Inventar-IDs müssen übernommen sein
for (const c of [...inventory.components, ...inventory.features, ...inventory.documents]) {
    if (!mapEntityIds.has(c.id)) err(`Inventar-ID fehlt in der Wissensbasis: ${c.id} (${c.name || c.file})`);
}

/* ── 6. Action-Existenz ── */
const metaTypes = new Set(actionMeta.types.map(t => t.type));
const actEntities = entities.filter(e => e.kind === 'action-type');
for (const a of actEntities) {
    if (!metaTypes.has(a.name)) err(`Action-Type ${a.id} '${a.name}' nicht in action-metadata.json — erfunden?`);
}
for (const t of metaTypes) {
    if (!actEntities.some(a => a.name === t)) err(`Action-Typ '${t}' aus Registry fehlt in der Wissensbasis`);
}

/* ── 7. Parameter-Gültigkeit ── */
const PARAM_TYPES = new Set(['string', 'number', 'boolean', 'select', 'color', 'keyvalue',
    'textarea', 'image_picker', 'audio_picker', 'objects', 'object', 'variable', 'variables',
    'tasks', 'task', 'events', 'event', 'stages', 'themes', 'json', 'expression', 'text',
    'number_optional', 'string_optional', 'multiselect', 'stage_ref', 'component']);
let badParams = 0;
for (const e of entities) {
    for (const pm of e.parameters || []) {
        if (!PARAM_TYPES.has(pm.type)) {
            warn(`${e.id} (${e.name}): unbekannter Parameter-Typ '${pm.type}' bei '${pm.name}'`);
            badParams++;
        }
    }
}
// Component-Properties: Typen aus Schema-Modulen. Varianten wie
// 'number (0–1)' werden über das Präfix erkannt; generische Container-
// Typen (array/object/any) kommen in Schemas tatsächlich vor.
const PROP_TYPES = new Set(['string', 'number', 'boolean', 'select', 'color', 'textarea',
    'image_picker', 'audio_picker', 'json', 'text', 'richtext', 'code', 'slider',
    'keyvalue', 'variable', 'file', 'date', 'range', 'array', 'object', 'any']);
const propTypeOk = (t) => PROP_TYPES.has(t) || /^number\b/.test(t) || /^string\b/.test(t);
for (const e of entities.filter(x => x.kind === 'component')) {
    for (const [pn, pd] of Object.entries(e.properties || {})) {
        if (pd.type && !propTypeOk(pd.type)) {
            warn(`${e.id} (${e.name}): Property '${pn}' mit unbekanntem Typ '${pd.type}'`);
            badParams++;
        }
    }
}

/* ── 8. Status-Kennzeichnung ── */
const planedOrDeprecated = entities.filter(e => ['geplant', 'veraltet'].includes(e.status.dev));
// veraltete Features laut Inventar müssen veraltet bleiben
for (const f of inventory.features) {
    if (['geplant', 'veraltet'].includes(f.devStatus)) {
        const e = entities.find(x => x.id === f.id);
        if (!e || e.status.dev !== f.devStatus) err(`Feature ${f.id}: devStatus '${f.devStatus}' nicht übernommen`);
    }
}
// Dokumente mit rating 'möglicherweise veraltet'/'veraltet' müssen dev!=implementiert tragen
for (const d of inventory.documents.filter(x => /veraltet/.test(x.rating))) {
    const e = entities.find(x => x.id === d.id);
    if (e && e.status.dev === 'implementiert') warn(`Document ${d.id}: Inventar-Rating '${d.rating}', Entity als implementiert markiert`);
}

/* ── 9. Chunk-Integrität ── */
const chunkEntityIds = new Set(chunks.map(c => c.entityId));
for (const c of chunks) {
    if (!mapEntityIds.has(c.entityId)) err(`Chunk ${c.chunkId}: entityId ${c.entityId} nicht auflösbar`);
    if (!c.text || !c.text.trim()) err(`Chunk ${c.chunkId}: leerer Text`);
    if (c.charCount !== c.text.length) warn(`Chunk ${c.chunkId}: charCount ${c.charCount} != ${c.text.length}`);
    if (c.charCount > 4500) warn(`Chunk ${c.chunkId}: ${c.charCount} Zeichen > Richtwert 4000`);
}
// Entitäten mit Doku-Quelle, aber ohne Chunks (nur Hinweis)
const chunkless = entities.filter(e =>
    ['component', 'feature', 'concept', 'guide-chapter'].includes(e.kind) &&
    (e.sources?.docs || []).length > 0 && !chunkEntityIds.has(e.id));
if (chunkless.length) warn(`${chunkless.length} dokumentierte Entities ohne Chunks: ${chunkless.slice(0, 8).map(e => e.id).join(', ')}`);

/* ── Ergebnis ── */
console.log('=== VALIDIERUNG GCS-WISSENSBASIS ===');
console.log(`Entities: ${entities.length} | Chunks: ${chunks.length} | ID-Map: ${Object.keys(idMap.keys).length}`);
console.log(`unauflösbare Relationen: ${unresolved} | fehlende Quellen: ${missingSrc} | Parameter-Warnungen: ${badParams}`);
console.log(`geplant/veraltet markiert: ${planedOrDeprecated.length}`);
console.log('---');
if (warnings.length) {
    console.log(`WARNUNGEN (${warnings.length}):`);
    warnings.slice(0, 30).forEach(w => console.log('  ⚠ ' + w));
    if (warnings.length > 30) console.log(`  … +${warnings.length - 30} weitere`);
}
if (errors.length) {
    console.log(`FEHLER (${errors.length}):`);
    errors.slice(0, 40).forEach(e => console.log('  ✗ ' + e));
    if (errors.length > 40) console.log(`  … +${errors.length - 40} weitere`);
    process.exit(1);
} else {
    console.log(`ERGEBNIS: BESTANDEN (${warnings.length} Warnungen)`);
}

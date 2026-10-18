#!/usr/bin/env node
/**
 * build-knowledge-swe2.cjs — Erzeugt die strukturierte GCS-Wissensbasis.
 *
 * Quellen (nur lesend):
 *   docs/inventory/FEATURE-INVENTORY.json  – IDs/Status (Single Source of Truth)
 *   docs/inventory/action-metadata.json    – 59 Action-Typen aus ActionRegistry
 *   docs/reference/components/*.md         – kuratierte Komponentenkarten
 *   docs/reference/*.md                    – Konzeptreferenzen
 *   docs/schemas/schema_*.json             – Eigenschaften/Defaultwerte
 *   docs/features/, docs/architecture/, docs/user-guide/
 *   src/components/*.ts                    – getEvents()-Extrakt
 *   src/editor/MethodRegistry.ts           – Methoden-Extrakt
 *
 * Ausgabe (nur docs/gcs-knowledge-swe2/):
 *   entities/*.json, chunks/chunks-swe2.jsonl, knowledge-index-swe2.json,
 *   id-map-swe2.json (persistente Schlüssel→ID-Zuordnung für stabile IDs)
 *
 * Aufruf: node docs/gcs-knowledge-swe2/build-knowledge-swe2.cjs
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..');
const OUT = __dirname;
const SRC_DOCS = path.join(ROOT, 'docs');
const SRC_CODE = path.join(ROOT, 'src');

const hash = (s) => 'sha256:' + crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
const read = (p) => fs.readFileSync(p, 'utf-8');
const exists = (p) => fs.existsSync(p);
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const NOW = new Date().toISOString();

/* ─────────────────────────────────────────────────────────────
   0. Persistente ID-Zuordnung (stabile IDs über Rebuilds)
   ───────────────────────────────────────────────────────────── */
const ID_MAP_FILE = path.join(OUT, 'id-map-swe2.json');
const idMap = exists(ID_MAP_FILE)
    ? JSON.parse(read(ID_MAP_FILE))
    : { counters: {}, keys: {} };

function assignId(prefix, key) {
    const mapKey = `${prefix}:${key}`;
    if (idMap.keys[mapKey]) return idMap.keys[mapKey];
    idMap.counters[prefix] = (idMap.counters[prefix] || 0) + 1;
    const id = `${prefix}-${String(idMap.counters[prefix]).padStart(4, '0')}`;
    idMap.keys[mapKey] = id;
    return id;
}

/* ─────────────────────────────────────────────────────────────
   1. Quellen laden
   ───────────────────────────────────────────────────────────── */
const inventory = JSON.parse(read(path.join(SRC_DOCS, 'inventory', 'FEATURE-INVENTORY.json')));
const actionMeta = JSON.parse(read(path.join(SRC_DOCS, 'inventory', 'action-metadata.json')));

const compByName = new Map(inventory.components.map(c => [c.name, c]));
const docByPath = new Map(inventory.documents.map(d => [d.file, d]));
const docIdFor = (docPath) => docByPath.get(docPath)?.id || null;

// Schema-Module: Komponentenname → {schemaFile, props}
const schemaFiles = fs.readdirSync(path.join(SRC_DOCS, 'schemas'))
    .filter(f => /^schema_.*\.json$/.test(f));
const schemaIndex = new Map(); // compName → {file, module, props}
const schemaModules = [];
for (const f of schemaFiles) {
    const fp = path.join(SRC_DOCS, 'schemas', f);
    const json = JSON.parse(read(fp));
    schemaModules.push({ file: `docs/schemas/${f}`, json });
    for (const [compName, def] of Object.entries(json.components || {})) {
        schemaIndex.set(compName, {
            file: `docs/schemas/${f}`,
            module: json.$module,
            description: def.description,
            props: def.properties || {}
        });
    }
}

/* ─────────────────────────────────────────────────────────────
   2. Quellcode-Extrakte (read-only)
   ───────────────────────────────────────────────────────────── */

// 2a. getEvents() aus src/components/*.ts
//     Erfasst String-Literale im Rückgabe-Array; `...super.getEvents()`
//     wird als 'inherited' markiert.
function extractEvents(tsSource) {
    const m = tsSource.match(/getEvents\s*\(\s*\)\s*:\s*string\[\]\s*\{([\s\S]*?)\}/);
    if (!m) return null;
    const body = m[1];
    const events = [];
    const literals = body.match(/'([^']+)'/g) || [];
    literals.forEach(l => events.push(l.slice(1, -1)));
    return {
        own: events.filter(e => e !== 'string' && !/^\s*$/.test(e)),
        inheritsSuper: /\.\.\.super\.getEvents\(\)/.test(body)
    };
}

const componentSources = new Map(); // className → {path, events, extends}
for (const f of fs.readdirSync(path.join(SRC_CODE, 'components')).filter(f => f.endsWith('.ts'))) {
    const fp = path.join(SRC_CODE, 'components', f);
    const src = read(fp);
    const cls = f.replace(/\.ts$/, '');
    const extendsM = src.match(/class\s+\w+\s+extends\s+(\w+)/);
    componentSources.set(cls, {
        path: rel(fp),
        events: extractEvents(src),
        extends: extendsM ? extendsM[1] : null
    });
}

// 2b. MethodRegistry aus src/editor/MethodRegistry.ts
//     Das Objektliteral ist JS-kompatibel → geklammert auswerten.
function extractMethodRegistry() {
    const src = read(path.join(SRC_CODE, 'editor', 'MethodRegistry.ts'));
    const grab = (marker) => {
        const idx = src.indexOf(marker);
        if (idx < 0) return null;
        const start = src.indexOf('{', idx);
        let depth = 0, end = start;
        for (; end < src.length; end++) {
            if (src[end] === '{') depth++;
            else if (src[end] === '}') { depth--; if (depth === 0) { end++; break; } }
        }
        return src.slice(start, end);
    };
    const regLit = grab('export const MethodRegistry');
    const retLit = grab('export const MethodReturnMap');
    const evalObj = (lit) => {
        if (!lit) return {};
        // Optionen wie '${getStageOptions()}' sind Strings — unverändert übernehmen.
        // eslint-disable-next-line no-new-func
        return new Function(`return (${lit});`)();
    };
    const registry = evalObj(regLit);
    const returns = evalObj(retLit);
    const methods = {};
    for (const [name, params] of Object.entries(registry)) {
        methods[name] = { params, hasReturn: !!returns[name] };
    }
    return methods;
}
const methodRegistry = extractMethodRegistry();

/* ─────────────────────────────────────────────────────────────
   3. Markdown-Hilfen
   ───────────────────────────────────────────────────────────── */

// Sektionen nach ##-Überschriften
function mdSections(md) {
    const lines = md.split(/\r?\n/);
    const sections = [];
    let title = null, cur = { heading: '_intro', lines: [] };
    for (const line of lines) {
        const h1 = line.match(/^#\s+(.+)/);
        const h2 = line.match(/^##\s+(.+)/);
        if (h1 && !title) { title = h1[1].trim(); continue; }
        if (h2) {
            sections.push(cur);
            cur = { heading: h2[1].trim(), lines: [] };
            continue;
        }
        cur.lines.push(line);
    }
    sections.push(cur);
    return { title, sections: sections.filter(s => s.lines.join('').trim() || s.heading !== '_intro') };
}

// Kopftabelle einer Komponentenkarte: "| Feld | Wert |"-Zeilen
function parseCardHeader(md) {
    const meta = {};
    const m = md.match(/\| Feld \| Wert \|[\s\S]*?(?=\n\n|\n#)/);
    if (!m) return meta;
    for (const line of m[0].split('\n')) {
        const row = line.match(/\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/);
        if (row && !/^-+$/.test(row[1].trim()) && row[1].trim() !== 'Feld') {
            meta[row[1].trim()] = row[2].trim();
        }
    }
    return meta;
}

// Eigenschaftstabelle "| Name | Label | Typ | Gruppe |"
function parsePropTable(sectionText) {
    const props = {};
    for (const line of sectionText.split('\n')) {
        const row = line.match(/\|\s*`([^`]+)`\s*\|\s*([^|]*)\|\s*([^|]*)\|\s*([^|]*)\|/);
        if (row) {
            props[row[1]] = {
                type: row[3].trim() || undefined,
                label: row[2].trim() || undefined,
                group: row[4].trim() || undefined,
                source: 'inspector-card'
            };
        }
    }
    return props;
}

// Abschnitt in Chunks (max ~4000 Zeichen, Umbruch an Absatzgrenzen, 200 Zeichen Überlappung)
function chunkText(text, maxChars = 4000, overlap = 200) {
    text = text.trim();
    if (!text) return [];
    if (text.length <= maxChars) return [text];
    const paras = text.split(/\n\s*\n/);
    const chunks = [];
    let cur = '';
    for (const p of paras) {
        if (cur && cur.length + p.length + 2 > maxChars) {
            chunks.push(cur.trim());
            cur = cur.slice(-overlap) + '\n\n' + p;
        } else {
            cur += (cur ? '\n\n' : '') + p;
        }
    }
    if (cur.trim()) chunks.push(cur.trim());
    return chunks;
}

const chunks = [];
function addChunks(entity, headingPath, sectionText, extraMeta = {}) {
    const slug = headingPath.toLowerCase()
        .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
        .replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') || 'intro';
    chunkText(sectionText).forEach((text, i) => {
        chunks.push({
            chunkId: `${entity.id}:${slug}${i > 0 ? ':' + (i + 1) : ''}`,
            entityId: entity.id,
            kind: entity.kind,
            section: slug,
            headingPath,
            text,
            charCount: text.length,
            metadata: {
                name: entity.name,
                category: entity.category || null,
                status: entity.status,
                confidence: entity.provenance.confidence,
                docs: entity.sources.docs || [],
                ...extraMeta
            }
        });
    });
}

/* ─────────────────────────────────────────────────────────────
   4. Entities
   ───────────────────────────────────────────────────────────── */
const entities = [];
const compCardDir = path.join(SRC_DOCS, 'reference', 'components');
const compCardFiles = new Set(
    exists(compCardDir) ? fs.readdirSync(compCardDir).filter(f => f.endsWith('.md')) : []
);

/* --- 4a. Komponenten (128, aus Inventar) --- */
const compNameToId = new Map();
for (const comp of inventory.components) {
    const mdFile = `${comp.name}.md`;
    const hasCard = compCardFiles.has(mdFile);
    const cardPath = `docs/reference/components/${mdFile}`;
    const srcInfo = componentSources.get(comp.name);
    const schemaInfo = schemaIndex.get(comp.name);

    let card = null, sections = [], cardProps = {}, inheritance = [], docEventsDoc = [];
    if (hasCard) {
        card = read(path.join(compCardDir, mdFile));
        const parsed = mdSections(card);
        sections = parsed.sections;
        const header = parseCardHeader(card);
        // Vererbungskette "TButton → TTextControl → TWindow → TComponent"
        if (header['Vererbungskette']) {
            inheritance = header['Vererbungskette']
                .split(/→|->|›/)
                .map(s => s.replace(/`/g, '').trim())
                .filter(Boolean);
        }
        const propSec = sections.find(s => /Inspector-Eigenschaften/.test(s.heading) && /Eigene/.test(s.heading));
        if (propSec) cardProps = parsePropTable(propSec.lines.join('\n'));
        const evSec = sections.find(s => /Ereignisse/.test(s.heading));
        if (evSec) {
            docEventsDoc = (evSec.lines.join('\n').match(/`on[A-Za-z]+`/g) || [])
                .map(s => s.slice(1, -1));
        }
    }
    // Fallback Vererbung aus Quellcode
    if (!inheritance.length && srcInfo?.extends) {
        inheritance = [comp.name, srcInfo.extends];
    }

    // Eigenschaften: Schema (verbindlich) + Karte (Inspector-Label/Gruppe)
    const properties = {};
    if (schemaInfo) {
        for (const [p, def] of Object.entries(schemaInfo.props)) {
            properties[p] = {
                type: def.type,
                default: def.default,
                options: def.options,
                description: def.description,
                source: 'schema'
            };
        }
    }
    for (const [p, def] of Object.entries(cardProps)) {
        properties[p] = { ...(properties[p] || {}), ...def, source: properties[p] ? properties[p].source : def.source };
    }

    // Events: Quellcode getEvents() (verified) + Kartentext (documented)
    const events = [];
    const seenEv = new Set();
    if (srcInfo?.events) {
        srcInfo.events.own.forEach(e => {
            if (!seenEv.has(e)) { seenEv.add(e); events.push({ name: e, origin: 'own', source: srcInfo.path }); }
        });
        if (srcInfo.events.inheritsSuper) {
            docEventsDoc.forEach(e => {
                if (!seenEv.has(e) && !srcInfo.events.own.includes(e)) {
                    seenEv.add(e); events.push({ name: e, origin: 'inherited', source: 'super.getEvents()' });
                }
            });
        }
    } else {
        docEventsDoc.forEach(e => {
            if (!seenEv.has(e)) { seenEv.add(e); events.push({ name: e, origin: 'documented', source: cardPath }); }
        });
    }

    // Methoden aus Kartenabschnitt "Methoden" (Backtick-Namen)
    const methSec = sections.find(s => /Methoden/.test(s.heading));
    const methods = methSec
        ? [...new Set((methSec.lines.join('\n').match(/`([a-zA-Z_]\w*)`/g) || []).map(s => s.slice(1, -1)))]
            .map(name => ({ name, origin: 'documented', source: cardPath }))
        : [];

    const description = (() => {
        const zweck = sections.find(s => /^Zweck/.test(s.heading));
        if (zweck) return zweck.lines.join('\n').split(/\n\s*\n/)[0].trim();
        return comp.summary || undefined;
    })();

    const relations = [];
    inheritance.slice(1).forEach(parent => {
        const p = compByName.get(parent);
        if (p) relations.push({ type: 'inherits', target: p.id });
    });
    if (schemaInfo) relations.push({ type: 'hasSchema', target: assignId('SCM', schemaInfo.file) });
    if (hasCard) {
        const docId = docIdFor(cardPath);
        if (docId) relations.push({ type: 'documentedIn', target: docId });
        // Querverweise [TXxx.md]
        for (const lm of card.matchAll(/\]\((T\w+)\.md\)/g)) {
            const t = compByName.get(lm[1]);
            if (t && t.id !== comp.id) relations.push({ type: 'seeAlso', target: t.id });
        }
    }
    (comp.relatedDocs || []).forEach(d => {
        const docId = docIdFor(d);
        if (docId) relations.push({ type: 'documentedIn', target: docId });
    });

    const docGaps = [];
    if (!hasCard) docGaps.push(`Keine Referenzkarte: docs/reference/components/${comp.name}.md fehlt — Eigenschaften/Events nur aus Inventar und Quellcode-Extrakt abgeleitet.`);
    if (!schemaInfo) docGaps.push('Kein Schema-Modul: Eigenschaften ohne Schema-Defaultwerte.');

    entities.push({
        id: comp.id,
        kind: 'component',
        name: comp.name,
        title: comp.name,
        category: comp.subcategory || comp.category,
        description,
        status: { dev: comp.devStatus, test: comp.testStatus, doc: comp.docStatus },
        properties: Object.keys(properties).length ? properties : undefined,
        events: events.length ? events : undefined,
        methods: methods.length ? methods : undefined,
        inheritanceChain: inheritance.length ? inheritance : undefined,
        registered: comp.registered,
        relations: relations.length ? relations : undefined,
        limitations: [...(comp.limitations || []), ...docGaps],
        openQuestions: comp.openQuestions?.length ? comp.openQuestions : undefined,
        sources: {
            code: [...(comp.sources || []), ...(srcInfo && !comp.sources?.includes(srcInfo.path) ? [srcInfo.path] : [])],
            docs: [hasCard ? cardPath : null, schemaInfo ? schemaInfo.file : null, ...(comp.relatedDocs || [])].filter(Boolean),
            tests: comp.tests || []
        },
        version: { lastChecked: comp.lastChecked, commit: comp.commit, extractedAt: NOW, contentHash: hash(JSON.stringify(comp) + (card || '') + JSON.stringify(properties)) },
        provenance: {
            method: ['inventory', hasCard ? 'markdown-parse' : null, schemaInfo ? 'schema' : null, srcInfo ? 'source-scan' : null].filter(Boolean),
            confidence: hasCard && comp.docStatus === 'technisch geprüft' ? 'verified'
                : hasCard || schemaInfo ? 'documented' : 'inferred'
        }
    });
    compNameToId.set(comp.name, comp.id);
}

/* --- 4b. Features (12, aus Inventar) --- */
for (const feat of inventory.features) {
    const relations = (feat.dependsOn || [])
        .map(d => inventory.features.find(f => f.id === d) ? { type: 'dependsOn', target: d } : null)
        .filter(Boolean);
    (feat.relatedDocs || []).forEach(d => {
        const docId = docIdFor(d);
        if (docId) relations.push({ type: 'documentedIn', target: docId });
    });
    entities.push({
        id: feat.id,
        kind: 'feature',
        name: feat.name,
        title: feat.name,
        category: feat.category,
        description: feat.summary,
        status: { dev: feat.devStatus, test: feat.testStatus, doc: feat.docStatus },
        relations: relations.length ? relations : undefined,
        limitations: feat.limitations?.length ? feat.limitations : undefined,
        openQuestions: feat.openQuestions?.length ? feat.openQuestions : undefined,
        testRuns: feat.testRuns?.length ? feat.testRuns : undefined,
        sources: { code: feat.sources || [], docs: feat.relatedDocs || [], tests: feat.tests || [] },
        version: { lastChecked: feat.lastChecked, commit: feat.commit, extractedAt: NOW, contentHash: hash(JSON.stringify(feat)) },
        provenance: { method: ['inventory'], confidence: 'documented' }
    });
}

/* --- 4c. Action-Typen (59, aus action-metadata.json) --- */
const actionsMd = read(path.join(SRC_DOCS, 'reference', 'actions.md'));
for (const t of actionMeta.types) {
    const isAlias = /^Alias für/.test(t.description || '');
    entities.push({
        id: assignId('ACT', `action-type:${t.type}`),
        kind: 'action-type',
        name: t.type,
        title: t.label || t.type,
        category: 'runtime-action',
        description: t.description,
        status: { dev: 'implementiert', test: 'nicht getestet', doc: 'entwurf' },
        parameters: (t.parameters || []).map(p => ({
            name: p.name, type: p.type, label: p.label, hint: p.hint,
            default: p.default, options: p.options, optional: p.optional
        })),
        flags: {
            hidden: t.hidden || undefined,
            requiresServer: t.requiresServer || undefined,
            requiresMultiplayer: t.requiresMultiplayer || undefined,
            isAlias: isAlias || undefined
        },
        sources: {
            code: ['src/runtime/ActionRegistry.ts', 'src/runtime/actions/handlers/'],
            docs: ['docs/inventory/action-metadata.json', 'docs/reference/actions.md']
        },
        version: { lastChecked: actionMeta.generated?.slice(0, 10), extractedAt: NOW, contentHash: hash(JSON.stringify(t)) },
        provenance: { method: ['registry-extract'], confidence: 'verified' }
    });
}

/* --- 4d. Methoden (MethodRegistry-Extrakt) --- */
for (const [name, def] of Object.entries(methodRegistry)) {
    entities.push({
        id: assignId('MTH', `method:${name}`),
        kind: 'method',
        name,
        title: name,
        category: 'component-method',
        description: `Registrierte Methode aus MethodRegistry (src/editor/MethodRegistry.ts).`,
        status: { dev: 'implementiert', test: 'nicht getestet', doc: 'entwurf' },
        parameters: (def.params || []).map(p => ({
            name: p.name, type: p.type, label: p.label,
            default: p.default, options: p.options, optional: p.optional
        })),
        hasReturn: def.hasReturn || undefined,
        sources: { code: ['src/editor/MethodRegistry.ts'] },
        version: { extractedAt: NOW, contentHash: hash(JSON.stringify(def)) },
        provenance: { method: ['registry-extract'], confidence: 'verified' }
    });
}

/* --- 4e. Events (getEvents-Aggregat + events.md) --- */
const eventMap = new Map(); // name → {declaredBy:Set, origin}
for (const [cls, info] of componentSources) {
    if (!info.events) continue;
    info.events.own.forEach(e => {
        if (!eventMap.has(e)) eventMap.set(e, { declaredBy: new Set(), runtime: false });
        eventMap.get(e).declaredBy.add(cls);
    });
}
// Runtime-/System-Events aus events.md (nicht komponentengebunden)
const eventsMd = read(path.join(SRC_DOCS, 'reference', 'events.md'));
for (const m of eventsMd.matchAll(/`(on[A-Z]\w+|player_\w+)`/g)) {
    if (!eventMap.has(m[1])) eventMap.set(m[1], { declaredBy: new Set(), runtime: true });
    else eventMap.get(m[1]).runtime = true;
}
for (const [name, info] of eventMap) {
    const declaredBy = [...info.declaredBy];
    entities.push({
        id: assignId('EVT', `event:${name}`),
        kind: 'event',
        name,
        title: name,
        category: 'event',
        description: declaredBy.length
            ? `Event, deklariert von: ${declaredBy.join(', ')}.`
            : `Event (aus Referenz-Dokumentation, nicht komponentengebunden).`,
        status: { dev: 'implementiert', test: 'nicht getestet', doc: declaredBy.length ? 'entwurf' : 'entwurf' },
        declaredBy: declaredBy.length ? declaredBy : undefined,
        runtimeOnly: info.runtime && !declaredBy.length ? true : undefined,
        relations: declaredBy
            .map(c => compNameToId.get(c))
            .filter(Boolean)
            .map(id => ({ type: 'declaresEvent', target: id })),
        sources: {
            code: declaredBy.length ? declaredBy.map(c => `src/components/${c}.ts`) : [],
            docs: ['docs/reference/events.md']
        },
        version: { extractedAt: NOW, contentHash: hash(name + declaredBy.join(',')) },
        provenance: {
            method: declaredBy.length ? ['source-scan', 'markdown-parse'] : ['markdown-parse'],
            confidence: declaredBy.length ? 'verified' : 'documented'
        }
    });
}

/* --- 4f. Schema-Module --- */
for (const sm of schemaModules) {
    const covered = Object.keys(sm.json.components || {})
        .map(c => compNameToId.get(c)).filter(Boolean);
    entities.push({
        id: assignId('SCM', sm.file),
        kind: 'schema',
        name: sm.json.$module || path.basename(sm.file, '.json'),
        title: sm.json.description || sm.file,
        category: 'schema',
        description: `${sm.json.description || ''} (${covered.length} Komponenten mit Eigenschaftsdefinitionen).`,
        status: { dev: 'implementiert', test: 'nicht getestet', doc: 'technisch geprüft' },
        relations: covered.map(id => ({ type: 'hasSchema', target: id })),
        sources: { docs: [sm.file] },
        version: { extractedAt: NOW, contentHash: hash(JSON.stringify(sm.json)) },
        provenance: { method: ['schema'], confidence: 'verified' }
    });
}

/* --- 4g. Handbuchkapitel --- */
const ugDir = path.join(SRC_DOCS, 'user-guide');
const guideFiles = fs.readdirSync(ugDir).filter(f => /^b?-?kapitel-\d+.*\.md$|^(b-)?kapitel-.*\.md$/.test(f) && f !== '_vorlage.md');
const guideEntities = [];
for (const f of guideFiles) {
    const md = read(path.join(ugDir, f));
    const parsed = mdSections(md);
    const isB = f.startsWith('b-');
    const num = f.match(/kapitel-(\d+)/)?.[1] || '00';
    entities.push({
        id: assignId('GUIDE', `guide-chapter:${f}`),
        kind: 'guide-chapter',
        name: `${isB ? 'B' : 'A'}${num.padStart(2, '0')}`,
        title: parsed.title || f,
        category: isB ? 'teil-b' : 'teil-a',
        description: `Autoren-Handbuch, ${isB ? 'Teil B (Der wachsende Baum)' : 'Teil A (Mein erster interaktiver Baum)'}: ${parsed.title || f}`,
        status: { dev: 'implementiert', test: 'nicht getestet', doc: 'fachlich freigegeben' },
        sources: { docs: [`docs/user-guide/${f}`] },
        version: { extractedAt: NOW, contentHash: hash(md) },
        provenance: { method: ['markdown-parse'], confidence: 'documented' }
    });
    guideEntities.push({ id: entities[entities.length - 1].id, file: `docs/user-guide/${f}`, md, parsed });
}

/* --- 4h. Konzepte (Referenz- + Architektur-Docs) --- */
const conceptDocs = [
    ...fs.readdirSync(path.join(SRC_DOCS, 'reference')).filter(f => f.endsWith('.md') && f !== 'README.md')
        .map(f => ({ file: `docs/reference/${f}`, topic: f.replace('.md', '') })),
    ...fs.readdirSync(path.join(SRC_DOCS, 'architecture')).filter(f => f.endsWith('.md') && f !== 'README.md')
        .map(f => ({ file: `docs/architecture/${f}`, topic: `architecture-${f.replace('.md', '')}` })),
];
const conceptEntities = [];
for (const cd of conceptDocs) {
    const md = read(path.join(SRC_DOCS, cd.file.replace('docs/', '').split('/').join(path.sep)));
    const parsed = mdSections(md);
    const docId = docIdFor(cd.file);
    entities.push({
        id: assignId('CON', `concept:${cd.file}`),
        kind: 'concept',
        name: cd.topic,
        title: parsed.title || cd.topic,
        category: 'konzept',
        description: `Referenz-/Konzeptdokument: ${parsed.title || cd.topic}`,
        status: { dev: 'implementiert', test: 'nicht getestet', doc: 'entwurf' },
        relations: docId ? [{ type: 'documentedIn', target: docId }] : undefined,
        sources: { docs: [cd.file] },
        version: { extractedAt: NOW, contentHash: hash(md) },
        provenance: { method: ['markdown-parse'], confidence: 'documented' }
    });
    conceptEntities.push({ id: entities[entities.length - 1].id, md, parsed });
}

/* --- 4i. Dokumente (242, aus Inventar) --- */
for (const doc of inventory.documents) {
    // Quelltreue: Inventar-Rating bleibt erhalten; physisch fehlende Dateien
    // werden als `missing` markiert (z. B. entfernte handbook-html-Artefakte).
    const missing = !exists(path.join(ROOT, doc.file));
    entities.push({
        id: doc.id,
        kind: 'document',
        name: path.basename(doc.file),
        title: doc.file,
        category: doc.type,
        description: doc.note,
        status: {
            dev: doc.rating === 'veraltet' || doc.rating === 'möglicherweise veraltet' || missing ? 'veraltet' : 'implementiert',
            test: 'nicht getestet',
            doc: doc.rating === 'aktuell' ? 'technisch geprüft' : 'entwurf'
        },
        missing: missing || undefined,
        docMeta: { rating: doc.rating, reviewDepth: doc.reviewDepth, basis: doc.basis, canonical: doc.canonical || undefined },
        sources: { docs: [doc.file] },
        version: { lastChecked: doc.lastChecked, commit: doc.commit, extractedAt: NOW, contentHash: hash(JSON.stringify(doc)) },
        provenance: { method: ['inventory'], confidence: 'documented' }
    });
}

/* ─────────────────────────────────────────────────────────────
   5. Chunks erzeugen
   ───────────────────────────────────────────────────────────── */
const entityById = new Map(entities.map(e => [e.id, e]));

// Komponentenkarten → Chunks je ##-Sektion
for (const comp of inventory.components) {
    const mdFile = `${comp.name}.md`;
    if (!compCardFiles.has(mdFile)) continue;
    const entity = entityById.get(comp.id);
    const { sections } = mdSections(read(path.join(compCardDir, mdFile)));
    for (const s of sections) {
        addChunks(entity, s.heading, s.lines.join('\n'), { sourceDoc: `docs/reference/components/${mdFile}` });
    }
}

// Handbuchkapitel → Chunks je ##-Sektion
for (const g of guideEntities) {
    const entity = entityById.get(g.id);
    for (const s of g.parsed.sections) {
        addChunks(entity, s.heading, s.lines.join('\n'), { sourceDoc: g.file });
    }
}

// Konzept-Docs → Chunks
for (const c of conceptEntities) {
    const entity = entityById.get(c.id);
    for (const s of c.parsed.sections) {
        addChunks(entity, s.heading, s.lines.join('\n'));
    }
}

// Feature-Dokumente → Chunks (docs/features/**/*.md, an FEAT via relatedDocs sonst CON)
const featuresDir = path.join(SRC_DOCS, 'features');
const featureFiles = [];
(function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (e.isDirectory()) walk(path.join(d, e.name));
        else if (e.name.endsWith('.md')) featureFiles.push(rel(path.join(d, e.name)));
    }
})(featuresDir);
for (const ff of featureFiles) {
    const md = read(path.join(ROOT, ff));
    const parsed = mdSections(md);
    // FEAT zuordnen, wenn relatedDocs den Pfad enthält
    const feat = inventory.features.find(f => (f.relatedDocs || []).includes(ff));
    let entity;
    if (feat) {
        entity = entityById.get(feat.id);
    } else {
        const docId = docIdFor(ff);
        entities.push({
            id: assignId('CON', `concept:${ff}`),
            kind: 'concept', name: path.basename(ff, '.md'), title: parsed.title || ff,
            category: 'feature-doc',
            description: `Feature-Dokument: ${parsed.title || ff}`,
            status: { dev: 'implementiert', test: 'nicht getestet', doc: 'entwurf' },
            relations: docId ? [{ type: 'documentedIn', target: docId }] : undefined,
            sources: { docs: [ff] },
            version: { extractedAt: NOW, contentHash: hash(md) },
            provenance: { method: ['markdown-parse'], confidence: 'documented' }
        });
        entity = entities[entities.length - 1];
        entityById.set(entity.id, entity);
    }
    for (const s of parsed.sections) {
        addChunks(entity, s.heading, s.lines.join('\n'), { sourceDoc: ff });
    }
}

// Feature-relatedDocs zusätzlich chunken (Pfade liegen i. d. R. außerhalb
// von docs/features/ — z. B. docs/runtime-guide.md, docs/GCS-CMS-STAGES.md)
for (const feat of inventory.features) {
    const entity = entityById.get(feat.id);
    if (!entity) continue;
    for (const docPath of feat.relatedDocs || []) {
        const abs = path.join(ROOT, docPath);
        if (!docPath.endsWith('.md') || !exists(abs)) continue;
        const { sections } = mdSections(read(abs));
        for (const s of sections) {
            addChunks(entity, s.heading, s.lines.join('\n'), { sourceDoc: docPath });
        }
    }
}

/* ─────────────────────────────────────────────────────────────
   6. Ausgabe
   ───────────────────────────────────────────────────────────── */
fs.mkdirSync(path.join(OUT, 'entities'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'chunks'), { recursive: true });

const byKind = (k) => entities.filter(e => e.kind === k);
const writeEntities = (file, list) =>
    fs.writeFileSync(path.join(OUT, 'entities', file), JSON.stringify(list, null, 1) + '\n');

writeEntities('components-swe2.json', byKind('component'));
writeEntities('features-swe2.json', byKind('feature'));
writeEntities('action-types-swe2.json', byKind('action-type'));
writeEntities('methods-swe2.json', byKind('method'));
writeEntities('events-swe2.json', byKind('event'));
writeEntities('schemas-swe2.json', byKind('schema'));
writeEntities('documents-swe2.json', byKind('document'));
writeEntities('guide-chapters-swe2.json', byKind('guide-chapter'));
writeEntities('concepts-swe2.json', byKind('concept'));

// Chunks als JSONL
const chunksPath = path.join(OUT, 'chunks', 'chunks-swe2.jsonl');
fs.writeFileSync(chunksPath, chunks.map(c => JSON.stringify(c)).join('\n') + '\n');

// Persistente ID-Map schreiben (sortiert)
const sortedKeys = Object.keys(idMap.keys).sort();
const sortedMap = {};
sortedKeys.forEach(k => sortedMap[k] = idMap.keys[k]);
fs.writeFileSync(ID_MAP_FILE, JSON.stringify({ counters: idMap.counters, keys: sortedMap }, null, 1) + '\n');

// Index
const index = {
    schemaVersion: '1.0.0',
    generated: NOW,
    generatedBy: 'build-knowledge-swe2.cjs',
    sourceCommit: inventory.meta?.analysisCommit,
    counts: {
        entities: entities.length,
        byKind: Object.fromEntries(['component', 'feature', 'action-type', 'method', 'event', 'schema', 'guide-chapter', 'document', 'concept'].map(k => [k, byKind(k).length])),
        chunks: chunks.length
    },
    idCounters: idMap.counters,
    files: {
        schema: 'knowledge-schema-swe2.json',
        entities: 'entities/',
        chunks: 'chunks/chunks-swe2.jsonl',
        idMap: 'id-map-swe2.json'
    },
    provenanceLegend: {
        verified: 'Quellcode-/Registry-belegt (getEvents, MethodRegistry, ActionRegistry, Schemas)',
        documented: 'Dokumentations-Selbstauskunft (Inventar, Referenzkarten, Markdown)',
        inferred: 'Abgeleitet, nicht vollständig verifiziert'
    }
};
fs.writeFileSync(path.join(OUT, 'knowledge-index-swe2.json'), JSON.stringify(index, null, 1) + '\n');

// Statistik
console.log('OK — Wissensbasis generiert');
console.log(`  Entities: ${entities.length}`);
for (const [k, n] of Object.entries(index.counts.byKind)) console.log(`    ${k}: ${n}`);
console.log(`  Chunks:   ${chunks.length}`);
console.log(`  ID-Map:   ${sortedKeys.length} Schlüssel (${Object.keys(idMap.counters).map(p => p + '=' + idMap.counters[p]).join(', ')})`);
const inferred = entities.filter(e => e.provenance.confidence === 'inferred');
console.log(`  confidence=inferred: ${inferred.length} (${inferred.map(e => e.name).slice(0, 10).join(', ')}${inferred.length > 10 ? '…' : ''})`);

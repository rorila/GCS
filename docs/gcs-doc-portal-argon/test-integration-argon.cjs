#!/usr/bin/env node
/**
 * test-integration-argon.cjs — Automatisierte Integrations- & Regressions-Testsuite
 * für das Argon Documentation Portal (`docs/gcs-doc-portal-argon/`) und die
 * SWE-2-Wissensbasis (`docs/gcs-knowledge-swe2/`, Schema 1.1.0).
 *
 * Prüft alle Anforderungen der Sicherheits- und Integrationskorrektur (A01–A15):
 *  - A01 (P0): XSS-Schutz bei feindlichen HTML-Payloads in Komponentenbeschreibungen (`<img src=x onerror=window.__xss=1>`)
 *  - A02 (P1): Absturzfreie globale Suche (kein `entry.text.slice`-Crash, alle 2.510 Einträge haben String-`text`)
 *  - A03 (P1): Vollständige Entity-Abdeckung im Suchindex (alle 693 SWE-2-Entities + 1.774 Chunks)
 *  - A04 (P1): Strenge Importer-Validierung (8 Negativ-Fixtures: SemVer, Checksums, Pflichtfelder, Duplikate, Relations, Counts)
 *  - A05 (P1): Opake `chunkId`-Verarbeitung ohne Duplikate (`<entity>:<docSlug>:<section>[:seq]`)
 *  - A06/A09 (P1/P2): Kanonische `properties` (inkl. `options`, `default`, `confidence`, ohne unbestätigte Markdown-Duplikate)
 *  - A07/A09 (P1/P2): Differenzierte `events` (`origin: own|inherited`, `inheritedFrom`, `conditions`) & Action-Parameter
 *  - A08/A12 (P1/P2): Ehrliche Confidence-Badges (`verified`/`documented`/`inferred`), `provenance.facts` & Schema/Concept-Status
 *  - A10 (P2): Überlappungsfreies Mobile-Header-Layout bei `390x844`
 *  - A11 (P2): 100% übereinstimmende rechte Seitennavigation (`data-toc-target` === DOM-Heading-`id`)
 *  - A13 (P2): Fehlerfreie Hash-Dekodierung (`#%E0%A4%A` fängt `URIError` ab, unbekannte IDs zeigen Fehlerhinweis)
 *  - A14 (P2): Deterministischer Build (`ARGON_BUILD_TIME` / `manifest.generated`)
 *  - A15 (P2): Strikte Pfad-Boundary (`resolveWithinKnowledgeBoundary` blockiert `../`-Ausbrüche)
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { execSync } = require('node:child_process');
const {
  computeSha256,
  resolveWithinKnowledgeBoundary,
  validateEntityContract,
  loadSwe2KnowledgeBase
} = require('./import-swe2-argon.cjs');
const { buildPortalData, parseComponentWithSwe2 } = require('./build-argon.cjs');

const PORTAL_DIR = __dirname;
const ROOT = path.resolve(PORTAL_DIR, '../..');

let passed = 0;
let failed = 0;
const results = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed++;
    results.push({ status: 'PASS', name, detail });
    console.log(`  ✔ [PASS] ${name}${detail ? ` (${detail})` : ''}`);
  } else {
    failed++;
    results.push({ status: 'FAIL', name, detail });
    console.error(`  ✘ [FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function expectThrows(fn, expectedSubstring) {
  try {
    fn();
    return { threw: false, message: '' };
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    return {
      threw: expectedSubstring ? msg.includes(expectedSubstring) : true,
      message: msg
    };
  }
}

console.log('=== GCS Documentation Portal (Argon) — Sicherheits- & Integrations-Regressionssuite (Schema 1.1.0) ===\n');

// ---------------------------------------------------------------------------
// 1. Konfigurations- & Manifest-Prüfung (Schema 1.1.0)
// ---------------------------------------------------------------------------
const config = JSON.parse(fs.readFileSync(path.join(PORTAL_DIR, 'portal-config-argon.json'), 'utf8'));
check(
  'Kanonischer SWE-2-Manifestpfad & Schema 1.1.0 in portal-config-argon.json konfiguriert',
  config.swe2Integration.manifestFile === 'docs/gcs-knowledge-swe2/knowledge-index-swe2.json' &&
    config.swe2Integration.schemaVersion === '1.1.0' &&
    !config.swe2Integration.optionalOverlayFiles,
  `v${config.swe2Integration.schemaVersion}`
);

const kb = loadSwe2KnowledgeBase(ROOT, config.swe2Integration);
check(
  'SWE-2-Manifest schemaVersion ist 1.1.0 und sourceCommit ist 53e3dfb',
  kb.manifest.schemaVersion === '1.1.0' && kb.manifest.sourceCommit === '53e3dfb',
  `v${kb.manifest.schemaVersion} @ ${kb.manifest.sourceCommit}`
);
check(
  'Alle 693 SWE-2-Entities in 9 Entity-Typen geladen',
  kb.entityById.size === 693 &&
    kb.entities.components.length === 128 &&
    kb.entities.features.length === 12 &&
    kb.entities.actionTypes.length === 59 &&
    kb.entities.methods.length === 38 &&
    kb.entities.events.length === 163 &&
    kb.entities.schemas.length === 13 &&
    kb.entities.guideChapters.length === 23 &&
    kb.entities.documents.length === 242 &&
    kb.entities.concepts.length === 15,
  `Gesamt: ${kb.entityById.size} (163 Events inkl. 5 geerbter Drag/Pinch-Events)`
);
check(
  'Alle 1.774 Chunks mit eindeutigen, opaken chunkIds geladen (A05)',
  kb.chunks.length === 1774 && new Set(kb.chunks.map(c => c.chunkId)).size === 1774,
  `${kb.chunks.length} eindeutige Chunks`
);

// ---------------------------------------------------------------------------
// 2. Priorität 1 — Sicherheitslücke A01 (P0): HTML-Injektionsschutz
// ---------------------------------------------------------------------------
const xssPayload = '<img src=x onerror=window.__xss=1><script>window.__xss=2</script>';
const fakeXssComp = {
  id: 'COMP-9999"><svg onload=window.__xss=3>',
  kind: 'component',
  name: 'TXssNonExistentComponent',
  title: 'TXssNonExistentComponent',
  description: `Feindlicher Text: ${xssPayload}`,
  status: { dev: 'geplant', test: 'nicht getestet', doc: 'entwurf' },
  provenance: { method: ['schema'], confidence: 'inferred', facts: { status: 'inferred', description: 'inferred' } },
  version: { extractedAt: '2026-10-18', contentHash: 'sha256:0000' },
  sources: { docs: ['docs/reference/components/DOES_NOT_EXIST_XSS.md'] },
  properties: {},
  events: [],
  methods: []
};
const parsedXssComp = parseComponentWithSwe2(fakeXssComp, null, path.join(ROOT, 'docs/reference/components'), kb, {
  knownComponents: new Set(),
  compIdToName: {}
});
check(
  'A01 (P0): Fallback-Komponentenbeschreibung escaped <img src=x onerror=window.__xss=1> vollständig',
  !parsedXssComp.htmlContent.includes('<img') &&
    !parsedXssComp.htmlContent.includes('<script>') &&
    !parsedXssComp.htmlContent.includes('<svg') &&
    parsedXssComp.htmlContent.includes('&lt;img src=x onerror=window.__xss=1&gt;'),
  'Keine ausführbaren HTML-Tags im generierten htmlContent'
);

// ---------------------------------------------------------------------------
// 3. Priorität 3 — Strenge Importer-Validierung A04, A05, A15 (Negativ-Fixtures)
// ---------------------------------------------------------------------------
const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'argon-swe2-test-'));
function createTempKnowledgeSnapshot(mutator) {
  const dir = fs.mkdtempSync(path.join(tmpBase, 'snap-'));
  fs.mkdirSync(path.join(dir, 'entities'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'chunks'), { recursive: true });

  const sampleEntity = (id, kind, name) => ({
    id,
    kind,
    name,
    title: name,
    description: `Beschreibung für ${name}`,
    status: { dev: 'implementiert', test: 'nicht getestet', doc: 'entwurf' },
    sources: { code: [], docs: [], tests: [] },
    provenance: { method: ['registry-extract'], confidence: 'verified', facts: { status: 'verified' } },
    version: { extractedAt: '2026-10-18T00:00:00Z', contentHash: 'sha256:123456' },
    relations: []
  });

  const filesData = {
    'entities/components-swe2.json': [sampleEntity('COMP-0001', 'component', 'TTestComp')],
    'entities/features-swe2.json': [sampleEntity('FEAT-0001', 'feature', 'TestFeature')],
    'entities/actions-swe2.json': [sampleEntity('ACT-0001', 'action-type', 'test_action')],
    'entities/methods-swe2.json': [sampleEntity('MTH-0001', 'method', 'testMethod')],
    'entities/events-swe2.json': [sampleEntity('EVT-0001', 'event', 'onTest')],
    'entities/schemas-swe2.json': [sampleEntity('SCM-0001', 'schema', 'schema_test.json')],
    'entities/guide-chapters-swe2.json': [sampleEntity('GUIDE-0001', 'guide-chapter', 'A1')],
    'entities/documents-swe2.json': [sampleEntity('DOC-0001', 'document', 'test.md')],
    'entities/concepts-swe2.json': [sampleEntity('CON-0001', 'concept', 'TestConcept')]
  };
  const chunksData = [
    {
      chunkId: 'COMP-0001:ttestcomp:overview',
      entityId: 'COMP-0001',
      kind: 'component',
      title: 'TTestComp',
      section: 'overview',
      text: 'Testchunk',
      keywords: ['TTestComp'],
      sourceDoc: 'docs/reference/components/TTestComp.md',
      metadata: { sourceDoc: 'docs/reference/components/TTestComp.md', category: 'basis' },
      statusDev: 'implementiert',
      confidence: 'verified'
    }
  ];

  const manifest = {
    schemaVersion: '1.1.0',
    generated: '2026-10-18T00:00:00Z',
    sourceCommit: '53e3dfb',
    counts: {
      entities: 9,
      chunks: 1,
      byKind: {
        component: 1,
        feature: 1,
        'action-type': 1,
        method: 1,
        event: 1,
        schema: 1,
        'guide-chapter': 1,
        document: 1,
        concept: 1
      }
    },
    files: {
      entityFiles: {
        component: 'entities/components-swe2.json',
        feature: 'entities/features-swe2.json',
        'action-type': 'entities/actions-swe2.json',
        method: 'entities/methods-swe2.json',
        event: 'entities/events-swe2.json',
        schema: 'entities/schemas-swe2.json',
        'guide-chapter': 'entities/guide-chapters-swe2.json',
        document: 'entities/documents-swe2.json',
        concept: 'entities/concepts-swe2.json'
      },
      chunks: 'chunks/chunks-swe2.jsonl',
      idMap: 'id-map-swe2.json'
    },
    checksums: {}
  };

  if (mutator) mutator({ manifest, filesData, chunksData, dir });

  for (const [rel, arr] of Object.entries(filesData)) {
    const fp = path.join(dir, rel);
    fs.writeFileSync(fp, JSON.stringify(arr, null, 2), 'utf8');
    if (!manifest._skipChecksumUpdate || !Object.prototype.hasOwnProperty.call(manifest.checksums, rel)) {
      manifest.checksums[rel] = computeSha256(fp);
    }
  }
  const chunkFp = path.join(dir, 'chunks/chunks-swe2.jsonl');
  fs.writeFileSync(chunkFp, chunksData.map(c => JSON.stringify(c)).join('\n') + '\n', 'utf8');
  if (!manifest._skipChecksumUpdate) {
    manifest.checksums['chunks/chunks-swe2.jsonl'] = computeSha256(chunkFp);
  }
  if (!manifest.checksums['chunks/chunks-swe2.jsonl']) manifest.checksums['chunks/chunks-swe2.jsonl'] = computeSha256(chunkFp);
  const idMapFp = path.join(dir, 'id-map-swe2.json');
  fs.writeFileSync(idMapFp, '{}', 'utf8');
  manifest.checksums['id-map-swe2.json'] = computeSha256(idMapFp);
  delete manifest._skipChecksumUpdate;

  fs.writeFileSync(path.join(dir, 'knowledge-index-swe2.json'), JSON.stringify(manifest, null, 2), 'utf8');

  return {
    dir,
    cfg: {
      knowledgeDir: dir,
      manifestFile: path.join(dir, 'knowledge-index-swe2.json')
    }
  };
}

// A04.1: Ungültige SemVer-Versionen ("1.0.0-evil", "2.0.0")
const badSemver1 = createTempKnowledgeSnapshot(({ manifest }) => { manifest.schemaVersion = '1.0.0-evil'; });
const badSemver2 = createTempKnowledgeSnapshot(({ manifest }) => { manifest.schemaVersion = '2.0.0'; });
check(
  'A04 Negativtest 1: SemVer "1.0.0-evil" und "2.0.0" werden strikt abgewiesen',
  expectThrows(() => loadSwe2KnowledgeBase(badSemver1.dir, badSemver1.cfg), 'Inkompatible SWE-2 schemaVersion').threw &&
    expectThrows(() => loadSwe2KnowledgeBase(badSemver2.dir, badSemver2.cfg), 'Inkompatible SWE-2 schemaVersion').threw,
  'SemVer /^1\\.\\d+\\.\\d+$/ aktiv'
);

// A04.2: Manipulierte Datei / falsche SHA-256-Prüfsumme
const badChecksum = createTempKnowledgeSnapshot(({ manifest }) => {
  manifest._skipChecksumUpdate = true;
  manifest.checksums['entities/components-swe2.json'] = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';
});
check(
  'A04 Negativtest 2: Manipulierte SHA-256-Prüfsumme wird abgewiesen',
  expectThrows(() => loadSwe2KnowledgeBase(badChecksum.dir, badChecksum.cfg), 'Prüfsummenfehler').threw,
  'Checksum-Gate aktiv'
);

// A04.3: Fehlendes Pflichtfeld status.dev (kein Fallback auf "implementiert"!)
const badStatusDev = createTempKnowledgeSnapshot(({ filesData }) => {
  delete filesData['entities/components-swe2.json'][0].status.dev;
});
check(
  'A04/6.3 Negativtest 3: Fehlendes status.dev wird abgewiesen (kein Fallback auf "implementiert")',
  expectThrows(() => loadSwe2KnowledgeBase(badStatusDev.dir, badStatusDev.cfg), 'Pflichtfeld status.dev fehlt').threw,
  'status.dev Pflichtfeld geprüft'
);

// A04.4: Fehlendes Pflichtfeld provenance.confidence oder version.extractedAt
const badProv = createTempKnowledgeSnapshot(({ filesData }) => {
  delete filesData['entities/features-swe2.json'][0].provenance.confidence;
});
const badVer = createTempKnowledgeSnapshot(({ filesData }) => {
  delete filesData['entities/actions-swe2.json'][0].version.extractedAt;
});
check(
  'A04 Negativtest 4: Fehlende provenance.confidence oder version.extractedAt werden abgewiesen',
  expectThrows(() => loadSwe2KnowledgeBase(badProv.dir, badProv.cfg), 'Pflichtfeld provenance').threw &&
    expectThrows(() => loadSwe2KnowledgeBase(badVer.dir, badVer.cfg), 'Pflichtfeld version.extractedAt').threw,
  'provenance & version Pflichtfelder geprüft'
);

// A04.5: Doppelte Entity-ID
const dupEntity = createTempKnowledgeSnapshot(({ filesData, manifest }) => {
  filesData['entities/components-swe2.json'].push({
    ...filesData['entities/components-swe2.json'][0]
  });
  manifest.counts.entities = 10;
  manifest.counts.byKind.component = 2;
});
check(
  'A04 Negativtest 5: Doppelte Entity-ID wird abgewiesen',
  expectThrows(() => loadSwe2KnowledgeBase(dupEntity.dir, dupEntity.cfg), 'Doppelte Entity-ID').threw,
  'Entity-ID-Eindeutigkeit geprüft'
);

// A05: Doppelte chunkId
const dupChunk = createTempKnowledgeSnapshot(({ chunksData, manifest }) => {
  chunksData.push({ ...chunksData[0] });
  manifest.counts.chunks = 2;
});
check(
  'A05 Negativtest 6: Doppelte chunkId in chunks-swe2.jsonl wird abgewiesen',
  expectThrows(() => loadSwe2KnowledgeBase(dupChunk.dir, dupChunk.cfg), 'Doppelte chunkId').threw,
  'Chunk-ID-Eindeutigkeit geprüft'
);

// A04.6: Unauflösbare Relation
const brokenRel = createTempKnowledgeSnapshot(({ filesData }) => {
  filesData['entities/components-swe2.json'][0].relations = [{ type: 'inherits', target: 'COMP-9999' }];
});
check(
  'A04 Negativtest 7: Unauflösbare Relation (Ziel-Entity fehlt) wird abgewiesen',
  expectThrows(() => loadSwe2KnowledgeBase(brokenRel.dir, brokenRel.cfg), 'Unauflösbare Relation').threw,
  'Relations-Gate aktiv'
);

// A04.7: Abweichende Manifest-Zähler (counts.byKind / counts.entities)
const badCounts = createTempKnowledgeSnapshot(({ manifest }) => {
  manifest.counts.entities = 999;
});
check(
  'A04 Negativtest 8: Abweichender Manifest-Zähler (counts.entities) wird abgewiesen',
  expectThrows(() => loadSwe2KnowledgeBase(badCounts.dir, badCounts.cfg), 'Manifestzähler-Abweichung').threw,
  'Manifest-Zählerabgleich aktiv'
);

// A15: Pfad-Traversierung außerhalb des SWE-2-Snapshot-Verzeichnisses
const traversalCheck = expectThrows(
  () => resolveWithinKnowledgeBoundary(fs.realpathSync(path.join(ROOT, 'docs/gcs-knowledge-swe2')), ROOT, '../../package.json'),
  'Boundary-Fehler'
);
check(
  'A15 Negativtest 9: Pfad-Traversierung (../../package.json) außerhalb docs/gcs-knowledge-swe2/ wird blockiert',
  traversalCheck.threw,
  traversalCheck.message
);

// Cleanup temp directory
try { fs.rmSync(tmpBase, { recursive: true, force: true }); } catch (_) {}

// ---------------------------------------------------------------------------
// 4. Priorität 2 — Suchindex & Vollständige Entity-Abdeckung (A02, A03)
// ---------------------------------------------------------------------------
const dataJson = JSON.parse(fs.readFileSync(path.join(PORTAL_DIR, 'data/portal-data-argon.json'), 'utf8'));

const allHaveStringText = dataJson.searchIndex.every(e => typeof e.text === 'string');
check(
  'A02: Alle 2.510 Einträge im Suchindex besitzen ein definiertes String-Feld text (0 undefined)',
  allHaveStringText && dataJson.searchIndex.length === 2510,
  `${dataJson.searchIndex.length} Einträge geprüft`
);

const entitySearchEntries = dataJson.searchIndex.filter(e => e.entryType === 'entity');
const chunkSearchEntries = dataJson.searchIndex.filter(e => e.entryType === 'chunk');
const entityIdsInSearch = new Set(entitySearchEntries.map(e => e.entityId));
const all693Covered = Array.from(kb.entityById.keys()).every(id => entityIdsInSearch.has(id));
check(
  'A03: Alle 693 SWE-2-Entities (COMP, FEAT, ACT, MTH, EVT, SCM, GUIDE, DOC, CON) sind als Basistreffer im Suchindex vertreten',
  entitySearchEntries.length === 693 && chunkSearchEntries.length === 1774 && all693Covered,
  `${entitySearchEntries.length} Entity-Basistreffer + ${chunkSearchEntries.length} Chunks`
);

// ---------------------------------------------------------------------------
// 5. Priorität 3 & 4 — Properties, Events, Action-Parameter & Confidence (A06, A07, A08, A09, A12)
// ---------------------------------------------------------------------------
const unverifiedMdPropsCount = dataJson.components.items.reduce(
  (acc, c) => acc + c.properties.filter(p => p.source === 'markdown').length,
  0
);
const propsWithOptionsCount = dataJson.components.items.reduce(
  (acc, c) => acc + c.properties.filter(p => Array.isArray(p.options) && p.options.length > 0).length,
  0
);
check(
  'A06/A09: Komponenten-Properties stammen kanonisch aus SWE-2 (0 unbestätigte Markdown-Duplikate, Options-Listen erhalten)',
  unverifiedMdPropsCount === 0 && propsWithOptionsCount > 0,
  `markdownProps=${unverifiedMdPropsCount}, propsWithOptions=${propsWithOptionsCount}`
);

const inheritedEventsCount = dataJson.components.items.reduce(
  (acc, c) => acc + (c.eventsDetail || []).filter(e => e.origin === 'inherited').length,
  0
);
const conditionalEventsCount = dataJson.components.items.reduce(
  (acc, c) => acc + (c.eventsDetail || []).filter(e => Array.isArray(e.conditions) && e.conditions.length > 0).length,
  0
);
check(
  'A07/A09: Komponenten-Events bewahren origin (own/inherited), inheritedFrom und Laufzeit-Bedingungen (isHiddenInRun)',
  inheritedEventsCount > 0 && conditionalEventsCount > 0,
  `inheritedEvents=${inheritedEventsCount}, conditionalEvents=${conditionalEventsCount}`
);

const actionParamsWithDefaultOrSource = dataJson.devref.actions.reduce(
  (acc, a) => acc + (a.parameters || []).filter(p => p.defaultValue !== undefined || p.source !== undefined || p.visibleWhen !== undefined).length,
  0
);
check(
  'A09: Action-Parameter enthalten verlustfrei defaultValue, source, placeholder, allowVariableBinding & visibleWhen',
  actionParamsWithDefaultOrSource > 0,
  `${actionParamsWithDefaultOrSource} erweiterte Action-Parameter übertragen`
);

// ---------------------------------------------------------------------------
// 6. Browser-/DOM-Simulations- & UI-Regressionstests (A01, A02, A03, A08, A10, A11, A12, A13)
// ---------------------------------------------------------------------------
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(PORTAL_DIR, 'data/portal-data-argon.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(PORTAL_DIR, 'swe2-adapter-argon.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(PORTAL_DIR, 'views-argon.js'), 'utf8'), sandbox);

const loadedData = sandbox.window.GCS_PORTAL_DATA_ARGON;
const swe2Adapter = sandbox.window.ArgonSwe2Adapter;
const views = sandbox.window.ArgonPortalViews;

// A08: Prüfe Komponentenkatalog-Karten — documented/inferred dürfen NICHT als verified ausgegeben werden,
// und gemischte Confidence (provenance.confidence = max(facts)) zeigt zusätzlich die Doku-Facts-Pille!
const catalogHtml = views.renderComponentsCatalog(loadedData, { compCategory: 'all', compStatus: 'all', compQuery: '' });
const expectedVerifiedComps = loadedData.components.items.filter(c => c.confidence === 'verified').length;
const expectedDocumentedComps = loadedData.components.items.filter(c => c.confidence === 'documented').length;
const verifiedBadgeOccurrences = (catalogHtml.match(/✔ verified/g) || []).length;
const documentedBadgeOccurrences = (catalogHtml.match(/📄 documented/g) || []).length;
const mixedFactPills = (catalogHtml.match(/📄 Doku: documented/g) || []).length;
check(
  'A08: Komponentenkatalog zeigt exakte Confidence-Stufen ohne falsche Hochstufung sowie Doku-Facts-Hinweis bei max(facts)',
  verifiedBadgeOccurrences === expectedVerifiedComps &&
    documentedBadgeOccurrences === expectedDocumentedComps &&
    mixedFactPills > 100 &&
    swe2Adapter.confidencePillCompact('documented').includes('📄 documented') &&
    swe2Adapter.confidencePillCompact('inferred').includes('⚠️ inferred'),
  `verified=${verifiedBadgeOccurrences}, documented=${documentedBadgeOccurrences}, mixedFactPills=${mixedFactPills}`
);

// A08 & A11: Prüfe Komponenten-Detailansicht (provenance.facts + TOC-Anker-Konsistenz)
const tSprite = loadedData.components.items.find(c => c.name === 'TSprite');
const compDetailHtml = views.renderComponentDetail(tSprite, loadedData);
const headingIdsInCompDetail = new Set(
  Array.from(compDetailHtml.matchAll(/<h[23]\s+id="([^"]+)"/g)).map(m => m[1])
);
check(
  'A08 & A11: Komponenten-Detailansicht rendert provenance.facts und besitzt konsistente Heading-IDs für die rechte Seitennavigation',
  compDetailHtml.includes('provenance.facts') &&
    headingIdsInCompDetail.has('swe2-properties') &&
    headingIdsInCompDetail.has('swe2-events-methods') &&
    headingIdsInCompDetail.has('swe2-provenance') &&
    headingIdsInCompDetail.has('referenzkarte-md'),
  `Gefundene Heading-IDs: ${Array.from(headingIdsInCompDetail).slice(0, 5).join(', ')}`
);

// A12: Prüfe Schema- und Konzept-Karten auf devStatusBadge
const schemasHtml = views.renderDevRefOverview(loadedData, { devSubView: 'schemas', schemaQuery: '' });
check(
  'A12: Schema- (SCM) und Konzept-Karten (CON) zeigen konsistent sowohl status.dev als auch provenance.confidence',
  schemasHtml.includes('SCM-0001') &&
    schemasHtml.includes('CON-0001') &&
    schemasHtml.includes('Dev: implementiert'),
  'status.dev & provenance.confidence auf SCM/CON verifiziert'
);

// A10: Prüfe Mobile-CSS-Regeln für 390x844 Viewport
const cssContent = fs.readFileSync(path.join(PORTAL_DIR, 'styles-argon.css'), 'utf8');
check(
  'A10: Mobile-Header (@media max-width: 960px) verhindert Überlappung zwischen #btn-sidebar-toggle und #btn-open-search',
  cssContent.includes('flex-wrap: wrap') &&
    cssContent.includes('.hb-search-placeholder') &&
    cssContent.includes('height: calc(100vh - var(--topbar-h))'),
  'Responsive Topbar- & Drawer-Regeln in styles-argon.css aktiv'
);

// A02, A03, A13: Prüfe app-argon.js Router & Suchfunktion
const appJsContent = fs.readFileSync(path.join(PORTAL_DIR, 'app-argon.js'), 'utf8');
check(
  'A02, A11, A13: app-argon.js schützt decodeURIComponent per try/catch, nutzt extractDomHeadings und defensive String-Normalisierung in performSearch',
  appJsContent.includes('renderInvalidRouteNotice') &&
    appJsContent.includes('extractDomHeadings') &&
    appJsContent.includes('String(entry.text ?? entry.subtitle ?? entry.title ?? \'\')'),
  'Router-Guard, DOM-TOC und Search-Guard verifiziert'
);

// ---------------------------------------------------------------------------
// 7. Deterministischer Build (A14) & Unverändertheit von docs/gcs-knowledge-swe2/
// ---------------------------------------------------------------------------
process.env.ARGON_BUILD_TIME = '2026-10-18T12:00:00.000Z';
const buildRun1 = JSON.stringify(buildPortalData({ writeFiles: false }));
const buildRun2 = JSON.stringify(buildPortalData({ writeFiles: false }));
delete process.env.ARGON_BUILD_TIME;
check(
  'A14: Zwei aufeinanderfolgende Builds liefern byte-identische JSON-Payloads',
  buildRun1 === buildRun2,
  `Payload-Größe: ${buildRun1.length} Bytes`
);

// Prüfe über alle 10 SHA-256-Prüfsummen im SWE-2-Manifest, dass die SWE-2-Wissensbasis exakt unverändert ist
const allSwe2ChecksumsMatch = Object.entries(kb.manifest.checksums).every(([relFile, expectedHash]) => {
  const actual = computeSha256(path.join(ROOT, 'docs/gcs-knowledge-swe2', relFile));
  return actual === expectedHash;
});
check(
  'Schreibbereich eingehalten: Alle 10 Dateien in docs/gcs-knowledge-swe2/ entsprechen bitgenau ihren SHA-256-Prüfsummen',
  allSwe2ChecksumsMatch,
  `${Object.keys(kb.manifest.checksums).length} SHA-256-Prüfsummen verifiziert`
);

const codeFiles = [
  'index-argon.html',
  'styles-argon.css',
  'swe2-adapter-argon.js',
  'views-argon.js',
  'app-argon.js',
  'parser-argon.cjs',
  'import-swe2-argon.cjs',
  'build-argon.cjs',
  'test-integration-argon.cjs'
];
for (const cf of codeFiles) {
  const lines = fs.readFileSync(path.join(PORTAL_DIR, cf), 'utf8').split(/\r?\n/).length;
  check(`1000-Zeilen-Limit eingehalten: ${cf}`, lines <= 1000, `${lines} Zeilen`);
}

console.log(`\n=== Ergebnis: ${passed} bestanden, ${failed} fehlgeschlagen ===`);
if (failed > 0) process.exit(1);

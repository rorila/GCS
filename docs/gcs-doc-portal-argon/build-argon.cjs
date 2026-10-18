/**
 * build-argon.cjs — Zentraler Build-Prozess für das GCS Documentation Portal (Argon)
 * mit vollständiger Integration der SWE-2-Wissensbasis (docs/gcs-knowledge-swe2/ Schema 1.1.0).
 *
 * Liest alle Dokumentations- und SWE-2-Quellen strikt read-only aus und erzeugt:
 * - docs/gcs-doc-portal-argon/data/portal-data-argon.json
 * - docs/gcs-doc-portal-argon/data/portal-data-argon.js (window.GCS_PORTAL_DATA_ARGON)
 */
const fs = require('node:fs');
const path = require('node:path');
const {
  CHAPTER_SPECS,
  escapeHtml,
  parseMarkdownBlocks,
  renderBlocksToHtml,
  parseHandbookChapter
} = require('./parser-argon.cjs');
const {
  normalizeRelPath,
  normalizeDevStatus,
  loadSwe2KnowledgeBase,
  createRouteResolver,
  buildSearchIndexFromSwe2Chunks
} = require('./import-swe2-argon.cjs');

const PORTAL_DIR = __dirname;
const ROOT = path.resolve(PORTAL_DIR, '..', '..');
const DATA_DIR = path.join(PORTAL_DIR, 'data');
const config = JSON.parse(fs.readFileSync(path.join(PORTAL_DIR, 'portal-config-argon.json'), 'utf8'));

const CATEGORY_META = {
  basis: { id: 'basis', label: 'Basis & Vererbung', icon: '🧱', order: 1 },
  anzeige: { id: 'anzeige', label: 'Anzeige & Text', icon: '🖼️', order: 2 },
  medien: { id: 'medien', label: 'Medien & Sprache', icon: '🎬', order: 3 },
  eingabe: { id: 'eingabe', label: 'Eingabe & Steuerung', icon: '⌨️', order: 4 },
  container: { id: 'container', label: 'Container & Layout', icon: '📐', order: 5 },
  daten: { id: 'daten', label: 'Daten & Listen', icon: '🗄️', order: 6 },
  variablen: { id: 'variablen', label: 'Variablen & Zustand', icon: '🔢', order: 7 },
  zeit: { id: 'zeit', label: 'Zeit & Logik', icon: '⏱️', order: 8 },
  spiel: { id: 'spiel', label: 'Spiel & Physik', icon: '🎮', order: 9 },
  server: { id: 'server', label: 'Server & Netzwerk', icon: '🌐', order: 10 },
  system: { id: 'system', label: 'System & Dienste', icon: '⚙️', order: 11 },
  dialoge: { id: 'dialoge', label: 'Dialoge & Overlays', icon: '💬', order: 12 },
  sonstige: { id: 'sonstige', label: 'Weitere Komponenten', icon: '🧩', order: 13 }
};

function normalizeCategoryKey(rawCat) {
  const s = String(rawCat || 'sonstige').toLowerCase().trim();
  if (s.includes('basis')) return 'basis';
  if (s.includes('anzeige') || s.includes('display')) return 'anzeige';
  if (s.includes('medien') || s.includes('media') || s.includes('sprache')) return 'medien';
  if (s.includes('eingabe') || s.includes('input')) return 'eingabe';
  if (s.includes('container') || s.includes('layout')) return 'container';
  if (s.includes('daten') || s.includes('listen') || s.includes('data')) return 'daten';
  if (s.includes('variabl')) return 'variablen';
  if (s.includes('zeit') || s.includes('timer') || s.includes('logik')) return 'zeit';
  if (s.includes('spiel') || s.includes('game') || s.includes('physik')) return 'spiel';
  if (s.includes('server') || s.includes('netz') || s.includes('multiplayer')) return 'server';
  if (s.includes('dialog') || s.includes('overlay')) return 'dialoge';
  if (s.includes('system') || s.includes('service')) return 'system';
  return CATEGORY_META[s] ? s : 'sonstige';
}

function toPlainSearchText(raw) {
  return String(raw || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*`|_\[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseComponentWithSwe2(swe2Comp, invComp, compDir, kb, context) {
  const mdRel = swe2Comp.sources?.docs?.find(d => d.endsWith('.md')) || `docs/reference/components/${swe2Comp.name}.md`;
  const mdFile = path.join(ROOT, mdRel);
  const hasMdFile = fs.existsSync(mdFile);
  let raw = '';
  let parsed = { title: swe2Comp.name, statusNote: '', headings: [], checklists: [], screenshots: [], blocks: [] };
  const metaTable = {};
  let isCurated = false;

  if (hasMdFile) {
    raw = fs.readFileSync(mdFile, 'utf8').replace(/\r\n/g, '\n');
    isCurated = raw.includes('Kuratierte Referenzkarte');
    parsed = parseMarkdownBlocks(raw, { id: swe2Comp.id, defaultTitle: swe2Comp.name });

    for (const b of parsed.blocks) {
      if (b.type === 'table' && b.headers.length === 2 && b.headers[0].toLowerCase() === 'feld') {
        for (const row of b.rows) {
          metaTable[row[0].replace(/`/g, '').trim()] = row[1].replace(/`/g, '').trim();
        }
      }
    }
  }

  // Kanonische SWE-2 properties aus Schema 1.1.0 (inkl. options, default, confidence, source).
  // Keine Vermischung mit unbestätigten Markdown-Tabellenzeilen (A06, A09).
  const properties = [];
  if (swe2Comp.properties && typeof swe2Comp.properties === 'object') {
    for (const [propName, pDef] of Object.entries(swe2Comp.properties)) {
      properties.push({
        name: propName,
        label: pDef.label || propName,
        type: pDef.type || 'unknown',
        defaultValue: pDef.default !== undefined ? pDef.default : '—',
        options: Array.isArray(pDef.options) ? pDef.options : null,
        description: pDef.description || '',
        group: pDef.group || 'SCHEMA',
        source: pDef.source || 'schema',
        confidence: pDef.confidence || swe2Comp.provenance?.facts?.properties || 'documented'
      });
    }
  }

  // Events mit stabiler SWE-2-ID (EVT-####), origin (own/inherited), declaredIn, inheritedFrom & conditions (A07, A09)
  const eventsDetail = (swe2Comp.events || []).map(ev => {
    const evtEntity = kb.eventByName.get(ev.name);
    return {
      id: evtEntity ? evtEntity.id : null,
      name: ev.name,
      origin: ev.origin || 'own',
      declaredIn: ev.declaredIn || swe2Comp.name,
      inheritedFrom: ev.inheritedFrom || null,
      conditions: Array.isArray(ev.conditions) ? ev.conditions : [],
      source: ev.source || '',
      declaredByCount: evtEntity?.declaredBy?.length || 1,
      confidence: ev.confidence || evtEntity?.provenance?.confidence || swe2Comp.provenance?.facts?.events || 'documented'
    };
  });
  const events = eventsDetail.map(e => e.name);

  // Methoden mit stabiler SWE-2-ID (MTH-####) und Parametern aus MethodRegistry verknüpfen
  const methodsDetail = (swe2Comp.methods || []).map(m => {
    const mthEntity = kb.methodByName.get(m.name);
    return {
      id: mthEntity ? mthEntity.id : null,
      name: m.name,
      origin: m.origin || 'documented',
      source: m.source || '',
      parameters: mthEntity?.parameters || [],
      confidence: m.confidence || mthEntity?.provenance?.confidence || 'documented'
    };
  });
  const methods = methodsDetail.map(m => m.name);

  const inheritanceChain = Array.isArray(swe2Comp.inheritanceChain) && swe2Comp.inheritanceChain.length > 0
    ? swe2Comp.inheritanceChain
    : [swe2Comp.name];
  const baseClass = inheritanceChain[1] || '';

  const schemaFile = metaTable['Schema'] || metaTable['Schema-Datei'] ||
    (swe2Comp.sources?.docs || []).find(s => s.includes('schema_')) ||
    (swe2Comp.sources?.code || []).find(s => s.includes('schema_')) || '';
  const lineCount = metaTable['Umfang'] || '';

  const catKey = normalizeCategoryKey(swe2Comp.category || metaTable['Kategorie'] || invComp?.subcategory);
  const catMeta = CATEGORY_META[catKey] || CATEGORY_META.sonstige;

  const contentBlocks = parsed.blocks.filter((b, idx) => {
    if (idx <= 2 && b.type === 'table' && b.headers.length === 2 && b.headers[0].toLowerCase() === 'feld') {
      return false;
    }
    return true;
  });

  // A01 Fix (P0): Vollständiges HTML-Escaping für alle dynamischen Felder im Fallback-Zweig!
  const htmlContent = hasMdFile
    ? renderBlocksToHtml(contentBlocks, context)
    : `<div class="hb-callout hb-callout-info"><div class="hb-callout-icon">ℹ️</div><div class="hb-callout-body"><strong>SWE-2-Entity (${escapeHtml(swe2Comp.id)}):</strong> ${escapeHtml(swe2Comp.description || 'Komponente aus Schema/Inventar.')}</div></div>`;

  const codeSources = swe2Comp.sources?.code || [];
  const docSources = swe2Comp.sources?.docs || [];
  const testSources = swe2Comp.sources?.tests || [];
  const devStatus = normalizeDevStatus(swe2Comp.status?.dev);

  return {
    id: swe2Comp.id,
    kind: 'component',
    name: swe2Comp.name,
    title: swe2Comp.title || swe2Comp.name,
    categoryKey: catKey,
    categoryLabel: catMeta.label,
    categoryIcon: catMeta.icon,
    devStatus,
    testStatus: swe2Comp.status?.test || 'nicht getestet',
    docStatus: swe2Comp.status?.doc || (isCurated ? 'technisch geprüft' : 'entwurf'),
    status: {
      dev: devStatus,
      test: swe2Comp.status?.test || 'nicht getestet',
      doc: swe2Comp.status?.doc || (isCurated ? 'technisch geprüft' : 'entwurf')
    },
    provenance: swe2Comp.provenance || { method: ['inventory'], confidence: 'documented', facts: {} },
    confidence: swe2Comp.provenance?.confidence || 'documented',
    version: swe2Comp.version || {},
    isCurated,
    hasMdFile,
    summary: swe2Comp.description || invComp?.summary || '',
    sources: [...codeSources, ...docSources],
    sourcesByType: { code: codeSources, docs: docSources, tests: testSources },
    tests: testSources,
    limitations: swe2Comp.limitations || [],
    openQuestions: swe2Comp.openQuestions || [],
    registered: swe2Comp.registered || { editor: false, runtime: false },
    usageCount: invComp?.usageCount || 0,
    inheritanceChain,
    baseClass,
    schemaFile,
    lineCount,
    properties,
    events,
    eventsDetail,
    methods,
    methodsDetail,
    rawRelations: swe2Comp.relations || [],
    relations: [],
    headings: parsed.headings,
    htmlContent,
    usedInChapters: [],
    relatedFeatures: [],
    relatedComponents: []
  };
}

function parseGenericMarkdownDoc(docSpec, rootDir, kb, context) {
  const fullPath = path.join(rootDir, docSpec.path);
  if (!fs.existsSync(fullPath)) return null;
  const raw = fs.readFileSync(fullPath, 'utf8').replace(/\r\n/g, '\n');
  const parsed = parseMarkdownBlocks(raw, { id: docSpec.id, defaultTitle: docSpec.title });
  const htmlContent = renderBlocksToHtml(parsed.blocks, context);
  const compMatches = Array.from(new Set(raw.match(/\bT[A-Z][a-zA-Z0-9]+\b/g) || [])).filter(c => context.knownComponents.has(c));
  const featMatches = Array.from(new Set(raw.match(/\bFEAT-\d{4}\b/g) || []));

  const relNorm = normalizeRelPath(docSpec.path);
  const swe2Doc = kb.docByPath.get(relNorm);
  const plainText = toPlainSearchText(raw);
  const devStatus = swe2Doc ? normalizeDevStatus(swe2Doc.status?.dev) : 'implementiert';

  return {
    id: docSpec.id,
    docId: swe2Doc ? swe2Doc.id : null,
    swe2DocId: swe2Doc ? swe2Doc.id : null,
    title: docSpec.title || parsed.title,
    category: docSpec.category || 'Allgemein',
    path: relNorm,
    summary: docSpec.summary || swe2Doc?.description || (parsed.blocks.find(b => b.type === 'p')?.text || '').slice(0, 240),
    status: swe2Doc?.status || { dev: devStatus, test: 'nicht getestet', doc: 'technisch geprüft' },
    devStatus,
    confidence: swe2Doc?.provenance?.confidence || 'documented',
    provenance: swe2Doc?.provenance || { method: ['doc'], confidence: 'documented', facts: {} },
    docMeta: swe2Doc?.docMeta || null,
    statusNote: parsed.statusNote,
    headings: parsed.headings,
    components: compMatches,
    features: featMatches,
    htmlContent,
    plainText
  };
}

function collectFeatureMarkdownDocs(featuresDir, rootDir, kb, context) {
  const articles = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const relFromFeatures = path.relative(featuresDir, full).replace(/\\/g, '/');
        if (relFromFeatures === 'README.md') continue;
        const slug = relFromFeatures.replace(/\/README\.md$/i, '').replace(/\.md$/i, '').replace(/\//g, '-');
        const subGroup = relFromFeatures.split('/')[0] || 'allgemein';
        const relFromRoot = path.relative(rootDir, full).replace(/\\/g, '/');
        const doc = parseGenericMarkdownDoc({
          id: `feat-doc-${slug}`,
          title: slug,
          category: subGroup.toUpperCase(),
          path: relFromRoot
        }, rootDir, kb, context);
        if (doc) {
          doc.title = doc.title.replace(/&amp;/g, '&');
          articles.push(doc);
        }
      }
    }
  };
  if (fs.existsSync(featuresDir)) walk(featuresDir);

  const featureMapDoc = parseGenericMarkdownDoc({
    id: 'feat-doc-feature-map',
    title: 'GCS Feature-Map & Use-Case-Wegweiser',
    category: 'ÜBERSICHT',
    path: 'docs/GCS_FEATURE_MAP.md',
    summary: 'Prosaischer Wegweiser durch die GCS-Funktionsbereiche und zugehörigen Use-Cases.'
  }, rootDir, kb, context);
  if (featureMapDoc) articles.unshift(featureMapDoc);

  return articles;
}

function parseTechnicalDebtItems(rootDir, context) {
  const tdPath = path.join(rootDir, 'docs', 'inventory', 'TECHNICAL-DEBT.md');
  if (!fs.existsSync(tdPath)) return [];
  const raw = fs.readFileSync(tdPath, 'utf8').replace(/\r\n/g, '\n');
  const sections = raw.split(/\n(?=## TD-\d{3})/);
  const items = [];
  for (const sec of sections) {
    const m = sec.match(/^## (TD-\d{3})\s*[—–-]\s*([^\n]+)/);
    if (!m) continue;
    const id = m[1];
    const rawHeading = m[2].replace(/&amp;/g, '&').trim();
    const priorityMatch = rawHeading.match(/\*\*Priorität:\s*([^*]+)\*\*/i);
    const priority = priorityMatch ? priorityMatch[1].trim() : (rawHeading.includes('analysiert') ? 'analysiert' : 'dokumentiert');
    const cleanTitle = rawHeading.replace(/\s*[—–-]\s*\*\*[^*]+\*\*/g, '').trim();
    const areaMatch = sec.match(/\*\*Bereich:\*\*\s*([^\n]+)/);
    const findingMatch = sec.match(/\*\*Befund:\*\*\s*([^\n]+)/);
    const parsed = parseMarkdownBlocks(sec, { id, defaultTitle: cleanTitle });
    const plainText = toPlainSearchText(sec);
    items.push({
      id,
      title: cleanTitle,
      priority,
      area: areaMatch ? areaMatch[1].replace(/`/g, '').trim() : '',
      summary: findingMatch ? findingMatch[1].replace(/`/g, '').trim() : '',
      htmlContent: renderBlocksToHtml(parsed.blocks.slice(1), context),
      text: plainText,
      plainText
    });
  }
  return items;
}

function buildPortalData(options = {}) {
  const rootDir = options.rootDir || ROOT;
  // 1. SWE-2-Wissensbasis einlesen (Manifest zuerst, inkl. SHA-256-Checksums, 693 Entities & 1.774 Chunks)
  const kb = loadSwe2KnowledgeBase(rootDir, config.swe2Integration);
  const inventoryRaw = JSON.parse(fs.readFileSync(path.join(rootDir, config.sources.inventoryJson), 'utf8'));
  const invCompById = new Map((inventoryRaw.components || []).map(c => [c.id, c]));

  const knownComponents = new Set(kb.entities.components.map(c => c.name));
  const compIdToName = {};
  for (const c of kb.entities.components) {
    compIdToName[c.id] = c.name;
  }
  const parseContext = { knownComponents, compIdToName };

  // Dokument-Pfad → Portal-Route Mapping für präzise Chunk- & Relations-Verlinkung
  const portalRouteByDocPath = new Map();

  // 2. Autoren-Handbuch (23 Kapitel) + Verknüpfung mit GUIDE-0001..0023
  const userGuideDir = path.join(rootDir, config.sources.userGuideDir);
  const chapters = CHAPTER_SPECS.map(spec => {
    const ch = parseHandbookChapter(spec, userGuideDir, parseContext);
    const docRel = normalizeRelPath(`docs/user-guide/${spec.file}`);
    const swe2Guide = kb.guideByDocPath.get(docRel);
    ch.guideId = swe2Guide ? swe2Guide.id : null;
    ch.guideName = swe2Guide ? swe2Guide.name : ch.num;
    ch.groupId = ch.group;
    ch.groupTitle = ch.group;
    ch.htmlContent = ch.modernHtml;
    if (ch.mediaSection && !ch.mediaSection.scriptText) {
      ch.mediaSection.scriptText = ch.mediaSection.script || '';
    }
    ch.status = swe2Guide?.status || { dev: 'implementiert', test: 'nicht getestet', doc: 'fachlich freigegeben' };
    ch.devStatus = normalizeDevStatus(swe2Guide?.status?.dev);
    ch.confidence = swe2Guide?.provenance?.confidence || 'documented';
    ch.provenance = swe2Guide?.provenance || { method: ['doc'], confidence: 'documented', facts: {} };
    ch.version = swe2Guide?.version || {};
    portalRouteByDocPath.set(docRel, `#handbook/${ch.id}`);
    return ch;
  });

  // 3. Komponentenreferenz (128 Komponenten aus SWE-2 + Markdown-Steckbriefe)
  const compDir = path.join(rootDir, config.sources.componentsDir);
  const components = kb.entities.components.map(swe2Comp => {
    const comp = parseComponentWithSwe2(swe2Comp, invCompById.get(swe2Comp.id), compDir, kb, parseContext);
    for (const docPath of swe2Comp.sources?.docs || []) {
      if (docPath.endsWith('.md')) {
        portalRouteByDocPath.set(normalizeRelPath(docPath), `#components/${comp.id}`);
      }
    }
    return comp;
  });

  const compByName = {};
  const compById = {};
  components.forEach(c => {
    compByName[c.name] = c;
    compById[c.id] = c;
  });

  // 4. Feature-Fachartikel, Architektur-Doks & Entwickler-Doks parsen und im Pfad-Router registrieren
  const featureArticles = collectFeatureMarkdownDocs(path.join(rootDir, config.sources.featuresDir), rootDir, kb, parseContext);
  featureArticles.forEach(fa => portalRouteByDocPath.set(normalizeRelPath(fa.path), `#features/${fa.id}`));

  const archSpecs = [
    { id: 'overview', title: 'Systemarchitektur — Gesamtbild & Schichten', category: 'Kernarchitektur', path: 'docs/architecture/overview.md' },
    { id: 'module-map', title: 'Modulkarte & Verzeichnisstruktur (Module Map)', category: 'Kernarchitektur', path: 'docs/architecture/module-map.md' },
    { id: 'execution-flow', title: 'Ausführungsfluss (Editor → Runtime → Actions)', category: 'Laufzeit & Engine', path: 'docs/architecture/execution-flow.md' },
    { id: 'arch-readme', title: 'Architektur-Dokumentation — Konventionen & Überblick', category: 'Grundlagen', path: 'docs/architecture/README.md' }
  ];
  const architectureDocs = archSpecs.map(s => parseGenericMarkdownDoc(s, rootDir, kb, parseContext)).filter(Boolean);
  architectureDocs.forEach(ad => portalRouteByDocPath.set(normalizeRelPath(ad.path), `#architecture/${ad.id}`));

  const devRefArticles = config.sources.developerDocs
    .map(s => parseGenericMarkdownDoc(s, rootDir, kb, parseContext))
    .filter(Boolean);
  devRefArticles.forEach(dd => portalRouteByDocPath.set(normalizeRelPath(dd.path), `#devref/${dd.id}`));

  // Bekannte Spezial-Referenzdateien direkt auf ihre Portal-Register abbilden
  portalRouteByDocPath.set('docs/reference/actions.md', '#devref/actions');
  portalRouteByDocPath.set('docs/inventory/action-metadata.json', '#devref/actions');
  portalRouteByDocPath.set('docs/reference/events.md', '#devref/events');

  // 5. Route-Resolver für alle SWE-2-Entities und Relations initialisieren
  const routeResolver = createRouteResolver(kb, portalRouteByDocPath);

  // Relations und Querverweise auf Komponenten auflösen
  for (const ch of chapters) {
    for (const cName of ch.components) {
      if (compByName[cName]) {
        compByName[cName].usedInChapters.push({
          id: ch.id,
          guideId: ch.guideId,
          num: ch.num,
          shortTitle: ch.shortTitle
        });
      }
    }
  }

  for (const comp of components) {
    comp.relations = routeResolver.resolveRelations(comp.rawRelations);
    delete comp.rawRelations;

    const rel = new Set();
    for (const r of comp.relations) {
      if ((r.type === 'inherits' || r.type === 'seeAlso') && compById[r.target]) {
        rel.add(compById[r.target].name);
      }
    }
    comp.inheritanceChain.forEach(n => { if (n !== comp.name && compByName[n]) rel.add(n); });
    components.forEach(other => {
      if (other.baseClass === comp.name) rel.add(other.name);
    });
    if (rel.size < 6) {
      components
        .filter(o => o.categoryKey === comp.categoryKey && o.name !== comp.name)
        .slice(0, 6 - rel.size)
        .forEach(o => rel.add(o.name));
    }
    comp.relatedComponents = Array.from(rel).slice(0, 8);
  }

  const categories = Object.values(CATEGORY_META)
    .map(cat => ({
      ...cat,
      count: components.filter(c => c.categoryKey === cat.id).length
    }))
    .filter(cat => cat.count > 0)
    .sort((a, b) => a.order - b.order);

  // 6. Features (FEAT-0001..0012 aus SWE-2 features-swe2.json)
  const features = kb.entities.features.map(f => {
    const resolvedRelations = routeResolver.resolveRelations(f.relations || []);
    const dependsOn = resolvedRelations.filter(r => r.type === 'dependsOn').map(r => r.target);
    const documentedIn = resolvedRelations.filter(r => r.type === 'documentedIn');
    const codeSources = f.sources?.code || [];
    const docSources = f.sources?.docs || [];
    const testSources = f.sources?.tests || [];

    const textBlob = [f.name, f.description, ...codeSources, ...docSources].join(' ');
    const linkedComponents = Array.from(knownComponents).filter(cName => textBlob.includes(cName));

    const linkedChapters = chapters
      .filter(ch => {
        if (f.category === 'editor' && ch.index <= 8) return true;
        if (f.category === 'runtime' && ch.index >= 5 && ch.index <= 14) return true;
        if (f.category === 'learning' && ch.part === 'B') return true;
        return ch.components.some(c => linkedComponents.includes(c));
      })
      .slice(0, 6)
      .map(ch => ({ id: ch.id, guideId: ch.guideId, num: ch.num, shortTitle: ch.shortTitle }));

    linkedComponents.forEach(cName => {
      if (compByName[cName] && !compByName[cName].relatedFeatures.some(rf => rf.id === f.id)) {
        compByName[cName].relatedFeatures.push({ id: f.id, name: f.name });
      }
    });

    const devStatus = normalizeDevStatus(f.status?.dev);

    return {
      id: f.id,
      kind: 'feature',
      name: f.name,
      title: f.title || f.name,
      category: f.category || 'runtime',
      summary: f.description || '',
      devStatus,
      testStatus: f.status?.test || 'nicht getestet',
      docStatus: f.status?.doc || 'technisch geprüft',
      status: f.status || {},
      provenance: f.provenance || { method: ['inventory'], confidence: 'documented', facts: {} },
      confidence: f.provenance?.confidence || 'documented',
      version: f.version || {},
      dependsOn,
      documentedIn,
      relations: resolvedRelations,
      sources: [...codeSources, ...docSources],
      sourcesByType: { code: codeSources, docs: docSources, tests: testSources },
      tests: testSources,
      relatedDocs: docSources,
      testRuns: f.testRuns || [],
      limitations: f.limitations || [],
      openQuestions: f.openQuestions || [],
      linkedComponents,
      linkedChapters
    };
  });

  // 7. Action-Typen (ACT-0001..0059), Methoden (MTH-0001..0038), Events (EVT-0001..0163),
  //    Schemas (SCM-0001..0013), Konzepte (CON-0001..0015) & Dokumente (DOC-0001..0242)
  const actions = kb.entities.actionTypes.map(act => ({
    id: act.id,
    kind: 'action-type',
    type: act.name,
    name: act.name,
    label: act.title || act.name,
    description: act.description || '',
    parameters: (act.parameters || []).map(p => ({
      name: p.name,
      label: p.label || p.name,
      type: p.type || 'string',
      options: Array.isArray(p.options) ? p.options : undefined,
      defaultValue: p.defaultValue !== undefined ? p.defaultValue : undefined,
      source: p.source || undefined,
      hint: p.hint || undefined,
      placeholder: p.placeholder || undefined,
      allowVariableBinding: p.allowVariableBinding,
      allowFreeText: p.allowFreeText,
      multiline: p.multiline,
      visibleWhen: p.visibleWhen || undefined
    })),
    flags: act.flags || {},
    limitations: act.limitations || [],
    relations: routeResolver.resolveRelations(act.relations || []),
    status: act.status || {},
    devStatus: normalizeDevStatus(act.status?.dev),
    confidence: act.provenance?.confidence || 'verified',
    provenance: act.provenance || { method: ['code'], confidence: 'verified', facts: {} },
    sources: act.sources || {},
    version: act.version || {}
  }));

  const methods = kb.entities.methods.map(m => ({
    id: m.id,
    kind: 'method',
    name: m.name,
    title: m.title || m.name,
    description: m.description || '',
    parameters: m.parameters || [],
    status: m.status || {},
    devStatus: normalizeDevStatus(m.status?.dev),
    confidence: m.provenance?.confidence || 'verified',
    provenance: m.provenance || { method: ['code'], confidence: 'verified', facts: {} },
    sources: m.sources || {},
    usedByComponents: components.filter(c => c.methods.includes(m.name)).map(c => ({ id: c.id, name: c.name }))
  }));

  const events = kb.entities.events.map(ev => ({
    id: ev.id,
    kind: 'event',
    name: ev.name,
    title: ev.title || ev.name,
    description: ev.description || '',
    declaredBy: ev.declaredBy || [],
    relations: routeResolver.resolveRelations(ev.relations || []),
    status: ev.status || {},
    devStatus: normalizeDevStatus(ev.status?.dev),
    confidence: ev.provenance?.confidence || 'verified',
    provenance: ev.provenance || { method: ['schema'], confidence: 'verified', facts: {} },
    sources: ev.sources || {}
  }));

  const schemas = kb.entities.schemas.map(sc => ({
    id: sc.id,
    kind: 'schema',
    name: sc.name,
    title: sc.title || sc.name,
    description: sc.description || '',
    relations: routeResolver.resolveRelations(sc.relations || []),
    status: sc.status || {},
    devStatus: normalizeDevStatus(sc.status?.dev),
    confidence: sc.provenance?.confidence || 'verified',
    provenance: sc.provenance || { method: ['schema'], confidence: 'verified', facts: {} },
    sources: sc.sources || {}
  }));

  const concepts = kb.entities.concepts.map(con => {
    const route = routeResolver.resolveEntityRoute(con);
    return {
      id: con.id,
      kind: 'concept',
      name: con.name,
      title: con.title || con.name,
      description: con.description || '',
      relations: routeResolver.resolveRelations(con.relations || []),
      status: con.status || {},
      devStatus: normalizeDevStatus(con.status?.dev),
      confidence: con.provenance?.confidence || 'documented',
      provenance: con.provenance || { method: ['doc'], confidence: 'documented', facts: {} },
      sources: con.sources || {},
      portalHref: route.href
    };
  });

  const documentInventory = kb.entities.documents.map(doc => {
    const route = routeResolver.resolveEntityRoute(doc);
    const fileRel = normalizeRelPath(doc.sources?.docs?.[0] || doc.title);
    const devStatus = normalizeDevStatus(doc.status?.dev);
    return {
      id: doc.id,
      kind: 'document',
      name: doc.name,
      file: fileRel,
      type: doc.category || 'dokument',
      note: doc.description || '',
      rating: doc.docMeta?.rating || (devStatus === 'veraltet' ? 'möglicherweise veraltet' : 'aktuell'),
      reviewDepth: doc.docMeta?.reviewDepth || 'metadaten',
      basis: doc.docMeta?.basis || '',
      canonical: Boolean(doc.docMeta?.canonical),
      missing: Boolean(doc.missing),
      status: doc.status || {},
      devStatus,
      confidence: doc.provenance?.confidence || 'documented',
      provenance: doc.provenance || { method: ['inventory'], confidence: 'documented', facts: {} },
      portalHref: route.linkable ? route.href : null
    };
  });

  const techDebtItems = parseTechnicalDebtItems(rootDir, parseContext);

  // 8. Globaler Suchindex aus allen 693 SWE-2-Basis-Entities + 1.774 SWE-2-Chunks + Portal-Fachartikeln & Technical Debt (A02, A03)
  const chunkSearchEntries = buildSearchIndexFromSwe2Chunks(kb, routeResolver);
  const searchIndex = [...chunkSearchEntries];

  for (const fa of featureArticles) {
    searchIndex.push({
      area: 'features',
      areaLabel: '✨ Feature-Doku',
      id: fa.id,
      entityId: fa.docId || fa.id,
      kind: 'feature-article',
      entryType: 'article',
      badge: fa.docId || fa.category,
      title: fa.title,
      subtitle: fa.path,
      href: `#features/${fa.id}`,
      linkable: true,
      sourceDoc: fa.path,
      statusDev: fa.devStatus || 'implementiert',
      confidence: fa.confidence || 'documented',
      missing: false,
      keywords: [...(fa.components || []), ...(fa.features || []), fa.category, fa.docId || ''].join(' '),
      text: String(fa.plainText || fa.summary || fa.title || '')
    });
  }

  for (const ad of architectureDocs) {
    searchIndex.push({
      area: 'architecture',
      areaLabel: '🏛️ Architektur',
      id: ad.id,
      entityId: ad.docId || ad.id,
      kind: 'architecture-doc',
      entryType: 'article',
      badge: ad.docId || ad.category,
      title: ad.title,
      subtitle: ad.path,
      href: `#architecture/${ad.id}`,
      linkable: true,
      sourceDoc: ad.path,
      statusDev: ad.devStatus || 'implementiert',
      confidence: ad.confidence || 'verified',
      missing: false,
      keywords: [...(ad.components || []), ...(ad.features || []), ad.docId || ''].join(' '),
      text: String(ad.plainText || ad.summary || ad.title || '')
    });
  }

  for (const dd of devRefArticles) {
    searchIndex.push({
      area: 'devref',
      areaLabel: '🛠️ Entwickler',
      id: dd.id,
      entityId: dd.docId || dd.id,
      kind: 'devref-doc',
      entryType: 'article',
      badge: dd.docId || dd.category,
      title: dd.title,
      subtitle: dd.path,
      href: `#devref/${dd.id}`,
      linkable: true,
      sourceDoc: dd.path,
      statusDev: dd.devStatus || 'implementiert',
      confidence: dd.confidence || 'documented',
      missing: false,
      keywords: [...(dd.components || []), ...(dd.features || []), dd.category, dd.docId || ''].join(' '),
      text: String(dd.plainText || dd.summary || dd.title || '')
    });
  }

  for (const td of techDebtItems) {
    searchIndex.push({
      area: 'devref',
      areaLabel: '🛠️ Tech-Debt',
      id: `td-${td.id}`,
      entityId: td.id,
      kind: 'tech-debt',
      entryType: 'article',
      badge: td.id,
      title: `${td.id}: ${td.title}`,
      subtitle: 'Technical Debt & Qualitätsbefunde',
      href: '#devref/technical-debt',
      linkable: true,
      sourceDoc: 'docs/inventory/TECHNICAL-DEBT.md',
      statusDev: 'implementiert',
      confidence: 'verified',
      missing: false,
      keywords: `${td.id} ${td.title} Technical Debt Befund`,
      text: String(td.text || td.summary || td.title || '')
    });
  }

  // Prüfe, ob alle SWE-2-Relations auflösbar sind
  let unresolvedRelationsCount = 0;
  for (const ent of kb.entityById.values()) {
    for (const rel of ent.relations || []) {
      if (!kb.entityById.has(rel.target)) unresolvedRelationsCount++;
    }
  }

  // Deterministischer Build-Zeitstempel für reproduzierbare Builds (A14)
  const deterministicGeneratedAt = process.env.ARGON_BUILD_TIME || kb.manifest.generated || new Date().toISOString();

  const payload = {
    meta: {
      portalId: config.portalId,
      title: config.title,
      subtitle: config.subtitle,
      edition: config.edition,
      version: config.version,
      generatedAt: deterministicGeneratedAt,
      analysisCommit: kb.manifest.sourceCommit || '53e3dfb',
      counts: {
        handbookChapters: chapters.length,
        handbookPartA: chapters.filter(c => c.part === 'A').length,
        handbookPartB: chapters.filter(c => c.part === 'B').length,
        components: components.length,
        componentCardsMd: components.filter(c => c.hasMdFile).length,
        componentCategories: categories.length,
        features: features.length,
        featureArticles: featureArticles.length,
        architectureDocs: architectureDocs.length,
        devRefDocs: devRefArticles.length,
        techDebtItems: techDebtItems.length,
        actions: actions.length,
        methods: methods.length,
        events: events.length,
        schemas: schemas.length,
        concepts: concepts.length,
        inventoryDocuments: documentInventory.length,
        missingDocuments: documentInventory.filter(d => d.missing).length,
        swe2EntitiesTotal: kb.manifest.counts.entities,
        swe2ChunksTotal: kb.chunks.length,
        unresolvedRelations: unresolvedRelationsCount,
        searchEntries: searchIndex.length
      },
      swe2Integration: {
        ...config.swe2Integration,
        schemaVersion: kb.manifest.schemaVersion,
        sourceCommit: kb.manifest.sourceCommit,
        totalEntities: kb.entityById.size,
        totalChunks: kb.chunks.length,
        unresolvedRelationsCount,
        entityCountsByKind: kb.manifest.counts.byKind,
        manifest: kb.manifest,
        status: {
          enabled: true,
          active: true,
          entitiesLoaded: kb.entityById.size,
          chunksLoaded: kb.chunks.length,
          unresolvedRelations: unresolvedRelationsCount
        }
      }
    },
    handbook: {
      chapters
    },
    components: {
      categories,
      items: components
    },
    features: {
      inventory: features,
      articles: featureArticles
    },
    architecture: {
      articles: architectureDocs
    },
    devref: {
      articles: devRefArticles,
      techDebt: techDebtItems,
      actions,
      methods,
      events,
      schemas,
      concepts,
      documentInventory
    },
    searchIndex
  };

  if (options.writeFiles !== false) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(path.join(DATA_DIR, 'portal-data-argon.json'), JSON.stringify(payload, null, 2), 'utf8');
    fs.writeFileSync(
      path.join(DATA_DIR, 'portal-data-argon.js'),
      `// AUTOMATISCH GENERIERT durch build-argon.cjs (inkl. SWE-2-Wissensbasis Schema v${kb.manifest.schemaVersion}) — NICHT MANUELL EDITIEREN\nwindow.GCS_PORTAL_DATA_ARGON = ${JSON.stringify(payload).replace(/</g, '\\u003c')};\n`,
      'utf8'
    );

    console.log(
      `[build-argon] Portal-Daten mit SWE-2-Wissensbasis erfolgreich erzeugt:\n` +
      `  - SWE-2-Manifest:  v${kb.manifest.schemaVersion} (${kb.manifest.counts.entities} Entities, ${kb.chunks.length} Chunks, ${unresolvedRelationsCount} unauflösbare Relations)\n` +
      `  - Handbuch:        ${payload.meta.counts.handbookChapters} Kapitel (GUIDE-0001..0023)\n` +
      `  - Komponenten:     ${payload.meta.counts.components} (COMP-0001..0128 in ${payload.meta.counts.componentCategories} Kategorien)\n` +
      `  - Features:        ${payload.meta.counts.features} Features (FEAT-0001..0012) + ${payload.meta.counts.featureArticles} Fachartikel\n` +
      `  - Architektur:     ${payload.meta.counts.architectureDocs} Dokumente\n` +
      `  - Entwicklerref.:  ${payload.meta.counts.actions} Actions (ACT), ${payload.meta.counts.methods} Methoden (MTH), ${payload.meta.counts.events} Events (EVT), ${payload.meta.counts.schemas} Schemas (SCM), ${payload.meta.counts.concepts} Konzepte (CON), ${payload.meta.counts.inventoryDocuments} Dokumente (DOC, davon ${payload.meta.counts.missingDocuments} missing)\n` +
      `  - Suchindex:       ${payload.meta.counts.searchEntries} Einträge (${kb.entityById.size} Entities + ${kb.chunks.length} Chunks + Fachartikel)`
    );
  }

  return payload;
}

if (require.main === module) {
  buildPortalData();
}

module.exports = { buildPortalData, parseComponentWithSwe2 };

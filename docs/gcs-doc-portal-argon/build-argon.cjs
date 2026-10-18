/**
 * build-argon.cjs — Zentraler Build-Prozess für das GCS Documentation Portal (Argon)
 * mit vollständiger Integration der SWE-2-Wissensbasis (docs/gcs-knowledge-swe2/).
 *
 * Liest alle Dokumentations- und SWE-2-Quellen strikt read-only aus und erzeugt:
 * - docs/gcs-doc-portal-argon/data/portal-data-argon.json
 * - docs/gcs-doc-portal-argon/data/portal-data-argon.js (window.GCS_PORTAL_DATA_ARGON)
 */
const fs = require('node:fs');
const path = require('node:path');
const {
  CHAPTER_SPECS,
  parseMarkdownBlocks,
  renderBlocksToHtml,
  parseHandbookChapter
} = require('./parser-argon.cjs');
const {
  normalizeRelPath,
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

function parseComponentWithSwe2(swe2Comp, invComp, compDir, kb, context) {
  const mdRel = swe2Comp.sources?.docs?.find(d => d.endsWith('.md')) || `docs/reference/components/${swe2Comp.name}.md`;
  const mdFile = path.join(ROOT, mdRel);
  const hasMdFile = fs.existsSync(mdFile);
  let raw = '';
  let parsed = { title: swe2Comp.name, statusNote: '', headings: [], checklists: [], screenshots: [], blocks: [] };
  const metaTable = {};
  const mdProps = [];
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
      if (b.type === 'table' && b.headers.length >= 3 && b.headers[0].toLowerCase().includes('name')) {
        for (const row of b.rows) {
          mdProps.push({
            name: (row[0] || '').replace(/`/g, '').trim(),
            label: (row[1] || '').trim(),
            type: (row[2] || '').replace(/`/g, '').trim(),
            group: (row[3] || 'Allgemein').trim(),
            source: 'markdown'
          });
        }
      }
    }
  }

  // Merge SWE-2 properties (mit Typ, Default, Beschreibung, Quelle) + Markdown-Inspector-Zeilen
  const propMap = new Map();
  if (swe2Comp.properties && typeof swe2Comp.properties === 'object') {
    for (const [propName, pDef] of Object.entries(swe2Comp.properties)) {
      propMap.set(propName, {
        name: propName,
        label: pDef.label || propName,
        type: pDef.type || 'unknown',
        defaultValue: pDef.default !== undefined ? pDef.default : '—',
        description: pDef.description || '',
        group: pDef.group || 'SCHEMA',
        source: pDef.source || 'schema'
      });
    }
  }
  for (const mp of mdProps) {
    if (!mp.name) continue;
    if (propMap.has(mp.name)) {
      const existing = propMap.get(mp.name);
      if (!existing.label || existing.label === mp.name) existing.label = mp.label;
      if (existing.group === 'SCHEMA' && mp.group) existing.group = mp.group;
    } else {
      propMap.set(mp.name, {
        name: mp.name,
        label: mp.label || mp.name,
        type: mp.type || 'string',
        defaultValue: '—',
        description: '',
        group: mp.group || 'INSPECTOR',
        source: 'markdown'
      });
    }
  }
  const properties = Array.from(propMap.values());

  // Events mit stabiler SWE-2-ID (EVT-####) und Herkunft verknüpfen
  const eventsDetail = (swe2Comp.events || []).map(ev => {
    const evtEntity = kb.eventByName.get(ev.name);
    return {
      id: evtEntity ? evtEntity.id : null,
      name: ev.name,
      origin: ev.origin || 'documented',
      source: ev.source || '',
      declaredByCount: evtEntity?.declaredBy?.length || 1,
      confidence: evtEntity?.provenance?.confidence || swe2Comp.provenance?.confidence || 'documented'
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
      confidence: mthEntity?.provenance?.confidence || swe2Comp.provenance?.confidence || 'documented'
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

  const htmlContent = hasMdFile
    ? renderBlocksToHtml(contentBlocks, context)
    : `<div class="hb-callout hb-callout-info"><div class="hb-callout-icon">ℹ️</div><div class="hb-callout-body"><strong>SWE-2-Entity (${swe2Comp.id}):</strong> ${swe2Comp.description || 'Komponente aus Schema/Inventar.'}</div></div>`;

  const codeSources = swe2Comp.sources?.code || [];
  const docSources = swe2Comp.sources?.docs || [];
  const testSources = swe2Comp.sources?.tests || [];

  return {
    id: swe2Comp.id,
    kind: 'component',
    name: swe2Comp.name,
    title: swe2Comp.title || swe2Comp.name,
    categoryKey: catKey,
    categoryLabel: catMeta.label,
    categoryIcon: catMeta.icon,
    devStatus: swe2Comp.status?.dev || 'implementiert',
    testStatus: swe2Comp.status?.test || 'nicht getestet',
    docStatus: swe2Comp.status?.doc || (isCurated ? 'technisch geprüft' : 'entwurf'),
    status: swe2Comp.status || { dev: 'implementiert', test: 'nicht getestet', doc: 'entwurf' },
    provenance: swe2Comp.provenance || { method: ['inventory'], confidence: 'documented' },
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

  return {
    id: docSpec.id,
    swe2DocId: swe2Doc ? swe2Doc.id : null,
    title: docSpec.title || parsed.title,
    category: docSpec.category || 'Allgemein',
    path: relNorm,
    summary: docSpec.summary || swe2Doc?.description || (parsed.blocks.find(b => b.type === 'p')?.text || '').slice(0, 240),
    status: swe2Doc?.status || { dev: 'implementiert', test: 'nicht getestet', doc: 'technisch geprüft' },
    confidence: swe2Doc?.provenance?.confidence || 'documented',
    docMeta: swe2Doc?.docMeta || null,
    statusNote: parsed.statusNote,
    headings: parsed.headings,
    components: compMatches,
    features: featMatches,
    htmlContent
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
    items.push({
      id,
      title: cleanTitle,
      priority,
      area: areaMatch ? areaMatch[1].replace(/`/g, '').trim() : '',
      summary: findingMatch ? findingMatch[1].replace(/`/g, '').trim() : '',
      htmlContent: renderBlocksToHtml(parsed.blocks.slice(1), context)
    });
  }
  return items;
}

function buildPortalData() {
  // 1. SWE-2-Wissensbasis einlesen (Manifest zuerst, dann alle 688 Entities + 1.774 Chunks)
  const kb = loadSwe2KnowledgeBase(ROOT, config.swe2Integration);
  const inventoryRaw = JSON.parse(fs.readFileSync(path.join(ROOT, config.sources.inventoryJson), 'utf8'));
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
  const userGuideDir = path.join(ROOT, config.sources.userGuideDir);
  const chapters = CHAPTER_SPECS.map(spec => {
    const ch = parseHandbookChapter(spec, userGuideDir, parseContext);
    const docRel = normalizeRelPath(`docs/user-guide/${spec.file}`);
    const swe2Guide = kb.guideByDocPath.get(docRel);
    ch.guideId = swe2Guide ? swe2Guide.id : null;
    ch.guideName = swe2Guide ? swe2Guide.name : ch.num;
    ch.status = swe2Guide?.status || { dev: 'implementiert', test: 'nicht getestet', doc: 'fachlich freigegeben' };
    ch.confidence = swe2Guide?.provenance?.confidence || 'documented';
    ch.version = swe2Guide?.version || {};
    portalRouteByDocPath.set(docRel, `#handbook/${ch.id}`);
    return ch;
  });

  // 3. Komponentenreferenz (128 Komponenten aus SWE-2 + Markdown-Steckbriefe)
  const compDir = path.join(ROOT, config.sources.componentsDir);
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
  const featureArticles = collectFeatureMarkdownDocs(path.join(ROOT, config.sources.featuresDir), ROOT, kb, parseContext);
  featureArticles.forEach(fa => portalRouteByDocPath.set(normalizeRelPath(fa.path), `#features/${fa.id}`));

  const archSpecs = [
    { id: 'overview', title: 'Systemarchitektur — Gesamtbild & Schichten', category: 'Kernarchitektur', path: 'docs/architecture/overview.md' },
    { id: 'module-map', title: 'Modulkarte & Verzeichnisstruktur (Module Map)', category: 'Kernarchitektur', path: 'docs/architecture/module-map.md' },
    { id: 'execution-flow', title: 'Ausführungsfluss (Editor → Runtime → Actions)', category: 'Laufzeit & Engine', path: 'docs/architecture/execution-flow.md' },
    { id: 'arch-readme', title: 'Architektur-Dokumentation — Konventionen & Überblick', category: 'Grundlagen', path: 'docs/architecture/README.md' }
  ];
  const architectureDocs = archSpecs.map(s => parseGenericMarkdownDoc(s, ROOT, kb, parseContext)).filter(Boolean);
  architectureDocs.forEach(ad => portalRouteByDocPath.set(normalizeRelPath(ad.path), `#architecture/${ad.id}`));

  const devRefArticles = config.sources.developerDocs
    .map(s => parseGenericMarkdownDoc(s, ROOT, kb, parseContext))
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
    // Primär: SWE-2 relations (inherits, seeAlso) über stabile COMP-IDs
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

    return {
      id: f.id,
      kind: 'feature',
      name: f.name,
      title: f.title || f.name,
      category: f.category || 'runtime',
      summary: f.description || '',
      devStatus: f.status?.dev || 'implementiert',
      testStatus: f.status?.test || 'nicht getestet',
      docStatus: f.status?.doc || 'technisch geprüft',
      status: f.status || {},
      provenance: f.provenance || { method: ['inventory'], confidence: 'documented' },
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

  // 7. Action-Typen (ACT-0001..0059), Methoden (MTH-0001..0038), Events (EVT-0001..0158),
  //    Schemas (SCM-0001..0013), Konzepte (CON-0001..0015) & Dokumente (DOC-0001..0242)
  const actions = kb.entities.actionTypes.map(act => ({
    id: act.id,
    kind: 'action-type',
    type: act.name,
    name: act.name,
    label: act.title || act.name,
    description: act.description || '',
    parameters: act.parameters || [],
    flags: act.flags || {},
    status: act.status || { dev: 'implementiert', test: 'nicht getestet', doc: 'entwurf' },
    devStatus: act.status?.dev || 'implementiert',
    confidence: act.provenance?.confidence || 'verified',
    provenance: act.provenance || {},
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
    status: m.status || { dev: 'implementiert', test: 'nicht getestet', doc: 'entwurf' },
    devStatus: m.status?.dev || 'implementiert',
    confidence: m.provenance?.confidence || 'verified',
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
    status: ev.status || { dev: 'implementiert', test: 'nicht getestet', doc: 'entwurf' },
    devStatus: ev.status?.dev || 'implementiert',
    confidence: ev.provenance?.confidence || 'verified',
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
    devStatus: sc.status?.dev || 'implementiert',
    confidence: sc.provenance?.confidence || 'verified',
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
      devStatus: con.status?.dev || 'implementiert',
      confidence: con.provenance?.confidence || 'documented',
      sources: con.sources || {},
      portalHref: route.href
    };
  });

  const documentInventory = kb.entities.documents.map(doc => {
    const route = routeResolver.resolveEntityRoute(doc);
    const fileRel = normalizeRelPath(doc.sources?.docs?.[0] || doc.title);
    return {
      id: doc.id,
      kind: 'document',
      name: doc.name,
      file: fileRel,
      type: doc.category || 'dokument',
      note: doc.description || '',
      rating: doc.docMeta?.rating || (doc.status?.dev === 'veraltet' ? 'möglicherweise veraltet' : 'aktuell'),
      reviewDepth: doc.docMeta?.reviewDepth || 'metadaten',
      basis: doc.docMeta?.basis || '',
      canonical: Boolean(doc.docMeta?.canonical),
      missing: Boolean(doc.missing),
      status: doc.status || {},
      devStatus: doc.status?.dev || 'implementiert',
      confidence: doc.provenance?.confidence || 'documented',
      portalHref: route.linkable ? route.href : null
    };
  });

  const techDebtItems = parseTechnicalDebtItems(ROOT, parseContext);

  // 8. Globaler Suchindex aus allen 1.774 SWE-2-Chunks (chunks-swe2.jsonl) + Portal-Fachartikeln
  const chunkSearchEntries = buildSearchIndexFromSwe2Chunks(kb, routeResolver);
  const searchIndex = [...chunkSearchEntries];

  // Prüfe, ob alle SWE-2-Relations auflösbar sind
  let unresolvedRelationsCount = 0;
  for (const ent of kb.entityById.values()) {
    for (const rel of ent.relations || []) {
      if (!kb.entityById.has(rel.target)) unresolvedRelationsCount++;
    }
  }

  const payload = {
    meta: {
      portalId: config.portalId,
      title: config.title,
      subtitle: config.subtitle,
      edition: config.edition,
      version: config.version,
      generatedAt: new Date().toISOString(),
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

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, 'portal-data-argon.json'), JSON.stringify(payload, null, 2), 'utf8');
  fs.writeFileSync(
    path.join(DATA_DIR, 'portal-data-argon.js'),
    `// AUTOMATISCH GENERIERT durch build-argon.cjs (inkl. SWE-2-Wissensbasis) — NICHT MANUELL EDITIEREN\nwindow.GCS_PORTAL_DATA_ARGON = ${JSON.stringify(payload).replace(/</g, '\\u003c')};\n`,
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
    `  - Suchindex:       ${payload.meta.counts.searchEntries} Chunks & Einträge`
  );

  return payload;
}

if (require.main === module) {
  buildPortalData();
}

module.exports = { buildPortalData };

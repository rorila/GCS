/**
 * build-argon.cjs — Zentraler Build-Prozess für das GCS Documentation Portal (Argon).
 * Liest alle Dokumentations- und Inventarquellen strikt read-only aus und erzeugt:
 * - docs/gcs-doc-portal-argon/data/portal-data-argon.json
 * - docs/gcs-doc-portal-argon/data/portal-data-argon.js (window.GCS_PORTAL_DATA_ARGON)
 */
const fs = require('node:fs');
const path = require('node:path');
const {
  CHAPTER_SPECS,
  slugify,
  parseMarkdownBlocks,
  renderBlocksToHtml,
  parseHandbookChapter
} = require('./parser-argon.cjs');

const PORTAL_DIR = __dirname;
const ROOT = path.resolve(PORTAL_DIR, '..', '..');
const DATA_DIR = path.join(PORTAL_DIR, 'data');
const config = JSON.parse(fs.readFileSync(path.join(PORTAL_DIR, 'portal-config-argon.json'), 'utf8'));

// Kategorie-Metadaten für die 11 Komponenten-Kategorien
const CATEGORY_META = {
  'basis': { id: 'basis', label: 'Basis & Vererbung', icon: '🧱', order: 1 },
  'anzeige': { id: 'anzeige', label: 'Anzeige & Text', icon: '🖼️', order: 2 },
  'medien': { id: 'medien', label: 'Medien & Sprache', icon: '🎬', order: 3 },
  'eingabe': { id: 'eingabe', label: 'Eingabe & Steuerung', icon: '⌨️', order: 4 },
  'container': { id: 'container', label: 'Container & Layout', icon: '📐', order: 5 },
  'daten': { id: 'daten', label: 'Daten & Listen', icon: '🗄️', order: 6 },
  'variablen': { id: 'variablen', label: 'Variablen & Zustand', icon: '🔢', order: 7 },
  'zeit': { id: 'zeit', label: 'Zeit & Logik', icon: '⏱️', order: 8 },
  'spiel': { id: 'spiel', label: 'Spiel & Physik', icon: '🎮', order: 9 },
  'server': { id: 'server', label: 'Server & Netzwerk', icon: '🌐', order: 10 },
  'system': { id: 'system', label: 'System & Dienste', icon: '⚙️', order: 11 },
  'dialoge': { id: 'dialoge', label: 'Dialoge & Overlays', icon: '💬', order: 12 },
  'sonstige': { id: 'sonstige', label: 'Weitere Komponenten', icon: '🧩', order: 13 }
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

function parseComponentMarkdown(compEntry, compDir, context) {
  const mdFile = path.join(compDir, `${compEntry.name}.md`);
  const hasMdFile = fs.existsSync(mdFile);
  let raw = '';
  let parsed = { title: compEntry.name, statusNote: '', headings: [], checklists: [], screenshots: [], blocks: [] };
  const metaTable = {};
  const properties = [];
  let events = [];
  let methods = [];
  let inheritanceChain = [compEntry.name];
  let baseClass = '';
  let schemaFile = '';
  let lineCount = '';
  let isCurated = false;

  if (hasMdFile) {
    raw = fs.readFileSync(mdFile, 'utf8').replace(/\r\n/g, '\n');
    isCurated = raw.includes('Kuratierte Referenzkarte');
    parsed = parseMarkdownBlocks(raw, { id: compEntry.id, defaultTitle: compEntry.name });

    for (const b of parsed.blocks) {
      if (b.type === 'table' && b.headers.length === 2 && b.headers[0].toLowerCase() === 'feld') {
        for (const row of b.rows) {
          const k = row[0].replace(/`/g, '').trim();
          const v = row[1].replace(/`/g, '').trim();
          metaTable[k] = v;
        }
      }
      if (b.type === 'table' && b.headers.length >= 3 && b.headers[0].toLowerCase() === 'name') {
        for (const row of b.rows) {
          properties.push({
            name: (row[0] || '').replace(/`/g, '').trim(),
            label: (row[1] || '').trim(),
            type: (row[2] || '').replace(/`/g, '').trim(),
            group: (row[3] || 'Allgemein').trim()
          });
        }
      }
      if (b.type === 'p' && b.section) {
        const secLower = b.section.toLowerCase();
        if (secLower.includes('ereignisse') || secLower.includes('events')) {
          const evMatches = b.text.match(/`([a-zA-Z0-9_]+)`/g) || [];
          evMatches.forEach(m => {
            const clean = m.replace(/`/g, '');
            if (clean.startsWith('on') && !events.includes(clean)) events.push(clean);
          });
        }
        if (secLower.includes('methoden')) {
          const mMatches = b.text.match(/`([a-zA-Z0-9_]+)`/g) || [];
          mMatches.forEach(m => {
            const clean = m.replace(/`/g, '');
            if (!clean.startsWith('T') && !methods.includes(clean)) methods.push(clean);
          });
        }
      }
    }

    if (metaTable['Vererbungskette']) {
      inheritanceChain = metaTable['Vererbungskette']
        .split(/→|->/)
        .map(s => s.replace(/`/g, '').trim())
        .filter(Boolean);
      baseClass = inheritanceChain[1] || '';
    } else if (metaTable['Basisklasse']) {
      baseClass = metaTable['Basisklasse'].replace(/`/g, '').trim();
      if (baseClass && baseClass !== '—' && baseClass !== '-') {
        inheritanceChain = [compEntry.name, baseClass];
        if (baseClass === 'TWindow' || baseClass === 'TPanel' || baseClass === 'TTextControl') {
          if (baseClass === 'TTextControl') inheritanceChain.push('TWindow');
          if (baseClass === 'TPanel') inheritanceChain.push('TWindow');
          inheritanceChain.push('TComponent');
        }
      }
    }

    schemaFile = metaTable['Schema'] || metaTable['Schema-Datei'] || (compEntry.sources || []).find(s => s.includes('schema_')) || '';
    lineCount = metaTable['Umfang'] || '';
  }

  const catKey = normalizeCategoryKey(metaTable['Kategorie'] || compEntry.subcategory || compEntry.category);
  const catMeta = CATEGORY_META[catKey] || CATEGORY_META.sonstige;

  // Render full HTML of markdown blocks (skipping top metadata table because we render a richer interactive header card)
  const contentBlocks = parsed.blocks.filter((b, idx) => {
    if (idx <= 2 && b.type === 'table' && b.headers.length === 2 && b.headers[0].toLowerCase() === 'feld') {
      return false;
    }
    return true;
  });
  const htmlContent = hasMdFile
    ? renderBlocksToHtml(contentBlocks, context)
    : `<div class="hb-callout hb-callout-info"><div class="hb-callout-icon">ℹ️</div><div class="hb-callout-body"><strong>Schema-Eintrag (${compEntry.id}):</strong> ${compEntry.summary || 'Diese Komponente ist im Schema/Inventar erfasst.'}</div></div>`;

  const searchText = [
    compEntry.id,
    compEntry.name,
    catMeta.label,
    compEntry.summary,
    properties.map(p => `${p.name} ${p.label}`).join(' '),
    events.join(' '),
    methods.join(' '),
    raw.replace(/[#>*`|_\[\]()]/g, ' ')
  ].join(' ').replace(/\s+/g, ' ').trim();

  return {
    id: compEntry.id,
    name: compEntry.name,
    categoryKey: catKey,
    categoryLabel: catMeta.label,
    categoryIcon: catMeta.icon,
    devStatus: compEntry.devStatus || 'implementiert',
    testStatus: compEntry.testStatus || 'nicht getestet',
    docStatus: isCurated ? 'technisch geprüft' : (compEntry.docStatus || 'entwurf'),
    isCurated,
    hasMdFile,
    summary: compEntry.summary || '',
    sources: compEntry.sources || [],
    tests: compEntry.tests || [],
    limitations: compEntry.limitations || [],
    openQuestions: compEntry.openQuestions || [],
    registered: compEntry.registered || { editor: false, runtime: false },
    usageCount: compEntry.usageCount || 0,
    inheritanceChain,
    baseClass,
    schemaFile,
    lineCount,
    properties,
    events,
    methods,
    headings: parsed.headings,
    htmlContent,
    usedInChapters: [],
    relatedFeatures: [],
    relatedComponents: [],
    searchText
  };
}

function parseGenericMarkdownDoc(docSpec, rootDir, context) {
  const fullPath = path.join(rootDir, docSpec.path);
  if (!fs.existsSync(fullPath)) return null;
  const raw = fs.readFileSync(fullPath, 'utf8').replace(/\r\n/g, '\n');
  const parsed = parseMarkdownBlocks(raw, { id: docSpec.id, defaultTitle: docSpec.title });
  const htmlContent = renderBlocksToHtml(parsed.blocks, context);
  const compMatches = Array.from(new Set(raw.match(/\bT[A-Z][a-zA-Z0-9]+\b/g) || [])).filter(c => context.knownComponents.has(c));
  const featMatches = Array.from(new Set(raw.match(/\bFEAT-\d{4}\b/g) || []));
  const searchText = raw.replace(/```[\s\S]*?```/g, ' ').replace(/[#>*`|_\[\]()]/g, ' ').replace(/\s+/g, ' ').trim();

  return {
    id: docSpec.id,
    title: docSpec.title || parsed.title,
    category: docSpec.category || 'Allgemein',
    path: docSpec.path,
    summary: docSpec.summary || (parsed.blocks.find(b => b.type === 'p')?.text || '').slice(0, 240),
    statusNote: parsed.statusNote,
    headings: parsed.headings,
    components: compMatches,
    features: featMatches,
    htmlContent,
    searchText
  };
}

function collectFeatureMarkdownDocs(featuresDir, rootDir, context) {
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
        }, rootDir, context);
        if (doc) {
          doc.title = doc.title.replace(/&amp;/g, '&');
          articles.push(doc);
        }
      }
    }
  };
  if (fs.existsSync(featuresDir)) walk(featuresDir);

  // Ergänze GCS_FEATURE_MAP.md als Use-Case-Wegweiser
  const featureMapDoc = parseGenericMarkdownDoc({
    id: 'feat-doc-feature-map',
    title: 'GCS Feature-Map & Use-Case-Wegweiser',
    category: 'ÜBERSICHT',
    path: 'docs/GCS_FEATURE_MAP.md',
    summary: 'Prosaischer Wegweiser durch die GCS-Funktionsbereiche und zugehörigen Use-Cases.'
  }, rootDir, context);
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
  const inventoryRaw = JSON.parse(fs.readFileSync(path.join(ROOT, config.sources.inventoryJson), 'utf8'));
  const actionMetaRaw = JSON.parse(fs.readFileSync(path.join(ROOT, config.sources.actionMetadataJson), 'utf8'));

  const knownComponents = new Set((inventoryRaw.components || []).map(c => c.name));
  const compIdToName = {};
  for (const c of inventoryRaw.components || []) {
    compIdToName[c.id] = c.name;
  }
  const parseContext = { knownComponents, compIdToName };

  // 1. Handbuch (23 Kapitel)
  const userGuideDir = path.join(ROOT, config.sources.userGuideDir);
  const chapters = CHAPTER_SPECS.map(spec => parseHandbookChapter(spec, userGuideDir, parseContext));

  // 2. Komponentenreferenz (128 Komponenten)
  const compDir = path.join(ROOT, config.sources.componentsDir);
  const components = (inventoryRaw.components || []).map(c => parseComponentMarkdown(c, compDir, parseContext));
  const compByName = {};
  components.forEach(c => { compByName[c.name] = c; });

  // Bidirektionale Verknüpfung: Kapitel <-> Komponenten
  for (const ch of chapters) {
    for (const cName of ch.components) {
      if (compByName[cName]) {
        compByName[cName].usedInChapters.push({
          id: ch.id,
          num: ch.num,
          shortTitle: ch.shortTitle
        });
      }
    }
  }

  // Verwandte Komponenten (Vererbung + gleiche Kategorie)
  for (const comp of components) {
    const rel = new Set();
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

  // Kategorien-Übersicht berechnen
  const categories = Object.values(CATEGORY_META)
    .map(cat => ({
      ...cat,
      count: components.filter(c => c.categoryKey === cat.id).length
    }))
    .filter(cat => cat.count > 0)
    .sort((a, b) => a.order - b.order);

  // 3. Feature-Katalog (12 Features + 12 Artikel)
  const featureArticles = collectFeatureMarkdownDocs(path.join(ROOT, config.sources.featuresDir), ROOT, parseContext);
  const features = (inventoryRaw.features || []).map(f => {
    const textBlob = [f.name, f.summary, f.notes, ...(f.sources || []), ...(f.relatedDocs || [])].join(' ');
    const linkedComponents = Array.from(knownComponents).filter(cName => textBlob.includes(cName));
    // Ordne passende Handbuch-Kapitel thematisch zu
    const linkedChapters = chapters
      .filter(ch => {
        if (f.category === 'editor' && ch.index <= 8) return true;
        if (f.category === 'runtime' && ch.index >= 5 && ch.index <= 14) return true;
        if (f.category === 'learning' && ch.part === 'B') return true;
        return ch.components.some(c => linkedComponents.includes(c));
      })
      .slice(0, 6)
      .map(ch => ({ id: ch.id, num: ch.num, shortTitle: ch.shortTitle }));

    linkedComponents.forEach(cName => {
      if (compByName[cName] && !compByName[cName].relatedFeatures.some(rf => rf.id === f.id)) {
        compByName[cName].relatedFeatures.push({ id: f.id, name: f.name });
      }
    });

    return {
      ...f,
      linkedComponents,
      linkedChapters
    };
  });

  // 4. Architektur-Dokumentation
  const archSpecs = [
    { id: 'overview', title: 'Systemarchitektur — Gesamtbild & Schichten', category: 'Kernarchitektur', path: 'docs/architecture/overview.md' },
    { id: 'module-map', title: 'Modulkarte & Verzeichnisstruktur (Module Map)', category: 'Kernarchitektur', path: 'docs/architecture/module-map.md' },
    { id: 'execution-flow', title: 'Ausführungsfluss (Editor → Runtime → Actions)', category: 'Laufzeit & Engine', path: 'docs/architecture/execution-flow.md' },
    { id: 'arch-readme', title: 'Architektur-Dokumentation — Konventionen & Überblick', category: 'Grundlagen', path: 'docs/architecture/README.md' }
  ];
  const architectureDocs = archSpecs.map(s => parseGenericMarkdownDoc(s, ROOT, parseContext)).filter(Boolean);

  // 5. Entwicklerreferenz (Guidelines, Runtime-Guide, Stage-Interfaces, TechDebt, Security, Actions, Doc-Inventory)
  const devRefArticles = config.sources.developerDocs
    .map(s => parseGenericMarkdownDoc(s, ROOT, parseContext))
    .filter(Boolean);
  const techDebtItems = parseTechnicalDebtItems(ROOT, parseContext);
  const actions = actionMetaRaw.types || [];
  const documentInventory = inventoryRaw.documents || [];

  // 6. Optionale SWE-2-Integration (Read-Only Overlay Merge nach kanonischer ID)
  const swe2Status = { enabled: config.swe2Integration.enabled, loadedOverlays: [] };
  for (const relOverlay of config.swe2Integration.optionalOverlayFiles || []) {
    const overlayPath = path.join(ROOT, relOverlay);
    if (fs.existsSync(overlayPath)) {
      try {
        const overlayData = JSON.parse(fs.readFileSync(overlayPath, 'utf8'));
        swe2Status.loadedOverlays.push({ file: relOverlay, keys: Object.keys(overlayData) });
      } catch (e) {
        swe2Status.loadedOverlays.push({ file: relOverlay, error: e.message });
      }
    }
  }

  // 7. Globaler Suchindex über alle Bereiche
  const searchIndex = [];

  chapters.forEach(ch => {
    searchIndex.push({
      area: 'handbook',
      areaLabel: '📖 Handbuch',
      id: ch.id,
      badge: `Kapitel ${ch.num}`,
      title: `${ch.num}: ${ch.shortTitle} — ${ch.title}`,
      subtitle: ch.group,
      href: `#handbook/${ch.id}`,
      keywords: [ch.id, ch.num, ch.shortTitle, ...ch.components, ...ch.headings.map(h => h.text)].join(' '),
      text: ch.searchText
    });
  });

  components.forEach(c => {
    searchIndex.push({
      area: 'components',
      areaLabel: '🧩 Komponente',
      id: c.name,
      badge: `${c.id} · ${c.categoryLabel}`,
      title: `${c.name}`,
      subtitle: c.summary.slice(0, 140),
      href: `#components/${c.name}`,
      keywords: [c.id, c.name, c.categoryLabel, c.baseClass, ...c.properties.map(p => p.name), ...c.events, ...c.methods].join(' '),
      text: c.searchText
    });
  });

  features.forEach(f => {
    searchIndex.push({
      area: 'features',
      areaLabel: '✨ Feature',
      id: f.id,
      badge: `${f.id} · ${f.category}`,
      title: `${f.id}: ${f.name}`,
      subtitle: f.summary.slice(0, 140),
      href: `#features/${f.id}`,
      keywords: [f.id, f.name, f.category, ...(f.sources || []), ...(f.linkedComponents || [])].join(' '),
      text: `${f.name} ${f.summary} ${f.notes || ''} ${(f.limitations || []).join(' ')}`
    });
  });

  featureArticles.forEach(fa => {
    searchIndex.push({
      area: 'features',
      areaLabel: '✨ Feature-Artikel',
      id: fa.id,
      badge: `Fachartikel · ${fa.category}`,
      title: fa.title,
      subtitle: fa.path,
      href: `#features/${fa.id}`,
      keywords: [fa.id, fa.title, fa.path, ...fa.components, ...fa.headings.map(h => h.text)].join(' '),
      text: fa.searchText
    });
  });

  architectureDocs.forEach(ad => {
    searchIndex.push({
      area: 'architecture',
      areaLabel: '🏛️ Architektur',
      id: ad.id,
      badge: ad.category,
      title: ad.title,
      subtitle: ad.path,
      href: `#architecture/${ad.id}`,
      keywords: [ad.id, ad.title, ad.path, ...ad.components, ...ad.headings.map(h => h.text)].join(' '),
      text: ad.searchText
    });
  });

  devRefArticles.forEach(dd => {
    searchIndex.push({
      area: 'devref',
      areaLabel: '🛠️ Entwickler',
      id: dd.id,
      badge: dd.category,
      title: dd.title,
      subtitle: dd.path,
      href: `#devref/${dd.id}`,
      keywords: [dd.id, dd.title, dd.path, ...dd.headings.map(h => h.text)].join(' '),
      text: dd.searchText
    });
  });

  actions.forEach(act => {
    const paramNames = (act.parameters || []).map(p => `${p.name} ${p.label || ''}`).join(' ');
    searchIndex.push({
      area: 'devref',
      areaLabel: '⚡ Action',
      id: `action-${act.type}`,
      badge: `Action · ${act.type}`,
      title: `${act.type} — ${act.label || act.type}`,
      subtitle: act.description || '',
      href: `#devref/actions?q=${encodeURIComponent(act.type)}`,
      keywords: `${act.type} ${act.label || ''} ${paramNames}`,
      text: `${act.type} ${act.label || ''} ${act.description || ''} ${paramNames}`
    });
  });

  const payload = {
    meta: {
      portalId: config.portalId,
      title: config.title,
      subtitle: config.subtitle,
      edition: config.edition,
      version: config.version,
      generatedAt: new Date().toISOString(),
      analysisCommit: inventoryRaw.meta?.analysisCommit || '53e3dfb',
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
        inventoryDocuments: documentInventory.length,
        searchEntries: searchIndex.length
      },
      swe2Integration: {
        ...config.swe2Integration,
        status: swe2Status
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
      documentInventory
    },
    searchIndex
  };

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, 'portal-data-argon.json'), JSON.stringify(payload, null, 2), 'utf8');
  fs.writeFileSync(
    path.join(DATA_DIR, 'portal-data-argon.js'),
    `// AUTOMATISCH GENERIERT durch build-argon.cjs — NICHT MANUELL EDITIEREN\nwindow.GCS_PORTAL_DATA_ARGON = ${JSON.stringify(payload).replace(/</g, '\\u003c')};\n`,
    'utf8'
  );

  console.log(
    `[build-argon] Portal-Daten erfolgreich erzeugt:\n` +
    `  - Handbuch:        ${payload.meta.counts.handbookChapters} Kapitel\n` +
    `  - Komponenten:     ${payload.meta.counts.components} (${payload.meta.counts.componentCardsMd} Markdown-Karten in ${payload.meta.counts.componentCategories} Kategorien)\n` +
    `  - Features:        ${payload.meta.counts.features} Haupt-Features + ${payload.meta.counts.featureArticles} Detailartikel\n` +
    `  - Architektur:     ${payload.meta.counts.architectureDocs} Dokumente\n` +
    `  - Entwicklerref.:  ${payload.meta.counts.devRefDocs} Doks, ${payload.meta.counts.actions} Actions, ${payload.meta.counts.techDebtItems} Tech-Debt-Einträge, ${payload.meta.counts.inventoryDocuments} Inventar-Dokumente\n` +
    `  - Suchindex:       ${payload.meta.counts.searchEntries} Einträge`
  );

  return payload;
}

if (require.main === module) {
  buildPortalData();
}

module.exports = { buildPortalData };

/**
 * import-swe2-argon.cjs — Verbindlicher SWE-2-Wissensbasis-Importer für das Argon-Portal.
 *
 * Hält sich strikt an docs/gcs-knowledge-swe2/SCHNITTSTELLE-ARGON.md:
 * 1. Liest zuerst knowledge-index-swe2.json (Manifest, schemaVersion, counts).
 * 2. Liest alle 9 Entity-Dateien unter entities/*-swe2.json (688 Entities).
 * 3. Nutzt ausschließlich die stabilen SWE-2-IDs (COMP-####, FEAT-####, ACT-####, MTH-####,
 *    EVT-####, SCM-####, GUIDE-####, DOC-####, CON-####) als primäre Join-Schlüssel.
 * 4. Ignoriert id-map-swe2.json (internes Artefakt laut Vertrag §3) und verändert keine SWE-2-Dateien.
 * 5. Liest chunks/chunks-swe2.jsonl (1.774 Chunks) für die globale Volltextsuche ein.
 */
const fs = require('node:fs');
const path = require('node:path');

function normalizeRelPath(p) {
  return String(p || '').replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonl(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  const items = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    items.push(JSON.parse(trimmed));
  }
  return items;
}

/**
 * Lädt die gesamte SWE-2-Wissensbasis und baut Nachschlagetabellen über stabile SWE-2-IDs auf.
 */
function loadSwe2KnowledgeBase(rootDir, swe2Config) {
  const manifestPath = path.join(rootDir, swe2Config.manifestFile);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`[import-swe2-argon] Manifest fehlt: ${manifestPath}`);
  }
  const manifest = readJson(manifestPath);

  const ef = swe2Config.entityFiles;
  const entities = {
    components: readJson(path.join(rootDir, ef.components)),
    features: readJson(path.join(rootDir, ef.features)),
    actionTypes: readJson(path.join(rootDir, ef.actionTypes)),
    methods: readJson(path.join(rootDir, ef.methods)),
    events: readJson(path.join(rootDir, ef.events)),
    schemas: readJson(path.join(rootDir, ef.schemas)),
    guideChapters: readJson(path.join(rootDir, ef.guideChapters)),
    documents: readJson(path.join(rootDir, ef.documents)),
    concepts: readJson(path.join(rootDir, ef.concepts))
  };

  const chunks = readJsonl(path.join(rootDir, swe2Config.chunksFile));

  // Primäre ID-Nachschlagetabelle (alle 688 Entities)
  const entityById = new Map();
  const compByName = new Map();
  const actionByName = new Map();
  const methodByName = new Map();
  const eventByName = new Map();
  const guideByDocPath = new Map();
  const docByPath = new Map();

  const registerAll = (list) => {
    for (const ent of list) {
      entityById.set(ent.id, ent);
    }
  };

  Object.values(entities).forEach(registerAll);

  for (const c of entities.components) {
    compByName.set(c.name, c);
  }
  for (const a of entities.actionTypes) {
    actionByName.set(a.name, a);
  }
  for (const m of entities.methods) {
    methodByName.set(m.name, m);
  }
  for (const ev of entities.events) {
    eventByName.set(ev.name, ev);
  }
  for (const g of entities.guideChapters) {
    const docPath = normalizeRelPath(g.sources?.docs?.[0]);
    if (docPath) guideByDocPath.set(docPath, g);
  }
  for (const d of entities.documents) {
    const docPath = normalizeRelPath(d.sources?.docs?.[0] || d.title);
    if (docPath) docByPath.set(docPath, d);
  }

  return {
    manifest,
    entities,
    chunks,
    entityById,
    compByName,
    actionByName,
    methodByName,
    eventByName,
    guideByDocPath,
    docByPath
  };
}

/**
 * Bestimmt für jede SWE-2-Entity die passende Portal-Route (#handbook, #components, #features, #architecture, #devref).
 * Beachtet strikt missing: true bei Dokumenten (Vertrag §2.3: keine Verlinkung auf gelöschte Dateien).
 */
function createRouteResolver(kb, portalRouteByDocPath) {
  function resolveEntityRoute(entity) {
    if (!entity) {
      return { href: '#home', area: 'devref', areaLabel: '🛠️ Referenz', linkable: false };
    }

    const kind = entity.kind;
    const id = entity.id;

    if (kind === 'component') {
      return {
        href: `#components/${id}`,
        altHref: `#components/${entity.name}`,
        area: 'components',
        areaLabel: '🧩 Komponente',
        linkable: true
      };
    }

    if (kind === 'feature') {
      return {
        href: `#features/${id}`,
        area: 'features',
        areaLabel: '✨ Feature',
        linkable: true
      };
    }

    if (kind === 'guide-chapter') {
      const docPath = normalizeRelPath(entity.sources?.docs?.[0]);
      const mappedHref = portalRouteByDocPath.get(docPath) || `#handbook/${id}`;
      return {
        href: mappedHref,
        altHref: `#handbook/${id}`,
        area: 'handbook',
        areaLabel: '📖 Handbuch',
        linkable: true
      };
    }

    if (kind === 'action-type') {
      return {
        href: `#devref/actions?q=${encodeURIComponent(id)}`,
        area: 'devref',
        areaLabel: '⚡ Action-Typ',
        linkable: true
      };
    }

    if (kind === 'method') {
      return {
        href: `#devref/methods?q=${encodeURIComponent(id)}`,
        area: 'devref',
        areaLabel: '🔧 Methode',
        linkable: true
      };
    }

    if (kind === 'event') {
      return {
        href: `#devref/events?q=${encodeURIComponent(id)}`,
        area: 'devref',
        areaLabel: '📡 Event',
        linkable: true
      };
    }

    if (kind === 'schema') {
      return {
        href: `#devref/schemas?q=${encodeURIComponent(id)}`,
        area: 'devref',
        areaLabel: '📐 Schema',
        linkable: true
      };
    }

    if (kind === 'concept') {
      const docPath = normalizeRelPath(entity.sources?.docs?.[0]);
      const mapped = docPath ? portalRouteByDocPath.get(docPath) : null;
      return {
        href: mapped || `#devref/concepts?q=${encodeURIComponent(id)}`,
        area: mapped && mapped.startsWith('#architecture') ? 'architecture' : 'devref',
        areaLabel: '💡 Konzept',
        linkable: true
      };
    }

    if (kind === 'document') {
      if (entity.missing === true) {
        // Vertrag §2.3: missing: true = Datei gelöscht → nicht auf Datei verlinken, sondern im Inventar als gelöscht ausweisen
        return {
          href: `#devref/doc-inventory?q=${encodeURIComponent(id)}`,
          area: 'devref',
          areaLabel: '🗑️ Gelöschtes Dokument',
          linkable: false,
          missing: true
        };
      }
      const docPath = normalizeRelPath(entity.sources?.docs?.[0] || entity.title);
      const mapped = docPath ? portalRouteByDocPath.get(docPath) : null;
      if (mapped) {
        let area = 'devref';
        let areaLabel = '📄 Dokument';
        if (mapped.startsWith('#handbook')) { area = 'handbook'; areaLabel = '📖 Handbuch'; }
        else if (mapped.startsWith('#components')) { area = 'components'; areaLabel = '🧩 Komponente'; }
        else if (mapped.startsWith('#features')) { area = 'features'; areaLabel = '✨ Feature-Doku'; }
        else if (mapped.startsWith('#architecture')) { area = 'architecture'; areaLabel = '🏛️ Architektur'; }
        return { href: mapped, area, areaLabel, linkable: true };
      }
      return {
        href: `#devref/doc-inventory?q=${encodeURIComponent(id)}`,
        area: 'devref',
        areaLabel: '🗂️ Dokumenten-Inventar',
        linkable: true
      };
    }

    return {
      href: `#devref/doc-inventory?q=${encodeURIComponent(id)}`,
      area: 'devref',
      areaLabel: '🛠️ Referenz',
      linkable: true
    };
  }

  /**
   * Löst das relations[]-Array einer SWE-2-Entity vollständig gegen entityById auf.
   */
  function resolveRelations(relationsArray) {
    const resolved = [];
    for (const rel of relationsArray || []) {
      const targetEnt = kb.entityById.get(rel.target);
      if (!targetEnt) {
        resolved.push({
          type: rel.type,
          target: rel.target,
          unresolved: true
        });
        continue;
      }
      const route = resolveEntityRoute(targetEnt);
      resolved.push({
        type: rel.type,
        target: targetEnt.id,
        targetKind: targetEnt.kind,
        targetName: targetEnt.name,
        targetTitle: targetEnt.title || targetEnt.name,
        targetStatusDev: targetEnt.status?.dev || 'implementiert',
        targetConfidence: targetEnt.provenance?.confidence || 'documented',
        targetMissing: Boolean(targetEnt.missing),
        href: route.href,
        linkable: route.linkable
      });
    }
    return resolved;
  }

  return {
    resolveEntityRoute,
    resolveRelations
  };
}

/**
 * Konvertiert alle 1.774 Chunks aus chunks/chunks-swe2.jsonl in durchsuchbare Portal-Sucheinträge
 * mit aufgelöster Ziel-Route, Quellenverweis, Entwicklungsstatus und Provenance-Confidence.
 */
function buildSearchIndexFromSwe2Chunks(kb, routeResolver) {
  const entries = [];

  for (const chunk of kb.chunks) {
    const entity = kb.entityById.get(chunk.entityId);
    const route = routeResolver.resolveEntityRoute(entity);
    const statusDev = chunk.metadata?.status?.dev || entity?.status?.dev || 'implementiert';
    const confidence = chunk.metadata?.confidence || entity?.provenance?.confidence || 'documented';
    const missing = Boolean(entity?.missing || chunk.metadata?.missing);
    const hidden = Boolean(entity?.flags?.hidden);
    const sourceDoc = normalizeRelPath(
      chunk.metadata?.sourceDoc ||
      chunk.metadata?.docs?.[0] ||
      entity?.sources?.docs?.[0] ||
      entity?.sources?.code?.[0] ||
      ''
    );

    const entityName = chunk.metadata?.name || entity?.name || chunk.entityId;
    const entityTitle = entity?.title && entity.title !== entityName ? `${entityName} (${entity.title})` : entityName;
    const headingLabel = chunk.headingPath && chunk.headingPath !== '_intro'
      ? ` › ${chunk.headingPath}`
      : '';

    const cleanText = String(chunk.text || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/[#>*`|_\[\]()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    entries.push({
      chunkId: chunk.chunkId,
      entityId: chunk.entityId,
      kind: chunk.kind,
      area: route.area,
      areaLabel: route.areaLabel,
      id: chunk.chunkId,
      badge: `${chunk.entityId}${chunk.metadata?.category ? ` · ${chunk.metadata.category}` : ''}`,
      title: `${entityTitle}${headingLabel}`,
      subtitle: sourceDoc || chunk.headingPath || chunk.section || '',
      href: route.href,
      linkable: route.linkable,
      sourceDoc,
      statusDev,
      confidence,
      missing,
      hidden,
      keywords: [
        chunk.entityId,
        entityName,
        entity?.title || '',
        chunk.metadata?.category || '',
        chunk.headingPath || '',
        sourceDoc
      ].join(' ').trim(),
      text: cleanText
    });
  }

  return entries;
}

module.exports = {
  normalizeRelPath,
  loadSwe2KnowledgeBase,
  createRouteResolver,
  buildSearchIndexFromSwe2Chunks
};

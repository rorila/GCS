/**
 * import-swe2-argon.cjs — Verbindlicher SWE-2-Wissensbasis-Importer für das Argon-Portal (Schema 1.1.0).
 *
 * Setzt die Anforderungen aus docs/gcs-knowledge-swe2/SCHNITTSTELLE-ARGON.md,
 * SCHNITTSTELLENAENDERUNGEN-SWE2.md und ARGON-REPARATURPLAN-SWE2.md (A03, A04, A05, A14, A15) um:
 * 1. Strikte Pfad-Begrenzung (Boundary-Check + realpathSync) auf das SWE-2-Snapshot-Verzeichnis (A15).
 * 2. Strikte SemVer-Prüfung (/^1\.\d+\.\d+$/) für schemaVersion (A04).
 * 3. SHA-256-Prüfsummen-Verifikation gegen manifest.checksums (Snapshot-Bindung, A04/A14).
 * 4. Strenge Validierung von Manifestzählern, Pflichtfeldern (id, kind, name, status.dev, provenance,
 *    version.extractedAt), Eindeutigkeit der Entity-IDs & Chunk-IDs sowie Relations-Auflösbarkeit (A04/A05).
 * 5. Kein unsicherer Fallback status.dev || "implementiert" (Abschnitt 6.3).
 * 6. Vollständiger Suchindex: 1 Basistreffer pro Entity (alle 693 Entities) + alle 1.774 Chunks mit
 *    opaken chunkIds (A03/A05).
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { validateSwe2Entity } = require('./validate-swe2-schema-argon.cjs');

const VALID_KINDS = new Set([
  'component', 'feature', 'action-type', 'method', 'event',
  'schema', 'guide-chapter', 'document', 'concept'
]);
const VALID_DEV_STATUS = new Set(['implementiert', 'geplant', 'veraltet', 'experimentell']);
const VALID_CONFIDENCE = new Set(['verified', 'documented', 'inferred']);
const ID_PATTERN = /^(COMP|FEAT|ACT|MTH|EVT|SCM|GUIDE|DOC|CON)-\d{4}$/;

function normalizeRelPath(p) {
  return String(p || '').replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

function normalizeDevStatus(dev) {
  const s = String(dev ?? '').trim().toLowerCase();
  if (VALID_DEV_STATUS.has(s)) return s;
  return 'unbekannt';
}

function normalizeConfidence(conf) {
  const c = String(conf ?? '').trim().toLowerCase();
  if (VALID_CONFIDENCE.has(c)) return c;
  return 'unbekannt';
}

function computeSha256(filePath) {
  const buf = fs.readFileSync(filePath);
  return 'sha256:' + crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * Stellt sicher, dass ein zu lesender Pfad strikt innerhalb des erlaubten SWE-2-Verzeichnisses liegt
 * und keine Traversierung (../) oder Symlink-Ausbrüche nach außen enthält (A15).
 */
function resolveWithinKnowledgeBoundary(knowledgeDirReal, rootDir, configuredOrManifestPath) {
  const raw = String(configuredOrManifestPath || '').trim();
  if (!raw) {
    throw new Error('[import-swe2-argon] Boundary-Fehler: Leerer Dateipfad in Konfiguration oder Manifest.');
  }
  const candidate = path.isAbsolute(raw)
    ? path.resolve(raw)
    : (raw.startsWith('docs/') || raw.startsWith('docs\\') || raw.startsWith('..')
        ? path.resolve(rootDir, raw)
        : path.resolve(knowledgeDirReal, raw));

  const prefix = knowledgeDirReal.endsWith(path.sep) ? knowledgeDirReal : knowledgeDirReal + path.sep;
  if (candidate !== knowledgeDirReal && !candidate.startsWith(prefix)) {
    throw new Error(`[import-swe2-argon] Boundary-Fehler: Pfad liegt außerhalb des erlaubten SWE-2-Verzeichnisses (${raw}).`);
  }
  if (!fs.existsSync(candidate)) {
    throw new Error(`[import-swe2-argon] Datei nicht gefunden: ${raw}`);
  }
  const realCandidate = fs.realpathSync(candidate);
  if (realCandidate !== knowledgeDirReal && !realCandidate.startsWith(prefix)) {
    throw new Error(`[import-swe2-argon] Boundary-Fehler (Symlink außerhalb SWE-2-Snapshot): ${raw}`);
  }
  return {
    fullPath: realCandidate,
    relToKnowledge: normalizeRelPath(path.relative(knowledgeDirReal, realCandidate))
  };
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
 * Validiert eine einzelne SWE-2-Entity strikt gegen den Schema-1.1.0-Datenvertrag (A04).
 */
function validateEntityContract(ent, expectedKind) {
  if (!ent || typeof ent !== 'object') {
    throw new Error('[import-swe2-argon] Ungültiger Entity-Eintrag (kein Objekt).');
  }
  if (typeof ent.id !== 'string' || !ID_PATTERN.test(ent.id)) {
    throw new Error(`[import-swe2-argon] Ungültige oder fehlende Entity-ID: ${String(ent.id)}`);
  }
  if (!VALID_KINDS.has(ent.kind) || (expectedKind && ent.kind !== expectedKind)) {
    throw new Error(`[import-swe2-argon] Ungültiges kind "${ent.kind}" bei Entity ${ent.id} (erwartet: ${expectedKind}).`);
  }
  if (typeof ent.name !== 'string' || !ent.name.trim()) {
    throw new Error(`[import-swe2-argon] Pflichtfeld name fehlt bei Entity ${ent.id}.`);
  }
  if (!ent.status || typeof ent.status !== 'object' || !VALID_DEV_STATUS.has(ent.status.dev)) {
    throw new Error(`[import-swe2-argon] Pflichtfeld status.dev fehlt oder ist ungültig ("${ent.status?.dev}") bei Entity ${ent.id}.`);
  }
  if (typeof ent.status.test !== 'string' || !ent.status.test.trim() || typeof ent.status.doc !== 'string' || !ent.status.doc.trim()) {
    throw new Error(`[import-swe2-argon] Pflichtfelder status.test / status.doc fehlen bei Entity ${ent.id}.`);
  }
  if (!ent.provenance || typeof ent.provenance !== 'object' || !VALID_CONFIDENCE.has(ent.provenance.confidence) || !Array.isArray(ent.provenance.method) || ent.provenance.method.length === 0) {
    throw new Error(`[import-swe2-argon] Pflichtfeld provenance (confidence/method) fehlt oder ist ungültig bei Entity ${ent.id}.`);
  }
  if (!ent.version || typeof ent.version !== 'object' || typeof ent.version.extractedAt !== 'string' || !ent.version.extractedAt.trim()) {
    throw new Error(`[import-swe2-argon] Pflichtfeld version.extractedAt fehlt bei Entity ${ent.id}.`);
  }
  if (typeof ent.version.contentHash !== 'string' || !ent.version.contentHash.startsWith('sha256:')) {
    throw new Error(`[import-swe2-argon] Pflichtfeld version.contentHash fehlt oder ist ungültig bei Entity ${ent.id}.`);
  }
  validateSwe2Entity(ent);
}

/**
 * Lädt und validiert die gesamte SWE-2-Wissensbasis (Manifest, Prüfsummen, 9 Entity-Dateien, Chunks).
 */
function loadSwe2KnowledgeBase(rootDir, swe2Config) {
  if (!swe2Config || typeof swe2Config !== 'object' || !swe2Config.manifestFile) {
    throw new Error('[import-swe2-argon]Ungültige swe2Config: manifestFile fehlt.');
  }

  const configuredKnowledgeDir = swe2Config.knowledgeDir
    ? path.resolve(rootDir, swe2Config.knowledgeDir)
    : path.dirname(path.resolve(rootDir, swe2Config.manifestFile));

  if (!fs.existsSync(configuredKnowledgeDir)) {
    throw new Error(`[import-swe2-argon] SWE-2-Verzeichnis existiert nicht: ${configuredKnowledgeDir}`);
  }
  const knowledgeDirReal = fs.realpathSync(configuredKnowledgeDir);

  const manifestResolved = resolveWithinKnowledgeBoundary(knowledgeDirReal, rootDir, swe2Config.manifestFile);
  const manifest = readJson(manifestResolved.fullPath);

  // 1. Strenge SemVer-Prüfung (A04: Major 1, Minor >= 0, Patch >= 0)
  const schemaVer = String(manifest.schemaVersion || '');
  if (!/^1\.\d+\.\d+$/.test(schemaVer)) {
    throw new Error(`[import-swe2-argon] Inkompatible SWE-2 schemaVersion: "${schemaVer}" (erwartet SemVer ^1.x.y).`);
  }

  if (!manifest.counts || typeof manifest.counts.entities !== 'number' || typeof manifest.counts.chunks !== 'number' || !manifest.counts.byKind) {
    throw new Error('[import-swe2-argon] Manifest unvollständig: counts.entities / counts.chunks / counts.byKind fehlt.');
  }

  if (!manifest.files || !manifest.files.entityFiles || typeof manifest.files.entityFiles !== 'object' || !manifest.files.chunks) {
    throw new Error('[import-swe2-argon] Manifest unvollständig: files.entityFiles oder files.chunks fehlt.');
  }

  if (!manifest.checksums || typeof manifest.checksums !== 'object' || Array.isArray(manifest.checksums)) {
    throw new Error('[import-swe2-argon] Manifest unvollständig: checksums fehlt (Snapshot-Bindung erforderlich).');
  }

  // 2. Prüfe optionale Konfigurationspfade gegen die Snapshot-Boundary und das Manifest (A15)
  const kindToConfigKey = {
    'component': 'components',
    'feature': 'features',
    'action-type': 'actionTypes',
    'method': 'methods',
    'event': 'events',
    'schema': 'schemas',
    'guide-chapter': 'guideChapters',
    'document': 'documents',
    'concept': 'concepts'
  };

  const resolvedEntityPaths = {};
  for (const [kind, cfgKey] of Object.entries(kindToConfigKey)) {
    const manifestRel = manifest.files.entityFiles[kind];
    if (!manifestRel) {
      throw new Error(`[import-swe2-argon] Manifest files.entityFiles enthält keinen Eintrag für "${kind}".`);
    }
    const cfgPath = swe2Config.entityFiles && swe2Config.entityFiles[cfgKey]
      ? swe2Config.entityFiles[cfgKey]
      : manifestRel;
    const resolved = resolveWithinKnowledgeBoundary(knowledgeDirReal, rootDir, cfgPath);
    if (resolved.relToKnowledge !== normalizeRelPath(manifestRel)) {
      throw new Error(`[import-swe2-argon] Boundary-/Manifest-Abweichung für ${kind}: "${resolved.relToKnowledge}" !== "${manifestRel}".`);
    }
    resolvedEntityPaths[cfgKey] = { kind, ...resolved };
  }

  const chunksCfgPath = swe2Config.chunksFile || manifest.files.chunks;
  const resolvedChunksPath = resolveWithinKnowledgeBoundary(knowledgeDirReal, rootDir, chunksCfgPath);
  if (resolvedChunksPath.relToKnowledge !== normalizeRelPath(manifest.files.chunks)) {
    throw new Error(`[import-swe2-argon] Boundary-/Manifest-Abweichung für chunks: "${resolvedChunksPath.relToKnowledge}" !== "${manifest.files.chunks}".`);
  }

  // A04: require coverage, not merely correctness of whichever checksums happen to exist.
  if (typeof manifest.files.idMap !== 'string' || !manifest.files.idMap.trim()) {
    throw new Error('[import-swe2-argon] Manifest unvollständig: files.idMap fehlt.');
  }
  const resolvedIdMap = resolveWithinKnowledgeBoundary(knowledgeDirReal, rootDir, manifest.files.idMap);
  const requiredFiles = [
    ...Object.values(resolvedEntityPaths).map(info => info.relToKnowledge),
    resolvedChunksPath.relToKnowledge,
    resolvedIdMap.relToKnowledge
  ];
  if (new Set(requiredFiles).size !== requiredFiles.length) {
    throw new Error('[import-swe2-argon] Manifest enthält mehrfach verwendete Nutzdateipfade.');
  }
  for (const relFile of requiredFiles) {
    if (!Object.prototype.hasOwnProperty.call(manifest.checksums, relFile)) {
      throw new Error(`[import-swe2-argon] Prüfsummenfehler: Pflicht-Prüfsumme für ${relFile} fehlt.`);
    }
  }

  // 3. Validate hash syntax and contents for all registered files, including additional ones.
  for (const [relFile, expectedHash] of Object.entries(manifest.checksums)) {
    if (typeof expectedHash !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(expectedHash)) {
      throw new Error(`[import-swe2-argon] Prüfsummenfehler: Ungültige SHA-256-Prüfsumme für ${relFile}.`);
    }
    const resolved = resolveWithinKnowledgeBoundary(knowledgeDirReal, rootDir, relFile);
    const actualHash = computeSha256(resolved.fullPath);
    if (actualHash !== expectedHash) {
      throw new Error(`[import-swe2-argon] Prüfsummenfehler für ${relFile}: erwartet ${expectedHash}, erhalten ${actualHash}.`);
    }
  }

  // 4. Alle 9 Entity-Dateien laden
  const entities = {};
  for (const [cfgKey, info] of Object.entries(resolvedEntityPaths)) {
    const arr = readJson(info.fullPath);
    if (!Array.isArray(arr)) {
      throw new Error(`[import-swe2-argon] Entity-Datei ${info.relToKnowledge} enthält kein JSON-Array.`);
    }
    entities[cfgKey] = arr;
  }

  // 5. Eindeutigkeit der Entity-IDs, Pflichtfelder und Manifest-Zähler prüfen (A04)
  const entityById = new Map();
  const actualByKind = {};
  for (const [kind, cfgKey] of Object.entries(kindToConfigKey)) {
    const list = entities[cfgKey];
    actualByKind[kind] = list.length;
    const expectedCount = manifest.counts.byKind[kind];
    if (typeof expectedCount !== 'number' || list.length !== expectedCount) {
      throw new Error(`[import-swe2-argon] Manifestzähler-Abweichung für "${kind}": Manifest=${expectedCount}, Ist=${list.length}.`);
    }
    for (const ent of list) {
      validateEntityContract(ent, kind);
      if (entityById.has(ent.id)) {
        throw new Error(`[import-swe2-argon] Doppelte Entity-ID erkannt: ${ent.id}.`);
      }
      entityById.set(ent.id, ent);
    }
  }

  if (entityById.size !== manifest.counts.entities) {
    throw new Error(`[import-swe2-argon] Manifestzähler-Abweichung (counts.entities): Manifest=${manifest.counts.entities}, Ist=${entityById.size}.`);
  }

  // 6. Relations-Integrität über alle Entities prüfen (A04: 0 unauflösbare Relationen erlaubt)
  for (const ent of entityById.values()) {
    for (const rel of ent.relations || []) {
      if (!rel || typeof rel.type !== 'string' || typeof rel.target !== 'string' || !entityById.has(rel.target)) {
        throw new Error(`[import-swe2-argon] Unauflösbare Relation bei ${ent.id}: ${rel?.type} -> ${rel?.target}.`);
      }
    }
  }

  // 7. Chunks laden und auf Eindeutigkeit der opaken chunkId sowie gültige entityId prüfen (A05)
  const chunks = readJsonl(resolvedChunksPath.fullPath);
  if (chunks.length !== manifest.counts.chunks) {
    throw new Error(`[import-swe2-argon] Manifestzähler-Abweichung (counts.chunks): Manifest=${manifest.counts.chunks}, Ist=${chunks.length}.`);
  }

  const seenChunkIds = new Set();
  for (const chk of chunks) {
    if (!chk || typeof chk.chunkId !== 'string' || !chk.chunkId.trim()) {
      throw new Error('[import-swe2-argon] Ungültiger Chunk ohne chunkId.');
    }
    if (seenChunkIds.has(chk.chunkId)) {
      throw new Error(`[import-swe2-argon] Doppelte chunkId erkannt: ${chk.chunkId}.`);
    }
    seenChunkIds.add(chk.chunkId);
    if (typeof chk.entityId !== 'string' || !entityById.has(chk.entityId)) {
      throw new Error(`[import-swe2-argon] Chunk ${chk.chunkId} verweist auf unbekannte entityId "${chk.entityId}".`);
    }
    if (typeof chk.text !== 'string') {
      throw new Error(`[import-swe2-argon] Chunk ${chk.chunkId} besitzt kein gültiges text-Feld.`);
    }
    if (!chk.metadata || typeof chk.metadata.sourceDoc !== 'string' || !chk.metadata.sourceDoc.trim()) {
      throw new Error(`[import-swe2-argon] Chunk ${chk.chunkId} besitzt kein Pflichtfeld metadata.sourceDoc.`);
    }
  }

  // Sekundäre Nachschlagetabellen
  const compByName = new Map(entities.components.map(c => [c.name, c]));
  const actionByName = new Map(entities.actionTypes.map(a => [a.name, a]));
  const methodByName = new Map(entities.methods.map(m => [m.name, m]));
  const eventByName = new Map(entities.events.map(ev => [ev.name, ev]));
  const guideByDocPath = new Map();
  for (const g of entities.guideChapters) {
    const docPath = normalizeRelPath(g.sources?.docs?.[0]);
    if (docPath) guideByDocPath.set(docPath, g);
  }
  const docByPath = new Map();
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
      return { href: '#home', catalogHref: '#home', area: 'devref', areaLabel: '🛠️ Referenz', linkable: false };
    }
    const { id, kind, name } = entity;

    if (kind === 'component') {
      return { href: `#components/${name}`, catalogHref: `#components/${name}`, area: 'components', areaLabel: '🧩 Komponente', linkable: true };
    }
    if (kind === 'feature') {
      return { href: `#features/${id}`, catalogHref: `#features/${id}`, area: 'features', areaLabel: '✨ Feature', linkable: true };
    }
    if (kind === 'guide-chapter') {
      const docPath = normalizeRelPath(entity.sources?.docs?.[0]);
      const mapped = portalRouteByDocPath.get(docPath) || `#handbook/${id}`;
      return { href: mapped, catalogHref: mapped, area: 'handbook', areaLabel: '📖 Handbuch', linkable: true };
    }
    if (kind === 'action-type') {
      const route = `#devref/actions?q=${encodeURIComponent(id)}`;
      return { href: route, catalogHref: route, area: 'devref', areaLabel: '⚡ Action-Typ', linkable: true };
    }
    if (kind === 'method') {
      const route = `#devref/methods?q=${encodeURIComponent(id)}`;
      return { href: route, catalogHref: route, area: 'devref', areaLabel: '🔧 Methode', linkable: true };
    }
    if (kind === 'event') {
      const route = `#devref/events?q=${encodeURIComponent(id)}`;
      return { href: route, catalogHref: route, area: 'devref', areaLabel: '🔔 Event', linkable: true };
    }
    if (kind === 'schema') {
      const compRel = (entity.relations || []).find(r => r.type === 'hasSchema' && r.target.startsWith('COMP-'));
      const targetComp = compRel ? kb.entityById.get(compRel.target) : null;
      const route = `#devref/schemas?q=${encodeURIComponent(id)}`;
      return {
        href: route,
        catalogHref: route,
        relatedComponentHref: targetComp ? `#components/${targetComp.name}` : null,
        area: 'devref',
        areaLabel: '📐 Schema',
        linkable: true
      };
    }
    if (kind === 'concept') {
      const docPath = normalizeRelPath(entity.sources?.docs?.[0]);
      const mapped = portalRouteByDocPath.get(docPath);
      const fallback = `#devref/schemas?q=${encodeURIComponent(id)}`;
      return {
        href: mapped || fallback,
        catalogHref: fallback,
        area: mapped && mapped.startsWith('#architecture') ? 'architecture' : 'devref',
        areaLabel: '💡 Konzept',
        linkable: true
      };
    }
    if (kind === 'document') {
      const catalogRoute = `#devref/doc-inventory?q=${encodeURIComponent(id)}`;
      if (entity.missing) {
        return {
          href: null,
          catalogHref: catalogRoute,
          area: 'devref',
          areaLabel: '🗑️ Dokument (gelöscht)',
          linkable: false
        };
      }
      const docPath = normalizeRelPath(entity.sources?.docs?.[0] || entity.title);
      const mapped = portalRouteByDocPath.get(docPath);
      return {
        href: mapped || catalogRoute,
        catalogHref: mapped || catalogRoute,
        area: mapped ? mapped.slice(1).split('/')[0] : 'devref',
        areaLabel: '📄 Dokument',
        linkable: true
      };
    }

    const defRoute = `#devref/doc-inventory?q=${encodeURIComponent(id)}`;
    return { href: defRoute, catalogHref: defRoute, area: 'devref', areaLabel: '🛠️ Referenz', linkable: true };
  }

  function resolveRelations(relationsArray) {
    const resolved = [];
    for (const rel of relationsArray || []) {
      const targetEnt = kb.entityById.get(rel.target);
      if (!targetEnt) {
        throw new Error(`[import-swe2-argon] Unauflösbare Relation: ${rel.type} -> ${rel.target}`);
      }
      const route = resolveEntityRoute(targetEnt);
      resolved.push({
        type: rel.type,
        target: targetEnt.id,
        targetKind: targetEnt.kind,
        targetName: targetEnt.name,
        targetTitle: targetEnt.title || targetEnt.name,
        targetStatusDev: normalizeDevStatus(targetEnt.status?.dev),
        targetConfidence: normalizeConfidence(targetEnt.provenance?.confidence),
        targetMissing: Boolean(targetEnt.missing),
        href: route.href,
        catalogHref: route.catalogHref,
        linkable: route.linkable
      });
    }
    return resolved;
  }

  return { resolveEntityRoute, resolveRelations };
}

/**
 * Erzeugt den vollständigen SWE-2-Suchindex (A03, A05, Abschnitt 5 & 6.2):
 * 1. Ein kanonischer Basistreffer (entryType: 'entity') für jede der 693 SWE-2-Entities (alle 9 Kategorien).
 * 2. Alle 1.774 RAG-Chunks (entryType: 'chunk') mit opaker chunkId.
 */
function buildSearchIndexFromSwe2Chunks(kb, routeResolver) {
  const entries = [];

  // 1. Basistreffer für alle 693 Entities (A03: garantiert ≥ 1 Suchdatensatz pro Entity)
  for (const entity of kb.entityById.values()) {
    const route = routeResolver.resolveEntityRoute(entity);
    const statusDev = normalizeDevStatus(entity.status?.dev);
    const confidence = normalizeConfidence(entity.provenance?.confidence);
    const missing = Boolean(entity.missing);
    const hidden = Boolean(entity.flags?.hidden);
    const sourceDoc = normalizeRelPath(
      entity.sources?.docs?.[0] ||
      entity.sources?.code?.[0] ||
      (entity.kind === 'document' ? entity.title : '') ||
      ''
    );

    const paramNames = Array.isArray(entity.parameters) ? entity.parameters.map(p => p.name).join(' ') : '';
    const propNames = entity.properties && typeof entity.properties === 'object' && !Array.isArray(entity.properties)
      ? Object.keys(entity.properties).join(' ')
      : '';
    const declaredBy = Array.isArray(entity.declaredBy) ? entity.declaredBy.join(' ') : '';

    const cleanDesc = String(entity.description || entity.title || entity.name || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const displayTitle = entity.title && entity.title !== entity.name
      ? `${entity.name} — ${entity.title}`
      : entity.name;

    entries.push({
      id: `ENT:${entity.id}`,
      chunkId: null,
      entityId: entity.id,
      entryType: 'entity',
      kind: entity.kind,
      area: route.area,
      areaLabel: route.areaLabel,
      badge: `${entity.id} · ${entity.category || entity.kind}`,
      title: displayTitle,
      subtitle: sourceDoc || `Basistreffer (${entity.kind})`,
      href: route.catalogHref || route.href || `#devref/doc-inventory?q=${encodeURIComponent(entity.id)}`,
      linkable: route.linkable,
      sourceDoc,
      statusDev,
      confidence,
      missing,
      hidden,
      keywords: [
        entity.id,
        entity.name,
        entity.title || '',
        entity.kind,
        entity.category || '',
        paramNames,
        propNames,
        declaredBy,
        sourceDoc
      ].join(' ').trim(),
      text: cleanDesc || `${entity.id} ${displayTitle}`
    });
  }

  // 2. RAG-Chunk-Treffer aus chunks/chunks-swe2.jsonl (chunkId wird strikt opak behandelt, A05)
  for (const chunk of kb.chunks) {
    const entity = kb.entityById.get(chunk.entityId);
    const route = routeResolver.resolveEntityRoute(entity);
    const statusDev = normalizeDevStatus(chunk.metadata?.status?.dev ?? entity?.status?.dev);
    const confidence = normalizeConfidence(chunk.metadata?.confidence ?? entity?.provenance?.confidence);
    const missing = Boolean(entity?.missing || chunk.metadata?.missing);
    const hidden = Boolean(entity?.flags?.hidden);
    const sourceDoc = normalizeRelPath(chunk.metadata?.sourceDoc || entity?.sources?.docs?.[0] || '');

    const entityName = chunk.metadata?.name || entity?.name || chunk.entityId;
    const entityTitle = entity?.title && entity.title !== entityName ? `${entityName} (${entity.title})` : entityName;
    const headingLabel = chunk.headingPath && chunk.headingPath !== '_intro'
      ? ` › ${chunk.headingPath}`
      : '';

    const cleanText = String(chunk.text ?? '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/[#>*`|_\[\]()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    entries.push({
      id: chunk.chunkId,
      chunkId: chunk.chunkId,
      entityId: chunk.entityId,
      entryType: 'chunk',
      kind: chunk.kind,
      area: route.area,
      areaLabel: route.areaLabel,
      badge: `${chunk.entityId}${chunk.metadata?.category ? ` · ${chunk.metadata.category}` : ''}`,
      title: `${entityTitle}${headingLabel}`,
      subtitle: sourceDoc || chunk.headingPath || chunk.section || '',
      href: route.catalogHref || route.href || `#devref/doc-inventory?q=${encodeURIComponent(chunk.entityId)}`,
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
      text: cleanText || `${chunk.entityId} ${entityTitle}`
    });
  }

  return entries;
}

module.exports = {
  normalizeRelPath,
  normalizeDevStatus,
  normalizeConfidence,
  computeSha256,
  resolveWithinKnowledgeBoundary,
  validateEntityContract,
  loadSwe2KnowledgeBase,
  createRouteResolver,
  buildSearchIndexFromSwe2Chunks
};

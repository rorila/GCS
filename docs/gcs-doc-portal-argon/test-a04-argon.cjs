/** Focused A04 regressions. Each semantic mutation receives a fresh valid checksum. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { loadSwe2KnowledgeBase, computeSha256 } = require('./import-swe2-argon.cjs');

const ROOT = path.resolve(__dirname, '../..');
const SOURCE = path.join(ROOT, 'docs/gcs-knowledge-swe2');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const sourceManifest = read(path.join(SOURCE, 'knowledge-index-swe2.json'));
const componentFile = sourceManifest.files.entityFiles.component;

test('A04: vollständige Snapshot-Bindung und Schemafelder', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gcs-a04-'));
  const cfg = { knowledgeDir: dir, manifestFile: path.join(dir, 'knowledge-index-swe2.json') };
  const saved = new Map();
  const files = [...Object.values(sourceManifest.files.entityFiles), sourceManifest.files.chunks, sourceManifest.files.idMap];
  for (const name of files) saved.set(name, fs.readFileSync(path.join(SOURCE, name)));
  function restore() {
    for (const [name, bytes] of saved) {
      fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
      fs.writeFileSync(path.join(dir, name), bytes);
    }
    fs.writeFileSync(cfg.manifestFile, JSON.stringify(sourceManifest));
  }
  function updateManifest(mutate) {
    const manifest = read(cfg.manifestFile);
    mutate(manifest);
    fs.writeFileSync(cfg.manifestFile, JSON.stringify(manifest));
  }
  function updateEntity(mutate) {
    const file = path.join(dir, componentFile), entities = read(file);
    mutate(entities[0]);
    fs.writeFileSync(file, JSON.stringify(entities));
    updateManifest(m => { m.checksums[componentFile] = computeSha256(file); });
  }
  async function rejected(label, mutate) {
    await t.test(label, () => {
      restore(); mutate();
      assert.throws(() => loadSwe2KnowledgeBase(ROOT, cfg), /\[import-swe2-argon\]/);
    });
  }
  try {
    await t.test('Gültiger Schema-1.1.0-Snapshot wird unverändert importiert', () => {
      restore();
      const kb = loadSwe2KnowledgeBase(ROOT, cfg);
      assert.equal(kb.entityById.size, sourceManifest.counts.entities);
      assert.equal(kb.chunks.length, sourceManifest.counts.chunks);
    });
    for (const [label, value] of [['leer', {}], ['null', null], ['Array', []], ['String', ''], ['Array mit Werten', ['x']]]) {
      await rejected(`checksums ${label}`, () => updateManifest(m => { m.checksums = value; }));
    }
    await rejected('checksums fehlt', () => updateManifest(m => { delete m.checksums; }));
    await rejected('Geänderte Nutzdaten und checksums={} (ursprünglicher Bypass)', () => {
      updateEntity(e => { e.description = 'A04: nicht gebundene Änderung'; });
      updateManifest(m => { m.checksums = {}; });
    });
    // Every one of the nine entity files, the chunks file and the ID map is mandatory.
    for (const file of files) await rejected(`Pflicht-Prüfsumme fehlt: ${file}`, () => updateManifest(m => { delete m.checksums[file]; }));
    for (const value of ['', null, 42, {}, [], 'abc', 'sha256:1234', 'sha256:' + 'g'.repeat(64), 'sha1:' + '0'.repeat(64)]) {
      await rejected(`Ungültiger Hash: ${JSON.stringify(value)}`, () => updateManifest(m => { m.checksums[componentFile] = value; }));
    }
    await rejected('Formal gültiger, aber falscher Hash', () => updateManifest(m => { m.checksums[componentFile] = 'sha256:' + '0'.repeat(64); }));
    await rejected('Zusätzliche Prüfsumme darf nicht ungeprüft bleiben', () => updateManifest(m => { m.checksums[sourceManifest.files.idMap] = 'sha256:' + '0'.repeat(64); }));
    await rejected('files.idMap fehlt', () => updateManifest(m => { delete m.files.idMap; }));
    for (const keys of [
      ['id'], ['kind'], ['name'], ['status'], ['sources'], ['provenance'], ['version'],
      ['status','dev'], ['status','test'], ['status','doc'],
      ['provenance','method'], ['provenance','confidence'], ['version','extractedAt'], ['version','contentHash']
    ]) {
      await rejected(`Schema-Pflichtfeld fehlt: ${keys.join('.')}`, () => updateEntity(e => {
        let target = e; for (const key of keys.slice(0, -1)) target = target[key]; delete target[keys.at(-1)];
      }));
    }
    const mutations = [
      ['provenance.facts fehlt', e => { delete e.provenance.facts; }],
      ['provenance.facts leer', e => { e.provenance.facts = {}; }],
      ['provenance.facts Array', e => { e.provenance.facts = []; }],
      ['provenance.facts ungültiger Wert', e => { e.provenance.facts = { status: 'AUDIT-INVALID' }; }],
      ['confidence != max(facts)', e => { e.provenance.facts = { status: 'inferred' }; e.provenance.confidence = 'verified'; }],
      ['status.test ungültig', e => { e.status.test = 'AUDIT-INVALID'; }],
      ['status.doc ungültig', e => { e.status.doc = 'AUDIT-INVALID'; }],
      ['provenance.method ungültig', e => { e.provenance.method = ['code']; }],
      ['sources falscher Typ', e => { e.sources = []; }],
      ['sources.docs falscher Elementtyp', e => { e.sources.docs = [42]; }],
      ['events.name fehlt', e => { e.events = [{ origin: 'own' }]; }],
      ['Event-Bedingung ohne guard', e => { e.events = [{ name: 'onTest', conditions: [{ availableWhen: false }] }]; }],
      ['Event-Bedingung ohne availableWhen', e => { e.events = [{ name: 'onTest', conditions: [{ guard: 'isHiddenInRun' }] }]; }],
      ['Event-Bedingung kein Boolean', e => { e.events = [{ name: 'onTest', conditions: [{ guard: 'isHiddenInRun', availableWhen: 'false' }] }]; }],
      ['methods.name fehlt', e => { e.methods = [{}]; }],
      ['parameters.name fehlt', e => { e.parameters = [{ type: 'number' }]; }],
      ['parameters.type fehlt', e => { e.parameters = [{ name: 'duration' }]; }],
      ['relations.type fehlt', e => { e.relations = [{ target: 'COMP-0001' }]; }],
      ['relations.target fehlt', e => { e.relations = [{ type: 'seeAlso' }]; }],
      ['Property-Konfidenz ungültig', e => { e.properties = { test: { type: 'string', confidence: 'AUDIT-INVALID' } }; }]
    ];
    for (const [label, mutate] of mutations) await rejected(label, () => updateEntity(mutate));
    await t.test('Additive Entity-Felder bleiben erlaubt', () => {
      restore(); updateEntity(e => { e.futureAnnotation = { note: 'additive minor change' }; });
      assert.equal(loadSwe2KnowledgeBase(ROOT, cfg).entityById.size, sourceManifest.counts.entities);
    });
    await t.test('Keine Mutation der Original-Nutzdateien', () => {
      for (const [name, bytes] of saved) assert.deepEqual(fs.readFileSync(path.join(SOURCE, name)), bytes);
    });
  } finally {
    // Only delete this test's own, resolved temporary child directory.
    const tempRoot = path.resolve(os.tmpdir()) + path.sep;
    if (!path.resolve(dir).startsWith(tempRoot) || !path.basename(dir).startsWith('gcs-a04-')) throw new Error('Unexpected cleanup path');
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

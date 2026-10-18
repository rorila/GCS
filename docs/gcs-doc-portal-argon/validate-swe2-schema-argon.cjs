/** Validate the declarative keywords used by the canonical SWE-2 entity schema.
 * No dependency installation or schema mutation; unsupported validation keywords fail closed.
 */
const fs = require('node:fs');
const path = require('node:path');
const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const keywords = new Set(['type', 'enum', 'pattern', 'required', 'properties', 'items', 'additionalProperties']);
const annotations = new Set(['$schema', '$id', '$comment', 'title', 'description', 'default', 'examples', 'x-schemaVersion']);

function checkSchema(schema, location = 'schema') {
  if (typeof schema === 'boolean') return;
  if (!isObject(schema)) throw new Error(`[import-swe2-argon] Ungültiges Schema bei ${location}.`);
  for (const key of Object.keys(schema)) {
    if (!keywords.has(key) && !annotations.has(key)) {
      throw new Error(`[import-swe2-argon] Nicht unterstütztes Schema-Schlüsselwort ${location}.${key}; Import abgebrochen.`);
    }
  }
  for (const [key, value] of Object.entries(schema.properties || {})) checkSchema(value, `${location}.${key}`);
  if (schema.items !== undefined) checkSchema(schema.items, `${location}.items`);
  if (schema.additionalProperties !== undefined) checkSchema(schema.additionalProperties, `${location}.additionalProperties`);
}

function validateValue(value, schema, location) {
  const fail = message => { throw new Error(`[import-swe2-argon] Schemafehler ${location}: ${message}`); };
  if (schema === true) return;
  if (schema === false) fail('nicht zulässig.');
  if (schema.type) {
    const matches = schema.type === 'object' ? isObject(value)
      : schema.type === 'array' ? Array.isArray(value)
      : schema.type === 'null' ? value === null
      : schema.type === 'integer' ? Number.isInteger(value)
      : schema.type === 'number' ? typeof value === 'number' && Number.isFinite(value)
      : typeof value === schema.type;
    if (!matches) fail(`Typ ${schema.type} erwartet.`);
  }
  if (schema.enum && !schema.enum.some(item => JSON.stringify(item) === JSON.stringify(value))) fail('ungültiger Enum-Wert.');
  if (typeof value === 'string' && schema.pattern && !new RegExp(schema.pattern).test(value)) fail('Muster nicht erfüllt.');
  if (isObject(value)) {
    for (const key of schema.required || []) if (!has(value, key)) fail(`Pflichtfeld ${key} fehlt.`);
    for (const [key, field] of Object.entries(value)) {
      if (has(schema.properties || {}, key)) validateValue(field, schema.properties[key], `${location}.${key}`);
      else if (schema.additionalProperties !== undefined) validateValue(field, schema.additionalProperties, `${location}.${key}`);
    }
  }
  if (Array.isArray(value) && schema.items !== undefined) value.forEach((item, index) => validateValue(item, schema.items, `${location}[${index}]`));
}

// Trusted repository schema, not a schema supplied by a potentially malformed snapshot.
const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '../gcs-knowledge-swe2/knowledge-schema-swe2.json'), 'utf8'));
checkSchema(schema);

function validateSwe2Entity(entity) {
  validateValue(entity, schema, entity.id || 'Entity');
  // Schema 1.1.0's documented semantic invariant, also enforced by the SWE-2 validator.
  const facts = entity.provenance.facts;
  if (!isObject(facts) || !Object.keys(facts).length) {
    throw new Error(`[import-swe2-argon] Pflichtfeld provenance.facts fehlt oder ist leer bei ${entity.id}.`);
  }
  const rank = { inferred: 0, documented: 1, verified: 2 };
  const maximum = Math.max(...Object.values(facts).map(value => rank[value]));
  if (rank[entity.provenance.confidence] !== maximum) {
    throw new Error(`[import-swe2-argon] confidence != max(provenance.facts) bei ${entity.id}.`);
  }
}

module.exports = { validateSwe2Entity };

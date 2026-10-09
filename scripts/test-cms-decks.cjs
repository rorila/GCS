// Kartenstapel-Tests: verwaltete Stapel (Erwachsene), Zuordnung an Kinder,
// Übernahme mit Dedup/Nachladen, Kind-Stapel mit Erwachsenen-Freigabe und
// Haus-Sichtbarkeit — auf Modulebene, ohne HTTP-Server.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert');
const { createJsonStore } = require('./cms/cms-store.cjs');
const { createCore } = require('./cms/cms-core.cjs');
const { loadRuntime } = require('./cms/cms-runtime.cjs');
const { buildDb } = require('./cms/cms-seed-testdata.cjs');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-decks-'));
const dataPath = path.join(dir, 'cms.json');
fs.writeFileSync(dataPath, JSON.stringify(buildDb()));
const store = createJsonStore({ dataPath });
const core = createCore(store.load());
const db = core.db;
const rt = loadRuntime(path.join(__dirname, '../game-server/public/projects/GCS-CMS.json'));
const commit = (s, action, areaId, change, opts) => store.commit(db, { actor: s.personId, action, areaId, ...opts }, change);

const results = [];
const check = (name, fn) => Promise.resolve().then(fn).then(() => results.push(['OK', name])).catch(e => results.push(['FEHLER', name + ' :: ' + e.message]));
const child = id => ({ personId: id, assurance: 'profile' });
const account = id => core.session(core.issueSession(id, 'account'));
const admin = (id, areaId, role = 'areaAdmin') => ({ personId: id, assurance: 'admin', activeRole: { role, areaId } });
const api = (sess, route, body = {}) => rt.run(rt.find('/api/cms/decks/' + route, 'POST'), { session: sess, body, core, commit }, { strict: true });
const boxOf = childId => db.flashcards.filter(c => c.childId === childId && c.active);

(async () => {

// --- Verwalteter Stapel: anlegen → Karten → veröffentlichen → zuordnen ---
let deckA;
await check('deckSave: HouseAdmin legt Stapel an', () => {
  const r = api(admin('admin-sun', 'house-sun'), 'save', { name: 'Einmaleins 2er', subject: 'Mathe', description: 'Zweierreihe' });
  assert.strictEqual(r.status, 200, JSON.stringify(r.data));
  deckA = r.data.deckId;
  const d = db.cardDecks.find(x => x.id === deckA);
  assert.strictEqual(d.ownerType, 'account');
  assert.strictEqual(d.published, false);
});

await check('deckCardSave: zwei Stapelkarten angelegt', () => {
  assert.strictEqual(api(admin('admin-sun', 'house-sun'), 'card-save', { deckId: deckA, question: '1x2', subject: 'Mathe', topic: '2er', answers: '2' }).status, 200);
  assert.strictEqual(api(admin('admin-sun', 'house-sun'), 'card-save', { deckId: deckA, question: '2x2', subject: 'Mathe', topic: '2er', answers: '4' }).status, 200);
  assert.strictEqual(db.flashcards.filter(c => c.deckId === deckA).length, 2);
});

await check('decks: unveröffentlichter Stapel für Kind unsichtbar', () => {
  const r = api(child('child-finn'), 'list', {});
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.items.length, 0);
});

await check('deckPublish: HouseAdmin veröffentlicht', () => {
  const r = api(admin('admin-sun', 'house-sun'), 'publish', { deckId: deckA, publish: true });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(db.cardDecks.find(d => d.id === deckA).published, true);
});

await check('decks: veröffentlicht, aber nicht zugeordnet → unsichtbar', () => {
  assert.strictEqual(api(child('child-finn'), 'list', {}).data.items.length, 0);
});

await check('deckAssignables: HouseAdmin sieht Hauskinder', () => {
  const r = api(admin('admin-sun', 'house-sun'), 'assignables', { deckId: deckA });
  assert.strictEqual(r.status, 200);
  assert.ok(r.data.items.some(i => i.id === 'child-finn' && i.canAssign), 'finn zuordbar');
  assert.ok(!r.data.items.some(i => i.id === 'child-mia'), 'mia (Haus Mond) nicht dabei');
});

await check('deckAssign: HouseAdmin ordnet child-finn zu — Karten landen sofort in Fach 1', () => {
  const r = api(admin('admin-sun', 'house-sun'), 'assign', { deckId: deckA, childId: 'child-finn', assign: true });
  assert.strictEqual(r.status, 200, JSON.stringify(r.data));
  assert.strictEqual(r.data.added, 2);
  const kopien = boxOf('child-finn').filter(c => c.sourceDeckId === deckA);
  assert.strictEqual(kopien.length, 2);
  assert.ok(kopien.every(c => c.box === 1 && c.sourceCardId), 'Fach 1 + sourceCardId');
});

await check('decks: zugeordneter Stapel sichtbar (Kind)', () => {
  const r = api(child('child-finn'), 'list', {});
  assert.strictEqual(r.data.items.length, 1);
  assert.strictEqual(r.data.items[0].cardCount, 2);
  assert.strictEqual(r.data.items[0].newCards, 0, 'durch die Zuordnung bereits importiert');
});

await check('deckCards: Vorschau der Stapelkarten', () => {
  const r = api(child('child-finn'), 'cards', { deckId: deckA });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.items.length, 2);
});

// --- Übernahme: Dedup nach Zuordnung, Nachladen ---
await check('deckImport: erneut nach Zuordnung → added 0 (Dedup)', () => {
  const r = api(child('child-finn'), 'import', { deckId: deckA });
  assert.strictEqual(r.status, 200, JSON.stringify(r.data));
  assert.strictEqual(r.data.added, 0);
});

await check('Nachladen: neue Stapelkarte → nur diese kommt nach', () => {
  api(admin('admin-sun', 'house-sun'), 'card-save', { deckId: deckA, question: '3x2', subject: 'Mathe', topic: '2er', answers: '6' });
  const liste = api(child('child-finn'), 'list', {}).data.items.find(i => i.id === deckA);
  assert.strictEqual(liste.newCards, 1, 'eine neue Karte gemeldet');
  const r = api(child('child-finn'), 'import', { deckId: deckA });
  assert.strictEqual(r.data.added, 1);
  assert.strictEqual(boxOf('child-finn').filter(c => c.sourceDeckId === deckA).length, 3);
});

await check('deckImport: nicht zugeordnetes Kind → 403', () => {
  assert.strictEqual(api(child('child-lina'), 'import', { deckId: deckA }).status, 403);
});

// --- Eltern-Stapel: anlegen, eigenem Kind zuordnen, fremdes Kind gesperrt ---
let deckP;
await check('deckSave: Eltern legen eigenen Stapel an', () => {
  const r = api(account('parent-multi'), 'save', { name: 'Englisch Tiere', subject: 'Englisch' });
  assert.strictEqual(r.status, 200, JSON.stringify(r.data));
  deckP = r.data.deckId;
  api(account('parent-multi'), 'card-save', { deckId: deckP, question: 'dog', subject: 'Englisch', topic: 'Tiere', answers: 'Hund' });
});

await check('deckAssign: Eltern ordnen eigenem Kind zu (auch unveröffentlicht)', () => {
  const r = api(account('parent-multi'), 'assign', { deckId: deckP, childId: 'child-emil', assign: true });
  assert.strictEqual(r.status, 200, JSON.stringify(r.data));
});

await check('deckAssign: Eltern können fremdem Kind nichts zuordnen (403)', () => {
  assert.strictEqual(api(account('parent-multi'), 'assign', { deckId: deckP, childId: 'child-lina', assign: true }).status, 403);
});

await check('decks: Eltern-Stapel erst nach Veröffentlichung sichtbar', () => {
  assert.strictEqual(api(child('child-emil'), 'list', {}).data.items.length, 0, 'Entwurf unsichtbar');
  api(account('parent-multi'), 'publish', { deckId: deckP, publish: true });
  const r = api(child('child-emil'), 'list', {});
  assert.strictEqual(r.data.items.length, 1);
});

// --- Kind-Stapel: Thema teilen → Freigabe durch Erwachsene → Haus-Sicht ---
const cardsApi = (sess, route, body = {}) => rt.run(rt.find('/api/cms/cards/' + route, 'POST'), { session: sess, body, core, commit }, { strict: true });
let deckK;
await check('deckFromTopic: Kind teilt Kasten-Thema als Stapel', () => {
  cardsApi(child('child-finn'), 'save', { subject: 'Sachkunde', topic: 'Wetter', question: 'Regen?', answers: 'Wasser' });
  cardsApi(child('child-finn'), 'save', { subject: 'Sachkunde', topic: 'Wetter', question: 'Schnee?', answers: 'Eis' });
  const r = api(child('child-finn'), 'from-topic', { subject: 'Sachkunde', topic: 'Wetter' });
  assert.strictEqual(r.status, 200, JSON.stringify(r.data));
  deckK = r.data.deckId;
  assert.strictEqual(r.data.cardCount, 2);
  assert.strictEqual(db.cardDecks.find(d => d.id === deckK).ownerType, 'child');
});

await check('decks: eigener Entwurf nur für das Kind selbst sichtbar', () => {
  const items = api(child('child-finn'), 'list', {}).data.items;
  assert.strictEqual(items.length, 2, 'zugeordneter Stapel + eigener Entwurf');
  assert.strictEqual(items.find(i => i.id === deckK)?.own, true, 'eigener Stapel markiert');
  assert.ok(!api(child('child-lina'), 'list', {}).data.items.some(i => i.id === deckK), 'Hauskind sieht Entwurf nicht');
});

await check('deckPublish: Kind beantragt Freigabe (pendingApproval)', () => {
  const r = api(child('child-finn'), 'publish', { deckId: deckK, publish: true });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(db.cardDecks.find(d => d.id === deckK).pendingApproval, true);
  assert.strictEqual(db.cardDecks.find(d => d.id === deckK).published, false);
});

await check('decks: angefragter Stapel bleibt für Hauskinder unsichtbar', () => {
  assert.ok(!api(child('child-lina'), 'list', {}).data.items.some(i => i.id === deckK));
});

await check('decksManage: Erziehungsberechtigte sehen die Freigabe-Anfrage', () => {
  const r = api(account('parent-multi'), 'manage', {});
  assert.strictEqual(r.status, 200);
  const offen = r.data.items.find(i => i.id === deckK);
  assert.ok(offen && offen.canApprove, 'Freigabe für parent-multi möglich');
});

await check('deckApprove: fremde Eltern dürfen nicht freigeben (403)', () => {
  assert.strictEqual(api(account('parent-lina'), 'approve', { deckId: deckK, approve: true }).status, 403);
});

await check('deckApprove: Erziehungsberechtigte gibt frei → veröffentlicht', () => {
  const r = api(account('parent-multi'), 'approve', { deckId: deckK, approve: true });
  assert.strictEqual(r.status, 200, JSON.stringify(r.data));
  const d = db.cardDecks.find(x => x.id === deckK);
  assert.strictEqual(d.published, true);
  assert.strictEqual(d.pendingApproval, false);
});

await check('decks: freigegebener Kind-Stapel für Hauskinder sichtbar', () => {
  assert.ok(api(child('child-lina'), 'list', {}).data.items.some(i => i.id === deckK), 'child-lina (Haus Sonne) sieht ihn');
  assert.ok(!api(child('child-mia'), 'list', {}).data.items.some(i => i.id === deckK), 'child-mia (Haus Mond) sieht ihn nicht');
});

await check('deckImport: Hauskind übernimmt freigegebenen Kind-Stapel', () => {
  const r = api(child('child-lina'), 'import', { deckId: deckK });
  assert.strictEqual(r.data.added, 2);
  assert.strictEqual(boxOf('child-lina').filter(c => c.sourceDeckId === deckK).length, 2);
});

await check('deckCardSave: veröffentlichter Kind-Stapel ist für das Kind eingefroren (403)', () => {
  assert.strictEqual(api(child('child-finn'), 'card-save', { deckId: deckK, question: 'Neblig?', subject: 'Sachkunde', answers: 'Nebel' }).status, 403);
});

await check('deckCards: fremdes Haus darf Stapelkarten nicht sehen (403)', () => {
  assert.strictEqual(api(child('child-mia'), 'cards', { deckId: deckK }).status, 403);
});

// --- Löschen ---
await check('deckRemove: HouseAdmin löscht verwalteten Stapel', () => {
  const r = api(admin('admin-sun', 'house-sun'), 'delete', { deckId: deckA });
  assert.strictEqual(r.status, 200);
  assert.ok(!api(child('child-finn'), 'list', {}).data.items.some(i => i.id === deckA), 'weg aus der Galerie');
});

await check('deckRemove: fremder Stapel nicht löschbar (403)', () => {
  assert.strictEqual(api(account('parent-lina'), 'delete', { deckId: deckP }).status, 403);
});

console.log('\n--- Kartenstapel-Tests ---');
let fail = 0;
for (const [st, name] of results) { if (st === 'FEHLER') fail++; console.log(st.padEnd(6), name); }
console.log(`\n${results.length - fail}/${results.length} bestanden`);
process.exit(fail ? 1 : 0);
})();

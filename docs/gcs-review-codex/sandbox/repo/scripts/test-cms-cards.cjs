// Karteikasten-Tests (Leitner, Phase Karten): persönliche Kästen, Berechtigungen,
// Übergänge Fach 1–6, deklarative Ziehregel (je Fach älteste zuerst),
// Format-Filter und excludeIds — auf Modulebene, ohne HTTP-Server.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert');
const { createJsonStore } = require('./cms/cms-store.cjs');
const { createCore } = require('./cms/cms-core.cjs');
const { createPlay } = require('./cms/cms-play.cjs');
const { createParent } = require('./cms/cms-parent.cjs');
const { loadRuntime } = require('./cms/cms-runtime.cjs');
const { buildDb } = require('./cms/cms-seed-testdata.cjs');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-cards-'));
const dataPath = path.join(dir, 'cms.json');
const credentialPath = path.join(dir, 'cms-admin-auth.json');
fs.writeFileSync(dataPath, JSON.stringify(buildDb()));
fs.writeFileSync(credentialPath, '[]');
const store = createJsonStore({ dataPath });
const core = createCore(store.load());
const db = core.db;
const play = createPlay(core, store);
const parent = createParent(core, credentialPath, store);
const rt = loadRuntime(path.join(__dirname, '../game-server/public/projects/GCS-CMS.json'));
const commit = (s, action, areaId, change, opts) => store.commit(db, { actor: s.personId, action, areaId, ...opts }, change);

const results = [];
const check = (name, fn) => Promise.resolve().then(fn).then(() => results.push(['OK', name])).catch(e => results.push(['FEHLER', name + ' :: ' + e.message]));
const child = id => ({ personId: id, assurance: 'profile' });
const account = id => core.session(core.issueSession(id, 'account'));
// Konto-Endpunkte (/api/cms/cards/*) haben keinen Modul-Adapter — direkt über
// die deklarativen TServerEndpoint-Tasks.
const cardsApi = (sess, route, body = {}) => rt.run(rt.find('/api/cms/cards/' + route, 'POST'), { session: sess, body, core, commit }, { strict: true });
const playApi = (sess, route, b = {}) => play.api(sess, route, b);
const parentApi = (sess, route, b = {}) => parent.api(sess, route, b);
const cardsOf = childId => db.flashcards.filter(c => c.childId === childId && c.active);

(async () => {

// --- Anlegen + Isolation der Kästen ---
let k1, k2, elternKarte;
await check('save: Kind legt Karte im eigenen Kasten an (Fach 1)', () => {
  const r = cardsApi(child('child-finn'), 'save', { subject: 'Mathe', topic: 'Einmaleins', question: '3×4?', answers: '12' });
  assert.strictEqual(r.status, 200, JSON.stringify(r.data));
  k1 = r.data.cardId;
  const c = db.flashcards.find(x => x.id === k1);
  assert.strictEqual(c.box, 1);
  assert.strictEqual(c.createdBy, 'child-finn');
  assert.strictEqual(c.childId, 'child-finn');
});

await check('save: zweite Karte, anderes Fach — gleicher Kasten', () => {
  const r = cardsApi(child('child-finn'), 'save', { subject: 'Englisch', topic: 'Tiere', question: 'cat?', answers: ['Katze', 'die Katze'], answerFormat: 'text' });
  assert.strictEqual(r.status, 200);
  k2 = r.data.cardId;
  assert.strictEqual(cardsOf('child-finn').length, 2);
});

await check('list: Kind sieht eigenen Kasten mit Fachvorschlägen', () => {
  const r = cardsApi(child('child-finn'), 'list', {});
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.items.length, 2);
  assert.deepStrictEqual(r.data.subjects.sort(), ['Englisch', 'Mathe']);
  assert.ok(r.data.items.every(i => i.editable), 'eigene Karten editierbar');
});

await check('list: Kind sieht fremden Kasten nicht (403)', () => {
  assert.strictEqual(cardsApi(child('child-finn'), 'list', { childId: 'child-emil' }).status, 403);
});

await check('save: Kind kann nicht in fremden Kasten schreiben (403)', () => {
  assert.strictEqual(cardsApi(child('child-finn'), 'save', { childId: 'child-emil', subject: 'Mathe', question: 'x', answers: 'y' }).status, 403);
});

// --- Elternzugriff ---
await check('parent child-cards: bestätigte Erziehungsberechtigte sieht Kasten', () => {
  const r = parentApi(account('parent-multi'), 'child-cards', { childId: 'child-finn' });
  assert.strictEqual(r.status, 200, JSON.stringify(r.data));
  assert.strictEqual(r.data.items.length, 2);
});

await check('parent child-card-save: Eltern legen Karte für Kind an', () => {
  const r = parentApi(account('parent-multi'), 'child-card-save', { childId: 'child-finn', subject: 'Mathe', topic: 'Einmaleins', question: '6×7?', answers: '42' });
  assert.strictEqual(r.status, 200);
  elternKarte = r.data.cardId;
  assert.strictEqual(db.flashcards.find(c => c.id === elternKarte).createdBy, 'parent-multi');
});

await check('parent child-cards: getrennte Kästen — emil bleibt leer', () => {
  const r = parentApi(account('parent-multi'), 'child-cards', { childId: 'child-emil' });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.items.length, 0);
});

await check('parent child-cards: fremde Familie → 403', () => {
  assert.strictEqual(parentApi(account('parent-lina'), 'child-cards', { childId: 'child-finn' }).status, 403);
});

await check('list: Kind sieht Eltern-Karte, aber nicht editierbar', () => {
  const r = cardsApi(child('child-finn'), 'list', {});
  const own = r.data.items.find(i => i.id === elternKarte);
  assert.ok(own, 'Eltern-Karte sichtbar');
  assert.strictEqual(own.editable, false, 'fremd erstellt → nicht editierbar');
});

await check('save: Kind darf Eltern-Karte nicht ändern (403)', () => {
  const r = cardsApi(child('child-finn'), 'save', { cardId: elternKarte, subject: 'Mathe', question: 'geändert', answers: 'x' });
  assert.strictEqual(r.status, 403);
});

// --- Leitner-Übergänge ---
await check('answer: richtig → Fach 2, erneut richtig → 3, 4, 5', () => {
  for (const box of [2, 3, 4, 5]) {
    const r = playApi(child('child-finn'), 'cardAnswer', { cardId: k1, correct: true });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.data.box, box);
  }
});

await check('answer: falsch → zurück auf Fach 1', () => {
  const r = playApi(child('child-finn'), 'cardAnswer', { cardId: k1, correct: false });
  assert.strictEqual(r.data.box, 1);
});

await check('answer: richtig in Fach 5 → Fach 6 (gelernt, Ablage)', () => {
  for (let i = 0; i < 5; i++) playApi(child('child-finn'), 'cardAnswer', { cardId: k1, correct: true });
  const c = db.flashcards.find(x => x.id === k1);
  assert.strictEqual(c.box, 6);
  const r = playApi(child('child-finn'), 'cardAnswer', { cardId: k1, correct: true });
  assert.strictEqual(r.data.mastered, true);
});

await check('answer: nur Kastenbesitzer bewertet (Eltern → 403)', () => {
  const r = playApi(account('parent-multi'), 'cardAnswer', { cardId: k2, correct: true });
  assert.strictEqual(r.status, 403);
});

await check('answer: fremdes Kind bewertet nicht (403)', () => {
  assert.strictEqual(playApi(child('child-emil'), 'cardAnswer', { cardId: k2, correct: true }).status, 403);
});

// --- Deklarative Ziehregel: je Fach älteste zuerst ---
let k3;
await check('cardNext: Fach-1-Karten kommen vor Fach-5-Karten', () => {
  // zweite Mathe-Karte bis Fach 5 hochstufen
  k3 = cardsApi(child('child-finn'), 'save', { subject: 'Mathe', topic: 'Einmaleins', question: '8×8?', answers: '64' }).data.cardId;
  for (let i = 0; i < 4; i++) playApi(child('child-finn'), 'cardAnswer', { cardId: k3, correct: true });
  assert.strictEqual(db.flashcards.find(c => c.id === k3).box, 5);
  // elternKarte bleibt Fach 1 → muss zuerst kommen
  const r = playApi(child('child-finn'), 'cardNext', { subject: 'Mathe' });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.card.id, elternKarte, 'Fach-1-Karte vor Fach-5');
});

await check('cardNext: excludeIds überspringt gezogene Karte → Fach 5', () => {
  const r = playApi(child('child-finn'), 'cardNext', { subject: 'Mathe', excludeIds: [elternKarte] });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.card.id, k3, 'nächstes Fach nach Ausschluss');
});

await check('cardNext: alles ausgeschlossen → empty', () => {
  const r = playApi(child('child-finn'), 'cardNext', { subject: 'Mathe', excludeIds: [elternKarte, k3] });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.empty, true);
  assert.ok(!r.data.card);
});

await check('cardNext: am längsten wartende Fach-1-Karte zuerst', () => {
  // neue Fach-1-Karte (nie wiederholt, createdAt als Wartezeit) anlegen,
  // danach elternKarte falsch bewerten → ihr Warte-Zeitpunkt ist jünger
  const neu = cardsApi(child('child-finn'), 'save', { subject: 'Mathe', topic: 'Einmaleins', question: '5×5?', answers: '25' }).data.cardId;
  playApi(child('child-finn'), 'cardAnswer', { cardId: elternKarte, correct: false });
  const r = playApi(child('child-finn'), 'cardNext', { subject: 'Mathe', topic: 'Einmaleins' });
  assert.strictEqual(r.data.card.id, neu, 'nie wiederholte Karte wartet länger');
});

await check('Falsche Karte landet auch bei gleichen Zeitstempeln hinten in Fach 1', () => {
  const first = cardsApi(child('child-finn'), 'save', { subject: 'Mathe', topic: 'Wiedervorlage', question: '2+2', answers: '4' }).data.cardId;
  const second = cardsApi(child('child-finn'), 'save', { subject: 'Mathe', topic: 'Wiedervorlage', question: '3+3', answers: '6' }).data.cardId;
  const timestamp = new Date(Date.now() + 1000).toISOString();
  for (const id of [first, second]) db.flashcards.find(c => c.id === id).lastReviewedAt = timestamp;
  playApi(child('child-finn'), 'cardAnswer', { cardId: first, correct: false });
  assert.strictEqual(db.flashcards.find(c => c.id === first).box, 1);
  assert.strictEqual(playApi(child('child-finn'), 'cardNext', { subject: 'Mathe', topic: 'Wiedervorlage' }).data.card.id, second);
  playApi(child('child-finn'), 'cardAnswer', { cardId: second, correct: true });
  assert.strictEqual(playApi(child('child-finn'), 'cardNext', { subject: 'Mathe', topic: 'Wiedervorlage', excludeIds: [second] }).data.card.id, first);
});

await check('cardNext: formats-Filter — self-Karte wird bei [text] nicht gezogen', () => {
  const s = cardsApi(child('child-finn'), 'save', { subject: 'Bio', question: 'Was ist Fotosynthese?', answers: 'Licht→Energie', answerFormat: 'self' });
  const r = playApi(child('child-finn'), 'cardNext', { subject: 'Bio', formats: ['text'] });
  assert.strictEqual(r.data.empty, true, 'self-Karte ausgeschlossen');
  const r2 = playApi(child('child-finn'), 'cardNext', { subject: 'Bio', formats: ['self'] });
  assert.strictEqual(r2.data.card.id, s.data.cardId);
});

// --- Fach 6: Ablage sichtbar, aus Ziehung ausgeschlossen, löschbar ---
await check('cardNext: Fach-6-Karten tauchen nicht auf', () => {
  const r = playApi(child('child-finn'), 'cardNext', { subject: 'Mathe', topic: 'Einmaleins' });
  assert.notStrictEqual(r.data.card.id, k1, 'gelernte Karte nicht in Ziehung');
});

await check('list: Fach 6 nur mit box-Filter sichtbar (Ablage)', () => {
  const ohne = cardsApi(child('child-finn'), 'list', {}).data.items;
  assert.ok(!ohne.some(i => i.id === k1), 'Standard-Liste ohne Ablage');
  const ablage = cardsApi(child('child-finn'), 'list', { box: 6 }).data.items;
  assert.ok(ablage.some(i => i.id === k1), 'Ablage enthält gelernte Karte');
  assert.ok(ablage.find(i => i.id === k1).editable, 'Fach-6-Karte für Kind löschbar');
});

await check('delete: Kind löscht Fach-6-Karte aus Ablage', () => {
  const r = cardsApi(child('child-finn'), 'delete', { cardId: k1 });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(db.flashcards.find(c => c.id === k1).active, false);
});

await check('delete: Kind darf Eltern-Karte (Fach 1) nicht löschen (403)', () => {
  assert.strictEqual(cardsApi(child('child-finn'), 'delete', { cardId: elternKarte }).status, 403);
});

await check('parent child-card-delete: Eltern löschen beliebige Karte', () => {
  const r = parentApi(account('parent-multi'), 'child-card-delete', { childId: 'child-finn', cardId: elternKarte });
  assert.strictEqual(r.status, 200);
});

// --- Inhaltsänderung setzt Lernstand zurück ---
await check('save: Inhaltsänderung an Frage → Lernstand zurück auf Fach 1', () => {
  // frische Karte bis Fach 3, dann Frage ändern
  const kx = cardsApi(child('child-finn'), 'save', { subject: 'Bio', question: 'Wasser Formel?', answers: 'H2O' }).data.cardId;
  for (let i = 0; i < 2; i++) playApi(child('child-finn'), 'cardAnswer', { cardId: kx, correct: true });
  assert.strictEqual(db.flashcards.find(c => c.id === kx).box, 3);
  const r = cardsApi(child('child-finn'), 'save', { cardId: kx, subject: 'Bio', question: 'Wasser Formel? (überarbeitet)', answers: 'H2O' });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(db.flashcards.find(c => c.id === kx).box, 1, 'Inhalt geändert → Fach 1');
});

await check('save: reine Themenänderung behält Lernstand', () => {
  const kx = cardsApi(child('child-finn'), 'save', { subject: 'Englisch', question: 'dog?', answers: 'Hund' }).data.cardId;
  playApi(child('child-finn'), 'cardAnswer', { cardId: kx, correct: true });
  const r = cardsApi(child('child-finn'), 'save', { cardId: kx, subject: 'Englisch', topic: 'Tiere', question: 'dog?', answers: 'Hund' });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(db.flashcards.find(c => c.id === kx).box, 2, 'kein Inhaltswechsel → Fach bleibt');
});

console.log('\n--- Karteikasten-Tests ---');
let fail = 0;
for (const [st, name] of results) { if (st === 'FEHLER') fail++; console.log(st.padEnd(6), name); }
console.log(`\n${results.length - fail}/${results.length} bestanden`);
process.exit(fail ? 1 : 0);
})();

// Feature-Video-Aufnahme (docs/CMS-Testkatalog.md → Landingpage).
// Faehrt die Aufbau-Suiten mit GCS_VIDEO_DIR gesetzt: jede Browser-Page
// wird als .webm aufgezeichnet, jeder Task blendet ein Kapitel-Overlay
// ein und hinterlaesst einen Zeitstempel (siehe cms/aufbau-common.cjs).
// Ergebnis: public/videos/<suite>-<nr>.webm + feature-videos.json
// (Manifest fuer das Projekt game-server/public/projects/GCS-FeatureVideos.json).
//
// Aufruf:  node scripts/record-feature-videos.cjs [filter]
//   filter  optionaler Substring des Skriptnamens, z.B. "raeume"

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const OUT_DIR = path.join('public', 'videos');

const SUITES = [
  { script: 'test-aufbau-0-basis.cjs',    base: 'basis',    rolle: 'superadmin', titel: 'Minimalbestand und erstes Haus' },
  { script: 'test-aufbau-1-admin.cjs',    base: 'admin',    rolle: 'superadmin', titel: 'HouseAdmin einrichten' },
  { script: 'test-aufbau-2-raeume.cjs',   base: 'raeume',   rolle: 'houseadmin', titel: 'Raeume verwalten' },
  { script: 'test-aufbau-3-personen.cjs', base: 'personen', rolle: 'houseadmin', titel: 'Hausbewohner, Raumzuordnung, Eltern und Beobachter' },
  { script: 'test-aufbau-4-mandant.cjs',  base: 'mandant',  rolle: 'houseadmin', titel: 'Mehrere Haeuser und Mandantentrennung' },
  { script: 'test-aufbau-5-spiele.cjs',   base: 'spiele',   rolle: 'houseadmin', titel: 'Spiele hochladen und freigeben' },
  { script: 'test-aufbau-6-leben.cjs',    base: 'leben',    rolle: 'houseadmin', titel: 'Lebenszyklus und Sitzungen' },
];

const ROLLEN_TITEL = {
  superadmin: 'SuperAdmin',
  houseadmin: 'HouseAdmin',
  raumadmin: 'RaumAdmin',
  eltern: 'Eltern',
  beobachter: 'Beobachter',
  kind: 'Kind',
};
const ROLLEN_REIHENFOLGE = ['superadmin', 'houseadmin', 'raumadmin', 'eltern', 'beobachter', 'kind'];

// Task-Praefix → handelnde Rolle (Landingpage-Filter "Rolle → Aufgaben").
// Alles ohne Treffer gehoert der Suite-Rolle.
const AKTEUR = [
  [/^BASIS|^HAUS|^ADMIN/, 'superadmin'],
  [/^RAUMMITGLIED/, 'raumadmin'],
  [/^SPIEL-03/, 'kind'],
  [/^OBS-01b/, 'beobachter'],
  [/^ELTERN-03/, 'eltern'],
];
function akteurFuer(id, fallback) {
  for (const [re, a] of AKTEUR) if (re.test(id)) return a;
  return fallback;
}

const filter = process.argv[2] || null;
const tmpVideoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gcs-videos-'));
fs.mkdirSync(OUT_DIR, { recursive: true });

// Bei einem gefilterten Lauf werden die nicht aufgenommenen Suiten aus dem
// vorhandenen Manifest uebernommen. So kann z.B. nur „personen" neu gedreht
// werden, ohne die sechs anderen Themen aus der Lehrvideo-Auswahl zu loeschen.
const manifestPath = path.join(OUT_DIR, 'feature-videos.json');
let vorher = null;
try { vorher = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch {}
const manifestSuiten = filter && vorher?.suiten ? [...vorher.suiten] : [];

for (const s of SUITES) {
  if (filter && !s.script.includes(filter)) continue;

  // Reste frueherer Laeufe dieser Suite entfernen (sonst Phantom-Kapitel)
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (f.startsWith(s.base + '-')) fs.unlinkSync(path.join(OUT_DIR, f));
  }

  console.log('\n=== Aufnahme: ' + s.script + ' ===');
  try {
    execFileSync('node', [path.join('scripts', s.script)], {
      stdio: 'inherit',
      env: { ...process.env, GCS_VIDEO_DIR: tmpVideoDir, GCS_VIDEO_BASE: s.base, GCS_VIDEO_OUT: OUT_DIR },
    });
  } catch (e) {
    console.log('  Suite beendet mit Fehlerstatus ' + (e.status || '?') + ' — vorhandene Kapitel werden trotzdem uebernommen.');
  }

  // Frisch geschriebene Kapitel dieser Suite einsammeln
  const videos = [];
  const chFiles = fs.readdirSync(OUT_DIR)
    .filter(f => f.startsWith(s.base + '-') && f.endsWith('.chapters.json'))
    .sort();
  for (const f of chFiles) {
    const cj = JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), 'utf8'));
    const webmName = f.replace('.chapters.json', '.webm');
    if (!fs.existsSync(path.join(OUT_DIR, webmName)) || !cj.chapters.length) continue;
    const pfad = 'videos/' + webmName;
    videos.push({ seite: cj.seite, pfad, aufgaben: cj.chapters });
  }
  const neu = { suite: s.base, titel: s.titel, rolle: s.rolle, videos };
  const altIndex = manifestSuiten.findIndex(x => x.suite === s.base);
  if (altIndex >= 0) manifestSuiten.splice(altIndex, 1, neu); else manifestSuiten.push(neu);
}

// Stabile Reihenfolge gemaess SUITES, danach Rollenindex aus allen erhaltenen
// und neu aufgenommenen Kapiteln komplett neu aufbauen.
const suiteOrder = new Map(SUITES.map((s, i) => [s.base, i]));
manifestSuiten.sort((a, b) => (suiteOrder.get(a.suite) ?? 999) - (suiteOrder.get(b.suite) ?? 999));
const rollen = new Map(); // key -> {key,titel,aufgaben:[]}
for (const suite of manifestSuiten) for (const video of suite.videos || []) for (const ch of video.aufgaben || []) {
  const rolle = akteurFuer(ch.id, suite.rolle);
  if (!rollen.has(rolle)) rollen.set(rolle, { key: rolle, titel: ROLLEN_TITEL[rolle] || rolle, aufgaben: [] });
  rollen.get(rolle).aufgaben.push({ uid: ch.id + '@' + suite.suite + '-' + video.seite, id: ch.id, titel: ch.titel, video: video.pfad, offset: ch.offset, suite: suite.titel });
}
const rollenArr = ROLLEN_REIHENFOLGE.filter(k => rollen.has(k)).map(k => rollen.get(k));
const manifest = { erzeugt: new Date().toISOString(), rollen: rollenArr, suiten: manifestSuiten };
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

try { fs.rmSync(tmpVideoDir, { recursive: true, force: true }); } catch {}

const nVideos = manifestSuiten.reduce((n, s) => n + s.videos.length, 0);
const nTasks = rollenArr.reduce((n, r) => n + r.aufgaben.length, 0);
console.log('\nFertig: ' + nVideos + ' Videos, ' + nTasks + ' Kapitel, ' + rollenArr.length + ' Rollen.');
console.log('Manifest: ' + path.join(OUT_DIR, 'feature-videos.json'));

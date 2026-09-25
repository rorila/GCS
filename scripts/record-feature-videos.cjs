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
  { script: 'test-aufbau-3-personen.cjs', base: 'personen', rolle: 'houseadmin', titel: 'Kinder, Eltern und Beobachter' },
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

const manifestSuiten = [];
const rollen = new Map(); // key -> {key,titel,aufgaben:[]}

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
    for (const ch of cj.chapters) {
      const rolle = akteurFuer(ch.id, s.rolle);
      if (!rollen.has(rolle)) rollen.set(rolle, { key: rolle, titel: ROLLEN_TITEL[rolle] || rolle, aufgaben: [] });
      rollen.get(rolle).aufgaben.push({ uid: ch.id + '@' + s.base + '-' + cj.seite, id: ch.id, titel: ch.titel, video: pfad, offset: ch.offset, suite: s.titel });
    }
  }
  manifestSuiten.push({ suite: s.base, titel: s.titel, rolle: s.rolle, videos });
}

const rollenArr = ROLLEN_REIHENFOLGE.filter(k => rollen.has(k)).map(k => rollen.get(k));
const manifest = { erzeugt: new Date().toISOString(), rollen: rollenArr, suiten: manifestSuiten };
fs.writeFileSync(path.join(OUT_DIR, 'feature-videos.json'), JSON.stringify(manifest, null, 2));

try { fs.rmSync(tmpVideoDir, { recursive: true, force: true }); } catch {}

const nVideos = manifestSuiten.reduce((n, s) => n + s.videos.length, 0);
const nTasks = rollenArr.reduce((n, r) => n + r.aufgaben.length, 0);
console.log('\nFertig: ' + nVideos + ' Videos, ' + nTasks + ' Kapitel, ' + rollenArr.length + ' Rollen.');
console.log('Manifest: ' + path.join(OUT_DIR, 'feature-videos.json'));

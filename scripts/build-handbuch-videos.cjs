// Bindet die Feature-Videos als Kapitel-Clips in das Benutzerhandbuch ein.
//
//   node scripts/build-handbuch-videos.cjs
//
// - public/videos/*.webm werden vom Game-Server direkt unter /videos/
//   ausgeliefert (server.ts → ROOT_PUBLIC_DIR) — kein Kopieren noetig
// - liest die Kapitel-Offsets aus dem Manifest
// - schreibt pro Handbuch-Abschnitt (SECTION_CLIPS) einen aufklappbaren
//   <details>-Block mit <video src="/videos/X.webm#t=start,end">
// - idempotent: alte gcs-video-Bloecke werden vorher entfernt
const fs = require('fs'), path = require('path');

const SRC_DIR = 'public/videos';
const HANDBUCH = 'game-server/public/projects/GCS_CMS_Benutzerhandbuch.html';
const VIDEO_BASE = '/videos/';

// ── Abschnitt (id-Praefix des <h3>/<h4>-Ankers) → Task-IDs in Reihenfolge ──
const SECTION_CLIPS = {
  // 3 Kinder & Spieler
  '31-emoji-anmeldung': ['SPIEL-03a'],
  '32-spielhaus-galerie': ['SPIEL-03b'],
  // 4 Eltern & Beobachter
  '41-elternbereich': ['ELTERN-03'],
  '42-beobachterbereich': ['OBS-01b'],
  // 5 Admin-Anmeldung
  '51-login--rollenweiterleitung': ['ADMIN-03a', 'ADMIN-03b', 'ADMIN-03c'],
  // 6 RaumAdmin
  '62-zutrittsverwaltung': ['RAUMMITGLIED-01', 'BEWOHNER-02b'],
  // 7 HouseAdmin
  '71-hausübersicht': ['HAUS-01a', 'HAUS-01b', 'HAUS-01c', 'MULTI-01a'],
  '72-räume-verwalten': ['RAUM-01a', 'RAUM-01b', 'RAUM-02', 'RAUM-03', 'RAUM-04a', 'RAUM-04b', 'GRENZE-02'],
  '74-bewohner-anlegen': ['BEWOHNER-01a', 'BEWOHNER-01b', 'BEWOHNER-02a', 'BEWOHNER-02b'],
  '75-familien-zuordnen': ['ELTERN-01', 'ELTERN-02a', 'ELTERN-02b'],
  '76-spielekatalog': ['SPIEL-02a', 'SPIEL-02b'],
  '77-einladungen': ['ELTERN-01', 'OBS-01a', 'OBS-01b'],
  // 8 SuperAdmin
  '81-plattform-dashboard': ['BASIS-01b', 'BASIS-01c'],
  '82-häuser-management': ['HAUS-01a', 'HAUS-01b', 'MOND-01', 'MULTI-01a', 'MULTI-01b', 'MULTI-01c', 'GRENZE-01a', 'GRENZE-01b', 'GRENZE-01c'],
  '83-plattform--und-haus-admins': ['ADMIN-01a', 'ADMIN-01b', 'ADMIN-02a', 'ADMIN-02b', 'LEBEN-01a', 'LEBEN-01b', 'LEBEN-02a', 'LEBEN-02b', 'LEBEN-03a', 'LEBEN-03b'],
  '84-spiele-zentrale': ['SPIEL-01a', 'SPIEL-01c', 'SPIEL-01b'],
  '85-versionierung': ['SPIEL-01c', 'SPIEL-02b'],
};

// ── 1. Kapitel-Lookup: Task-ID → {pfad, titel, offset, end} ──
const manifest = JSON.parse(fs.readFileSync(path.join(SRC_DIR, 'feature-videos.json'), 'utf8'));
const clips = new Map();
for (const s of manifest.suiten || []) for (const v of s.videos || []) {
  const a = [...(v.aufgaben || [])].sort((x, y) => x.offset - y.offset);
  a.forEach((ch, i) => {
    clips.set(ch.id + '@' + s.suite + '-' + v.seite, { pfad: v.pfad, titel: ch.titel, offset: ch.offset, end: i + 1 < a.length ? a[i + 1].offset : null });
    // globale Kurzform nur wenn noch nicht belegt (gleiche ID in mehreren Videos moeglich)
    if (!clips.has(ch.id)) clips.set(ch.id, clips.get(ch.id + '@' + s.suite + '-' + v.seite));
  });
}

// ── 2. Handbuch patchen ──
let html = fs.readFileSync(HANDBUCH, 'utf8');
html = html.replace(/\s*<!-- gcs-video -->[\s\S]*?<!-- \/gcs-video -->/g, '');

const clipHtml = (c, id) => {
  const t = c.end != null ? `#t=${c.offset},${c.end}` : `#t=${c.offset}`;
  return '      <div class="lv-clip" style="margin:10px 0;">\n'
    + '        <div style="font:600 13px/1.4 system-ui;color:#334155;margin-bottom:4px;">🎬 ' + id + ' · ' + c.titel + '</div>\n'
    + '        <video controls preload="none" playsinline src="' + VIDEO_BASE + path.basename(c.pfad) + t + '"\n'
    + '          style="width:100%;max-width:760px;border-radius:8px;background:#0f172a;box-shadow:0 1px 6px rgba(0,0,0,.25);"></video>\n'
    + '      </div>\n';
};

let eingefuegt = 0, fehlend = [];
for (const [anchorPrefix, ids] of Object.entries(SECTION_CLIPS)) {
  const re = new RegExp('(<h[34][^>]*id="(' + anchorPrefix + '[^"]*)"[^>]*>.*?</h[34]>)');
  const m = html.match(re);
  if (!m) { fehlend.push('Anker fehlt: ' + anchorPrefix); continue; }
  const parts = [];
  for (const id of ids) {
    const c = clips.get(id);
    if (!c) { fehlend.push('Kapitel fehlt: ' + id); continue; }
    parts.push(clipHtml(c, id));
  }
  if (!parts.length) continue;
  const block = '\n<!-- gcs-video -->\n<details class="lehrvideo" style="margin:8px 0 14px;padding:10px 14px;border:1px solid #cbd5e1;border-radius:10px;background:#f1f5f9;">\n'
    + '  <summary style="cursor:pointer;font:600 14px/1.4 system-ui;color:#1d4ed8;">🎬 ' + parts.length + ' Lehrvideo' + (parts.length > 1 ? 's' : '') + ' zu diesem Abschnitt</summary>\n'
    + parts.join('') + '</details>\n<!-- /gcs-video -->';
  html = html.slice(0, m.index + m[1].length) + block + html.slice(m.index + m[1].length);
  eingefuegt++;
}
fs.writeFileSync(HANDBUCH, html);
console.log('Sektionen mit Videos:', eingefuegt, '/', Object.keys(SECTION_CLIPS).length);
if (fehlend.length) console.log('Hinweise:\n  ' + fehlend.join('\n  '));

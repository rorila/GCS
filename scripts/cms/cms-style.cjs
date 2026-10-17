// Gemeinsames Design-System für alle CMS-Stages in GCS-CMS.json.
// Farben/Struktur folgen dem Referenz-Template (dunkles Teal-Layout):
//   Hintergrund #0a151d, Panels #0e1d28 + Border #1b3446 (rounded-xl),
//   Inputs #142837/#21435c, Sekundär-Buttons #132736/#21435b,
//   Nav-Buttons #13222e, CTA-Buttons #14b8a6 (Vollton statt Gradient).
//
// applyCmsTheme(project) macht zweierlei, beides idempotent:
//   1) Normalisiert Styles aller sichtbaren TButton/TEdit/TLabel/TTable
//      (lokale Objekt-Styles gewinnen gegen ThemeRegistry → direkter Eingriff)
//   2) Fügt „Chrome-Panels" (TPanel) ein: Objekte werden nach y-Position in
//      Bänder gruppiert, jedes Band bekommt eine Panel-Fläche dahinter.
//      Panels tragen cmsChrome:true und werden bei jedem Lauf neu abgeleitet.
//
// Aufruf als Skript: node scripts/cms/cms-style.cjs
// In Generatoren:    require('./cms-style.cjs').applyCmsTheme(project) vor dem Schreiben.

const fs = require('node:fs'), path = require('node:path');
const { panelName } = require('./cms-ui-integrity.cjs');

const TOKENS = {
  bg: '#0a151d',            // Body-Hintergrund
  panelBg: '#0e1d28',       // Sektions-Panels
  panelBorder: '#1b3446',
  headerBg: '#0e1d28',
  ink: '#e2e8f0',           // Haupttext (slate-200)
  inkMuted: '#8da6ba',
  accent: '#14b8a6',        // Teal-CTA
  accentInk: '#062a26',     // Schrift auf CTA
  cyan: '#22d3ee',
  editBg: '#142837',
  editBorder: '#21435c',
  btnSecondaryBg: '#162e40',
  btnSecondaryBorder: '#274b63',
  btnSecondaryInk: '#a5dff0',
  btnNavBg: '#13222e',
  btnNavBorder: '#22394a',
  btnNavInk: '#cbd5e1',
  chipBg: '#163042',
  chipBorder: '#234b66',
  chipInk: '#67e8f9',
};

// Button-Rollen über den Objektnamen (Konvention in den Generatoren).
const isCta = n => /speichern|filtern|neu|anlegen|zuordnen|uebernehmen|übernehmen|erstellen|anmelden|login|senden|einladen|bestaet|hinzuf|freigeben|veroeffentlichen|veröffentlichen|importieren|starten/i.test(n);
const isNav = n => /zurueck|zurück|back|abbrechen|schliessen|schließen|logout|abmelden/i.test(n);
const isDanger = n => /loeschen|löschen|delete|entfernen|ablehnen|zurueckziehen|zurückziehen/i.test(n);

const BTN_BASE = { borderWidth: 1, borderRadius: 9, textAlign: 'center', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.25)' };
const BTN_ROLE = {
  cta: { backgroundColor: TOKENS.accent, borderColor: TOKENS.accent, color: TOKENS.accentInk },
  secondary: { backgroundColor: TOKENS.btnSecondaryBg, borderColor: TOKENS.btnSecondaryBorder, color: TOKENS.btnSecondaryInk },
  nav: { backgroundColor: TOKENS.btnNavBg, borderColor: TOKENS.btnNavBorder, color: TOKENS.btnNavInk },
  danger: { backgroundColor: '#3a1d24', borderColor: '#5c2a34', color: '#f0a8b4' },
};
const roleOf = name => isNav(name) ? 'nav' : isDanger(name) ? 'danger' : isCta(name) ? 'cta' : 'secondary';

const STYLE = {
  edit: { backgroundColor: TOKENS.editBg, borderColor: TOKENS.editBorder, borderWidth: 1, borderRadius: 8, color: TOKENS.ink },
  label: { color: TOKENS.ink },
  table: { backgroundColor: TOKENS.panelBg, borderColor: TOKENS.panelBorder, borderWidth: 1, borderRadius: 10, color: TOKENS.ink },
  panel: { backgroundColor: TOKENS.panelBg, borderColor: TOKENS.panelBorder, borderWidth: 1, borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' },
};

const uid = () => 'cms_panel-' + Math.random().toString(36).slice(2, 10);
const isChrome = o => o.cmsChrome === true;
const isVisible = o => o.visible !== false && !o.isService && !o.isHiddenInRun && !o.isVariable && !isChrome(o);

// Objekte in y-Bänder clustern und jedes Band mit einer TPanel-Fläche
// hinterlegen. Tabellen/GridBoards bilden je ein eigenes Band (Inhalts-
// Inseln); übrige Objekte clustern bei Lücken >1.8 Zeilen. Panels werden
// vor den Inhalten ins Array gestellt (DOM-Reihenfolge = z) und tragen
// cmsChrome:true + zIndex:-1 — idempotent, werden bei jedem Lauf neu
// abgeleitet.
function addChromePanels(stage) {
  stage.objects = (stage.objects || []).filter(o => !isChrome(o));
  const objs = stage.objects.filter(isVisible);
  if (!objs.length) return 0;
  const isTable = o => o.className === 'TTable' || o.className === 'TGridBoard';
  const bands = [];
  const sorted = [...objs].sort((a, b) => (a.y || 0) - (b.y || 0));
  for (const o of sorted) {
    const top = o.y || 0, bottom = top + (o.height || 1);
    const last = bands[bands.length - 1];
    if (isTable(o)) { bands.push({ top, bottom, fixed: true }); continue; }
    if (last && !last.fixed && top - last.bottom <= 1.8) { last.bottom = Math.max(last.bottom, bottom); }
    else bands.push({ top, bottom });
  }
  // Überlappende Bänder (zweispaltige Layouts) zusammenführen — sonst
  // würden sich die Panel-Rahmen kreuzen.
  const merged = [];
  for (const b of bands.sort((a, b) => a.top - b.top)) {
    const last = merged[merged.length - 1];
    if (last && b.top < last.bottom + 0.4) last.bottom = Math.max(last.bottom, b.bottom);
    else merged.push({ top: b.top, bottom: b.bottom });
  }
  const maxRows = stage.grid?.rows || 40;
  const panels = [];
  const names = new Set(stage.objects.map(o => o.name));
  let prevBottom = 0;
  for (const b of merged) {
    // Padding, aber niemals in das vorherige Panel hineinragen.
    const y = Math.max(0, b.top - 0.6, prevBottom);
    const bottom = Math.min(maxRows, b.bottom + 0.8);
    if (bottom - y < 1.2) continue;
    prevBottom = y + (bottom - y);
    panels.push({
      className: 'TPanel', id: uid(), name: panelName(stage.id, names), scope: 'stage', cmsChrome: true,
      draggable: false, droppable: false, dragMode: 'move', visible: true,
      x: 1, y, width: 62, height: bottom - y,
      zIndex: -1, rotation: 0, align: 'NONE', collisionEnabled: false,
      style: { ...STYLE.panel }, text: '', events: {},
    });
  }
  stage.objects.unshift(...panels);
  return panels.length;
}

function applyCmsTheme(project) {
  let styled = 0, paneled = 0, stages = 0;
  for (const stage of project.stages || []) {
    if (stage.cmsTheme === 'custom') continue;
    const ui = (stage.objects || []).some(isVisible);
    if (!ui) continue;
    stages++;
    if (stage.grid) stage.grid.backgroundColor = TOKENS.bg;
    paneled += addChromePanels(stage);
    for (const o of stage.objects) {
      if (!isVisible(o)) continue;
      if (o.className === 'TButton') {
        o.style = { ...BTN_BASE, ...(o.style || {}) };
        Object.assign(o.style, BTN_ROLE[roleOf(o.name)]);
        o.style.borderRadius = BTN_BASE.borderRadius;
        styled++;
      } else if (o.className === 'TEdit') {
        o.style = { ...(o.style || {}), ...STYLE.edit };
        styled++;
      } else if (o.className === 'TLabel') {
        o.style = { ...(o.style || {}), color: (o.style && o.style.color) || STYLE.label.color };
        styled++;
      } else if (o.className === 'TTable') {
        o.style = { ...(o.style || {}), ...STYLE.table };
        styled++;
      }
    }
  }
  return { styled, paneled, stages };
}

module.exports = { TOKENS, STYLE, roleOf, applyCmsTheme };

if (require.main === module) {
  const FILE = path.join(__dirname, '../../game-server/public/projects/GCS-CMS.json');
  const project = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const r = applyCmsTheme(project);
  fs.writeFileSync(FILE, JSON.stringify(project, null, 1));
  console.log(`CMS-Theme: ${r.styled} Objekte gestylt, ${r.paneled} Panels in ${r.stages} Stages eingefügt.`);
}

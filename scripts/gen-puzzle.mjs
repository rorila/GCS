#!/usr/bin/env node
/**
 * gen-puzzle.mjs — erzeugt game-server/public/projects/Puzzle.json
 *
 * Puzzle-Spiel im Memory-Stil, aufgeteilt auf mehrere Stages:
 *  - stage_blueprint: Variablen, Dienste (Tastatur, StageController),
 *    gemeinsames Chassis (Zonen, HUD, Motiv-Leiste), Gewinn-Overlay,
 *    alle gemeinsamen Tasks — Blueprint-Objekte sind global: sie werden
 *    in jede Stage gemergt und im Editor als geerbte Ghosts angezeigt.
 *  - stage_menue:     HauptStage (type 'main') — nur das Startmenue.
 *    Ihre Objekte werden zur Laufzeit in die Level-Stages gemergt und
 *    dort per LevelStarten ausgeblendet.
 *  - stage_einfach/mittel/schwer (standard): je nur die Teile+Slots+Listen der Stufe
 *  - Links gemischte Puzzleteile (TSprite), rechts Zielplatz-Raster.
 *  - Teile = vorgeschnittene SVG-Data-URIs (Motiv eingebettet + clipPath,
 *    dadurch echte Jigsaw-Noppen ohne Engine-Aenderung und ohne
 *    per-frame clip-Kosten — gut fuer schwache Tablets).
 *  - PuzzleListe (TObjectList, objects-Modus): Record je Teil
 *    {match, name, heimX, heimY, platziert, rot, b1, b2, b3}
 *  - SlotListe (TObjectList): Record je Zielplatz
 *    {match, name, sx, sy, gefuellt, normal, gruen}
 *  - Drag & Drop: Desktop via onDragStart/onDrop/onDragEnd (HTML5), Tablet
 *    via onTouchStart/Move/End (Pointer-Capture). Beide Pfade enden in
 *    AblegePruefen (Match + Rotation).
 *  - KonturRegler (TSlider) steuert die Transparenz der Zielkonturen.
 *  - Stufe 3 dreht Teile zufaellig; Klick (onClick) dreht um 90 Grad.
 *
 * Neue Motive: SVG-Datei mit viewBox="0 0 468 312" nach
 * public/images/puzzle/ legen und unten in MOTIF_FILES eintragen,
 * dann dieses Skript erneut ausfuehren.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'game-server', 'public', 'projects', 'Puzzle.json');
const IMG_DIR = path.join(ROOT, 'public', 'images', 'puzzle');

// ─── Konstanten ──────────────────────────────────────────────────────────────
const CELL = 26;
const COLS = 52, ROWS = 26;
const S = 4;                    // Kantenlaenge eines Teils in Zellen (104 px Kern)
const M = 1.2;                  // Noppen-Rand in Zellen (~31 px — die Noppe ragt hinein)
const BOX = S + 2 * M;          // 6.4 Zellen -> ~166 px Element-Box
const Spx = S * CELL;           // 104 px Kern
const Mpx = M * CELL;           // 31.2 px Rand
const Bpx = BOX * CELL;         // ~166 px
const IMGW = 6 * Spx;           // 624 px Motivbreite (6x4 Referenzraster)
const IMGH = 4 * Spx;           // 416 px

const BOARD_X = 24.9, BOARD_Y = 4.9; // linke obere Ecke des 6x4-Zielrasters (Zellen)
const BG = '#141b2e';
const GRID = () => ({ cols: COLS, rows: ROWS, cellSize: CELL, visible: false, snapToGrid: true, backgroundColor: BG });
// Mitglieder von Overlays/HUD-Gruppen — separate Objekte erben visible nicht
// automatisch, darum schalten die Tasks jedes Mitglied explizit.
const OV_WIN = ['OverlayGewinn', 'LblGewinn', 'LblGewinn2', 'BtnNochmal', 'BtnZurueck'];
const OV_MENU = ['OverlayStart', 'LblStartTitel', 'LblAnl1', 'LblAnl2', 'LblAnl3', 'BtnStart1', 'BtnStart2', 'BtnStart3'];
// HUD-Teile, die nur auf Level-Stages Sinn ergeben (im Menue ausgeblendet)
const HUD_LEVEL = ['InfoZeile', 'LblFortschritt', 'BtnNeu', 'LblAblage', 'LblZiel'];
const showHide = (names, on) => Object.fromEntries(names.map(n => [`${n}.visible`, String(on)]));

const LEVELS = [
    { stufe: 1, p: 3, q: 2, jigsaw: false, rot: false, label: 'Leicht (3x2)',            stageId: 'stage_einfach', stageName: 'Puzzle Leicht' },
    { stufe: 2, p: 4, q: 3, jigsaw: false, rot: false, label: 'Mittel (4x3)',            stageId: 'stage_mittel',  stageName: 'Puzzle Mittel' },
    { stufe: 3, p: 6, q: 4, jigsaw: true,  rot: true,  label: 'Schwer (6x4 + Drehen)',   stageId: 'stage_schwer',  stageName: 'Puzzle Schwer' },
];

const MOTIF_FILES = ['motiv1.svg', 'motiv2.svg', 'motiv3.svg'];

// ─── Seeded RNG (deterministische Generierung) ───────────────────────────────
let _seed = 20240517;
function rnd() {
    _seed |= 0; _seed = (_seed + 0x6D2B79F5) | 0;
    let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rsign = () => (rnd() < 0.5 ? 1 : -1);

// ─── Standard-Motive (werden nur geschrieben, wenn die Datei fehlt) ──────────
const MOTIF_DEFAULTS = {
    'motiv1.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 468 312"><rect width="468" height="312" fill="#7ec8f7"/><rect y="212" width="468" height="100" fill="#4caf50"/><rect y="212" width="468" height="14" fill="#66bb6a"/><circle cx="70" cy="60" r="34" fill="#ffee58"/><rect x="60" y="50" width="20" height="20" fill="#fdd835"/><g fill="#8d6e63"><rect x="0" y="180" width="52" height="40"/><rect x="416" y="170" width="52" height="50"/></g><g><rect x="150" y="120" width="26" height="92" fill="#795548"/><rect x="120" y="80" width="86" height="52" fill="#388e3c"/><rect x="134" y="58" width="58" height="30" fill="#43a047"/></g><g><rect x="330" y="150" width="24" height="62" fill="#795548"/><rect x="304" y="116" width="76" height="44" fill="#2e7d32"/></g><g fill="#5d4037"><rect x="30" y="240" width="40" height="12"/><rect x="80" y="262" width="40" height="12"/><rect x="390" y="244" width="40" height="12"/></g><g><rect x="230" y="226" width="34" height="26" fill="#f8bbd0"/><rect x="252" y="218" width="18" height="16" fill="#f48fb1"/><rect x="236" y="250" width="7" height="12" fill="#f8bbd0"/><rect x="252" y="250" width="7" height="12" fill="#f8bbd0"/></g><g fill="#ffffff" opacity="0.85"><rect x="130" y="34" width="60" height="18" rx="9"/><rect x="300" y="20" width="80" height="20" rx="10"/><rect x="330" y="34" width="46" height="14" rx="7"/></g></svg>`,
    'motiv2.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 468 312"><rect width="468" height="312" fill="#4fc3f7"/><rect y="230" width="468" height="82" fill="#8d6e63"/><rect y="230" width="468" height="10" fill="#a1887f"/><circle cx="400" cy="50" r="30" fill="#fff176"/><g fill="#90a4ae"><rect x="90" y="120" width="60" height="112"/><rect x="150" y="150" width="168" height="82"/><rect x="318" y="100" width="60" height="132"/></g><g fill="#78909c"><rect x="90" y="104" width="60" height="18"/><rect x="318" y="84" width="60" height="18"/><rect x="150" y="134" width="168" height="18"/></g><g fill="#37474f"><rect x="104" y="140" width="12" height="24"/><rect x="330" y="120" width="12" height="24"/><rect x="330" y="160" width="12" height="24"/><rect x="196" y="170" width="12" height="24"/><rect x="260" y="170" width="12" height="24"/></g><rect x="216" y="196" width="36" height="36" rx="4" fill="#5d4037"/><rect x="228" y="120" width="8" height="30" fill="#546e7a"/><path d="M236 118 l44 14 -44 14 z" fill="#e53935"/><g fill="#eceff1"><rect x="150" y="80" width="30" height="22" rx="6"/><rect x="30" y="50" width="40" height="20" rx="8"/></g><g fill="#33691e"><rect x="20" y="200" width="26" height="32"/><rect x="12" y="188" width="42" height="18"/></g><g fill="#e53935"><rect x="60" y="244" width="12" height="12"/><rect x="74" y="244" width="12" height="12"/><rect x="60" y="256" width="12" height="12"/><rect x="74" y="256" width="12" height="12"/></g></svg>`,
    'motiv3.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 468 312"><rect width="468" height="312" fill="#1a237e"/><g fill="#ffffff"><circle cx="40" cy="40" r="3"/><circle cx="120" cy="80" r="2"/><circle cx="200" cy="30" r="3"/><circle cx="300" cy="60" r="2"/><circle cx="420" cy="40" r="3"/><circle cx="60" cy="150" r="2"/><circle cx="440" cy="130" r="2"/><circle cx="170" cy="110" r="2"/><circle cx="350" cy="20" r="2"/><circle cx="90" cy="220" r="3"/><circle cx="250" cy="200" r="2"/><circle cx="430" cy="240" r="3"/><circle cx="30" cy="290" r="2"/><circle cx="380" cy="290" r="2"/></g><circle cx="80" cy="250" r="46" fill="#ff8f00"/><circle cx="80" cy="250" r="46" fill="none" stroke="#ffb300" stroke-width="6"/><circle cx="390" cy="70" r="40" fill="#4dd0e1"/><ellipse cx="390" cy="70" rx="64" ry="12" fill="none" stroke="#b2ebf2" stroke-width="6" transform="rotate(-16 390 70)"/><g transform="translate(210 120) rotate(-30)"><rect x="-14" y="-46" width="28" height="70" rx="10" fill="#eceff1"/><path d="M-14 -46 a14 14 0 0 1 28 0 z" fill="#e53935"/><circle cx="0" cy="-18" r="9" fill="#4fc3f7" stroke="#37474f" stroke-width="3"/><path d="M-14 24 l-16 22 12 0 4 -10 z" fill="#e53935"/><path d="M14 24 l16 22 -12 0 -4 -10 z" fill="#e53935"/><path d="M-8 24 q8 26 16 0 z" fill="#ffca28"/></g><circle cx="60" cy="90" r="14" fill="#8d6e63"/><circle cx="55" cy="86" r="4" fill="#6d4c41"/><circle cx="66" cy="95" r="3" fill="#6d4c41"/></svg>`,
};

function ensureMotifs() {
    fs.mkdirSync(IMG_DIR, { recursive: true });
    for (const [file, svg] of Object.entries(MOTIF_DEFAULTS)) {
        const p = path.join(IMG_DIR, file);
        if (!fs.existsSync(p)) fs.writeFileSync(p, svg, 'utf8');
    }
}

function motifInner(file) {
    const p = path.join(IMG_DIR, file);
    const raw = fs.readFileSync(p, 'utf8');
    const m = raw.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
    return m ? m[1].trim() : raw;
}

// ─── Jigsaw-Geometrie ────────────────────────────────────────────────────────
// Kante als Pfadsegment: (ux,uy) Richtung entlang der Kante, (nx,ny) nach aussen.
// s: 0 = gerade, +1 = Noppe nach aussen, -1 = Einbuchtung.
function edgePath(ax, ay, ux, uy, nx, ny, L, s) {
    if (!s) return ` L ${r1(ax + ux * L)} ${r1(ay + uy * L)}`;
    const h = 0.26 * L, v = s;
    const P = (u, w) => `${r1(ax + ux * u + nx * w)} ${r1(ay + uy * u + ny * w)}`;
    return ` L ${P(0.30 * L, 0)}`
        + ` C ${P(0.37 * L, 0.02 * h * v)} ${P(0.31 * L, 0.55 * h * v)} ${P(0.42 * L, 0.62 * h * v)}`
        + ` C ${P(0.28 * L, 1.04 * h * v)} ${P(0.72 * L, 1.04 * h * v)} ${P(0.58 * L, 0.62 * h * v)}`
        + ` C ${P(0.69 * L, 0.55 * h * v)} ${P(0.63 * L, 0.02 * h * v)} ${P(0.70 * L, 0)}`
        + ` L ${P(L, 0)}`;
}
const r1 = (n) => Math.round(n * 10) / 10;

function piecePath(e) { // e = {t,r,b,l}
    const m = Mpx, s = Spx;
    let d = `M ${m} ${m}`;
    d += edgePath(m, m, 1, 0, 0, -1, s, e.t);          // oben
    d += edgePath(m + s, m, 0, 1, 1, 0, s, e.r);       // rechts
    d += edgePath(m + s, m + s, -1, 0, 0, 1, s, e.b);  // unten
    d += edgePath(m, m + s, 0, -1, -1, 0, s, e.l);     // links
    return d + ' Z';
}

function levelEdges(level) {
    const { p, q, jigsaw } = level;
    const vE = [], hE = [];
    for (let r = 0; r < q; r++) {
        vE[r] = []; hE[r] = [];
        for (let c = 0; c < p; c++) {
            vE[r][c] = (jigsaw && c < p - 1) ? rsign() : 0;
            hE[r][c] = (jigsaw && r < q - 1) ? rsign() : 0;
        }
    }
    return (r, c) => ({
        t: r === 0 ? 0 : -hE[r - 1][c],
        r: c === p - 1 ? 0 : vE[r][c],
        b: r === q - 1 ? 0 : hE[r][c],
        l: c === 0 ? 0 : -vE[r][c - 1],
    });
}

const dataUri = (svg) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

function pieceSvg(level, edges, col, row, motifInnerSvg) {
    const d = piecePath(edges(row, col));
    const tx = Mpx - col * Spx, ty = Mpx - row * Spx;
    return dataUri(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Bpx} ${Bpx}">` +
        `<defs><clipPath id="c"><path d="${d}"/></clipPath></defs>` +
        `<g clip-path="url(#c)"><g transform="translate(${r1(tx)} ${r1(ty)})">` +
        `<svg width="${IMGW}" height="${IMGH}" viewBox="0 0 ${IMGW} ${IMGH}">${motifInnerSvg}</svg>` +
        `</g></g>` +
        `<path d="${d}" fill="none" stroke="rgba(0,0,0,0.45)" stroke-width="2"/>` +
        `<path d="${d}" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="0.7"/>` +
        `</svg>`);
}

function slotSvg(pathD, green) {
    const fill = green ? 'rgba(46,204,96,0.20)' : 'rgba(140,160,200,0.10)';
    const stroke = green ? '#2ecc60' : '#9fb4d8';
    const w = green ? 3 : 2;
    return dataUri(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Bpx} ${Bpx}">` +
        `<path d="${pathD}" fill="${fill}" stroke="${stroke}" stroke-width="${w}"/></svg>`);
}

// ─── Streu-Positionen (linke Seite) ──────────────────────────────────────────
function scatterPositions() {
    // 5 Spalten x 5 Zeilen in der linken Ablage-Zone (Box ist 6.4 Zellen breit,
    // die aeusseren ~1.2 Zellen sind transparenter Noppen-Rand und duerfen ueberlappen).
    const list = [];
    for (let i = 0; i < 24; i++) {
        const col = i % 5, row = Math.floor(i / 5);
        const jx = (rnd() - 0.5) * 1.2, jy = (rnd() - 0.5) * 1.0;
        list.push({ x: r1(1.3 + col * 3.9 + jx), y: r1(3.4 + row * 3.3 + jy) });
    }
    return list;
}

// ─── Action-/Objekt-Helfer ───────────────────────────────────────────────────
const calc = (formula, resultVariable) =>
    ({ name: `${formula} -> ${resultVariable}`, type: 'calculate', formula, resultVariable });
const prop = (changes) => ({ name: 'prop', type: 'property', changes });
const cond = (variable, operator, value, then, elseB) => ({
    type: 'condition', name: `Branch: ${variable} ${operator} ${value}`,
    condition: { variable, operator, value }, then, ...(elseB ? { else: elseB } : {}),
});
const rget = (list, target, field, resultVariable) =>
    ({ name: `record_get ${field}`, type: 'record_get', list, target, field, resultVariable });
const rset = (list, target, field, value) =>
    ({ name: `record_set ${field}`, type: 'record_set', list, target, field, value: String(value) });
const lget = (target, index, field, resultVariable) =>
    ({ name: `list_get ${target}[${index}]`, type: 'list_get', target, index, field, resultVariable });
const fe = (sourceArray, body) =>
    ({ type: 'foreach', name: `ForEach: Eintrag in ${sourceArray}`, sourceArray, itemVar: 'Eintrag', body });
const runTask = (name) => ({ type: 'task', name });
// reset=false wichtig: true wuerde den Blueprint-Cache leeren und damit
// MotivNr/KonturA (Benutzerwahl aus dem Menue) zuruecksetzen.
const navStage = (stageId) => ({ type: 'navigate_stage', name: `Stage -> ${stageId}`, stageId, reset: false });

let uid = 0;
const nid = (p) => `pz_${p}_${(uid++).toString(36)}`;

function baseObj(o) {
    return { draggable: false, droppable: false, collisionEnabled: false, style: {}, events: {}, ...o };
}

function sprite(o) {
    return baseObj({
        className: 'TSprite', spriteColor: 'transparent', appearanceMode: 'simple',
        width: BOX, height: BOX, ...o,
    });
}

function panel(o) {
    return baseObj({
        className: 'TPanel',
        style: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: '#3d4a68', borderWidth: 2, borderRadius: 10, color: '#e2e8f0' },
        ...o, style: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: '#3d4a68', borderWidth: 2, borderRadius: 10, color: '#e2e8f0', ...(o.style || {}) },
    });
}

function label(o) {
    return baseObj({
        className: 'TLabel',
        style: { color: '#e2e8f0', fontSize: 15, ...(o.style || {}) },
        ...o,
    });
}

function button(o) {
    return baseObj({
        className: 'TButton', height: 2,
        style: {
            backgroundColor: '#2f6fed', color: '#ffffff', borderRadius: 8,
            fontSize: 15, fontWeight: '600', borderColor: '#1d4fb8', borderWidth: 1, ...(o.style || {}),
        },
        ...o,
    });
}

const VAR_CLASS = { string: 'TStringVariable', list: 'TListVariable', int: 'TIntegerVariable', real: 'TRealVariable' };
function variable(name, type, value) {
    const jsonType = type === 'int' ? 'integer' : type === 'real' ? 'real' : type;
    return {
        name, type: jsonType, isVariable: true, isService: true, isHiddenInRun: true,
        className: VAR_CLASS[type],
        x: 0.5 + (uid % 8) * 0.0, y: 0.5, width: 4, height: 2,
        draggable: false, droppable: false, collisionEnabled: false, style: {},
        scope: 'global',
        ...(type === 'list' ? { items: value } : { initialValue: value, defaultValue: value, value }),
        id: nid('var_' + name),
    };
}

// ─── Bau ─────────────────────────────────────────────────────────────────────
function build() {
    ensureMotifs();
    const motifs = MOTIF_FILES.map(motifInner);
    const scatter = scatterPositions();

    // Sammelbehaelter je Stage
    const bpObjects = [], bpTasks = [], bpVars = [];
    const menueObjects = [];
    const addBp = (o) => { bpObjects.push(o); return o; };
    const addMenue = (o) => { menueObjects.push(o); return o; };
    const addVar = (v) => { bpVars.push(v); };
    const addTask = (t) => { bpTasks.push({ params: [], triggerMode: 'local-sync', ...t, id: t.id || nid('task') }); };

    // ── Variablen (Blueprint = global, bleiben ueber Stage-Wechsel erhalten) ──
    for (const [n, t, v] of [
        ['Status', 'string', 'menu'], ['Stufe', 'int', 1], ['NLevel', 'int', 6],
        ['RotModus', 'int', 0], ['Fertig', 'int', 0],
        ['KonturA', 'real', 0.6], ['MotivNr', 'int', 1],
        ['DropAufSlot', 'int', 0], ['Beruehrt', 'int', 0], ['Gefunden', 'int', 0],
        ['DragDX', 'real', 0], ['DragDY', 'real', 0],
        ['SelbID', 'string', ''], ['TeilID', 'string', ''], ['SlotID', 'string', ''],
        ['TName', 'string', ''], ['SlName', 'string', ''], ['PN', 'string', ''], ['SN', 'string', ''],
        ['SX', 'real', 0], ['SY', 'real', 0],
        ['HX', 'real', 0], ['HY', 'real', 0], ['NX', 'real', 0], ['NY', 'real', 0],
        ['RR', 'int', 0], ['DD', 'real', 0],
        ['PP', 'int', 0], ['PM', 'int', 0], ['SM', 'int', 0], ['SG', 'int', 0],
        ['RT', 'int', 0], ['OK', 'int', 0], ['Win', 'int', 0],
        ['SBg', 'string', ''], ['BG', 'string', ''], ['InfoTxt', 'string', ''],
    ]) addVar(variable(n, t, v));

    // ── Dienste (Blueprint) ──
    addBp(baseObj({
        className: 'TInputController', name: 'Tastatur', enabled: true,
        isHiddenInRun: true, isService: true, x: 1, y: 1,
        events: { onKeyDown_Escape: 'MenueOeffnen' },
        id: 'pz_tastatur',
    }));
    addBp(baseObj({
        className: 'TStageController', name: 'StageController',
        isHiddenInRun: true, isService: true, x: 1, y: 3,
        id: 'pz_stagectrl',
    }));

    // ── Gewinn-Overlay (Blueprint = global, wird per Task ein-/ausgeblendet) ──
    addBp(panel({ name: 'OverlayGewinn', x: 16, y: 7, width: 20, height: 11, visible: false, zIndex: 3000, style: { backgroundColor: 'rgba(16,30,22,0.96)', borderColor: '#2ecc60', borderWidth: 3, borderRadius: 14, color: '#e2e8f0' } }));
    addBp(label({ name: 'LblGewinn', x: 19, y: 8.5, width: 14, height: 2.4, text: 'Geschafft!', visible: false, zIndex: 3001, style: { color: '#7ee2a8', fontSize: 32, fontWeight: '800' } }));
    addBp(label({ name: 'LblGewinn2', x: 19, y: 11.3, width: 14, height: 1.6, text: 'Das Puzzle ist fertig.', visible: false, zIndex: 3001, style: { fontSize: 15 } }));
    addBp(button({ name: 'BtnNochmal', x: 19, y: 13.4, width: 6.5, height: 2, text: 'Nochmal', visible: false, zIndex: 3001, events: { onClick: 'LevelStarten' }, id: nid('btn') }));
    addBp(button({ name: 'BtnZurueck', x: 26.5, y: 13.4, width: 6.5, height: 2, text: 'Menue', visible: false, zIndex: 3001, events: { onClick: 'MenueOeffnen' }, id: nid('btn') }));

    // ── Gemeinsames Chassis (Blueprint = global, sichtbar auf allen Stages,
    //    im Editor als geerbte Ghosts editierbar nur auf der Blueprint-Stage) ──
    addBp(panel({ name: 'AblageZone', x: 0.7, y: 2.6, width: 20.6, height: 20.7 }));
    addBp(label({ name: 'LblAblage', x: 1.2, y: 2.8, width: 6, height: 1.4, text: 'TEILE', style: { color: '#8fa3c8', fontSize: 13, fontWeight: '700' } }));
    addBp(panel({ name: 'ZielZone', x: 22.5, y: 2.6, width: 28.8, height: 20.7 }));
    addBp(label({ name: 'LblZiel', x: 23, y: 2.8, width: 8, height: 1.4, text: 'HIER BAUEN', style: { color: '#8fa3c8', fontSize: 13, fontWeight: '700' } }));

    addBp(label({ name: 'TitelPuzzle', x: 1, y: 0.3, width: 7, height: 2, text: 'PUZZLE', style: { color: '#ffd54f', fontSize: 26, fontWeight: '800', textShadow: '0 2px 6px rgba(0,0,0,.5)' } }));
    addBp(label({ name: 'InfoZeile', x: 9, y: 0.55, width: 15, height: 1.6, text: 'Stufe waehlen...', style: { fontSize: 15 } }));
    addBp(label({ name: 'LblFortschritt', x: 25, y: 0.55, width: 7, height: 1.6, text: '0 / 0', style: { fontSize: 17, fontWeight: '700', color: '#7ee2a8' } }));
    addBp(label({ name: 'LblKontur', x: 33, y: 0.55, width: 4.5, height: 1.6, text: 'Kontur:', style: { fontSize: 14 } }));
    addBp(baseObj({
        className: 'TSlider', name: 'KonturRegler', x: 37.5, y: 0.55, width: 8, height: 1.7,
        min: 0, max: 100, step: 1, value: 60, orientation: 'horizontal',
        trackColor: '#31405f', fillColor: '#2f6fed', thumbColor: '#ffd54f',
        events: { onChange: 'KonturGeaendert' }, id: nid('slider'),
    }));
    addBp(button({ name: 'BtnNeu', x: 47, y: 0.45, width: 4, height: 1.9, text: 'Menue', events: { onClick: 'MenueOeffnen' }, id: nid('btn') }));

    addBp(label({ name: 'LblMotiv', x: 1, y: 24.3, width: 5, height: 1.5, text: 'Motiv:', style: { fontSize: 14 } }));
    for (let i = 1; i <= 3; i++) {
        addBp(button({ name: `BtnMotiv${i}`, x: 5 + (i - 1) * 3.6, y: 24.2, width: 3.3, height: 1.7, text: `Bild ${i}`, events: { onClick: `MotivWahl${i}` }, id: nid('btn') }));
    }
    addBp(label({ name: 'LblHinweis', x: 17, y: 24.3, width: 30, height: 1.5, text: 'Teil ziehen & ablegen.  Auf Stufe Schwer: Antippen dreht das Teil.', style: { color: '#8fa3c8', fontSize: 13 } }));

    // ── Menue-Stage (HauptStage): nur das Startmenue ──
    // OverlayStart.onStart -> MenueInit feuert beim ersten Laden UND bei jeder
    // Rueckkehr auf diese Stage (onStart feuert bei jedem Stage-Wechsel).
    addMenue(panel({ name: 'OverlayStart', x: 14, y: 4, width: 24, height: 17, zIndex: 3000, events: { onStart: 'MenueInit' }, style: { backgroundColor: 'rgba(16,22,40,0.96)', borderColor: '#ffd54f', borderWidth: 3, borderRadius: 14, color: '#e2e8f0' } }));
    addMenue(label({ name: 'LblStartTitel', x: 18.5, y: 5.5, width: 15, height: 2.4, text: 'PUZZLE', zIndex: 3001, style: { color: '#ffd54f', fontSize: 40, fontWeight: '800' } }));
    addMenue(label({ name: 'LblAnl1', x: 16, y: 8.5, width: 20, height: 1.6, text: 'Ziehe die Teile von links nach rechts', zIndex: 3001, style: { fontSize: 15 } }));
    addMenue(label({ name: 'LblAnl2', x: 16, y: 9.9, width: 20, height: 1.6, text: 'auf die passenden Konturen.', zIndex: 3001, style: { fontSize: 15 } }));
    addMenue(label({ name: 'LblAnl3', x: 16, y: 11.5, width: 20, height: 1.6, text: 'Der Regler oben macht die Kontur heller.', zIndex: 3001, style: { fontSize: 14, color: '#8fa3c8' } }));
    for (let i = 1; i <= 3; i++) {
        addMenue(button({ name: `BtnStart${i}`, x: 16, y: 13.5 + (i - 1) * 2.3, width: 20, height: 1.9, text: LEVELS[i - 1].label, zIndex: 3001, events: { onClick: `StartStufe${i}` }, id: nid('btn') }));
    }

    // ── Level-Stages: je nur eigene Teile, Slots und Listen ──
    const levelStages = [];
    for (const lv of LEVELS) {
        const edges = levelEdges(lv);
        const offX = (6 - lv.p) * (S / 2), offY = (4 - lv.q) * (S / 2);
        const lvObjects = [];
        const pieceIds = [], slotIds = [];
        const pieceRec = {}, slotRec = {};

        // Init-Objekt: feuert onStart bei jedem Betreten der Stage
        lvObjects.push(baseObj({
            className: 'TLabel', name: `LevelInit_${lv.stufe}`, text: '',
            x: 0.2, y: 25.2, width: 1, height: 0.6, visible: false,
            isHiddenInRun: true, isService: true,
            events: { onStart: 'LevelStarten' }, id: nid('init'),
        }));

        for (let r = 0; r < lv.q; r++) {
            for (let c = 0; c < lv.p; c++) {
                const i = r * lv.p + c;
                const pd = piecePath(edges(r, c));
                const pid = `pz_t${lv.stufe}_${i}`, sid = `pz_s${lv.stufe}_${i}`;
                const pname = `Teil_${lv.stufe}_${i}`, sname = `Slot_${lv.stufe}_${i}`;
                const sx = r1(BOARD_X + offX + c * S - M), sy = r1(BOARD_Y + offY + r * S - M);

                const rec = {
                    match: i, name: pname,
                    heimX: scatter[i].x, heimY: scatter[i].y,
                    platziert: 0, rot: 0,
                };
                for (let m = 0; m < motifs.length; m++) {
                    rec['b' + (m + 1)] = pieceSvg(lv, edges, c, r, motifs[m]);
                }
                pieceRec[pid] = rec;
                pieceIds.push(pid);

                const normal = slotSvg(pd, false), gruen = slotSvg(pd, true);
                slotRec[sid] = { match: i, name: sname, sx, sy, gefuellt: 0, normal, gruen };
                slotIds.push(sid);

                lvObjects.push(sprite({
                    name: pname, id: pid, x: scatter[i].x, y: scatter[i].y,
                    backgroundImage: rec.b1, objectFit: 'fill',
                    zIndex: 10,
                    events: {
                        onClick: 'TeilDrehen',
                        onDragStart: 'TeilGenommen',
                        onDragEnd: 'TeilAbgelegt',
                        onTouchStart: 'TouchNehmen',
                        onTouchMove: 'TouchZiehen',
                        onTouchEnd: 'TouchLoslassen',
                    },
                }));
                lvObjects.push(sprite({
                    name: sname, id: sid, x: sx, y: sy,
                    backgroundImage: normal, objectFit: 'fill',
                    zIndex: 5,
                    style: { opacity: 0.6 },
                    events: { onDrop: 'SlotGetroffen' },
                }));
            }
        }

        lvObjects.push(baseObj({
            className: 'TObjectList', name: 'PuzzleListe', x: 0.5, y: 0.5, width: 4, height: 2,
            sourceMode: 'objects', items: pieceIds, recordKey: 'id',
            fields: [
                { name: 'match', type: 'number' },
                { name: 'heimX', type: 'number' }, { name: 'heimY', type: 'number' },
                { name: 'platziert', type: 'number' }, { name: 'rot', type: 'number' },
            ],
            recordData: pieceRec,
            isService: true, isHiddenInRun: true, isVariable: true,
            style: {}, events: {}, id: nid('list'),
        }));
        lvObjects.push(baseObj({
            className: 'TObjectList', name: 'SlotListe', x: 0.5, y: 2.7, width: 4, height: 2,
            sourceMode: 'objects', items: slotIds, recordKey: 'id',
            fields: [
                { name: 'match', type: 'number' },
                { name: 'sx', type: 'number' }, { name: 'sy', type: 'number' },
                { name: 'gefuellt', type: 'number' },
            ],
            recordData: slotRec,
            isService: true, isHiddenInRun: true, isVariable: true,
            style: {}, events: {}, id: nid('list'),
        }));

        levelStages.push({
            id: lv.stageId, name: lv.stageName, type: 'standard',
            objects: lvObjects, tasks: [], actions: [], variables: [], flowCharts: {},
            events: {}, grid: GRID(),
        });
    }

    // ── Tasks (Blueprint = auf allen Stages verfuegbar) ──
    for (let i = 1; i <= 3; i++) {
        addTask({
            name: `StartStufe${i}`, description: `Schwierigkeit ${LEVELS[i - 1].label} waehlen und zur Level-Stage wechseln.`,
            actionSequence: [calc(String(i), 'Stufe'), navStage(LEVELS[i - 1].stageId)],
        });
    }

    addTask({
        name: 'MenueOeffnen', description: 'Zurueck zur Menue-Stage (Escape / Menue-Button).',
        actionSequence: [
            cond('Status', '!=', 'menu', [navStage('stage_menue')]),
        ],
    });

    addTask({
        name: 'MenueInit', description: 'Wird bei jedem Betreten der Menue-Stage ausgefuehrt (OverlayStart.onStart): Menue zeigen, Gewinn-Overlay und Level-HUD ausblenden.',
        actionSequence: [
            calc("'menu'", 'Status'),
            prop({ ...showHide(OV_MENU, true), ...showHide(OV_WIN, false), ...showHide(HUD_LEVEL, false) }),
        ],
    });

    addTask({
        name: 'LevelStarten',
        description: 'Wird bei jedem Betreten einer Level-Stage ausgefuehrt (LevelInit.onStart): Zustand zuruecksetzen, Teile an Heimpositionen, Rotation vorgeben, HUD zeigen.',
        actionSequence: [
            calc('Stufe == 1 ? 6 : (Stufe == 2 ? 12 : 24)', 'NLevel'),
            calc('Stufe == 3 ? 1 : 0', 'RotModus'),
            calc('0', 'Fertig'), calc("'playing'", 'Status'),
            calc('0', 'DropAufSlot'), calc('0', 'Beruehrt'),
            fe('PuzzleListe', [
                rset('PuzzleListe', '${Eintrag.objectId}', 'platziert', '0'),
                calc('Eintrag.name', 'TName'),
                calc('Eintrag.heimX', 'HX'),
                calc('Eintrag.heimY', 'HY'),
                prop({ '${TName}.x': '${HX}', '${TName}.y': '${HY}' }),
                cond('RotModus', '==', 1, [
                    calc('Math.floor(Math.random() * 4) * 90', 'RR'),
                    prop({ '${TName}.rotation': '${RR}' }),
                    rset('PuzzleListe', '${Eintrag.objectId}', 'rot', '${RR}'),
                ], [
                    prop({ '${TName}.rotation': '0' }),
                    rset('PuzzleListe', '${Eintrag.objectId}', 'rot', '0'),
                ]),
            ]),
            fe('SlotListe', [
                rset('SlotListe', '${Eintrag.objectId}', 'gefuellt', '0'),
                calc('Eintrag.name', 'SlName'),
                rget('SlotListe', '${Eintrag.objectId}', 'normal', 'SBg'),
                prop({ '${SlName}.backgroundImage': '${SBg}', '${SlName}.style.opacity': '${KonturA}' }),
            ]),
            runTask('MotivAnwenden'),
            calc("Stufe == 1 ? 'Leicht (3x2)' : (Stufe == 2 ? 'Mittel (4x3)' : 'Schwer (6x4) - antippen dreht!')", 'InfoTxt'),
            prop({
                'InfoZeile.text': '${InfoTxt}',
                'LblFortschritt.text': '0 / ${NLevel}',
                // Menue-Objekte sind auf Level-Stages als geerbte Main-Objekte
                // vorhanden -> explizit ausblenden; HUD einblenden.
                ...showHide(OV_MENU, false), ...showHide(OV_WIN, false),
                ...showHide(HUD_LEVEL, true),
            }),
        ],
    });

    addTask({
        name: 'TeilDrehen', description: 'Klick auf ein Teil: um 90 Grad drehen (nur Stufe mit Rotation).',
        actionSequence: [
            cond('Status', '==', 'playing', [
                cond('RotModus', '==', 1, [
                    calc('self.id', 'SelbID'),
                    rget('PuzzleListe', '${SelbID}', 'platziert', 'PP'),
                    cond('PP', '!=', 1, [
                        rget('PuzzleListe', '${SelbID}', 'rot', 'RT'),
                        calc('(RT + 90) % 360', 'RR'),
                        rset('PuzzleListe', '${SelbID}', 'rot', '${RR}'),
                        prop({ 'self.rotation': '${RR}' }),
                    ]),
                ]),
            ]),
        ],
    });

    addTask({
        name: 'TeilGenommen',
        description: 'DragStart: Teil-ID merken, Drop-Flag zuruecksetzen. WICHTIG: Ohne onDragStart schreibt der Renderer keine sourceId in dataTransfer!',
        actionSequence: [
            cond('Status', '==', 'playing', [
                calc('self.id', 'TeilID'),
                calc('0', 'DropAufSlot'),
            ]),
        ],
    });

    addTask({
        name: 'TeilAbgelegt', description: 'DragEnd: bei Slot-Abwurf nichts tun, sonst Teil parken.',
        actionSequence: [
            cond('Status', '==', 'playing', [
                calc('self.id', 'SelbID'),
                rget('PuzzleListe', '${SelbID}', 'platziert', 'PP'),
                cond('PP', '!=', 1, [
                    cond('DropAufSlot', '==', 1, [
                        calc('0', 'DropAufSlot'),
                    ], [
                        calc('x - self.width / 2', 'NX'),
                        calc('y - self.height / 2', 'NY'),
                        prop({ 'self.x': '${NX}', 'self.y': '${NY}' }),
                        rset('PuzzleListe', '${SelbID}', 'heimX', '${NX}'),
                        rset('PuzzleListe', '${SelbID}', 'heimY', '${NY}'),
                    ]),
                ]),
            ]),
        ],
    });

    addTask({
        name: 'SlotGetroffen', description: 'Desktop-Drop auf Zielplatz -> gemeinsame Pruefung.',
        actionSequence: [
            cond('Status', '==', 'playing', [
                calc('1', 'DropAufSlot'),
                calc('self.id', 'SlotID'),
                calc('sourceId', 'TeilID'),
                runTask('AblegePruefen'),
            ]),
        ],
    });

    addTask({
        name: 'AblegePruefen',
        description: 'Match + Rotation pruefen: richtig = einrasten & Kontur gruen, falsch = zurueck.',
        actionSequence: [
            rget('PuzzleListe', '${TeilID}', 'platziert', 'PP'),
            rget('PuzzleListe', '${TeilID}', 'match', 'PM'),
            rget('PuzzleListe', '${TeilID}', 'rot', 'RT'),
            rget('PuzzleListe', '${TeilID}', 'name', 'PN'),
            rget('SlotListe', '${SlotID}', 'match', 'SM'),
            rget('SlotListe', '${SlotID}', 'gefuellt', 'SG'),
            rget('SlotListe', '${SlotID}', 'name', 'SN'),
            calc('(PP != 1 && SG != 1 && PM == SM && (RotModus == 0 || RT % 360 == 0)) ? 1 : 0', 'OK'),
            cond('OK', '==', 1, [
                rget('SlotListe', '${SlotID}', 'sx', 'SX'),
                rget('SlotListe', '${SlotID}', 'sy', 'SY'),
                rget('SlotListe', '${SlotID}', 'gruen', 'SBg'),
                prop({ '${PN}.x': '${SX}', '${PN}.y': '${SY}' }),
                cond('RotModus', '==', 1, [prop({ '${PN}.rotation': '0' })]),
                rset('PuzzleListe', '${TeilID}', 'platziert', '1'),
                rset('SlotListe', '${SlotID}', 'gefuellt', '1'),
                prop({ '${SN}.backgroundImage': '${SBg}', '${SN}.style.opacity': '1' }),
                calc('Fertig + 1', 'Fertig'),
                prop({ 'LblFortschritt.text': '${Fertig} / ${NLevel}' }),
                calc('Fertig >= NLevel ? 1 : 0', 'Win'),
                cond('Win', '==', 1, [runTask('Gewonnen')]),
            ], [
                rget('PuzzleListe', '${TeilID}', 'heimX', 'HX'),
                rget('PuzzleListe', '${TeilID}', 'heimY', 'HY'),
                prop({ '${PN}.x': '${HX}', '${PN}.y': '${HY}' }),
            ]),
        ],
    });

    addTask({
        name: 'TouchNehmen', description: 'Touch: Teil aufnehmen, Greif-Offset merken.',
        actionSequence: [
            cond('Status', '==', 'playing', [
                calc('self.id', 'SelbID'),
                rget('PuzzleListe', '${SelbID}', 'platziert', 'PP'),
                cond('PP', '!=', 1, [
                    calc('1', 'Beruehrt'),
                    calc('x - self.x', 'DragDX'),
                    calc('y - self.y', 'DragDY'),
                ]),
            ]),
        ],
    });

    addTask({
        name: 'TouchZiehen', description: 'Touch: Teil dem Finger folgen lassen.',
        actionSequence: [
            cond('Beruehrt', '==', 1, [
                cond('Status', '==', 'playing', [
                    calc('self.id', 'SelbID'),
                    rget('PuzzleListe', '${SelbID}', 'platziert', 'PP'),
                    cond('PP', '!=', 1, [
                        calc('x - DragDX', 'NX'),
                        calc('y - DragDY', 'NY'),
                        prop({ 'self.x': '${NX}', 'self.y': '${NY}' }),
                    ]),
                ]),
            ]),
        ],
    });

    addTask({
        name: 'TouchLoslassen',
        description: 'Touch-Ende: Slot unter dem Teil suchen, sonst parken.',
        actionSequence: [
            cond('Status', '==', 'playing', [
                calc('0', 'Beruehrt'),
                calc('self.id', 'SelbID'),
                rget('PuzzleListe', '${SelbID}', 'platziert', 'PP'),
                cond('PP', '!=', 1, [
                    calc('0', 'Gefunden'),
                    fe('SlotListe', [
                        cond('Gefunden', '==', 0, [
                            calc('Math.abs(self.x - Eintrag.sx) + Math.abs(self.y - Eintrag.sy)', 'DD'),
                            cond('DD', '<=', 1.5, [
                                calc('1', 'Gefunden'),
                                calc('Eintrag.objectId', 'SlotID'),
                                calc('self.id', 'TeilID'),
                                runTask('AblegePruefen'),
                            ]),
                        ]),
                    ]),
                    cond('Gefunden', '==', 0, [
                        calc('self.x', 'HX'),
                        calc('self.y', 'HY'),
                        rset('PuzzleListe', '${SelbID}', 'heimX', '${HX}'),
                        rset('PuzzleListe', '${SelbID}', 'heimY', '${HY}'),
                    ]),
                ]),
            ]),
        ],
    });

    addTask({
        name: 'KonturGeaendert', description: 'Slider: Transparenz aller freien Zielkonturen setzen.',
        actionSequence: [
            calc('value / 100', 'KonturA'),
            cond('Status', '==', 'playing', [
                fe('SlotListe', [
                    cond('Eintrag.gefuellt', '!=', 1, [
                        calc('Eintrag.name', 'SN'),
                        prop({ '${SN}.style.opacity': '${KonturA}' }),
                    ]),
                ]),
            ]),
        ],
    });

    // Motiv auf alle Teile der aktiven Stage anwenden (record_get.field wird
    // nicht interpoliert, darum drei feste Zweige statt 'b${MotivNr}').
    addTask({
        name: 'MotivAnwenden', description: 'Aktuelles Motiv (MotivNr) auf alle Teile der Stage anwenden.',
        actionSequence: [
            fe('PuzzleListe', [
                calc('Eintrag.name', 'PN'),
                cond('MotivNr', '==', 1, [
                    rget('PuzzleListe', '${Eintrag.objectId}', 'b1', 'BG'),
                    prop({ '${PN}.backgroundImage': '${BG}' }),
                ]),
                cond('MotivNr', '==', 2, [
                    rget('PuzzleListe', '${Eintrag.objectId}', 'b2', 'BG'),
                    prop({ '${PN}.backgroundImage': '${BG}' }),
                ]),
                cond('MotivNr', '==', 3, [
                    rget('PuzzleListe', '${Eintrag.objectId}', 'b3', 'BG'),
                    prop({ '${PN}.backgroundImage': '${BG}' }),
                ]),
            ]),
        ],
    });

    for (let i = 1; i <= 3; i++) {
        addTask({
            name: `MotivWahl${i}`, description: `Motiv ${i} merken; im laufenden Level sofort anwenden.`,
            actionSequence: [
                calc(String(i), 'MotivNr'),
                cond('Status', '==', 'playing', [runTask('MotivAnwenden')]),
            ],
        });
    }

    addTask({
        name: 'Gewonnen', description: 'Alle Teile liegen: Gewinn-Overlay zeigen.',
        actionSequence: [
            calc("'won'", 'Status'),
            prop({ ...showHide(OV_WIN, true) }),
        ],
    });

    // ── Projekt ──
    const project = {
        meta: {
            id: 'puzzle', name: 'Puzzle', version: '2.0.0',
            author: 'Rolf Rieckmann / Devin',
            description: 'Puzzle im Memory-Stil auf 5 Stages: Blueprint (Variablen, Dienste, Chassis, Gewinn, Tasks), Menue (HauptStage) + je eine Stage pro Schwierigkeitsgrad. Jigsaw-Noppen, Drehen per Klick, Kontur-Slider, Motivwahl. Drag & Drop + Touch.',
        },
        stage: { grid: GRID() },
        stages: [
            {
                id: 'stage_blueprint', name: 'Globale Dienste + Chassis', type: 'blueprint',
                objects: bpObjects, tasks: bpTasks, actions: [], variables: bpVars, flowCharts: {},
                events: {}, grid: GRID(),
            },
            {
                id: 'stage_menue', name: 'Menue', type: 'main',
                objects: menueObjects, tasks: [], actions: [], variables: [], flowCharts: {},
                events: {}, grid: GRID(),
            },
            ...levelStages,
        ],
        objects: [], actions: [], tasks: [], variables: [],
        activeStageId: 'stage_menue',
        userStories: [
            {
                id: 'us-puzzle-1', title: 'Puzzle zusammensetzen',
                description: 'Als Spieler moechte ich gemischte Teile per Drag & Drop auf die Zielkonturen legen.',
                acceptanceCriteria: ['Teile sind links gemischt', 'Drop auf passenden Slot rastet ein', 'Falsches Teil springt zurueck', 'Kontur wird bei Treffer gruen'],
                tasks: ['LevelStarten', 'AblegePruefen', 'SlotGetroffen'],
            },
            {
                id: 'us-puzzle-2', title: 'Schwierigkeit & Rotation',
                description: 'Drei Stufen: 3x2, 4x3, 6x4 mit Jigsaw-Noppen und Drehen per Klick.',
                acceptanceCriteria: ['Stufenwahl im Startmenue', 'Schwer dreht Teile zufaellig', 'Nur korrekt gedrehte Teile rasten ein'],
                tasks: ['StartStufe1', 'StartStufe2', 'StartStufe3', 'TeilDrehen'],
            },
            {
                id: 'us-puzzle-3', title: 'Kontur & Motiv einstellen',
                description: 'Konturstaerke per Slider, Motiv per Knopf wechseln.',
                acceptanceCriteria: ['Slider stellt Kontur-Transparenz ein', 'Geloeste Konturen bleiben gruen', 'Drei Motive waehlbar'],
                tasks: ['KonturGeaendert', 'MotivWahl1', 'MotivWahl2', 'MotivWahl3'],
            },
        ],
    };

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(project, null, 2), 'utf8');
    const kb = Math.round(fs.statSync(OUT).size / 1024);
    const nPieces = LEVELS.reduce((a, l) => a + l.p * l.q, 0);
    console.log(`Puzzle.json geschrieben: ${OUT}`);
    console.log(`  Stages: ${project.stages.length} | Menue: ${menueObjects.length} | Blueprint-Objekte: ${bpObjects.length} | Tasks: ${bpTasks.length} | Variablen: ${bpVars.length} | ${kb} KB`);
    console.log(`  Teile gesamt: ${nPieces} (verteilt auf ${levelStages.length} Level-Stages) | Motive: ${motifs.length}`);
}

build();

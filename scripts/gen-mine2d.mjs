/**
 * Generator fuer Mine2D.json — Minecraft-aehnliches 2D-Spiel (Seitenansicht).
 *
 * Architektur (nur GCS-Bordmittel):
 *  - "Bloecke" (TGridBoard, 140x30) ist die gesamte Welt — Kind von "Welt"
 *    (TGroupPanel) und scrollt per Welt.x UND Welt.y (Graben nach unten!).
 *  - "Steve" (TSprite): Grid-Physik im Frame-Task ueber call_method getCell —
 *    abgebaute Zellen veraendern die Physik automatisch.
 *  - Abbauen/Setzen: Bloecke.events.onCellClick -> Task "ZellKlick"
 *    ({x,y,value} kommen als Event-Variablen).
 *  - Mobs: TSpriteTemplates (Zombie/Creeper/Schwein), Positionen werden
 *    record-getrieben in "MobListe" (TObjectList, records-Modus) gefuehrt und
 *    im MobTakt auf die Pool-Instanzen geschrieben.
 *  - "Rucksack" (TObjectList, objects-Modus): sichtbares Inventar;
 *    Zaehler stehen in recordData.anzahl (record_get/record_set).
 *  - Hotbar: Slot1..Slot9 (TSprites mit Block-SVGs), Tasten 1-9.
 *
 * Palette: 0 Luft, 1 Gras, 2 Erde, 3 Stein, 4 Holz, 5 Blatt, 6 Sand,
 *          7 Kohle, 8 Eisen, 9 Diamant, 10 Bedrock, 11 Wasser, 12 Blume.
 * Fest (begehbar-blockierend): v != 0 && v != 11 && v != 12  (inkl. -1 = Rand).
 *
 * Ausfuehren: node scripts/gen-mine2d.mjs
 */
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const DIR = dirname(fileURLToPath(import.meta.url));
const OUT = join(DIR, '../game-server/public/projects/Mine2D.json');

// ─── Konstanten ───
const VIEW = 40;            // sichtbare Spalten
const VIEW_H = 22;          // sichtbare Zeilen
const COLS = 140, ROWS = 30;
const GRAV = 1.5;           // Zellen/Frame-System wie Mario (velocity in Zellen/Frame)
const TEMPO = 0.13;
const SPRUNG = -0.33;       // Ziel: ~1.3 Zellen (1 Block + Puffer)
const DECKEL = 0.45;        // max Fallgeschwindigkeit (< 1 Zelle => kein Tunneln)
const BOUNCE = -0.15;
const KAM_X = 14, KAM_Y = 10;
const WELT_MIN_X = VIEW - COLS;   // -100
const WELT_MIN_Y = VIEW_H - ROWS; // -8
const REICH = 4;
const MOB_SCHRITT = 0.35;   // Fall-Schritt pro MobTakt (Zellen)

// ─── SVG-Helfer (Pixel-Art wie bei Mario) ───
const R = (x, y, w, h, f) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}"/>`;
const svg = (w, h, rects) => 'data:image/svg+xml;base64,' +
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${rects}</svg>`).toString('base64');

// Menschen-Silhouette 16x32 (Kopf 8x8, Rumpf 8x12, Beine 8x12, Arme 2x12)
const figur = (haut, haar, hemd, hose) => svg(16, 32, [
    R(4, 0, 8, 2, haar), R(3, 1, 1, 3, haar), R(12, 1, 1, 3, haar),
    R(4, 2, 8, 6, haut),
    R(5, 4, 1, 1, '#fff'), R(6, 4, 1, 1, '#5b3fbf'), R(9, 4, 1, 1, '#fff'), R(10, 4, 1, 1, '#5b3fbf'),
    R(7, 6, 2, 1, '#8a5a30'),
    R(4, 8, 8, 11, hemd), R(1, 8, 3, 3, hemd), R(12, 8, 3, 3, hemd),
    R(1, 11, 3, 9, haut), R(12, 11, 3, 9, haut),
    R(4, 19, 4, 11, hose), R(8, 19, 4, 11, hose),
    R(4, 30, 4, 2, '#4d4d4d'), R(8, 30, 4, 2, '#4d4d4d'),
].join(''));

const SVG_STEVE = figur('#c68d5e', '#2e1f14', '#00a0a0', '#3c44a0');
const SVG_ZOMBIE = figur('#4e9c45', '#2e4a1e', '#2a6e6e', '#3a3a8a');

// Creeper 16x32 — grosser Kopf mit ikonischem Gesicht, mottled gruen
const SVG_CREEPER = svg(16, 32, [
    R(2, 0, 12, 12, '#57a832'), R(3, 2, 2, 2, '#478f28'), R(10, 1, 2, 2, '#478f28'),
    R(4, 4, 3, 3, '#111'), R(9, 4, 3, 3, '#111'),
    R(6, 7, 4, 3, '#111'), R(5, 9, 2, 3, '#111'), R(9, 9, 2, 3, '#111'),
    R(4, 12, 8, 14, '#57a832'), R(5, 14, 2, 2, '#478f28'), R(9, 18, 2, 2, '#478f28'), R(6, 22, 2, 2, '#478f28'),
    R(4, 26, 4, 6, '#3d8a20'), R(8, 26, 4, 6, '#3d8a20'),
    R(4, 28, 4, 4, '#2e6e18'), R(8, 28, 4, 4, '#2e6e18'),
].join(''));

// Schwein 20x14
const SVG_SCHWEIN = svg(20, 14, [
    R(0, 3, 15, 8, '#eda0ab'), R(14, 1, 6, 8, '#eda0ab'),
    R(17, 4, 3, 3, '#e0788a'), R(15, 3, 1, 1, '#222'),
    R(2, 11, 2, 3, '#c97e88'), R(6, 11, 2, 3, '#c97e88'),
    R(10, 11, 2, 3, '#c97e88'), R(14, 11, 2, 3, '#c97e88'),
].join(''));

// Wolke 24x8
const SVG_WOLKE = svg(24, 8, [
    R(4, 2, 16, 4, '#ffffff'), R(2, 4, 20, 3, '#ffffff'), R(6, 1, 8, 2, '#ffffff'),
].join(''));

// Block-Icons 8x8 (Hotbar)
const speck = (f, coords) => coords.map(([x, y]) => R(x, y, 1, 1, f)).join('');
const BLOCK_SVG = {
    1: svg(8, 8, [R(0, 0, 8, 2, '#6abf3a'), R(0, 2, 8, 6, '#8a5a2e'), speck('#7a4a24', [[1, 4], [5, 3], [3, 6], [6, 5]])].join('')),
    2: svg(8, 8, [R(0, 0, 8, 8, '#8a5a2e'), speck('#7a4a24', [[1, 2], [5, 1], [3, 5], [6, 4], [2, 7]])].join('')),
    3: svg(8, 8, [R(0, 0, 8, 8, '#8f8f8f'), speck('#6f6f6f', [[1, 1], [5, 3], [2, 6], [6, 5], [4, 7]])].join('')),
    4: svg(8, 8, [R(0, 0, 8, 8, '#6b4a26'), R(2, 0, 1, 8, '#54371b'), R(5, 0, 1, 8, '#54371b')].join('')),
    5: svg(8, 8, [R(0, 0, 8, 8, '#2e7d1e'), speck('#1e5c12', [[1, 2], [4, 1], [6, 4], [2, 6], [5, 6]])].join('')),
    6: svg(8, 8, [R(0, 0, 8, 8, '#e8d9a0'), speck('#cbbc85', [[1, 1], [4, 3], [6, 2], [2, 5], [5, 6]])].join('')),
    7: svg(8, 8, [R(0, 0, 8, 8, '#8f8f8f'), speck('#2a2a2e', [[2, 2], [5, 1], [3, 5], [6, 6], [1, 6]])].join('')),
    8: svg(8, 8, [R(0, 0, 8, 8, '#8f8f8f'), speck('#d8b48a', [[2, 2], [5, 1], [3, 5], [6, 6], [1, 6]])].join('')),
    9: svg(8, 8, [R(0, 0, 8, 8, '#8f8f8f'), speck('#45d8d0', [[2, 2], [5, 1], [3, 5], [6, 6], [1, 6]])].join('')),
};

// ─── Palette (Index -> Farbe/Name) ───
const PAL = ['#0b1020', '#6abf3a', '#8a5a2e', '#8f8f8f', '#6b4a26', '#2e7d1e',
    '#e8d9a0', '#3a3a3f', '#a89078', '#3bc9c6', '#1d1d24', '#3f6fd8', '#e84a4a'];
const NAMEN = ['', 'Gras', 'Erde', 'Stein', 'Holz', 'Blatt', 'Sand',
    'Kohle', 'Eisen', 'Diamant', 'Bedrock', 'Wasser', 'Blume'];
// fest = blockierend (Wasser/Blume begehbar); -1 (ausserhalb) zaehlt als fest
const FEST = v => `(${v} != 0 && ${v} != 11 && ${v} != 12)`;
const HIMMEL_TAG = '#7ec8f7', HIMMEL_NACHT = '#0e1a3c';

// ─── Weltgenerierung (deterministisch via LCG) ───
let seed = 20260913;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

const cells = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
const h = new Array(COLS);
for (let x = 0; x < COLS; x++) {
    h[x] = Math.round(14 + Math.sin(x * 0.11) * 1.5 + Math.sin(x * 0.29 + 1.7) * 1.1 + (rnd() - 0.5) * 1.6);
    h[x] = Math.max(11, Math.min(17, h[x]));
}
for (let x = 5; x <= 14; x++) h[x] = 14;                       // Spawn-Ebene
for (let x = 98; x <= 104; x++) h[x] += 3;                      // Teich-Mulde

for (let x = 0; x < COLS; x++) {
    for (let y = h[x]; y < ROWS; y++) {
        cells[y][x] = y === h[x] ? 1 : (y < h[x] + 4 ? 2 : 3);
    }
    cells[ROWS - 1][x] = 10;
    if (rnd() < 0.75) cells[ROWS - 2][x] = 10;
}
// Erze (nur in Stein)
for (let x = 0; x < COLS; x++) for (let y = h[x] + 4; y < ROWS - 2; y++) {
    if (cells[y][x] !== 3) continue;
    const d = y - h[x];
    const r = rnd();
    if (d < 12 && r < 0.05) cells[y][x] = 7;
    else if (d >= 9 && r < 0.035) cells[y][x] = 8;
    else if (y >= 23 && r < 0.018) cells[y][x] = 9;
}
// Höhlen (Ellipsen im Stein)
for (let i = 0; i < 9; i++) {
    const cx = Math.floor(rnd() * (COLS - 20)) + 10, cy = 18 + Math.floor(rnd() * 8);
    const rx = 2 + Math.floor(rnd() * 4), ry = 1 + Math.floor(rnd() * 2);
    for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) {
        if (x < 0 || x >= COLS || y < 0 || y >= ROWS - 2) continue;
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1 && cells[y][x] !== 10) cells[y][x] = 0;
    }
}
// Teich: Mulde mit Wasser + Sand
for (let x = 98; x <= 104; x++) {
    for (let y = h[x] - 3; y < h[x]; y++) if (y >= 0) cells[y][x] = 0;
    cells[h[x]][x] = 6; cells[h[x] + 1][x] = 6;
    cells[h[x] - 1][x] = 11; cells[h[x] - 2][x] = 11;
}
// Baeume
const baum = (x) => {
    const s = h[x], th = 3 + Math.floor(rnd() * 2);
    for (let i = 1; i <= th; i++) cells[s - i][x] = 4;
    for (let dy = th + 2; dy >= th; dy--) for (let dx = -1; dx <= 1; dx++) {
        if (cells[s - dy]?.[x + dx] === 0) cells[s - dy][x + dx] = 5;
    }
    if (cells[s - th - 3]?.[x] === 0) cells[s - th - 3][x] = 5;
    if (cells[s - th - 2]?.[x - 2] === 0) cells[s - th - 2][x - 2] = 5;
    if (cells[s - th - 2]?.[x + 2] === 0) cells[s - th - 2][x + 2] = 5;
};
[20, 33, 47, 62, 78, 92, 112, 127].forEach(baum);
// Blumen
for (let x = 0; x < COLS; x++) if (cells[h[x] - 1]?.[x] === 0 && rnd() < 0.1) cells[h[x] - 1][x] = 12;

// ─── Mobs (Spawn-Liste -> MobListe recordData, Pool-Namen deterministisch) ───
// TObjectList im objects-Modus: items = Zeilen-IDs, recordData[id] = Feldwerte.
// data-Zeilen = {index, objectId, name, ...recordData[id]} -> Eintrag.objectId
// ist die Zeilen-ID fuer record_get/record_set!
const mobItems = [];
const mobData = {};
const mobZaehler = {};
const mob = (tpl, art, x, speed, w, mh) => {
    const id = 'm' + mobItems.length;
    const n = mobZaehler[tpl] = (mobZaehler[tpl] || 0);
    mobZaehler[tpl]++;
    mobItems.push(id);
    mobData[id] = { tpl, n, art, x, y: h[Math.round(x)] - mh, dir: -1, speed, w, h: mh };
};
mob('TplZombie', 'zombie', 30, 0.12, 0.9, 1.8);
mob('TplZombie', 'zombie', 55, 0.12, 0.9, 1.8);
mob('TplZombie', 'zombie', 80, 0.12, 0.9, 1.8);
mob('TplZombie', 'zombie', 110, 0.12, 0.9, 1.8);
mob('TplZombie', 'zombie', 125, 0.12, 0.9, 1.8);
mob('TplCreeper', 'creeper', 70, 0.14, 0.9, 1.8);
mob('TplCreeper', 'creeper', 120, 0.14, 0.9, 1.8);
mob('TplSchwein', 'schwein', 18, 0.06, 1.1, 0.9);
mob('TplSchwein', 'schwein', 45, 0.06, 1.1, 0.9);
mob('TplSchwein', 'schwein', 95, 0.06, 1.1, 0.9);

// ─── Helfer: Actions/Tasks ───
const act = (name, body) => ({ name, ...body });
const prop = (name, changes) => act(name, { type: 'property', changes });
const calc = (name, formula, resultVariable) =>
    act(name, { type: 'calculate', formula, resultVariable });
const call = (name, target, method, params, resultVariable) =>
    act(name, { type: 'call_method', target, method, params, resultVariable });
const cond = (variable, operator, value, then, els = []) => ({
    type: 'condition', name: `Branch: ${variable} ${operator} ${value}`,
    condition: { variable, operator, value }, then, else: els
});
const taskRef = name => ({ type: 'task', name });
const actRef = name => ({ type: 'action', name });
const task = (name, description, actionSequence) => ({
    name, description, actionSequence, triggerMode: 'local-sync', params: [], id: 'm2d_' + name.toLowerCase()
});

// ─── Actions ───
const actions = [
    prop('Act_StartWerte', {
        Status: 'playing', Leben: 5, TasteLinks: 0, TasteRechts: 0,
        AmBoden: 0, Unbesiegbar: 0, Nacht: 0
    }),
    prop('Act_SteveReset', {
        'Steve.x': 8, 'Steve.y': 12.1, 'Steve.velocityX': 0, 'Steve.velocityY': 0,
        'Steve.visible': 1
    }),
    prop('Act_GravAn', { 'Steve.gravity': GRAV }),
    prop('Act_WeltReset', { 'Welt.x': 0, 'Welt.y': 0 }),
    prop('Act_InfoAus', { 'LblInfo.visible': 0, 'LblEnde.visible': 0 }),
    prop('Act_TakteAn', { 'FrameTakt.enabled': 1, 'MobTakt.enabled': 1, 'TagTakt.enabled': 1 }),
    prop('Act_TakteAus', { 'FrameTakt.enabled': 0, 'MobTakt.enabled': 0, 'TagTakt.enabled': 0 }),
    prop('Act_LinksAn', { TasteLinks: 1, TasteRechts: 0 }),
    prop('Act_LinksAus', { TasteLinks: 0 }),
    prop('Act_RechtsAn', { TasteRechts: 1, TasteLinks: 0 }),
    prop('Act_RechtsAus', { TasteRechts: 0 }),
    prop('Act_Sprung', { 'Steve.velocityY': SPRUNG, AmBoden: 0 }),
    prop('Act_FallDeckel', { 'Steve.velocityY': DECKEL }),
    calc('Act_VX', `TasteRechts == 1 ? ${TEMPO} : (TasteLinks == 1 ? -${TEMPO} : 0)`, 'Steve.velocityX'),
    calc('Act_KamX', `Math.min(0, Math.max(${WELT_MIN_X}, ${KAM_X} - Steve.x))`, 'Welt.x'),
    calc('Act_KamY', `Math.min(0, Math.max(${WELT_MIN_Y}, ${KAM_Y} - Steve.y))`, 'Welt.y'),

    // ── Grid-Physik: Proben-Koordinaten ──
    calc('Act_FX1', 'Math.floor(Steve.x + 0.08)', 'FX1'),
    calc('Act_FX2', 'Math.floor(Steve.x + Steve.width - 0.08)', 'FX2'),
    calc('Act_FYF', 'Math.floor(Steve.y + Steve.height)', 'FYF'),
    call('Act_ZelleFussL', 'Bloecke', 'getCell', ['${FX1}', '${FYF}'], 'Z1'),
    call('Act_ZelleFussR', 'Bloecke', 'getCell', ['${FX2}', '${FYF}'], 'Z2'),
    calc('Act_FestB', `${FEST('Z1')} || ${FEST('Z2')}`, 'FestB'),
    calc('Act_LandY', 'FYF - Steve.height', 'Steve.y'),
    prop('Act_LandStopp', { 'Steve.velocityY': 0, AmBoden: 1 }),
    prop('Act_BodenWeg', { AmBoden: 0 }),
    calc('Act_HYF', 'Math.floor(Steve.y)', 'HYF'),
    call('Act_ZelleKopfL', 'Bloecke', 'getCell', ['${FX1}', '${HYF}'], 'Z3'),
    call('Act_ZelleKopfR', 'Bloecke', 'getCell', ['${FX2}', '${HYF}'], 'Z4'),
    calc('Act_FestK', `${FEST('Z3')} || ${FEST('Z4')}`, 'FestK'),
    calc('Act_KopfY', 'HYF + 1', 'Steve.y'),
    prop('Act_KopfStopp', { 'Steve.velocityY': 0 }),
    calc('Act_WXR', 'Math.floor(Steve.x + Steve.width)', 'WXF'),
    calc('Act_WXL', 'Math.floor(Steve.x)', 'WXF'),
    calc('Act_RYO', 'Math.floor(Steve.y + 0.15)', 'RYO'),
    calc('Act_RYU', 'Math.floor(Steve.y + Steve.height - 0.2)', 'RYU'),
    call('Act_ZelleWandO', 'Bloecke', 'getCell', ['${WXF}', '${RYO}'], 'Z5'),
    call('Act_ZelleWandU', 'Bloecke', 'getCell', ['${WXF}', '${RYU}'], 'Z6'),
    calc('Act_FestW', `${FEST('Z5')} || ${FEST('Z6')}`, 'FestW'),
    calc('Act_WandRX', 'WXF - Steve.width - 0.001', 'Steve.x'),
    calc('Act_WandLX', 'WXF + 1 + 0.001', 'Steve.x'),
    prop('Act_WandStopp', { 'Steve.velocityX': 0 }),
    prop('Act_KlammereX0', { 'Steve.x': 0 }),
    calc('Act_KlammereX1', `${COLS} - Steve.width`, 'Steve.x'),

    // ── Abbauen / Setzen (onCellClick liefert x,y,value) ──
    calc('Act_Reich', `Math.abs(x - Steve.x - 0.45) <= ${REICH} && Math.abs(y - Steve.y - 1) <= ${REICH}`, 'InReich'),
    calc('Act_FreiVonSteve',
        '!(x >= Math.floor(Steve.x) && x <= Math.floor(Steve.x + 0.9) && y >= Math.floor(Steve.y) && y <= Math.floor(Steve.y + 1.9))',
        'FreiVonSteve'),
    call('Act_ZelleLoeschen', 'Bloecke', 'setCell', ['${x}', '${y}', 0]),
    call('Act_ZelleSetzen', 'Bloecke', 'setCell', ['${x}', '${y}', '${Ausgewaehlt}']),
    act('Act_BlockName', { type: 'list_get', target: 'BlockNamen', index: '${value}', resultVariable: 'Zeile' }),
    act('Act_WahlName', { type: 'list_get', target: 'BlockNamen', index: '${Ausgewaehlt}', resultVariable: 'Zeile' }),
    act('Act_AnzahlLesen', { type: 'record_get', list: 'Rucksack', target: '${Zeile}', field: 'anzahl', resultVariable: 'Anz' }),
    calc('Act_AnzPlus', 'Anz + 1', 'Anz'),
    calc('Act_AnzMinus', 'Anz - 1', 'Anz'),
    act('Act_AnzahlSchreiben', { type: 'record_set', list: 'Rucksack', target: '${Zeile}', field: 'anzahl', value: '${Anz}' }),

    // ── Mobs ──
    // Records sind Snapshots: Schreiben NUR ueber record_set (target
    // Eintrag.objectId). Lokale Arbeitswerte: MobXNeu/MobYNeu/MobDirN.
    calc('Act_MobName', 'Eintrag.tpl + "_pool_" + Eintrag.n', 'MobName'),
    calc('Act_MobX0', 'Eintrag.x', 'MobXNeu'),
    calc('Act_MobY0', 'Eintrag.y', 'MobYNeu'),
    calc('Act_MobD0', 'Eintrag.dir', 'MobDirN'),
    calc('Act_MXF', 'Math.floor(Eintrag.x + Eintrag.w / 2)', 'MXF'),
    calc('Act_MYF', 'Math.floor(Eintrag.y + Eintrag.h)', 'MYF'),
    call('Act_MobZelleBoden', 'Bloecke', 'getCell', ['${MXF}', '${MYF}'], 'ZM'),
    calc('Act_FestM', FEST('ZM'), 'FestM'),
    calc('Act_MobBodenY', 'MYF - Eintrag.h', 'MobYNeu'),
    calc('Act_MobFall', `MobYNeu + ${MOB_SCHRITT}`, 'MobYNeu'),
    calc('Act_MobDX', 'Steve.x - Eintrag.x', 'MDX'),
    calc('Act_MobAbsDX', 'Math.abs(MDX)', 'MAbsDX'),
    calc('Act_MobDirSteve', 'Math.sign(MDX) || MobDirN', 'MobDirN'),
    calc('Act_MWX', 'Math.floor(MobXNeu + (MobDirN > 0 ? Eintrag.w + 0.05 : -0.05))', 'MWX'),
    calc('Act_MWY', 'Math.floor(MobYNeu + Eintrag.h - 0.5)', 'MWY'),
    call('Act_MobZelleWand', 'Bloecke', 'getCell', ['${MWX}', '${MWY}'], 'ZW'),
    calc('Act_FestMW', FEST('ZW'), 'FestMW'),
    calc('Act_MWY1', 'MWY - 1', 'MWY1'),
    calc('Act_MWY2', 'MWY - 2', 'MWY2'),
    call('Act_MobZelleOben1', 'Bloecke', 'getCell', ['${MWX}', '${MWY1}'], 'ZW1'),
    call('Act_MobZelleOben2', 'Bloecke', 'getCell', ['${MWX}', '${MWY2}'], 'ZW2'),
    calc('Act_FreiMW', `!${FEST('ZW1')} && !${FEST('ZW2')}`, 'FreiMW'),
    calc('Act_MobStufe', 'MWY - Eintrag.h', 'MobYNeu'),
    calc('Act_MobUmkehren', 'MobDirN * -1', 'MobDirN'),
    calc('Act_MobSchritt', 'MobXNeu + MobDirN * Eintrag.speed', 'MobXNeu'),
    calc('Act_MobRand', 'MobXNeu < 0.2 || MobXNeu > ' + (COLS - 2) + ' ? MobDirN * -1 : MobDirN', 'MobDirN'),
    calc('Act_MobRandX', 'Math.min(' + (COLS - 1.5) + ', Math.max(0.2, MobXNeu))', 'MobXNeu'),
    act('Act_MobSX', { type: 'record_set', list: 'MobListe', target: '${Eintrag.objectId}', field: 'x', value: '${MobXNeu}' }),
    act('Act_MobSY', { type: 'record_set', list: 'MobListe', target: '${Eintrag.objectId}', field: 'y', value: '${MobYNeu}' }),
    act('Act_MobSD', { type: 'record_set', list: 'MobListe', target: '${Eintrag.objectId}', field: 'dir', value: '${MobDirN}' }),
    prop('Act_MobSync', { '${MobName}.x': '${MobXNeu}', '${MobName}.y': '${MobYNeu}' }),

    // ── Creeper-Explosion (3x3 via Offsets, Bedrock bleibt) ──
    calc('Act_BoomX', 'Math.floor(BoomMitte)', 'BX'),
    calc('Act_BoomY', 'Math.floor(BoomFuss)', 'BY'),
    calc('Act_BoomTX', 'BX + Off.dx', 'TX'),
    calc('Act_BoomTY', 'BY + Off.dy', 'TY'),
    call('Act_BoomLesen', 'Bloecke', 'getCell', ['${TX}', '${TY}'], 'ZB'),
    call('Act_BoomLoeschen', 'Bloecke', 'setCell', ['${TX}', '${TY}', 0]),
    calc('Act_NahX', 'Math.abs(Steve.x + 0.45 - BoomMitte)', 'NahX'),
    calc('Act_NahY', 'Math.abs(Steve.y + 1 - BoomFuss)', 'NahY'),
    calc('Act_LebenMinus1', 'Leben - 1', 'Leben'),
    calc('Act_LebenMinus2', 'Leben - 2', 'Leben'),
    prop('Act_UnbesiegbarAn', { Unbesiegbar: 1, 'UnsichtbarTakt.enabled': 1 }),
    prop('Act_UnbesiegbarAus', { Unbesiegbar: 0, 'UnsichtbarTakt.enabled': 0 }),
    prop('Act_Rueckstoss', { 'Steve.velocityY': -0.28 }),
    prop('Act_Bounce', { 'Steve.velocityY': BOUNCE }),
    prop('Act_EndeTot', {
        Status: 'tot', 'Steve.velocityX': 0, 'Steve.velocityY': 0,
        'LblEnde.text': 'DU BIST GESTORBEN!\nENTER = Neustart', 'LblEnde.visible': 1
    }),
    prop('Act_NachtAn', {
        Nacht: 1, 'NachtPanel.visible': 1,
        'Bloecke.style.backgroundColor': HIMMEL_NACHT, 'LblTag.text': 'NACHT'
    }),
    prop('Act_NachtAus', {
        Nacht: 0, 'NachtPanel.visible': 0,
        'Bloecke.style.backgroundColor': HIMMEL_TAG, 'LblTag.text': 'TAG'
    }),
    act('Act_NeuStarten', { type: 'restart_game' }),
];

// Explosions-Sequenz (9 Zellen um BX/BY) — wiederverwendet in CreeperBoom
const boomZellen = () => [{
    type: 'foreach', name: 'ForEach: Off in BoomOffsets',
    sourceArray: 'BoomOffsets', itemVar: 'Off',
    body: [
        actRef('Act_BoomTX'), actRef('Act_BoomTY'), actRef('Act_BoomLesen'),
        cond('ZB', '>', 0, [cond('ZB', '!=', 10, [actRef('Act_BoomLoeschen')])]),
    ]
}];
const schaden = (n) => [
    cond('Unbesiegbar', '==', 0, [
        n === 2 ? actRef('Act_LebenMinus2') : actRef('Act_LebenMinus1'),
        actRef('Act_Rueckstoss'), actRef('Act_UnbesiegbarAn'),
        cond('Leben', '<=', 0, [taskRef('Gestorben')]),
    ]),
];

// ─── Tasks ───
const mobKern = [
    actRef('Act_MobName'),
    actRef('Act_MobX0'), actRef('Act_MobY0'), actRef('Act_MobD0'),
    actRef('Act_MXF'), actRef('Act_MYF'), actRef('Act_MobZelleBoden'),
    actRef('Act_FestM'),
    cond('FestM', '==', true, [
        actRef('Act_MobBodenY'),
        // Zombie/Creeper steuern auf den Spieler, wenn nah
        cond('Eintrag.art', '!=', 'schwein', [
            actRef('Act_MobDX'), actRef('Act_MobAbsDX'),
            cond('MAbsDX', '<=', 10, [actRef('Act_MobDirSteve')]),
        ]),
        actRef('Act_MWX'), actRef('Act_MWY'), actRef('Act_MobZelleWand'), actRef('Act_FestMW'),
        cond('FestMW', '==', true, [
            // Wand: Stufe hoch wenn frei, sonst umkehren
            actRef('Act_MobZelleOben1'), actRef('Act_MobZelleOben2'), actRef('Act_FreiMW'),
            cond('FreiMW', '==', true,
                [actRef('Act_MobStufe'), actRef('Act_MobSchritt')],
                [actRef('Act_MobUmkehren')]),
        ], [actRef('Act_MobSchritt')]),
    ], [actRef('Act_MobFall')]),
    actRef('Act_MobRand'), actRef('Act_MobRandX'),
    actRef('Act_MobSX'), actRef('Act_MobSY'), actRef('Act_MobSD'), actRef('Act_MobSync'),
];

const tasks = [
    task('SpielInit', 'Beim Laden (Welt.onStart): Startbild zeigen; Steve steht sicher (Schwerkraft aus).', [
        actRef('Act_SteveReset'), actRef('Act_WeltReset'),
    ]),
    task('SpielStarten', 'Neue Runde: Werte, Mobs spawnen, Physik und Takte an.', [
        actRef('Act_StartWerte'), actRef('Act_SteveReset'), actRef('Act_WeltReset'),
        taskRef('MobBauen'), actRef('Act_GravAn'), actRef('Act_InfoAus'), actRef('Act_TakteAn'),
    ]),
    task('MobBauen', 'Spawnt alle Mobs aus MobListe ueber die Templates.', [
        {
            type: 'foreach', name: 'ForEach: Eintrag in MobListe',
            sourceArray: 'MobListe', itemVar: 'Eintrag',
            body: [
                // spawn_object loest ${Var} ueber resolveTarget auf — Dot-Pfade
                // wie ${Eintrag.tpl} gehen nicht, deshalb Zwischenvariable.
                calc('Act_MobTpl', 'Eintrag.tpl', 'MobTpl'),
                {
                    type: 'spawn_object', name: 'Act_SpawnMob',
                    templateId: '${MobTpl}', x: '${Eintrag.x}', y: '${Eintrag.y}'
                },
            ]
        },
    ]),
    task('ZellKlick', 'Klick auf Welt-Zelle: gefuellt = abbauen (Reichweite), leer = Block setzen.', [
        cond('Status', '==', 'playing', [
            actRef('Act_Reich'),
            cond('InReich', '==', true, [
                cond('value', '==', 0, [
                    // Setzen: Zelle leer + nicht im Spieler + Bestand > 0
                    actRef('Act_FreiVonSteve'),
                    cond('FreiVonSteve', '==', true, [
                        actRef('Act_WahlName'), actRef('Act_AnzahlLesen'),
                        cond('Anz', '>', 0, [
                            actRef('Act_ZelleSetzen'), actRef('Act_AnzMinus'), actRef('Act_AnzahlSchreiben'),
                        ]),
                    ]),
                ], [
                    // Abbauen: alles ausser Bedrock; Wasser/Blume ohne Inventar
                    cond('value', '!=', 10, [
                        actRef('Act_ZelleLoeschen'),
                        cond('value', '!=', 11, [
                            actRef('Act_BlockName'), actRef('Act_AnzahlLesen'),
                            actRef('Act_AnzPlus'), actRef('Act_AnzahlSchreiben'),
                        ]),
                    ]),
                ]),
            ]),
        ]),
    ]),
    task('LinksDruck', 'Pfeil links / A gedrueckt.', [actRef('Act_LinksAn')]),
    task('LinksLos', 'Pfeil links / A losgelassen.', [actRef('Act_LinksAus')]),
    task('RechtsDruck', 'Pfeil rechts / D gedrueckt.', [actRef('Act_RechtsAn')]),
    task('RechtsLos', 'Pfeil rechts / D losgelassen.', [actRef('Act_RechtsAus')]),
    task('SprungOderStart', 'Leertaste: springen, sonst Start/Neustart.', [
        cond('Status', '==', 'playing',
            [cond('AmBoden', '==', 1, [actRef('Act_Sprung')])],
            [cond('Status', '==', 'ready', [taskRef('SpielStarten')], [actRef('Act_NeuStarten')])]),
    ]),
    task('Frame', 'Pro Frame: Eingabe, Falldeckel, Grid-Kollision (Boden/Kopf/Wand), Kamera.', [
        cond('Status', '==', 'playing', [
            actRef('Act_VX'),
            cond('Steve.velocityY', '>', DECKEL, [actRef('Act_FallDeckel')]),
            // Boden
            actRef('Act_FX1'), actRef('Act_FX2'), actRef('Act_FYF'),
            actRef('Act_ZelleFussL'), actRef('Act_ZelleFussR'), actRef('Act_FestB'),
            cond('FestB', '==', true, [
                cond('Steve.velocityY', '>=', 0, [actRef('Act_LandY'), actRef('Act_LandStopp')]),
            ], [actRef('Act_BodenWeg')]),
            // Kopf (nur beim Steigen)
            cond('Steve.velocityY', '<', 0, [
                actRef('Act_HYF'), actRef('Act_ZelleKopfL'), actRef('Act_ZelleKopfR'),
                actRef('Act_FestK'),
                cond('FestK', '==', true, [actRef('Act_KopfY'), actRef('Act_KopfStopp')]),
            ]),
            // Wand rechts
            cond('Steve.velocityX', '>', 0, [
                actRef('Act_WXR'), actRef('Act_RYO'), actRef('Act_RYU'),
                actRef('Act_ZelleWandO'), actRef('Act_ZelleWandU'), actRef('Act_FestW'),
                cond('FestW', '==', true, [actRef('Act_WandRX'), actRef('Act_WandStopp')]),
            ]),
            // Wand links
            cond('Steve.velocityX', '<', 0, [
                actRef('Act_WXL'), actRef('Act_RYO'), actRef('Act_RYU'),
                actRef('Act_ZelleWandO'), actRef('Act_ZelleWandU'), actRef('Act_FestW'),
                cond('FestW', '==', true, [actRef('Act_WandLX'), actRef('Act_WandStopp')]),
            ]),
            // Weltgrenzen
            cond('Steve.x', '<', 0, [actRef('Act_KlammereX0')]),
            cond('Steve.x', '>', COLS - 1, [actRef('Act_KlammereX1')]),
            actRef('Act_KamX'), actRef('Act_KamY'),
        ]),
    ]),
    task('MobTakt', 'Alle ~80ms: Boden-Clamp, Spieler-Steuerung, Wand/Stufe, Sync auf Instanzen.', [
        cond('Status', '==', 'playing', [
            {
                type: 'foreach', name: 'ForEach: Eintrag in MobListe',
                sourceArray: 'MobListe', itemVar: 'Eintrag',
                body: [
                    ...mobKern,
                    // Creeper-Zuender: nah am Spieler -> Explosion.
                    // BoomMitte/BoomFuss/MobName werden global gesetzt (Sub-Task
                    // hat eigenen Scope und sieht Eintrag nicht).
                    cond('Eintrag.art', '==', 'creeper', [
                        calc('Act_CreepDX', 'Math.abs(Steve.x - MobXNeu)', 'CDX'),
                        calc('Act_CreepDY', 'Math.abs(Steve.y - MobYNeu)', 'CDY'),
                        cond('CDX', '<', 1.4, [
                            cond('CDY', '<', 1.8, [
                                calc('Act_BoomMitteT', 'MobXNeu + Eintrag.w / 2', 'BoomMitte'),
                                calc('Act_BoomFussT', 'MobYNeu + Eintrag.h', 'BoomFuss'),
                                taskRef('CreeperBoomTick'),
                            ]),
                        ]),
                    ]),
                ]
            },
        ]),
    ]),
    task('CreeperBoomTick', 'Explosion aus MobTakt; Mitte/Fuss kommen aus contextVars.', [
        actRef('Act_BoomX'), actRef('Act_BoomY'),
        ...boomZellen(),
        calc('Act_NahXT', 'Math.abs(Steve.x + 0.45 - BoomMitte)', 'NahX'),
        calc('Act_NahYT', 'Math.abs(Steve.y + 1 - BoomFuss)', 'NahY'),
        cond('NahX', '<', 3, [
            cond('NahY', '<', 3, [...schaden(2)]),
        ]),
        { type: 'destroy_object', name: 'Act_BoomRelease', target: '${MobName}' },
        { type: 'shake_screen', name: 'Act_BoomShake', duration: 300 },
    ]),
    task('CreeperBoom', 'Creeper beruehrt Steve -> Explosion an self-Position.', [
        calc('Act_BoomMitteS', 'self.x + 0.45', 'BoomMitte'),
        calc('Act_BoomFussS', 'self.y + self.height', 'BoomFuss'),
        actRef('Act_BoomX'), actRef('Act_BoomY'),
        ...boomZellen(),
        actRef('Act_NahX'), actRef('Act_NahY'),
        cond('NahX', '<', 3, [
            cond('NahY', '<', 3, [...schaden(2)]),
        ]),
        { type: 'destroy_object', name: 'Act_BoomRelease2', target: 'self' },
        { type: 'shake_screen', name: 'Act_BoomShake2', duration: 300 },
    ]),
    task('ZombieBeruehrt', 'Zombie-Kontakt: von oben = Stomp, seitlich = Schaden.', [
        cond('other', '==', 'Steve', [
            cond('hitSide', '==', 'top',
                [{ type: 'destroy_object', name: 'Act_ZombieRelease', target: 'self' },
                 actRef('Act_Bounce')],
                [...schaden(1)]),
        ]),
    ]),
    task('Gestorben', 'Steve ist tot: Takte aus, Endbildschirm.', [
        actRef('Act_EndeTot'), actRef('Act_TakteAus'),
    ]),
    task('UnbesiegbarAus', 'Schutzzeit nach Schaden beenden.', [
        actRef('Act_UnbesiegbarAus'),
    ]),
    task('TagNacht', 'Tag/Nacht-Wechsel: Overlay + Himmelsfarbe der Welt.', [
        cond('Nacht', '==', 0, [actRef('Act_NachtAn')], [actRef('Act_NachtAus')]),
    ]),
];

// SlotWahl-Tasks (Tasten 1-9 -> Block 1-9)
for (let n = 1; n <= 9; n++) {
    tasks.push(task(`SlotWahl${n}`, `Taste ${n}: Block ${NAMEN[n]} waehlen.`, [
        prop(`Act_SlotAlt${n}`, { 'Slot${Vorher}.style.borderColor': '#3f4a68' }),
        prop(`Act_SlotNeu${n}`, { Ausgewaehlt: n, Vorher: n, [`Slot${n}.style.borderColor`]: '#ffd23f' }),
        { type: 'list_get', name: `Act_WahlLbl${n}`, target: 'BlockNamen', index: n, resultVariable: 'BlockAktuell' },
    ]));
}

// ─── Stage / Objekte ───
const grid = { cols: VIEW, rows: VIEW_H, cellSize: 26, visible: false, snapToGrid: true, backgroundColor: HIMMEL_TAG };

const v = (name, type, className, initialValue, extra = {}) => ({
    name, type, isVariable: true, isService: true, isHiddenInRun: true, className,
    x: 1, y: 1, width: 4, height: 2,
    draggable: false, droppable: false, collisionEnabled: false, style: {},
    initialValue, defaultValue: initialValue, value: initialValue,
    scope: 'global', id: `m2d_var_${name}`, ...extra
});

const blueprint = {
    id: 'stage_blueprint', name: 'Globale Dienste', type: 'blueprint',
    objects: [
        {
            className: 'TInputController', name: 'Tastatur', enabled: true,
            isHiddenInRun: true, isService: true, x: 1, y: 1,
            events: {
                onKeyDown_ArrowLeft: 'LinksDruck', onKeyDown_KeyA: 'LinksDruck',
                onKeyUp_ArrowLeft: 'LinksLos', onKeyUp_KeyA: 'LinksLos',
                onKeyDown_ArrowRight: 'RechtsDruck', onKeyDown_KeyD: 'RechtsDruck',
                onKeyUp_ArrowRight: 'RechtsLos', onKeyUp_KeyD: 'RechtsLos',
                onKeyDown_Space: 'SprungOderStart', onKeyDown_ArrowUp: 'SprungOderStart',
                onKeyDown_KeyW: 'SprungOderStart', onKeyDown_Enter: 'SprungOderStart',
                ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => [`onKeyDown_Digit${n}`, `SlotWahl${n}`])),
            },
            id: 'stage_blueprint_Tastatur',
        },
    ],
    tasks: [], actions: [],
    variables: [
        v('Status', 'string', 'TStringVariable', 'ready'),
        v('Leben', 'integer', 'TIntegerVariable', 5),
        v('Ausgewaehlt', 'integer', 'TIntegerVariable', 2),
        v('Vorher', 'integer', 'TIntegerVariable', 2),
        v('TasteLinks', 'integer', 'TIntegerVariable', 0),
        v('TasteRechts', 'integer', 'TIntegerVariable', 0),
        v('AmBoden', 'integer', 'TIntegerVariable', 0),
        v('Unbesiegbar', 'integer', 'TIntegerVariable', 0),
        v('Nacht', 'integer', 'TIntegerVariable', 0),
        v('BlockAktuell', 'string', 'TStringVariable', 'Erde'),
        // Temp-Variablen (Grid-Proben, Mob-Takt, Explosion)
        ...['FX1', 'FX2', 'FYF', 'HYF', 'WXF', 'RYO', 'RYU', 'Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6',
            'ZM', 'ZW', 'ZW1', 'ZW2', 'ZB', 'FestB', 'FestK', 'FestW', 'FestM', 'FestMW', 'FreiMW',
            'MXF', 'MYF', 'MWX', 'MWY', 'MWY1', 'MWY2', 'MDX', 'MAbsDX', 'CDX', 'CDY', 'MobName', 'MobTpl',
            'MobXNeu', 'MobYNeu', 'MobDirN',
            'TX', 'TY', 'BX', 'BY', 'BoomMitte', 'BoomFuss', 'NahX', 'NahY',
            'InReich', 'FreiVonSteve', 'Zeile', 'Anz']
            .map(n => v(n, 'real', 'TRealVariable', 0)),
        v('BlockNamen', 'list', 'TListVariable', undefined, { items: NAMEN }),
        v('BoomOffsets', 'list', 'TListVariable', undefined, {
            items: [-1, 0, 1].flatMap(dy => [-1, 0, 1].map(dx => ({ dx, dy })))
        }),
        // Rucksack-Ankerobjekte (Zeilen der TObjectList)
        ...NAMEN.slice(1).filter(n => n !== 'Bedrock' && n !== 'Wasser')
            .map(n => v(n, 'integer', 'TIntegerVariable', 0)),
    ],
    flowCharts: [], events: {}, grid,
};

const lbl = (name, text, x, y, w, h, style) => ({
    className: 'TLabel', name, x, y, width: w, height: h, text, style, id: `stage_main_${name}`
});
const hudStyle = { color: '#ffffff', fontSize: 15, fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 0, borderRadius: 6 };

// Steve (Unikat wie Mario — kein Template)
const steve = {
    className: 'TSprite', name: 'Steve', x: 8, y: 12.1, width: 0.9, height: 1.9,
    shape: 'rect', spriteColor: '#00a0a0',
    velocityX: 0, velocityY: 0, gravity: 0, lerpSpeed: 0.1,
    collisionEnabled: true, collisionGroup: 'default', pushOutOnCollision: false,
    appearanceMode: 'simple',
    visible: true, draggable: false, droppable: false, scope: 'stage',
    style: { backgroundColor: 'transparent', borderWidth: 0 },
    events: {}, id: 'm2d_Steve',
    backgroundImage: SVG_STEVE, objectFit: 'fill'
};

// Mob-Templates (Kinder von Welt -> parentId-Vererbung)
const tpl = (name, bild, w, h, color, poolSize, extra = {}) => ({
    className: 'TSpriteTemplate', name,
    x: 0, y: ROWS + 2, width: w, height: h,
    shape: 'rect', spriteColor: color,
    velocityX: 0, velocityY: 0, gravity: 0, lerpSpeed: 0.1,
    collisionEnabled: true, collisionGroup: 'mob', pushOutOnCollision: false,
    poolSize, autoRecycle: false, lifetime: 0,
    appearanceMode: 'simple',
    visible: true, draggable: false, droppable: false, scope: 'stage',
    style: { backgroundColor: 'transparent', borderWidth: 0 },
    events: {}, id: `m2d_${name}`, backgroundImage: bild, objectFit: 'fill', ...extra
});
const templates = [
    tpl('TplZombie', SVG_ZOMBIE, 0.9, 1.8, '#4e9c45', 5, {
        events: { onCollision: 'ZombieBeruehrt' }
    }),
    tpl('TplCreeper', SVG_CREEPER, 0.9, 1.8, '#57a832', 2, {
        events: { onCollision: 'CreeperBoom' }
    }),
    tpl('TplSchwein', SVG_SCHWEIN, 1.1, 0.9, '#eda0ab', 3),
];

// Wolken-Deko
const wolken = [15, 45, 75, 105, 130].map((x, i) => ({
    className: 'TSprite', name: `Wolke${i}`, x, y: 2 + (i % 3), width: 4, height: 1.5,
    shape: 'rect', spriteColor: '#ffffff', velocityX: 0, velocityY: 0, gravity: 0,
    collisionEnabled: false, pushOutOnCollision: false, appearanceMode: 'simple',
    visible: true, draggable: false, droppable: false, scope: 'stage',
    style: { backgroundColor: 'transparent', borderWidth: 0 },
    events: {}, id: `m2d_Wolke${i}`, backgroundImage: SVG_WOLKE, objectFit: 'fill'
}));

// Hotbar: Slot1..Slot9 = Bloecke 1..9 (Name == Paletten-Index)
const slots = [];
for (let n = 1; n <= 9; n++) {
    slots.push({
        className: 'TSprite', name: `Slot${n}`, x: 2 + (n - 1) * 2.2, y: 19.9, width: 1.5, height: 1.5,
        shape: 'rect', spriteColor: PAL[n], velocityX: 0, velocityY: 0, gravity: 0,
        collisionEnabled: false, pushOutOnCollision: false, appearanceMode: 'simple',
        visible: true, draggable: false, droppable: false, scope: 'stage',
        style: { backgroundColor: 'transparent', borderWidth: 3, borderColor: n === 2 ? '#ffd23f' : '#3f4a68', borderRadius: 4 },
        events: {}, id: `m2d_Slot${n}`, backgroundImage: BLOCK_SVG[n], objectFit: 'fill'
    });
    slots.push(lbl(`LblSlot${n}`, String(n), 2 + (n - 1) * 2.2, 21.4, 1.5, 0.8,
        { color: '#ffffff', fontSize: 11, fontWeight: 'bold', backgroundColor: 'transparent', borderWidth: 0 }));
}

const main = {
    id: 'stage_main', name: 'Mine2D', type: 'main',
    objects: [
        // Welt zuerst (Hintergrund), Nacht-Overlay darueber, HUD zuletzt
        {
            className: 'TGroupPanel', name: 'Welt', x: 0, y: 0, width: COLS, height: ROWS,
            style: { backgroundColor: 'transparent', borderWidth: 0 },
            events: { onStart: 'SpielInit' },
            children: [
                {
                    className: 'TGridBoard', name: 'Bloecke', x: 0, y: 0, width: COLS, height: ROWS,
                    cols: COLS, rows: ROWS, palette: PAL, cells,
                    gridLines: false, overlayText: '',
                    draggable: false, droppable: false, collisionEnabled: false,
                    style: { backgroundColor: HIMMEL_TAG, borderWidth: 0 },
                    events: { onCellClick: 'ZellKlick' }, id: 'm2d_Bloecke'
                },
                ...wolken, steve, ...templates
            ],
            id: 'stage_main_Welt'
        },
        {
            className: 'TPanel', name: 'NachtPanel', x: 0, y: 0, width: VIEW, height: VIEW_H,
            visible: false, draggable: false, droppable: false, collisionEnabled: false,
            style: { backgroundColor: 'rgba(10,15,45,0.55)', borderWidth: 0, pointerEvents: 'none' },
            events: {}, id: 'stage_main_NachtPanel'
        },
        lbl('LblLeben', 'LEBEN x${Leben}', 1, 0.4, 8, 1, hudStyle),
        lbl('LblWahl', 'BLOCK: ${BlockAktuell}', 10, 0.4, 11, 1, hudStyle),
        lbl('LblTag', 'TAG', 34, 0.4, 5, 1, hudStyle),
        lbl('LblInfo', 'MINE2D\n\nPfeile / WASD = laufen & springen\nKlick = Block abbauen\nleeres Feld + Klick = Block setzen\n1-9 = Block waehlen\n\nLEER = START', 8, 4, 24, 10,
            { color: '#ffffff', fontSize: 16, fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 0, borderRadius: 10 }),
        {
            className: 'TLabel', name: 'LblEnde', visible: false, x: 8, y: 7, width: 24, height: 6,
            text: '',
            style: { color: '#ffffff', fontSize: 22, fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 0, borderRadius: 10 },
            id: 'stage_main_LblEnde'
        },
        {
            className: 'TObjectList', name: 'Rucksack', x: 30.5, y: 1.6, width: 8.5, height: 6.5,
            sourceMode: 'objects', items: NAMEN.slice(1).filter(n => n !== 'Bedrock' && n !== 'Wasser'),
            recordKey: 'id', fields: [{ name: 'anzahl', type: 'number', defaultValue: 0 }],
            recordData: {}, isHiddenInRun: false, isVariable: true,
            draggable: false, droppable: false, collisionEnabled: false,
            style: { backgroundColor: 'rgba(20,28,50,0.85)', borderColor: '#3f4a68', borderWidth: 2, borderRadius: 6, color: '#e2e8f0' },
            events: {}, id: 'stage_main_Rucksack'
        },
        {
            className: 'TObjectList', name: 'MobListe', x: 40, y: 1.6, width: 6, height: 4,
            sourceMode: 'objects', items: mobItems, recordData: mobData,
            recordKey: 'objectId',
            fields: [
                { name: 'tpl', type: 'string' }, { name: 'n', type: 'number' },
                { name: 'art', type: 'string' }, { name: 'x', type: 'number' },
                { name: 'y', type: 'number' }, { name: 'dir', type: 'number' },
                { name: 'speed', type: 'number' }, { name: 'w', type: 'number' },
                { name: 'h', type: 'number' },
            ],
            isHiddenInRun: true, isVariable: true, isService: true,
            draggable: false, droppable: false, collisionEnabled: false,
            style: {},
            events: {}, id: 'stage_main_MobListe'
        },
        ...slots,
        {
            className: 'TTimer', name: 'FrameTakt', x: 1, y: 20, width: 4, height: 2,
            interval: 16, enabled: false, isService: true, isHiddenInRun: true,
            style: {}, events: { onTimer: 'Frame' }, id: 'stage_main_FrameTakt'
        },
        {
            className: 'TTimer', name: 'MobTakt', x: 6, y: 20, width: 4, height: 2,
            interval: 80, enabled: false, isService: true, isHiddenInRun: true,
            style: {}, events: { onTimer: 'MobTakt' }, id: 'stage_main_MobTakt'
        },
        {
            className: 'TTimer', name: 'TagTakt', x: 11, y: 20, width: 4, height: 2,
            interval: 30000, enabled: false, isService: true, isHiddenInRun: true,
            style: {}, events: { onTimer: 'TagNacht' }, id: 'stage_main_TagTakt'
        },
        {
            className: 'TTimer', name: 'UnsichtbarTakt', x: 16, y: 20, width: 4, height: 2,
            interval: 2000, enabled: false, isService: true, isHiddenInRun: true,
            style: {}, events: { onTimer: 'UnbesiegbarAus' }, id: 'stage_main_UnsichtbarTakt'
        },
    ],
    tasks, actions,
    variables: [], flowCharts: [], events: {}, grid,
    features: [
        {
            id: 'feature_m2d_welt', name: 'Blockwelt & Kamera',
            description: 'TGridBoard als 140x30-Welt (Generierung im Generator); Welt-Panel scrollt horizontal und vertikal.',
            tags: ['Minecraft', 'Welt'], userStoryIds: ['m2d_welt'],
            blueprintTaskNames: ['Frame']
        },
        {
            id: 'feature_m2d_bauen', name: 'Abbauen & Setzen',
            description: 'onCellClick: gefuellte Zelle abbauen (ausser Bedrock), leere Zelle mit gewaehltem Block fuellen; Reichweite begrenzt.',
            tags: ['Minecraft', 'Bauen'], userStoryIds: ['m2d_bauen'],
            blueprintTaskNames: ['ZellKlick', 'SlotWahl1']
        },
        {
            id: 'feature_m2d_physik', name: 'Grid-Physik',
            description: 'Steve laeuft/springt via TSprite; Boden/Kopf/Wand werden per getCell-Proben im Frame-Task aufgeloest.',
            tags: ['Minecraft', 'Physik'], userStoryIds: ['m2d_physik'],
            blueprintTaskNames: ['SprungOderStart', 'LinksDruck', 'RechtsDruck', 'LinksLos', 'RechtsLos']
        },
        {
            id: 'feature_m2d_mobs', name: 'Mobs aus Templates',
            description: 'Zombies/Creeper/Schweine als Pool-Instanzen; Positionen record-getrieben in MobListe (TObjectList), MobTakt synchronisiert.',
            tags: ['Minecraft', 'Mobs'], userStoryIds: ['m2d_mobs'],
            blueprintTaskNames: ['MobBauen', 'MobTakt', 'ZombieBeruehrt', 'CreeperBoom', 'CreeperBoomTick']
        },
        {
            id: 'feature_m2d_ablauf', name: 'Inventar & Spielablauf',
            description: 'Rucksack (TObjectList) zaehlt Bloecke; Tag/Nacht-Wechsel, Herzen, Tod/Neustart.',
            tags: ['Minecraft', 'Ablauf'], userStoryIds: ['m2d_ablauf'],
            blueprintTaskNames: ['SpielInit', 'SpielStarten', 'Gestorben', 'TagNacht', 'UnbesiegbarAus']
        }
    ]
};

const story = (id, title, description, acceptanceCriteria, relatedComponents, featureId) => ({
    id, title, description, priority: 'high', status: 'done', acceptanceCriteria,
    relatedStages: ['stage_main', 'stage_blueprint'],
    createdAt: '2026-09-13T00:00:00.000Z', projectId: 'mine2d', updatedAt: '2026-09-13T00:00:00.000Z',
    relatedComponents, relatedVariables: [], interactions: [], featureId
});

const project = {
    meta: {
        id: 'mine2d', name: 'Mine2D', version: '1.0.0',
        author: 'Rolf Rieckmann / Devin',
        description: 'Minecraft-artige 2D-Blockwelt: abbauen, setzen, Hotbar, Inventar (TObjectList), Mobs aus TSpriteTemplates, Tag/Nacht.'
    },
    stage: { grid },
    stages: [blueprint, main],
    objects: [], actions: [], tasks: [], variables: [],
    activeStageId: 'stage_main',
    userStories: {
        userStories: [
            story('m2d_welt', 'Scrollbare Blockwelt',
                'Als Spieler moechte ich eine grosse Blockwelt horizontal und beim Graben vertikal durchscrollen.',
                ['140x30 TGridBoard als Kind von Welt', 'Welt.x und Welt.y folgen Steve', 'Bedrock-Begrenzung'],
                ['Bloecke', 'Welt'], 'feature_m2d_welt'),
            story('m2d_bauen', 'Abbauen & Setzen',
                'Als Spieler baue ich Bloecke mit Klick ab und setze den gewaehlten Block auf leere Zellen.',
                ['Reichweite max. 4 Bloecke', 'Bedrock nicht abbaubar', 'Setzen nur mit Bestand > 0', 'Kein Setzen in den Spieler'],
                ['Bloecke', 'Tastatur'], 'feature_m2d_bauen'),
            story('m2d_physik', 'Grid-Physik',
                'Als Spieler laufe und springe ich stabil auf Bloecken; abgebaute Bloecke veraendern die Physik.',
                ['Boden-/Kopf-/Wandproben per getCell', 'Sprung ueberwindet 1 Block', 'Weltgrenzen geklemmt'],
                ['Steve', 'FrameTakt'], 'feature_m2d_physik'),
            story('m2d_mobs', 'Mobs',
                'Als Spieler begegne ich Zombies (verfolgen mich), Creepern (explodieren) und Schweinen.',
                ['Mobs aus TSpriteTemplates', 'MobListe (TObjectList) fuehrt Positionen', 'Creeper-Explosion entfernt 3x3-Zellen', 'Zombie-Stomp'],
                ['TplZombie', 'TplCreeper', 'TplSchwein', 'MobListe'], 'feature_m2d_mobs'),
            story('m2d_ablauf', 'Inventar & Ablauf',
                'Als Spieler sehe ich mein Inventar, erlebe Tag und Nacht und kann nach dem Tod neu starten.',
                ['Rucksack-Tabelle zeigt Block-Anzahlen', 'Tag/Nacht-Wechsel alle 30s', '5 Leben, Schaden mit Schutzzeit', 'ENTER = Neustart'],
                ['Rucksack', 'NachtPanel', 'LblEnde'], 'feature_m2d_ablauf'),
        ]
    }
};

writeFileSync(OUT, JSON.stringify(project, null, 2));
console.log(`Geschrieben: ${OUT}`);
console.log(`Welt: ${COLS}x${ROWS}, Mobs: ${mobItems.length}, Tasks: ${tasks.length}, Actions: ${actions.length}`);
console.log(`MobListe-Records: ${mobItems.map(id => mobData[id].tpl + '#' + mobData[id].n).join(', ')}`);

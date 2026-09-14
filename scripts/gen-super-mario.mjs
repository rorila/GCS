/**
 * Generator fuer SuperMario.json - 2D-Plattformer komplett mit Bordmitteln.
 * KEINE neue Komponente: TGroupPanel "Welt" = scrollbares Level (Kinder werden
 * via flattenWithChildren in die Runtime aufgenommen -> Physik + Kollision
 * relativ zum Parent). Kamera = Welt.x verschieben.
 * Physik: Engine-Push-Out (pro Frame) auf Tiles/Gegnern; Mario springt/laeuft
 * ueber velocityX/Y + gravity. Gegner/Pits/Blöcke laufen ueber Events.
 * Ausfuehren: node scripts/gen-super-mario.mjs
 */
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../game-server/public/projects/SuperMario.json');

// ─── Konstanten ───
// WICHTIG Einheiten: TSprite.update() bewegt um velocity * (dt*60)
// -> velocity ist Zellen/Frame@60fps. gravity wird als vy += g*dt addiert
// -> g in Zellen/s pro Frame-Schritt (a_eff = g*60 Zellen/s^2).
const VIEW = 40;          // sichtbare Breite in Zellen
const ROWS = 22;
const LVL = 220;          // Level-Breite in Zellen
const GROUND = 19;        // Oberkante Boden
const GRAV = 1.5;         // -> ~90 Zellen/s^2
const TEMPO = 0.13;       // ~7.8 Zellen/s
const SPRUNG = -0.55;     // -> ~6 Zellen hoch, ~6 weit
const BOUNCE = -0.12;     // Stomp-Bounce
const DECKEL = 0.45;      // max. Fallgeschwindigkeit (Zellen/Frame)
const GOOMBA_V = 0.035;   // ~2 Zellen/s
const KAM_SCHWELLE = 16;  // Mario-ScreenX, ab dem gescrollt wird
const WELT_MIN = VIEW - LVL; // -180

// ─── Farben ───
const C = {
    mario: '#e23636', goomba: '#7a3b12', grass: '#3faa2f', dirt: '#8b5a2b',
    pipe: '#1e9e1e', brick: '#b5651d', frage: '#f5b301', frageAlt: '#7a5230',
    plattform: '#c98a3d', coin: '#ffd700', flagge: '#2d5016', flag: '#d21f26',
    wolke: '#ffffff', huegel: '#2e7d32', busch: '#34a34f', schloss: '#7a5230', tuer: '#3a2410'
};

// ─── Helfer: Objekte ───
let uid = 0;
const sprite = (name, x, y, w, h, color, extra = {}) => ({
    className: 'TSprite', name, x, y, width: w, height: h,
    shape: 'rect', spriteColor: color,
    velocityX: 0, velocityY: 0, gravity: 0, lerpSpeed: 0.1,
    collisionEnabled: true, collisionGroup: 'level', pushOutOnCollision: true,
    visible: true, draggable: false, droppable: false, scope: 'stage',
    style: { backgroundColor: 'transparent', borderWidth: 0 },
    events: {}, id: `sm_${name}_${uid++}`, ...extra
});
const deko = (name, x, y, w, h, color, shape = 'rect') =>
    sprite(name, x, y, w, h, color, { collisionEnabled: false, pushOutOnCollision: false, shape });
const kachel = (name, x, y, w, h, color) => sprite(name, x, y, w, h, color);
const muenze = (name, x, y) => sprite(name, x, y, 1, 1, C.coin, {
    shape: 'circle', collisionGroup: 'gegner', pushOutOnCollision: false,
    events: { onCollision: 'MuenzeGenommen' }
});
const frageBlock = (name, x, y) => sprite(name, x, y, 1, 1, C.frage, {
    events: { onCollision: 'FrageBlockGetroffen' }
});
const goomba = (name, x) => sprite(name, x, GROUND - 1, 1, 1, C.goomba, {
    collisionGroup: 'gegner', gravity: GRAV, velocityX: -GOOMBA_V,
    events: {
        onCollision: 'GoombaBeruehrt',
        onCollisionLeft: 'GoombaWendeLinks',
        onCollisionRight: 'GoombaWendeRechts'
    }
});

// Treppe: Richtung +1 = aufwaerts (Stufen nach rechts steigend), -1 = abwaerts
const treppe = (prefix, x, stufen, dir) => {
    const out = [];
    for (let i = 0; i < stufen; i++) {
        const h = dir > 0 ? i + 1 : stufen - i;
        out.push(kachel(`${prefix}${i}`, x + i, GROUND - h, 1, h, C.brick));
    }
    return out;
};

// ─── Level-Geometrie ───
const weltKinder = [];

// Boden-Segmente: Gras oben + Erde darunter. Luecken = Gruben (Tod).
const bodenSegs = [[0, 30], [34, 23], [60, 10], [73, 25], [102, 35], [140, 28], [172, 48]];
bodenSegs.forEach(([x, w], i) => {
    weltKinder.push(kachel(`BodenG${i}`, x, GROUND, w, 1, C.grass));
    weltKinder.push(kachel(`BodenE${i}`, x, GROUND + 1, w, ROWS - GROUND - 1, C.dirt));
});

// Roehren
[[27, 2], [40, 3], [46, 4], [52, 5], [88, 3], [118, 2]].forEach(([x, h], i) =>
    weltKinder.push(kachel(`Roehre${i}`, x, GROUND - h, 2, h, C.pipe)));

// Treppen (Pyramiden + Finaltreppe)
weltKinder.push(...treppe('TreppeA', 78, 4, 1), ...treppe('TreppeB', 82, 4, -1));
weltKinder.push(...treppe('TreppeC', 143, 4, 1), ...treppe('TreppeD', 149, 4, -1));
weltKinder.push(...treppe('TreppeZiel', 186, 6, 1));

// Schwebeplattformen und Bruecken
[[30, 14, 5], [57, 13, 4], [69, 14, 4], [98, 13, 5],
 [105, 12, 12], [121, 12, 10], [137, 13, 4], [168, 13, 4], [154, 9, 5]
].forEach(([x, y, w], i) => weltKinder.push(kachel(`Plattform${i}`, x, y, w, 1, C.plattform)));

// Ziegel-Reihen
[18, 20, 22].forEach(x => weltKinder.push(kachel(`ZiegelA${x}`, x, 14, 1, 1, C.brick)));
[126, 127, 129, 131, 132].forEach(x => weltKinder.push(kachel(`ZiegelB${x}`, x, 9, 1, 1, C.brick)));
[155, 157, 158, 159].forEach(x => weltKinder.push(kachel(`ZiegelC${x}`, x, 12, 1, 1, C.brick)));

// ?-Bloecke
[[19, 14], [21, 14], [20, 10], [92, 13], [128, 9], [130, 9], [156, 12], [176, 13], [178, 13]]
    .forEach(([x, y], i) => weltKinder.push(frageBlock(`Frage${i}`, x, y)));

// Muenzen
[[8, 16], [9, 15], [10, 14], [11, 15], [12, 16], [16, 13], [24, 14],
 [40, 13], [46, 12], [52, 11], [32, 12], [58, 11], [71, 12], [100, 11],
 [138, 11], [169, 11], [106, 10], [109, 10], [112, 10], [115, 10], [118, 10],
 [155, 7], [157, 7], [188, 12], [193, 11]
].forEach(([x, y], i) => weltKinder.push(muenze(`Muenze${i}`, x, y)));

// Gegner (Goombas): laufen links, wenden an Waenden, fallen in Gruben
[25, 44, 55, 76, 93, 112, 133, 150, 163, 181, 184].forEach((x, i) =>
    weltKinder.push(goomba(`Goomba${i}`, x)));

// Flagge (Pfahl solide -> haelt Mario + loest Ziel aus; Flagge deko)
weltKinder.push(sprite('FlaggePfahl', 196, 9, 0.5, 10, C.flagge, {
    events: { onCollision: 'ZielErreicht' }
}));
weltKinder.push(deko('FlaggeTuch', 194.5, 10, 1.5, 1, C.flag));
weltKinder.push(deko('FlaggeKugel', 195.8, 8.4, 0.8, 0.8, C.coin, 'circle'));

// Schloss am Levelende (Deko)
weltKinder.push(deko('Schloss', 204, 14, 7, 5, C.schloss));
weltKinder.push(deko('SchlossTuer', 207, 16, 2, 3, C.tuer));

// Deko: Wolken, Huegel, Buesche
[[6, 3], [34, 5], [66, 4], [96, 3], [126, 5], [156, 3], [186, 5]].forEach(([x, y], i) =>
    weltKinder.push(deko(`Wolke${i}`, x, y, 4, 1.5, C.wolke, 'circle')));
[[4, 16, 7, 3], [64, 17, 5, 2], [144, 16, 8, 3], [199, 17, 6, 2]].forEach(([x, y, w, h], i) =>
    weltKinder.push(deko(`Huegel${i}`, x, y, w, h, C.huegel)));
[[14, 18, 3, 1], [84, 18, 4, 1], [160, 18, 3, 1]].forEach(([x, y, w, h], i) =>
    weltKinder.push(deko(`Busch${i}`, x, y, w, h, C.busch)));

// Mario selbst (Kind von Welt -> Welt-Koordinaten)
weltKinder.push(sprite('Mario', 3, 15, 1, 2, C.mario, {
    collisionGroup: 'default', pushOutOnCollision: false, gravity: GRAV,
    events: { onCollisionBottom: 'Landen', onBoundaryHit: 'MarioAmRand' }
}));

// ─── Helfer: Actions/Tasks ───
const act = (name, body) => ({ name, ...body });
const prop = (name, changes) => act(name, { type: 'property', changes });
const setVar = (name, variableName, value) =>
    act(name, { type: 'property', changes: { [variableName]: value } });
const calc = (name, formula, resultVariable) =>
    act(name, { type: 'calculate', formula, resultVariable });
const cond = (variable, operator, value, then, els = []) => ({
    type: 'condition',
    name: `Branch: ${variable} ${operator} ${value}`,
    condition: { variable, operator, value },
    then, else: els
});
const taskRef = name => ({ type: 'task', name });
const actRef = name => ({ type: 'action', name });
const task = (name, description, actionSequence) => ({
    name, description, actionSequence, triggerMode: 'local-sync', params: [],
    id: 'sm_' + name.toLowerCase()
});

// ─── Actions ───
const actions = [
    prop('Act_StartWerte', {
        Status: 'playing', Punkte: 0, Muenzen: 0, Leben: 3,
        TasteLinks: 0, TasteRechts: 0, AmBoden: 0, Unbesiegbar: 0
    }),
    prop('Act_MarioReset', {
        'Mario.x': 3, 'Mario.y': 15, 'Mario.velocityX': 0, 'Mario.velocityY': 0,
        'Mario.visible': 1
    }),
    prop('Act_WeltReset', { 'Welt.x': 0 }),
    prop('Act_InfoAus', { 'LblInfo.visible': 0, 'LblEnde.visible': 0 }),
    prop('Act_FrameAn', { 'FrameTakt.enabled': 1 }),
    prop('Act_FrameAus', { 'FrameTakt.enabled': 0 }),
    prop('Act_LinksAn', { TasteLinks: 1, TasteRechts: 0 }),
    prop('Act_LinksAus', { TasteLinks: 0 }),
    prop('Act_RechtsAn', { TasteRechts: 1, TasteLinks: 0 }),
    prop('Act_RechtsAus', { TasteRechts: 0 }),
    prop('Act_Sprung', { 'Mario.velocityY': SPRUNG, AmBoden: 0 }),
    prop('Act_BodenAn', { AmBoden: 1 }),
    prop('Act_BodenWeg', { AmBoden: 0 }),
    calc('Act_VX', `TasteRechts == 1 ? ${TEMPO} : (TasteLinks == 1 ? -${TEMPO} : 0)`, 'Mario.velocityX'),
    prop('Act_FallDeckel', { 'Mario.velocityY': DECKEL }),
    calc('Act_Kamera', `Math.min(0, Math.max(${WELT_MIN}, ${KAM_SCHWELLE} - Mario.x))`, 'Welt.x'),
    prop('Act_MuenzeWeg', { 'self.visible': 0 }),
    calc('Act_MuenzenPlus', 'Muenzen + 1', 'Muenzen'),
    calc('Act_Punkte50', 'Punkte + 50', 'Punkte'),
    calc('Act_Punkte100', 'Punkte + 100', 'Punkte'),
    calc('Act_Punkte200', 'Punkte + 200', 'Punkte'),
    calc('Act_Punkte1000', 'Punkte + 1000', 'Punkte'),
    prop('Act_BlockVerbraucht', { 'self.benutzt': 1, 'self.spriteColor': C.frageAlt }),
    prop('Act_GegnerWeg', { 'self.visible': 0 }),
    prop('Act_SprungBounce', { 'Mario.velocityY': BOUNCE }),
    prop('Act_WendeRechts', { 'self.velocityX': GOOMBA_V }),
    prop('Act_WendeLinks', { 'self.velocityX': -GOOMBA_V }),
    calc('Act_LebenMinus', 'Leben - 1', 'Leben'),
    prop('Act_UnbesiegbarAn', { Unbesiegbar: 1, 'UnsichtbarTakt.enabled': 1 }),
    prop('Act_UnbesiegbarAus', { Unbesiegbar: 0, 'UnsichtbarTakt.enabled': 0 }),
    prop('Act_StatusGameOver', {
        Status: 'gameover', 'Mario.visible': 0, 'Mario.velocityX': 0, 'Mario.velocityY': 0
    }),
    prop('Act_StatusGewonnen', { Status: 'gewonnen', 'Mario.velocityX': 0 }),
    prop('Act_EndeVerlieren', {
        'LblEnde.text': 'GAME OVER\nENTER = Neustart', 'LblEnde.visible': 1
    }),
    prop('Act_EndeGewinnen', {
        'LblEnde.text': 'LEVEL GESCHAFFT!\n+1000 Punkte\nENTER = Neustart', 'LblEnde.visible': 1
    }),
    act('Act_NeuStarten', { type: 'restart_game' }),
];

// ─── Tasks ───
const tasks = [
    task('SpielStarten', 'Neue Runde: Werte, Mario-Position, Kamera und Frame-Takt.', [
        actRef('Act_StartWerte'), actRef('Act_MarioReset'), actRef('Act_WeltReset'),
        actRef('Act_InfoAus'), actRef('Act_FrameAn'),
    ]),
    task('LinksDruck', 'Pfeil links / A gedrueckt.', [actRef('Act_LinksAn')]),
    task('LinksLos', 'Pfeil links / A losgelassen.', [actRef('Act_LinksAus')]),
    task('RechtsDruck', 'Pfeil rechts / D gedrueckt.', [actRef('Act_RechtsAn')]),
    task('RechtsLos', 'Pfeil rechts / D losgelassen.', [actRef('Act_RechtsAus')]),
    task('SprungOderStart', 'Leertaste: springen, sonst Start/Neustart.', [
        cond('Status', '==', 'playing',
            [cond('AmBoden', '==', 1, [actRef('Act_Sprung')])],
            [cond('Status', '==', 'ready',
                [taskRef('SpielStarten')],
                [actRef('Act_NeuStarten')])]),
    ]),
    task('Frame', 'Pro Frame: Eingabe anwenden, Falldeckel, Boden-Falloff, Kamera.', [
        cond('Status', '==', 'playing', [
            actRef('Act_VX'),
            cond('Mario.velocityY', '>', DECKEL, [actRef('Act_FallDeckel')]),
            cond('Mario.velocityY', '>', 0.01, [actRef('Act_BodenWeg')]),
            actRef('Act_Kamera'),
        ]),
    ]),
    task('Landen', 'Mario landet auf einer Flaeche (onCollisionBottom).', [
        actRef('Act_BodenAn'),
    ]),
    task('MarioAmRand', 'Mario verlaesst die Welt nach unten (Grube) -> Tod.', [
        cond('hitSide', '==', 'bottom', [taskRef('Gestorben')]),
    ]),
    task('MuenzeGenommen', 'Muenze eingesammelt (nur durch Mario, einmalig).', [
        cond('other', '==', 'Mario', [
            cond('self.visible', '==', true, [
                actRef('Act_MuenzeWeg'), actRef('Act_MuenzenPlus'), actRef('Act_Punkte50'),
            ]),
        ]),
    ]),
    task('FrageBlockGetroffen', '?-Block von unten angestossen -> Muenze, einmalig.', [
        cond('hitSide', '==', 'bottom', [
            cond('other', '==', 'Mario', [
                cond('self.benutzt', '!=', 1, [
                    actRef('Act_BlockVerbraucht'), actRef('Act_MuenzenPlus'), actRef('Act_Punkte200'),
                ]),
            ]),
        ]),
    ]),
    task('GoombaBeruehrt', 'Goomba-Kontakt: von oben = Stomp, seitlich = Schaden.', [
        cond('other', '==', 'Mario', [
            cond('hitSide', '==', 'top',
                [actRef('Act_GegnerWeg'), actRef('Act_SprungBounce'), actRef('Act_Punkte100')],
                [cond('Unbesiegbar', '==', 0, [taskRef('Gestorben')])]),
        ]),
    ]),
    task('GoombaWendeLinks', 'Goomba stoesst links an -> nach rechts laufen.', [
        actRef('Act_WendeRechts'),
    ]),
    task('GoombaWendeRechts', 'Goomba stoesst rechts an -> nach links laufen.', [
        actRef('Act_WendeLinks'),
    ]),
    task('Gestorben', 'Leben abziehen; Respawn oder Game Over.', [
        cond('Status', '==', 'playing', [
            actRef('Act_LebenMinus'),
            cond('Leben', '>', 0,
                [actRef('Act_MarioReset'), actRef('Act_WeltReset'), actRef('Act_UnbesiegbarAn')],
                [actRef('Act_StatusGameOver'), actRef('Act_EndeVerlieren'), actRef('Act_FrameAus')]),
        ]),
    ]),
    task('ZielErreicht', 'Flaggenpfahl beruehrt -> Level gewonnen.', [
        cond('other', '==', 'Mario', [
            cond('Status', '==', 'playing', [
                actRef('Act_StatusGewonnen'), actRef('Act_Punkte1000'),
                actRef('Act_EndeGewinnen'), actRef('Act_FrameAus'),
            ]),
        ]),
    ]),
    task('UnbesiegbarAus', 'Respawn-Schutzzeit beenden.', [
        actRef('Act_UnbesiegbarAus'),
    ]),
];

// ─── Objekte / Stage ───
const serviceObj = (className, name, extra = {}) => ({
    className, name, isVariable: true, isService: true, isHiddenInRun: true,
    x: 1, y: 1, width: 4, height: 2, style: {}, id: `stage_blueprint_${name}`, ...extra
});

const grid = { cols: VIEW, rows: ROWS, cellSize: 26, visible: false, snapToGrid: true, backgroundColor: '#5c94fc' };

const v = (name, type, className, initialValue) => ({
    name, type, isVariable: true, className, initialValue,
    defaultValue: initialValue, value: initialValue, scope: 'global', id: `sm_var_${name}`
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
            },
            id: 'stage_blueprint_Tastatur',
        },
    ],
    tasks: [], actions: [],
    variables: [
        v('Status', 'string', 'TStringVariable', 'ready'),
        v('Punkte', 'integer', 'TIntegerVariable', 0),
        v('Muenzen', 'integer', 'TIntegerVariable', 0),
        v('Leben', 'integer', 'TIntegerVariable', 3),
        v('TasteLinks', 'integer', 'TIntegerVariable', 0),
        v('TasteRechts', 'integer', 'TIntegerVariable', 0),
        v('AmBoden', 'integer', 'TIntegerVariable', 0),
        v('Unbesiegbar', 'integer', 'TIntegerVariable', 0),
    ],
    flowCharts: [], events: {}, grid,
};

const lbl = (name, text, x, y, w, h, style) => ({
    className: 'TLabel', name, x, y, width: w, height: h, text, style, id: `stage_main_${name}`
});
const hudStyle = { color: '#ffffff', fontSize: 15, fontWeight: 'bold', backgroundColor: 'transparent', borderWidth: 0 };

const main = {
    id: 'stage_main', name: 'Super Mario Bros.', type: 'main',
    objects: [
        // HUD (Top-Level -> scrollt nicht mit)
        lbl('LblPunkte', 'MARIO  ${Punkte}', 1, 0.5, 10, 1, hudStyle),
        lbl('LblMuenzen', 'MUENZEN x${Muenzen}', 12, 0.5, 9, 1, hudStyle),
        lbl('LblLeben', 'LEBEN x${Leben}', 22, 0.5, 8, 1, hudStyle),
        lbl('LblWelt', 'WELT 1-1', 31, 0.5, 7, 1, hudStyle),
        lbl('LblInfo', 'SUPER MARIO BROS.\n\nPfeile / WASD = laufen\nLEER = springen\n\nLEER/ENTER = START', 8, 5, 24, 8,
            { color: '#ffffff', fontSize: 18, fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 0, borderRadius: 10 }),
        {
            className: 'TLabel', name: 'LblEnde', visible: false, x: 8, y: 7, width: 24, height: 6,
            text: '',
            style: { color: '#ffffff', fontSize: 22, fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 0, borderRadius: 10 },
            id: 'stage_main_LblEnde'
        },
        // Die scrollbare Welt
        {
            className: 'TGroupPanel', name: 'Welt', x: 0, y: 0, width: LVL, height: ROWS,
            style: { backgroundColor: 'transparent', borderWidth: 0 },
            children: weltKinder, id: 'stage_main_Welt'
        },
        {
            className: 'TGameLoop', name: 'Loop', x: 1, y: 20, width: 4, height: 2,
            targetFPS: 60, boundaryMode: 'event-only',
            isService: true, isHiddenInRun: true, style: {}, id: 'stage_main_Loop'
        },
        {
            className: 'TTimer', name: 'FrameTakt', x: 6, y: 20, width: 4, height: 2,
            interval: 16, enabled: false, isService: true, isHiddenInRun: true,
            style: {}, events: { onTimer: 'Frame' }, id: 'stage_main_FrameTakt'
        },
        {
            className: 'TTimer', name: 'UnsichtbarTakt', x: 11, y: 20, width: 4, height: 2,
            interval: 2000, enabled: false, isService: true, isHiddenInRun: true,
            style: {}, events: { onTimer: 'UnbesiegbarAus' }, id: 'stage_main_UnsichtbarTakt'
        },
    ],
    tasks, actions,
    variables: [], flowCharts: [], events: {}, grid,
    features: [
        {
            id: 'feature_sm_welt', name: 'Scrollbare Welt',
            description: 'TGroupPanel als Level-Container: alle Objekte scrollen gemeinsam ueber Welt.x (Kamera folgt Mario).',
            tags: ['Mario', 'Kamera'], userStoryIds: ['sm_welt'],
            blueprintTaskNames: ['Frame']
        },
        {
            id: 'feature_sm_physik', name: 'Plattform-Physik',
            description: 'Schwerkraft, Sprung, Landen und Waende ueber TSprite-Physik + Engine-Push-Out (pro Frame).',
            tags: ['Mario', 'Physik'], userStoryIds: ['sm_physik'],
            blueprintTaskNames: ['SprungOderStart', 'Landen', 'LinksDruck', 'RechtsDruck', 'LinksLos', 'RechtsLos']
        },
        {
            id: 'feature_sm_gegner', name: 'Gegner',
            description: 'Goombas laufen, wenden an Waenden, fallen in Gruben; Stomp vs. Schaden ueber hitSide.',
            tags: ['Mario', 'Gegner'], userStoryIds: ['sm_gegner'],
            blueprintTaskNames: ['GoombaBeruehrt', 'GoombaWendeLinks', 'GoombaWendeRechts']
        },
        {
            id: 'feature_sm_sammeln', name: 'Muenzen & Bloecke',
            description: 'Muenzen einsammeln, ?-Bloecke von unten aktivieren (einmalig).',
            tags: ['Mario', 'Sammeln'], userStoryIds: ['sm_sammeln'],
            blueprintTaskNames: ['MuenzeGenommen', 'FrageBlockGetroffen']
        },
        {
            id: 'feature_sm_ablauf', name: 'Spielablauf',
            description: 'Start, Leben/Respawn mit Schutzzeit, Game Over, Ziel-Flagge, Neustart.',
            tags: ['Mario', 'Ablauf'], userStoryIds: ['sm_ablauf'],
            blueprintTaskNames: ['SpielStarten', 'Gestorben', 'MarioAmRand', 'ZielErreicht', 'UnbesiegbarAus']
        }
    ]
};

const story = (id, title, description, acceptanceCriteria, relatedComponents, featureId) => ({
    id, title, description, priority: 'high', status: 'done', acceptanceCriteria,
    relatedStages: ['stage_main', 'stage_blueprint'],
    createdAt: '2026-09-13T00:00:00.000Z', projectId: 'super-mario', updatedAt: '2026-09-13T00:00:00.000Z',
    relatedComponents, relatedVariables: [], interactions: [], featureId
});

const project = {
    meta: {
        id: 'super-mario', name: 'Super Mario Bros.', version: '1.0.0',
        author: 'Rolf Rieckmann / Devin',
        description: '2D-Plattformer komplett mit GCS-Bordmitteln: TGroupPanel als scrollbare Welt + TSprite-Physik (Push-Out) + Flow-Tasks.'
    },
    stage: { grid },
    stages: [blueprint, main],
    objects: [], actions: [], tasks: [], variables: [],
    activeStageId: 'stage_main',
    userStories: {
        userStories: [
            story('sm_welt', 'Scrollbare Welt',
                'Als Spieler folgt mir die Kamera durch ein langes Level.',
                ['Welt ist 220 Zellen breit, Viewport 40', 'Welt.x folgt Mario ab Schwellwert', 'HUD bleibt fix'],
                ['Welt', 'Loop', 'FrameTakt'], 'feature_sm_welt'),
            story('sm_physik', 'Plattform-Physik',
                'Als Spieler laufe, springe und lande ich stabil auf Plattformen.',
                ['Gravitation + Sprung-Impuls', 'Push-Out pro Frame = stabiles Stehen', 'Kopf anstossen, Waende stoppen', 'Fallgeschwindigkeit gedeckelt'],
                ['Mario', 'Tastatur'], 'feature_sm_physik'),
            story('sm_gegner', 'Gegner',
                'Als Spieler kaempfe ich gegen laufende Goombas.',
                ['Goombas laufen links, wenden an Waenden', 'Stomp von oben toetet + Bounce', 'Seitentreffer kostet ein Leben'],
                ['Goomba0'], 'feature_sm_gegner'),
            story('sm_sammeln', 'Muenzen & Bloecke',
                'Als Spieler sammle ich Muenzen und aktiviere ?-Bloecke.',
                ['Muenzen verschwinden bei Beruehrung (+50)', '?-Block von unten = Muenze (+200), einmalig', 'Verbrauchte Bloecke wechseln Farbe'],
                ['Muenze0', 'Frage0'], 'feature_sm_sammeln'),
            story('sm_ablauf', 'Spielablauf',
                'Als Spieler starte ich, verliere Leben und erreiche die Flagge.',
                ['3 Leben, Respawn mit Schutzzeit', 'Grube = Tod', 'Flagge = Level geschafft', 'ENTER = Neustart'],
                ['FlaggePfahl', 'UnsichtbarTakt', 'LblEnde'], 'feature_sm_ablauf'),
        ]
    }
};

writeFileSync(OUT, JSON.stringify(project, null, 2));
console.log(`Geschrieben: ${OUT}`);
console.log(`Tasks: ${tasks.length}, Actions: ${actions.length}, Welt-Kinder: ${weltKinder.length}`);

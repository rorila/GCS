/**
 * Generator fuer SuperMario_Templates.json — gleiches Level wie gen-super-mario.mjs,
 * aber die 127 Level-Objekte werden zur Laufzeit aus TSpriteTemplates gespawnt.
 *
 * Architektur:
 *  - 17 TSpriteTemplates als (unsichtbare) Kinder von "Welt" -> parentId wird vom
 *    SpritePool geerbt: Instanzen scrollen mit der Kamera und kollidieren mit Mario.
 *  - "LevelDaten" (TListVariable): [{tpl,n,x,y,w,h}] — n = Pool-Index pro Typ.
 *  - Task "LevelBauen": foreach Eintrag -> spawn_object(${TmpTpl}) + Groesse nachziehen
 *    (Pool-Instanzen heissen deterministisch "<Tpl>_pool_<n>").
 *  - backgroundImage/objectFit werden aus Super_Mario_Bros_.json uebernommen.
 *
 * Ausfuehren: node scripts/gen-super-mario-templates.mjs
 */
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const DIR = dirname(fileURLToPath(import.meta.url));
const OUT = join(DIR, '../game-server/public/projects/SuperMario_Templates.json');
const SRC = join(DIR, '../game-server/public/projects/Super_Mario_Bros_.json');

// ─── Konstanten (identisch zum Original) ───
const VIEW = 40;
const ROWS = 22;
const LVL = 220;
const GROUND = 19;
const GRAV = 1.5;
const TEMPO = 0.13;
const SPRUNG = -0.55;
const BOUNCE = -0.12;
const DECKEL = 0.45;
const GOOMBA_V = 0.035;
const KAM_SCHWELLE = 16;
const WELT_MIN = VIEW - LVL;

const C = {
    mario: '#e23636', goomba: '#7a3b12', grass: '#3faa2f', dirt: '#8b5a2b',
    pipe: '#1e9e1e', brick: '#b5651d', frage: '#f5b301', frageAlt: '#7a5230',
    plattform: '#c98a3d', coin: '#ffd700', flagge: '#2d5016', flag: '#d21f26',
    wolke: '#ffffff', huegel: '#2e7d32', busch: '#34a34f', schloss: '#7a5230', tuer: '#3a2410'
};

// ─── backgroundImage/objectFit aus dem bisherigen Projekt uebernehmen ───
// Pro Objekttyp wird ein Repraesentant gelesen (gleiche SVGs, Data-URIs).
const bilder = {};
if (existsSync(SRC)) {
    const src = JSON.parse(readFileSync(SRC, 'utf8'));
    const main = src.stages.find(s => s.type !== 'blueprint');
    const welt = main.objects.find(o => o.name === 'Welt');
    const all = [...(welt?.children || []), ...main.objects];
    const reps = ['Mario', 'BodenG0', 'BodenE0', 'Roehre0', 'TreppeA0', 'Plattform0',
        'ZiegelA18', 'Frage0', 'Muenze0', 'Goomba0', 'FlaggePfahl', 'FlaggeTuch',
        'FlaggeKugel', 'Schloss', 'SchlossTuer', 'Wolke0', 'Huegel0', 'Busch0'];
    for (const n of reps) {
        const s = all.find(o => o.name === n);
        if (s && s.backgroundImage) {
            bilder[n] = { backgroundImage: s.backgroundImage, objectFit: s.objectFit };
        }
    }
    console.log(`Bilder uebernommen: ${Object.keys(bilder).length}/${reps.length}`);
} else {
    console.warn(`WARN: ${SRC} nicht gefunden — Templates ohne backgroundImage.`);
}
const bild = rep => bilder[rep] || {};

// ─── Templates: ein TSpriteTemplate pro Objekttyp (Kind von Welt) ───
// props: Groesse/Physik wie im Original; poolSize = exakte Instanzenzahl.
const tpl = (name, rep, w, h, color, poolSize, extra = {}) => ({
    className: 'TSpriteTemplate', name,
    x: 0, y: ROWS + 2,          // geparkt unterhalb des Levels (nur Editor sichtbar)
    width: w, height: h,
    shape: 'rect', spriteColor: color,
    velocityX: 0, velocityY: 0, gravity: 0, lerpSpeed: 0.1,
    collisionEnabled: true, collisionGroup: 'level', pushOutOnCollision: true,
    poolSize, autoRecycle: false, lifetime: 0,
    appearanceMode: 'simple',
    visible: true, draggable: false, droppable: false, scope: 'stage',
    style: { backgroundColor: 'transparent', borderWidth: 0 },
    events: {}, id: `smt_${name}`, ...bild(rep), ...extra
});

const templates = [
    tpl('TplBodenG', 'BodenG0', 30, 1, C.grass, 7),
    tpl('TplBodenE', 'BodenE0', 30, ROWS - GROUND - 1, C.dirt, 7),
    tpl('TplRoehre', 'Roehre0', 2, 2, C.pipe, 6),
    tpl('TplTreppe', 'TreppeA0', 1, 1, C.brick, 22),
    tpl('TplPlattform', 'Plattform0', 5, 1, C.plattform, 9),
    tpl('TplZiegel', 'ZiegelA18', 1, 1, C.brick, 12),
    tpl('TplFrage', 'Frage0', 1, 1, C.frage, 9, {
        events: { onCollision: 'FrageBlockGetroffen' }
    }),
    tpl('TplMuenze', 'Muenze0', 1, 1, C.coin, 25, {
        shape: 'circle', collisionGroup: 'gegner', pushOutOnCollision: false,
        events: { onCollision: 'MuenzeGenommen' }
    }),
    tpl('TplGoomba', 'Goomba0', 1, 1, C.goomba, 11, {
        collisionGroup: 'gegner', gravity: GRAV, velocityX: -GOOMBA_V,
        events: {
            onCollision: 'GoombaBeruehrt',
            onCollisionLeft: 'GoombaWendeLinks',
            onCollisionRight: 'GoombaWendeRechts'
        }
    }),
    tpl('TplFlaggePfahl', 'FlaggePfahl', 0.5, 10, C.flagge, 1, {
        events: { onCollision: 'ZielErreicht' }
    }),
    tpl('TplFlaggeTuch', 'FlaggeTuch', 1.5, 1, C.flag, 1, { collisionEnabled: false, pushOutOnCollision: false }),
    tpl('TplFlaggeKugel', 'FlaggeKugel', 0.8, 0.8, C.coin, 1, { shape: 'circle', collisionEnabled: false, pushOutOnCollision: false }),
    tpl('TplSchloss', 'Schloss', 7, 5, C.schloss, 1, { collisionEnabled: false, pushOutOnCollision: false }),
    tpl('TplSchlossTuer', 'SchlossTuer', 2, 3, C.tuer, 1, { collisionEnabled: false, pushOutOnCollision: false }),
    tpl('TplWolke', 'Wolke0', 4, 1.5, C.wolke, 7, { shape: 'circle', collisionEnabled: false, pushOutOnCollision: false }),
    tpl('TplHuegel', 'Huegel0', 7, 3, C.huegel, 4, { collisionEnabled: false, pushOutOnCollision: false }),
    tpl('TplBusch', 'Busch0', 3, 1, C.busch, 3, { collisionEnabled: false, pushOutOnCollision: false }),
];

// ─── Level-Daten: identische Geometrie wie das Original ───
// Eintrag: {tpl, n, x, y, w, h} — n = laufende Nummer im Pool des Typs.
const levelDaten = [];
const zaehler = {};
const add = (tplName, x, y, w, h) => {
    const n = zaehler[tplName] = (zaehler[tplName] || 0) + 1;
    levelDaten.push({ tpl: tplName, n: n - 1, x, y, w, h });
};

// Boden-Segmente (Gras + Erde), Luecken = Gruben
[[0, 30], [34, 23], [60, 10], [73, 25], [102, 35], [140, 28], [172, 48]].forEach(([x, w]) => {
    add('TplBodenG', x, GROUND, w, 1);
    add('TplBodenE', x, GROUND + 1, w, ROWS - GROUND - 1);
});

// Roehren
[[27, 2], [40, 3], [46, 4], [52, 5], [88, 3], [118, 2]].forEach(([x, h]) =>
    add('TplRoehre', x, GROUND - h, 2, h));

// Treppen
const treppe = (x, stufen, dir) => {
    for (let i = 0; i < stufen; i++) {
        const h = dir > 0 ? i + 1 : stufen - i;
        add('TplTreppe', x + i, GROUND - h, 1, h);
    }
};
treppe(78, 4, 1); treppe(82, 4, -1); treppe(143, 4, 1); treppe(149, 4, -1); treppe(186, 6, 1);

// Schwebeplattformen / Bruecken
[[30, 14, 5], [57, 13, 4], [69, 14, 4], [98, 13, 5],
 [105, 12, 12], [121, 12, 10], [137, 13, 4], [168, 13, 4], [154, 9, 5]
].forEach(([x, y, w]) => add('TplPlattform', x, y, w, 1));

// Ziegel
[18, 20, 22].forEach(x => add('TplZiegel', x, 14, 1, 1));
[126, 127, 129, 131, 132].forEach(x => add('TplZiegel', x, 9, 1, 1));
[155, 157, 158, 159].forEach(x => add('TplZiegel', x, 12, 1, 1));

// ?-Bloecke
[[19, 14], [21, 14], [20, 10], [92, 13], [128, 9], [130, 9], [156, 12], [176, 13], [178, 13]]
    .forEach(([x, y]) => add('TplFrage', x, y, 1, 1));

// Muenzen
[[8, 16], [9, 15], [10, 14], [11, 15], [12, 16], [16, 13], [24, 14],
 [40, 13], [46, 12], [52, 11], [32, 12], [58, 11], [71, 12], [100, 11],
 [138, 11], [169, 11], [106, 10], [109, 10], [112, 10], [115, 10], [118, 10],
 [155, 7], [157, 7], [188, 12], [193, 11]
].forEach(([x, y]) => add('TplMuenze', x, y, 1, 1));

// Goombas
[25, 44, 55, 76, 93, 112, 133, 150, 163, 181, 184].forEach(x =>
    add('TplGoomba', x, GROUND - 1, 1, 1));

// Flagge + Schloss + Deko
add('TplFlaggePfahl', 196, 9, 0.5, 10);
add('TplFlaggeTuch', 194.5, 10, 1.5, 1);
add('TplFlaggeKugel', 195.8, 8.4, 0.8, 0.8);
add('TplSchloss', 204, 14, 7, 5);
add('TplSchlossTuer', 207, 16, 2, 3);
[[6, 3], [34, 5], [66, 4], [96, 3], [126, 5], [156, 3], [186, 5]].forEach(([x, y]) =>
    add('TplWolke', x, y, 4, 1.5));
[[4, 16, 7, 3], [64, 17, 5, 2], [144, 16, 8, 3], [199, 17, 6, 2]].forEach(([x, y, w, h]) =>
    add('TplHuegel', x, y, w, h));
[[14, 18, 3, 1], [84, 18, 4, 1], [160, 18, 3, 1]].forEach(([x, y, w]) =>
    add('TplBusch', x, y, w, 1));

// Pool-Groessen gegen Eintragszahlen pruefen
for (const t of templates) {
    const need = zaehler[t.name] || 0;
    if (need !== t.poolSize) {
        console.warn(`POOL-MISMATCH ${t.name}: poolSize=${t.poolSize}, Eintraege=${need}`);
    }
}

// ─── Helfer: Actions/Tasks (wie Original) ───
const act = (name, body) => ({ name, ...body });
const prop = (name, changes) => act(name, { type: 'property', changes });
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
    id: 'smt_' + name.toLowerCase()
});

// ─── Actions ───
const actions = [
    prop('Act_StartWerte', {
        Status: 'playing', Punkte: 0, Muenzen: 0, Leben: 3,
        TasteLinks: 0, TasteRechts: 0, AmBoden: 0, Unbesiegbar: 0
    }),
    prop('Act_MarioReset', {
        'Mario.x': 3, 'Mario.y': 17, 'Mario.velocityX': 0, 'Mario.velocityY': 0,
        'Mario.visible': 1
    }),
    // Physik erst bei Spielstart — Mario steht im Ready-Bildschirm sicher auf dem Boden
    prop('Act_GravAn', { 'Mario.gravity': GRAV }),
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
    calc('Act_MuenzenPlus', 'Muenzen + 1', 'Muenzen'),
    calc('Act_Punkte50', 'Punkte + 50', 'Punkte'),
    calc('Act_Punkte100', 'Punkte + 100', 'Punkte'),
    calc('Act_Punkte200', 'Punkte + 200', 'Punkte'),
    calc('Act_Punkte1000', 'Punkte + 1000', 'Punkte'),
    // Verbrauchter ?-Block: Bild entfernen -> Farbe (frageAlt) sichtbar
    prop('Act_BlockVerbraucht', { 'self.benutzt': 1, 'self.backgroundImage': '', 'self.spriteColor': C.frageAlt }),
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
    // Spawn-Hilfsvariablen fuer LevelBauen
    calc('Act_TmpTpl', 'Eintrag.tpl', 'TmpTpl'),
    calc('Act_TmpName', 'Eintrag.tpl + "_pool_" + Eintrag.n', 'TmpName'),
    prop('Act_SpawnSize', {
        '${TmpName}.width': '${Eintrag.w}', '${TmpName}.height': '${Eintrag.h}'
    }),
    act('Act_NeuStarten', { type: 'restart_game' }),
];

// ─── Tasks ───
const tasks = [
    task('SpielInit', 'Beim Laden (Welt.onStart): Level bauen + Startbild zeigen. Laueft vor dem ersten Tastendruck.', [
        taskRef('LevelBauen'), actRef('Act_MarioReset'), actRef('Act_WeltReset'),
    ]),
    task('SpielStarten', 'Neue Runde: Werte, Mario-Physik an, Kamera und Frame-Takt.', [
        actRef('Act_StartWerte'), actRef('Act_MarioReset'), actRef('Act_WeltReset'),
        actRef('Act_GravAn'), actRef('Act_InfoAus'), actRef('Act_FrameAn'),
    ]),
    task('LevelBauen', 'Baut das Level: je LevelDaten-Eintrag eine Pool-Instanz spawnen.', [
        {
            type: 'foreach', name: 'ForEach: Eintrag in LevelDaten',
            sourceArray: 'LevelDaten', itemVar: 'Eintrag',
            body: [
                actRef('Act_TmpTpl'), actRef('Act_TmpName'),
                {
                    type: 'spawn_object', name: 'Act_SpawnEintrag',
                    templateId: '${TmpTpl}', x: '${Eintrag.x}', y: '${Eintrag.y}'
                },
                actRef('Act_SpawnSize'),
            ]
        },
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
    task('MuenzeGenommen', 'Muenze eingesammelt (nur durch Mario, einmalig) -> Pool-Release.', [
        cond('other', '==', 'Mario', [
            cond('self.visible', '==', true, [
                { type: 'destroy_object', name: 'Act_MuenzeRelease', target: 'self' },
                actRef('Act_MuenzenPlus'), actRef('Act_Punkte50'),
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
                [{ type: 'destroy_object', name: 'Act_GegnerRelease', target: 'self' },
                 actRef('Act_SprungBounce'), actRef('Act_Punkte100')],
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

// ─── Stage / Objekte ───
const grid = { cols: VIEW, rows: ROWS, cellSize: 26, visible: false, snapToGrid: true, backgroundColor: '#5c94fc' };

// Service-Box-Geometrie wie in Tetris_Classic (klein, geparkt)
const v = (name, type, className, initialValue, extra = {}) => ({
    name, type, isVariable: true, isService: true, isHiddenInRun: true, className,
    x: 1, y: 1, width: 4, height: 2,
    draggable: false, droppable: false, collisionEnabled: false, style: {},
    initialValue, defaultValue: initialValue, value: initialValue,
    scope: 'global', id: `smt_var_${name}`, ...extra
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
        v('TmpTpl', 'string', 'TStringVariable', ''),
        v('TmpName', 'string', 'TStringVariable', ''),
        // Level-Daten nur in items ablegen (kein value) — sonst zeigt der Editor
        // den Array-Inhalt als "[object Object],..." im Variablen-Panel an.
        v('LevelDaten', 'list', 'TListVariable', undefined, { items: levelDaten }),
    ],
    flowCharts: [], events: {}, grid,
};

const lbl = (name, text, x, y, w, h, style) => ({
    className: 'TLabel', name, x, y, width: w, height: h, text, style, id: `stage_main_${name}`
});
const hudStyle = { color: '#ffffff', fontSize: 15, fontWeight: 'bold', backgroundColor: 'transparent', borderWidth: 0 };

// Mario bleibt statisches Kind von Welt (Unikat, kein Template)
const mario = {
    className: 'TSprite', name: 'Mario', x: 3, y: 17, width: 1, height: 2,
    shape: 'rect', spriteColor: C.mario,
    velocityX: 0, velocityY: 0, gravity: 0, lerpSpeed: 0.1,
    collisionEnabled: true, collisionGroup: 'default', pushOutOnCollision: false,
    appearanceMode: 'simple',
    visible: true, draggable: false, droppable: false, scope: 'stage',
    style: { backgroundColor: 'transparent', borderWidth: 0 },
    events: { onCollisionBottom: 'Landen', onBoundaryHit: 'MarioAmRand' },
    id: 'smt_Mario', ...bild('Mario')
};

const main = {
    id: 'stage_main', name: 'Super Mario Bros. (Templates)', type: 'main',
    objects: [
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
        {
            className: 'TGroupPanel', name: 'Welt', x: 0, y: 0, width: LVL, height: ROWS,
            style: { backgroundColor: 'transparent', borderWidth: 0 },
            events: { onStart: 'SpielInit' },
            children: [mario, ...templates], id: 'stage_main_Welt'
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
            id: 'feature_smt_templates', name: 'Sprite-Templates & Pool',
            description: 'Alle Level-Objekte entstehen zur Laufzeit aus TSpriteTemplates via SpritePool (spawn_object) statt als statische Kinder.',
            tags: ['Mario', 'Templates'], userStoryIds: ['smt_templates'],
            blueprintTaskNames: ['LevelBauen']
        },
        {
            id: 'feature_smt_welt', name: 'Scrollbare Welt',
            description: 'TGroupPanel als Level-Container: Templates + Instanzen scrollen gemeinsam ueber Welt.x.',
            tags: ['Mario', 'Kamera'], userStoryIds: ['smt_welt'],
            blueprintTaskNames: ['Frame']
        },
        {
            id: 'feature_smt_physik', name: 'Plattform-Physik',
            description: 'Schwerkraft, Sprung, Landen ueber TSprite-Physik + Engine-Push-Out (geerbt vom Template).',
            tags: ['Mario', 'Physik'], userStoryIds: ['smt_physik'],
            blueprintTaskNames: ['SprungOderStart', 'Landen', 'LinksDruck', 'RechtsDruck', 'LinksLos', 'RechtsLos']
        },
        {
            id: 'feature_smt_gegner', name: 'Gegner & Sammeln',
            description: 'Goombas/Muenzen/?-Bloecke als Pool-Instanzen; destroy_object released in den Pool.',
            tags: ['Mario', 'Gegner'], userStoryIds: ['smt_gegner'],
            blueprintTaskNames: ['GoombaBeruehrt', 'GoombaWendeLinks', 'GoombaWendeRechts', 'MuenzeGenommen', 'FrageBlockGetroffen']
        },
        {
            id: 'feature_smt_ablauf', name: 'Spielablauf',
            description: 'Start, Leben/Respawn mit Schutzzeit, Game Over, Ziel-Flagge, Neustart.',
            tags: ['Mario', 'Ablauf'], userStoryIds: ['smt_ablauf'],
            blueprintTaskNames: ['SpielStarten', 'Gestorben', 'MarioAmRand', 'ZielErreicht', 'UnbesiegbarAus']
        }
    ]
};

const story = (id, title, description, acceptanceCriteria, relatedComponents, featureId) => ({
    id, title, description, priority: 'high', status: 'done', acceptanceCriteria,
    relatedStages: ['stage_main', 'stage_blueprint'],
    createdAt: '2026-09-13T00:00:00.000Z', projectId: 'super-mario-templates', updatedAt: '2026-09-13T00:00:00.000Z',
    relatedComponents, relatedVariables: [], interactions: [], featureId
});

const project = {
    meta: {
        id: 'super-mario-templates', name: 'Super Mario Bros. (Templates)', version: '1.0.0',
        author: 'Rolf Rieckmann / Devin',
        description: 'Wie SuperMario, aber Level-Objekte werden zur Laufzeit aus TSpriteTemplates (SpritePool) gespawnt. Gleiches Layout, gleiche Optik.'
    },
    stage: { grid },
    stages: [blueprint, main],
    objects: [], actions: [], tasks: [], variables: [],
    activeStageId: 'stage_main',
    userStories: {
        userStories: [
            story('smt_templates', 'Level aus Sprite-Templates',
                'Als Entwickler moechte ich das Level aus TSpriteTemplates bauen statt duplizierte Sprites zu pflegen.',
                ['17 Templates statt 127 statischer Objekte', 'LevelBauen spawnt aus LevelDaten-Liste', 'Pool-Instanzen erben Physik/Bilder/Events vom Template'],
                ['TplBodenG', 'TplGoomba', 'TplMuenze', 'LevelDaten'], 'feature_smt_templates'),
            story('smt_welt', 'Scrollbare Welt',
                'Als Spieler folgt mir die Kamera durch ein langes Level.',
                ['Pool-Instanzen erben parentId=Welt', 'Welt.x folgt Mario ab Schwellwert', 'HUD bleibt fix'],
                ['Welt', 'Loop', 'FrameTakt'], 'feature_smt_welt'),
            story('smt_physik', 'Plattform-Physik',
                'Als Spieler laufe, springe und lande ich stabil auf Plattformen.',
                ['Gravitation + Sprung-Impuls', 'Push-Out pro Frame = stabiles Stehen', 'Pool-Tiles tragen pushOutOnCollision'],
                ['Mario', 'Tastatur'], 'feature_smt_physik'),
            story('smt_gegner', 'Gegner & Sammeln',
                'Als Spieler kaempfe ich gegen Goombas und sammle Muenzen.',
                ['Stomp released Goomba in den Pool', 'Muenze released in den Pool (+50)', '?-Block einmalig (+200)'],
                ['TplGoomba', 'TplMuenze', 'TplFrage'], 'feature_smt_gegner'),
            story('smt_ablauf', 'Spielablauf',
                'Als Spieler starte ich, verliere Leben und erreiche die Flagge.',
                ['3 Leben, Respawn mit Schutzzeit', 'Grube = Tod', 'Flagge = Level geschafft', 'ENTER = Neustart'],
                ['TplFlaggePfahl', 'UnsichtbarTakt', 'LblEnde'], 'feature_smt_ablauf'),
        ]
    }
};

writeFileSync(OUT, JSON.stringify(project, null, 2));
console.log(`Geschrieben: ${OUT}`);
console.log(`Templates: ${templates.length}, Level-Eintraege: ${levelDaten.length}, Tasks: ${tasks.length}, Actions: ${actions.length}`);

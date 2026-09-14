/**
 * Generator fuer Snake-Grid.json - Snake auf TGridBoard-Basis.
 * Ersetzt die ~220 Sprite-/Panel-Objekte des Lernprojekts durch ein
 * generisches Raster + zwei Positionslisten (SchlangeX/SchlangeY).
 * Ausfuehren: node scripts/gen-snake-grid.mjs
 */
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../game-server/public/projects/Snake-Grid.json');

const act = (name, body) => ({ name, ...body });
const cm = (name, target, method, params = [], resultVariable) =>
    act(name, { type: 'call_method', target, method, params, ...(resultVariable ? { resultVariable } : {}) });
const calc = (name, formula, resultVariable) => act(name, { type: 'calculate', formula, resultVariable });
const prop = (name, changes) => act(name, { type: 'property', changes });
// 'property' statt 'set_variable': autoConvert macht aus "${ZufallX}" eine
// Zahl; set_variable wuerde Strings speichern (vgl. Tetris-Fix).
const setVar = (name, variableName, value) => act(name, { type: 'property', changes: { [variableName]: value } });
const cond = (variable, operator, value, then, els = []) => ({
    type: 'condition', name: `Branch: ${variable} ${operator} ${value}`,
    condition: { variable, operator, value }, then, else: els
});
const taskRef = name => ({ type: 'task', name });
const actRef = name => ({ type: 'action', name });
const task = (name, description, actionSequence) => ({
    name, description, actionSequence, triggerMode: 'local-sync', params: [], id: 'sg_' + name.toLowerCase()
});

// Zellwerte: 0=frei, 1=Koerper, 2=Futter, 3=Kopf; getCell ausserhalb → -1 (Wand)

const actions = [
    // Board
    cm('Act_BoardLeeren', 'Spielfeld', 'clearBoard'),
    cm('Act_TextAus', 'Spielfeld', 'setOverlayText', ['']),
    cm('Act_TextPause', 'Spielfeld', 'setOverlayText', ['⏸ PAUSE\nP = weiter']),
    cm('Act_TextGameOver', 'Spielfeld', 'setOverlayText', ['GAME OVER\nScore: ${Score}\n↻ Leertaste = neu']),
    cm('Act_KopfSetzen', 'Spielfeld', 'setCell', ['${NeuX}', '${NeuY}', '3']),
    cm('Act_KopfAlt', 'Spielfeld', 'setCell', ['${KopfX}', '${KopfY}', '1']),
    cm('Act_SchwanzWeg', 'Spielfeld', 'setCell', ['${TailX}', '${TailY}', '0']),
    cm('Act_StartKopf', 'Spielfeld', 'setCell', ['${KopfX}', '${KopfY}', '3']),
    cm('Act_ZelleLesen', 'Spielfeld', 'getCell', ['${NeuX}', '${NeuY}'], 'ZellWert'),
    cm('Act_FutterLesen', 'Spielfeld', 'getCell', ['${FutterX}', '${FutterY}'], 'Belegt'),
    cm('Act_FutterSetzen', 'Spielfeld', 'setCell', ['${FutterX}', '${FutterY}', '2']),
    cm('Act_ZufallX', 'ZufallX', 'generate'),
    cm('Act_ZufallY', 'ZufallY', 'generate'),
    setVar('Act_FutterX', 'FutterX', '${ZufallX}'),
    setVar('Act_FutterY', 'FutterY', '${ZufallY}'),
    // Listen
    act('Act_KopfPushX', { type: 'list_push', target: 'SchlangeX', value: '${NeuX}' }),
    act('Act_KopfPushY', { type: 'list_push', target: 'SchlangeY', value: '${NeuY}' }),
    act('Act_StartPushX', { type: 'list_push', target: 'SchlangeX', value: '${KopfX}' }),
    act('Act_StartPushY', { type: 'list_push', target: 'SchlangeY', value: '${KopfY}' }),
    act('Act_TailPopX', { type: 'list_remove', target: 'SchlangeX', index: '0', resultVariable: 'TailX' }),
    act('Act_TailPopY', { type: 'list_remove', target: 'SchlangeY', index: '0', resultVariable: 'TailY' }),
    act('Act_ListeLeerX', { type: 'list_clear', target: 'SchlangeX' }),
    act('Act_ListeLeerY', { type: 'list_clear', target: 'SchlangeY' }),
    // Rechnen
    calc('Act_NeuX', 'KopfX + DX', 'NeuX'),
    calc('Act_NeuY', 'KopfY + DY', 'NeuY'),
    calc('Act_ScorePlus', 'Score + 10', 'Score'),
    calc('Act_LaengePlus', 'Laenge + 1', 'Laenge'),
    // Werte
    prop('Act_RichtungAnwenden', { DX: '${WunschDX}', DY: '${WunschDY}' }),
    prop('Act_KopfNeu', { KopfX: '${NeuX}', KopfY: '${NeuY}', Abgebogen: 0 }),
    prop('Act_StartWerte', { Status: 'playing', Score: 0, Laenge: 1, KopfX: 6, KopfY: 6, DX: 1, DY: 0, WunschDX: 1, WunschDY: 0, Abgebogen: 0 }),
    prop('Act_TaktAn', { 'Takt.enabled': true }),
    prop('Act_TaktAus', { 'Takt.enabled': false }),
    prop('Act_StatusPause', { Status: 'paused' }),
    prop('Act_StatusWeiter', { Status: 'playing' }),
    prop('Act_StatusEnde', { Status: 'gameover' }),
    // Richtungswuensche (nur wenn nicht entgegengesetzt zur aktuellen Richtung)
    prop('Act_WunschLinks', { WunschDX: -1, WunschDY: 0, Abgebogen: 1 }),
    prop('Act_WunschRechts', { WunschDX: 1, WunschDY: 0, Abgebogen: 1 }),
    prop('Act_WunschOben', { WunschDX: 0, WunschDY: -1, Abgebogen: 1 }),
    prop('Act_WunschUnten', { WunschDX: 0, WunschDY: 1, Abgebogen: 1 }),
];

const richtung = (name, aktionsName, achseVar, sperrWert, beschreibung) =>
    task(name, beschreibung, [
        cond('Status', '==', 'playing', [
            cond('Abgebogen', '==', 0, [
                cond(achseVar, '!=', sperrWert, [actRef(aktionsName)]),
            ]),
        ]),
    ]);

const tasks = [
    task('SpielStarten', 'Neue Runde: Board leeren, Schlange auf Startposition, Futter legen, Takt an.', [
        actRef('Act_BoardLeeren'), actRef('Act_TextAus'), actRef('Act_StartWerte'),
        actRef('Act_ListeLeerX'), actRef('Act_ListeLeerY'),
        actRef('Act_StartPushX'), actRef('Act_StartPushY'),
        actRef('Act_StartKopf'),
        taskRef('FutterNeu'),
        actRef('Act_TaktAn'),
    ]),
    task('Ticken', 'Takt: Richtung anwenden und Schritt ausfuehren.', [
        cond('Status', '==', 'playing', [
            actRef('Act_RichtungAnwenden'),
            actRef('Act_NeuX'), actRef('Act_NeuY'), actRef('Act_ZelleLesen'),
            cond('ZellWert', '==', 2, [taskRef('Fressen')], [
                cond('ZellWert', '==', 0, [taskRef('Bewegen')], [taskRef('SpielEnde')]),
            ]),
        ]),
    ]),
    task('Bewegen', 'Normaler Schritt: Kopf vor, Schwanz weg.', [
        actRef('Act_KopfAlt'),
        actRef('Act_KopfPushX'), actRef('Act_KopfPushY'),
        actRef('Act_TailPopX'), actRef('Act_TailPopY'),
        actRef('Act_SchwanzWeg'),
        actRef('Act_KopfSetzen'),
        actRef('Act_KopfNeu'),
    ]),
    task('Fressen', 'Futter erreicht: wachsen, Punkte, neues Futter.', [
        actRef('Act_KopfAlt'),
        actRef('Act_KopfPushX'), actRef('Act_KopfPushY'),
        actRef('Act_KopfSetzen'),
        actRef('Act_KopfNeu'),
        actRef('Act_ScorePlus'), actRef('Act_LaengePlus'),
        taskRef('FutterNeu'),
    ]),
    task('FutterNeu', 'Zufaellige freie Zelle fuer das Futter suchen.', [
        actRef('Act_ZufallX'), actRef('Act_ZufallY'),
        actRef('Act_FutterX'), actRef('Act_FutterY'), actRef('Act_FutterLesen'),
        {
            type: 'while', name: 'While: Belegt != 0',
            condition: { variable: 'Belegt', operator: '!=', value: 0 },
            body: [
                actRef('Act_ZufallX'), actRef('Act_ZufallY'),
                actRef('Act_FutterX'), actRef('Act_FutterY'), actRef('Act_FutterLesen'),
            ],
        },
        actRef('Act_FutterSetzen'),
    ]),
    richtung('RichtungLinks', 'Act_WunschLinks', 'DX', 1, 'Wunsch nach links (nicht aus Rechtslauf).'),
    richtung('RichtungRechts', 'Act_WunschRechts', 'DX', -1, 'Wunsch nach rechts (nicht aus Linkslauf).'),
    richtung('RichtungOben', 'Act_WunschOben', 'DY', 1, 'Wunsch nach oben (nicht aus Abwaertslauf).'),
    richtung('RichtungUnten', 'Act_WunschUnten', 'DY', -1, 'Wunsch nach unten (nicht aus Aufwaertslauf).'),
    task('PauseWechsel', 'Pause umschalten.', [
        cond('Status', '==', 'playing',
            [actRef('Act_StatusPause'), actRef('Act_TaktAus'), actRef('Act_TextPause')],
            [cond('Status', '==', 'paused',
                [actRef('Act_StatusWeiter'), actRef('Act_TextAus'), actRef('Act_TaktAn')])]),
    ]),
    task('StartOderNeu', 'Leertaste: in Pause fortsetzen, sonst neue Runde starten.', [
        cond('Status', '==', 'paused', [taskRef('PauseWechsel')], [
            cond('Status', '!=', 'playing', [taskRef('SpielStarten')]),
        ]),
    ]),
    task('SpielEnde', 'Game Over: Takt aus und Hinweis zeigen.', [
        actRef('Act_StatusEnde'), actRef('Act_TaktAus'), actRef('Act_TextGameOver'),
    ]),
];

const grid = { cols: 64, rows: 40, cellSize: 18, visible: false, snapToGrid: true, backgroundColor: '#08151b' };
// id ist Pflicht: RuntimeStageManager dedupliziert per o.id — ohne id
// kollabieren alle Service-Objekte zu einem (undefined).
const serviceObj = (className, name, extra = {}) => ({
    className, name, isVariable: true, isService: true, isHiddenInRun: true,
    x: 1, y: 1, width: 4, height: 2, style: {}, id: `stage_blueprint_${name}`, ...extra
});
const btn = (name, text, x, y, w, h, taskName, style) => ({
    className: 'TButton', name, x, y, width: w, height: h, text, style,
    events: { onClick: taskName }, id: `stage_main_${name}`
});
const lbl = (name, text, x, y, w, h, style) => ({
    className: 'TLabel', name, x, y, width: w, height: h, text, style, id: `stage_main_${name}`
});
const btnStyle = (bg, color, border) => ({ backgroundColor: bg, color, borderColor: border, borderWidth: 1, borderRadius: 7, fontSize: 13 });

const blueprint = {
    id: 'stage_blueprint', name: 'Globale Dienste', type: 'blueprint',
    objects: [
        {
            className: 'TInputController', name: 'Tastatur', enabled: true,
            isHiddenInRun: true, isService: true, x: 1, y: 1,
            events: {
                onKeyDown_ArrowLeft: 'RichtungLinks', onKeyDown_KeyA: 'RichtungLinks',
                onKeyDown_ArrowRight: 'RichtungRechts', onKeyDown_KeyD: 'RichtungRechts',
                onKeyDown_ArrowUp: 'RichtungOben', onKeyDown_KeyW: 'RichtungOben',
                onKeyDown_ArrowDown: 'RichtungUnten', onKeyDown_KeyS: 'RichtungUnten',
                onKeyDown_Space: 'StartOderNeu', onKeyDown_Enter: 'StartOderNeu',
                onKeyDown_KeyP: 'PauseWechsel',
            },
            id: 'stage_blueprint_Tastatur',
        },
        serviceObj('TListVariable', 'SchlangeX', { items: [] }),
        serviceObj('TListVariable', 'SchlangeY', { items: [] }),
        serviceObj('TRandomVariable', 'ZufallX', { min: 0, max: 15, isInteger: true }),
        serviceObj('TRandomVariable', 'ZufallY', { min: 0, max: 11, isInteger: true }),
    ],
    tasks: [], actions: [],
    variables: [
        { name: 'Status', type: 'string', isVariable: true, className: 'TStringVariable', initialValue: 'ready', defaultValue: 'ready', value: 'ready', scope: 'global', id: 'sg_var_Status' },
        { name: 'Score', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 0, defaultValue: 0, value: 0, scope: 'global', id: 'sg_var_Score' },
        { name: 'Laenge', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 1, defaultValue: 1, value: 1, scope: 'global', id: 'sg_var_Laenge' },
        { name: 'KopfX', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 6, defaultValue: 6, value: 6, scope: 'global', id: 'sg_var_KopfX' },
        { name: 'KopfY', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 6, defaultValue: 6, value: 6, scope: 'global', id: 'sg_var_KopfY' },
        { name: 'DX', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 1, defaultValue: 1, value: 1, scope: 'global', id: 'sg_var_DX' },
        { name: 'DY', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 0, defaultValue: 0, value: 0, scope: 'global', id: 'sg_var_DY' },
        { name: 'WunschDX', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 1, defaultValue: 1, value: 1, scope: 'global', id: 'sg_var_WunschDX' },
        { name: 'WunschDY', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 0, defaultValue: 0, value: 0, scope: 'global', id: 'sg_var_WunschDY' },
        { name: 'Abgebogen', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 0, defaultValue: 0, value: 0, scope: 'global', id: 'sg_var_Abgebogen' },
        { name: 'NeuX', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 0, defaultValue: 0, value: 0, scope: 'global', id: 'sg_var_NeuX' },
        { name: 'NeuY', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 0, defaultValue: 0, value: 0, scope: 'global', id: 'sg_var_NeuY' },
        { name: 'ZellWert', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 0, defaultValue: 0, value: 0, scope: 'global', id: 'sg_var_ZellWert' },
        { name: 'FutterX', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 0, defaultValue: 0, value: 0, scope: 'global', id: 'sg_var_FutterX' },
        { name: 'FutterY', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 0, defaultValue: 0, value: 0, scope: 'global', id: 'sg_var_FutterY' },
        { name: 'Belegt', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 0, defaultValue: 0, value: 0, scope: 'global', id: 'sg_var_Belegt' },
        { name: 'TailX', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 0, defaultValue: 0, value: 0, scope: 'global', id: 'sg_var_TailX' },
        { name: 'TailY', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 0, defaultValue: 0, value: 0, scope: 'global', id: 'sg_var_TailY' },
    ],
    flowCharts: [], events: {}, grid,
};

const main = {
    id: 'stage_main', name: 'Snake Grid', type: 'main',
    objects: [
        lbl('Titel', '🐍 SNAKE · GRID', 2, 1, 14, 2, { color: '#4ade80', fontSize: 20, fontWeight: 'bold', backgroundColor: 'transparent', borderWidth: 0 }),
        lbl('LblScore', 'SCORE  ${Score}', 46, 4, 14, 2, { color: '#e2e8f0', fontSize: 17, fontWeight: '600', backgroundColor: 'transparent', borderWidth: 0 }),
        lbl('LblLaenge', 'LÄNGE  ${Laenge}', 46, 7, 14, 2, { color: '#e2e8f0', fontSize: 17, fontWeight: '600', backgroundColor: 'transparent', borderWidth: 0 }),
        lbl('Hilfe', 'Pfeile/WASD  lenken\nLEER  Start\nP  Pause', 46, 12, 14, 6, { color: '#64748b', fontSize: 12, backgroundColor: 'transparent', borderWidth: 0 }),
        {
            className: 'TGridBoard', name: 'Spielfeld',
            x: 15, y: 4, width: 30, height: 26,
            cols: 16, rows: 12,
            palette: ['#0b1420', '#4ade80', '#f87171', '#86efac'],
            gridLines: true,
            overlayText: 'SNAKE\nLeertaste = Start',
            style: { backgroundColor: '#0b1420', borderColor: '#1f3a2a', borderWidth: 2, borderRadius: 8 },
            id: 'stage_main_Spielfeld'
        },
        {
            className: 'TTimer', name: 'Takt', x: 1, y: 3, width: 4, height: 2,
            interval: 200, enabled: false, maxInterval: 0, currentInterval: 0,
            isService: true, isHiddenInRun: true, style: {},
            events: { onTimer: 'Ticken' }, id: 'stage_main_Takt'
        },
        btn('BtnStart', '▶ START', 20, 32, 8, 2, 'StartOderNeu', btnStyle('#20453f', '#dcfff0', '#416e60')),
        btn('BtnPause', '⏸ PAUSE', 29, 32, 8, 2, 'PauseWechsel', btnStyle('#3a3418', '#fde68a', '#a5853b')),
        btn('BtnNeu', '↻ NEU', 38, 32, 8, 2, 'SpielStarten', btnStyle('#1e3a5f', '#dbeafe', '#3b82f6')),
        btn('TouchOben', '▲', 4, 24, 5, 3, 'RichtungOben', btnStyle('#1a2440', '#c7d2fe', '#334166')),
        btn('TouchLinks', '◀', 2, 28, 5, 3, 'RichtungLinks', btnStyle('#1a2440', '#c7d2fe', '#334166')),
        btn('TouchUnten', '▼', 4, 32, 5, 3, 'RichtungUnten', btnStyle('#1a2440', '#c7d2fe', '#334166')),
        btn('TouchRechts', '▶', 6, 28, 5, 3, 'RichtungRechts', btnStyle('#1a2440', '#c7d2fe', '#334166')),
    ],
    tasks, actions,
    variables: [], flowCharts: [], events: {}, grid,
    features: [
        {
            id: 'feature_sg_raster', name: 'Raster & Board',
            description: 'TGridBoard 16x12: Schlange, Futter und Kopf als Zellwerte, Kollision per getCell.',
            tags: ['Snake', 'GridBoard'], userStoryIds: ['sg_raster'], blueprintTaskNames: []
        },
        {
            id: 'feature_sg_bewegung', name: 'Bewegung & Wachstum',
            description: 'TTimer-Takt verschiebt Kopf/Schwanz ueber SchlangeX/Y-Listen; Futter laesst die Schlange wachsen.',
            tags: ['Snake', 'Timer'], userStoryIds: ['sg_bewegung'],
            blueprintTaskNames: ['Ticken', 'Bewegen', 'Fressen', 'FutterNeu']
        },
        {
            id: 'feature_sg_richtung', name: 'Richtungswechsel',
            description: 'Pfeile/WASD/Buttons; ein Wechsel pro Takt, kein direkter Rueckwaertslauf.',
            tags: ['Snake', 'Input'], userStoryIds: ['sg_richtung'],
            blueprintTaskNames: ['RichtungLinks', 'RichtungRechts', 'RichtungOben', 'RichtungUnten']
        },
        {
            id: 'feature_sg_ablauf', name: 'Spielablauf',
            description: 'Start-Overlay, Pause, Game Over bei Wand- oder Selbstkollision, Neustart.',
            tags: ['Snake', 'Ablauf'], userStoryIds: ['sg_ablauf'],
            blueprintTaskNames: ['SpielStarten', 'PauseWechsel', 'StartOderNeu', 'SpielEnde']
        }
    ]
};

const story = (id, title, description, acceptanceCriteria, relatedComponents, featureId) => ({
    id, title, description, priority: 'high', status: 'done', acceptanceCriteria,
    relatedStages: ['stage_main', 'stage_blueprint'],
    createdAt: '2026-09-13T00:00:00.000Z', projectId: 'snake-grid', updatedAt: '2026-09-13T00:00:00.000Z',
    relatedComponents, relatedVariables: [], interactions: [], featureId
});

const project = {
    meta: {
        id: 'snake-grid', name: 'Snake Grid', version: '1.0.0',
        author: 'Rolf Rieckmann / Devin',
        description: 'Snake auf TGridBoard-Basis: 16x12 Raster, Positionslisten statt Sprites, Kollision per getCell.'
    },
    stage: { grid },
    stages: [blueprint, main],
    objects: [], actions: [], tasks: [], variables: [],
    activeStageId: 'stage_main',
    userStories: {
        userStories: [
            story('sg_raster', 'Raster & Board',
                'Als Spieler möchte ich Schlange und Futter auf einem klaren Raster sehen.',
                ['16×12 Zellen', 'Kopf heller als Körper', 'Futter rot', 'Kollision über getCell (frei/Körper/Futter/Wand)'],
                ['Spielfeld'], 'feature_sg_raster'),
            story('sg_bewegung', 'Bewegung & Wachstum',
                'Als Spieler möchte ich, dass die Schlange sich taktweise bewegt und beim Fressen wächst.',
                ['Timer-Takt bewegt den Kopf', 'Schwanz folgt über Positionslisten', 'Futter lässt wachsen und zählt Punkte', 'Futter erscheint nur auf freien Zellen'],
                ['Spielfeld', 'Takt', 'SchlangeX', 'SchlangeY', 'ZufallX', 'ZufallY'], 'feature_sg_bewegung'),
            story('sg_richtung', 'Richtungswechsel',
                'Als Spieler möchte ich die Richtung sicher wechseln ohne Rückwärtseinbruch.',
                ['Max. ein Richtungswechsel pro Takt', 'Kein direkter 180°-Wechsel', 'Tastatur und Buttons'],
                ['Tastatur', 'TouchOben', 'TouchLinks', 'TouchUnten', 'TouchRechts'], 'feature_sg_richtung'),
            story('sg_ablauf', 'Spielablauf',
                'Als Spieler möchte ich starten, pausieren und nach Game Over neu starten.',
                ['Start-Overlay', 'Pause per P oder Button', 'Game Over bei Wand/Selbstkollision', 'Neustart per Leertaste'],
                ['Spielfeld', 'Takt', 'BtnStart', 'BtnPause', 'BtnNeu'], 'feature_sg_ablauf'),
        ]
    }
};

writeFileSync(OUT, JSON.stringify(project, null, 2));
console.log(`Geschrieben: ${OUT}`);
console.log(`Tasks: ${tasks.length}, Actions: ${actions.length}, Objekte: ${main.objects.length + blueprint.objects.length}`);

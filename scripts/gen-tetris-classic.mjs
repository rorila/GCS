/**
 * Generator fuer Tetris_Classic.json - Tetris komplett mit Bordmitteln.
 * Einzige neue Komponente: TGridBoard (generischer Raster-Baustein).
 * Ausfuehren: node scripts/gen-tetris-classic.mjs
 */
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../game-server/public/projects/Tetris_Classic.json');

// ─── Steine: Basisformen + Rotationen (CW) ───
const BASE = {
    I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    J: [[1,0,0],[1,1,1],[0,0,0]],
    L: [[0,0,1],[1,1,1],[0,0,0]],
    O: [[1,1],[1,1]],
    S: [[0,1,1],[1,1,0],[0,0,0]],
    T: [[0,1,0],[1,1,1],[0,0,0]],
    Z: [[1,1,0],[0,1,1],[0,0,0]],
};
const TYPES = Object.keys(BASE);
const rotCW = m => m[0].map((_, x) => m.map(row => row[x]).reverse());

const steineEntries = {};
const farbenEntries = {};
TYPES.forEach((t, i) => {
    let m = BASE[t];
    for (let r = 0; r < 4; r++) {
        steineEntries[`${t}_${r}`] = JSON.stringify(m);
        m = rotCW(m);
    }
    farbenEntries[t] = String(i + 1);
});

const palette = ['#101736', '#22d3ee', '#3b82f6', '#f97316', '#facc15', '#22c55e', '#a855f7', '#ef4444'];

// ─── Helfer ───
const act = (name, body) => ({ name, ...body });
const cm = (name, target, method, params = [], resultVariable) =>
    act(name, { type: 'call_method', target, method, params, ...(resultVariable ? { resultVariable } : {}) });
const calc = (name, formula, resultVariable) =>
    act(name, { type: 'calculate', formula, resultVariable });
const prop = (name, changes) => act(name, { type: 'property', changes });
// WICHTIG: 'property' statt 'set_variable' — PropertyActions konvertiert
// interpolierte Strings via autoConvert() (z.B. "${TestX}" -> Zahl).
// set_variable wuerde "2" als String speichern; "AktivX + Kick" wurde
// dann "2-1" (String-Concat) statt 1 -> Overlay x=null.
const setVar = (name, variableName, value) =>
    act(name, { type: 'property', changes: { [variableName]: value } });
const mapGet = (name, target, key, resultVariable) =>
    act(name, { type: 'map_get', target, key, resultVariable });
const listPush = (name, target, value) => act(name, { type: 'list_push', target, value });
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
    id: 'tc_' + name.toLowerCase()
});

// ─── Actions ───
const actions = [
    cm('Act_BoardLeeren', 'Spielfeld', 'clearBoard'),
    cm('Act_OverlayWeg', 'Spielfeld', 'clearOverlay'),
    cm('Act_GhostWeg', 'Spielfeld', 'clearGhost'),
    cm('Act_TextAus', 'Spielfeld', 'setOverlayText', ['']),
    cm('Act_TextPause', 'Spielfeld', 'setOverlayText', ['⏸ PAUSE\nP = weiter']),
    cm('Act_TextGameOver', 'Spielfeld', 'setOverlayText', ['GAME OVER\nPunkte: ${Punkte}\n↻ Leertaste = neu']),
    act('Act_BagLeeren', { type: 'list_clear', target: 'Bag' }),
    listPush('Act_BagFuellen', 'Bag', '${Typ}'),
    act('Act_BagMischen', { type: 'list_shuffle', target: 'Bag' }),
    act('Act_BagLaenge', { type: 'list_length', target: 'Bag', resultVariable: 'BagLen' }),
    act('Act_BagPop', { type: 'list_pop', target: 'Bag', resultVariable: 'NaechsterTyp' }),
    prop('Act_StartWerte', { Status: 'playing', Punkte: 0, Reihen: 0, Level: 1 }),
    prop('Act_TaktAn', { 'Takt.enabled': true }),
    prop('Act_TaktAus', { 'Takt.enabled': false }),
    prop('Act_TaktIntervall', { 'Takt.interval': '${NeuIntervall}', 'Takt.enabled': false }),
    prop('Act_StatusPause', { Status: 'paused' }),
    prop('Act_StatusWeiter', { Status: 'playing' }),
    prop('Act_StatusGameOver', { Status: 'gameover' }),
    prop('Act_SpawnPos', { AktivRot: 0, AktivX: 3, AktivY: 0 }),
    setVar('Act_TypSetzen', 'AktivTyp', '${NaechsterTyp}'),
    setVar('Act_MatrixSetzen', 'AktivMatrix', '${TestMatrix}'),
    setVar('Act_GeistStart', 'GeistY', '${AktivY}'),
    calc('Act_NeuY', 'AktivY + 1', 'NeuY'),
    calc('Act_NeuXLinks', 'AktivX - 1', 'NeuX'),
    calc('Act_NeuXRechts', 'AktivX + 1', 'NeuX'),
    calc('Act_YplusEins', 'GeistY + 1', 'PruefY'),
    calc('Act_GeistRunter', 'PruefY', 'GeistY'),
    calc('Act_NeueRot', '(AktivRot + 1) % 4', 'NeueRot'),
    calc('Act_TestX', 'AktivX + Kick', 'TestX'),
    calc('Act_ReihenPlus', 'Reihen + Geloescht', 'Reihen'),
    calc('Act_PunktePlus', 'Punkte + Basis * Level', 'Punkte'),
    calc('Act_PunkteSoft', 'Punkte + 1', 'Punkte'),
    calc('Act_PunkteHard', 'Punkte + 2', 'Punkte'),
    calc('Act_NeuLevel', '(Reihen - Reihen % 10) / 10 + 1', 'NeuLevel'),
    calc('Act_LevelSetzen', 'NeuLevel', 'Level'),
    calc('Act_IntervallNeu', '(700 - (Level - 1) * 70) < 80 ? 80 : 700 - (Level - 1) * 70', 'NeuIntervall'),
    calc('Act_Highscore', '(Punkte > Highscore) ? Punkte : Highscore', 'Highscore'),
    calc('Act_TestXLinks', 'AktivX', 'TestX'),
    cm('Act_PasstRunter', 'Spielfeld', 'canPlaceShape', ['${AktivMatrix}', '${AktivX}', '${NeuY}'], 'Passt'),
    cm('Act_PasstHier', 'Spielfeld', 'canPlaceShape', ['${AktivMatrix}', '${AktivX}', '${AktivY}'], 'Passt'),
    cm('Act_PasstSeite', 'Spielfeld', 'canPlaceShape', ['${AktivMatrix}', '${NeuX}', '${AktivY}'], 'Passt'),
    cm('Act_PasstDreh', 'Spielfeld', 'canPlaceShape', ['${TestMatrix}', '${TestX}', '${AktivY}'], 'Passt'),
    cm('Act_PasstGeist', 'Spielfeld', 'canPlaceShape', ['${AktivMatrix}', '${AktivX}', '${PruefY}'], 'GeistFrei'),
    cm('Act_SteinSetzen', 'Spielfeld', 'placeShape', ['${AktivMatrix}', '${AktivX}', '${AktivY}', '${AktivFarbe}']),
    cm('Act_VolleReihen', 'Spielfeld', 'clearFullRows', [], 'Geloescht'),
    cm('Act_OverlayZeigen', 'Spielfeld', 'setOverlay', ['${AktivMatrix}', '${AktivX}', '${AktivY}', '${AktivFarbe}']),
    cm('Act_GhostZeigen', 'Spielfeld', 'setGhost', ['${AktivMatrix}', '${AktivX}', '${GeistY}', '${AktivFarbe}']),
    mapGet('Act_FarbeLesen', 'Farben', '${AktivTyp}', 'AktivFarbe'),
    mapGet('Act_MatrixLesen', 'Steine', '${AktivTyp}_${AktivRot}', 'AktivMatrix'),
    mapGet('Act_TestLesen', 'Steine', '${AktivTyp}_${NeueRot}', 'TestMatrix'),
    // Vorschau: naechster Stein als echte Blockform auf dem Mini-Board
    mapGet('Act_NaechsteMatrix', 'Steine', '${NaechsterTyp}_0', 'NaechsteMatrix'),
    mapGet('Act_NaechsteFarbe', 'Farben', '${NaechsterTyp}', 'NaechsteFarbe'),
    cm('Act_VorschauLeeren', 'Vorschau', 'clearBoard'),
    cm('Act_VorschauZeigen', 'Vorschau', 'placeShape', ['${NaechsteMatrix}', 0, 0, '${NaechsteFarbe}']),
    mapGet('Act_BasisLesen', 'PunkteTabelle', '${Geloescht}', 'Basis'),
    setVar('Act_FallFlag', 'FallWeiter', '1'),
    setVar('Act_FallStopp', 'FallWeiter', '0'),
    setVar('Act_GedrehtNull', 'Gedreht', '0'),
    setVar('Act_GedrehtEins', 'Gedreht', '1'),
    setVar('Act_RotSetzen', 'AktivRot', '${NeueRot}'),
    setVar('Act_XSetzen', 'AktivX', '${TestX}'),
    setVar('Act_XNeu', 'AktivX', '${NeuX}'),
    setVar('Act_YNeu', 'AktivY', '${NeuY}'),
    prop('Act_DrehUehlernehmen', { AktivRot: '${NeueRot}', AktivX: '${TestX}', Gedreht: 1 }),
];

// ─── Tasks ───
const tasks = [
    task('SpielStarten', 'Neue Runde: Board leeren, Bag mischen, ersten Stein spawnen, Takt an.', [
        actRef('Act_BoardLeeren'), actRef('Act_OverlayWeg'), actRef('Act_GhostWeg'), actRef('Act_TextAus'),
        actRef('Act_StartWerte'),
        actRef('Act_BagLeeren'),
        { type: 'foreach', name: 'ForEach: Typ in SteinTypen', sourceArray: 'SteinTypen', itemVar: 'Typ', body: [actRef('Act_BagFuellen')] },
        actRef('Act_BagMischen'),
        taskRef('NaechsterZiehen'),
        taskRef('SteinSpawnen'),
        actRef('Act_TaktAn'),
    ]),
    task('TaktSchritt', 'Gravity-Takt: Stein eine Zeile senken oder setzen.', [
        cond('Status', '==', 'playing', [taskRef('SteinRunter')]),
    ]),
    task('SteinRunter', 'Senkt den Stein oder setzt ihn bei Kollision.', [
        actRef('Act_NeuY'), actRef('Act_PasstRunter'),
        cond('Passt', '==', true,
            [actRef('Act_YNeu'), taskRef('OverlayZeigen')],
            [taskRef('SteinSetzen')]),
    ]),
    task('SteinSenken', 'Soft Drop: eine Zeile senken (+1 Punkt) oder setzen.', [
        cond('Status', '==', 'playing', [
            actRef('Act_NeuY'), actRef('Act_PasstRunter'),
            cond('Passt', '==', true,
                [actRef('Act_YNeu'), actRef('Act_PunkteSoft'), taskRef('OverlayZeigen')],
                [taskRef('SteinSetzen')]),
        ]),
    ]),
    task('SteinFallen', 'Hard Drop: bis zur Landeposition fallen (+2 Punkte je Zeile), dann setzen.', [
        cond('Status', '==', 'playing', [
            actRef('Act_FallFlag'),
            {
                type: 'while', name: 'While: FallWeiter == 1',
                condition: { variable: 'FallWeiter', operator: '==', value: '1' },
                body: [
                    actRef('Act_NeuY'), actRef('Act_PasstRunter'),
                    cond('Passt', '==', true,
                        [actRef('Act_YNeu'), actRef('Act_PunkteHard')],
                        [actRef('Act_FallStopp')]),
                ],
            },
            taskRef('SteinSetzen'),
        ]),
    ]),
    task('SteinSetzen', 'Stein ins Board schreiben, volle Reihen loeschen, Wertung und Level.', [
        actRef('Act_SteinSetzen'), actRef('Act_OverlayWeg'), actRef('Act_GhostWeg'),
        actRef('Act_VolleReihen'),
        cond('Geloescht', '>', 0, [
            actRef('Act_ReihenPlus'), actRef('Act_BasisLesen'), actRef('Act_PunktePlus'),
            actRef('Act_NeuLevel'),
            cond('NeuLevel', '!=', '${Level}', [
                actRef('Act_LevelSetzen'), actRef('Act_IntervallNeu'),
                actRef('Act_TaktIntervall'), actRef('Act_TaktAn'),
            ]),
        ]),
        taskRef('SteinSpawnen'),
    ]),
    task('SteinSpawnen', 'Naechsten Stein aus dem Bag holen; bei Kollision Game Over.', [
        actRef('Act_TypSetzen'), actRef('Act_FarbeLesen'), actRef('Act_SpawnPos'),
        taskRef('NaechsterZiehen'),
        actRef('Act_MatrixLesen'),
        actRef('Act_PasstHier'),
        cond('Passt', '==', false, [taskRef('SpielEnde')], [taskRef('OverlayZeigen')]),
    ]),
    task('NaechsterZiehen', 'Bag nachfuellen (7-Bag) falls leer und naechsten Typ ziehen.', [
        actRef('Act_BagLaenge'),
        cond('BagLen', '==', 0, [
            { type: 'foreach', name: 'ForEach: Typ in SteinTypen', sourceArray: 'SteinTypen', itemVar: 'Typ', body: [actRef('Act_BagFuellen')] },
            actRef('Act_BagMischen'),
        ]),
        actRef('Act_BagPop'),
        actRef('Act_NaechsteMatrix'), actRef('Act_NaechsteFarbe'),
        actRef('Act_VorschauLeeren'), actRef('Act_VorschauZeigen'),
    ]),
    task('OverlayZeigen', 'Aktiven Stein und Ghost-Landeposition darstellen.', [
        actRef('Act_OverlayZeigen'),
        actRef('Act_GeistStart'), actRef('Act_YplusEins'), actRef('Act_PasstGeist'),
        {
            type: 'while', name: 'While: GeistFrei == true',
            condition: { variable: 'GeistFrei', operator: '==', value: true },
            body: [actRef('Act_GeistRunter'), actRef('Act_YplusEins'), actRef('Act_PasstGeist')],
        },
        actRef('Act_GhostZeigen'),
    ]),
    task('SteuerungLinks', 'Stein eine Spalte nach links.', [
        cond('Status', '==', 'playing', [
            actRef('Act_NeuXLinks'), actRef('Act_PasstSeite'),
            cond('Passt', '==', true, [actRef('Act_XNeu'), taskRef('OverlayZeigen')]),
        ]),
    ]),
    task('SteuerungRechts', 'Stein eine Spalte nach rechts.', [
        cond('Status', '==', 'playing', [
            actRef('Act_NeuXRechts'), actRef('Act_PasstSeite'),
            cond('Passt', '==', true, [actRef('Act_XNeu'), taskRef('OverlayZeigen')]),
        ]),
    ]),
    task('SteinDrehen', 'Stein drehen (CW) mit einfachen Wall-Kicks [0,-1,1,-2,2].', [
        cond('Status', '==', 'playing', [
            actRef('Act_NeueRot'), actRef('Act_TestLesen'), actRef('Act_GedrehtNull'),
            {
                type: 'foreach', name: 'ForEach: Kick in Kicks', sourceArray: 'Kicks', itemVar: 'Kick',
                body: [
                    cond('Gedreht', '==', '0', [
                        actRef('Act_TestX'), actRef('Act_PasstDreh'),
                        cond('Passt', '==', true, [actRef('Act_DrehUehlernehmen'), actRef('Act_MatrixSetzen')]),
                    ]),
                ],
            },
            cond('Gedreht', '==', '1', [taskRef('OverlayZeigen')]),
        ]),
    ]),
    task('PauseWechsel', 'Pause umschalten (nur waehrend oder nach Pause).', [
        cond('Status', '==', 'playing',
            [actRef('Act_StatusPause'), actRef('Act_TaktAus'), actRef('Act_TextPause')],
            [cond('Status', '==', 'paused',
                [actRef('Act_StatusWeiter'), actRef('Act_TextAus'), actRef('Act_TaktAn')])]),
    ]),
    task('StartOderDrop', 'Leertaste: im Spiel Hard Drop, in Pause weiter, sonst neue Runde.', [
        cond('Status', '==', 'playing', [taskRef('SteinFallen')], [
            cond('Status', '==', 'paused', [taskRef('PauseWechsel')], [taskRef('SpielStarten')]),
        ]),
    ]),
    task('SpielEnde', 'Game Over: Takt aus, Highscore sichern, Hinweis zeigen.', [
        actRef('Act_StatusGameOver'), actRef('Act_TaktAus'),
        actRef('Act_OverlayWeg'), actRef('Act_GhostWeg'),
        actRef('Act_Highscore'), actRef('Act_TextGameOver'),
    ]),
];

// ─── Objekte ───
// WICHTIG: id ist Pflicht! RuntimeStageManager dedupliziert Objekte per
// o.id — ohne id kollabieren alle Service-Objekte zu einem (undefined).
const serviceObj = (className, name, extra = {}) => ({
    className, name, isVariable: true, isService: true, isHiddenInRun: true,
    x: 1, y: 1, width: 4, height: 2, style: {}, id: `stage_blueprint_${name}`, ...extra
});

const grid = { cols: 64, rows: 40, cellSize: 18, visible: false, snapToGrid: true, backgroundColor: '#070b16' };

const blueprint = {
    id: 'stage_blueprint', name: 'Globale Dienste', type: 'blueprint',
    objects: [
        {
            className: 'TInputController', name: 'Tastatur', enabled: true,
            isHiddenInRun: true, isService: true, x: 1, y: 1,
            events: {
                onKeyDown_ArrowLeft: 'SteuerungLinks', onKeyDown_KeyA: 'SteuerungLinks',
                onKeyDown_ArrowRight: 'SteuerungRechts', onKeyDown_KeyD: 'SteuerungRechts',
                onKeyDown_ArrowUp: 'SteinDrehen', onKeyDown_KeyW: 'SteinDrehen',
                onKeyDown_ArrowDown: 'SteinSenken', onKeyDown_KeyS: 'SteinSenken',
                onKeyDown_Space: 'StartOderDrop', onKeyDown_Enter: 'StartOderDrop',
                onKeyDown_KeyP: 'PauseWechsel',
            },
            id: 'stage_blueprint_Tastatur',
        },
        serviceObj('TListVariable', 'SteinTypen', { items: TYPES }),
        serviceObj('TListVariable', 'Bag', { items: [] }),
        serviceObj('TListVariable', 'Kicks', { items: [0, -1, 1, -2, 2] }),
        serviceObj('TStringMap', 'Steine', { entries: steineEntries }),
        serviceObj('TStringMap', 'Farben', { entries: farbenEntries }),
        serviceObj('TStringMap', 'PunkteTabelle', { entries: { '1': '100', '2': '300', '3': '500', '4': '800' } }),
    ],
    tasks: [], actions: [],
    variables: [
        { name: 'Status', type: 'string', isVariable: true, className: 'TStringVariable', initialValue: 'ready', defaultValue: 'ready', value: 'ready', scope: 'global', id: 'tc_var_Status' },
        { name: 'Punkte', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 0, defaultValue: 0, value: 0, scope: 'global', id: 'tc_var_Punkte' },
        { name: 'Reihen', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 0, defaultValue: 0, value: 0, scope: 'global', id: 'tc_var_Reihen' },
        { name: 'Level', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 1, defaultValue: 1, value: 1, scope: 'global', id: 'tc_var_Level' },
        { name: 'Highscore', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 0, defaultValue: 0, value: 0, scope: 'global', id: 'tc_var_Highscore' },
        { name: 'AktivTyp', type: 'string', isVariable: true, className: 'TStringVariable', initialValue: '', defaultValue: '', value: '', scope: 'global', id: 'tc_var_AktivTyp' },
        { name: 'AktivRot', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 0, defaultValue: 0, value: 0, scope: 'global', id: 'tc_var_AktivRot' },
        { name: 'AktivX', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 0, defaultValue: 0, value: 0, scope: 'global', id: 'tc_var_AktivX' },
        { name: 'AktivY', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 0, defaultValue: 0, value: 0, scope: 'global', id: 'tc_var_AktivY' },
        { name: 'AktivFarbe', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 1, defaultValue: 1, value: 1, scope: 'global', id: 'tc_var_AktivFarbe' },
        { name: 'AktivMatrix', type: 'string', isVariable: true, className: 'TStringVariable', initialValue: '', defaultValue: '', value: '', scope: 'global', id: 'tc_var_AktivMatrix' },
        { name: 'TestMatrix', type: 'string', isVariable: true, className: 'TStringVariable', initialValue: '', defaultValue: '', value: '', scope: 'global', id: 'tc_var_TestMatrix' },
        { name: 'NaechsterTyp', type: 'string', isVariable: true, className: 'TStringVariable', initialValue: '', defaultValue: '', value: '', scope: 'global', id: 'tc_var_NaechsterTyp' },
        { name: 'NaechsteMatrix', type: 'string', isVariable: true, className: 'TStringVariable', initialValue: '', defaultValue: '', value: '', scope: 'global', id: 'tc_var_NaechsteMatrix' },
        { name: 'NaechsteFarbe', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 1, defaultValue: 1, value: 1, scope: 'global', id: 'tc_var_NaechsteFarbe' },
        { name: 'NeuX', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 0, defaultValue: 0, value: 0, scope: 'global', id: 'tc_var_NeuX' },
        { name: 'NeuY', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 0, defaultValue: 0, value: 0, scope: 'global', id: 'tc_var_NeuY' },
        { name: 'NeueRot', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 0, defaultValue: 0, value: 0, scope: 'global', id: 'tc_var_NeueRot' },
        { name: 'NeuLevel', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 1, defaultValue: 1, value: 1, scope: 'global', id: 'tc_var_NeuLevel' },
        { name: 'NeuIntervall', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 700, defaultValue: 700, value: 700, scope: 'global', id: 'tc_var_NeuIntervall' },
        { name: 'TestX', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 0, defaultValue: 0, value: 0, scope: 'global', id: 'tc_var_TestX' },
        { name: 'GeistY', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 0, defaultValue: 0, value: 0, scope: 'global', id: 'tc_var_GeistY' },
        { name: 'PruefY', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 0, defaultValue: 0, value: 0, scope: 'global', id: 'tc_var_PruefY' },
        { name: 'Passt', type: 'boolean', isVariable: true, className: 'TBooleanVariable', initialValue: false, defaultValue: false, value: false, scope: 'global', id: 'tc_var_Passt' },
        { name: 'GeistFrei', type: 'boolean', isVariable: true, className: 'TBooleanVariable', initialValue: false, defaultValue: false, value: false, scope: 'global', id: 'tc_var_GeistFrei' },
        { name: 'Geloescht', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 0, defaultValue: 0, value: 0, scope: 'global', id: 'tc_var_Geloescht' },
        { name: 'Basis', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 0, defaultValue: 0, value: 0, scope: 'global', id: 'tc_var_Basis' },
        { name: 'BagLen', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 0, defaultValue: 0, value: 0, scope: 'global', id: 'tc_var_BagLen' },
        { name: 'Kick', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 0, defaultValue: 0, value: 0, scope: 'global', id: 'tc_var_Kick' },
        { name: 'Typ', type: 'string', isVariable: true, className: 'TStringVariable', initialValue: '', defaultValue: '', value: '', scope: 'global', id: 'tc_var_Typ' },
        { name: 'Gedreht', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 0, defaultValue: 0, value: 0, scope: 'global', id: 'tc_var_Gedreht' },
        { name: 'FallWeiter', type: 'integer', isVariable: true, className: 'TIntegerVariable', initialValue: 0, defaultValue: 0, value: 0, scope: 'global', id: 'tc_var_FallWeiter' },
    ],
    flowCharts: [], events: {}, grid,
};

const btnStyle = (bg, color, border) => ({
    backgroundColor: bg, color, borderColor: border, borderWidth: 1, borderRadius: 7, fontSize: 13
});
const btn = (name, text, x, y, w, h, task, style) => ({
    className: 'TButton', name, x, y, width: w, height: h, text,
    style, events: { onClick: task }, id: `stage_main_${name}`
});
const lbl = (name, text, x, y, w, h, style) => ({
    className: 'TLabel', name, x, y, width: w, height: h, text, style, id: `stage_main_${name}`
});

const main = {
    id: 'stage_main', name: 'Tetris Classic', type: 'main',
    objects: [
        lbl('Titel', '🧱 TETRIS · CLASSIC', 2, 1, 16, 2, {
            color: '#8ab4ff', fontSize: 20, fontWeight: 'bold', backgroundColor: 'transparent', borderWidth: 0
        }),
        {
            className: 'TGridBoard', name: 'Spielfeld',
            x: 22, y: 2, width: 20, height: 36,
            cols: 10, rows: 20, palette, gridLines: true,
            overlayText: 'TETRIS\nLeertaste = Start',
            style: { backgroundColor: '#0b1020', borderColor: '#1f2a4a', borderWidth: 2, borderRadius: 8 },
            id: 'stage_main_Spielfeld'
        },
        lbl('LblPunkte', 'PUNKTE  ${Punkte}', 46, 5, 14, 2, { color: '#e2e8f0', fontSize: 16, fontWeight: '600', backgroundColor: 'transparent', borderWidth: 0 }),
        lbl('LblReihen', 'REIHEN  ${Reihen}', 46, 8, 14, 2, { color: '#e2e8f0', fontSize: 16, fontWeight: '600', backgroundColor: 'transparent', borderWidth: 0 }),
        lbl('LblLevel', 'LEVEL  ${Level}', 46, 11, 14, 2, { color: '#e2e8f0', fontSize: 16, fontWeight: '600', backgroundColor: 'transparent', borderWidth: 0 }),
        lbl('LblBest', 'BEST  ${Highscore}', 46, 14, 14, 2, { color: '#94a3b8', fontSize: 15, backgroundColor: 'transparent', borderWidth: 0 }),
        lbl('LblNext', 'NÄCHSTES', 46, 17, 14, 2, { color: '#facc15', fontSize: 15, fontWeight: '600', backgroundColor: 'transparent', borderWidth: 0 }),
        {
            className: 'TGridBoard', name: 'Vorschau',
            x: 47, y: 19, width: 8, height: 8,
            cols: 4, rows: 4, palette, gridLines: true,
            style: { backgroundColor: '#0b1120', borderColor: '#1e293b', borderWidth: 1 },
            id: 'stage_main_Vorschau'
        },
        lbl('Hilfe', '← →  bewegen\n↑     drehen\n↓     senken\nLEER  fallen\nP     Pause', 46, 22, 14, 9, {
            color: '#64748b', fontSize: 12, backgroundColor: 'transparent', borderWidth: 0
        }),
        btn('BtnStart', '▶ START', 22, 38, 8, 2, 'StartOderDrop', btnStyle('#1e3a5f', '#dbeafe', '#3b82f6')),
        btn('BtnPause', '⏸ PAUSE', 31, 38, 8, 2, 'PauseWechsel', btnStyle('#3a3418', '#fde68a', '#a5853b')),
        btn('BtnNeu', '↻ NEU', 40, 38, 8, 2, 'SpielStarten', btnStyle('#20453f', '#dcfff0', '#416e60')),
        btn('TouchDrehen', '↻', 4, 25, 5, 3, 'SteinDrehen', btnStyle('#1a2440', '#c7d2fe', '#334166')),
        btn('TouchFallen', '⤓', 11, 25, 5, 3, 'SteinFallen', btnStyle('#1a2440', '#c7d2fe', '#334166')),
        btn('TouchLinks', '◀', 4, 30, 5, 3, 'SteuerungLinks', btnStyle('#1a2440', '#c7d2fe', '#334166')),
        btn('TouchRechts', '▶', 11, 30, 5, 3, 'SteuerungRechts', btnStyle('#1a2440', '#c7d2fe', '#334166')),
        {
            className: 'TTimer', name: 'Takt', x: 1, y: 3, width: 4, height: 2,
            interval: 700, enabled: false, maxInterval: 0, currentInterval: 0,
            isService: true, isHiddenInRun: true, style: {},
            events: { onTimer: 'TaktSchritt' }, id: 'stage_main_Takt'
        },
    ],
    tasks, actions,
    variables: [], flowCharts: [], events: {}, grid,
    features: [
        {
            id: 'feature_tc_raster', name: 'Raster & Board',
            description: 'TGridBoard als generischer Raster-Baustein: Zellen-Matrix, Palette, Overlay und Ghost.',
            tags: ['Tetris', 'GridBoard'], userStoryIds: ['tc_raster'],
            blueprintTaskNames: []
        },
        {
            id: 'feature_tc_steine', name: 'Steine & 7-Bag',
            description: 'Rotationsdaten in TStringMap, 7-Bag ueber TListVariable (shuffle/pop).',
            tags: ['Tetris', 'Daten'], userStoryIds: ['tc_steine'],
            blueprintTaskNames: ['NaechsterZiehen', 'SteinSpawnen', 'SteinDrehen']
        },
        {
            id: 'feature_tc_steuerung', name: 'Steuerung',
            description: 'Tastatur und Bildschirmtasten steuern den Stein ueber canPlaceShape-Pruefungen.',
            tags: ['Tetris', 'Input'], userStoryIds: ['tc_steuerung'],
            blueprintTaskNames: ['SteuerungLinks', 'SteuerungRechts', 'SteinSenken', 'SteinFallen', 'StartOderDrop']
        },
        {
            id: 'feature_tc_wertung', name: 'Reihen & Wertung',
            description: 'clearFullRows, Punkte-Tabelle (100/300/500/800 × Level) und Tempo-Steigerung.',
            tags: ['Tetris', 'Score'], userStoryIds: ['tc_wertung'],
            blueprintTaskNames: ['SteinSetzen']
        },
        {
            id: 'feature_tc_ablauf', name: 'Spielablauf',
            description: 'Start-Overlay, Pause, Game Over und Neustart.',
            tags: ['Tetris', 'Ablauf'], userStoryIds: ['tc_ablauf'],
            blueprintTaskNames: ['SpielStarten', 'PauseWechsel', 'SpielEnde', 'TaktSchritt', 'OverlayZeigen']
        }
    ]
};

const story = (id, title, description, acceptanceCriteria, relatedComponents, featureId) => ({
    id, title, description, priority: 'high', status: 'done', acceptanceCriteria,
    relatedStages: ['stage_main', 'stage_blueprint'],
    createdAt: '2026-09-13T00:00:00.000Z', projectId: 'tetris-classic', updatedAt: '2026-09-13T00:00:00.000Z',
    relatedComponents, relatedVariables: [], interactions: [], featureId
});

const project = {
    meta: {
        id: 'tetris-classic', name: 'Tetris Classic', version: '1.0.0',
        author: 'Rolf Rieckmann / Devin',
        description: 'Tetris komplett mit GCS-Bordmitteln: TGridBoard + TListVariable (7-Bag) + TStringMap (Rotationsdaten) + Flow-Tasks.'
    },
    stage: { grid },
    stages: [blueprint, main],
    objects: [], actions: [], tasks: [], variables: [],
    activeStageId: 'stage_main',
    userStories: {
        userStories: [
            story('tc_raster', 'Raster & Board',
                'Als Spieler möchte ich das Spielfeld als klares Raster sehen.',
                ['10×20 Zellen als Matrix', 'Palette bildet Werte auf Farben ab', 'Overlay zeigt aktiven Stein', 'Ghost zeigt Landeposition'],
                ['Spielfeld'], 'feature_tc_raster'),
            story('tc_steine', 'Steine & 7-Bag',
                'Als Spieler möchte ich fairen Stein-Nachschub und saubere Rotation.',
                ['7-Bag: jede Serie enthält alle 7 Typen', '4 Rotationsstufen je Stein als Daten', 'Wall-Kicks 0,-1,1,-2,2'],
                ['Steine', 'Farben', 'Bag', 'SteinTypen', 'Kicks'], 'feature_tc_steine'),
            story('tc_steuerung', 'Steuerung',
                'Als Spieler möchte ich per Tastatur und Buttons steuern.',
                ['Pfeile/WASD bewegen, drehen, senken', 'Leertaste = Hard Drop / Start', 'P = Pause', 'Touch-Buttons rufen dieselben Tasks'],
                ['Tastatur', 'BtnStart', 'BtnPause', 'BtnNeu', 'TouchLinks', 'TouchRechts', 'TouchDrehen', 'TouchFallen'], 'feature_tc_steuerung'),
            story('tc_wertung', 'Reihen & Wertung',
                'Als Spieler möchte ich volle Reihen auflösen und Punkte sammeln.',
                ['clearFullRows liefert 0–4 Reihen', 'Punkte 100/300/500/800 × Level', 'Alle 10 Reihen Level-Up + schnellerer Takt'],
                ['Spielfeld', 'PunkteTabelle', 'Takt'], 'feature_tc_wertung'),
            story('tc_ablauf', 'Spielablauf',
                'Als Spieler möchte ich starten, pausieren und neu beginnen.',
                ['Start-Overlay mit Hinweis', 'Pause-Overlay', 'Game-Over mit Punkten und Highscore', 'Neustart per Leertaste'],
                ['Spielfeld', 'Takt'], 'feature_tc_ablauf'),
        ]
    }
};

writeFileSync(OUT, JSON.stringify(project, null, 2));
console.log(`Geschrieben: ${OUT}`);
console.log(`Tasks: ${tasks.length}, Actions: ${actions.length}, Objekte: ${main.objects.length + blueprint.objects.length}`);

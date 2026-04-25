/**
 * Memory-Spiel (v2) — deklarativ mit TForEach + Collection-Actions
 *
 * Nutzt die drei neuen Features (A/B/C):
 *   • Event-Context (Magic-Variable ${self.*})
 *   • Collection-Actions (list_shuffle, list_get, list_push, ...)
 *   • TForEach (deklarativer Repeater mit Diff-Reconciliation)
 *
 * Aufruf:
 *   npx tsx scripts/agent-run.ts scripts/MemoryGameBuilder.ts my_memory_game.json
 */
import { ProjectBuilder } from './agent-run';

export default function build(agent: ProjectBuilder): void {

    // ═══════════════════════════════════════
    // SCHRITT 1: META
    // ═══════════════════════════════════════
    agent.setMeta(
        'memory_game_v2',
        'Memory (TForEach)',
        'Klassisches Memory-Spiel — deklarativ gebaut mit TForEach, Collection-Actions und Magic-Variablen.'
    );

    // ═══════════════════════════════════════
    // SCHRITT 2: STAGES
    // ═══════════════════════════════════════
    // Blueprint existiert bereits (ProjectBuilder-Default); main neu anlegen.
    agent.createStage('stage_main', 'Memory', 'standard');

    // ═══════════════════════════════════════
    // SCHRITT 3: BLUEPRINT-OBJEKTE
    // ═══════════════════════════════════════
    agent.addObject('stage_blueprint', {
        className: 'TGameLoop', name: 'GameLoop',
        x: 2, y: 2, width: 3, height: 1,
        isService: true, isHiddenInRun: true, targetFPS: 60,
        style: { backgroundColor: '#2196f3', borderColor: '#1565c0', borderWidth: 2, color: '#fff' }
    });

    agent.addObject('stage_blueprint', {
        className: 'TGameState', name: 'GameState',
        x: 6, y: 2, width: 4, height: 1,
        isVariable: true, isService: true, isHiddenInRun: true,
        state: 'idle',
        style: { backgroundColor: '#4caf50', color: '#fff' }
    });

    agent.addObject('stage_blueprint', {
        className: 'TDialogRoot', name: 'WinDialog',
        x: 16, y: 12, width: 32, height: 10,
        visible: false, modal: true,
        title: '🏆 Gewonnen!',
        text: 'Geschafft mit ${attempts} Versuchen!',
        style: { backgroundColor: '#1a1a2e', color: '#f7c948', borderColor: '#f7c948', borderWidth: 2, borderRadius: 12 }
    });

    // ═══════════════════════════════════════
    // SCHRITT 4: CARD-DATEN (Build-Time)
    // ═══════════════════════════════════════
    // 8 Werte × 2 = 16 Karten. Shuffle erfolgt zur Runtime via list_shuffle.
    const faces = ['🍎', '🍌', '🍇', '🍉', '🍓', '🍒', '🥝', '🍍'];
    const cardData: any[] = [];
    for (let i = 0; i < faces.length; i++) {
        cardData.push({ idx: i * 2,     value: faces[i], displayText: '?', face: false, matched: false });
        cardData.push({ idx: i * 2 + 1, value: faces[i], displayText: '?', face: false, matched: false });
    }

    // ═══════════════════════════════════════
    // SCHRITT 5: VARIABLEN (Stage-Objekte)
    // ═══════════════════════════════════════

    // --- Karten-Liste ---
    agent.addObject('stage_main', {
        className: 'TListVariable', name: 'cards',
        x: 2, y: 2, width: 4, height: 1,
        isVariable: true, isHiddenInRun: true,
        value: cardData, defaultValue: cardData,
        style: { backgroundColor: '#1e1e2e', color: '#fff' }
    });

    // --- Spiel-Zustand ---
    const intVar = (name: string, init: number, x: number) => agent.addObject('stage_main', {
        className: 'TIntegerVariable', name,
        x, y: 2, width: 3, height: 1,
        isVariable: true, isHiddenInRun: true,
        value: init, defaultValue: init, type: 'integer',
        style: { backgroundColor: '#d1c4e9', borderColor: '#9575cd', borderWidth: 1 }
    });

    intVar('firstIdx',   -1,  7);  // Index der 1. aufgedeckten Karte (-1 = keine)
    intVar('secondIdx',  -1, 11);  // Index der 2. aufgedeckten Karte (-1 = keine)
    intVar('score',       0, 15);  // Gefundene Paare
    intVar('attempts',    0, 19);  // Versuchs-Zähler
    intVar('clickedIdx', -1, 23);  // Zwischenspeicher für geklickten Index

    // Hilfsvariablen (werden in Tasks überschrieben)
    agent.addObject('stage_main', {
        className: 'TStringVariable', name: 'clickedIdxStr',
        x: 27, y: 2, width: 3, height: 1,
        isVariable: true, isHiddenInRun: true,
        value: '', defaultValue: '', type: 'string'
    });
    agent.addObject('stage_main', {
        className: 'TObjectVariable', name: 'tempCard',
        x: 31, y: 2, width: 3, height: 1,
        isVariable: true, isHiddenInRun: true,
        value: null, defaultValue: null
    });
    agent.addObject('stage_main', {
        className: 'TObjectVariable', name: 'firstCard',
        x: 35, y: 2, width: 3, height: 1,
        isVariable: true, isHiddenInRun: true,
        value: null, defaultValue: null
    });
    agent.addObject('stage_main', {
        className: 'TBooleanVariable', name: 'canFlip',
        x: 39, y: 2, width: 3, height: 1,
        isVariable: true, isHiddenInRun: true,
        value: false, defaultValue: false, type: 'boolean'
    });
    agent.addObject('stage_main', {
        className: 'TBooleanVariable', name: 'isFirst',
        x: 43, y: 2, width: 3, height: 1,
        isVariable: true, isHiddenInRun: true,
        value: false, defaultValue: false, type: 'boolean'
    });
    agent.addObject('stage_main', {
        className: 'TBooleanVariable', name: 'isMatch',
        x: 47, y: 2, width: 3, height: 1,
        isVariable: true, isHiddenInRun: true,
        value: false, defaultValue: false, type: 'boolean'
    });

    // ═══════════════════════════════════════
    // SCHRITT 6: UI
    // ═══════════════════════════════════════

    agent.createLabel('stage_main', 'Title', 22, 4, '🎴 Memory', {
        width: 24, height: 3, fontSize: 36, fontWeight: 'bold',
        color: '#f7c948', textAlign: 'center'
    });

    agent.createLabel('stage_main', 'StatsLabel', 22, 8,
        'Paare: ${score} / 8  |  Versuche: ${attempts}', {
        width: 24, height: 2, fontSize: 18, fontWeight: 'normal',
        color: '#b9b9d4', textAlign: 'center'
    });

    // --- TForEach: das Herzstück ---
    agent.addObject('stage_main', {
        className: 'TForEach', name: 'MemoryGrid',
        x: 22, y: 11, width: 24, height: 24,
        source: 'cards',
        layout: 'grid',
        cols: 4, rows: 4,
        gap: 1,
        itemWidth: 5, itemHeight: 5,
        namePattern: 'Card_{index}',
        template: {
            className: 'TButton',
            text: '${item.displayText}',
            _idx: '${index}',
            style: {
                fontSize: 28, fontWeight: 'bold',
                backgroundColor: '#3a3a5c',
                borderColor: '#5a5a8c',
                borderWidth: 2,
                borderRadius: 8,
                color: '#ffffff',
                textAlign: 'center'
            },
            events: { onClick: 'OnCardClick' }
        }
    });

    // ═══════════════════════════════════════
    // SCHRITT 7: TASKS
    // ═══════════════════════════════════════

    // ────────────────────────────────────────
    // InitGame — shuffle + reset state
    // ────────────────────────────────────────
    agent.createTask('stage_main', 'InitGame', 'Karten mischen, Spiel-Zustand zurücksetzen');
    agent.addAction('InitGame', 'list_shuffle', 'ShuffleCards', { target: 'cards' });
    agent.addAction('InitGame', 'calculate', 'ResetFirstIdxInit',  { formula: '-1', resultVariable: 'firstIdx' });
    agent.addAction('InitGame', 'calculate', 'ResetSecondIdxInit', { formula: '-1', resultVariable: 'secondIdx' });
    agent.addAction('InitGame', 'calculate', 'ResetScoreInit',     { formula: '0',  resultVariable: 'score' });
    agent.addAction('InitGame', 'calculate', 'ResetAttemptsInit',  { formula: '0',  resultVariable: 'attempts' });

    // ────────────────────────────────────────
    // ResetFlippedCards — klappt firstIdx + secondIdx zurück
    // ────────────────────────────────────────
    agent.createTask('stage_main', 'ResetFlippedCards', 'Vorheriges Nicht-Paar zurückklappen');
    agent.addAction('ResetFlippedCards', 'list_get', 'GetFirstFlip', {
        target: 'cards', index: '${firstIdx}', resultVariable: 'tempCard'
    });
    agent.addAction('ResetFlippedCards', 'property', 'HideFirstFlip', {
        target: 'tempCard', changes: { face: false, displayText: '?' }
    });
    agent.addAction('ResetFlippedCards', 'list_get', 'GetSecondFlip', {
        target: 'cards', index: '${secondIdx}', resultVariable: 'tempCard'
    });
    agent.addAction('ResetFlippedCards', 'property', 'HideSecondFlip', {
        target: 'tempCard', changes: { face: false, displayText: '?' }
    });
    agent.addAction('ResetFlippedCards', 'calculate', 'ResetFirstIdxFlip',  { formula: '-1', resultVariable: 'firstIdx' });
    agent.addAction('ResetFlippedCards', 'calculate', 'ResetSecondIdxFlip', { formula: '-1', resultVariable: 'secondIdx' });

    // ────────────────────────────────────────
    // HandleMatch — bei Paar: beide Karten markieren, Score++
    // ────────────────────────────────────────
    agent.createTask('stage_main', 'HandleMatch', 'Paar gefunden: markieren, Score erhöhen');
    agent.addAction('HandleMatch', 'property', 'MatchFirst',  { target: 'firstCard', changes: { matched: true } });
    agent.addAction('HandleMatch', 'property', 'MatchSecond', { target: 'tempCard',  changes: { matched: true } });
    agent.addAction('HandleMatch', 'calculate', 'IncScore',   { formula: 'score + 1', resultVariable: 'score' });
    agent.addAction('HandleMatch', 'calculate', 'ResetFirstIdxMatch',  { formula: '-1', resultVariable: 'firstIdx' });
    agent.addAction('HandleMatch', 'calculate', 'ResetSecondIdxMatch', { formula: '-1', resultVariable: 'secondIdx' });

    // ────────────────────────────────────────
    // ProcessSecondCard — zweite Karte: Match prüfen
    // ────────────────────────────────────────
    agent.createTask('stage_main', 'ProcessSecondCard', 'Zweite Karte: secondIdx setzen, Match prüfen');
    agent.addAction('ProcessSecondCard', 'variable', 'SetSecondIdx', {
        variableName: 'secondIdx', value: '${clickedIdx}'
    });
    agent.addAction('ProcessSecondCard', 'calculate', 'IncAttempts', {
        formula: 'attempts + 1', resultVariable: 'attempts'
    });
    agent.addAction('ProcessSecondCard', 'list_get', 'GetFirstCard', {
        target: 'cards', index: '${firstIdx}', resultVariable: 'firstCard'
    });
    agent.addAction('ProcessSecondCard', 'calculate', 'EvalMatch', {
        formula: 'firstCard.value == tempCard.value', resultVariable: 'isMatch'
    });
    agent.addBranch('ProcessSecondCard', 'isMatch', '==', true, (matchThen: any) => {
        matchThen.addTaskCall('HandleMatch');
    });

    // ────────────────────────────────────────
    // ProcessCardClick — aufdecken + erste/zweite Karte
    //   (Wird nur aufgerufen wenn canFlip == true.)
    // ────────────────────────────────────────
    agent.createTask('stage_main', 'ProcessCardClick', 'Karte aufdecken, erste oder zweite Karte einsortieren');
    // 1. Karte aufdecken
    agent.addAction('ProcessCardClick', 'property', 'FlipUp', {
        target: 'tempCard', changes: { face: true, displayText: '${tempCard.value}' }
    });
    // 2. Ist es die erste Karte dieses Paars?
    agent.addAction('ProcessCardClick', 'calculate', 'EvalIsFirst', {
        formula: 'firstIdx == -1', resultVariable: 'isFirst'
    });
    agent.addBranch('ProcessCardClick', 'isFirst', '==', true,
        (firstThen: any) => {
            firstThen.addNewAction('variable', 'SetFirstIdx', {
                variableName: 'firstIdx', value: '${clickedIdx}'
            });
        },
        (secondElse: any) => {
            secondElse.addTaskCall('ProcessSecondCard');
        }
    );

    // ────────────────────────────────────────
    // CheckWin — bei Score==8: WinDialog
    // ────────────────────────────────────────
    agent.createTask('stage_main', 'CheckWin', 'Prüfen ob alle 8 Paare gefunden');
    agent.addBranch('CheckWin', 'score', '==', 8, (winThen: any) => {
        winThen.addNewAction('call_method', 'ShowWinDialog', {
            target: 'WinDialog', method: 'show'
        });
    });

    // ────────────────────────────────────────
    // OnCardClick — Haupt-Einsprungspunkt (Template-Event)
    // ────────────────────────────────────────
    agent.createTask('stage_main', 'OnCardClick', 'Klick auf beliebige Memory-Karte');

    // 1. Klick-Index aus Magic-Variable ${self._idx} extrahieren
    agent.addAction('OnCardClick', 'variable', 'GetIdxStr', {
        variableName: 'clickedIdxStr', value: '${self._idx}'
    });
    agent.addAction('OnCardClick', 'calculate', 'ParseIdx', {
        formula: 'parseInt(clickedIdxStr)', resultVariable: 'clickedIdx'
    });

    // 2. Falls schon zwei Karten offen → erst zurückklappen
    agent.addBranch('OnCardClick', 'secondIdx', '!=', -1, (resetThen: any) => {
        resetThen.addTaskCall('ResetFlippedCards');
    });

    // 3. Geklickte Karte holen + prüfen ob aufdeckbar
    agent.addAction('OnCardClick', 'list_get', 'GetClicked', {
        target: 'cards', index: '${clickedIdx}', resultVariable: 'tempCard'
    });
    agent.addAction('OnCardClick', 'calculate', 'EvalCanFlip', {
        formula: '!tempCard.matched && !tempCard.face', resultVariable: 'canFlip'
    });

    // 4. Nur wenn aufdeckbar: weiter verarbeiten
    agent.addBranch('OnCardClick', 'canFlip', '==', true, (flipThen: any) => {
        flipThen.addTaskCall('ProcessCardClick');
    });

    // 5. Nach jedem Klick: Win-Check
    agent.addTaskCall('OnCardClick', 'CheckWin');

    // ═══════════════════════════════════════
    // SCHRITT 8: EVENTS
    // ═══════════════════════════════════════

    // Stage-Load → Init
    agent.connectEvent('stage_main', 'stage', 'onRuntimeStart', 'InitGame');

    // Die Card-Click-Events sind im TForEach-Template definiert
    // (events: { onClick: 'OnCardClick' }) und werden für jeden Klon
    // automatisch gebunden.
}

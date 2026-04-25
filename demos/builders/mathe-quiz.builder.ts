/**
 * Mathe-Quiz (Klasse 1) – Builder
 * 
 * Erstellt ein Mathe-Quiz für Erstklässler:
 * - 2 Zufallszahlen (1–10) werden addiert
 * - Kind gibt Antwort in Eingabefeld ein
 * - Feedback: Richtig (grün) / Falsch (rot)
 * - Score-System: +1 pro richtige Antwort
 * - Countdown-Timer (60 Sekunden)
 * - Neue Aufgabe nach jeder Antwort (oder Timeout)
 * 
 * Lernziele:
 * - TRandomVariable + generate()
 * - Conditions (Antwortkontrolle)
 * - Timer (Countdown)
 * - Score-System (TIntegerVariable)
 * - TEdit (Eingabefeld)
 * - Mehrere Tasks mit Aufruf-Ketten
 * 
 * Aufruf: npx tsx scripts/agent-run.ts demos/builders/mathe-quiz.builder.ts demos/MatheQuiz.json
 */
import { ProjectBuilder } from '../../scripts/agent-run';

export default function build(agent: ProjectBuilder): void {

    // ═══════════════════════════════════════
    // SCHRITT 1: ZIEL
    // ═══════════════════════════════════════
    agent.setMeta(
        'demo_mathe_quiz_klasse1',
        'Mathe-Quiz (Klasse 1)',
        'Additions-Quiz für Erstklässler: Zufallsaufgaben, Score-System, 60-Sekunden-Timer.'
    );

    // ═══════════════════════════════════════
    // SCHRITT 2: OBJEKTE
    // ═══════════════════════════════════════

    // --- Blueprint: Infrastruktur ---
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
        state: 'idle', spritesMoving: false, collisionsEnabled: false,
        style: { backgroundColor: '#4caf50', color: '#fff' }
    });

    // --- Main-Stage: Quiz-Oberfläche ---
    agent.createStage('stage_main', 'Quiz');

    // Titel
    agent.createLabel('stage_main', 'TitelLabel', 16, 1, '🧮 Mathe-Quiz', {
        width: 32, height: 3, fontSize: 36, fontWeight: 'bold', color: '#f7c948',
        textAlign: 'center'
    });

    // Aufgabe: "Zahl1 + Zahl2 = ?"
    agent.createLabel('stage_main', 'Zahl1Label', 16, 8, '?', {
        width: 6, height: 5, fontSize: 64, fontWeight: 'bold', color: '#ffffff',
        textAlign: 'center'
    });

    agent.createLabel('stage_main', 'PlusLabel', 23, 8, '+', {
        width: 4, height: 5, fontSize: 64, fontWeight: 'bold', color: '#88ccff',
        textAlign: 'center'
    });

    agent.createLabel('stage_main', 'Zahl2Label', 28, 8, '?', {
        width: 6, height: 5, fontSize: 64, fontWeight: 'bold', color: '#ffffff',
        textAlign: 'center'
    });

    agent.createLabel('stage_main', 'GleichLabel', 35, 8, '=', {
        width: 4, height: 5, fontSize: 64, fontWeight: 'bold', color: '#88ccff',
        textAlign: 'center'
    });

    // Eingabefeld für die Antwort
    agent.addObject('stage_main', {
        className: 'TEdit', name: 'AntwortInput',
        x: 40, y: 9, width: 8, height: 3,
        text: '', placeholder: '?',
        style: {
            fontSize: 48, fontWeight: 'bold', textAlign: 'center',
            backgroundColor: '#2a2a4a', borderColor: '#5555ff', borderWidth: 2, borderRadius: 8,
            color: '#ffffff'
        }
    });

    // OK-Button
    agent.addObject('stage_main', {
        className: 'TButton', name: 'OkButton',
        x: 26, y: 16, width: 12, height: 3,
        text: '✅ Prüfen',
        style: {
            fontSize: 20, fontWeight: 'bold', textAlign: 'center',
            backgroundColor: '#28a745', borderColor: '#1e7e34', borderWidth: 1, borderRadius: 12,
            color: '#ffffff'
        }
    });

    // Feedback-Label
    agent.createLabel('stage_main', 'FeedbackLabel', 16, 21, '', {
        width: 32, height: 3, fontSize: 28, fontWeight: 'bold', color: '#888888',
        textAlign: 'center'
    });

    // Score-Anzeige
    agent.createLabel('stage_main', 'ScoreTextLabel', 2, 35, 'Punkte:', {
        width: 8, height: 2, fontSize: 18, fontWeight: 'normal', color: '#aaaaaa',
        textAlign: 'right'
    });

    agent.createLabel('stage_main', 'ScoreLabel', 11, 35, '0', {
        width: 6, height: 2, fontSize: 24, fontWeight: 'bold', color: '#4caf50',
        textAlign: 'left'
    });

    // Timer-Anzeige
    agent.createLabel('stage_main', 'TimerTextLabel', 44, 35, 'Zeit:', {
        width: 6, height: 2, fontSize: 18, fontWeight: 'normal', color: '#aaaaaa',
        textAlign: 'right'
    });

    agent.createLabel('stage_main', 'TimerLabel', 51, 35, '60', {
        width: 6, height: 2, fontSize: 24, fontWeight: 'bold', color: '#ff6b6b',
        textAlign: 'left'
    });

    // Aufgaben-Zähler
    agent.createLabel('stage_main', 'AufgabenLabel', 24, 35, 'Aufgabe: 1', {
        width: 16, height: 2, fontSize: 18, fontWeight: 'normal', color: '#aaaaaa',
        textAlign: 'center'
    });

    // Start-Button (anfangs sichtbar)
    agent.addObject('stage_main', {
        className: 'TButton', name: 'StartButton',
        x: 22, y: 26, width: 20, height: 4,
        text: '🎮 Quiz starten!',
        style: {
            fontSize: 24, fontWeight: 'bold', textAlign: 'center',
            backgroundColor: '#0078d4', borderColor: '#005a9e', borderWidth: 2, borderRadius: 16,
            color: '#ffffff'
        }
    });

    // Game-Over Label (anfangs unsichtbar)
    agent.createLabel('stage_main', 'GameOverLabel', 10, 26, '', {
        width: 44, height: 4, fontSize: 28, fontWeight: 'bold', color: '#f7c948',
        textAlign: 'center'
    });

    // ═══════════════════════════════════════
    // SCHRITT 3: VARIABLEN (Stage-Objekte)
    // ═══════════════════════════════════════

    // Zufallszahlen-Generatoren
    agent.addObject('stage_main', {
        className: 'TRandomVariable', name: 'Zahl1',
        x: 2, y: 6, width: 4, height: 1,
        isVariable: true, isHiddenInRun: true,
        min: 1, max: 10, isInteger: true,
        style: { backgroundColor: '#607d8b', borderColor: '#455a64', borderWidth: 2 }
    });

    agent.addObject('stage_main', {
        className: 'TRandomVariable', name: 'Zahl2',
        x: 7, y: 6, width: 4, height: 1,
        isVariable: true, isHiddenInRun: true,
        min: 1, max: 10, isInteger: true,
        style: { backgroundColor: '#607d8b', borderColor: '#455a64', borderWidth: 2 }
    });

    // Score, Countdown, Ergebnis, Aufgabennummer
    agent.addObject('stage_main', {
        className: 'TIntegerVariable', name: 'Score',
        x: 2, y: 8, width: 4, height: 1,
        isVariable: true, isHiddenInRun: true,
        type: 'integer', defaultValue: 0, value: 0,
        style: { backgroundColor: '#d1c4e9', borderColor: '#9575cd', borderWidth: 1 }
    });

    agent.addObject('stage_main', {
        className: 'TIntegerVariable', name: 'Zeitlimit',
        x: 7, y: 8, width: 4, height: 1,
        isVariable: true, isHiddenInRun: true,
        type: 'integer', defaultValue: 60, value: 60,
        style: { backgroundColor: '#d1c4e9', borderColor: '#9575cd', borderWidth: 1 }
    });

    agent.addObject('stage_main', {
        className: 'TIntegerVariable', name: 'Ergebnis',
        x: 12, y: 8, width: 4, height: 1,
        isVariable: true, isHiddenInRun: true,
        type: 'integer', defaultValue: 0, value: 0,
        style: { backgroundColor: '#d1c4e9', borderColor: '#9575cd', borderWidth: 1 }
    });

    agent.addObject('stage_main', {
        className: 'TIntegerVariable', name: 'AufgabenNr',
        x: 17, y: 8, width: 4, height: 1,
        isVariable: true, isHiddenInRun: true,
        type: 'integer', defaultValue: 1, value: 1,
        style: { backgroundColor: '#d1c4e9', borderColor: '#9575cd', borderWidth: 1 }
    });

    // Countdown-Timer (1x pro Sekunde, 60 Sekunden)
    agent.addObject('stage_main', {
        className: 'TTimer', name: 'CountdownTimer',
        x: 2, y: 10, width: 6, height: 2,
        isVariable: true, isService: true, isHiddenInRun: true,
        interval: 1000, enabled: false, maxInterval: 60, currentInterval: 0,
        style: { backgroundColor: '#e53935', borderColor: '#b71c1c', borderWidth: 2 }
    });

    // ═══════════════════════════════════════
    // SCHRITT 4: BINDINGS
    // ═══════════════════════════════════════

    agent.bindVariable('stage_main', 'Zahl1Label', 'text', 'Zahl1');
    agent.bindVariable('stage_main', 'Zahl2Label', 'text', 'Zahl2');
    agent.bindVariable('stage_main', 'ScoreLabel', 'text', 'Score');
    agent.bindVariable('stage_main', 'TimerLabel', 'text', 'Zeitlimit');

    // ═══════════════════════════════════════
    // SCHRITT 5+6: TASKS + ACTIONS + EVENTS
    // ═══════════════════════════════════════

    // ---- Task: NeueAufgabe ----
    // Generiert 2 Zufallszahlen, berechnet Ergebnis, aktualisiert Anzeige
    agent.createTask('stage_main', 'NeueAufgabe', 'Neue Zufallsaufgabe generieren');
    agent.addAction('NeueAufgabe', 'call_method', 'Zahl1Generieren', {
        target: 'Zahl1', method: 'generate'
    });
    agent.addAction('NeueAufgabe', 'call_method', 'Zahl2Generieren', {
        target: 'Zahl2', method: 'generate'
    });
    agent.addAction('NeueAufgabe', 'calculate', 'ErgebnisBerechnen', {
        formula: 'Zahl1 + Zahl2', resultVariable: 'Ergebnis'
    });
    agent.addAction('NeueAufgabe', 'property', 'AntwortLeeren', {
        target: 'AntwortInput', changes: { text: '' }
    });
    agent.addAction('NeueAufgabe', 'property', 'FeedbackLeeren', {
        target: 'FeedbackLabel', changes: { text: '' }
    });
    // AufgabenNr-Anzeige aktualisieren
    agent.addAction('NeueAufgabe', 'property', 'AufgabenAnzeige', {
        target: 'AufgabenLabel', changes: { text: '${AufgabenNr}' }
    });

    // ---- Task: QuizStarten ----
    // Spiel initialisieren: Score=0, Timer starten, erste Aufgabe
    agent.createTask('stage_main', 'QuizStarten', 'Quiz initialisieren und starten');
    agent.addAction('QuizStarten', 'property', 'SpielStarten', {
        target: 'GameState', changes: { state: 'playing' }
    });
    agent.addAction('QuizStarten', 'property', 'StartButtonVerstecken', {
        target: 'StartButton', changes: { visible: false }
    });
    agent.addAction('QuizStarten', 'property', 'GameOverVerstecken', {
        target: 'GameOverLabel', changes: { text: '' }
    });
    agent.addAction('QuizStarten', 'property', 'OkButtonAktivieren', {
        target: 'OkButton', changes: { enabled: true }
    });
    agent.addAction('QuizStarten', 'calculate', 'ScoreReset', {
        formula: '0', resultVariable: 'Score'
    });
    agent.addAction('QuizStarten', 'calculate', 'ZeitReset', {
        formula: '60', resultVariable: 'Zeitlimit'
    });
    agent.addAction('QuizStarten', 'calculate', 'AufgabenNrReset', {
        formula: '1', resultVariable: 'AufgabenNr'
    });
    agent.addAction('QuizStarten', 'call_method', 'TimerStarten', {
        target: 'CountdownTimer', method: 'timerStart'
    });
    // Erste Aufgabe generieren
    agent.addTaskCall('QuizStarten', 'NeueAufgabe');

    // ---- Task: OnTimerTick ----
    // Countdown um 1 reduzieren
    agent.createTask('stage_main', 'OnTimerTick', 'Countdown reduzieren');
    agent.addAction('OnTimerTick', 'calculate', 'ZeitReduzieren', {
        formula: 'Zeitlimit - 1', resultVariable: 'Zeitlimit'
    });

    // ---- Task: AntwortPruefen ----
    // Prüft ob die Antwort korrekt ist
    agent.createTask('stage_main', 'AntwortPruefen', 'Antwort auswerten');
    // Richtig: Score +1, Feedback grün
    agent.addAction('AntwortPruefen', 'calculate', 'ScoreErhoehen', {
        formula: 'Score + 1', resultVariable: 'Score'
    });
    agent.addAction('AntwortPruefen', 'property', 'FeedbackRichtig', {
        target: 'FeedbackLabel', changes: { text: '✅ Richtig! Super!' }
    });
    agent.addAction('AntwortPruefen', 'property', 'FeedbackRichtigFarbe', {
        target: 'FeedbackLabel', changes: { 'style': { color: '#4caf50', fontSize: 28, fontWeight: 'bold', textAlign: 'center', backgroundColor: 'transparent' } }
    });

    // Falsch: Feedback rot
    agent.addAction('AntwortPruefen', 'property', 'FeedbackFalsch', {
        target: 'FeedbackLabel', changes: { text: '❌ Leider falsch!' }
    });
    agent.addAction('AntwortPruefen', 'property', 'FeedbackFalschFarbe', {
        target: 'FeedbackLabel', changes: { 'style': { color: '#ff5252', fontSize: 28, fontWeight: 'bold', textAlign: 'center', backgroundColor: 'transparent' } }
    });

    // Aufgabennummer erhöhen
    agent.addAction('AntwortPruefen', 'calculate', 'AufgabenNrErhoehen', {
        formula: 'AufgabenNr + 1', resultVariable: 'AufgabenNr'
    });

    // Verzweigung: AntwortInput.text == Ergebnis → Richtig, sonst Falsch
    // Wir ersetzen die Sequenz manuell durch Condition
    // Achtung: Wir müssen die einzelnen Actions entfernen und als Branch neu aufbauen
    // Dafür leeren wir die Sequenz und bauen sie mit addBranch neu auf
    const taskInfo = (agent as any).findTask('AntwortPruefen');
    if (taskInfo) taskInfo.task.actionSequence = []; // Reset für sauberen Branch-Aufbau

    agent.addBranch('AntwortPruefen', 'AntwortInput.text', '==', '${Ergebnis}',
        (then: any) => {
            then.addExistingAction('ScoreErhoehen');
            then.addExistingAction('FeedbackRichtig');
            then.addExistingAction('FeedbackRichtigFarbe');
        },
        (elseBranch: any) => {
            elseBranch.addExistingAction('FeedbackFalsch');
            elseBranch.addExistingAction('FeedbackFalschFarbe');
        }
    );
    agent.addAction('AntwortPruefen', 'calculate', 'AufgabenNrErhoehen2', {
        formula: 'AufgabenNr + 1', resultVariable: 'AufgabenNr'
    });
    // Nächste Aufgabe nach Antwort
    agent.addTaskCall('AntwortPruefen', 'NeueAufgabe');

    // ---- Task: QuizBeenden ----
    // Wenn Timer abgelaufen
    agent.createTask('stage_main', 'QuizBeenden', 'Quiz beenden, Ergebnis zeigen');
    agent.addAction('QuizBeenden', 'property', 'SpielBeenden', {
        target: 'GameState', changes: { state: 'gameover' }
    });
    agent.addAction('QuizBeenden', 'property', 'OkButtonDeaktivieren', {
        target: 'OkButton', changes: { enabled: false }
    });
    agent.addAction('QuizBeenden', 'property', 'GameOverAnzeigen', {
        target: 'GameOverLabel', changes: { text: '⏰ Zeit abgelaufen! Punkte: ${Score}' }
    });
    agent.addAction('QuizBeenden', 'property', 'StartButtonRestart', {
        target: 'StartButton', changes: { visible: true, text: '🔄 Nochmal spielen!' }
    });

    // ═══════════════════════════════════════
    // SCHRITT 7: EVENTS
    // ═══════════════════════════════════════

    agent.connectEvent('stage_main', 'StartButton', 'onClick', 'QuizStarten');
    agent.connectEvent('stage_main', 'OkButton', 'onClick', 'AntwortPruefen');
    agent.connectEvent('stage_main', 'CountdownTimer', 'onTimer', 'OnTimerTick');
    agent.connectEvent('stage_main', 'CountdownTimer', 'onMaxIntervalReached', 'QuizBeenden');
}

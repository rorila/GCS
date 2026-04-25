export default function build(agent: any) {
    agent.setMeta('memory_game', 'Memory', 'Ein KI-generiertes Memory-Spiel');

    // 1. Blueprint Setup
    agent.createStage('stage_blueprint', 'Blueprint', 'blueprint');

    agent.addObject('stage_blueprint', { className: 'TGameLoop', name: 'GameLoop', enabled: true, x: 10, y: 10 });
    agent.addObject('stage_blueprint', { className: 'TGameState', name: 'GameState', active: true, x: 10, y: 50 });
    agent.addObject('stage_blueprint', { 
        className: 'TDialogRoot', 
        name: 'WinDialog', 
        visible: false, 
        modal: true, 
        title: '🏆 Gewonnen!', 
        x: 10, 
        y: 90 
    });

    // 2. Memory Stage
    agent.createStage('stage_main', 'Memory Game', 'standard');

    // --- Game State Variables (Global) ---
    agent.addVariable('FirstCard', 'string', '');
    agent.addVariable('FirstCardValue', 'string', '');
    agent.addVariable('SecondCard', 'string', '');
    agent.addVariable('SecondCardValue', 'string', '');
    agent.addVariable('State', 'string', 'idle'); 
    agent.addVariable('Matches', 'integer', 0);
    agent.addVariable('Tries', 'integer', 0);

    // --- Shuffle Cards via TS ---
    const pairs = ['🍎', '🍌', '🍇', '🍉', '🍓', '🍒', '🥝', '🍍'];
    const deck = [...pairs, ...pairs];

    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    // --- Cards and their Variables ---
    const CARD_SIZE = 4; // 4 Zellen (80 Pixel)
    const SPACING = 1;   // 1 Zelle (20 Pixel)
    const START_X = 4;   // Spalte 4
    const START_Y = 6;   // Zeile 6

    for (let i = 0; i < 16; i++) {
        const id = (i + 1).toString();
        const row = Math.floor(i / 4);
        const col = i % 4;
        const x = START_X + col * (CARD_SIZE + SPACING);
        const y = START_Y + row * (CARD_SIZE + SPACING);

        agent.addVariable(`Card${id}_State`, 'integer', 0);
        agent.addVariable(`Card${id}_Value`, 'string', deck[i]);
        agent.addVariable(`Card${id}_Display`, 'string', '❓');

        agent.addObject('stage_main', {
            className: 'TButton',
            name: `Btn_Card${id}`,
            caption: `\${Card${id}_Display}`,
            x: x,
            y: y,
            width: CARD_SIZE,
            height: CARD_SIZE,
            style: { fontSize: '32px' }
        });
    }

    // --- UI Labels ---
    agent.addObject('stage_main', {
        className: 'TLabel',
        name: 'LblStats',
        text: 'Versuche: ${Tries}  |  Gefunden: ${Matches} / 8',
        x: START_X,
        y: START_Y - 3,
        width: 20,
        height: 2
    });

    // --- Timer for hiding cards ---
    agent.addObject('stage_main', {
        className: 'TTimer',
        name: 'CheckTimer',
        interval: 1000, 
        enabled: false,
        autoReset: false,
        x: 10,
        y: 10
    });

    // --- Task: CheckMatch ---
    agent.createTask('stage_main', 'CheckMatch');
    agent.addAction('CheckMatch', 'calculate', 'IncTries', { formula: 'Tries + 1', resultVariable: 'Tries' });
    
    agent.addBranch('CheckMatch', 'FirstCardValue', '==', '${SecondCardValue}', (then: any) => {
        // Match!
        then.addNewAction('calculate', 'IncMatches', { formula: 'Matches + 1', resultVariable: 'Matches' });
        
        for (let i = 1; i <= 16; i++) {
            then.addNewAction('calculate', `SetState2First_${i}`, { 
                formula: `FirstCard == "${i}" ? 2 : Card${i}_State`, 
                resultVariable: `Card${i}_State` 
            });
            then.addNewAction('calculate', `SetState2Second_${i}`, { 
                formula: `SecondCard == "${i}" ? 2 : Card${i}_State`, 
                resultVariable: `Card${i}_State` 
            });
        }
    }, (elseBranch: any) => {
        // No Match! Hide flipped cards
        for (let i = 1; i <= 16; i++) {
            elseBranch.addNewAction('calculate', `ResetState0_${i}`, { 
                formula: `Card${i}_State == 1 ? 0 : Card${i}_State`, 
                resultVariable: `Card${i}_State` 
            });
            // When hiding, set display back to ?
            elseBranch.addNewAction('calculate', `ResetDisplay_${i}`, { 
                formula: `Card${i}_State == 0 ? "❓" : Card${i}_Display`, 
                resultVariable: `Card${i}_Display` 
            });
        }
    });
    
    agent.addBranch('CheckMatch', 'Matches', '==', 8, (win: any) => {
        win.addNewAction('call_method', 'ShowWinDialog', { target: 'WinDialog', method: 'show' });
    });

    // Common for both: Reset FirstCard, SecondCard, State
    agent.addAction('CheckMatch', 'calculate', 'ResetFirstCard', { formula: '""', resultVariable: 'FirstCard' });
    agent.addAction('CheckMatch', 'calculate', 'ResetSecondCard', { formula: '""', resultVariable: 'SecondCard' });
    agent.addAction('CheckMatch', 'calculate', 'ResetState', { formula: '"idle"', resultVariable: 'State' });

    agent.connectEvent('stage_main', 'CheckTimer', 'onTimer', 'CheckMatch');

    // --- Tasks: OnClick_CardX ---
    for (let i = 1; i <= 16; i++) {
        const taskId = `OnClick_Card${i}`;
        agent.createTask('stage_main', taskId);
        
        // 1. Can Flip?
        agent.addVariable(`CanFlip_${i}`, 'boolean', false);
        agent.addAction(taskId, 'calculate', `EvalCanFlip_${i}`, {
            formula: `State == "idle" && Card${i}_State == 0`, resultVariable: `CanFlip_${i}`
        });

        // 2. Do Flip if allowed
        agent.addBranch(taskId, `CanFlip_${i}`, '==', true, (canFlip: any) => {
            canFlip.addNewAction('calculate', `FlipState_${i}`, { formula: '1', resultVariable: `Card${i}_State` });
            canFlip.addNewAction('variable', `FlipDisplay_${i}`, { source: `Card${i}_Value`, variableName: `Card${i}_Display` });
        });

        // 3. Is First Card? (CanFlip AND FirstCard is empty)
        agent.addVariable(`IsFirst_${i}`, 'boolean', false);
        agent.addAction(taskId, 'calculate', `EvalIsFirst_${i}`, {
            formula: `CanFlip_${i} && FirstCard == ""`, resultVariable: `IsFirst_${i}`
        });
        agent.addBranch(taskId, `IsFirst_${i}`, '==', true, (isFirst: any) => {
            isFirst.addNewAction('calculate', `SetFirstCard_${i}`, { formula: `"${i}"`, resultVariable: 'FirstCard' });
            isFirst.addNewAction('variable', `SetFirstCardVal_${i}`, { source: `Card${i}_Value`, variableName: 'FirstCardValue' });
        });

        // 4. Is Second Card? (CanFlip AND FirstCard NOT empty AND FirstCard is NOT this card)
        agent.addVariable(`IsSecond_${i}`, 'boolean', false);
        agent.addAction(taskId, 'calculate', `EvalIsSecond_${i}`, {
            // Need string quotes around "${i}" so it evaluates FirstCard != "3" 
            formula: `CanFlip_${i} && FirstCard != "" && FirstCard != "${i}"`, resultVariable: `IsSecond_${i}`
        });
        agent.addBranch(taskId, `IsSecond_${i}`, '==', true, (isSecond: any) => {
            isSecond.addNewAction('calculate', `SetSecondCard_${i}`, { formula: `"${i}"`, resultVariable: 'SecondCard' });
            isSecond.addNewAction('variable', `SetSecondCardVal_${i}`, { source: `Card${i}_Value`, variableName: 'SecondCardValue' });
            isSecond.addNewAction('calculate', `SetWaiting_${i}`, { formula: '"waiting"', resultVariable: 'State' });
            isSecond.addNewAction('call_method', `StartTimer_${i}`, { target: 'CheckTimer', method: 'start' });
        });
        
        agent.connectEvent('stage_main', `Btn_Card${i}`, 'onClick', taskId);
    }
}

const fs = require('fs');
const path = require('path');

const PROJECTS_DIR = path.join(__dirname, '..', 'game-server', 'public', 'projects');
const STAGES = [6, 14, 16, 24, 36];
const MAX_PAIRS = 18;

const COLORS = {
  bg: '#1a1b26',
  panel: '#24283b',
  text: '#c0caf5',
  accent: '#7aa2f7',
  highlight: '#4caf50',
  cardBack: '#414868',
  cardBorder: '#565f89'
};

function uid(prefix = 'obj') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function toBase64Svg(svg) {
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

function generateCardSheet() {
  const cols = 6, rows = 3, cellW = 100, cellH = 100;
  let rects = '', texts = '';
  for (let i = 0; i < MAX_PAIRS; i++) {
    const cx = (i % cols) * cellW;
    const cy = Math.floor(i / cols) * cellH;
    rects += `<rect x="${cx}" y="${cy}" width="${cellW}" height="${cellH}" fill="${COLORS.panel}" stroke="${COLORS.cardBorder}" stroke-width="2"/>`;
    texts += `<text x="${cx + cellW / 2}" y="${cy + cellH / 2 + 18}" fill="${COLORS.text}" font-size="48" font-family="Arial,sans-serif" text-anchor="middle" dominant-baseline="middle">${i + 1}</text>`;
  }
  return toBase64Svg(`<svg xmlns="http://www.w3.org/2000/svg" width="${cols * cellW}" height="${rows * cellH}">${rects}${texts}</svg>`);
}

function generateQuestionMark() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="${COLORS.cardBack}" stroke="${COLORS.cardBorder}" stroke-width="2"/><text x="50" y="58" fill="${COLORS.text}" font-size="56" font-family="Arial,sans-serif" text-anchor="middle" dominant-baseline="middle">?</text></svg>`;
  return toBase64Svg(svg);
}

function makeBaseObject(className, name, x, y, w, h, overrides = {}) {
  return {
    className,
    id: uid(),
    name,
    scope: 'stage',
    draggable: false,
    droppable: false,
    dragMode: 'move',
    visible: true,
    x,
    y,
    width: w,
    height: h,
    zIndex: 0,
    rotation: 0,
    align: 'NONE',
    collisionEnabled: false,
    style: { color: COLORS.text, backgroundColor: 'transparent', borderColor: 'transparent', borderWidth: 0 },
    ...overrides
  };
}

function makeVariable(name, type, value, x, y, overrides = {}) {
  return makeBaseObject('TVariable', name, x, y, 10, 4, {
    isVariable: true,
    isHiddenInRun: true,
    scope: 'stage',
    style: { color: '#000000', backgroundColor: '#d1c4e9', borderColor: '#9575cd', borderWidth: 1 },
    type,
    defaultValue: String(value),
    value,
    objectModel: '',
    ...overrides
  });
}

function makeLabel(name, text, x, y, w = 20, h = 3) {
  return makeBaseObject('TLabel', name, x, y, w, h, { text, style: { color: COLORS.text, backgroundColor: 'transparent', borderColor: 'transparent', borderWidth: 0 } });
}

function makeNumberLabel(name, x, y) {
  return makeBaseObject('TNumberLabel', name, x, y, 6, 3, { text: '0', value: 0, style: { color: COLORS.text, backgroundColor: 'transparent', borderColor: 'transparent', borderWidth: 0 } });
}

function makeButton(name, text, x, y) {
  return makeBaseObject('TButton', name, x, y, 10, 3, { text, icon: '', style: { color: '#ffffff', backgroundColor: COLORS.accent, borderColor: COLORS.accent, borderWidth: 1 }, events: {} });
}

function makeToast(name) {
  return makeBaseObject('TToast', name, 0, 0, 16, 3, { isService: true, isHiddenInRun: true, style: { backgroundColor: 'transparent', borderWidth: 0 } });
}

function makeTimer(name) {
  return makeBaseObject('TTimer', name, 0, 0, 6, 3, {
    scope: 'stage', isHiddenInRun: true, interval: 1200, enabled: false, maxInterval: 0, currentInterval: 0,
    style: { backgroundColor: 'transparent', borderWidth: 0 },
    events: { onTimer: 'OnTimerFlipBack' }
  });
}

function makeSprite(name, x, y, w, h) {
  return makeBaseObject('TSprite', name, x, y, w, h, {
    backgroundImage: '', imageListId: '', imageIndex: 0, objectFit: 'contain',
    style: { backgroundColor: COLORS.cardBack, borderColor: COLORS.cardBorder, borderWidth: 1 },
    events: { onClick: 'OnCardClick' }
  });
}

function makeImageList(name, src) {
  return makeBaseObject('TImageList', name, 2, 2, 12, 6, {
    scope: 'global', isHiddenInRun: true, src, backgroundImage: src, objectFit: 'contain',
    imageOpacity: 1, fallbackColor: '#2a2a2a', imageCountHorizontal: 6, imageCountVertical: 3,
    currentImageNumber: 0, maxImageCount: MAX_PAIRS,
    style: { backgroundColor: 'transparent', borderColor: 'transparent', borderWidth: 0 }
  });
}

function makeImage(name, src) {
  return makeBaseObject('TImage', name, 2, 2, 8, 6, {
    scope: 'global', isHiddenInRun: true, src, backgroundImage: src, objectFit: 'contain',
    imageOpacity: 1, fallbackColor: '#2a2a2a',
    style: { backgroundColor: 'transparent', borderColor: 'transparent', borderWidth: 0 }
  });
}

function makeStageController() {
  return makeBaseObject('TStageController', 'StageController', 2, 2, 8, 4, {
    scope: 'global', isService: true, isHiddenInRun: true,
    style: { color: '#ffffff', backgroundColor: '#9c27b0', borderColor: 'transparent', borderWidth: 0 },
    currentStageId: '', currentStageName: '', currentStageType: 'standard', stageCount: 0,
    isOnMainStage: false, isOnSplashStage: false
  });
}

function makeProjectChangeVar() {
  return makeVariable('isProjectChangeAvailable', 'boolean', true, 12, 2, { scope: 'global' });
}

function getCardGrid(count) {
  if (count <= 6) return [3, 2];
  if (count <= 14) return [7, 2];
  if (count <= 16) return [4, 4];
  if (count <= 24) return [6, 4];
  return [6, 6];
}

function generateStageObjects(cardCount) {
  const objects = [];
  const [cols] = getCardGrid(cardCount);
  const cardW = 4, cardH = 4;
  const startX = Math.floor((64 - cols * cardW) / 2);
  const startY = 16;

  for (let i = 0; i < cardCount; i++) {
    objects.push(makeSprite(`card_${i}`, startX + (i % cols) * cardW, startY + Math.floor(i / cols) * cardH, cardW, cardH));
  }

  objects.push(makeLabel('txtTitle', `Memory${cardCount}`, 2, 2, 30, 3));
  objects.push(makeLabel('txtPlayer1', 'Spieler 1', 2, 6, 12, 3));
  objects.push(makeNumberLabel('txtScore1', 14, 6));
  objects.push(makeLabel('txtPlayer2', 'Spieler 2', 35, 6, 12, 3));
  objects.push(makeNumberLabel('txtScore2', 47, 6));
  objects.push(makeLabel('txtStatus', 'Spieler 1 ist am Zug', 2, 9, 40, 3));
  const restartBtn = makeButton('btnRestart', 'Neustart', 52, 9);
  restartBtn.events = { onClick: 'OnRestart' };
  objects.push(restartBtn);
  objects.push(makeToast('dlgWin'));
  objects.push(makeTimer('timerFlipBack'));

  objects.push(makeVariable('varTotalCards', 'integer', cardCount, 55, 2));
  objects.push(makeVariable('varCurrentPlayer', 'integer', 1, 55, 3));
  objects.push(makeVariable('varScore1', 'integer', 0, 55, 4));
  objects.push(makeVariable('varScore2', 'integer', 0, 55, 5));
  objects.push(makeVariable('varRevealedCount', 'integer', 0, 55, 6));
  objects.push(makeVariable('varSolvedCount', 'integer', 0, 55, 7));
  objects.push(makeVariable('varFirstCard', 'object', null, 55, 8));
  objects.push(makeVariable('varSecondCard', 'object', null, 55, 9));
  objects.push(makeVariable('varFirstCardIndex', 'integer', -1, 55, 10));
  objects.push(makeVariable('varSecondCardIndex', 'integer', -1, 55, 11));
  objects.push(makeVariable('varClickedCardIndex', 'integer', -1, 55, 12));
  objects.push(makeVariable('varClickedPicIndex', 'integer', -1, 55, 13));
  objects.push(makeVariable('varSourcePic', 'integer', 0, 55, 14));
  objects.push(makeVariable('varDestPic', 'integer', 0, 55, 15));
  objects.push(makeVariable('varTempValue', 'integer', 0, 55, 16));
  objects.push(makeVariable('varLoopIndex', 'integer', 0, 55, 17));
  objects.push({ ...makeVariable('Bildmatrix', 'list', [], 55, 18), value: [] });
  objects.push({ ...makeVariable('solvedState', 'list', [], 55, 19), value: [] });

  return objects;
}

function generateStageActions(cardCount) {
  const pfx = `Memory${cardCount}_`;
  const pairCount = cardCount / 2;
  const actions = [];
  const add = (name, type, overrides) => {
    const full = `${pfx}${name}`;
    actions.push({ name: full, type, ...overrides });
    return full;
  };

  // InitGame
  add('Init_ResetState', 'property', {
    changes: {
      'varCurrentPlayer': '1',
      'varScore1': '0',
      'varScore2': '0',
      'varRevealedCount': '0',
      'varSolvedCount': '0',
      'varFirstCard': '',
      'varSecondCard': '',
      'varFirstCardIndex': '-1',
      'varSecondCardIndex': '-1',
      'varClickedCardIndex': '-1',
      'varClickedPicIndex': '-1'
    }
  });
  add('Init_ClearMatrix', 'list_clear', { target: 'Bildmatrix' });
  for (let i = 0; i < pairCount; i++) {
    add(`Init_Push_${i}_a`, 'list_push', { target: 'Bildmatrix', value: String(i) });
    add(`Init_Push_${i}_b`, 'list_push', { target: 'Bildmatrix', value: String(i) });
  }
  add('Init_SwapLoop', 'for', {
    iteratorVar: 'varLoopIndex',
    from: 0,
    to: cardCount - 1,
    body: [`${pfx}Swap_Step`]
  });
  add('Swap_GetSource', 'list_get', { target: 'Bildmatrix', index: '${varLoopIndex}', resultVariable: 'varSourcePic' });
  add('Swap_RandomDest', 'calculate', { formula: `Math.floor(Math.random() * ${cardCount})`, resultVariable: 'varDestPic' });
  add('Swap_GetDest', 'list_get', { target: 'Bildmatrix', index: '${varDestPic}', resultVariable: 'varTempValue' });
  add('Swap_SetDest', 'list_set', { target: 'Bildmatrix', index: '${varLoopIndex}', value: '${varTempValue}' });
  add('Swap_SetSource', 'list_set', { target: 'Bildmatrix', index: '${varDestPic}', value: '${varSourcePic}' });

  for (let i = 0; i < cardCount; i++) {
    add(`Init_ResetCard_${i}`, 'property', {
      changes: { [`card_${i}.backgroundImage`]: 'imgBack', [`card_${i}.imageIndex`]: '-1', [`card_${i}.visible`]: 'true' }
    });
  }
  add('Init_ClearSolved', 'list_clear', { target: 'solvedState' });
  add('Init_SolvedLoop', 'for', {
    iteratorVar: 'varLoopIndex',
    from: 0,
    to: cardCount - 1,
    body: [{ type: 'list_push', target: 'solvedState', value: 'false' }]
  });
  add('Init_StatusText', 'property', { changes: { 'txtStatus.text': 'Spieler 1 ist am Zug' } });
  add('Init_HighlightP1', 'property', {
    changes: {
      'txtPlayer1.style.backgroundColor': '#4caf50',
      'txtPlayer1.style.color': '#ffffff',
      'txtPlayer2.style.backgroundColor': 'transparent',
      'txtPlayer2.style.color': '#c0caf5'
    }
  });

  // OnCardClick helpers
  add('Click_CalcIndex', 'calculate', { formula: 'parseInt(eventData.self.name.split("_")[1])', resultVariable: 'varClickedCardIndex' });
  add('Click_GetPic', 'list_get', { target: 'Bildmatrix', index: '${varClickedCardIndex}', resultVariable: 'varClickedPicIndex' });
  add('Click_DoReveal', 'property', {
    changes: {
      'eventData.self.backgroundImage': '',
      'eventData.self.imageListId': 'imgCards',
      'eventData.self.imageIndex': '${varClickedPicIndex}'
    }
  });
  add('Click_SetFirst', 'property', {
    changes: { 'varFirstCard': '${eventData.self}', 'varFirstCardIndex': '${varClickedCardIndex}', 'varRevealedCount': '1' }
  });
  add('Click_SetSecond', 'property', {
    changes: { 'varSecondCard': '${eventData.self}', 'varSecondCardIndex': '${varClickedCardIndex}', 'varRevealedCount': '2' }
  });
  add('Click_StartTimer', 'call_method', { target: 'timerFlipBack', method: 'timerStart' });

  // OnTimerFlipBack helpers
  add('Flip_GetFirst', 'list_get', { target: 'Bildmatrix', index: '${varFirstCardIndex}', resultVariable: 'varSourcePic' });
  add('Flip_GetSecond', 'list_get', { target: 'Bildmatrix', index: '${varSecondCardIndex}', resultVariable: 'varTempValue' });

  // OnMatch helpers
  add('Match_SetSolvedFirst', 'list_set', { target: 'solvedState', index: '${varFirstCardIndex}', value: 'true' });
  add('Match_SetSolvedSecond', 'list_set', { target: 'solvedState', index: '${varSecondCardIndex}', value: 'true' });
  add('Match_HideFirst', 'property', { changes: { 'varFirstCard.visible': 'false' } });
  add('Match_HideSecond', 'property', { changes: { 'varSecondCard.visible': 'false' } });
  add('Match_SolvedCount', 'property', { changes: { 'varSolvedCount': '${varSolvedCount + 2}' } });
  add('Match_ScoreP1', 'property', { changes: { 'varScore1': '${varScore1 + 1}' } });
  add('Match_ScoreP2', 'property', { changes: { 'varScore2': '${varScore2 + 1}' } });
  add('Match_Status', 'property', { changes: { 'txtStatus.text': 'Paar gefunden! Spieler ${varCurrentPlayer} ist nochmal dran.' } });
  add('Match_ResetCards', 'property', { changes: { 'varFirstCard': '', 'varSecondCard': '', 'varRevealedCount': '0' } });

  // OnMismatch helpers
  add('Mismatch_HideFirst', 'property', { changes: { 'varFirstCard.backgroundImage': 'imgBack', 'varFirstCard.imageIndex': '-1' } });
  add('Mismatch_HideSecond', 'property', { changes: { 'varSecondCard.backgroundImage': 'imgBack', 'varSecondCard.imageIndex': '-1' } });
  add('Mismatch_ResetCards', 'property', { changes: { 'varFirstCard': '', 'varSecondCard': '', 'varRevealedCount': '0' } });
  add('Mismatch_SwitchPlayer', 'property', { changes: { 'varCurrentPlayer': '${3 - varCurrentPlayer}' } });
  add('Mismatch_Status', 'property', { changes: { 'txtStatus.text': 'Spieler ${varCurrentPlayer} ist am Zug' } });
  add('Mismatch_HL_P1', 'property', {
    changes: {
      'txtPlayer1.style.backgroundColor': '#4caf50',
      'txtPlayer1.style.color': '#ffffff',
      'txtPlayer2.style.backgroundColor': 'transparent',
      'txtPlayer2.style.color': '#c0caf5'
    }
  });
  add('Mismatch_HL_P2', 'property', {
    changes: {
      'txtPlayer2.style.backgroundColor': '#4caf50',
      'txtPlayer2.style.color': '#ffffff',
      'txtPlayer1.style.backgroundColor': 'transparent',
      'txtPlayer1.style.color': '#c0caf5'
    }
  });

  // CheckWin helpers
  add('Win_StatusP1', 'property', { changes: { 'txtStatus.text': 'Spieler 1 gewinnt!' } });
  add('Win_StatusP2', 'property', { changes: { 'txtStatus.text': 'Spieler 2 gewinnt!' } });
  add('Win_StatusDraw', 'property', { changes: { 'txtStatus.text': 'Unentschieden!' } });

  return actions;
}

function generateStageTasks(cardCount) {
  const pfx = `Memory${cardCount}_`;
  const tasks = [];
  const add = (name, sequence) => { tasks.push({ name, actionSequence: sequence }); return name; };

  add('NoOp', []);

  // InitGame
  const initSeq = [`${pfx}Init_ResetState`, `${pfx}Init_ClearMatrix`];
  for (let i = 0; i < cardCount / 2; i++) {
    initSeq.push(`${pfx}Init_Push_${i}_a`, `${pfx}Init_Push_${i}_b`);
  }
  initSeq.push(`${pfx}Init_SwapLoop`);
  for (let i = 0; i < cardCount; i++) initSeq.push(`${pfx}Init_ResetCard_${i}`);
  initSeq.push(`${pfx}Init_ClearSolved`, `${pfx}Init_SolvedLoop`, `${pfx}Init_StatusText`, `${pfx}Init_HighlightP1`);
  add('InitGame', initSeq);

  // Swap sub-task
  add(`${pfx}Swap_Step`, [
    `${pfx}Swap_GetSource`,
    `${pfx}Swap_RandomDest`,
    `${pfx}Swap_GetDest`,
    `${pfx}Swap_SetDest`,
    `${pfx}Swap_SetSource`
  ]);

  // OnCardClick validation chain
  add('OnCardClick', [
    `${pfx}Click_CalcIndex`,
    `${pfx}Click_GetPic`,
    { type: 'condition', condition: 'varRevealedCount == 2', thenTask: 'NoOp', elseTask: `${pfx}Click_Validate_Solved` }
  ]);
  add(`${pfx}Click_Validate_Solved`, [
    { type: 'condition', condition: 'solvedState[varClickedCardIndex] == "true"', thenTask: 'NoOp', elseTask: `${pfx}Click_Validate_Same` }
  ]);
  add(`${pfx}Click_Validate_Same`, [
    { type: 'condition', condition: 'varFirstCardIndex == varClickedCardIndex', thenTask: 'NoOp', elseTask: `${pfx}Click_AfterReveal` }
  ]);
  add(`${pfx}Click_AfterReveal`, [
    `${pfx}Click_DoReveal`,
    { type: 'condition', condition: 'varRevealedCount == 0', thenTask: `${pfx}Click_SetFirst`, elseTask: `${pfx}Click_CheckSecond` }
  ]);
  add(`${pfx}Click_CheckSecond`, [
    { type: 'condition', condition: 'varRevealedCount == 1', thenTask: `${pfx}Click_DoSetSecond`, elseTask: 'NoOp' }
  ]);
  add(`${pfx}Click_DoSetSecond`, [`${pfx}Click_SetSecond`, `${pfx}Click_StartTimer`]);

  // OnTimerFlipBack
  add('OnTimerFlipBack', [
    `${pfx}Flip_GetFirst`,
    `${pfx}Flip_GetSecond`,
    { type: 'condition', condition: 'varSourcePic == varTempValue', thenTask: 'OnMatch', elseTask: 'OnMismatch' }
  ]);

  // OnMatch
  add('OnMatch', [
    `${pfx}Match_SetSolvedFirst`,
    `${pfx}Match_SetSolvedSecond`,
    `${pfx}Match_HideFirst`,
    `${pfx}Match_HideSecond`,
    `${pfx}Match_SolvedCount`,
    { type: 'condition', condition: 'varCurrentPlayer == 1', thenTask: `${pfx}ScoreP1`, elseTask: `${pfx}ScoreP2` }
  ]);
  add(`${pfx}ScoreP1`, [`${pfx}Match_ScoreP1`, `${pfx}Match_Status`, `${pfx}Match_ResetCards`, 'CheckWin']);
  add(`${pfx}ScoreP2`, [`${pfx}Match_ScoreP2`, `${pfx}Match_Status`, `${pfx}Match_ResetCards`, 'CheckWin']);

  // OnMismatch
  add('OnMismatch', [
    `${pfx}Mismatch_HideFirst`,
    `${pfx}Mismatch_HideSecond`,
    `${pfx}Mismatch_ResetCards`,
    `${pfx}Mismatch_SwitchPlayer`,
    `${pfx}Mismatch_Status`,
    { type: 'condition', condition: 'varCurrentPlayer == 1', thenTask: `${pfx}Mismatch_HL_P1`, elseTask: `${pfx}Mismatch_HL_P2` }
  ]);

  // CheckWin
  add('CheckWin', [
    { type: 'condition', condition: 'varSolvedCount == varTotalCards', thenTask: `${pfx}Win_Determine`, elseTask: 'NoOp' }
  ]);
  add(`${pfx}Win_Determine`, [
    { type: 'condition', condition: 'varScore1 > varScore2', thenTask: `${pfx}Win_P1`, elseTask: `${pfx}Win_CheckP2` }
  ]);
  add(`${pfx}Win_CheckP2`, [
    { type: 'condition', condition: 'varScore2 > varScore1', thenTask: `${pfx}Win_P2`, elseTask: `${pfx}Win_Draw` }
  ]);
  add(`${pfx}Win_P1`, [{ type: 'show_toast', message: 'Spieler 1 gewinnt!', type: 'success' }, `${pfx}Win_StatusP1`]);
  add(`${pfx}Win_P2`, [{ type: 'show_toast', message: 'Spieler 2 gewinnt!', type: 'success' }, `${pfx}Win_StatusP2`]);
  add(`${pfx}Win_Draw`, [{ type: 'show_toast', message: 'Unentschieden!', type: 'info' }, `${pfx}Win_StatusDraw`]);

  // Restart
  add('OnRestart', ['InitGame']);

  return tasks;
}

function generateStage(cardCount) {
  return {
    id: `memory_${cardCount}`,
    name: `Memory${cardCount}`,
    type: 'standard',
    objects: generateStageObjects(cardCount),
    actions: generateStageActions(cardCount),
    tasks: generateStageTasks(cardCount),
    events: { onEnter: 'InitGame' },
    variables: [],
    grid: { cols: 64, rows: 40, cellSize: 20, snapToGrid: true, visible: true, backgroundColor: '#f5f5f5' },
    flowCharts: {}
  };
}

function generateBlueprint() {
  return {
    id: 'blueprint',
    name: 'Blueprint (Global)',
    type: 'blueprint',
    objects: [
      makeStageController(),
      makeProjectChangeVar(),
      makeImageList('imgCards', generateCardSheet()),
      makeImage('imgBack', generateQuestionMark())
    ],
    actions: [],
    tasks: [],
    variables: [],
    grid: { cols: 64, rows: 40, cellSize: 20, snapToGrid: true, visible: true, backgroundColor: '#f5f5f5' },
    flowCharts: {}
  };
}

function main() {
  const stages = [generateBlueprint()];
  for (const count of STAGES) stages.push(generateStage(count));

  const project = {
    meta: { name: 'Memory', version: '1.0.0', author: '', description: 'Memory-Spiel mit mehreren Schwierigkeitsstufen', _sourcePath: 'projects/Memory.json' },
    stage: { grid: { cols: 64, rows: 40, cellSize: 20, snapToGrid: true, visible: true, backgroundColor: '#ffffff' } },
    flow: { stage: { cols: 100, rows: 100, cellSize: 20, snapToGrid: true, visible: true, backgroundColor: '#1e1e1e' }, elements: [], connections: [] },
    input: { player1Controls: 'arrows', player1Target: '', player1Speed: 0.2, player2Controls: 'wasd', player2Target: '', player2Speed: 0.2 },
    objects: [], splashObjects: [], splashDuration: 3000, splashAutoHide: true,
    actions: [], tasks: [], variables: [], stages
  };

  const outPath = path.join(PROJECTS_DIR, 'Memory.json');
  fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(project, null, 2), 'utf8');
  console.log(`Memory project written to ${outPath}`);
}

main();

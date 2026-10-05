// Erzeugt Madn-Remote.json aus Madn.json — EINE Datei fuer beide Modi:
// im CMS als Mehrspielpartie (host-autoritativ, TCmsLiveSync, 2-4 Spieler
// im selben Haus), standalone als lokales Hotseat-Spiel (MpAktiv=false —
// der Original-Spielerzahl-Flow mit Btn2/3/4 bleibt erhalten).
// Der komplette Sync-Apparat kommt aus scripts/mp/mp-skeleton.cjs; dieses
// Skript liefert nur die spielspezifischen Hooks:
//   MpPacken            -> Figuren-Slots + Moveable + Zug/Wurf verpacken
//   MpAnwenden          -> Gast uebernimmt Stand und positioniert Figuren
//   MpIntentAusfuehren  -> Host validiert wuerfeln/figur-Absichten
//   MpLobby             -> Lobby- und Zug-UI
//   LokalStarten        -> Hotseat: originaler Spielerzahl-Dialog
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'game-server', 'public', 'projects');
const src = JSON.parse(fs.readFileSync(path.join(dir, 'Madn.json'), 'utf8'));
const p = JSON.parse(JSON.stringify(src));
const skel = require('./mp/mp-skeleton.cjs');
const h = skel.makeHelpers();
const { id, cond, act, task, forI, prop, mapGet, listGet, listSet, calc, call } = h;
const eid = () => id('mdr');

p.meta = { ...p.meta, id: 'madn-remote', name: 'MADN-Remote', version: '1.0.0',
  description: 'Mensch aergere dich nicht — im CMS als Partie fuer 2-4 Spieler im selben Haus (host-autoritativ, TCmsLiveSync), standalone als lokales Hotseat-Spiel. Der Host (Sitz 0, Rot) ist die autoritative Instanz; Gaeste senden Zug-Absichten (wuerfeln/figurwahl), der Stand wandert als kompaktes JSON-Telegramm.',
  _sourcePath: 'projects/Madn-Remote.json', multiplayer: { minPlayers: 2, maxPlayers: 4, scope: 'house' } };

const main = p.stages.find(s => s.id === 'main');
const O = n => main.objects.find(o => o.name === n);
const A = n => main.actions.find(a => a.name === n);
const T = n => main.tasks.find(t => t.name === n);

// ── Oberflaeche: Startzustand neutral halten (Lobby regelt den Rest) ──
// Act_SetupAn/Act_SetupAus bleiben ORIGINAL — sie sind der Hotseat-Flow.
// Im MP-Modus ueberschreibt die Lobby ihre Buttons jedes Push/Poll.
O('WahlLabel').text = 'Verbinde mit der Partie …';
for (const bn of ['Btn2', 'Btn3', 'Btn4', 'WuerfelnBtn', 'NeustartBtn']) O(bn).visible = false;
const btnStyle = O('WuerfelnBtn').style, labelStyle = O('WahlLabel').style;
const V = h.Vv; // Typed-Variablen-Konvention dieser Datei (stage.variables)

// ── Spielspezifische Variablen ──
const gameVars = [
  V.s(eid(), 'MeinFarbName'), V.s(eid(), 'IntentArt'), V.i(eid(), 'IntentFigur', -1),
  V.i(eid(), 'SlotSync'), V.b(eid(), 'MovSync'),
  // Ziel-Zaehler fuer den MpKopf (Spielstand = Figuren im Ziel, Slots 40-55)
  V.i(eid(), 'MpPkt0'), V.i(eid(), 'MpPkt1'), V.i(eid(), 'MpPkt2'), V.i(eid(), 'MpPkt3')
];

const recGet = (i, name, target, field, res) => ({ id: i, name, type: 'record_get', target, list: 'FigurenListe', field, resultVariable: res });
const recSet = (i, name, target, field, value) => ({ id: i, name, type: 'record_set', target, list: 'FigurenListe', field, value });

// ── Spielspezifische Actions ──
const gameActions = [
  prop(eid(), 'Farbe Rot', { MeinFarbName: 'Rot' }), prop(eid(), 'Farbe Blau', { MeinFarbName: 'Blau' }),
  prop(eid(), 'Farbe Gruen', { MeinFarbName: 'Gruen' }), prop(eid(), 'Farbe Gelb', { MeinFarbName: 'Gelb' }),
  prop(eid(), 'Sitz anzeigen', { 'SitzLabel.text': 'Du spielst ${MeinFarbName} (${MitNamen})' }),
  prop(eid(), 'Spielerzahl aus Partie', { 'Var_PlayerCount': '${Mitglieder}' }),
  // Stand verpacken (nur Host)
  recGet(eid(), 'Slot-Wert lesen', '${i}', 'slot', 'Var_SlotTmp'),
  recGet(eid(), 'Moveable-Flag lesen', '${i}', 'moveable', 'MovSync'),
  listSet(eid(), 'Slot speichern', 'SyncSlots', '${i}', '${Var_SlotTmp}'),
  listSet(eid(), 'Moveable speichern', 'SyncMov', '${i}', '${MovSync}'),
  // Das Daten-Telegramm ist ein positionales Array — calculate baut es als
  // echtes JS-Array (jsep ArrayExpression); map_set wuerde Listen zu Strings
  // interpolieren und ist dafuer ungeeignet.
  calc(eid(), 'Daten packen', '[SyncSlots,SyncMov,Var_CurrPlayer,Var_Wurf,Var_PlayerCount,StatusLabel.text]', 'SyncData'),
  // Stand anwenden (nur Gast)
  listGet(eid(), 'Slots lesen', 'LiveData', '0', 'SyncSlots'),
  listGet(eid(), 'Moveable lesen', 'LiveData', '1', 'SyncMov'),
  listGet(eid(), 'Spieler lesen', 'LiveData', '2', 'Var_CurrPlayer'),
  listGet(eid(), 'Wurf lesen', 'LiveData', '3', 'Var_Wurf'),
  listGet(eid(), 'Anzahl lesen', 'LiveData', '4', 'Var_PlayerCount'),
  listGet(eid(), 'Status lesen', 'LiveData', '5', 'StatusText'),
  prop(eid(), 'Status uebernehmen', { 'StatusLabel.text': '${StatusText}' }),
  listGet(eid(), 'Slot laden', 'SyncSlots', '${i}', 'SlotSync'),
  listGet(eid(), 'Moveable laden', 'SyncMov', '${i}', 'MovSync'),
  recSet(eid(), 'Slot schreiben', '${i}', 'slot', '${SlotSync}'),
  recSet(eid(), 'Moveable schreiben', '${i}', 'moveable', '${MovSync}'),
  prop(eid(), 'Wuerfel aus', { 'WuerfelBild.visible': false }),
  // Intents (Gast -> Host): [art, figur]
  prop(eid(), 'Intent Wuerfeln', { IntentArt: 'w', IntentFigur: -1 }),
  prop(eid(), 'Intent Figur', { IntentArt: 'f', IntentFigur: '${Var_Gewaehlt}' }),
  calc(eid(), 'Intent packen', '[IntentArt,IntentFigur]', 'IntentData'),
  listGet(eid(), 'Intent-Art lesen', 'IntentData', '0', 'IntentArt'),
  listGet(eid(), 'Intent-Figur lesen', 'IntentData', '1', 'IntentFigur'),
  recGet(eid(), 'Intent-Farbe lesen', '${IntentFigur}', 'colorIdx', 'Var_PColor'),
  recGet(eid(), 'Intent-Moveable lesen', '${IntentFigur}', 'moveable', 'Var_MoveOk'),
  prop(eid(), 'Intent-Figur merken', { 'Var_Gewaehlt': '${IntentFigur}' }),
  // Oberflaeche / Lobby (MP): Original-Setup-Buttons werden hier versteckt
  prop(eid(), 'Host-Lobby', { 'WahlLabel.visible': true, 'WahlLabel.text': 'Gastgeber: Mitspieler einladen, dann starten (${Mitglieder} Spieler).', 'StartBtn.visible': true, 'Btn2.visible': false, 'Btn3.visible': false, 'Btn4.visible': false, 'WuerfelnBtn.visible': false, 'NeustartBtn.visible': false, 'WuerfelBild.visible': false }),
  prop(eid(), 'Host-Lobby warten', { 'WahlLabel.visible': true, 'WahlLabel.text': 'Gastgeber: Warte auf Mitspieler (${Mitglieder}/2+) …', 'StartBtn.visible': false, 'Btn2.visible': false, 'Btn3.visible': false, 'Btn4.visible': false, 'WuerfelnBtn.visible': false, 'NeustartBtn.visible': false, 'WuerfelBild.visible': false }),
  prop(eid(), 'Gast-Lobby', { 'WahlLabel.visible': true, 'WahlLabel.text': 'Du bist ${MeinFarbName} — warte auf den Start durch den Gastgeber.', 'StartBtn.visible': false, 'Btn2.visible': false, 'Btn3.visible': false, 'Btn4.visible': false, 'WuerfelnBtn.visible': false, 'NeustartBtn.visible': false, 'WuerfelBild.visible': false }),
  prop(eid(), 'Wuerfeln zeigen', { 'WuerfelnBtn.visible': true }),
  prop(eid(), 'Wuerfeln verbergen', { 'WuerfelnBtn.visible': false }),
  prop(eid(), 'Neustart zeigen', { 'NeustartBtn.visible': true }),
  prop(eid(), 'Neustart verbergen', { 'NeustartBtn.visible': false }),
  prop(eid(), 'WahlLabel aus', { 'WahlLabel.visible': false }),
  prop(eid(), 'Warten anzeigen', { 'StatusLabel.text': 'Warte auf Mitspieler …' }),
  // Hotseat-Startzustand: originaler Spielerzahl-Dialog
  prop(eid(), 'SP-Setup', { 'WahlLabel.visible': true, 'WahlLabel.text': 'Wie viele Spieler?', 'Btn2.visible': true, 'Btn3.visible': true, 'Btn4.visible': true, 'WuerfelnBtn.visible': false, 'NeustartBtn.visible': false, 'StartBtn.visible': false, 'SitzLabel.visible': false, 'WuerfelBild.visible': false, 'StatusLabel.text': '' }),
  // Diagnose: landet ohne TToast in der Browser-Konsole des Spielfensters
  call(eid(), 'Log Version', 'Toaster', 'show', ['MADN-Remote ${BuildVersion} | rolle=${MeinFarbName} sitz=${MeinSitz} host=${DuBistHost} mitglieder=${Mitglieder}', 'info']),
  call(eid(), 'Log Wuerfelklick', 'Toaster', 'show', ['WKLICK phase=${Var_Phase} curr=${Var_CurrPlayer} sitz=${MeinSitz} host=${DuBistHost} rolleninit=${RollenInit} party=${PartyId}', 'info']),
  call(eid(), 'Log Intent senden', 'Toaster', 'show', ['ISEND art=${IntentArt} fig=${IntentFigur} lastSeq=${LastSeq}', 'info']),
  call(eid(), 'Log Intent empfangen', 'Toaster', 'show', ['IEMPF seq=${IntentSeq} seat=${IntentSeat} art=${IntentArt} fig=${IntentFigur} | phase=${Var_Phase} curr=${Var_CurrPlayer} letzter=${LetzterInputSeq}', 'info']),
  call(eid(), 'Log Figurklick', 'Toaster', 'show', ['FKLICK gew=${Var_Gewaehlt} moveOk=${Var_MoveOk} pcol=${Var_PColor} curr=${Var_CurrPlayer} sitz=${MeinSitz}', 'info']),
  // MpKopf-Spielstand: Figuren auf Zielfeldern (Slot 40-55) je Farbe zaehlen
  prop(eid(), 'Punkte zurueck', { MpPkt0: 0, MpPkt1: 0, MpPkt2: 0, MpPkt3: 0 }),
  calc(eid(), 'Pkt0 zaehlen', 'MpPkt0+1', 'MpPkt0'), calc(eid(), 'Pkt1 zaehlen', 'MpPkt1+1', 'MpPkt1'),
  calc(eid(), 'Pkt2 zaehlen', 'MpPkt2+1', 'MpPkt2'), calc(eid(), 'Pkt3 zaehlen', 'MpPkt3+1', 'MpPkt3'),
  listSet(eid(), 'Punkte speichern 0', 'MpPunkte', 0, '${MpPkt0}'), listSet(eid(), 'Punkte speichern 1', 'MpPunkte', 1, '${MpPkt1}'),
  listSet(eid(), 'Punkte speichern 2', 'MpPunkte', 2, '${MpPkt2}'), listSet(eid(), 'Punkte speichern 3', 'MpPunkte', 3, '${MpPkt3}'),
  recGet(eid(), 'Pkt-Slot lesen', '${i}', 'slot', 'Var_SlotTmp'),
  recGet(eid(), 'Pkt-Farbe lesen', '${i}', 'colorIdx', 'Var_PColor')
];

// ── Spielspezifische Tasks (Hooks des Skeletts) ──
const gameTasks = [
  { name: 'MpPacken', description: 'Host: Figurenliste und Spielstand verpacken.', triggerMode: 'local-sync', params: [], id: eid(),
    actionSequence: [
      forI(0, 15, [act('Slot-Wert lesen'), act('Slot speichern'), act('Moveable-Flag lesen'), act('Moveable speichern')]),
      act('Daten packen')
    ] },
  { name: 'MpAnwenden', description: 'Gast: Host-Stand in die lokale Darstellung uebernehmen (Slots, Moveable, Zug, Wurf, Phase, Status).', triggerMode: 'local-sync', params: [], id: eid(),
    actionSequence: [
      act('Slots lesen'), act('Moveable lesen'), act('Spieler lesen'), act('Wurf lesen'), act('Anzahl lesen'), act('Status lesen'), act('Status uebernehmen'),
      forI(0, 15, [act('Slot laden'), act('Slot schreiben'), act('Moveable laden'), act('Moveable schreiben')]),
      cond('Var_Phase', '==', 'setup', [act('Wuerfel aus')], [act('Act_WurfBild')]),
      task('AlleFigurenPositionieren')
    ] },
  { name: 'MpIntentAusfuehren', description: 'Host: Absicht des aktiven Spielers validieren (Sitzplatz, Phase, Zugberechtigung) und autoritativ ausfuehren.', triggerMode: 'local-sync', params: [], id: eid(),
    actionSequence: [
      act('Intent-Art lesen'), act('Log Intent empfangen'),
      cond('IntentSeat', '==', '${Var_CurrPlayer}', [
        cond('IntentArt', '==', 'w', [cond('Var_Phase', '==', 'wurf', [task('Wuerfeln'), task('StandSenden')])]),
        cond('IntentArt', '==', 'f', [cond('Var_Phase', '==', 'pick', [act('Intent-Figur lesen'),
          cond('IntentFigur', '>=', '0', [cond('IntentFigur', '<=', '15', [
            act('Intent-Farbe lesen'), act('Intent-Moveable lesen'),
            cond('Var_PColor', '==', '${Var_CurrPlayer}', [
              cond('Var_MoveOk', '==', 'true', [act('Intent-Figur merken'), task('ZugAusfuehren'), task('StandSenden')])
            ])
          ])])
        ])])
      ])
    ] },
  { name: 'MpPunkteBerechnen', description: 'Spielstand fuer den MpKopf: Zielfiguren (Slot 40-55) je Farbe in MpPunkte schreiben.', triggerMode: 'local-sync', params: [], id: eid(),
    actionSequence: [
      act('Punkte zurueck'),
      forI(0, 15, [
        act('Pkt-Slot lesen'), act('Pkt-Farbe lesen'),
        cond('Var_SlotTmp', '>=', 40, [
          cond('Var_PColor', '==', 0, [act('Pkt0 zaehlen')]),
          cond('Var_PColor', '==', 1, [act('Pkt1 zaehlen')]),
          cond('Var_PColor', '==', 2, [act('Pkt2 zaehlen')]),
          cond('Var_PColor', '==', 3, [act('Pkt3 zaehlen')])
        ])
      ]),
      act('Punkte speichern 0'), act('Punkte speichern 1'), act('Punkte speichern 2'), act('Punkte speichern 3')
    ] },
  { name: 'MpLobby', description: 'Buttons/Labels je nach Phase, Rolle und Zugberechtigung.', triggerMode: 'local-sync', params: [], id: eid(),
    actionSequence: [
      task('MpPunkteBerechnen'),
      cond('Var_Phase', '==', 'setup', [
        cond('DuBistHost', '==', 'true', [
          cond('Mitglieder', '>=', '2', [act('Host-Lobby')], [act('Host-Lobby warten')])
        ], [act('Gast-Lobby')])
      ], [
        act('WahlLabel aus'),
        cond('Var_Phase', '==', 'wurf', [
          cond('Var_CurrPlayer', '==', '${MeinSitz}', [act('Wuerfeln zeigen')], [act('Wuerfeln verbergen')])
        ], [act('Wuerfeln verbergen')]),
        cond('DuBistHost', '==', 'true', [act('Neustart zeigen')], [act('Neustart verbergen')])
      ])
    ] },
  { name: 'StartKlick', description: 'StartBtn: MP-Host startet die Partie ab 2 Mitspielern (Spielerzahl = Partiegroesse).', triggerMode: 'local-sync', params: [], id: eid(),
    actionSequence: [
      cond('MpAktiv', '==', 'true', [
        cond('DuBistHost', '==', 'true', [
          cond('Var_Phase', '==', 'setup', [
            cond('Mitglieder', '>=', '2', [
              act('Spielerzahl aus Partie'), task('SpielStarten'), task('StandSenden'), task('OberflaecheAktualisieren')
            ], [act('Warten anzeigen')])
          ])
        ])
      ])
    ] },
  { name: 'LokalStarten', description: 'Lokaler Modus (kein CMS-Launch): originaler Hotseat-Dialog zur Spielerzahl.', triggerMode: 'local-sync', params: [], id: eid(),
    actionSequence: [act('SP-Setup')] }
];

// ── Skelett injizieren ──
skel.injectSkeleton(p, {
  idPrefix: 'mdr', seatCount: 4, heartbeat: 500, varStyle: 'variables',
  stage: 'main', statusProp: 'StatusLabel.text', phaseVar: 'Var_Phase',
  // MP-Chrome: Mitgliederleiste oben (freie Zone y0-1), Anweisungszeile unten (y38-39)
  chrome: { kopf: { dock: 'top', size: 2 }, status: { dock: 'bottom', size: 2 }, turn: 'Var_CurrPlayer', lobbyPhase: 'setup', grid: { w: 65, h: 40 } },
  hooks: { pack: 'MpPacken', apply: 'MpAnwenden', intentExec: 'MpIntentAusfuehren', lobby: 'MpLobby', localStart: 'LokalStarten' },
  roleSeq: [
    cond('MeinSitz', '==', '0', [act('Farbe Rot')]),
    cond('MeinSitz', '==', '1', [act('Farbe Blau')]),
    cond('MeinSitz', '==', '2', [act('Farbe Gruen')]),
    cond('MeinSitz', '==', '3', [act('Farbe Gelb')]),
    act('Sitz anzeigen')
  ],
  intentPack: [act('Intent packen')],
  logActions: { version: 'Log Version', isend: 'Log Intent senden' },
  inputs: [{
    name: 'WuerfelnKlick', match: 'WuerfelnBtn', events: ['onClick'],
    description: 'Wuerfel-Button: MP nur im eigenen Zug (Host wuerfelt lokal, Gast sendet die Absicht); lokal direkt.',
    prelude: [act('Log Wuerfelklick')],
    phase: { variable: 'Var_Phase', operator: '==', value: 'wurf' },
    turn: { currVar: 'Var_CurrPlayer', playerVar: 'MeinSitz' },
    local: 'Wuerfeln',
    intent: [act('Intent Wuerfeln')],
    hostTail: [task('OberflaecheAktualisieren')]
  }],
  vars: gameVars,
  objects: [
    { className: 'TButton', id: eid(), name: 'StartBtn', scope: 'stage', draggable: false, droppable: false, dragMode: 'move',
      events: { onClick: 'StartKlick' }, visible: false, x: 36, y: 12, width: 7, height: 3, zIndex: 0, rotation: 0, align: 'NONE', collisionEnabled: false,
      style: { ...btnStyle }, text: 'Partie starten', icon: '' },
    { className: 'TLabel', id: eid(), name: 'SitzLabel', scope: 'stage', draggable: false, droppable: false, dragMode: 'move',
      visible: true, x: 36, y: 32, width: 20, height: 2, zIndex: 0, rotation: 0, align: 'NONE', collisionEnabled: false,
      style: { ...labelStyle }, text: '' },
    h.listVar(eid(), 'SyncSlots', new Array(16).fill(-1), 58, 4),
    h.listVar(eid(), 'SyncMov', new Array(16).fill(false), 58, 7)
  ],
  actions: gameActions,
  tasks: gameTasks
});

// ── Chirurgische Verzweigungen in Original-Tasks ──
// FigurGewaehlt: Das Original braucht self-Kontext (geklickte Figur) fuer
// Act_ClickIdx/Act_ClickColor/Act_ClickMov — daher kein Dispatcher, sondern
// eine Modus-Verzweigung an der innersten Stelle (unter Var_MoveOk).
const figurTask = T('FigurGewaehlt');
const pickCond = figurTask.actionSequence[0];
const colorCond = pickCond.body.find(i => i.type === 'condition');
const moveCond = colorCond.body.find(i => i.type === 'condition');
moveCond.body = [cond('MpAktiv', '==', 'true', [
  cond('Var_CurrPlayer', '==', '${MeinSitz}', [
    cond('DuBistHost', '==', 'true', [task('ZugAusfuehren'), task('StandSenden'), task('OberflaecheAktualisieren')],
      [act('Log Figurklick'), act('Intent Figur'), task('IntentAbsenden')])
  ])
], [task('ZugAusfuehren')])];

// Neustart: im MP-Modus Host-only + verteilen; lokal wie gehabt.
const neustart = T('Neustart');
const neustartOrig = neustart.actionSequence;
neustart.actionSequence = [cond('MpAktiv', '==', 'true', [
  cond('DuBistHost', '==', 'true', [...neustartOrig, task('StandSenden'), task('OberflaecheAktualisieren')])
], neustartOrig)];

// Spielerzahl-Buttons: nur im lokalen Modus wirksam (in MP gilt die Partiegroesse).
for (const tn of ['Anzahl2', 'Anzahl3', 'Anzahl4']) {
  const t = T(tn);
  t.actionSequence = [cond('MpAktiv', '==', 'false', t.actionSequence)];
}

fs.writeFileSync(path.join(dir, 'Madn-Remote.json'), JSON.stringify(p, null, 1));
console.log('Madn-Remote.json geschrieben:', main.objects.length, 'Objekte,', main.actions.length, 'Aktionen,', main.tasks.length, 'Tasks,', (main.variables || []).length, 'Variablen.');

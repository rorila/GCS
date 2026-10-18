// Erzeugt ElinsMemoryRemote.json aus ElinsMemory.json — EINE Datei fuer beide
// Modi: im CMS als Mehrspielpartie (host-autoritativ ueber TCmsLiveSync),
// standalone als lokales Hotseat-Memory (MpAktiv=false, Dispatcher ruft die
// Original-Tasks direkt).
// Der komplette Sync-Apparat kommt aus scripts/mp/mp-skeleton.cjs; dieses
// Skript liefert nur die spielspezifischen Hook-Tasks:
//   MpPacken            -> Stand verpacken (Sichtbarkeit + Bild aufgedeckter
//                          Karten; matchIndex/List_15 verlassen den Host nie)
//   MpAnwenden          -> Gast uebernimmt Stand (inkl. Flip-Animationen)
//   MpIntentAusfuehren  -> Host validiert/ausfuehrt Karten-Absicht
//   MpLobby             -> Lobby-/Zug-Anzeige
//   LokalStarten        -> Hotseat-Start ohne CMS-Partie
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'game-server', 'public', 'projects');
const src = JSON.parse(fs.readFileSync(path.join(dir, 'ElinsMemory.json'), 'utf8'));
const p = JSON.parse(JSON.stringify(src));
const skel = require('./mp/mp-skeleton.cjs');
const h = skel.makeHelpers();
const { id, cond, act, task, forI, prop, mapGet, listGet, listSet, calc, call } = h;
const eid = () => id('emr');

p.meta = { ...p.meta, id: 'elins-memory-remote', name: 'ElinsMemoryRemote', version: '1.0.0',
  description: 'Elins Memory fuer 2 Spieler — im CMS als Partie (host-autoritativ, TCmsLiveSync), standalone als lokales Hotseat-Spiel. Das Deck verlaesst den Host nicht: Gaeste erhalten nur Sichtbarkeit und Bilder aufgedeckter Karten; Absichten werden als Intents validiert.',
  _sourcePath: 'projects/ElinsMemoryRemote.json', multiplayer: { minPlayers: 2, maxPlayers: 2, scope: 'house' } };

const main = p.stages.find(s => s.type === 'main');
const O = n => main.objects.find(o => o.name === n);
const T = n => main.tasks.find(t => t.name === n);

// ── Oberflaeche: Buttons/Events auf Dispatcher-/MP-Tasks umhaengen ──
O('MischenBtn').visible = false;
O('MischenBtn').events = { onClick: 'PartieStarten', onTouchStart: 'PartieStarten' };
O('Payer1Image').events = { onClick: 'Beginner1Klick', onTouchStart: 'Beginner1Klick' };
O('Payer2Image').events = { onClick: 'Beginner2Klick', onTouchStart: 'Beginner2Klick' };
const btnStyle = O('MischenBtn').style, labelStyle = O('ErgebnisLabel').style;
const V = h.Vo; // TVariable-Konvention dieser Datei

// ── Spielspezifische Variablen (Standard-/Launch-Vars kommen vom Skelett) ──
const gameVars = [
  V.i(eid(), 'MeineNr', 0), V.i(eid(), 'IntentKarte', -1), V.i(eid(), 'IntentSpieler'),
  V.i(eid(), 'Var_KarteIdx', -1), V.s(eid(), 'Var_KarteName'), V.s(eid(), 'Var_KarteObjekt'),
  V.i(eid(), 'SichtTmp'), V.s(eid(), 'BildTmp'), V.b(eid(), 'SelTmp'), V.b(eid(), 'MatTmp'),
  V.b(eid(), 'TmpSel'), V.b(eid(), 'TmpMat'), V.i(eid(), 'TmpMatch'), V.i(eid(), 'AltSicht'),
  V.i(eid(), 'P1Tmp'), V.i(eid(), 'P2Tmp'), V.b(eid(), 'TimerAn'),
  V.s(eid(), 'Var_Phase', 'lobby')
];

// ── Spielspezifische Actions ──
const recGet = (i, name, target, field, res) => ({ id: i, name, type: 'record_get', target, list: 'MemoryCardsList', field, resultVariable: res });
const recSet = (i, name, target, field, value) => ({ id: i, name, type: 'record_set', target, list: 'MemoryCardsList', field, value });
const gameActions = [
  calc(eid(), 'Spielernummer berechnen', 'MeinSitz+1', 'MeineNr'),
  // Stand verpacken (nur Host): Sichtbarkeit je Karte + Bild nur bei aufgedeckt
  recGet(eid(), 'Sel lesen', '${i}', 'isSelected', 'TmpSel'),
  recGet(eid(), 'Mat lesen', '${i}', 'isMatched', 'TmpMat'),
  recGet(eid(), 'MatchIdx lesen', '${i}', 'matchIndex', 'TmpMatch'),
  prop(eid(), 'Sicht Paar', { SichtTmp: 2 }), prop(eid(), 'Sicht Offen', { SichtTmp: 1 }), prop(eid(), 'Sicht Zu', { SichtTmp: 0 }),
  listGet(eid(), 'Bild lesen', 'List_15', '${TmpMatch}', 'BildTmp'),
  prop(eid(), 'Bild leer', { BildTmp: '' }),
  prop(eid(), 'Timer lesen', { TimerAn: '${CardFlipTimer.enabled}' }),
  listSet(eid(), 'Sicht speichern', 'SyncSicht', '${i}', '${SichtTmp}'),
  listSet(eid(), 'Bild speichern', 'SyncBild', '${i}', '${BildTmp}'),
  calc(eid(), 'Daten packen', '[SyncSicht,SyncBild,Var_CurrPlayer,Player1Score.value,Player2Score.value,Var_MatchCounter,ErgebnisLabel.text]', 'SyncData'),
  // Stand anwenden (nur Gast)
  listGet(eid(), 'Sicht lesen', 'LiveData', '0', 'SyncSicht'),
  listGet(eid(), 'Bilder lesen', 'LiveData', '1', 'SyncBild'),
  listGet(eid(), 'Spieler lesen', 'LiveData', '2', 'Var_CurrPlayer'),
  listGet(eid(), 'Punkte1 lesen', 'LiveData', '3', 'P1Tmp'),
  listGet(eid(), 'Punkte2 lesen', 'LiveData', '4', 'P2Tmp'),
  listGet(eid(), 'Paare lesen', 'LiveData', '5', 'Var_MatchCounter'),
  listGet(eid(), 'Ergebnis lesen', 'LiveData', '6', 'StatusText'),
  prop(eid(), 'Ergebnis uebernehmen', { 'ErgebnisLabel.text': '${StatusText}', 'Player1Score.value': '${P1Tmp}', 'Player2Score.value': '${P2Tmp}' }),
  listGet(eid(), 'Sicht laden', 'SyncSicht', '${i}', 'SichtTmp'),
  listGet(eid(), 'Bild laden', 'SyncBild', '${i}', 'BildTmp'),
  listGet(eid(), 'Kartenname lesen', 'MemoryCardsList', '${i}', 'Var_KarteName', { field: 'name' }),
  prop(eid(), 'Sel wahr', { SelTmp: true }), prop(eid(), 'Sel falsch', { SelTmp: false }),
  prop(eid(), 'Mat wahr', { MatTmp: true }), prop(eid(), 'Mat falsch', { MatTmp: false }),
  recGet(eid(), 'Alt-Sel lesen', '${i}', 'isSelected', 'TmpSel'),
  recGet(eid(), 'Alt-Mat lesen', '${i}', 'isMatched', 'TmpMat'),
  prop(eid(), 'AltSicht Paar', { AltSicht: 2 }), prop(eid(), 'AltSicht Offen', { AltSicht: 1 }), prop(eid(), 'AltSicht Zu', { AltSicht: 0 }),
  recSet(eid(), 'Sel schreiben', '${i}', 'isSelected', '${SelTmp}'),
  recSet(eid(), 'Mat schreiben', '${i}', 'isMatched', '${MatTmp}'),
  prop(eid(), 'Karte verdecken', { '${Var_KarteName}.src': '${BackCardImage}' }),
  prop(eid(), 'Karte zeigen', { '${Var_KarteName}.src': '${BildTmp}' }),
  // Flip-Animation: midpointTask laeuft mit self = animiertes Objekt —
  // Gast-Midpoint liest das Bild ueber record_index aus SyncBild.
  { id: eid(), name: 'Karte aufdecken', type: 'animate', target: '${Var_KarteName}', effect: 'flip', duration: 1000, targetScale: 2, fragments: 9, spread: 120, degrees: 360, intensity: 15, height: 20, targetOpacity: 0, midpointTask: 'GastKarteAufdecken' },
  { id: eid(), name: 'Karte zudecken', type: 'animate', target: '${Var_KarteName}', effect: 'flip', duration: 1000, targetScale: 2, fragments: 9, spread: 120, degrees: 360, intensity: 15, height: 20, targetOpacity: 0, midpointTask: 'GastKarteZudecken' },
  { id: eid(), name: 'R-Karte aufdecken', type: 'animate', target: '${Var_KarteName}', effect: 'flip', duration: 1000, targetScale: 2, fragments: 9, spread: 120, degrees: 360, intensity: 15, height: 20, targetOpacity: 0, midpointTask: 'SetFrontImage' },
  prop(eid(), 'Gast-Bild zeigen', { 'self.src': '${Var_CurrImagePath}' }),
  prop(eid(), 'Gast-Bild verdecken', { 'self.src': '${BackCardImage}' }),
  listGet(eid(), 'Gast-Bild lesen', 'SyncBild', '${Var_CurrListIndex}', 'Var_CurrImagePath'),
  // Intents (Gast -> Host): [karteIndex]
  prop(eid(), 'Intent Karte', { IntentKarte: '${Var_CurrListIndex}' }),
  calc(eid(), 'Intent packen', '[Var_CurrListIndex]', 'IntentData'),
  calc(eid(), 'Intent-Spieler berechnen', 'IntentSeat+1', 'IntentSpieler'),
  listGet(eid(), 'Intent-Karte lesen', 'IntentData', '0', 'IntentKarte'),
  // Index-/Objekt-Zwillinge der self-Kette (Host wendet Gast-Klicks an)
  recGet(eid(), 'R-Sel lesen', '${Var_KarteIdx}', 'isSelected', 'Var_IsCardSelected'),
  recGet(eid(), 'R-Mat lesen', '${Var_KarteIdx}', 'isMatched', 'Var_IsCardMatched'),
  recGet(eid(), 'R-MatchIdx lesen', '${Var_KarteIdx}', 'matchIndex', 'Var_CurrCardMatchValue'),
  listGet(eid(), 'R-Name lesen', 'MemoryCardsList', '${Var_KarteIdx}', 'Var_KarteName', { field: 'name' }),
  prop(eid(), 'R-Karte merken', { 'Var_KarteIdx': '${IntentKarte}' }),
  recSet(eid(), 'R-Karte waehlen', '${Var_KarteIdx}', 'isSelected', true),
  listGet(eid(), 'R-Bild lesen', 'List_15', '${Var_CurrCardMatchValue}', 'Var_CurrImagePath'),
  prop(eid(), 'R-Bild zeigen', { '${Var_KarteName}.src': '${Var_CurrImagePath}' }),
  prop(eid(), 'R-Index merken', { 'Var_CurrListIndex': '${Var_KarteIdx}' }),
  // Oberflaeche / Lobby
  prop(eid(), 'Host-Lobby', { 'LobbyLabel.visible': true, 'LobbyLabel.text': 'Gastgeber: „Spiel starten“ mischt das Deck und beginnt die Partie (${Mitglieder} Spieler).', 'StartBtn.visible': true, 'MischenBtn.visible': false }),
  prop(eid(), 'Host-Lobby warten', { 'LobbyLabel.visible': true, 'LobbyLabel.text': 'Gastgeber: Warte auf Mitspieler (${Mitglieder}/2) …', 'StartBtn.visible': false, 'MischenBtn.visible': false }),
  prop(eid(), 'Gast-Lobby', { 'LobbyLabel.visible': true, 'LobbyLabel.text': 'Du bist Spieler 2 — warte, bis der Gastgeber das Spiel startet.', 'StartBtn.visible': false, 'MischenBtn.visible': false }),
  prop(eid(), 'Mischen zeigen', { 'MischenBtn.visible': true, 'StartBtn.visible': false }),
  prop(eid(), 'Mischen aus', { 'MischenBtn.visible': false, 'StartBtn.visible': false }),
  prop(eid(), 'Zug-Text an', { 'LobbyLabel.visible': true, 'LobbyLabel.text': 'Du bist am Zug — wähle zwei Karten.' }),
  prop(eid(), 'Zug-Text aus', { 'LobbyLabel.visible': true, 'LobbyLabel.text': 'Der andere Spieler ist am Zug …' }),
  prop(eid(), 'Phase wahl', { 'Var_Phase': 'wahl', 'ErgebnisLabel.text': 'Gastgeber wählt den Beginner (Spielerbild klicken).' }),
  prop(eid(), 'Phase wahl lokal', { 'Var_Phase': 'wahl', 'ErgebnisLabel.text': '' }),
  prop(eid(), 'SP-Oberflaeche', { 'LobbyLabel.visible': false, 'MischenBtn.visible': true, 'StartBtn.visible': false }),
  // Diagnose: landet ohne TToast in der Browser-Konsole des Spielfensters
  call(eid(), 'Log Version', 'Toaster', 'show', ['ElinsMemory-Remote ${BuildVersion} | sitz=${MeinSitz} nr=${MeineNr} host=${DuBistHost} mitglieder=${Mitglieder}', 'info']),
  call(eid(), 'Log Kartenklick', 'Toaster', 'show', ['KKLICK karte=${Var_CurrListIndex} phase=${Var_Phase} curr=${Var_CurrPlayer} nr=${MeineNr} host=${DuBistHost} frei=${Var_SelectIsFree}', 'info']),
  call(eid(), 'Log Intent senden', 'Toaster', 'show', ['ISEND karte=${Var_CurrListIndex} lastSeq=${LastSeq}', 'info']),
  call(eid(), 'Log Intent empfangen', 'Toaster', 'show', ['IEMPF seq=${IntentSeq} seat=${IntentSeat} karte=${IntentKarte} | phase=${Var_Phase} curr=${Var_CurrPlayer}', 'info'])
];

// ── Spielspezifische Tasks (Hooks des Skeletts) ──
const gameTasks = [
  { name: 'MpPacken', description: 'Host: Karten-Stati, Punkte und Zug verpacken (nur Sichtbarkeit + Bild aufgedeckter Karten — Deckgeheimnis).', triggerMode: 'local-sync', params: [], id: eid(),
    actionSequence: [
      act('Timer lesen'),
      forI(0, 19, [
        act('Sel lesen'), act('Mat lesen'), act('MatchIdx lesen'),
        cond('TmpMat', '==', 'true', [act('Sicht Paar')], [cond('TmpSel', '==', 'true', [act('Sicht Offen')], [act('Sicht Zu')])]),
        // Nichttreffer-Fenster: Die Auswahl wurde schon zurueckgesetzt, die Karten
        // zeigen aber noch die Vorderseite (Flipback laeuft). Beide betroffenen
        // Karten gelten fuer die Dauer des Timers als aufgedeckt.
        cond('SichtTmp', '==', '0', [
          cond('TimerAn', '==', 'true', [
            cond('i', '==', '${Var_FirstListIndex}', [act('Sicht Offen')], [
              cond('i', '==', '${Var_SecondListIndex}', [act('Sicht Offen')])])
          ])
        ]),
        cond('SichtTmp', '>', '0', [act('Bild lesen')], [act('Bild leer')]),
        act('Sicht speichern'), act('Bild speichern')
      ]),
      act('Daten packen')
    ] },
  { name: 'MpAnwenden', description: 'Gast: Host-Stand in die lokale Darstellung uebernehmen (inkl. Flip-Animationen bei Zustandswechseln).', triggerMode: 'local-sync', params: [], id: eid(),
    actionSequence: [
      act('Sicht lesen'), act('Bilder lesen'), act('Spieler lesen'), act('Punkte1 lesen'), act('Punkte2 lesen'), act('Paare lesen'), act('Ergebnis lesen'), act('Ergebnis uebernehmen'),
      forI(0, 19, [
        act('Sicht laden'), act('Bild laden'), act('Kartenname lesen'),
        // Vorherigen Sichtbarkeitszustand aus dem lokalen Record lesen,
        // damit nur echte Uebergaenge eine Flip-Animation ausloesen.
        act('Alt-Sel lesen'), act('Alt-Mat lesen'),
        cond('TmpMat', '==', 'true', [act('AltSicht Paar')], [cond('TmpSel', '==', 'true', [act('AltSicht Offen')], [act('AltSicht Zu')])]),
        cond('SichtTmp', '==', '1', [act('Sel wahr')], [act('Sel falsch')]),
        cond('SichtTmp', '==', '2', [act('Mat wahr')], [act('Mat falsch')]),
        act('Sel schreiben'), act('Mat schreiben'),
        cond('AltSicht', '==', '0', [cond('SichtTmp', '>', '0', [act('Karte aufdecken')])]),
        cond('AltSicht', '>', '0', [cond('SichtTmp', '==', '0', [act('Karte zudecken')], [act('Karte zeigen')])])
      ])
    ] },
  { name: 'MpIntentAusfuehren', description: 'Host: Karten-Absicht validieren (Phase, Auswahlregeln, Zugehoerigkeit) und ausfuehren.', triggerMode: 'local-sync', params: [], id: eid(),
    actionSequence: [
      act('Intent-Karte lesen'), act('Intent-Spieler berechnen'), act('Log Intent empfangen'),
      cond('Var_Phase', '==', 'wahl', [
        cond('Var_SelectIsFree', '==', 'true', [
          cond('IntentSpieler', '==', '${Var_CurrPlayer}', [
            task('RemoteKarteAnwenden'), task('StandSenden')
          ])
        ])
      ])
    ] },
  { name: 'RemoteKarteAnwenden', description: 'Host: Karte des Gastes indexbasiert pruefen und aufdecken (Index-Zwillinge der self-Kette).', triggerMode: 'local-sync', params: [], id: eid(),
    actionSequence: [
      act('R-Karte merken'),
      act('R-Sel lesen'), act('R-Mat lesen'), act('R-MatchIdx lesen'), act('R-Name lesen'), act('R-Index merken'),
      cond('Var_IsSecondCardShown', '==', 'true', [act('Act_SetIsThirdCardInfo')], [
        cond('Var_IsCardMatched', '==', 'true', [act('Act_SetIsMatchedInfo')], [
          cond('Var_IsFirstCardShown', '==', 'false', [
            cond('Var_IsCardSelected', '==', 'false', [
              act('R-Karte waehlen'),
              act('Act_SetIsFirstCardShownToTrue'),
              act('Act_SetFirstCardValue'),
              act('R-Karte aufdecken'),
              act('Act_SetFirstCardListIndex')
            ])
          ], [
            cond('Var_IsCardSelected', '==', 'false', [
              act('Act_SetSelectFreeToFalse'),
              act('R-Karte waehlen'),
              act('Act_SetIsSecondCardShownToTrue'),
              act('Act_SetSecondCardValue'),
              act('R-Karte aufdecken'),
              act('Act_SetSecondCardListIndex'),
              task('CheckResult')
            ])
          ])
        ])
      ])
    ] },
  { name: 'MpLobby', description: 'Lobby-/Spiel-UI je nach Phase und Rolle.', triggerMode: 'local-sync', params: [], id: eid(),
    actionSequence: [
      cond('Var_Phase', '==', 'lobby', [
        cond('DuBistHost', '==', 'true', [
          cond('Mitglieder', '>=', '2', [act('Host-Lobby')], [act('Host-Lobby warten')])
        ], [act('Gast-Lobby')])
      ], [
        cond('DuBistHost', '==', 'true', [act('Mischen zeigen')], [act('Mischen aus')]),
        cond('Var_CurrPlayer', '==', '${MeineNr}', [act('Zug-Text an')], [act('Zug-Text aus')])
      ])
    ] },
  { name: 'PartieStarten', description: 'StartBtn/MischenBtn: MP nur Host ab 2 Mitspielern, lokal sofort (Hotseat-Neustart).', triggerMode: 'local-sync', params: [], id: eid(),
    actionSequence: [
      cond('MpAktiv', '==', 'true', [
        cond('DuBistHost', '==', 'true', [
          cond('Mitglieder', '>=', '2', [
            task('KatenMischen'), act('Phase wahl'), task('StandSenden'), task('OberflaecheAktualisieren')
          ])
        ])
      ], [task('LokalStarten')])
    ] },
  { name: 'LokalStarten', description: 'Lokaler Modus (kein CMS-Launch): Deck mischen, Phase wahl, Hotseat-UI.', triggerMode: 'local-sync', params: [], id: eid(),
    actionSequence: [task('KatenMischen'), act('Phase wahl lokal'), act('SP-Oberflaeche')] },
  { name: 'Beginner1Klick', description: 'Spieler 1 als Beginner bestimmen (MP: nur Host; lokal: jeder).', triggerMode: 'local-sync', params: [], id: eid(),
    actionSequence: [cond('MpAktiv', '==', 'true', [cond('DuBistHost', '==', 'true', [task('SetBeginnerIsPlayer1'), task('StandSenden')])], [task('SetBeginnerIsPlayer1')])] },
  { name: 'Beginner2Klick', description: 'Spieler 2 als Beginner bestimmen (MP: nur Host; lokal: jeder).', triggerMode: 'local-sync', params: [], id: eid(),
    actionSequence: [cond('MpAktiv', '==', 'true', [cond('DuBistHost', '==', 'true', [task('SetBeginnerIsPlayer2'), task('StandSenden')])], [task('SetBeginnerIsPlayer2')])] },
  { name: 'GastKarteAufdecken', description: 'Flip-Midpoint beim Gast: self=Karte — Bildpfad aus dem uebertragenen Stand lesen (lokaler matchIndex ist nicht autoritativ).', triggerMode: 'local-sync', params: [], id: eid(),
    actionSequence: [act('Act_GetListIndex'), act('Gast-Bild lesen'), act('Gast-Bild zeigen')] },
  { name: 'GastKarteZudecken', description: 'Flip-Midpoint beim Gast: self=Karte — Rueckseite zeigen.', triggerMode: 'local-sync', params: [], id: eid(),
    actionSequence: [act('Gast-Bild verdecken')] }
];

// ── Skelett injizieren ──
skel.injectSkeleton(p, {
  idPrefix: 'emr', seatCount: 2, heartbeat: 500, varStyle: 'objects',
  statusProp: 'ErgebnisLabel.text', phaseVar: 'Var_Phase',
  hooks: { pack: 'MpPacken', apply: 'MpAnwenden', intentExec: 'MpIntentAusfuehren', lobby: 'MpLobby', localStart: 'LokalStarten' },
  roleSeq: [act('Spielernummer berechnen')],
  intentPack: [act('Intent packen')],
  logActions: { version: 'Log Version', isend: 'Log Intent senden' },
  inputs: [{
    name: 'KarteKlick', match: /^CardImage\d+$/, events: ['onClick', 'onTouchStart'],
    description: 'Kartenklick: Host wendet lokal an, Gast sendet die Absicht, lokal direkt.',
    prelude: [act('Act_GetListIndex'), act('Log Kartenklick')],
    phase: { variable: 'Var_Phase', operator: '==', value: 'wahl' },
    turn: { currVar: 'Var_CurrPlayer', playerVar: 'MeineNr' },
    local: 'GetCardValues',
    intent: [act('Intent Karte')]
  }],
  vars: gameVars,
  objects: [
    { className: 'TButton', id: eid(), name: 'StartBtn', scope: 'stage', draggable: false, droppable: false, dragMode: 'move',
      events: { onClick: 'PartieStarten', onTouchStart: 'PartieStarten' },
      visible: false, x: 35, y: 37, width: 12, height: 2, zIndex: 0, rotation: 0, align: 'NONE', collisionEnabled: false,
      style: { ...btnStyle }, text: '▶ Spiel starten' },
    { className: 'TLabel', id: eid(), name: 'LobbyLabel', scope: 'stage', draggable: false, droppable: false, dragMode: 'move',
      visible: false, x: 4, y: 40, width: 56, height: 2, zIndex: 0, rotation: 0, align: 'NONE', collisionEnabled: false,
      style: { ...labelStyle }, text: 'Verbinde mit der Partie …' },
    // Karten-Spiegel als TListVariable (resolveValue ueber .items — MADN-Konvention)
    h.listVar(eid(), 'SyncSicht', new Array(20).fill(0), 58, 4),
    h.listVar(eid(), 'SyncBild', new Array(20).fill(''), 58, 7)
  ],
  actions: gameActions,
  tasks: gameTasks
});

// ── Host-Heartbeat deckt Zustandsaenderungen ab; Timer-Flipback sendet nach ──
const flipback = T('LetTheCardsFlipToBack');
flipback.actionSequence.push(task('StandSenden'));

fs.writeFileSync(path.join(dir, 'ElinsMemoryRemote.json'), JSON.stringify(p, null, 1));
console.log('ElinsMemoryRemote.json geschrieben:', main.objects.length, 'Objekte,', main.actions.length, 'Aktionen,', main.tasks.length, 'Tasks.');

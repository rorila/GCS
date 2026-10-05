// Rundenbasiertes Multiplayer-Skelett fuer GCS-Projekte (TCmsLiveSync).
//
// Injiziert in die Haupt-Stage eines Einzelspieler-Projekts:
//   - Objekte:    TimerPoll (Heartbeat + Moduserkennung), TCmsLiveSync
//   - Variablen:  Launch-Trio (CMS_LAUNCH/PartyId/CMS_AUTO_PARTY in
//                 stage.variables — der Server injiziert nur dort),
//                 Rollen-/Sync-/Intent-Variablen, MpAktiv
//   - Actions:    LiveSync-Init, Poll, Antwort-/Push-Leser, Seq-/Sitz-
//                 Aufloesung, Stand/Intent senden, Modus- und Stop-Actions
//   - Tasks:      LiveSynchronisieren, LiveEmpfangen, EmpfangenAnwenden,
//                 RolleErmitteln, StandSenden, StandAnwenden,
//                 IntentAbsenden, IntentAnwenden, OberflaecheAktualisieren,
//                 VerbindungVerloren
//
// Spielspezifische Logik wird ueber Hook-Tasks angeschlossen:
//   hooks.pack        -> im Task StandSenden vor dem eigentlichen Senden
//                        (fuellt das positionale Daten-Array "SyncData")
//   hooks.apply       -> in StandAnwenden nach Tick-Guard/Daten lesen
//                        (Gast uebernimmt den Host-Stand lokal)
//   hooks.intentExec  -> in IntentAnwenden nach Seq-/Sitz-Aufloesung
//                        (Host validiert und fuehrt die Absicht aus)
//   hooks.lobby       -> OberflaecheAktualisieren (UI je nach Phase/Rolle)
//   hooks.localStart  -> einmalig im lokalen Modus (kein CMS-Launch):
//                        lokale Partie vorbereiten (z.B. mischen, Phase setzen)
//
// Dualer Modus: CMS_LAUNCH ist nur im CMS-Launch befuellt. Bleibt es leer,
// laeuft dieselbe Datei als lokales Hotseat-Spiel: MpAktiv=false, der
// Dispatcher ruft die Original-Tasks direkt (ohne Zug-Guard).
//
// Eingangs-Dispatcher (spec.inputs): verdrahten Objekt-Events auf einen
// neuen Task, der im MP-Modus zwischen lokalem Original-Task (Host) und
// Intent-Versand (Gast) verzweigt — Original-Tasks bleiben unveraendert.
//
//   dispatcherSeq:
//     [...prelude]                        // z.B. record_index lesen, Logs
//     cond(phase)                         // optionaler Phasen-Guard
//       cond(MpAktiv):
//         true : cond(turn curr==player):
//                  host -> [local, StandSenden]
//                  gast -> intent-Seq
//         false: [local]                  // SP: kein Zug-Guard (Hotseat)
'use strict';

// ─── Bausteine ────────────────────────────────────────────────────────────

const makeHelpers = () => {
  let n = 0;
  const id = pfx => `${pfx}_${(++n).toString().padStart(3, '0')}`;
  const style = { color: '#000000', backgroundColor: '#d1c4e9', borderColor: '#9575cd', borderWidth: 1 };
  const base = { scope: 'stage', isVariable: true, isHiddenInRun: true, isManagedInSidepanel: true, draggable: false, droppable: false, dragMode: 'move', visible: true, width: 6, height: 2, zIndex: 0, rotation: 0, align: 'NONE', collisionEnabled: false, style };
  const listBase = { ...base, width: 5, style: {} };
  // '${Var}' auf der rechten Seite ist ein Variablenvergleich — als Literal
  // wertet der Evaluator ihn zu NaN aus und die Bedingung ist immer false.
  const cond = (variable, operator, value, body, elseBody = []) => {
    const m = typeof value === 'string' && value.match(/^\$\{(.+)\}$/);
    const condition = m ? { variable, operator, rightType: 'variable', rightValue: m[1] } : { variable, operator, value };
    return { type: 'condition', condition, body, elseBody };
  };
  return {
    id, style, base, listBase, cond,
    act: name => ({ type: 'action', name }),
    task: name => ({ type: 'task', name }),
    forI: (from, to, body) => ({ type: 'for', iteratorVar: 'i', from, to, body, name: 'for' }),
    prop: (i, name, changes) => ({ id: i, name, type: 'property', changes }),
    mapGet: (i, name, target, key, res) => ({ id: i, name, type: 'map_get', target, key, resultVariable: res }),
    mapSet: (i, name, target, key, value) => ({ id: i, name, type: 'map_set', target, key, value }),
    listGet: (i, name, target, index, res, extra = {}) => ({ id: i, name, type: 'list_get', target, index, resultVariable: res, ...extra }),
    listSet: (i, name, target, index, value) => ({ id: i, name, type: 'list_set', target, index, value }),
    calc: (i, name, formula, res) => ({ id: i, name, type: 'calculate', formula, resultVariable: res }),
    call: (i, name, target, method, params, res) => ({ id: i, name, type: 'call_method', target, method, params, resultVariable: res }),
    // Variablen im Typed-Format (stage.variables — MADN-Konvention)
    Vv: {
      s: (i, name, val = '') => ({ ...base, className: 'TStringVariable', id: i, name, type: 'string', defaultValue: '', value: val, objectModel: '' }),
      b: (i, name, val = false) => ({ ...base, className: 'TBooleanVariable', id: i, name, type: 'boolean', defaultValue: false, value: val }),
      i: (i, name, val = 0) => ({ ...base, className: 'TIntegerVariable', id: i, name, type: 'integer', defaultValue: 0, value: val, objectModel: '' }),
      o: (i, name) => ({ ...base, className: 'TObjectVariable', id: i, name, type: 'object', defaultValue: {}, value: null, objectModel: '' })
    },
    // Variablen als TVariable-Objekte in stage.objects (Memory-Konvention)
    Vo: {
      s: (i, name, val = '') => ({ ...base, className: 'TVariable', id: i, name, type: 'string', defaultValue: '', value: val, description: '' }),
      b: (i, name, val = false) => ({ ...base, className: 'TVariable', id: i, name, type: 'boolean', defaultValue: false, value: val, description: '' }),
      i: (i, name, val = 0) => ({ ...base, className: 'TVariable', id: i, name, type: 'integer', defaultValue: 0, value: val, description: '' }),
      o: (i, name) => ({ ...base, className: 'TVariable', id: i, name, type: 'object', defaultValue: null, value: null, description: '' })
    },
    listVar: (i, name, items, x = 58, y = 4) => ({ className: 'TListVariable', id: i, name, ...listBase, x, y, items, fields: [] })
  };
};

// ─── Skelett-Injektion ────────────────────────────────────────────────────

/**
 * @param {object} p      Projekt (wird veraendert)
 * @param {object} spec
 *   idPrefix    Praefix fuer generierte IDs (z.B. 'emr')
 *   stage       Stage-Selektor: id oder (s)=>bool — Standard: type==='main'
 *   seatCount   Sitzplaetze (IntentSeat-Aufloesung), Standard 2
 *   heartbeat   TimerPoll-Intervall ms, Standard 500
 *   varStyle    'objects' (TVariable-Objekte) | 'variables' (Typed-Vars)
 *   statusProp  Property fuer Hinweistexte, z.B. 'ErgebnisLabel.text'
 *   phaseVar    Name der Phasenvariable, Standard 'Var_Phase'
 *   hooks       { pack, apply, intentExec, lobby, localStart, roleLog? }
 *   chrome      optionales MP-Rahmenwerk (opt-in):
 *     kopf   { dock:'top'|'bottom'|'left'|'right', size } — Mitgliederleiste:
 *            pro Sitz ein Slot MpSpieler0..N-1 ('▶ Name · Punkte');
 *            Daten: MitgliedNamen (live), MpPunkte (positionales Array —
 *            das Spiel pflegt es), MpAmZug (Sitzindex des Ziehenden,
 *            -1 = kein Marker; z.B. bei PingPong nie setzen)
 *     status { dock, size } — Anweisungszeile MpStatusLabel mit kanonischen
 *            deutschen Texten; das Spiel setzt MpStatusKey:
 *            ''=auto (turn-gesteuert), 'waiting', 'ended', 'disconnected',
 *            'your-turn', 'opponent-turn' (mit MpStatusName),
 *            'custom' (mit MpStatusText)
 *     turn        Zug-Variable (z.B. 'Var_CurrPlayer') — fuellt MpAmZug und
 *                 die Auto-Statuszeile
 *     lobbyPhase  Wert von phaseVar in der Lobby (z.B. 'setup')
 *     grid        { w, h } Flaechenmass; Standard = max. Objektausdehnung
 *   roleSeq     zusaetzliche Schritte in RolleErmitteln (vor "Rolle merken")
 *   intentPack  Actions, die IntentData fuellen (vor dem Versand)
 *   logActions  { version?, isend?, iempf? } — vorhandene Log-Action-Namen
 *   inputs      Dispatcher-Spezifikationen (siehe oben)
 *   vars/objects/actions/tasks  spielspezifische Ergaenzungen
 */
function injectSkeleton(p, spec) {
  const h = makeHelpers();
  const id = s => h.id(`mps_${s}`); // eigener Praefix — keine Kollision mit spielseitigen IDs
  const { act, task, cond, forI, prop, mapGet, call, calc } = h;
  const seatCount = spec.seatCount || 2;
  const heartbeat = spec.heartbeat || 500;
  const phaseVar = spec.phaseVar || 'Var_Phase';
  const statusProp = spec.statusProp || 'StatusLabel.text';
  const hk = spec.hooks || {};
  const logs = spec.logActions || {};
  const V = spec.varStyle === 'variables' ? h.Vv : h.Vo;
  const chrome = spec.chrome || null;

  const main = p.stages.find(s => (typeof spec.stage === 'function' ? spec.stage(s) : spec.stage ? s.id === spec.stage : s.type === 'main'));
  if (!main) throw new Error('mp-skeleton: Haupt-Stage nicht gefunden');

  // Flaechenmass fuer Chrome-Docks: maximale Ausdehnung der SPIEL-Objekte
  // (vor jeder Injektion — Skelett-Service-Objekte duerfen das Bild nicht
  // verfaelschen). Chrome legt sich in eine freie Zone; es wird NICHTs
  // verschoben (Laufzeitpositionen z.B. aus FeldX/FeldY blieben sonst
  // unveraendert und das Layout risse auseinander).
  let gridW = 64, gridH = 40;
  if (chrome) {
    const ext = k => Math.max(0, ...main.objects.filter(o => typeof o[k] === 'number').map(o => o[k] + (o[k === 'x' ? 'width' : 'height'] || 0)));
    gridW = chrome.grid?.w || Math.max(1, ext('x'));
    gridH = chrome.grid?.h || Math.max(1, ext('y'));
  }

  // Spielmodi deklarieren: das Skelett erzeugt Partie- UND Hotseat-Pfade,
  // daher Default ['solo','party']. spec.modes kann einschraenken — ein
  // reines Party-Spiel ohne lokalen Modus setzt spec.modes:['party'].
  p.meta = p.meta || {};
  p.meta.modes = spec.modes || ['solo', 'party'];
  main.objects = main.objects || [];
  main.actions = main.actions || [];
  main.tasks = main.tasks || [];
  main.variables = main.variables || [];

  const btnStyle = (main.objects.find(o => o.className === 'TButton') || {}).style || {};
  const lblStyle = (main.objects.find(o => o.className === 'TLabel') || {}).style || {};

  // ── Objekte: TimerPoll + LiveSync ──
  // TimerPoll laeuft ab Start: er erkennt den lokalen Modus (kein CMS-Launch)
  // und dient im MP-Modus als Heartbeat-Fallback neben den Push-Updates.
  main.objects.push(
    {
      className: 'TTimer', id: id('timerpoll'), name: 'TimerPoll', scope: 'stage', isService: true, isHiddenInRun: true, draggable: false, droppable: false, dragMode: 'move',
      events: { onTimer: 'LiveSynchronisieren' }, visible: true, x: 1, y: 37, width: 3, height: 2, zIndex: 0, rotation: 0, align: 'NONE', collisionEnabled: false,
      style: { backgroundColor: '#4caf50', borderColor: '#2e7d32', borderWidth: 2 }, interval: heartbeat, enabled: true, maxInterval: 0, currentInterval: 0
    },
    {
      className: 'TCmsLiveSync', id: id('livesync'), name: 'LiveSync', scope: 'stage', isService: true, isHiddenInRun: true, draggable: false, droppable: false, dragMode: 'move',
      visible: true, x: 5, y: 37, width: 3, height: 2, zIndex: 0, rotation: 0, align: 'NONE', collisionEnabled: false, events: { onDisconnected: 'VerbindungVerloren', onLive: 'LiveEmpfangen' },
      style: { color: '#ffffff', backgroundColor: '#00838f', borderColor: '#005662', borderWidth: 2 }, launchKey: '', partyId: '', endpointPath: '/api/cms/party/live', enabled: false
    }
  );

  // ── Launch-Variablen: Server injiziert nur in stage.variables ──
  main.variables.push(
    { ...h.base, className: 'TStringVariable', id: id('var'), name: 'CMS_LAUNCH', type: 'string', defaultValue: '', value: '', objectModel: '' },
    { ...h.base, className: 'TStringVariable', id: id('var'), name: 'PartyId', type: 'string', defaultValue: '', value: '', objectModel: '' },
    { ...h.base, className: 'TBooleanVariable', id: id('var'), name: 'CMS_AUTO_PARTY', type: 'boolean', defaultValue: false, value: false, objectModel: '' }
  );

  // ── Standard-Variablen ──
  const stdVars = [
    V.b(id('var'), 'DuBistHost'), V.i(id('var'), 'MeinSitz', -1),
    V.i(id('var'), 'Mitglieder'), V.s(id('var'), 'PartyStatus'), V.s(id('var'), 'MitNamen'),
    V.b(id('var'), 'LiveOk'), V.b(id('var'), 'InitFertig'), V.b(id('var'), 'RollenInit'), V.b(id('var'), 'MpAktiv'),
    V.o(id('var'), 'LiveAntwort'), V.o(id('var'), 'LiveState'), V.o(id('var'), 'LiveData'),
    V.o(id('var'), 'FernEingabe'), V.o(id('var'), 'IntentData'), V.o(id('var'), 'MitgliedIds'),
    V.s(id('var'), 'FernBy'), V.s(id('var'), 'MitId'),
    V.i(id('var'), 'IntentSeat', -1), V.i(id('var'), 'IntentSeq'),
    V.i(id('var'), 'LetzterTick'), V.i(id('var'), 'NeuerTick'), V.i(id('var'), 'LastSeq'), V.i(id('var'), 'LetzterInputSeq'),
    V.o(id('var'), 'SyncData'), V.s(id('var'), 'StatusText'),
    V.s(id('var'), 'BuildVersion', `${spec.idPrefix}-` + new Date().toISOString().slice(0, 16).replace('T', '-'))
  ];
  // Chrome-Variablen (opt-in): Kopf-Daten + Status-Schluessel
  if (chrome) stdVars.push(
    V.i(id('var'), 'MpAmZug', -1), V.s(id('var'), 'MpStatusKey'), V.s(id('var'), 'MpStatusName'),
    V.s(id('var'), 'MpStatusText'), V.o(id('var'), 'MpPunkte'), V.o(id('var'), 'MitgliedNamen'),
    V.s(id('var'), 'MpNameS'), V.s(id('var'), 'MpPktS')
  );
  const varTarget = spec.varStyle === 'variables' ? main.variables : main.objects;
  varTarget.push(...stdVars, ...(spec.vars || []));

  // ── Standard-Actions ──
  const seatActs = [];
  for (let s = 0; s < seatCount; s++) seatActs.push(prop(id('act'), `Sitz ${s}`, { IntentSeat: s }));
  main.actions.push(
    prop(id('act'), 'LiveSync initialisieren', { 'LiveSync.launchKey': '${CMS_LAUNCH}', 'LiveSync.partyId': '${PartyId}', 'LiveSync.enabled': true, InitFertig: true, MpAktiv: true }),
    call(id('act'), 'Stand abrufen', 'LiveSync', 'poll', ['${LastSeq}'], 'LiveAntwort'),
    mapGet(id('act'), 'Antwort-Gueltigkeit lesen', 'LiveAntwort', 'ok', 'LiveOk'),
    mapGet(id('act'), 'Antwort-Host lesen', 'LiveAntwort', 'youAreHost', 'DuBistHost'),
    mapGet(id('act'), 'Antwort-Mitglieder lesen', 'LiveAntwort', 'memberCount', 'Mitglieder'),
    mapGet(id('act'), 'Antwort-Status lesen', 'LiveAntwort', 'status', 'PartyStatus'),
    mapGet(id('act'), 'Antwort-Seq lesen', 'LiveAntwort', 'lastSeq', 'LastSeq'),
    mapGet(id('act'), 'Antwort-Sitz lesen', 'LiveAntwort', 'seatIndex', 'MeinSitz'),
    mapGet(id('act'), 'Antwort-Mitglied-Ids lesen', 'LiveAntwort', 'memberIds', 'MitgliedIds'),
    mapGet(id('act'), 'Antwort-Namen lesen', 'LiveAntwort', 'memberNames', 'MitNamen'),
    ...(chrome ? [mapGet(id('act'), 'Antwort-Namen-Array lesen', 'LiveAntwort', 'memberNames', 'MitgliedNamen')] : []),
    mapGet(id('act'), 'Antwort-Stand lesen', 'LiveAntwort', 'live', 'LiveState'),
    mapGet(id('act'), 'Antwort-Fern lesen', 'LiveAntwort', 'remoteInput', 'FernEingabe'),
    prop(id('act'), 'Push-Daten lesen', { 'LastSeq': '${LiveSync.lastSeq}', 'Mitglieder': '${LiveSync.memberCount}', 'PartyStatus': '${LiveSync.partyStatus}', 'DuBistHost': '${LiveSync.youAreHost}', 'MeinSitz': '${LiveSync.seatIndex}', LiveOk: true }),
    mapGet(id('act'), 'Push-Stand lesen', 'LiveSync', 'live', 'LiveState'),
    mapGet(id('act'), 'Push-Fern lesen', 'LiveSync', 'remoteInput', 'FernEingabe'),
    mapGet(id('act'), 'Push-Ids lesen', 'LiveSync', 'memberIds', 'MitgliedIds'),
    mapGet(id('act'), 'Push-Namen lesen', 'LiveSync', 'memberNames', 'MitNamen'),
    ...(chrome ? [mapGet(id('act'), 'Push-Namen-Array lesen', 'LiveSync', 'memberNames', 'MitgliedNamen')] : []),
    prop(id('act'), 'Rolle merken', { RollenInit: true }),
    mapGet(id('act'), 'Tick lesen', 'LiveState', 'tick', 'NeuerTick'),
    prop(id('act'), 'Tick merken', { LetzterTick: '${NeuerTick}' }),
    mapGet(id('act'), 'Daten lesen', 'LiveState', 'data', 'LiveData'),
    prop(id('act'), 'Phase uebernehmen', { [phaseVar]: '${LiveState.phase}' }),
    call(id('act'), 'Stand senden', 'LiveSync', 'sendGameState', ['${SyncData}', '${' + phaseVar + '}', '${LastSeq}'], 'LiveAntwort'),
    call(id('act'), 'Intent senden', 'LiveSync', 'sendIntent', ['${IntentData}', '${LastSeq}'], 'LiveAntwort'),
    mapGet(id('act'), 'Intent-Seq lesen', 'FernEingabe', 'seq', 'IntentSeq'),
    prop(id('act'), 'Intent-Seq merken', { LetzterInputSeq: '${IntentSeq}' }),
    mapGet(id('act'), 'Absender lesen', 'FernEingabe', 'by', 'FernBy'),
    mapGet(id('act'), 'Intent lesen', 'FernEingabe', 'data', 'IntentData'),
    h.listGet(id('act'), 'Mitglied-Id lesen', 'MitgliedIds', '${i}', 'MitId'),
    ...seatActs,
    prop(id('act'), 'Sitz zurueck', { IntentSeat: -1 }),
    prop(id('act'), 'Lokalmodus aktivieren', { DuBistHost: true, MeinSitz: 0, RollenInit: true, 'TimerPoll.enabled': false,
      // Chrome gehoert zur Partie-Oberflaeche — im Hotseat ausblenden
      ...(chrome?.kopf ? Object.fromEntries(Array.from({ length: seatCount }, (_, s) => [`MpSpieler${s}.visible`, false])) : {}),
      ...(chrome?.status ? { 'MpStatusLabel.visible': false } : {}) }),
    prop(id('act'), 'Verbindungshinweis', { [statusProp]: 'Verbindung verloren — wird wiederhergestellt …', ...(chrome?.status ? { MpStatusKey: 'disconnected' } : {}) }),
    prop(id('act'), 'Spiel stoppen', { 'TimerPoll.enabled': false, [statusProp]: 'Partie beendet.', ...(chrome?.status ? { MpStatusKey: 'ended' } : {}) }),
    ...(spec.actions || [])
  );

  // ── Standard-Tasks ──
  const pollSeq = [act('Stand abrufen'), act('Antwort-Gueltigkeit lesen'),
    cond('LiveOk', '==', 'true', [act('Antwort-Host lesen'), act('Antwort-Mitglieder lesen'), act('Antwort-Status lesen'), act('Antwort-Seq lesen'), act('Antwort-Sitz lesen'), act('Antwort-Mitglied-Ids lesen'), act('Antwort-Namen lesen'), ...(chrome ? [act('Antwort-Namen-Array lesen')] : []), act('Antwort-Stand lesen'), act('Antwort-Fern lesen'), task('EmpfangenAnwenden')])];

  const seatConds = [];
  for (let s = 0; s < seatCount; s++) seatConds.push(cond('i', '==', String(s), [act(`Sitz ${s}`)]));

  main.tasks.push(
    {
      name: 'LiveSynchronisieren', description: 'TimerPoll: Moduserkennung (lokal vs. CMS-Launch), LiveSync-Initialisierung, Gast-Poll bzw. Host-Heartbeat.', triggerMode: 'local-sync', params: [], id: id('t_live'),
      actionSequence: [
        cond('CMS_LAUNCH', '==', '', [
          cond('RollenInit', '==', 'false', [act('Lokalmodus aktivieren'), task(hk.localStart)])
        ]),
        cond('PartyId', '!=', '', [cond('InitFertig', '==', 'false', [act('LiveSync initialisieren')])]),
        cond('InitFertig', '==', 'true', [
          cond('RollenInit', '==', 'true', [
            cond('DuBistHost', '==', 'true', [task('StandSenden')], pollSeq)
          ], pollSeq)
        ])
      ]
    },
    {
      name: 'LiveEmpfangen', description: 'onLive: Push-Staende sofort anwenden; beim Host eingehende Absichten validieren und ausfuehren.', triggerMode: 'local-sync', params: [], id: id('t_push'),
      actionSequence: [act('Push-Daten lesen'), act('Push-Stand lesen'), act('Push-Fern lesen'), act('Push-Ids lesen'), act('Push-Namen lesen'), ...(chrome ? [act('Push-Namen-Array lesen')] : []), task('EmpfangenAnwenden')]
    },
    {
      name: 'EmpfangenAnwenden', description: 'Gemeinsame Empfangslogik fuer Push und Poll: Rolleninit, Partiestatus, Gast-Stand, Host-Intents.', triggerMode: 'local-sync', params: [], id: id('t_recv'),
      actionSequence: [
        cond('RollenInit', '==', 'false', [task('RolleErmitteln')]),
        cond('PartyStatus', '==', 'ended', [act('Spiel stoppen')]),
        cond('PartyStatus', '!=', 'ended', [
          cond('DuBistHost', '==', 'true', [task('IntentAnwenden')], [task('StandAnwenden')]),
          task('OberflaecheAktualisieren')
        ])
      ]
    },
    {
      name: 'RolleErmitteln', description: 'Einmalig: Sitzplatz -> Rolle (spielspezifisch via roleSeq), Flag.', triggerMode: 'local-sync', params: [], id: id('t_rolle'),
      actionSequence: [
        cond('MeinSitz', '>=', '0', [
          ...(spec.roleSeq || []), act('Rolle merken'), ...(logs.version ? [act(logs.version)] : [])
        ])
      ]
    },
    {
      name: 'StandSenden', description: 'Host: Spielstand verpacken (MpPacken) und per sendGameState verteilen.', triggerMode: 'local-sync', params: [], id: id('t_send'),
      actionSequence: [task(hk.pack), act('Stand senden')]
    },
    {
      name: 'StandAnwenden', description: 'Gast: Neuen Host-Stand in die lokale Darstellung uebernehmen (MpAnwenden).', triggerMode: 'local-sync', params: [], id: id('t_apply'),
      actionSequence: [
        act('Tick lesen'),
        cond('NeuerTick', '>', '${LetzterTick}', [
          act('Tick merken'), act('Daten lesen'), act('Phase uebernehmen'), task(hk.apply)
        ])
      ]
    },
    {
      name: 'IntentAbsenden', description: 'Gast: Zug-Absicht packen (spielspezifisch) und an den Host senden.', triggerMode: 'local-sync', params: [], id: id('t_isend'),
      actionSequence: [...(spec.intentPack || []), ...(logs.isend ? [act(logs.isend)] : []), act('Intent senden')]
    },
    {
      name: 'IntentAnwenden', description: 'Host: Neue Absicht validieren (Seq, Absender -> Sitzplatz) und fachlich ausfuehren (MpIntentAusfuehren).', triggerMode: 'local-sync', params: [], id: id('t_iapply'),
      actionSequence: [
        act('Intent-Seq lesen'),
        cond('IntentSeq', '>', '${LetzterInputSeq}', [
          act('Intent-Seq merken'), act('Absender lesen'), act('Intent lesen'), act('Sitz zurueck'),
          forI(0, seatCount - 1, [act('Mitglied-Id lesen'),
            ...(logs.seat ? [act(logs.seat)] : []),
            cond('MitId', '==', '${FernBy}', seatConds)]),
          task(hk.intentExec)
        ])
      ]
    },
    {
      name: 'OberflaecheAktualisieren', description: 'Buttons/Labels je nach Phase, Rolle und Zugberechtigung (MpLobby); mit Chrome danach Kopfleiste und Statuszeile.', triggerMode: 'local-sync', params: [], id: id('t_ui'),
      actionSequence: [task(hk.lobby), ...(chrome?.kopf ? [task('MpKopfAktualisieren')] : []), ...(chrome?.status ? [task('MpStatusAnzeigen')] : [])]
    },
    {
      name: 'VerbindungVerloren', description: 'onDisconnected: Hinweis anzeigen; Partiestatus wird beim naechsten Poll/Push erneut geprueft.', triggerMode: 'local-sync', params: [], id: id('t_vb'),
      actionSequence: [act('Verbindungshinweis')]
    }
  );

  // ── Chrome (opt-in): MpKopf-Mitgliederleiste + MpStatus-Anweisungszeile ──
  // Belegt nur die gewaehlte Dock-Zone; es wird NICHTs verschoben — der
  // Entwickler waehlt einen Dock, der in das vorhandene Layout passt.
  if (chrome) {
    const rectOf = c => { const d = c.dock || 'top', s = c.size || 2;
      return d === 'top' ? { x: 0, y: 0, w: gridW, h: s }
        : d === 'bottom' ? { x: 0, y: gridH - s, w: gridW, h: s }
        : d === 'left' ? { x: 0, y: 0, w: s, h: gridH }
        : { x: gridW - s, y: 0, w: s, h: gridH }; };
    const fs0 = Math.min(16, lblStyle.fontSize || 14);
    const slotStyle = { color: '#eceff1', backgroundColor: '#37474f', fontSize: fs0, textAlign: 'center' };

    if (chrome.kopf) {
      const r = rectOf(chrome.kopf), vert = chrome.kopf.dock === 'left' || chrome.kopf.dock === 'right';
      for (let s = 0; s < seatCount; s++) {
        const sw = vert ? r.w : Math.floor(r.w / seatCount), sh = vert ? Math.floor(r.h / seatCount) : r.h;
        main.objects.push({
          className: 'TLabel', id: id('mpkopf'), name: 'MpSpieler' + s, scope: 'stage', draggable: false, droppable: false, dragMode: 'move',
          visible: true, x: vert ? r.x : r.x + s * sw, y: vert ? r.y + s * sh : r.y, width: sw, height: sh, zIndex: 5, rotation: 0, align: 'NONE', collisionEnabled: false,
          style: { ...slotStyle }, text: ''
        });
      }
      if (chrome.turn) main.actions.push(prop(id('act'), 'Zug lesen', { MpAmZug: '${' + chrome.turn + '}' }));
      for (let s = 0; s < seatCount; s++) main.actions.push(
        h.listGet(id('act'), `Kopf-Name ${s}`, 'MitgliedNamen', String(s), 'MpNameS'),
        h.listGet(id('act'), `Kopf-Punkte ${s}`, 'MpPunkte', String(s), 'MpPktS'),
        prop(id('act'), `Kopf ${s} markiert`, { [`MpSpieler${s}.text`]: '▶ ${MpNameS} · ${MpPktS}', [`MpSpieler${s}.style.backgroundColor`]: '#ffca28', [`MpSpieler${s}.style.color`]: '#212121' }),
        prop(id('act'), `Kopf ${s} normal`, { [`MpSpieler${s}.text`]: '${MpNameS} · ${MpPktS}', [`MpSpieler${s}.style.backgroundColor`]: '#37474f', [`MpSpieler${s}.style.color`]: '#eceff1' }),
        prop(id('act'), `Kopf ${s} frei`, { [`MpSpieler${s}.text`]: '— frei —', [`MpSpieler${s}.style.backgroundColor`]: '#263238', [`MpSpieler${s}.style.color`]: '#78909c' })
      );
      const seatSeq = [];
      for (let s = 0; s < seatCount; s++) {
        const mark = cond('MpAmZug', '==', String(s), [act(`Kopf ${s} markiert`)], [act(`Kopf ${s} normal`)]);
        seatSeq.push(act(`Kopf-Name ${s}`), act(`Kopf-Punkte ${s}`),
          cond('Mitglieder', '>', String(s),
            [chrome.lobbyPhase ? cond(phaseVar, '==', chrome.lobbyPhase, [act(`Kopf ${s} normal`)], [mark]) : mark],
            [act(`Kopf ${s} frei`)]));
      }
      main.tasks.push({
        name: 'MpKopfAktualisieren', description: 'Chrome: Mitgliederleiste — Namen/Punkte je Sitz, Zug-Markierung (ausser in der Lobby-Phase).', triggerMode: 'local-sync', params: [], id: id('t_kopf'),
        actionSequence: [...(chrome.turn ? [act('Zug lesen')] : []), ...seatSeq]
      });
    }

    if (chrome.status) {
      const r = rectOf(chrome.status);
      main.objects.push({
        className: 'TLabel', id: id('mpstatus'), name: 'MpStatusLabel', scope: 'stage', draggable: false, droppable: false, dragMode: 'move',
        visible: true, x: r.x, y: r.y, width: r.w, height: r.h, zIndex: 5, rotation: 0, align: 'NONE', collisionEnabled: false,
        style: { color: '#eceff1', backgroundColor: '#263238', fontSize: fs0, textAlign: 'center' }, text: ''
      });
      main.actions.push(
        prop(id('act'), 'Status Warten', { 'MpStatusLabel.text': 'Warte auf die anderen Spieler …' }),
        prop(id('act'), 'Status Dein Zug', { 'MpStatusLabel.text': 'Du bist am Zug!' }),
        prop(id('act'), 'Status Fremdzug', { 'MpStatusLabel.text': '${MpStatusName} ist am Zug' }),
        prop(id('act'), 'Status Ende', { 'MpStatusLabel.text': 'Partie beendet.' }),
        prop(id('act'), 'Status Getrennt', { 'MpStatusLabel.text': 'Verbindung verloren — warte kurz …' }),
        prop(id('act'), 'Status Freitext', { 'MpStatusLabel.text': '${MpStatusText}' }),
        ...(chrome.turn ? [h.listGet(id('act'), 'Zug-Name lesen', 'MitgliedNamen', '${' + chrome.turn + '}', 'MpStatusName')] : [])
      );
      const turnBranch = chrome.turn ? [
        cond(chrome.turn, '==', '${MeinSitz}', [act('Status Dein Zug')],
          [act('Zug-Name lesen'), act('Status Fremdzug')])
      ] : [];
      main.tasks.push({
        name: 'MpStatusAnzeigen', description: 'Chrome: Anweisungszeile — MpStatusKey schlaegt Auto-Modus; Auto leitet aus Partie-/Zugstatus ab.', triggerMode: 'local-sync', params: [], id: id('t_status'),
        actionSequence: [
          cond('PartyStatus', '==', 'ended', [act('Status Ende')], [
            cond('MpStatusKey', '!=', '', [
              cond('MpStatusKey', '==', 'waiting', [act('Status Warten')]),
              cond('MpStatusKey', '==', 'disconnected', [act('Status Getrennt')]),
              cond('MpStatusKey', '==', 'your-turn', [act('Status Dein Zug')]),
              cond('MpStatusKey', '==', 'opponent-turn', [act('Status Fremdzug')]),
              cond('MpStatusKey', '==', 'ended', [act('Status Ende')]),
              cond('MpStatusKey', '==', 'custom', [act('Status Freitext')])
            ], [
              ...(chrome.lobbyPhase ? [cond(phaseVar, '==', chrome.lobbyPhase, [act('Status Warten')], turnBranch)] : turnBranch)
            ])
          ])
        ]
      });
    }
  }

  // ── Eingangs-Dispatcher: Originalevents -> Modus-Verzweigung ──
  for (const inp of spec.inputs || []) {
    const mpBranch = [
      cond(inp.turn.currVar, '==', '${' + inp.turn.playerVar + '}', [
        cond('DuBistHost', '==', 'true',
          [task(inp.local), task('StandSenden'), ...(inp.hostTail || [])],
          [...(inp.intent || []), task('IntentAbsenden')])
      ])
    ];
    const modeBranch = cond('MpAktiv', '==', 'true', mpBranch, [task(inp.local)]);
    const seq = [...(inp.prelude || [])];
    seq.push(inp.phase
      ? cond(inp.phase.variable, inp.phase.operator || '==', inp.phase.value, [modeBranch])
      : modeBranch);
    main.tasks.push({
      name: inp.name, description: inp.description || `Dispatcher ${inp.name}: MP verzweigt Host (lokal) / Gast (Intent), SP ruft den Original-Task.`,
      triggerMode: 'local-sync', params: [], id: id('t_' + inp.name.toLowerCase()),
      actionSequence: seq
    });
    const evs = {}; for (const e of inp.events || ['onClick']) evs[e] = inp.name;
    for (const o of main.objects) {
      const hit = inp.match instanceof RegExp ? inp.match.test(o.name)
        : Array.isArray(inp.match) ? inp.match.includes(o.name) : o.name === inp.match;
      if (hit) o.events = { ...(o.events || {}), ...evs };
    }
  }

  // ── Spielspezifische Objekte/Tasks ──
  main.objects.push(...(spec.objects || []));
  main.tasks.push(...(spec.tasks || []));

  return { stage: main, helpers: h };
}

module.exports = { injectSkeleton, makeHelpers };

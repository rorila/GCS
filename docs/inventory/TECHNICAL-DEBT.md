# Technical Debt &amp; Unstimmigkeiten

> Zentrale Erfassung erkannter Inkonsistenzen aus der Dokumentationsanalyse (Phase 1, AP 0–3).
> **Regel:** Einträge werden dokumentiert, aber **nicht** ohne gesonderte Freigabe behoben.
> Analyse-Basis: Working Tree über Commit `53e3dfb` · Stand: 2026-10-17 · Devin (SWE-2 High)

## TD-001 — Doppelte Condition-Syntax

**Bereich:** Task-System (`TaskExecutor.executeSequenceItem`, Z. 779–804)
**Befund:** Verzweigungs-Items akzeptieren zwei parallele Feld-Paare — `then`/`else` (GCS-CMS) und `body`/`elseBody` (ElinsMemoryRemote, Kopfrechnen) sowie `thenTask`/`thenAction`/`elseTask`/`elseAction`. Beide sind gleichwertig, es gibt kein dokumentiertes kanonisches Format.
**Risiko:** Editor kann beide Formen erzeugen; Leser müssen alle Aliase kennen.
**Vorschlag:** kanonisches Format festlegen, Alt-Formate in einem späteren Migrationslauf normalisieren (Freigabe nötig).

## TD-002 — `condition`-Feld mit Doppelbedeutung

**Bereich:** `executeSequenceItem` (Z. 588–592)
**Befund:** Auf Items mit `type: 'condition'` ist `condition` die Verzweigungslogik; auf **allen anderen** Item-Typen wirkt ein String-`condition` (oder `itemCondition`) als impliziter Ausführungsfilter. Nicht dokumentiert, implizit.
**Risiko:** Verwirrung beim manuellen JSON-Edit; ein verschobenes `condition`-Feld ändert die Semantik je nach `type`.

## TD-003 — Veralteter Condition-Test (stale test) — **analysiert**

**Bereich:** `src/runtime/executor/TaskConditionEvaluator.test.ts`, `Kopfrechnen-App.json`
**Befund:** Test liest `Aufgabe_Ziehen.actionSequence[0].condition` und erwartet eine numerische Bedingung (`AufgabenNr >= Aufgaben`-Semantik). Tatsächlich enthält das Projekt dort `{variable: "Phase", operator: "==", value: "next"}` — das Spiel wurde auf Phasen-Steuerung umgebaut.
**Detailanalyse (2026-10-17):** Die 7 FAILs sind **Test-Fehler, kein Runtime-Bug**:
- Der Test injiziert `{AufgabenNr: N, Aufgaben: M}` als Vars — die geprüfte Condition referenziert aber `Phase` (unbelegt → `undefined`).
- `undefined == "next"` → `false` — **korrektes** Evaluator-Verhalten; die Erwartung (`true` bei „Abschluss") bezieht sich auf eine Condition, die es nicht mehr gibt.
- Die 20 verbleibenden Tests (`truthy`/`falsy`/`in`/`not in`/`==`/`!=`, inkl. Server-Semantik) sind alle grün — der Evaluator selbst ist nicht kaputt.
**Priorität:** niedrig (Testpflege), **Auswirkung:** falscher Alarm in CI. **Fix:** Test an neue Condition anpassen oder Projekt-Fixture pinnen — Freigabe nötig.

## TD-004 — Veraltete Stage-Zählung im CMS-Test

**Bereich:** `scripts/test-cms-stages.cjs`
**Befund:** Test erwartet hartkodiert `39 Surface + 14 Server Stages`; das Projekt hat aktuell `65 + 17 = 82`.
**Testlauf 2026-10-17:** Assertion-Fehler (stale Erwartung). FEAT-0001: `test fehlgeschlagen`.
**Bewertung:** stale Erwartung; zählt Stages statisch statt dynamisch.

## TD-005 — CMS-Verbindungstest mit Timeout

**Bereich:** `scripts/test-cms-connection.cjs`
**Befund:** Browser-Navigation hängt > 30 s, obwohl der Server auf HTTP-Ebene antwortet. Ursache unbekannt (möglicherweise Puppeteer/Navigation vs. laufender Dev-Server).
**Testlauf 2026-10-17:** Timeout. FEAT-0011: `test fehlgeschlagen`.
**Bewertung:** Ursache offen — könnte Infrastruktur-Problem sein; fachliche Prüfung offen.

## TD-006 — Registrierungs-Duplikate &amp; versteckte Action-Aliase

**Bereich:** `ActionRegistry` / `StandardActions.ts`
**Befund:** `action`↔`property` und `variable`↔`set_variable` sind vollständige Aliase; `navigate`, `execute_login_request`, `store_token`, `set_variable` sind `hidden` aber registriert. Editor-Nutzer sehen sie nicht, JSON kann sie aber verwenden.
**Risiko:** Bestands-JSONs können verborgene Typen referenzieren; Umbenennung bricht sie still.

## TD-007 — Debug-Logging-Artefakte in `ExpressionParser`

**Bereich:** `src/runtime/ExpressionParser.ts` (Z. 176–178, 187–189, 397–399, 458–460)
**Befund:** Hardcodierte `BIND-DEBUG`-Logs für Ausdrücke mit `StageTimer`, `currentInterval`, `BaseVar`, `availableVariableFields` — offensichtliche Entwicklungsreste.
**Risiko:** Log-Spam für diese Pfade; keine funktionale Auswirkung.

## TD-008 — Stage-Variablen überschatten globale (stillschweigend)

**Bereich:** `RuntimeVariableManager.createVariableContext` (Z. 234–235)
**Befund:** Lesezugriff `X` prüft zuerst `stageVariables`, dann `projectVariables` — Namenskollision liefert ohne Warnung den Stage-Wert. Zusätzlich `var_`-Prefix-Fuzzy-Match (Z. 253) und Auto-Anlage unbekannter Namen in `stageVariables` beim Schreiben (Z. 271–278).
**Risiko:** subtile Kollisionen ohne Fehlermeldung.

## TD-009 — `repeat`-Schleife: Editor-Element ohne Runtime — **Priorität: hoch**

**Bereich:** `src/editor/FlowToolbox.ts` (Z. 29), `src/editor/flow/FlowLoop.ts`, `src/editor/services/FlowNodeFactory.ts` (Z. 165), `src/runtime/TaskExecutor.ts`
**Befund:** Die FlowToolbox bietet „⏭️ Repeat Loop" (`type: 'repeat'`). `FlowNodeFactory` erzeugt daraus einen `FlowLoop` mit `loopType='Repeat'` — der Inspector zeigt für Repeat **keine** Eigenschaften (nur `WHILE`/`FOR`/`FOREACH` haben Sektionen), `updateVisuals` zeigt statisch „REPEAT UNTIL".
**Nachweis zur Laufzeit:** `TaskExecutor.executeSequenceItem` (Z. 673–685) kennt nur `while`/`for`/`foreach`. Ein `repeat`-Item fällt in den `default`-Zweig → `actionExecutor.execute(item)` → kein registrierter `repeat`-Handler → Warn-Log + No-op. `PascalCodeParser` kennt ebenfalls kein `REPEAT`. **Fazit: `repeat` ist zur Laufzeit wirkungslos — platzierte Knoten tun nichts.**
**Auswirkung:** Nutzer können tode Knoten bauen; evtl. werden sie auch gar nicht erst in die actionSequence synchronisiert (Flow-Sync prüft Loop-Typen nicht separat).

**Lösungsoptionen (Priorität 2 — noch nicht umgesetzt):**

| Option | Beschreibung | Rückwärtskompatibilität | Aufwand |
|---|---|---|---|
| **A — Aus der Toolbox entfernen** | `Repeat Loop`-Eintrag aus `FlowToolbox.ts` Z. 29 streichen; `FlowLoop`/`FlowNodeFactory` behalten den Code für Altprojekte. Zusätzlich: Warnung im Editor, wenn ein gespeichertes Projekt `repeat`-Items enthält. | **Voll kompatibel** — bisher nie funktionsfähig; nichts kann kaputtgehen. Altprojekte mit repeat-Knoten bleiben lesbar, warnen nur. | S (~20 Z.) |
| **B — Runtime-Semantik ergänzen** | `repeat`-Case in `TaskExecutor.executeSequenceItem` implementieren (`do { body } until(condition)` — Bedingung einmal nach Body prüfen). Loop-Limits wie bei `while` übernehmen. Inspector braucht dann noch eine Condition-Sektion (fehlt heute komplett). | **Kompatibel, aber Semantik-Neudefinition** — Projekte, die repeat visuell platziert haben, würden plötzlich **aktiv** — Verhalten ändert sich von „nichts" zu „läuft". Ggf. unerwünscht bei Altprojekten. | M (~100 Z. + Inspector + Pascal-Gen/-Parser + Tests) |
| **C — Durch `while` ersetzen (Migration)** | Editor bietet „Als While übernehmen" für Altprojekte an; `repeat` wird intern auf `while(!cond)` gemappt. | Kompatibel, wenn Migration explizit angestoßen wird. | M |

**Empfehlung:** **Option A** sofort (verhindert neue tote Knoten), Option B nur falls fachlich ein `repeat-until`-Bedarf besteht — bislang kein Projekt nutzt es.

## TD-010 — Pascal ↔ Flow Roundtrip verliert Strukturen — **Priorität: mittel**

**Bereich:** `src/editor/PascalCodeGenerator.ts` (Generator, 610 Z.) ↔ `src/editor/PascalCodeParser.ts` (Parser, 345 Z.), `src/editor/services/FlowPascalManager.ts`
**Befund:** Der Generator schreibt `WHILE … DO`, `FOR i := a TO b DO`, `FOR EACH x IN list DO`; der Parser liest nur `IF/THEN/ELSE`, `WHILE/DO`, `FOR var := <Zahl> TO <Zahl>` und einfache Statements.
**Konkrete Verluststellen (Pascal → Flow):**
- **`FOR EACH`**: Generator emittiert es (Z. 522), der `FOR`-Zweig des Parsers (Z. 226–246) erwartet `var := <int> TO <int>` — `FOR EACH x IN list DO` matched nicht → der Body kann als `for`-Item ohne `iteratorVar`/`from`/`to` zerfallen.
- **`FOR` mit Ausdrücken:** `forMatch`-Regex `:=\s*([0-9]+)\s+TO\s+([0-9]+)` akzeptiert nur Integer-Literale — `${Var}`-Grenzen oder `step` gehen verloren.
- **`WHILE` mit komplexer Condition:** `parseCondition` (Z. 270–283) unterstützt nur `=|<>|<|>|<=|>=` — `truthy`/`falsy`/`in`/`not in`/`${…}` werden zu `{variable: <ganzer String>, operator:'==', value:true}` → **semantisch falsch**.
- **`calculate`/`http`/etc. als Statements:** Nur `Obj.prop := v`, `Var := formula` und `Name()` werden geparst — andere Action-Typen (http, spawn, record_*) können nicht aus Pascal zurückgelesen werden.
- **Umbenennung:** `getLogicSignature` (nur Typsequenz) heuristisch — zwei strukturell gleiche Tasks können falsch zugeordnet werden.
**Auswirkung:** Pascal-Edit ist **nicht verlustfrei**; bei Roundtrip können Loops zerfallen und Bedingungen ihre Semantik verlieren. Bis geklärt: Pascal-View als *generierte Ansicht* betrachten, Rück-editieren nur für einfache Sequenzen.

**Lösungsoptionen (Priorität 2 — noch nicht umgesetzt):**

| Option | Beschreibung | Rückwärtskompatibilität | Aufwand |
|---|---|---|---|
| **A — Read-only-Anzeige** | Pascal-Panel als reine Ansicht deklarieren (Bearbeiten deaktiviert oder „Änderungen gehen verloren"-Hinweis). Kein Roundtrip mehr → kein Verlust. | **Voll kompatibel** — bestehende Flows unverändert; Pascal-Funktion bleibt als Dokumentation erhalten. | S |
| **B — Parser vervollständigen** | `FOR EACH`, `WHILE` mit allen Operatoren (`truthy`/`falsy`/`in`/`not in`), `FOR` mit Expressions/`STEP`, fehlende Action-Typen, `REPEAT` (falls TD-009 Option B) nachrüsten; `getLogicSignature` stärker eindeutig machen (Param-Hash statt nur Typsequenz). | Kompatibel für einfache Fälle; komplexe Flows werden **besser** roundtrip-fähig — Risiko: falsch-positive Zuordnung von Alt-Pascal-Texten, die bisher still fallengelassen wurden, könnte nun greifen. | L (~300+ Z. Parser, Generator-Anpassung, umfangreiche Roundtrip-Tests) |
| **C — Verlustwarnung beim Parse** | Parser protokolliert pro Zeile „übersprungen/vereinfacht" und zeigt dem Nutzer einen Diff-Report, bevor der Flow ersetzt wird („3 Anweisungen nicht übernommen: FOR EACH …"). Nutzer bestätigt explizit. | **Voll kompatibel** — kein automatischer Verlust mehr; Transparenz statt Stille. | M (~80 Z. Parser-Telemetrie + UI-Dialog) |
| **D — Maschinenlesbare Annotation** | Generator emittiert strukturierte Kommentare (`{* @item for iteratorVar=i …}`) — Parser rekonstruiert verlustfrei aus Metadaten statt aus der Pascal-Syntax. Pascal bleibt für Menschen lesbar, maschinell exakt. | Kompatibel — alte Pascal-Texte ohne Annotation fallen auf heutiges Verhalten zurück; neue Flows sind exakt. | M–L |

**Empfehlung:** kurzfristig **C** (unsichtbarer Datenverlust ist das Kernproblem — Nutzer erfahren davon nichts), mittelfristig **D** als eigentliche Lösung für verlustfreien Roundtrip; **B** nur falls Pascal als primäre Eingabesprache strategisch gewünscht ist.

## TD-011 — Toolbox deckt Runtime-Registry nicht ab — **Priorität: mittel**

**Bereich:** `public/editor/toolbox.json`, `toolbox_horizontal.json`, `src/services/ComponentRegistry.ts` (Editor) vs. `src/utils/ComponentRegistry.ts` (Runtime-Selbstregistrierung)
**Befund:** `TForEach`, `TOverlay`, `TSpeedlines` registrieren sich zur Laufzeit korrekt (`ComponentRegistry.register` am Dateiende), fehlen aber in `services/ComponentRegistry.ts` (Editor) **und** in beiden toolbox-JSONs.
**Nachweis:** `grep` zeigt Selbstregistrierung in allen drei Dateien; kein Eintrag in `toolbox.json`; Editor-Registry ohne die drei Typen.
**Auswirkung:** Diese Komponenten können nur per Hand-JSON oder über Generatoren (`scripts/cms/*`) ins Projekt gelangen — sie werden im Editor gerendert (Runtime-Registry), können aber nicht per UI platziert werden. `TInlineOverlay` ist demgegenüber korrekt verdrahtet (Toolbox „Overlays" + Editor-Registry).
**Vermutete Ursache:** die drei wurden für generierte Projekte ergänzt, ohne Toolbox/Editor-Registry nachzuziehen.

## TD-012 — Undo/Redo skaliert schlecht und lückenhaft — **Priorität: mittel**

**Bereich:** `src/editor/services/SnapshotManager.ts`, `src/services/ProjectStore.ts` (Z. 207–212)
**Befund:**
- Jede Mutation via `projectStore.dispatch` löst `pushSnapshot` mit **komplettem Deep-Clone** (`JSON.parse(JSON.stringify(project))`) aus — bei `GCS-CMS.json` (~4 MB) kostet jeder Snapshot ~4 MB serialisieren; `maxSnapshots=30` → **bis ~120 MB** Resident-Memory für den Undo-Stack.
- **500 ms Throttle:** aufeinanderfolgende Mutationen innerhalb 500 ms erzeugen **keinen** eigenen Snapshot — Undo springt dann über mehrere Änderungen zurück (grob, nicht falsch).
- `undo()`/`redo()` rufen `loadProject(snapshot)` → **komplettes Neu-Laden** des Projekts: Runtime-Referenzen, Selektion und ggf. UI-Status gehen verloren.
- `InspectorEventHandler` Z. 124 enthält **auskommentierten** direkten `pushSnapshot`-Aufruf — Inspector-Änderungen laufen korrekt über `dispatch`, der Kommentar ist historisch.
**Auswirkung:** Bei großen Projekten spürbare CPU-/Speicherlast pro Edit; schnelle Folge-Edits sind nicht einzeln rücknehmbar. Kein Datenverlust, aber UX-/Performance-Problem.

## TD-013 — `agent_call` über WebSocket ohne Authentifizierung — **Priorität: hoch (Sicherheit)**

**Bereich:** `game-server/src/websocket/roomManager.ts` (Z. 255–286), `game-server/src/server.ts`
**Befund:** Die WS-Message `agent_call` ruft beliebige `AGENT_METHODS` auf `project.json` auf — **inklusive schreibender** Methoden (`fs.writeFileSync` Z. 276 für nicht-readOnly-Methoden). **Keine** Token-/Session-Prüfung im Handler.
**Einordnung:** Der Game-Server bindet standardmäßig an `127.0.0.1` (`GCS_HOST`), sodass der Angriffsvektor lokal ist; bei `GCS_HOST=0.0.0.0` (bewusster LAN-Modus) ist er netzweit offen. Die HTTP-Seite sperrt `/api/agent` etc. bei `GCS_EDITOR_APIS=off` — **der WS-Pfad `agent_call` ist davon nicht abgedeckt** (Editor-Gate greift nur für HTTP).
**Auswirkung:** In geöffneter Konfiguration kann jeder WS-Client das Demo-Projekt `public/project.json` umschreiben. **Fix:** `agent_call` hinter `EDITOR_APIS_ENABLED` oder Auth hängen — Freigabe nötig.

---

## TD-014 — Projekt-Wizard verspricht Blueprint-Komponenten, die nie angelegt werden — **Priorität: mittel**

**Bereich:** `src/editor/dialogs/StageDialogs.ts` (Z. 448–458, Ergebnis-Schritt) vs.
`src/editor/EditorProjectFactory.ts` (`createProjectFromWizardData` Z. 183–206)
**Befund:** Der Ergebnis-Schritt des Projekt-Assistenten listet je nach Auswahl
`TGameServer`, `TStageController`, Variablen `score`/`lives` und **`TAudio`** als
„AgentController-Code" auf — die Factory legt tatsächlich nur an: `score`/`lives`
als Variablen und `TGameServer` bei `2net`. **Nicht angelegt werden:** `TAudio`
(Feature „Töne/Musik"), „Daten speichern", „Zeitsteuerung/Timer". `TStageController`
bei `multi`/`menu` ist harmlos, weil die Blueprint-Stage ohnehin immer einen
StageController enthält — die Vorschau verspricht ihn aber fälschlich als
„neu hinzugefügt".
**Auswirkung:** Anwender wählen z. B. „Töne/Musik" und finden kein Audio-Objekt
im Projekt — irritierend in Einsteiger-Handbüchern (siehe `docs/user-guide/kapitel-01`,
Stolpersteine). **Fix-Optionen:** (a) Factory um die fehlenden Erzeugungen
ergänzen, (b) Ergebnis-Vorschau auf tatsächlich angelegte Komponenten
beschränken — beides dokumentationsseitig bereits entschärft, Code-Fix braucht
Freigabe.

---

## Security — Multiplayer (zur späteren Prüfung vorgemerkt)

Quelle: `docs/reference/multiplayer-runtime.md` · `src/runtime/MultiplayerManager.ts`, `src/multiplayer/Protocol.ts`

| ID | Befund |
|---|---|
| SEC-MP-01 | **Keine Authentifizierung/Autorisierung im Protokoll** — Room-Code ist die einzige Zugangshürde; `join_room` mit beliebigem Code möglich |
| SEC-MP-02 | **Klartext-Websocket**, kein Message-Signing — Relayed-Messages werden nicht vom Server gegen den Raumkontext validiert |
| SEC-MP-03 | **`broadcast_action` / `trigger_event` / `remote_task` akzeptieren beliebige Payloads** — Server relayed ohne Schema-Prüfung (`action: any`, `params: any`) |
| SEC-MP-04 | **`player_left` → `window.location.href = '/'`** — fremd ausgelöstes Disconnect erzwingt harten Redirect des Clients (DoS-Vector per Room-Verlassen) |
| SEC-MP-05 | **`sync_project` sendet das komplette Projekt** vom Master an den Beitretenden — nur `player1` darf senden (roomManager Z. 205–211), aber kein Integritätsschutz für die Payload |
| SEC-MP-06 | **Heartbeat/Timeout rein client-seitig gezählt** — `missedPongs` kann durch Timing manipuliert werden; `playerNumber: 0` als Selbst-Timeout ist konventionell; 30 s Grace für Rejoin |
| SEC-MP-07 | **`broadcast_action` ohne `gameStarted`-Prüfung** — relayed sobald `room` existiert (Z. 186–200); `input`/`trigger_event`/`state_sync`/`trigger_task`/`sync_task` hingegen erst ab `gameStarted` |
| SEC-MP-08 | **`rejoin_room` übernimmt `playerNumber` vom Client ungeprüft** — freier Slot kann von Drittbeobachtern besetzt werden (Z. 87–124) |
| SEC-MP-09 | **`agent_call` über WebSocket ohne Auth, inkl. Schreiben auf `project.json`** — HTTP-Gate (`GCS_EDITOR_APIS`) greift nicht für den WS-Pfad; siehe TD-013 |

---

## Test-Protokoll (dieser Lauf)

| Befehl | Datum | Ergebnis |
|---|---|---|
| `node --import tsx --test src/runtime/ExpressionParser.test.ts` | 2026-10-17 | **6/6 PASS** |
| `node --import tsx --test src/runtime/executor/TaskConditionEvaluator.test.ts` | 2026-10-17 | **27 PASS / 7 FAIL** → TD-003 |

Weitere dokumentierte Läufe: `docs/inventory/FEATURE-INVENTORY.json` (`testRuns`).

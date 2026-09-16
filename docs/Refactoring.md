Meine vorige Antwort war missverständlich: **Ich habe keine Datei angelegt.** Hier ist der ausführliche Markdown-Inhalt zum Speichern als `docs/REFACTORING-PLAN.md`.

---

# Refactoring-Plan: Quelldateien unter 1.000 Zeilen

## 1. Ziel und Umfang

Die großen Quelldateien des Projekts werden schrittweise in kleinere, fachlich zusammenhängende Module aufgeteilt.

Dabei bleibt das bestehende Verhalten erhalten. Das betrifft insbesondere:

- den Editor und seine Ansichten,
- Stage-Darstellung und Interaktionen,
- Inspector und Flow-Editor,
- Projektladen, Speichern und Autosave,
- AgentController und AgentScript-Import/-Export,
- Runtime, Animationen, Timer und Kollisionen,
- HTTP- und WebSocket-Schnittstellen.

**Die Reihenfolge richtet sich nach der Dateigröße: größte Dateien zuerst.**

### Verbindliches Größenlimit

- Jede bearbeitete Quelldatei muss am Ende ihrer vollständigen Etappe **unter 1.000 Zeilen** liegen.
- Das gilt auch für alle neu angelegten Module und zugehörigen Testdateien.
- Gezählt werden physische Zeilen einschließlich Leerzeilen und Kommentaren.
- Die Zielgröße liegt möglichst bei **600–900 Zeilen oder darunter**.
- Kleine, klar abgegrenzte Module müssen nicht künstlich vergrößert werden.
- Leerzeilen, Kommentare oder Formatierung werden nicht entfernt, um das Limit rechnerisch einzuhalten.

### Nicht Bestandteil dieses Refactorings

- neue Features,
- Änderungen am Projekt-JSON-Format,
- Änderungen an öffentlichen API-Signaturen,
- Umbenennung von AgentController-Befehlen,
- neue Abhängigkeiten ohne gesonderte Prüfung und Freigabe,
- funktionale Fehlerbehebungen ohne gesonderte Abstimmung,
- Änderungen an Sicherheitsregeln oder Authentifizierungsverhalten.

Während der Analyse entdeckte Probleme werden separat festgehalten und nicht stillschweigend mitbehoben.

---

## 2. Arbeitsweise und Freigaben

### Schrittweise Umsetzung

Jede große Datei wird in mehrere kleine Teilschritte aufgeteilt.

Für jeden Teilschritt gilt:

1. Betroffene Methoden, Aufrufer und Zustandsabhängigkeiten prüfen.
2. Konkrete Auslagerung und betroffene Dateien benennen.
3. Freigabe für die Änderung einholen.
4. Zusammenhängenden Code möglichst unverändert verschieben.
5. Bestehende Einstiegspunkte durch Delegation erhalten.
6. Relevante Prüfungen durchführen.
7. Ergebnis und verbleibende Risiken berichten.
8. Funktionstest durch den Nutzer abwarten.
9. Erst danach den nächsten Teilschritt beginnen.

### Befehle und Versionskontrolle

- Build- und Startbefehle führt der Nutzer aus, sofern nicht ausdrücklich anders beauftragt.
- Automatisierte Tests dürfen keine produktiven Daten verändern.
- Tests, die Server oder Builds starten, werden vorher angekündigt und abgestimmt.
- Commits und Pushes erfolgen nur nach ausdrücklichem Auftrag.
- Bereits vorhandene Nutzeränderungen bleiben unangetastet.
- Ein fehlgeschlagener Test wird nicht durch Abschwächen der Prüfung „repariert“.

### Kommentare und Funktionen

- Bestehende Kommentare werden mit ihrem zugehörigen Code verschoben.
- Öffentliche Funktionen bleiben erreichbar.
- Die Auslagerung entfernt keine Funktionalität.
- Bestehende Features werden anhand der Feature-Map geprüft, bevor Code verlagert wird.

---

## 3. Ausgangslage und Reihenfolge

Die Werte stammen aus der Analyse dieses Arbeitsstands. Vor jeder Etappe werden sie erneut ermittelt.

| Nr. | Datei | Physische Zeilen | Status |
|---:|---|--...[14862 chars truncated]....
| 1 | `src/editor/services/StageRenderer.ts` | 2.51...[931 chars truncated]...zuordnung.
- [ ] Wizard-Änderungen landen weiterhin in der richtigen Definition.

---

# 11. Etappe 7: InspectorRenderer

## Ziel

Einfache UI-Steuerelemente von Action-Parameterdarstellung und dynamischer Optionsbeschaffung trennen.

## Teilschritte

- [ ] `renderActionParams()` in ein eigenes Modul auslagern.
- [ ] Dynamische Auswahloptionen als eigene Verantwortung kapseln.
- [ ] UI-Aufbau aus Property-Metadaten bei Bedarf abtrennen.
- [ ] Bestehende Renderer-Methoden als kompatible Einstiegspunkte erhalten.

## Abschlussprüfung

- [ ] Alle Action-Typen behalten ihre Parameterfelder.
- [ ] Methodenparameter ändern sich korrekt mit der Methodenauswahl.
- [ ] Objekt-, Variablen-, Task- und Stage-Auswahl funktionieren.
- [ ] Bindings und Eingabetypen bleiben erhalten.
- [ ] Keine unbeabsichtigte Vereinheitlichung unterschiedlicher Schreibpfade.

---

# 12. Etappe 8: GameRuntime

## Ziel

Zusammenhängende Runtime-Verantwortlichkeiten auslagern, ohne den Lebenszyklus zu verändern.

## Teilschritte

- [ ] Stage-Startanimation und Startpositionsmuster auslagern.
- [ ] Reaktive Bindings und Variablen-Synchronisation abtrennen.
- [ ] Event-Verarbeitung prüfen und bei Bedarf auslagern.
- [ ] Bereits vorhandene Input-, Multiplayer- und Stage-Manager weiterverwenden.
- [ ] Start, Stop und Projekt-/Stage-Wechsel als koordinierte Abläufe erhalten.

## Abschlussprüfung

- [ ] Splash und Hauptspiel starten wie zuvor.
- [ ] Stage-Start-Events werden nicht doppelt ausgelöst.
- [ ] Timer und Listener werden beim Stoppen aufgeräumt.
- [ ] Bindings funktionieren nach Stage-Wechseln.
- [ ] Spawn und Destroy funktionieren.
- [ ] Multiplayer-Aufrufe behalten ihr Verhalten.
- [ ] Standalone-Player und Editor-Run-Modus funktionieren.

---

# 13. Etappe 9: GameLoopManager

## Ziel

Zeitsteuerung von Kollisions- und Boundary-Verarbeitung trennen.

## Teilschritte

- [ ] Kollisionsprüfung mit ihrem Tracking-Zustand auslagern.
- [ ] Boundary- und Stage-Exit-Verarbeitung fachlich zuordnen.
- [ ] Gemeinsames Tracking beim Entfernen eines Sprites erhalten.
- [ ] Hauptschleife und Start-/Stop-/Pause-Verhalten im Manager belassen.
- [ ] Weitere Aufteilung nur vornehmen, wenn sie für Puffer oder Zuständigkeiten nötig ist.

## Abschlussprüfung

- [ ] Kollisionsereignisse werden unverändert ausgelöst.
- [ ] Clamp-/Bounce-Verhalten bleibt erhalten.
- [ ] Pause und Resume funktionieren.
- [ ] Timer-Ticks behalten ihre Reihenfolge.
- [ ] Keine veralteten Kollisionsdaten nach Destroy oder Stage-Wechsel.
- [ ] Keine zusätzlichen vollständigen Objektdurchläufe pro Frame.

---

# 14. Etappe 10: AgentScriptIO

## Ziel

Import und Export in zwei fachlich geschlossene Module aufteilen.

## Teilschritte

- [ ] Export einschließlich Referenzsammlung auslagern.
- [ ] Import einschließlich Konfliktbehandlung auslagern.
- [ ] Platzhalter- und Asset-Verarbeitung eindeutig zuordnen.
- [ ] `AgentScriptIO` als kompatible Fassade erhalten.

## Abschlussprüfung

- [ ] Export erzeugt weiterhin dieselben Operationen.
- [ ] Importreihenfolge bleibt erhalten.
- [ ] Stage-Platzhalter werden korrekt ersetzt.
- [ ] Konfliktstrategien funktionieren.
- [ ] Globale Referenzen bleiben erhalten.
- [ ] Export-Import-Rundlauf bewahrt das Projektverhalten.
- [ ] AgentScript-Format bleibt unverändert.

---

# 15. Etappe 11: EditorDataManager

## Ziel

Die Datei mit einem gezielten, begrenzten Eingriff unter das Limit bringen.

Ein vollständiger Neuaufbau von Laden und Speichern ist hier nicht vorgesehen.

## Teilschritte

- [ ] Zusammenhängenden Migrations-/Datenvorbereitungsbereich auswählen.
- [ ] Beispielsweise FlowChart-zu-Layout-Migration mit benötigten Hilfen auslagern.
- [ ] Genügend Puffer schaffen, nicht nur wenige Zeilen verschieben.
- [ ] Aufrufreihenfolge im bestehenden Ladeablauf erhalten.

## Unbedingt erhalten

- Erkennung der Haupt-Stage einschließlich Fallback
- Flow-Kontext-Reset
- Wechsel in den Stage-Tab
- Aktualisierung von CoreStore und ProjectStore
- Quellpfad und Speicherziel
- Dirty-Flag-Reset und Autosave-Sperrzeit

## Abschlussprüfung

- [ ] Laden aus einem Task-/Objektkontext öffnet die Stage-Ansicht.
- [ ] Projekte ohne explizite Main-Stage landen nicht unbeabsichtigt auf Blueprint.
- [ ] Speichern und erneutes Laden funktionieren.
- [ ] Kein Autosave überschreibt beim Laden den neuen Stand mit alten Daten.

---

# 16. Etappe 12: FlowContextMenuProvider

## Ziel

Einen klar zusammenhängenden Bereich auslagern und ausreichend Puffer schaffen.

## Teilschritte

- [ ] Wizard-/Expert-Action-Bearbeitung als bevorzugte Modulgrenze prüfen.
- [ ] Alternativ zusammenhängende Library-/Template-Operationen abtrennen.
- [ ] Menüaufbau und Eventverdrahtung im Provider erhalten.
- [ ] Bestehende Aktionen und Kontextunterscheidungen beibehalten.

## Abschlussprüfung

- [ ] Menüs für Canvas, Nodes und Verbindungen funktionieren.
- [ ] Globale Actions bleiben als solche erkennbar.
- [ ] Verknüpfen und Kopieren bleiben unterschiedliche Operationen.
- [ ] Eingebettete Tasks behalten ihre Proxy-/Gruppenzuordnung.
- [ ] Wizard-Änderungen landen weiterhin in der richtigen Definition.

---

## 17. Teststrategie

### Ausgangszustand

Vor der ersten Implementierung:

- [ ] Git-Status prüfen.
- [ ] Relevante Tests ausführen.
- [ ] Bestehende Fehler von neuen Regressionen unterscheiden.
- [ ] Aktuelle Zeilenzahlen festhalten.
- [ ] Sicherstellen, dass Testdaten von produktiven Daten getrennt sind.

### Nach jedem Teilschritt

- [ ] Typecheck
- [ ] passende bestehende Tests
- [ ] gegebenenfalls zusätzliche Tests für bisher ungeschütztes Verhalten
- [ ] Diff auf versehentliche Funktionsänderungen prüfen
- [ ] Importabhängigkeiten und mögliche Zyklen prüfen
- [ ] Zeilenzahlen aller betroffenen Dateien prüfen

### Quelltextbasierte Regressionstests

Einige bestehende Tests suchen direkt nach Implementierungsdetails in bestimmten Dateien.

Beim Auslagern gilt:

- Die Prüfung wird auf den neuen Implementierungsort ausgerichtet.
- Die ursprüngliche Schutzwirkung bleibt bestehen.
- Ein bloßer Wrapper ersetzt keine Prüfung der tatsächlichen Logik.
- Wenn sinnvoll, wird zusätzlich das Verhalten getestet.

### Größen-Guard

Der vorhandene Größen-Guard lässt noch eine Anzahl großer Legacy-Dateien zu.

- Die erlaubte Anzahl wird nicht erhöht.
- Nach abgeschlossenen Etappen soll die Anzahl tatsächlicher Überschreitungen sinken.
- Eine abschließende Verschärfung des Guards wird separat freigegeben.
- Langfristiges Ziel: keine pauschale Ausnahme für neue übergroße Dateien.

---

## 18. Abschlusskriterien pro vollständiger Datei-Etappe

Eine Etappe ist erst abgeschlossen, wenn:

- [ ] ursprüngliche Datei unter 1.000 Zeilen liegt,
- [ ] alle neuen Module unter 1.000 Zeilen liegen,
- [ ] Tests nicht in eine neue übergroße Datei verschoben wurden,
- [ ] öffentliche APIs kompatibel geblieben sind,
- [ ] keine doppelte Zustandsverwaltung entstanden ist,
- [ ] keine Kommentare oder Features zur Größenreduktion entfernt wurden,
- [ ] relevante Prüfungen erfolgreich sind oder vorhandene Blocker ausdrücklich benannt wurden,
- [ ] Nutzer den betroffenen Ablauf getestet hat,
- [ ] Änderungen zur Sicherung bereitstehen.

---

## 19. Fortschrittsübersicht

| Etappe | Analyse | Freigabe | Umsetzung | Prüfungen | Nutzer-Test | Commit |
|---|---|---|---|---|---|---|
| 1 – StageRenderer | ✅ | ✅ | ✅ (382 Zeilen) | ✅ (tsc + Tests) | offen | offen |
| 2 – UserStories | ✅ | ✅ | ✅ (75 Zeilen) | ✅ (tsc + Tests) | offen | offen |
| 3 – AgentController | ✅ | ✅ | ✅ (483 Zeilen) | ✅ (tsc + Tests) | offen | offen |
| 4 – Server | ✅ | ✅ | ✅ (75 Zeilen) | ✅ (tsc + Tests) | offen | offen |
| 5 – InspectorSections | ✅ | ✅ | ✅ (213 Zeilen) | ✅ (tsc + Tests) | offen | offen |
| 6 – Editor | ✅ | ✅ | ✅ (771 Zeilen) | ✅ (tsc + Tests) | offen | offen |
| 7 – InspectorRenderer | ✅ | ✅ | ✅ (70 Zeilen) | ✅ (tsc + Tests) | offen | offen |
| 8 – GameRuntime | ✅ | ✅ | ✅ (465 Zeilen) | ✅ (tsc + Tests) | offen | offen |
| 9 – GameLoopManager | ✅ | ✅ | ✅ (464 Zeilen) | ✅ (tsc + Tests) | offen | offen |
| 10 – AgentScriptIO | ✅ | ✅ | ✅ (33 Zeilen) | ✅ (tsc + Tests) | offen | offen |
| 11 – EditorDataManager | ✅ | ✅ | ✅ (232 Zeilen) | ✅ (tsc + Tests) | offen | offen |
| 12 – FlowContextMenu | ✅ | ✅ | ✅ (142 Zeilen) | ✅ (tsc + Tests) | offen | offen |

## 20. Aktueller Stand

**Alle 12 geplanten Etappen wurden technisch umgesetzt.**

Die ursprünglich über 1.000 Zeilen großen Dateien liegen jetzt unter diesem Limit. Zusätzlich wurde `src/components/TDebugLog.ts` aufgeteilt, und die große Testdatei `tests/agent_controller.test.ts` wurde fachlich in Core-, Integrations- und Loop-Tests zerlegt.

---

## 21. Zusammenfassung Refactoring

### Umgesetzte Etappen

| Etappe | Ursprüngliche Datei | Neue Zeilenzahl | Wichtigste ausgelagerte Module |
|---|---:|---:|---|
| 1 | `src/editor/services/StageRenderer.ts` | 382 | `StageObjectRenderer`, `StageLayoutEngine`, `StageAnimationPreviewManager`, `StageFastPathUpdater` |
| 2 | `src/editor/userstories/UserStoriesViewManager.ts` | 75 | `UserStory*Manager`, `UserStoriesListRenderer` |
| 3 | `src/services/AgentController.ts` | 483 | `AgentProjectService`, `AgentObjectService`, `AgentValidationService`, `AgentFlowService`, `AgentBatchHelper`, `AgentDeletionService`, `AgentUseCaseService`, `AgentReadService` |
| 4 | `game-server/src/server.ts` | 75 | `routes/*`, `serverState.ts`, `websocket/*` |
| 5 | `src/editor/inspector/renderers/InspectorSectionRenderer.ts` | 213 | `KeyValueEditor`, `ListValueEditor`, `MediaImageEditor`, `RecordSchemaEditor`, `StandardPropertyRenderer`, `SectionRendererHelpers` |
| 6 | `src/editor/Editor.ts` | 771 | `EditorProjectFactory`, `EditorSessionManager`, `EditorStageImporter` |
| 7 | `src/editor/inspector/InspectorRenderer.ts` | 70 | `ActionParameterRenderer`, `DynamicOptionsRenderer`, `StandardControlRenderer`, `ColorMediaControlRenderer`, `InspectorUIRenderer`, `InspectorRendererHelpers`, `BindingVariablePicker` |
| 8 | `src/runtime/GameRuntime.ts` | 465 | `Runtime*Service` unter `src/runtime/services/` |
| 9 | `src/runtime/GameLoopManager.ts` | 464 | `LoopLifecycle`, `CollisionManager`, `PhysicsEngine`, `RenderLoop`, `InputManager` |
| 10 | `src/services/agent/AgentScriptIO.ts` | 33 | `AgentScriptIOTypes`, `AgentScriptAssetHelper`, `AgentScriptConditionHelper`, `AgentScriptExportService`, `AgentScriptImportService` |
| 11 | `src/editor/services/EditorDataManager.ts` | 232 | `EditorProjectLoader`, `EditorProjectSaver`, `EditorMediaExporter` |
| 12 | `src/editor/services/FlowContextMenuProvider.ts` | 142 | `FlowContextMenu*`, `FlowDataParser`, `FlowRegistrySync`, `FlowSequenceBuilder`, `FlowSyncTypes` |

### Zusätzliche Aufteilungen

- `src/components/TDebugLog.ts` wurde auf 649 Zeilen reduziert.
- Neue Helfer: `TDebugLogProjectHelper.ts` und `TDebugLogRenderer.ts`.
- `tests/agent_controller.test.ts` wurde aufgeteilt in:
  - `tests/agent_controller_helper.ts`
  - `tests/agent_controller_core.test.ts`
  - `tests/agent_controller_integration.test.ts`
  - `tests/agent_controller_loops.test.ts`
  - `tests/agent_controller.test.ts` (dünnes Barrel, weiterhin vom Test-Runner importiert)

### Ergebnis der Prüfungen

- `npx tsc --noEmit`: ✅ ohne Fehler
- `npm run test`: ✅ "ALLE KRITISCHEN PFADE VERIFIZIERT"
- Zeilen-Guard für `.ts`/`.tsx` unter 1.000 Zeilen: ✅ 0 Verstöße in `src/`
- Bundle-Freshness-Guard: ✅ erfüllt (das Runtime-Bundle wurde im Zuge der Testdurchführung neu gebaut)

### Noch offen / empfohlen

- Manuelle Nutzer-Tests für Editor-Flüsse, Stage-Rendering, Flow-Menüs und Speichern/Laden sind empfohlen, bevor Commit/Push erfolgen.
- Commit und Push wurden noch nicht durchgeführt (kein entsprechender Auftrag).

### Hinweis zur Datei

Diese Datei wurde aus den verfügbaren Fragmenten neu zusammengestellt. Etwaige fehlende Detailabschnitte zwischen den ursprünglichen Etappen 1-6 beruhen auf der vorherigen Beschädigung/Teilstands-Sicherung. Die wesentlichen Kriterien (Limit, APIs, Tests, Reihenfolge) wurden durch die Umsetzung erfüllt.Splash wird angezeigt.
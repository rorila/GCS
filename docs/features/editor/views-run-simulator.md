# Feature: Views, Run-Modus, Simulator &amp; Debug-Log

> **Status:** `entwurf` · code-belegt, nicht UI-getestet
> **Quellen:** `src/editor/EditorViewManager.ts`, `src/editor/services/EditorRunManager.ts`, `EditorSimulatorManager.ts`, `src/editor/views/*ViewManager.ts`, `src/components/TDebugLog.ts`, `src/services/DebugLogService.ts`

## 1. View-System

`EditorViewManager.switchView(view)` schaltet die Arbeitsfläche um:

| View | Inhalt | Manager |
|---|---|---|
| `stage` | Design-Fläche | `EditorRenderManager` |
| `flow` | Flow-Graph | `FlowEditor` |
| `run` | **Live-Ausführung** im Editor | `EditorRunManager` |
| `json` | Projekt-JSON | `JSONViewManager` |
| `code` | Pascal-Code | `CodeViewManager` |
| `management` | User Stories / Projektmanagement | `ManagementViewManager` |
| `userstories` | User-Story-Listen | `UserStoriesViewManager` |
| `iframe`, `knowledgebase` | eingebettete Inhalte / Wissensbasis | — |

Wechsel-Regeln (code-belegt): beim Verlassen von `run` wird das Debug-Log-Panel versteckt und das Logging gestoppt (Z. 218–222).

## 2. Run-Modus (`EditorRunManager`, ~330 Z.)

**Zweck:** Das Projekt **in-place** ausführen — nicht als Export.

**Bedienung:** View `run` / Run-Button → `setRunMode(true)`:

- `GameRuntime` wird auf einem **geklonten** Projekt (`projectClone`) gestartet — Editor-Daten bleiben unangetastet (Z. 148)
- `startStageId` = aktive Stage als Einstieg
- `onNavigate` mit `stage:`-Präfix → Runtime-interne Navigation, sonst Editor-Navigation
- `onRestartGame` → `setRunMode(false)` + Re-Start nach 50 ms (Z. 208–211)
- Stop: `stopRuntime()` → `runtime.stop()`, GameLoop stoppen, `TInputController`s beenden (Z. 301–315)

**Grenzen:** Runtime arbeitet auf Objektkopien — Änderungen im Run **fließen nicht zurück** in das Editor-Projekt (Z. 52-Kommentar). Multiplayer im Editor-Run nur wenn `multiplayerManager` verfügbar.

## 3. API-Simulator (`EditorSimulatorManager`)

**Zweck:** `http`/`data_action`-Aufrufe im Editor-Run **ohne echten Server** beantworten — sucht `TAPIServer`-Objekte im Projekt und simuliert deren Antworten (Z. 31, 134).

**Bezug:** `http`-Action-Parameter `directFetch` umgeht den Simulator explizit (z. B. für statische Dateien).

## 4. Debug-Log (`TDebugLog` + `DebugLogService`)

- Panel nur in View `run` sichtbar (`setButtonVisible(view === 'run')`)
- `DebugLogService` sammelt `Event`-, `Variable`-, Task-Einträge mit Kontext-Stack (`pushContext`/`popContext`)
- Editor-Service `Editor.jumpToDebug(objectName, eventName)` → View `run` + Filter
- Filter-Dropdowns werden bei Stage-Wechsel aktualisiert (`updateFilterDropdowns`)

## 5. JSON- &amp; Code-View

- `JSONViewManager`: Projekt-JSON anzeigen/editieren; `EditorDataManager.updateProjectJSON()` synchronisiert nach Änderungen
- `CodeViewManager` + `PascalGenerator`/`PascalCodeParser`: Pascal-Ansicht der Flow-Logik (siehe `flow-editor.md` §6)

## 6. Management-View

`ManagementViewManager`, `userstories/`, `UseCaseDialog`, `StageOverviewDialog`, `SequenceDiagramDialog`, `StageDialogs`, `StageOverviewFilters`, `StageThumbnailService` — User Stories, Use-Case-Verwaltung, Stage-Übersicht mit Thumbnails und Filtern, Sequenzdiagramm-Anzeige. Fachliche Tiefe in dieser Analyse nicht geprüft.

## 7. Einschränkungen &amp; offene Punkte

- Run-Mode ist **Einweg** (Clone) — kein Edit-and-Continue
- Simulator deckt nur `TAPIServer`-Antworten ab, nicht die deklarativen Server-Stages (`cms-runtime`)
- `TDebugLog` ist selbst eine T-Komponente — läuft im Editor-Chrom, nicht im Spiel
- Kein Breakpoint-/Step-Debugger gefunden — „Debug" = Log + Filter, nicht Haltepunkte

# Changelog

## [2.4.2] - 2026-02-01
### Behoben
- **Pascal Synchronisation**: Automatisches Update des Flow-Editors bei Code-Änderungen im Pascal-Editor.
    - Integration von `flowEditor.syncActionsFromProject()` in den `oninput`-Handler des Pascal-Editors.
    - Robustere Suche nach Aktionen über alle Stages hinweg in `FlowEditor.ts`.
- **Zirkuläre Referenzen**: Behebung fälschlicher Warnungen im JSON-Inspector.
    - **Fix (Circular References)**: Zirkularitäts-Warnungen im JSON-Inspector korrigiert (pfad-basierte Prüfung statt globaler WeakSet).
- **Fix (Event Logging)**: Variablen-Events (z.B. `onTriggerEnter`, `onTimerEnd`) werden nun korrekt im Debug-Log als Event-Einträge protokolliert.
- **Sync (FlowEditor)**: Deep Cloning bei der Synchronisation von Aktionen implementiert, um Shared References zu vermeiden.
- **Persistenz & Local Storage**: Beseitigung redundanter Einträge und Vereinheitlichung der Speicherung.
    - Umstellung aller Speicheroperationen auf den einheitlichen Key `gcs_last_project`.
    - Konsolidierung der Speicherlogik in `Editor.ts` durch Nutzung des `ProjectPersistenceService`.

## [2.4.1] - 2026-02-01
### Behoben
- **Debug-Log System**: Vollständige Wiederherstellung der Funktionalität und Sichtbarkeit.
    - **Logging-Anbindung**: Integration von `GameRuntime` (Events), `PropertyWatcher` (Variablen), `ActionExecutor` (Aktionen) und `TaskExecutor` (Tasks/Conditions) an den `DebugLogService`.
    - **Hierarchische Ansicht**: Korrekte Einrückung von Kind-Aktionen unter dem auslösenden Ereignis/Task.
    - **Filter-Logik**: Entschärfung der Typ-Filter (Unabhängigkeit der Checkboxen).
    - **Lifecycle-Fix**: Behebung eines Bugs im `EditorRunManager`, der das System beim Beenden des Run-Modus zerstörte.
    - **UI-Stabilität**: Einführung eines internen Sichtbarkeits-Flags und robusterer CSS-Steuerung.

## [2.4.0] - 2026-02-01
### Behoben
- **Stage-Editor UI**: Wiederherstellung der Toolbox und des Inspectors.
    - Korrektur der Container-IDs (`json-inspector-content`, `json-toolbox-content`) in `Editor.ts`.
    - Implementierung des fehlenden Ladevorgangs für `toolbox.json`.
    - Wiederherstellung des 'Debug Logs' Buttons durch Einführung eines `toolbox-footer` Containers und Fix der Initialisierung.
 in der modernisierten `Editor.ts`.
    - Erweiterung der Sichtbarkeitssteuerung im `EditorViewManager.ts` für die `stage`- und `flow`-Ansichten.
- **Build-Stabilität**: Erfolgreiche Verifizierung des gesamten Refactorings durch `npm run build`.

## [Refactoring] - 2026-01-31
- **Editor.ts**: Massive Modularisierung und Bereinigung. Die Datei fungiert nun als schlanker Orchestrator.
- **EditorCommandManager**: Neue Komponente für Objekt-Manipulation und Befehlsausführung (Undo/Redo Support).
- **EditorRunManager**: Neue Komponente für die Verwaltung der Game-Runtime und des Game-Loops.
- **EditorStageManager**: Neue Komponente für Stage-spezifische Operationen und Objekt-Synchronisation.
- **Trinity-Sync**: Konsolidierung der Synchronisation zwischen Stage-Editor, JSON-Code und Pascal-Sicht.
- **Build & Typ-Sicherheit**:
  - Sämtliche TypeScript-Fehler (8 Fehler in 6 Dateien) behoben.
  - `ServiceRegistry` wurde korrekt typisiert, um `any`-Inferenz zu vermeiden.
  - Fehlende `renderJSONTree`-Methode in `EditorViewManager` implementiert.
  - Syntaxfehler und verwaiste Imports in `ActionEditor.ts` und `MediatorService.ts` bereinigt.
  - Erfolgreiche Verifizierung durch `npm run build`.
- **Fehlerbehebung**: Beseitigung zahlreicher Code-Duplikate und Syntaxfehler, die durch fehlerhafte Merges entstanden waren.

## [2.3.0] - 2026-01-31
### Hinzugefügt
- **Management-Tab**: Einführung eines dedizierten Tabs zur zentralen Ressourcenverwaltung.
- **Interaktive Navigation**: Klick auf Tabellenzeilen fokussiert Objekte auf der Stage (mit Highlight-Effekt) oder öffnet den Flow-Editor.
- **Event-Präzision**: Spezialisierte Variablen (Timer, Trigger, etc.) zeigen im Inspektor nur noch ihre klassenspezifischen Events an.
- **Daten-Anreicherung**: Anzeige von X/Y-Positionen, Klassen, Typen, Zielobjekten und aktuellen Werten.
- **TTable-Komponente**: Statischer Renderer für systemweite Tabellen-Visualisierung.
- **Reaktive Synchronisation**: Kopplung des Editors an den `MediatorService`. Interaktionen auf der Stage (Selektion, Verschieben, Skalieren) triggern nun automatische Updates in allen anderen Ansichten (insbes. Management-Tab).
- **Cross-Tool Synchronisation**: Nahtloser Datenfluss zwischen JSON-, Pascal-, Action- und Flow-Editor. Änderungen in einem Tool werden sofort in allen anderen Ansichten reflektiert, ohne zirkuläre Event-Schleifen zu erzeugen (Trinity-Sync).
- **Robuste Serialisierung**: Zentralisierte `toJSON`-Logik in `TComponent` unterstützt nun verschachtelte Objekt-Pfade (z.B. `style.visible`) und automatische Kind-Serialisierung.

### Behoben
- **Stage-Bereinigung**: Korrektur der Rendering-Logik; Manager-Tabellen werden nicht mehr auf der Stage angezeigt.
- **Sanitizer-Härtung**: Automatische Entfernung transienter Management-Objekte aus Projektdaten.
- **Button-Rendering**: Zusätzliche Texte auf Buttons ("(0 Einträge)") wurden entfernt.
- **TObjectList Refactoring**: Erbt nun von `TTable`, um tabellarische Eigenschaften direkt zu nutzen.
- **Image-Sichtbarkeit**: Behebung eines Fehlers, bei dem Bilder nach Pascal-Änderungen ihre Sichtbarkeitseinstellungen verloren haben.
- **Tool-Sync Stabilität**: Flow-Editor wird nicht mehr bei eigenen Änderungen neu initialisiert.

# Changelog

## [2.2.0] - 2026-01-31
- **Fix (Kritisch): JSON-Viewer Abstürze**:
    - Ersatz von `JSON.stringify(this.project)` durch `safeDeepCopy` in `Editor.ts` und `EditorViewManager.ts`. Dies verhindert Abstürze durch zirkuläre Referenzen (z.B. reaktive Proxies).
    - Implementierung eines robusten `try-catch`-Blocks um die gesamte `refreshJSONView`-Logik.
    - Neuer Fehler-Bildschirm im JSON-Viewer mit hilfreicher Fehlermeldung und "Editor neu laden"-Option.
- **Dokumentation**:
    - Explizite Warnung vor `JSON.stringify` auf dem Projekt-Objekt in den `DEVELOPER_GUIDELINES.md` ergänzt.

## [2.1.9] - 2026-01-30
- **Verbesserung: Action-Check & Referenzsuche**:
    - Komplette Überarbeitung der `getTaskUsage`-Logik in der `ProjectRegistry`. 
    - Unterstützung für die Erkennung von Task-Referenzen in Variablen-Events (z.B. `onValueTrue`, `onChange`) und verschachtelten Pfaden.
    - Implementierung eines Sicherheits-Scans ("Hammer-Scan") via JSON-Analyse, um sicherzustellen, dass keine Referenzen bei der Lösch-Prüfung übersehen werden.
    - Optimierung der Diagnostics im `FlowEditor`: Der Action-Check liefert nun präzise Informationen über die Verwendung von Tasks, Aktionen und Variablen.
- **Bereinigung**: Entfernung veralteter `.js`-Dateien im Quellcode-Verzeichnis zur Vermeidung von Cache-Problemen.
- **Bugfix (Kritisch): ServiceRegistry Singleton**:
    - Das Problem der "doppelten ServiceRegistry" (JS vs. TS) wurde behoben, indem die Instanz global an das `window`-Objekt gebunden wurde.
- **Bugfix: Action Löschen**:
    - Die Lösch-Funktion im FlowEditor entfernt Aktionen nun zuverlässig aus beiden Scopes (Global & Stage).
- **Fix: Pascal-Code-Generierung**:
    - Korrektur der Task-Suche im `PascalGenerator.ts`. Tasks werden nun projektweit gesucht.
- **Fix: Textkürzung (15-Zeichen Bug)**:
    - **Datenintegrität**: Entfernung der `slice(0, 2)`-Kürzung in `FlowAction.getActionDetails`. Actions speichern nun ALLE Property-Changes, sodass keine Daten mehr verloren gehen.
    - **Visuelle Darstellung**: Implementierung einer intelligenten visuellen Kürzung im Diagramm (zeigt max. 2 Zeilen + "+N more").
    - **FlowTasks**: Hinzufügen von `white-space: nowrap` für Task-Parameter, um unerwünschtes Wrapping und falsche Größenberechnung zu verhindern (Korrektur des 15-Zeichen-Eindrucks).
- **Fix: Regressionen im Flow-Editor**:
    - Reduzierung der Log-Flut in `ReactiveRuntime.ts` durch Downgrade von Binding-Logs auf Debug-Level.
- Behebung eines Speicherlecks im `JSONInspector.ts` durch Bereinigung der Bindungen bei jedem Update des Inspektors.
- Optimierung der Performance in `ProjectRegistry.ts` durch Reduktion redundanter Projekt-Scans und Deaktivierung von Debug-Logs in Usage-Methoden.
- Behebung einer Endlosschleife im Flow-Editor zwischen `setProjectRef` und `setShowDetails`.
- **Neu: System-Bereinigung**:
    - Einführung des `npm run clean` Skripts zur sicheren Entfernung von Vite-Cache und Build-Artefakten.

## [2.1.8] - 2026-01-30
- Vorbereitung für Release.

## [2.1.7] - 2026-01-30
- Behebung der Textkürzung (initialer Ansatz).

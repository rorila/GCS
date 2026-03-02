# Developer Guidelines

> [!CAUTION]
> **MANDATORY AI AGENT RULE**: Every code modification MUST be followed by executing `npm run test` (oder `run_tests.bat`, falls PowerShell blockiert). Verification of the `docs/QA_Report.md` is required for the "Definition of Done". Do NOT notify the user before running tests.

## Schnellstart & Kernregeln
- **Sprache**: Die gesamte Kommunikation und Dokumentation erfolgt auf Deutsch.
- **GCS Dashboard Pattern**: Für moderne Dashboards (z.B. `roomDashboard`) die `TTable` im `displayMode: "cards"` verwenden. Datenquellen dafür sind bevorzugt `TObjectList`-Variablen in der `stage_blueprint`.
- **Global Hosting**: Gemäß Antigravity-Regeln MÜSSEN alle globalen Variablen und Komponenten in der `stage_blueprint` definiert sein.
- **Modularisierung**: Max. 1000 Zeilen pro Datei. Bei Überschreitung: Modul-Aufteilung anwenden.
- **Synchronität**: Änderungen in Inspector/Flow-Editor müssen konsistent in JSON und Pascal reflektiert werden.
- **Flow-Typen**: Typ-Bezeichner für Flow-Elemente (`getType()`) müssen IMMER kleingeschrieben sein (z.B. 'task', 'action'). Dies sichert die Konsistenz mit dem Datenmodell und dem Refactoring-System.
- **Expert-Wizard Dynamisierung**: Um im Wizard Auswahl-Listen statt Textfeldern zu zeigen, in der Regel-JSON `type: "select"` und `options: "@objects"` (oder andere Key-Platzhalter) verwenden. Die Auflösung erfolgt zur Laufzeit via `ProjectRegistry`.
- **FlowAction Proxy-Regel**: Wenn neue Felder in `StandardActions.ts` oder `action_rules.json` hinzugefügt werden (z.B. für neue Aktions-Typen), MÜSSEN diese auch als Getter/Setter in `FlowAction.ts` implementiert werden, damit der Inspector sie bearbeiten kann.
- **Sync-Blacklist**: Die `taskFields` Liste in `FlowSyncManager.ts` darf keine Felder enthalten, die für Aktionen (Global oder Embedded) essentiell sind (z.B. `value`, `params`, `body`, `source`).

## DO NOT
- **Expert-Wizard Prompts**: Prompts unterstützen Platzhalter in geschweiften Klammern (z.B. `"Wert für {target}.{property}?"`). Diese werden automatisch durch bereits gesammelte Werte aus der Session ersetzt.

## Fachliche Dokumentation
Ausführliche Details findest du in den spezialisierten Dokumenten:

- [🏗️ Architektur & Module](docs/architecture.md)
- [⚙️ Runtime & Execution](docs/runtime-guide.md)
- [📏 Coding Standards](docs/coding-standards.md)
- [🖥️ UI & Inspector Guide](docs/ui-inspector-guide.md)
- [🔍 UseCase Index](docs/use_cases/UseCaseIndex.txt)

## Tooling
- **Tests**: `npm run test`
- **Validierung**: `npm run validate`
- **Build**: `npm run build`
- **Runtime Bundle**: `npm run bundle:runtime` (Zwingend nach Runtime-Änderungen!)

## AI Agent Integration
- [🤖 AI Agent Integration Plan](docs/AI_Agent_Integration_Plan.md)
- [⚡ Flow Safety (Self-Healing)](docs/coding-standards.md#ai-agent-api--flow-safety)

## 7. LOGGING & DIAGNOSE
- **Keine `console.log`**: Verwende NIEMALS `console.log`, `console.warn` oder `console.error` direkt im Code.
- **Logger-Pflicht**: Nutze immer den zentralen Logger: `private static logger = Logger.get('ClassName', 'UseCaseId');`.
- **UseCases**: Ordne Logs immer einem funktionalen UseCase zu (siehe `UseCaseManager.ts`).
- **Fehler**: `logger.error` wird immer angezeigt. `debug/info/warn` nur, wenn der UseCase im Inspector aktiv ist.
- **Circular Deps**: Wenn ein Utility-Modul den Logger braucht, achte darauf, dass keine kreisförmigen Abhängigkeiten entstehen (siehe Filter-Pattern in `Logger.ts`).

---
---
- **DO NOT**: Verwende NIEMALS Case-Sensitive Typ-Prüfungen für Flow-Elemente (immer `.toLowerCase()` nutzen).
- **DO NOT**: Vergesse NIEMALS die `projectRef` Zuweisung in der `FlowNodeFactory` für neue Knoten-Typen.
- **DO NOT**: Vergesse NIEMALS, beim Löschen von Actions (`deleteAction`) alle Sub-Typen wie `DataAction` oder `HttpAction` im Filter zu berücksichtigen, um verwaiste Knoten-Reste in Flow-Charts zu vermeiden.
- **DO NOT**: Verlasse dich bei der Referenzprüfung (`ProjectRegistry`) niemals auf exakte Typ-Übereinstimmungen ohne Normalisierung (Bugfix v3.15.2).
- **DO NOT**: Vergiss NIEMALS, dass `EditorCommandManager.findObjectById` Objekte via String-Namen auflösen muss, wenn UI-Handler (wie `InspectorActionHandler` oder `FlowContextMenuProvider`) ein Umbenennen triggern. Es muss sichergestellt werden, dass Basis-Tasks/Actions dort als Entity gefunden werden, sonst greift das projektweite Refactoring ins Leere und nur das isolierte JSON-Objekt ändert seinen Namen (Bugfix v3.15.3).

Letzte Aktualisierung: v3.15.4 (Expert Wizard: Dynamische Objekt-Auswahl via @objects)

## Architektur & Persistenz
- **DO NOT**: Niemals Laufzeit-Objekte (z.B. aus dem ObjectStore oder StageManager.currentObjects()) direkt über das project.json Template schreiben. Laufzeit-Objekte enthalten aufgelöste Bindings (z.B. *'Hallo Welt'* anstatt *${text}*). Ein Speichern dieser Objekte zerstört die Datenbindung!
- **Stattdessen**: Editoren (wie EditorInteractionManager) müssen über Hilfsfunktionen wie getOriginalObject auf das originale JSON-Objekt im Speicher zugreifen und nur dort spezifische Eigenschaften (wie x, y, width, height) aktualisieren, **bevor** der Autosave angestoßen wird.

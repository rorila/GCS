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

Letzte Aktualisierung: v3.15.2 (Fix: Action Deletion Case-Sensitivity in Registry)

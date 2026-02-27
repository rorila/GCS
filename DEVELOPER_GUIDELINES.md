# Developer Guidelines

> [!CAUTION]
> **MANDATORY AI AGENT RULE**: Every code modification MUST be followed by executing `npm run test` (oder `run_tests.bat`, falls PowerShell blockiert). Verification of the `docs/QA_Report.md` is required for the "Definition of Done". Do NOT notify the user before running tests.

## Schnellstart & Kernregeln
- **Sprache**: Die gesamte Kommunikation und Dokumentation erfolgt auf Deutsch.
- **Modularisierung**: Max. 1000 Zeilen pro Datei. Bei Überschreitung: Modul-Aufteilung anwenden.
- **Testing**: Pro Task mindestens ein Test (Gutfall & Schlechtfall).
- **Synchronität**: Änderungen in Inspector/Flow-Editor müssen konsistent in JSON und Pascal reflektiert werden.

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

---
*Letzte Aktualisierung: v3.9.1 (Prio 3 Refactoring)*

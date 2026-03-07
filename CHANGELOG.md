# Changelog

Alle relevanten Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

## [3.10.0] - 2026-03-07
### Added
- **Intelligentes Speichermanagement**: Einführung eines `isProjectDirty` Flags zur Erkennung ungespeicherter Änderungen.
- **Browser-Schutz**: `window.onbeforeunload` Guard warnt vor dem Verlassen der Seite bei ungespeicherten Daten.
- **Sicherheitsabfragen**: Bestätigungsdialoge beim Erstellen neuer Projekte oder beim Laden, falls Änderungen vorliegen.

### Changed
- **Entkoppeltes Speichern**: Automatisches Speichern schreibt nur noch in den `LocalStorage` (Crash-Schutz). Das Schreiben auf die Festplatte (`project.json`) erfolgt nur noch explizit durch den Nutzer via "Speichern"-Button.

### Fixed
- Wiederherstellung der `project.json` aus der Git-Historie nach versehentlichem Überschreiben.
- **E2E-Reporting**: Rekursives Parsing von Test-Ergebnissen im Test-Runner zur Unterstützung verschachtelter Test-Suites.
- **Server-Check**: Automatisierte Prüfung der Game-Server Erreichbarkeit vor E2E-Tests.
- **E2E-Stabilität**: Fix der Inspector-Hydrierung in `deep_integration.spec.ts` durch Umstellung von `setProject` auf `loadProject`.
- **Code-Cleanup**: Entfernen ungenutzter Variablen und Imports in der Runtime (TSC-Fix).

## [3.9.1] - 2026-03-06
### Added
- **Phase 6.2: Deep E2E Integration**: Vollständige Browser-Automatisierung für Kern-Use-Cases.
- `tests/e2e/deep_integration.spec.ts`: Komplexer Integrationstest (D&D, Inspector, Flow, Run-Mode).
- Playwright-Konfiguration für stabile sequentielle Testausführung.

### Fixed
- Stabilität der Drag-and-Drop Operationen im E2E-Test.
- Ambiguität der Inspector-Selektoren im Playwright-Kontext.
- Toolbox-Kategorien-Expansion in `editor_smoke.spec.ts`.

## [3.9.0] - 2026-03-06
### Added
- **Phase 5 & 6**: Implementierung des Master-Test-Projekts und Playwright E2E-Infrastruktur.
- `scripts/seed_test_data.ts`: Generator für komplexes 3-Stage Projekt.
- `tests/e2e/editor_smoke.spec.ts`: Erster automatisierter Browser-Smoke-Test.

[... weitere Einträge siehe Archiv ...]

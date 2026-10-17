# Prüfbericht: Externe Stage-Schnittstellen

- TypeScript: `npx tsc --noEmit --pretty false` erfolgreich.
- Sechs neue Vertrags-, Action- und Refactoring-Tests erfolgreich.
- Elf Tests des Aufgabenbereichs erfolgreich.
- Bestehende Regressionen: TaskExecutor 9/9, Event-Actions 10/10, Stage-Wechsel 26/26 erfolgreich.
- Browser: echte Runtime-Eingänge starten Tasks, Nutzdaten behalten Typen, Ausgänge korrelieren, Duplikate wiederholen keine Tasks, Task-Fehler und beendete Runtime werden erkannt.
- Editor: Lern-Event-Preset, Vertragstest und Speichern/JSON-Rundlauf erfolgreich; keine Browserfehler.
- Vollständiger CMS-Browsertest mit hochgeladenem Aufgabenbereich erfolgreich; geprüft werden auch EventEmpfangen und SpielweltBereit auf der Runtime-Schnittstelle.
- Runtime-Bundle und Aufgabenbereich-Pakete erzeugt. Registrierte Upload-Datei nach Sicherung aktualisiert; Spielstatus und Freigaben nicht geändert.

Der Editor-Vertragstest führt absichtlich keine Spiellogik aus. Empfangsschutz ist auf die letzten 256 Kennungen der Runtime begrenzt; dauerhafte Lernbuchungen bleiben serverseitig. Andere Spielwelten müssen ihre Tasks ausdrücklich den passenden Eingängen zuordnen. Kein allgemeiner iframe-/Browserfenster-Transport eingerichtet.

Anleitung: `docs/Stage-Schnittstellen.md`.

# Phase 1 — Abschlussbericht

Stand: 2026-10-17 · Quelle der Wahrheit: `FEATURE-INVENTORY.json` ·
Validator: `npm run docs:check` (0 Fehler / 0 Warnungen zum Zeitpunkt des Berichts)

## Erreichtes (AP 0–AP 7)

| Paket | Ergebnis |
|---|---|
| AP 0/1 | Struktur (`architecture`/`features`/`tutorials`/`reference`/`inventory`), ID-Schema, 12 Features, 204 Dokumente inventarisiert |
| AP 2 | 121 Komponenten-Referenzkarten, 2-Registry-Befund (Editor 112 / Runtime 116 / Dateien 121), 128 COMP-Einträge |
| AP 3 | 7 Runtime-Referenzen (Tasks, Actions, Events, Expressions, Variablen, Multiplayer, Execution-Flow), 59 Action-Typen aus Live-Registry |
| AP 3-QS | TECHNICAL-DEBT.md (TD-001…013), Testläufe dokumentiert (2 stale Tests), `dump-action-metadata.cjs` als Werkzeug |
| AP 4 | 7 Editor-Dokumente (Stage/Flow/Inspector/Views/Projektmanagement), repeat-Befund, Pascal-Roundtrip-Analyse |
| AP 4-QS | TD-009…013, SEC-MP-01…09, Undo/Redo-Skalierungsbefund |
| AP 5 | Spielablauf, Game-Server/Räume/Protokoll, CMS-Sicherheitsarchitektur |
| AP 5-QS | `SECURITY-PLAN.md` SM-1…SM-10 mit Ticket-Contract, Betriebsarten, Rate-Limits |
| AP 6 | CMS- und Lernwelten-Doku aus Benutzerperspektive, Screenshots wiederverwendet, Nachweis-Status-Tabellen |
| AP 7 | Kanonische Kennzeichnung (`canonical`/`supersededBy`), `components-generated.md` + `components.md` redundant (Coverage nachgewiesen: 72/72 abgedeckt), `npm run docs:check`/`docs:build`, `docs/README.md`, `TOOLING.md`, 7 Komponenten kuratiert (TWindow, TStage, TGameLoop, TGameState, TInputController, TTimer, TPanel) |

## Kennzahlen

- **12** Features · **128** Komponenten · **204** inventarisierte Dokumente
- Kuratierte Komponenten-Karten (`docStatus: technisch geprüft`): **10**
  (TButton, TSprite, TTextToSpeech aus QS + 7 Kern-Komponenten AP 7)
- Dokumente `aktuell`: ~34 · `möglicherweise veraltet`: ~86 ·
  `noch nicht bewertet`: ~84 · `redundant`: 2

## Verbleibende Lücken

| Lücke | Kontext | Vorschlag |
|---|---|---|
| **118 Komponenten-Karten nicht kuratiert** | AP 7 deckte nur die Kern-7 | Schritt C aus AP7-Plan fortsetzen: Server-Komponenten (21), dann UI/Input nach Nutzungsfrequenz |
| **84 Alt-Dokumente „noch nicht bewertet"** | nur Metadaten-Sicht | Schritt A des AP7-Plans: stichprobenartige Sichtung, vor allem `use_cases/` und QA-HTMLs |
| **Testabdeckung unbekannt** | `testStatus` beruht auf Namensvorkommen | Test-Läufe systematisch ausführen (Workflow), Ergebnisse in `testRuns` nachpflegen |
| **UI-Verifikation fehlt** | Editor-Funktionen nur quellverifiziert | Manuelle Checkliste je Editor-View; Ergebnis in `reviewDepth`/`testRuns` |
| ~~DOC-IDs nicht stabil~~ | **gelöst** (Abschlusskorrektur) | Merge-basiertes Populate + `meta.nextDocId` + `removed`/`renamedFrom` + Regressionstest `test-inventory-stability.cjs` (19/19 PASS) |
| **Zwei stale Tests** | TD-003, `test-cms-connection` | Testkorrektur — Freigabe nötig |
| **Security-Maßnahmen offen** | SM-1…SM-10 dokumentiert, nicht umgesetzt | Umsetzung Phase-weise nach SECURITY-PLAN |

## Vorschläge für das Benutzerhandbuch (Phase ≥ 2)

Aus den jetzigen Artefakten lassen sich drei Handbuch-Stränge ableiten:

1. **Editor-Handbuch** — `features/editor/*` ist bereits nutzerorientiert
   strukturiert; kuratierte Komponenten-Karten liefern „Was tut das Element?".
   Fehlt: Screenshots der tatsächlichen UI (nur `.codex-work`-Debug-Bilder
   vorhanden), Schritt-für-Schritt-Erstprojekt.
2. **CMS-Handbuch** — `features/cms/README.md` deckt alle Rollen; die 16
   `cms-*.png`-Screenshots können direkt in Anleitungen eingebettet werden.
   Fehlt: dedizierte Anleitung „Haus anlegen → Bewohner → Raum → Spiel
   freigeben".
3. **Autoren-Handbuch** (Spiel bauen) — `reference/*` ist technisch; für
   Autoren fehlt eine Übersetzungsschicht: „Wie baue ich X" → Verweis auf
   Action/Task/Condition statt API-Tabelle. Geeignete Beispielprojekte:
   Breakout (Physik/Stage-Wechsel), Kopfrechnen (Variablen-Events),
   Karteikasten-Quiz (HTTP/Daten).

## Entscheidungen, die Freigabe brauchen

- Löschung/Verschiebung der 2 `redundant`-markierten Dokumente (K1 verneint
  Verschieben — bleiben markiert am Ort)
- Testkorrekturen (TD-003, test-cms-connection)
- Umsetzung der SM-/TD-Maßnahmen (jeweils separat)
- Stabile DOC-ID-Vergabe (siehe Lücken)

# Lernwelten &amp; Beispielprojekte

Dokumentationsstatus: **entwurf** (quellverifiziert; Beispiele aus Bestandsdoku)
Analyse-Stand: `53e3dfb` + uncommittete Änderungen · 2026-10-17

Lernprojekte sind **Anwendungsbeispiele und Nachweise für Engine-Fähigkeiten**
— sie zählen nicht als eigenständige Engine-Features (Freigabe AP 0).
Dieses Dokument katalogisiert sie und beschreibt die didaktischen Bausteine.

## 1. Didaktische Bausteine

### Karteikasten (Leitner-System)

`docs/CMS-Karteikasten.md` — persönliche Karteikästen pro Kind:

```text
flashcards: { childId, subject, topic, question, answers[],
              answerFormat: 'text'|'self', box: 1..6, lastReviewedAt, … }
```

- `box` 1–5 = Lernfächer (Leitner), `box` 6 = „gelernt"-Ablage
- `subject`/`topic` sind dynamischer Freitext aus vorhandenen Karten
- Eltern legen/verwalten Karten (`manageCards`-Permission), Kinder lernen
- **Spiel-Andockung:** Karteikasten-Quiz lädt Karten als Spielfragen

Screenshots (Bestand): `docs/artifacts/counting-game/Karteikasten-Quiz-Bilder.png`,
`docs/Karteikasten-Quiz-Spielbeschreibung.md`, `Karteikasten-Quiz-Papierkarte.md`.

### Lernpunkte &amp; Sponsorbelohnungen

`docs/CMS-Karteikasten-Lernpunkte.md` + `docs/Lernzielkatalog.md`:

- Kinder sammeln **Lernpunkte** beim Karteikasten-Quiz
- Eltern/Observer sehen Punktestand; **Sponsoren** können Belohnungen an
  Punktziele koppeln (Sponsor-Backend, `sponsor-verbesserungen.md`)
- `playSessions` tragen `mathRound`/`taskArea` — Validierung in
  `cms-core.cjs` Z. 37–38 (`validateRound`, `taskArea.validate`)

## 2. Beispiel-Projekte (Nachweise)

| Projekt | Belegt | Doku / Screenshots |
|---|---|---|
| **Breakout** | Stage-Wechsel, Sprite-Physik (`bounce`/`kill`), Score-Variablen, Multiplayer-Sync | `BREAKOUT-LERNPROJEKT.md`, `breakout-start.png`, `breakout-sieg.png` |
| **Snake** | GameLoop, Grid-Bounds, InputController, Tick-basiertes Wachstum | `SNAKE-LERNPROJEKT.md`, `snake-start.png` |
| **Kopfrechnen-App** | Variablen-Events, `triggerValues`, Bereichs-Events, Phasen-Tasks | `Kopfrechnen-App.json`, `Mathematik-Lernspiele-GCS-Ablauf-und-Architektur.md` |
| **Karteikasten-Quiz** | HTTP-Actions (Karten laden), Self-Assessment (`answerFormat:'self'`), Sponsor-Andockung | `Karteikasten-Quiz-*.md`, `artifacts/counting-game/` |
| **PingPong (MP)** | `local-sync`/`broadcast`, Remote-Input, Ready-Handshake | `PingPong-Remote-Synchronisationsplan.md`, `cms-multiplayer-test.png` |
| **Memory (Elin)** | Karten-Grid, Timer, Zustandsvariablen | `debug-elinsmemory.png` |
| **Lernspiel-Gerüst** | Schablone für neue Lernspiele | `Lernspiel-Geruest.md`, `Lernzielkatalog.md` |
| **Quiz mit Sprachausgabe** | `TTextToSpeech`, `TGameServer`-API-Aufrufe | `Quiz_Sprachausgabe.md` |

Generative Projekt-Scaffolding: `scripts/cms/card-authoring`,
`learning-catalog`, `learning-shell`, `math-phase1`, `einmaleins-luecken`,
`cardbox-adventures` u. a. (siehe `scripts/cms/`).

## 3. Wiederverwendete Artefakte

- `docs/artifacts/` — Filter-/Completion-Screenshots der Cardbox-Adventures
  (Mathe-Insel-Flussbrücke, Rechenballons, Rechenpuzzle) inkl. Tablet-Varianten
- `docs/.codex-work/` — Editor-/CMS-Debug-Screenshots (`editor-shelf`,
  `card-learning-points*`, `sponsor-admin`)
- Testskripte: `test-cms-role-model.cjs` (93/93 ✔), `test-cms-sqlite.cjs`
  (12/12 ✔), `test-cms-sql-tool.cjs` (11/11 ✔),
  `test-cms-resident-create-avatar-emoji.cjs` (6/6 ✔)

## 4. Nachweis-Status (Audit-Anforderung)

| Aussage | Nachweis-Status |
|---|---|
| Leitner-Datenmodell (`flashcards`, box 1–6) | **quellverifiziert** (`cms-core.cjs`-Validierung, `CMS-Karteikasten.md`) |
| Lernpunkte-/Sponsor-Kopplung | **dokumentiert** (Bestandsdoku `CMS-Karteikasten-Lernpunkte.md`, `CMS-Sponsor-Umsetzungsplan.md`) — nicht eigenständig UI-geprüft |
| Beispielprojekte (Breakout, Snake, Kopfrechnen, Quiz…) | **Beispiele/Nachweise** — existieren als Projekte/Skripte; keine eigenständige Laufzeitprüfung in dieser Phase |
| Tests `test-cms-*` | **automatisiert ausgeführt** (siehe `FEATURE-INVENTORY.json` `testRuns`) |
| Eltern-/Observer-Sichten | **dokumentiert** aus `cms-profil.png`, `parent-card-learning-points.png` — keine eigene Session |

## 5. Einordnung &amp; Grenzen

- Lernprojekte demonstrieren, dass die Engine die Anforderungen **deklarativ**
  abdeckt — sie sind keine Garantie für neue Engine-Features.
- `Kopfrechnen-App` ist zugleich Test-Fixture für `TaskConditionEvaluator`
  (siehe TD-003 — Test muss an Phasen-Umbau angepasst werden).
- Die Zuordnung Beispiel ↔ Feature steht in `FEATURE-INVENTORY.json`
  (`relatedDocs`/`examples`-Bezüge).

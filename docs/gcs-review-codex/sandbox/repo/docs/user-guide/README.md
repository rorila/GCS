# GCS Autoren-Handbuch

**Zielgruppe:** Menschen ohne Programmierkenntnisse, die mit dem GCS-Editor
eigene Spiele erstellen möchten. Der Aufbau führt von einfachen Schritten zu
fortgeschrittenen Themen (Tasks, Actions, Events, Variablen, Bedingungen,
komplexe Spiellogik).

**Status:** Gliederung + Beispielkapitel (Entwurf) · 2026-10-17
**Regeln:** Jeder Bedienschritt ist quellverifiziert (Editor-Code) — nichts
Erfundenes. Noch nicht implementierte oder nicht UI-geprüfte Funktionen sind
ausdrücklich markiert. `[SCREENSHOT FEHLT: …]` kennzeichnet fehlende Bilder.

## Zwei Spielkonzepte — zwei Lernwege

### 🌱 Einsteiger-Tutorial: „Mein erster interaktiver Baum"

Ein **einfaches Übungsprojekt**: Ein Setzling steht auf einer Wiese. Per
Knopfdruck gießt man ihn — bei genug Wasser wächst er in Stufen. Ein Timer
lässt den Wasservorrat sinken. Ziel: die grundlegende Editor-Bedienung
erlernen (platzieren, Eigenschaften ändern, Events verbinden, testen).

### 🌳 Lernwelt: „Der wachsende Baum" *(fortgeschritten, späterer Teil)*

Das pädagogische Spielkonzept:

- Das Kind beantwortet **Lernaufgaben** (zunächst Mathematik)
- **Richtige Antworten lösen automatische Reaktionen** in der Spielwelt aus
- Der Lernfortschritt steht in einer eigenen Variablen **`RichtigeAntworten`**
  — losgelöst von jeder Gießmechanik (die bleibt dem Einsteiger-Tutorial
  vorbehalten)
- Der Baum wächst in mehreren Stufen — ausgelöst durch `RichtigeAntworten`
- Ab einer bestimmten Baumgröße entsteht ein **Baumhaus** (weitere Stufe,
  ebenfalls durch `RichtigeAntworten` ausgelöst)
- Das Kind kann **zusätzliche Sprites auf den Baum ziehen** und die Welt
  dadurch verändern — automatische Reaktionen + eigene Entscheidungen
- Nach dem Spielziel entscheidet das Kind selbst, ob es neu beginnt

Diese Lernwelt wird im fortgeschrittenen Teil als vollständiges Tutorial
dokumentiert (Teil B). Sie setzt die Einsteiger-Kapitel voraus.

---

## Gliederung — Teil A: Einsteiger („Mein erster interaktiver Baum")

### A1 — Ankommen im Editor

| # | Kapitel | Lernziel | Ergebnis |
|---|---|---|---|
| 1 | [Editor starten & Projekt anlegen](kapitel-01-projekt-anlegen.md) | Projekt-Wizard durchlaufen, erste Stage sehen | Leeres Projekt mit Stage „Die Wiese" |
| 2 | [Der Arbeitsplatz](kapitel-02-arbeitsplatz.md) | Stage-Editor, Toolbox (11 Kategorien), Inspector-Tabs, Menüzeile unterscheiden | Elemente benennen und finden |
| 3 | [Den Baum platzieren](kapitel-03-baum-platzieren.md) | Sprite per Drag&Drop aus Toolbox „Game → Sprite" auf die Stage | Sprite `Baum` sichtbar im Grid |

### A2 — Logik ohne Programmieren

| # | Kapitel | Lernziel | Ergebnis |
|---|---|---|---|
| 4 | [Variablen — der Wasservorrat](kapitel-04-variablen-wasser.md) | `Variable` (Toolbox „Variablen") platzieren, Startwert setzen | Variable `Wasser` = 0 |
| 5 | [Tasks verstehen](kapitel-05-tasks-verstehen.md) | Was ein Task ist; Task anlegen und benennen | Leerer Task `Giessen` existiert |
| 6 | [Aktionen — der Gießen-Knopf](kapitel-06-giess-knopf.md) | Button-Event `onClick` → Task aufrufen; `increment`-Action in den Task legen | Klick erhöht `Wasser` um 1 |
| 7 | [Bedingungen — wann wächst er](kapitel-07-bedingungen.md) | `condition`-Element: „Wasser ≥ 3 → nächste Stufe" | Verzweigung im Task |
| 8 | [Der Flow-Editor](kapitel-08-flow-editor.md) | Aktionen als Knoten visuell verbinden | Task als Flussdiagramm |
| 9 | [Bilder wechseln — Wachstumsstufen](kapitel-09-wachstumsstufen.md) | `property`-Action: Sprite-Stufe je nach `Wasser` | Baum zeigt Stufe passend zu `Wasser` |

### A3 — Leben einhauchen

| # | Kapitel | Lernziel | Ergebnis |
|---|---|---|---|
| 10 | [Der Durst-Timer](kapitel-10-durst-timer.md) | `Timer` + `onTimer` → `Wasser` sinkt | −1 Wasser alle 5 s |
| 11 | [Bildquellen & Media-Tools](kapitel-11-bilder-media.md) | Image List (3×1) + Sprite-Frame-Bindung | Baum zeigt echte Bilder |
| 12 | [Spielzustand mit Game State](kapitel-12-game-state.md) | `Game State` (Toolbox „Game"): `won` + Toast | Erfolgsmeldung |

### A4 — Testen & Teilen

| # | Kapitel | Lernziel | Ergebnis |
|---|---|---|---|
| 13 | [Im Run-Modus testen](kapitel-13-run-test.md) | Run-Ansicht (arbeitet auf Projekt-Klon) | Spiel läuft, Rückkehr zum Editor |
| 14 | [Speichern & Export](kapitel-14-export.md) | Datei→Speichern, Plattform→Export als ZIP | ZIP-Paket für CMS-Upload |
| 15 | [Feintuning](kapitel-15-feintuning.md) | Undo/Redo (Strg+Z), Themes, Stage duplizieren | Projekt verfeinert |

---

## Gliederung — Teil B: Fortgeschrittene („Der wachsende Baum")

> Voraussetzung für alle B-Kapitel: Teil A abgeschlossen.

| # | Kapitel | Lernziel | Neue Konzepte |
|---|---|---|---|
| B1 | [Die Aufgaben-Stufe](b-kapitel-01-aufgaben-stufe.md) | Mathe-Frage anzeigen (Label/Edit), Antwort prüfen | `Edit`-Feld, `condition` mit Vergleich, Task „Antwort prüfen" |
| B2 | [Lernfortschritt zählen](b-kapitel-02-richtige-antworten.md) | Variable `RichtigeAntworten` — richtige Antwort erhöht sie um 1 | `increment`-Action, Variable unabhängig von Spielmechanik |
| B3 | [Richtige Antwort → Weltreaktion](b-kapitel-03-weltreaktion.md) | `onValueChanged` auf `RichtigeAntworten` → Baumstufe prüfen | Variablen-Events (`onValueChanged`, `onThresholdReached`) |
| B4 | [Das Baumhaus entsteht](b-kapitel-04-baumhaus.md) | Ab Schwellwert: `visible` freischalten oder `spawn_object` | Sichtbarkeit, Objekt-Erzeugung zur Laufzeit |
| B5 | [Dekor-Sprites per Drag-and-drop](b-kapitel-05-dragdrop.md) | Sprites per Drag auf den Baum ziehen | `draggable`, `droppable`, `onDrop` mit `draggedName` |
| B6 | [Selbst entscheiden: Neustart](b-kapitel-06-neustart.md) | Nach Ziel: Kind wählt Neustart selbst | `restart_game`, Wahl-UI per `visible` |
| B7 | [Neue Aufgaben automatisch](b-kapitel-07-zufallsaufgaben.md) | Zufallszahlen + `calculate` erzeugen neue Aufgaben | `Random`-Variable, `randomValue`, Formel |
| B8 | [Feinschliff & Abschluss](b-kapitel-08-feinschliff.md) | Start-Stage, Übergang (`navigate_stage`), Sound | Stage-Wechsel, `TAudio`/`play_audio` |

---

## Kapitel-Aufbau (alle Kapitel einheitlich)

Jedes Kapitel enthält: **Lernziel · Voraussetzungen · Verwendete Bausteine
(kurz erklärt) · Bedienungsschritte · Erwartetes Ergebnis · Selbst prüfen
(Funktionsprüfung) · Typische Stolpersteine · Was du gelernt hast · Quellen.**
Vorlage: [`_vorlage.md`](_vorlage.md)

## Bewusst NICHT im Handbuch (Unstimmigkeiten)

- **„Repeat Loop"** im Flow-Editor — zur Laufzeit wirkungslos (TD-009) →
  `while` wird stattdessen gezeigt
- **Pascal-Ansicht bearbeiten** — Rückübertragung kann Logik verlieren
  (TD-010) → nur als Ansicht erwähnt
- **`TForEach`/`TOverlay`/`TSpeedlines`** — laufzeitfähig, aber nicht in der
  Toolbox (TD-011)

## Screenshot-Plan

Vorhanden: `docs/breakout-start.png` (Spielbeispiel), `.codex-work/editor-shelf.png`.
Fehlend (im Text markiert): Menü „Datei" · beide Wizards · Toolbox „Game" ·
Drag&Drop-Geste · Inspector-Tab · Event-Picker · Task-/Flow-Editor · Run-Modus ·
Lernwelt-Bilder (Baumstufen, Baumhaus, Dekor-Sprites).

## Wissensbasis

Editor: `docs/features/editor/` · Bausteine: `docs/reference/components/` ·
Aktionen/Bedingungen: `docs/reference/` · Offene Punkte: `docs/inventory/TECHNICAL-DEBT.md`

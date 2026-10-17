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
| 7 | Bedingungen — wann wächst er | `condition`-Element: „Wasser ≥ 3 → nächste Stufe" | Verzweigung im Task |
| 8 | Der Flow-Editor | Aktionen als Knoten visuell verbinden | Task als Flussdiagramm |
| 9 | Bilder wechseln — Wachstumsstufen | `property`-/`set`-Action: Sprite-Bild je Stufe tauschen | Baum zeigt Stufe passend zu `Wasser` |

### A3 — Leben einhauchen

| # | Kapitel | Lernziel | Ergebnis |
|---|---|---|---|
| 10 | Der Durst-Timer | `Timer` + `onTimer` → `Wasser` sinkt | −1 Wasser alle 5 s |
| 11 | Bildquellen & Media-Tools | Bildimport, Bildaufteiler (Sprite-Stadien aus einem Bild) | Drei Baum-Bilder eingebunden |
| 12 | Spielzustand mit Game State | `Game State` (Toolbox „Game"): `won` bei voller Stufe | Erfolgsmeldung |

### A4 — Testen & Teilen

| # | Kapitel | Lernziel | Ergebnis |
|---|---|---|---|
| 13 | Im Run-Modus testen | ▶-Ansicht (arbeitet auf Projekt-Kopie) | Spiel läuft, Rückkehr zum Editor |
| 14 | Speichern & Export | Datei→Speichern, Plattform→Export als ZIP | `mein-baum.zip` für CMS-Upload |
| 15 | Feintuning | Undo/Redo (Strg+Z/Y), Themes, Stage duplizieren | Projekt verfeinert |

---

## Gliederung — Teil B: Fortgeschrittene („Der wachsende Baum")

> Voraussetzung für alle B-Kapitel: Teil A abgeschlossen.

| # | Kapitel | Lernziel | Neue Konzepte |
|---|---|---|---|
| B1 | Die Aufgaben-Stufe | Mathe-Frage anzeigen (Label/Edit), Antwort prüfen | `Edit`-Feld, `condition` mit Vergleich, Task „Antwort prüfen" |
| B2 | Lernfortschritt zählen | Variable `RichtigeAntworten` — richtige Antwort erhöht sie um 1 | `increment`-Action, Variable unabhängig von Spielmechanik |
| B3 | Richtige Antwort → Weltreaktion | Event-Kette: `RichtigeAntworten` ändert sich → Baumstufe prüfen | Variablen-Events (`onChange`, `triggerValues`, `range`) |
| B4 | Das Baumhaus entsteht | Ab Schwellwert von `RichtigeAntworten`: neues Objekt einblenden/`spawn_object` | Objekt-Erzeugung zur Laufzeit |
| B5 | Eigene Entscheidungen — Dekor-Sprites | Sprites per Drag auf den Baum ziehen | Drag&Drop zur Laufzeit, `droppable`, `onDrop`-Events |
| B6 | Neustart-Frage | Nach Ziel: Kind wählt Neustart selbst | `restart_game`-Action, `confirm`-Dialog |
| B7 | Mehrere Aufgaben-Typen | Zweites Fach/Aufgabentyp ergänzen | Tasks parametrisieren, Wiederverwendung |
| B8 | Feinschliff | Splash-Stage, Übergänge (`navigate_stage`), Sound | Stage-Wechsel, `TAudio` |

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

# Kapitel 15 — Feintuning & Abschluss des Grundkurses

> Status: **quellverifizierter Entwurf** — Undo/Redo, Stage-Duplikat und
> Theme-Schalter nachgewiesen; Optik im Detail UI-ungeprüft. 2026-10-17

## Lernziel

Am Ende dieses Kapitels kannst du Fehler **rückgängig** machen, eine Stage
**duplizieren** und dem Editor ein **andere Farbkleid** geben — der
Grundkurs ist abgeschlossen.

## Voraussetzungen

- Kapitel 1–14 abgeschlossen (fertiges Spiel „Mein erster interaktiver Baum").

## Verwendete Bausteine

| Baustein | Was er tut | Woher |
|---|---|---|
| **Rückgängig / Wiederholen** | Arbeitsschritte zurücknehmen | Tastatur `Strg+Z` / `Strg+Umschalt+Z` |
| **Stage duplizieren** | Kopie einer Stage | Menü **Stage → Stage duplizieren** |
| **Theme wechseln** | Editor-Farbschema | Menü **Ansicht → Theme wechseln** |

> **Nachweis:** `Strg+Z`/`Strg+Umschalt+Z` im `EditorCommandManager`;
> Menüeinträge in `menu_bar.json` (`menu_stage_duplicate`, Ansicht-Menü).

## Bedienungsschritte

### Schritt 1 — Rückgängig ausprobieren

1. Verschiebe den `Baum` mit der Maus ein Stück.
2. Drücke **`Strg+Z`** → der Baum springt zurück.
3. Drücke **`Strg+Umschalt+Z`** → die Verschiebung ist wieder da.

Das funktioniert für die meisten Änderungen (Position, Eigenschaften,
neue Bausteine).

`[SCREENSHOT FEHLT: Baum verschoben → Strg+Z → zurück an Position]`

### Schritt 2 — Stage duplizieren (Übungskopie)

1. Menü **Stage → Stage duplizieren**.
2. Es entsteht eine Kopie von „Die Wiese" — praktisch zum Experimentieren,
   ohne das Original zu gefährden.
3. Duplikat anschließend über **Stage → Stage löschen** wieder entfernen
   *(Menüpunkt vorhanden, UI-ungeprüft)* — oder behalten als Spielwiese
   für Ideen.

### Schritt 3 — Theme wechseln

1. Menü **Ansicht → Theme wechseln**.
2. Der Editor wechselt z. B. zwischen hellem und dunklem Farbschema —
   rein optisch, ändert nichts am Spiel.

### Schritt 4 — Abschluss-Check des Projekts

| Was | Soll-Zustand |
|---|---|
| Variable `Wasser` | Stage-Scope, Integer, Start 0 |
| Task `Giessen` | `onClick` des Buttons → `increment` |
| Durst | Timer `Durst` (5000 ms) → `decrement` mit Boden-0-Bedingung |
| Wachstum | `Wasser>=3` → Stufe 2, `Wasser>=6` → Stufe 3 + `state=won` + Toast |
| Bilder | `BaumStufen` (3×1), Sprite-Bindung `spritesheet` |

## Erwartetes Ergebnis

Du beherrschst Undo/Redo, kannst Stages kopieren und Themes wechseln —
und dein Projekt erfüllt alle Punkte der Abschluss-Checkliste.

## Selbst prüfen (Funktionsprüfung)

- [ ] `Strg+Z` nimmt eine Verschiebung zurück
- [ ] Stage-Duplikat erscheint im Stage-Auswahl-Bereich
- [ ] Theme-Wechsel ändert Editor-Farben, nicht das Spiel
- [ ] Abschluss-Checkliste komplett abgehakt

## Typische Stolpersteine

- **Undo wirkt nicht im Flow** → Undo deckt Stage/Inspector-Änderungen ab;
  Flow-Knoten ggf. manuell entfernen (Rechtsklick-Optionen).
- **Duplikat vergessen zu löschen** → harmlose Übungskopie, aber sie
  bläht das Projekt auf.
- **Theme „kaputt"** → nur Optik; erneut wechseln stellt zurück.

## Was du gelernt hast

✔ Undo/Redo im Editor
✔ Stages duplizieren und löschen
✔ Editor-Themes wechseln
✔ Das komplette Grundkurs-Projekt im Überblick

## Medien-Vorschlag

**Video (ca. 45 s):** „Rückgängig, Kopieren, Umstylen"
**Sprecher-Drehbuch:** „Drei Werkzeuge für den Alltag: Strg+Z nimmt Fehler
zurück — Baum verschieben, rückgängig, wieder da. Über Stage duplizieren
bekommst du eine Spielwiese zum Experimentieren. Und wer den Editor lieber
dunkel mag: Ansicht, Theme wechseln. Dein Projekt ist fertig — in Teil B
wird aus dem Baum eine Lernwelt."
**Sync-Hinweise:** Nahaufnahme Tastatur-Einblendung bei Strg+Z, Schnitt
auf Stage-Menü, abschließend Theme-Vorher/Nachher-Blendung.

## Ausblick — Teil B „Der wachsende Baum"

Der Grundkurs endet hier. Teil B baut ein **Lernspiel**: Mathe-Aufgaben
beantworten, `RichtigeAntworten` zählen, Baum und Baumhaus durch
Lernfortschritt auslösen, Deko-Sprites per Drag-and-drop — und am Ende
entscheidet das Kind selbst über den Neustart.

---

*Quellen: `src/editor/EditorCommandManager.ts` (Undo/Redo-Kürzel),
`public/editor/menu_bar.json` (Stage → duplizieren/löschen,
Ansicht → Theme wechseln).*

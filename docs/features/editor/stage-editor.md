# Feature: Stage-Editor, Toolbox &amp; Komponentenverwaltung

> **Status:** `entwurf` · code-belegt, nicht UI-getestet
> **Quellen:** `src/editor/Stage.ts`, `src/editor/JSONToolbox.ts`, `src/editor/JSONComponentPalette.ts`, `src/editor/EditorSidepanel.ts`, `src/editor/EditorShelfModel.ts`, `src/editor/EditorStageManager.ts` (698 Z.), `src/editor/services/StageInteractionManager.ts`, `public/editor/toolbox.json`

## 1. Stage-Arbeitsfläche

**Zweck:** Visuelle Anordnung der Komponenten einer Stage (Position, Größe, Auswahl).

**Ort:** View `stage` (Standard nach Projekt-Start).

**Bedienung (code-belegt):**
- Objekte werden aus der Toolbox/Palette per **Drag &amp; Drop** auf die Stage gezogen (`DnDHelper`, `tool-drop`-Payload) oder per Klick ausgewählt
- `Stage` rendert die Design-Fläche mit **Grid** (`cols`/`rows`/`cellSize`, z. B. 64×40 à 20 px)
- Mehrfachauswahl und Löschen über `EditorCommandManager`; Löschen referenzierter Objekte öffnet einen **Refactoring-Report-Dialog** (`removeObjectWithConfirm`) — zeigt Nutzungsstellen, warnt bei geerbten (Blueprint-)Objekten
- `StageInteractionManager`/`StageInteractionHost` kapseln Drag-/Resize-/Selektionslogik

**Runtime-Bezug:** Design-Objekte werden beim Speichern/Run über `RuntimeStageManager`/`hydrateObjects` zu Runtime-Komponenten.

## 2. Toolbox (links)

**Zweck:** Katalog platzierbarer Komponenten.

**Ort:** linkes Panel, Container `json-toolbox-content` (View `stage`).

**Bedienung:**
- Datengetrieben aus `public/editor/toolbox.json` (vertikal) / `toolbox_horizontal.json` (horizontal, Toggle-Button `toolbox-layout-toggle`)
- Kategorien klappbar (▼/▶) mit Item-Zähler-Badge
- Item = `type` + `icon` + `label`; Drag → `DnDHelper` (`type: 'tool-drop'`), Klick = Fallback → `onAction('click', tool.type)`

**Kategorien &amp; Inhalte (aus `toolbox.json`, code-belegt):**

| Kategorie | Items | Beispiele |
|---|---|---|
| Standard | 12 | Sticky Note, Panel, Group Container, Card, Card Zone, Button |
| Media | 10 | Bildaufteiler, Puzzle-Ablage, Bildergalerie, Image, Image List, Audio |
| Erweitert | 8 | Dropdown, Checkbox, Color Picker, Number Input, Tab Control, Table |
| Game | 12 | Shape, Sprite, Sprite Template, Game Header, Game Card, Game State |
| Variablen | 10 | Variable, String Map, Timer, Object List, Threshold, Trigger, Range |
| System | 10 | Game Loop, Input Controller, Virtual Gamepad, Intervall-Timer, Game Server |
| Daten &amp; Auth | 3 | Database, Auth Service, User Manager |
| Dialogs | 8 | Dialog Root, Theme Dialog, Overlay, Side Panel, Info Window, Toast |
| Overlays | 2 | Inline-Overlay, Lernpunkte |
| Server-Workflow | 6 | Request empfangen, Eingaben prüfen, Zugang prüfen, Verwaltungssitzung, Response, Profil |
| Dateien/Upload | 3 | Datei auswählen, Datei übertragen, Upload prüfen/speichern |

**Einschränkung:** Toolbox-Einträge ≠ Registry — `TForEach`, `TOverlay`, `TSpeedlines` sind lauffähig, aber **nicht** in der Toolbox (siehe `docs/reference/components/`).

## 3. Komponenten-Palette

**Zweck:** Alternative Such-/Drop-Quelle für Komponenten.

**Quelle:** `JSONComponentPalette.ts` — Toolbar + scrollbare Palette, `onDrop(type,x,y)`-Callback, Drag-Source pro Item.

## 4. Sidepanel / Regal (`EditorSidepanel` + `EditorShelfModel`)

**Zweck:** Schnellzugriff auf projekteigene Elemente (z. B. wiederkehrende Objekte, verwaltete Elemente).

- Gruppierung in aufklappbare Sektionen (`shelf-section`), Filter-Textfeld, Resize-Griff
- `collectShelfItems` + `isAutomaticShelfObject` steuern, was im Regal erscheint
- `hideManagedObjectsOnStage` blendet regal-verwaltete Objekte auf der Stage aus

## 5. Stage-Verwaltung (Menü „Stages")

Quelle: `menu_bar.json` + `EditorStageManager.ts`.

| Aktion | Funktion |
|---|---|
| Neue Stage | `createStage(type)` — Typen aus `StageType` |
| Neuer Splashscreen | Stage vom Typ Splash |
| Stage duplizieren | `stage-duplicate` |
| Stage löschen | `delete-stage` (mit Bestätigung) |

Zusätzlich `EditorStageImporter.importStageFromFile()`: Stage **aus anderem Projekt-JSON** importieren (Blueprint ausgeschlossen; bei Ein-Stage-Projekten Direktimport, sonst Auswahldialog).

## 6. Einschränkungen &amp; offene Punkte

- Grid ist fix pro Projekt (`cols/rows/cellSize`) — kein UI für nachträgliche Grid-Änderung gefunden
- Geerbte Blueprint-Objekte werden global gelöscht — Warnung vorhanden, kein „nur lokal entfernen"
- Keine Snap-/Alignment-Funktionen im Code gefunden (außer Grid)
- `Stage`-Klasse enthält auch einfache Listen-/Tabellen-Renderpfade (Z. 411/516) — Mehrzweckklasse

## 7. Beispiel

Ein `TButton` per Drag aus „Standard" auf die Stage → `commandManager.addObject('TButton', x, y)` → Objekt in `stage.objects[]` → Inspector zeigt Properties.

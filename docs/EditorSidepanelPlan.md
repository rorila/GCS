# Plan: Editor-Sidepanel für nicht-sichtbare Komponenten

## Ziel

Im Editor soll ein seitliches Panel über einen Hamburger-Button erreichbar sein, das alle Komponenten auflistet, die im Run-Modus nicht angezeigt werden (`isHiddenInRun`, `visible = false`, Logik-Komponenten wie `TTimer`, `TGameLoop`, etc.). Das Panel gliedert die Komponenten in Sektionen, bietet Filter/Suche und ermöglicht schnelles Editieren.

## Schritt-für-Schritt-Umsetzung

### Schritt 1: UI-Skelett

- **Hamburger-Button** oben in der Editor-Toolbar platzieren.
- **Slide-in-Panel** rechts oder links (`width: 320px`, `transition: transform 0.25s ease`).
- Offen/Geschlossen-Status in `Editor.ts`/`UIState` speichern.
- Panel initial leer, nur Header + Close-Button.

### Schritt 1.5: Workflow — Objekt auf die Stage ziehen und ins Sidepanel verschieben

- Nutzer platziert eine nicht-sichtbare/Logik-Komponente wie gewohnt auf der Stage.
- Das Objekt bleibt auf der Stage sichtbar, bis der Nutzer es aktiv in das Sidepanel überführt.
- Im Kontextmenü einer markierten Komponente erscheint der Eintrag **"In Sidepanel verschieben"** (alternativ: Button in der Selection-Toolbar).
- Beim Verschieben:
  - `obj.isManagedInSidepanel = true` (oder `isHiddenInRun = true`) wird gesetzt.
  - Das Objekt wird in das Sidepanel aufgenommen und in die passende Sektion sortiert.
  - Auf der Stage bleibt es optional als kleines, transparentes Ghost-Icon oder wird vollständig ausgeblendet (Einstellung).
- Aus dem Sidepanel kann das Objekt optional zurück auf die Stage gezogen werden ("Zurück auf Stage platzieren").

### Schritt 2: Komponenten ermitteln

- Filterlogik: `obj.visible === false || (obj as any).isHiddenInRun === true || isLogicComponent(obj.className)`.
- `isLogicComponent()`-Helfer für Klassen wie `TTimer`, `TGameLoop`, `TInputController`, `TGameState`, `TGameServer`, `THandshake`, `THeartbeat`, `TStageController`, `TVariable`.
- Datenquelle: `project.objects` bzw. `coreStore.getProject().objects`.

### Schritt 3: Sektionen und Filter

- Gruppierung nach `className` oder einer erweiterten Kategorie (`Logik`, `Input`, `Netzwerk`, `Variablen`, `UI (versteckt)`).
- Aufklappbare Sektionen (Accordion).
- Suchfeld oben im Panel, das Name und Typ filtert.
- Zähler pro Sektion (`Timer (3)`, `InputController (1)`).

### Schritt 4: Listen-Ansicht pro Komponente

- Liste mit: Name, Mini-Icon/Indikator, aktuellem Status (z.B. Timer-Laufzeit, NumberLabel-Wert).
- Klick auf Eintrag öffnet den Inspector für diese Komponente.
- Rechtsklick/Kontextmenü: Umbenennen, Löschen, Duplizieren.
- "+"-Button pro Sektion zum Erstellen einer neuen Logik-Komponente dieses Typs.

### Schritt 5: Stage-Aufräumen

- Toggle "Nur sichtbare Objekte auf der Stage anzeigen".
- Objekte, die ins Sidepanel verschoben wurden, werden auf der Stage ausgeblendet oder als kleine Ghost-Icons dargestellt.
- Kein automatisches Verschieben: Der Nutzer entscheidet pro Objekt, ob es im Sidepanel verwaltet werden soll.

### Schritt 6: Testing & Refinement

- Großes Projekt laden und Panel auf Performance prüfen.
- Keyboard-Shortcuts (z.B. `Strg+Shift+L` zum Öffnen/Schließen).
- Test: Neues Objekt anlegen, Inspector-Öffnung, Löschen, Filterung.

## Optionale Erweiterungen

- Favoriten/Recent-Liste im Panel.
- Farbige Tags pro Komponententyp.
- Drag & Drop zum Umsortieren in Sektionen.
- Gruppen/Ordner für eigene Logik-Cluster (z.B. `Player-Logik`, `Level-Logik`).

## Betroffene Dateien (Vorschlag)

- `src/editor/Editor.ts` – Button + Panel-State.
- `src/editor/services/renderers/` oder neuer `src/editor/sidepanel/` Ordner.
- `src/editor/inspector/InspectorRenderer.ts` – Öffnen des Inspectors aus dem Panel.
- `src/services/registry/CoreStore.ts` – ggf. Hilfsgetter für gefilterte Objekte.

# Plan: Editor-Sidepanel als dynamisches Regal

## Ziel

Im Editor soll ein seitliches Panel (Regal) über einen Hamburger-Button erreichbar sein, in dem Komponenten aufbewahrt werden können, die gerade nicht im Fokus des Users liegen. Das Panel gliedert die Komponenten nach Typ in Sektionen, bietet Filter/Suche und ermöglicht schnelles Editieren.

## Konzepte

- **Regal pro Stage**: Jede Stage besitzt ihr eigenes Sidepanel. Objekte, die in das Regal verschoben werden, bleiben der Stage zugeordnet.
- **Manuelle Steuerung**: Der Nutzer entscheidet pro Objekt, ob es im Regal verwaltet wird. Es findet kein automatisches Verschieben beim Projekt-Laden statt.
- **Kein Verlust von Stage-Eigenschaften**: Beim Verschieben in das Regal oder zurück auf die Stage werden Position/Größe/Rotation (`x`, `y`, `width`, `height`, `rotation`, etc.) nicht verändert.
- **Status-Flag**: Jede Komponente erhält die Eigenschaft `isManagedInSidepanel: boolean`. Ist sie `true`, erscheint das Objekt im Sidepanel der aktuellen Stage und kann auf der Stage ausgeblendet werden.

## Schritt-für-Schritt-Umsetzung

### Schritt 1: UI-Skelett

- **Hamburger-Button** immer im Editor-Tab-Menü sichtbar (dynamisch erzeugen, falls Template fehlt).
- **Slide-in-Panel** rechts (`width: 320px`, `transition: transform 0.25s ease`).
- Offen/Geschlossen-Status in `Editor.ts` speichern.
- Panel initial leer, nur Header + Close-Button + Suchfeld.

### Schritt 2: Workflow — Objekte in das Regal verschieben und zurückholen

- Im Kontextmenü einer markierten Komponente erscheint der Eintrag **"In Sidepanel verschieben"**.
- Beim Verschieben:
  - `obj.isManagedInSidepanel = true` wird im Projekt-JSON gesetzt.
  - Sofort danach `autoSaveToLocalStorage()` auslösen, damit das Flag persistiert wird.
  - Das Objekt wird in das Sidepanel der aktuellen Stage aufgenommen und in die passende Sektion sortiert.
  - Auf der Stage wird es optional ausgeblendet (Toggle "Verwaltete Objekte auf der Stage ausblenden").
- Im Sidepanel-Kontextmenü eines Eintrags erscheint **"Auf Stage zurückholen"**.
- Beim Zurückholen:
  - `obj.isManagedInSidepanel = false` wird gesetzt.
  - Sofort danach `autoSaveToLocalStorage()` auslösen, damit das Flag persistiert wird.
  - Das Objekt erscheint wieder auf der Stage an seiner ursprünglichen Position.

### Schritt 3: Komponenten ermitteln

- Datenquelle: Objekte der aktuellen Stage (`project.stages[].objects`).
- Filter: `obj.isManagedInSidepanel === true`.
- Keine automatische Erkennung nach `visible` oder `isHiddenInRun` — der Nutzer steuert explizit, was im Regal landet.

### Schritt 4: Sektionen und Filter

- Gruppierung nach `className` (z.B. `TTimer`, `TInputController`).
- Aufklappbare Sektionen (Accordion).
- Suchfeld oben im Panel, das Name und Typ filtert.
- Zähler pro Sektion (`Timer (3)`, `InputController (1)`).

### Schritt 5: Listen-Ansicht pro Komponente

- Liste mit: Name, Mini-Icon/Indikator.
- Klick auf Eintrag öffnet den Inspector für diese Komponente.
- Rechtsklick/Kontextmenü: Umbenennen, Löschen, Duplizieren, Auf Stage zurückholen.
- "+"-Button pro Sektion zum Erstellen einer neuen Komponente dieses Typs (optional).

### Schritt 6: Stage-Aufräumen

- Toggle im Sidepanel: "Verwaltete Objekte auf der Stage ausblenden".
- Ist der Toggle aktiv, werden Objekte mit `isManagedInSidepanel === true` beim Stage-Rendering gefiltert.
- Standard: aktiv, sobald mindestens ein Objekt ins Regal verschoben wurde.

### Schritt 7: Persistenz

- `isManagedInSidepanel` muss im Projekt-JSON erhalten bleiben.
- Beim Verschieben/Zurückholen wird sofort `autoSaveToLocalStorage()` aufgerufen, damit das Flag in LocalStorage/IndexedDB landet.
- Beim Auto-Save (LocalStorage/IndexedDB) wird das aktuelle Projekt inklusive Flag gespeichert.
- Beim Laden eines Projekts werden Objekte mit `isManagedInSidepanel === true` automatisch in das Sidepanel der jeweiligen Stage geladen.

### Schritt 8: Testing & Refinement

- Großes Projekt laden und Panel auf Performance prüfen.
- Keyboard-Shortcut `Strg+Shift+L` zum Öffnen/Schließen.
- Test: Verschieben, Zurückholen, Löschen, Umbenennen, Filterung, Neuladen der Seite.

## Optionale Erweiterungen

- Favoriten/Recent-Liste im Panel.
- Farbige Tags pro Komponententyp.
- Drag & Drop zum Umsortieren in Sektionen.
- Gruppen/Ordner für eigene Logik-Cluster.

## Betroffene Dateien

- `src/editor/Editor.ts` – Button + Panel-State + Verschiebe-Methoden.
- `src/editor/EditorSidepanel.ts` – Panel-UI.
- `src/editor/services/EditorInteractionManager.ts` – Kontextmenü-Einträge.
- `src/editor/services/EditorRenderManager.ts` – Filter für Stage-Rendering.
- `src/model/types.ts` – `isManagedInSidepanel` in `ComponentData`.
- `src/editor/services/EditorDataManager.ts` – Auto-Save.

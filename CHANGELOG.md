# Changelog

## [Unreleased] - 2026-01-16

### Added
- **JSON-Editor Synchronisierung:** Neuer `syncFlowChartsWithActions()` in `Editor.ts` und `syncActionsFromProject()` in `FlowEditor.ts`. Änderungen an Actions im JSON-Editor werden nun korrekt in alle FlowChart-Elemente synchronisiert und im LocalStorage gespeichert. 🔧

### Fixed
- **LocalStorage Persistenz:** Änderungen im JSON-Editor werden nun korrekt ins LocalStorage übernommen. Vorher wurden FlowChart-Elementdaten nicht mit `project.actions` synchronisiert.

## [Previous] - 2026-01-15

### Added
- Debug-Logging für `AnimationManager` und `JSONInspector` (temporär während Debugging). 🎾 ✨

### Fixed
- **Inspector Events:** Fix für fehlende Anzeige des `onClick`-Events bei Buttons. `TPanel` mit `_isRowWrapper` wird nun korrekt als eigenständiges Element behandelt und nicht mehr fälschlicherweise als Input mit dem vorherigen Label gruppiert. 🎾 ✨
- **Ball Bewegung:** Problem behoben, bei dem der Ball während der Start-Animation bereits Boundary-Events auslöste. `TGameLoop` überspringt nun Physik- und Boundary-Checks für Sprites, die gerade animiert werden (`isAnimating`). 🎾 ✨
- **Inspector-Display Fix:** Beim Laden des Projekts werden nun auch die Stage-Animationseigenschaften (`startAnimation` etc.) korrekt wiederhergestellt, sodass sie im Inspector sichtbar bleiben. 🎾 ✨
- **Start-Animation Persistence:** Die Einstellungen für Start-Animationen (`startAnimation`, `duration`, `easing`) werden nun korrekt vom Inspektor in das Projekt-File und in die Editor-Stage übertragen und somit gespeichert. 🎾 ✨
- **Fix**: Rendering-Bug behoben, bei dem Objekte im "Run"-Modus nicht aktualisiert wurden (Fix der doppelten GameLoop-Initialisierung).
- **Refactor**: Editor-Initialisierung bereinigt, `GameRuntime` übernimmt nun die Kontrolle über den Render-Loop.
- **Cleanup**: Debug-Logs und unnötige Kommentare entfernt.
- **Animation Robustheit:** `AnimationManager` setzt nun das `isAnimating`-Flag auch beim Abbrechen von Tweens (`cancelTween`) zuverlässig zurück, um die Physik-Reaktivierung zu garantieren. 🎾 ✨
- **Grid Bounds:** Fix für fehlerhafte Grenzerkennung im GameLoop. Der Zugriff auf `cols` und `rows` unterstützt nun auch verschachtelte Grid-Konfigurationen (`grid.cols`/`grid.rows`), was verfrühte "Bottom-Hits" bei 24 Zeilen (statt 40) verhindert. 🎾 ✨
- **Game Runtime:** Fehlende Check-Abfrage für `moveTo` in `GameRuntime.ts` hinzugefügt, um Abstürze bei nicht-visuellen Objekten zu vermeiden. 🎾 ✨
- **Fix**: Data Persistence im Action Editor korrigiert (Parametereingaben werden jetzt gespeichert).
- **Fix**: Rendering-Performance im Run-Mode verbessert (Doppelten Render-Loop entfernt, "Zappeln" behoben).
- **Fix**: Syntax-Fehler im `JSONDialogRenderer` behoben, der den Action-Editor blockierte.
- **Improved**: `Stage`-Klasse um fehlende Animations-Eigenschaften erweitert.
- **Improved**: `TDebugLog` zeigt nun Methoden-Details (Parameter) für `call_method`-Actions an. 🎾 ✨
- **Improved**: `TaskExecutor` loggt nun Fehler bei der Action-Ausführung explizit in den Debug-Viewer ("ERROR"-Event). 🎾 ✨

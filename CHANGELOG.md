# Changelog

## 2026-04-27
### Fixed
- **TypeScript Compiler Error**: Ungenutzter Import `projectActionRegistry` in `src/editor/Editor.ts` entfernt, um Compiler-Fehler (TS6133) zu beheben.
- **ObjectRegistry (Inspector Dropdowns):** Ein Problem behoben, bei dem Objekte im Inspector (z.B. im Action Editor unter "Ziel-Objekt") mehrfach mit demselben Namen aufgeführt wurden, wenn globale Stages (wie die Blueprint-Stage) kopiert oder Komponenten identisch benannt wurden.
- **Bugfix (Refactoring):** Ein schwerer Logikfehler im `ObjectRefactoringService` wurde behoben. Bisher wurden bei der Umbenennung eines Objektes versehentlich *alle* Objekte im Projekt, die exakt denselben Namen trugen, mit umbenannt. Die Funktion aktualisiert jetzt korrekterweise nur noch die Objektreferenzen.
- **Bugfix (RefactoringUtils):** `replaceInObjectRecursive` unterstützt nun ein Array an `ignoreKeys` (z. B. `['name', 'id']`), um zu verhindern, dass die internen Metadaten fremder Objekte ungewollt vom globalen Refactoring überschrieben werden.
- **Deduplizierung:** Einträge im Inspector-Dropdown (Zielobjekte) werden nach `name` dedupliziert, um identische Listeneinträge zu verhindern.
- **Scope-Korrektur:** Die automatische Zuweisung von `scope: 'global'` im `EditorCommandManager` wird jetzt verlässlich nur noch für die *echte* Blueprint-Stage durchgeführt.
- **Daten-Sanitization:** Der `ProjectStore` repariert nun beim Laden (in `setProject`) kaputte Scopes ("global" auf Standard-Stages) und fehlerhaft markierte Stages (`type: 'blueprint'`), um Geisterobjekte zu entfernen.
- **AnimationManager (Flip Event)**: Das Event `onFlipMidpoint` bei Flip-Animationen (z.B. bei `TCard` oder `TImage`) wird nun korrekt gefeuert und vom System registriert. Der `AnimationManager` verwendet nun das richtige DOM-Event `GameRuntime_Event`. Zudem wurde `onFlipMidpoint` als offizielles Event in der Basis-Klasse `TWindow` registriert und ist somit für **alle** visuellen Komponenten im Inspector auswählbar.
- **Standalone Player / IFrame:** Der `onFlipMidpoint`-Event wurde in der IFrame-Vorschau nicht ausgelöst, da das Standalone-Bundle (`public/runtime-standalone.js`) nach den Anpassungen in `AnimationManager.ts` und `GameRuntime.ts` nicht neu kompiliert wurde. Durch ein erneutes Ausführen von `npm run bundle:runtime` wurde die Runtime für den IFrame-Modus synchronisiert und empfängt nun die Events korrekt.
- **Event-Inspector:** Task-Entkopplung für Events eingeführt. Eine neue `- Task auswählen... -` Option mit leerem String (`""`) ermöglicht das gezielte Entfernen von Event-Bindungen.
- **Legacy Fallback Bug:** Logik in `GameRuntime.ts` korrigiert, damit ein leerer String bei Event-Bindungen als explizite Entkopplung gewertet wird und nicht den Legacy-Fallback (alte Task-Zuordnungen) auslöst.

## 2026-04-26
### Fixed
- **ProjectStore (Object Reparenting)**: Behebung eines Fehlers, bei dem Objekte, die aus einem Panel auf die Stage gezogen wurden, ihre `parentId` behielten. Dies trat auf, da in der zugrunde liegenden flachen Datenstruktur das Quell- und Ziel-Array identisch waren (`stage.objects`) und die `parentId` fälschlicherweise nicht entfernt wurde. Die Objekt-Hierarchie wird nun beim Drag & Drop im Editor auch bei flachen Strukturen korrekt aktualisiert.
- **Project Hierarchy (Ghost Positions / Zappeln)**: Schwerer Architektur-Fehler behoben! Das Setzen von `currentObjects` durch den `EditorCommandManager` und `EditorDataManager` überschrieb fälschlicherweise die intakte Hierarchie-Struktur (`activeStage.objects`) mit einem flachen Array aus der `ObjectRegistry`. Dies führte dazu, dass Container-Kinder sowohl an der Root-Ebene als auch im `children`-Array doppelt existierten. Dadurch stellte `flattenWithChildren` die `parentId` ständig wieder her, obwohl das Objekt auf die Stage gezogen wurde, was im Run-Mode massives "Zappeln" (Konflikte zwischen absoluten und relativen Koordinaten) auslöste. Der destruktive Setter wurde vollständig entfernt.
- **GameLoopManager (Coordinate Space Collisions)**: Behebung des Endlos-Zappelns, das durch `CheckPanelSpriteCollision` verursacht wurde. Die `checkCollisions()` Methode verglich die relativen Koordinaten eines Kind-Sprites mit den globalen Koordinaten anderer Objekte. Dies wurde behoben, indem eine **Coordinate Space Isolation** eingeführt wurde: Es kollidieren jetzt nur noch Objekte, die denselben logischen Parent haben (beide in der Root-Stage oder beide im selben Container). Die Kollision eines Kindes mit seinem eigenen Parent-Container wird nun restlos ignoriert (dafür ist die `checkBoundaries()` Logik verantwortlich).

## 2026-04-25
### Fixed
- **ActionTargetSorting**: Die Dropdown-Liste für Zielobjekte in Actions und Bedingungen ist nun alphabetisch sortiert. Verschachtelte Kind-Elemente (wie `TCard` in `TGroupPanel`) lassen sich jetzt übersichtlich finden.
- **GameLoopManager (Panel Boundaries)**: Behebung eines Fehlers, bei dem Sprites nicht mehr an den Rändern ihres Panels (z.B. `TGroupPanel`), sondern an den Rändern der Stage abgeprallt sind. Da Objekte zur Laufzeit für das Rendering flach strukturiert werden (`parentId`), schlug die Suche nach `sprite.parent` fehl. Der Boundary-Check nutzt nun korrekterweise `sprite.parentId`, um das Parent-Panel zu finden und die Kollisionsgrenzen lokal zu berechnen.
- **System-Variable (hitSide)**: Behebung eines Tippfehlers in den Flow-Bedingungen. Das System-Event `onBoundaryHit` übergibt die Variable `hitSide` (Kamelhöcker). Im Dropdown des Flow-Editors wurde diese jedoch fälschlicherweise klein geschrieben (`hitside`) angeboten, wodurch die Bedingungsauswertung fehlschlug. Dies wurde auf `hitSide` korrigiert.
- **PropertyPicker (Nested Container Bug)**: Behebung eines Fehlers in der "Eigenschaft ändern"-Aktion. Wenn das Ziel-Objekt der Aktion sich tief verschachtelt innerhalb eines Containers (`TGroupPanel`, `TCard`) befand, öffnete sich der modale Auswahldialog für Eigenschaften nicht mehr, sondern legte stattdessen direkt ein leeres Eingabefeld an. Der Inspector durchsucht Stage-Objekte nun rekursiv (`flattenObjects`), um auch auf Kinder-Objekte Zugriff zu haben.
- **Tauri UI Bug (Z-Index)**: Modale Dialoge (Eigenschaften-Auswahl, Variablen-Auswahl, RichText-Editor) wurden in der Tauri-Version von anderen Inspector- bzw. UI-Komponenten verdeckt. Der Z-Index der Overlays wurde von 10000 auf 99999 (bzw. 100000 für geschachtelte Dialoge wie im RichTextEditor) erhöht, um konsistent mit ConfirmDialog/NotificationToast immer im Vordergrund zu sein.

### TaskExecutor (Runtime)
- **BUGFIX**: FlowChart-Ausführung ignorierte verbundene Action-Nodes, weil der Typ case-sensitive ('action' statt 'Action') geprüft wurde. Die Runtime konvertiert nun node.type konsequent in Kleinbuchstaben, bevor sie Flow-Elemente evaluiert. Dadurch werden im Flow-Editor verknüpfte Actions (wie Act_ChangPanelSpriteDirecktion) wieder zuverlässig beim Eintreten des Events aufgerufen.


### UI & Editor
- **VERBESSERUNG**: Die Pfadanzeige in der Menüzeile wurde überarbeitet. Sie zeigt nun präzise das tatsächliche *AutoSave-Ziel* an (z.B. 'AutoSave-Ziel (Dev-Server): game-server/public/projects/...') statt nur den ursprünglichen Ladepfad, um Verwirrung über den Speicherort im Browser-Modus zu vermeiden.


### Inspector & UI
- **VERBESSERUNG**: Der KeyValue-Editor (Eigenschaften-Diagramm) fr die *changes*-Eigenschaft wird nun dynamisch fr *alle* Action-Arten angezeigt, die ein 'target'-Objekt besitzen, anstatt nur fr eine hartkodierte Liste von Typen.


### Inspector & UI
- **FEATURE**: Im Eigenschaften-Diagramm (KeyValue-Editor) werden fr Eigenschaften, die auf Bilder oder Audio-Dateien verweisen (wie 'image', 'src', 'sound', 'audio', etc.), nun automatisch die 'Media Picker'-Dialoge (Verzeichnis-Dialoge fr Images und Sounds) als Browse-Button angezeigt, anstatt Pfade manuell abtippen zu mssen.





- **Editor**: Fixed a bug where the IFrame runner (Standalone-Player preview) was not destroyed when switching tabs, causing multiple background GameLoop instances and memory leaks.
- **Inspector**: Added 'V' (Variable Picker) button to property value inputs in the 'Change Property' action editor, allowing users to easily bind variables to dynamically changed properties.

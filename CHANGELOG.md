### 2026-05-03
- **Physics Fix**: Collision-Event-Guard in GameLoopManager.checkCollisions() eingefuegt. Push-Out und Collision-Events werden nur noch ausgeloest, wenn mindestens eines der kollidierenden Sprites ein onCollision-Event (oder Seiten-Event) definiert hat. Verhindert ungewollte Y-Positions-Aenderungen bei Pool-Sprites ohne Collision-Handler.
- **Logging**: Sauberes Logging in ObjectPoolActions.ts fuer spawn_object mit andom_active/ll_active Modus (Template-Aufloesung, Instanz-Auswahl, Spawn-Ergebnis).
### 2026-05-01
- **Flow Engine Fix**: TaskExecutor and FlowSequenceBuilder now implement Pass-Through logic for Data Nodes (Variables, Comments), allowing flow execution to pass through non-executable nodes seamlessly without stopping.
- **Task Variables**: Fixed evaluation of expressions (${...}) in default values of task-local variables during initialization in TaskExecutor.
- **Runtime Persistence**: Repaired standaloneNodes and standaloneConnections hydration in generateFlowFromActionSequence to correctly inject skipped data nodes back into the generated flowchart at runtime.
### 2026-04-29 (Session 2)
- **Runtime Fix**: ExpressionParser MemberExpression loeste TVariable-Objekte vorzeitig via `resolveValue` auf, wodurch `Var.value` als `(4.75)["value"]` = `undefined` evaluiert wurde -> NaN. Fix: Rohobjekt ohne resolveValue holen.
- **Runtime Fix**: `VariableActions` und `CalculateActions` strippten `${...}`-Wrapper nicht aus `variableName`/`resultVariable` (V-Button-Bug). Fix: Defensives Stripping am Handler-Anfang.
- **Runtime Fix**: Dot-Path-Variablen (z.B. `CurrentY.value`) wurden nur als flacher Key in `context.vars` gespeichert, aber nicht auf dem TVariable-Objekt. JSEP-Property-Access konnte den Wert nicht finden. Fix: Beides schreiben.
- **Inspector**: V-Button war bei numerischen Signatur-Parametern und Default-Parametern explizit blockiert (`param.type !== 'number'`). Fix: Bedingung entfernt.
- **Inspector**: Key-Value-Editor (Changes) erkennt jetzt Binding-Strings bei numerischen Werten und schaltet auf `type="text"` um.
- **Inspector**: Komponenten-Properties (x, y, width, height, speed etc.) erkennen Binding-Werte und schalten dynamisch auf `type="text"` um.

### 2026-04-29
- **Inspector Fix**: Behoben, dass Variablen-Bindings aus dem V-Button bei numerischen Feldern (z.B. X/Y Koordinaten) im Inspector vom Browser blockiert und gel�scht wurden, indem das Eingabefeld dynamisch von \
umber\ auf \	ext\ umschaltet, sobald ein Binding \\\ erkannt wird.

# Changelog

### 2026-04-29
- **Inspector Fix**: Behoben, dass Variablen-Bindings aus dem V-Button bei numerischen Feldern (z.B. X/Y Koordinaten) im Inspector vom Browser blockiert und gel�scht wurden, indem das Eingabefeld dynamisch von \
umber\ auf \	ext\ umschaltet, sobald ein Binding \\\ erkannt wird.

## 2026-04-27
### 2026-04-29
- **Inspector Fix**: Behoben, dass Variablen-Bindings aus dem V-Button bei numerischen Feldern (z.B. X/Y Koordinaten) im Inspector vom Browser blockiert und gel�scht wurden, indem das Eingabefeld dynamisch von \
umber\ auf \	ext\ umschaltet, sobald ein Binding \\\ erkannt wird.

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

### 2026-04-29
- **Inspector Fix**: Behoben, dass Variablen-Bindings aus dem V-Button bei numerischen Feldern (z.B. X/Y Koordinaten) im Inspector vom Browser blockiert und gel�scht wurden, indem das Eingabefeld dynamisch von \
umber\ auf \	ext\ umschaltet, sobald ein Binding \\\ erkannt wird.

## 2026-04-26
### 2026-04-29
- **Inspector Fix**: Behoben, dass Variablen-Bindings aus dem V-Button bei numerischen Feldern (z.B. X/Y Koordinaten) im Inspector vom Browser blockiert und gel�scht wurden, indem das Eingabefeld dynamisch von \
umber\ auf \	ext\ umschaltet, sobald ein Binding \\\ erkannt wird.

### Fixed
- **ProjectStore (Object Reparenting)**: Behebung eines Fehlers, bei dem Objekte, die aus einem Panel auf die Stage gezogen wurden, ihre `parentId` behielten. Dies trat auf, da in der zugrunde liegenden flachen Datenstruktur das Quell- und Ziel-Array identisch waren (`stage.objects`) und die `parentId` fälschlicherweise nicht entfernt wurde. Die Objekt-Hierarchie wird nun beim Drag & Drop im Editor auch bei flachen Strukturen korrekt aktualisiert.
- **Project Hierarchy (Ghost Positions / Zappeln)**: Schwerer Architektur-Fehler behoben! Das Setzen von `currentObjects` durch den `EditorCommandManager` und `EditorDataManager` überschrieb fälschlicherweise die intakte Hierarchie-Struktur (`activeStage.objects`) mit einem flachen Array aus der `ObjectRegistry`. Dies führte dazu, dass Container-Kinder sowohl an der Root-Ebene als auch im `children`-Array doppelt existierten. Dadurch stellte `flattenWithChildren` die `parentId` ständig wieder her, obwohl das Objekt auf die Stage gezogen wurde, was im Run-Mode massives "Zappeln" (Konflikte zwischen absoluten und relativen Koordinaten) auslöste. Der destruktive Setter wurde vollständig entfernt.
- **GameLoopManager (Coordinate Space Collisions)**: Behebung des Endlos-Zappelns, das durch `CheckPanelSpriteCollision` verursacht wurde. Die `checkCollisions()` Methode verglich die relativen Koordinaten eines Kind-Sprites mit den globalen Koordinaten anderer Objekte. Dies wurde behoben, indem eine **Coordinate Space Isolation** eingeführt wurde: Es kollidieren jetzt nur noch Objekte, die denselben logischen Parent haben (beide in der Root-Stage oder beide im selben Container). Die Kollision eines Kindes mit seinem eigenen Parent-Container wird nun restlos ignoriert (dafür ist die `checkBoundaries()` Logik verantwortlich).

### 2026-04-29
- **Inspector Fix**: Behoben, dass Variablen-Bindings aus dem V-Button bei numerischen Feldern (z.B. X/Y Koordinaten) im Inspector vom Browser blockiert und gel�scht wurden, indem das Eingabefeld dynamisch von \
umber\ auf \	ext\ umschaltet, sobald ein Binding \\\ erkannt wird.

## 2026-04-25
### 2026-04-29
- **Inspector Fix**: Behoben, dass Variablen-Bindings aus dem V-Button bei numerischen Feldern (z.B. X/Y Koordinaten) im Inspector vom Browser blockiert und gel�scht wurden, indem das Eingabefeld dynamisch von \
umber\ auf \	ext\ umschaltet, sobald ein Binding \\\ erkannt wird.

### Fixed
- **ActionTargetSorting**: Die Dropdown-Liste für Zielobjekte in Actions und Bedingungen ist nun alphabetisch sortiert. Verschachtelte Kind-Elemente (wie `TCard` in `TGroupPanel`) lassen sich jetzt übersichtlich finden.
- **GameLoopManager (Panel Boundaries)**: Behebung eines Fehlers, bei dem Sprites nicht mehr an den Rändern ihres Panels (z.B. `TGroupPanel`), sondern an den Rändern der Stage abgeprallt sind. Da Objekte zur Laufzeit für das Rendering flach strukturiert werden (`parentId`), schlug die Suche nach `sprite.parent` fehl. Der Boundary-Check nutzt nun korrekterweise `sprite.parentId`, um das Parent-Panel zu finden und die Kollisionsgrenzen lokal zu berechnen.
- **System-Variable (hitSide)**: Behebung eines Tippfehlers in den Flow-Bedingungen. Das System-Event `onBoundaryHit` übergibt die Variable `hitSide` (Kamelhöcker). Im Dropdown des Flow-Editors wurde diese jedoch fälschlicherweise klein geschrieben (`hitside`) angeboten, wodurch die Bedingungsauswertung fehlschlug. Dies wurde auf `hitSide` korrigiert.
- **PropertyPicker (Nested Container Bug)**: Behebung eines Fehlers in der "Eigenschaft ändern"-Aktion. Wenn das Ziel-Objekt der Aktion sich tief verschachtelt innerhalb eines Containers (`TGroupPanel`, `TCard`) befand, öffnete sich der modale Auswahldialog für Eigenschaften nicht mehr, sondern legte stattdessen direkt ein leeres Eingabefeld an. Der Inspector durchsucht Stage-Objekte nun rekursiv (`flattenObjects`), um auch auf Kinder-Objekte Zugriff zu haben.
- **Tauri UI Bug (Z-Index)**: Modale Dialoge (Eigenschaften-Auswahl, Variablen-Auswahl, RichText-Editor) wurden in der Tauri-Version von anderen Inspector- bzw. UI-Komponenten verdeckt. Der Z-Index der Overlays wurde von 10000 auf 99999 (bzw. 100000 für geschachtelte Dialoge wie im RichTextEditor) erhöht, um konsistent mit ConfirmDialog/NotificationToast immer im Vordergrund zu sein.

### 2026-04-29
- **Inspector Fix**: Behoben, dass Variablen-Bindings aus dem V-Button bei numerischen Feldern (z.B. X/Y Koordinaten) im Inspector vom Browser blockiert und gel�scht wurden, indem das Eingabefeld dynamisch von \
umber\ auf \	ext\ umschaltet, sobald ein Binding \\\ erkannt wird.

### TaskExecutor (Runtime)
- **BUGFIX**: FlowChart-Ausführung ignorierte verbundene Action-Nodes, weil der Typ case-sensitive ('action' statt 'Action') geprüft wurde. Die Runtime konvertiert nun node.type konsequent in Kleinbuchstaben, bevor sie Flow-Elemente evaluiert. Dadurch werden im Flow-Editor verknüpfte Actions (wie Act_ChangPanelSpriteDirecktion) wieder zuverlässig beim Eintreten des Events aufgerufen.


### 2026-04-29
- **Inspector Fix**: Behoben, dass Variablen-Bindings aus dem V-Button bei numerischen Feldern (z.B. X/Y Koordinaten) im Inspector vom Browser blockiert und gel�scht wurden, indem das Eingabefeld dynamisch von \
umber\ auf \	ext\ umschaltet, sobald ein Binding \\\ erkannt wird.

### UI & Editor
- **VERBESSERUNG**: Die Pfadanzeige in der Menüzeile wurde überarbeitet. Sie zeigt nun präzise das tatsächliche *AutoSave-Ziel* an (z.B. 'AutoSave-Ziel (Dev-Server): game-server/public/projects/...') statt nur den ursprünglichen Ladepfad, um Verwirrung über den Speicherort im Browser-Modus zu vermeiden.


### 2026-04-29
- **Inspector Fix**: Behoben, dass Variablen-Bindings aus dem V-Button bei numerischen Feldern (z.B. X/Y Koordinaten) im Inspector vom Browser blockiert und gel�scht wurden, indem das Eingabefeld dynamisch von \
umber\ auf \	ext\ umschaltet, sobald ein Binding \\\ erkannt wird.

### Inspector & UI
- **VERBESSERUNG**: Der KeyValue-Editor (Eigenschaften-Diagramm) fr die *changes*-Eigenschaft wird nun dynamisch fr *alle* Action-Arten angezeigt, die ein 'target'-Objekt besitzen, anstatt nur fr eine hartkodierte Liste von Typen.


### 2026-04-29
- **Inspector Fix**: Behoben, dass Variablen-Bindings aus dem V-Button bei numerischen Feldern (z.B. X/Y Koordinaten) im Inspector vom Browser blockiert und gel�scht wurden, indem das Eingabefeld dynamisch von \
umber\ auf \	ext\ umschaltet, sobald ein Binding \\\ erkannt wird.

### Inspector & UI
- **FEATURE**: Im Eigenschaften-Diagramm (KeyValue-Editor) werden fr Eigenschaften, die auf Bilder oder Audio-Dateien verweisen (wie 'image', 'src', 'sound', 'audio', etc.), nun automatisch die 'Media Picker'-Dialoge (Verzeichnis-Dialoge fr Images und Sounds) als Browse-Button angezeigt, anstatt Pfade manuell abtippen zu mssen.





- **Editor**: Fixed a bug where the IFrame runner (Standalone-Player preview) was not destroyed when switching tabs, causing multiple background GameLoop instances and memory leaks.
- **Inspector**: Added 'V' (Variable Picker) button to property value inputs in the 'Change Property' action editor, allowing users to easily bind variables to dynamically changed properties.


## [Unreleased] - 2026-04-30

### Fixed
- **Inspector x/y Shadowing (Root-Cause)**: FlowActions wie `move_to` zeigten im Inspector die Canvas-Koordinaten (z.B. 40, 120) statt der Action-Parameter (z.B. `$`{MyVar.value}`). Ursache: `InspectorSectionRenderer.renderProperty()` nutzte `PropertyHelper.getPropertyValue()`, welches `FlowElement.x` (Canvas-Position) statt den Action-Parameter las. Fix: `getActionDefinition()` wird jetzt als SSoT-Methode zum Lesen und Schreiben verwendet.
- **getActionDefinition() public**: `FlowAction.getActionDefinition()` und `FlowDataAction.getActionDefinition()` von `protected` auf `public` geaendert, damit der InspectorSectionRenderer darauf zugreifen kann.
- **FlowNodeHandler Schreib-Fix**: Action-Parameter werden jetzt via `getActionDefinition()` in die JSON-Definition geschrieben und zusaetzlich in `object.data` synchronisiert, statt `PropertyHelper.setPropertyValue(object, ...)` zu nutzen (was Canvas-Koordinaten ueberschrieb).

## [Unreleased] - 2026-05-01

### Added
- **Flow-lokale Variablen**: Neuer Scope `'local'` fuer Variablen, die nur waehrend einer Task-Ausfuehrung existieren. Jeder Aufruf bekommt eine isolierte Kopie, so dass mehrere Sprites denselben Task ohne Shared-State-Konflikte nutzen koennen.
  - Inspector: `inspector_variable.json` - Scope-Dropdown um `Task-Lokal` Option erweitert.
  - FlowVariable: toJSON() speichert komplette Definition bei scope=local. Visuell: Schloss-Icon + gruene Farbe.
  - FlowSyncManager: Lokale Variablen werden nicht in stage/project.variables synchronisiert.
  - TaskExecutor: Lokale Variablen werden vor Execution in das pro-Aufruf-isolierte vars-Objekt injiziert.
- **self als Ziel-Objekt**: Dropdown-Option `'self (Selbstreferenz)'` in allen Objekt-Selektoren.
# #   [ U n r e l e a s e d ]   -   F l o w V a r i a b l e   I n s p e c t o r   U I   F i x  
 -   F l o w V a r i a b l e   � b e r s c h r e i b t   g e t I n s p e c t o r S e c t i o n s   u m   E i g e n s c h a f t e n   ( S c o p e ,   T y p ,   W e r t )   b e a r b e i t e n   z u   k � n n e n  
 # #   [ U n r e l e a s e d ]   -   U n i v e r s e l l e r   D a t a P i c k e r  
 -   V a r i a b l e P i c k e r D i a l o g   w u r d e   z u m   u n i v e r s e l l e n   D a t a P i c k e r   e r w e i t e r t   u n d   l i s t e t   n u n   a u c h   G l o b a l e -   u n d   S t a g e - K o m p o n e n t e n   s o w i e   d e r e n   k o n f i g u r i e r b a r e   E i g e n s c h a f t e n   a u f  
 -   ' s e l f '   a l s   f e s t e   O p t i o n   b e i   d e n   S t a g e - K o m p o n e n t e n   i m   D a t a P i c k e r   h i n z u g e f � g t  
 -   E i g e n s c h a f t s l i s t e   d e r   ' s e l f '   K o m p o n e n t e   i m   D a t a P i c k e r   r e p a r i e r t   ( f e h l e n d e r   c l a s s N a m e   k o r r i g i e r t )  
 -   P r o p e r t y P i c k e r   f � r   d i e   ' s e l f '   K o m p o n e n t e   r e p a r i e r t   ( f e h l e n d e   K l a s s e n z u o r d n u n g   i n   E i g e n s c h a f t - � n d e r n   A k t i o n e n )  
 
- **Refactoring:** PascalCodeGenerator und PascalCodeParser auf Universal Data Setter aktualisiert. RefactoringManager ber�cksichtigt �nderungen in der keyvalue-Struktur bei Objekt-Umbenennungen.


## [Unreleased] - Image Picker Inspector Fix
- Behoben: Die Eigenschaften von image_picker, audio_picker und video_picker wurden im Inspector unter dem falschen Feldnamen (mit Suffix 'Input') gespeichert, was dazu fuehrte, dass Sprites ihr Bild nicht speichern konnten.

### 2026-05-03
- **Bugfix (ActionHelper)**: 'other' als Target-Selektion in Flow-Actions (wie Objekt Zerst�ren) referenziert bei Kollisionen nun korrekt das getroffene Objekt und nicht mehr nur dessen ID-String.
- **Feature (Inspector)**: Implizite Event-Variablen (self, other, otherSprite.templateName, hitSide) wurden zum Dropdown der FlowCondition hinzugef�gt, sodass sie ohne Umwege �ber Text-Eingaben ausw�hlbar sind.
U p d a t e :   T a s k E x e c u t o r . t s  
 U p d a t e :   S t a g e R e n d e r e r . t s   ( F i x e d   P r o x y   s t y l e   a s s i g n m e n t   b u g )  
 

### 2026-05-04
- **Animation Fix**: \AnimationManager.explode\ repariert. Der Selektor suchte fälschlicherweise nach \data-object-id\, während die Objekte mit \data-id\ in den DOM gerendert werden. Zudem wurden aussagekräftige Logs eingebaut.

- **Animation Fix 2**: \AnimationManager.explode\ repariert. CSS Transitions für neu erstellte DOM-Elemente wurden nicht getriggert, da das initiale Setup (anhängen an DOM) und der Zielzustand (transform, opacity) im selben Frame durch \equestAnimationFrame\ ausgeführt wurden. Die Zuweisung des Zielzustands erfolgt nun sicher asynchron über ein kurzes 30ms \setTimeout\, sodass der Browser die Elemente und deren initiale Werte erst rendert, bevor die Transition beginnt.

- **Animation Fix 3**: \AnimationManager.explode\ repariert. Wenn globale/Blueprint-Objekte im DOM versteckt existieren, fand \querySelector\ bisher fälschlicherweise das unsichtbare Dummy-Element (BoundingClientRect 0x0). Der Manager durchsucht nun alle Elemente mit der ID und wählt gezielt dasjenige aus, das auch wirklich eine sichtbare Ausdehnung (\offsetWidth > 0\) hat.

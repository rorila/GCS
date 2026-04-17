### 2026-04-16 (Stage Data Persistence Hotfix)
- **Bugfix (Leere Objekte nach Stage Import)**: Ein kritischer Datenverlust-Bug wurde behoben, bei dem Bühnen-Objekte nach einem Stage-Import im Projekt als leeres Array (`"objects": []`) gespeichert wurden.
  - *Ursache*: In Produktions-Builds minimiert der Bundler `constructor.name` zu kurzen Strings wie `"$t"`. Bei manueller Instanziierung via `ComponentRegistry.createInstance()` erbte die Instanz diesen Namen, woraufhin die spätere Speicherungs-Serialisierung (`toDTO()`) ihn in die Projekt-JSON schrieb. Beim nächsten Ladevorgang konnte `hydrateObjects` die Klasse `"$t"` nicht finden und löschte folglich alle derartigen Objekte. 
  - *Lösung*: `EditorStageManager` nutzt nun beim Import die komplette Logik von `hydrateObjects()`. Zudem zwingt `ComponentRegistry.createInstance()` neue Instanzen dazu, stets den originalen `className`-Bezeichner (aus der Registrierung) zu nutzen und so den Minifier-Schutz aus der Haupt-Deserialisierung auch auf alle dynamisch erzeugten Laufzeitobjekte zu übertragen.
- **UI Verbesserung**: Das Dropdown-Menü für Stages im Top-Menü sowie **alle Kontext-Menüs (Rechtsklick) im gesamten Projekt** haben nun eine maximale Höhe (`80vh` bzw. `60vh`) und eine native Scrollbar (`overflow-y: auto`), damit lange Listen (wie Stages, Tasks oder Actions) nicht mehr unten aus dem Bildschirm herausschneiden.

### 2026-04-16 (Feature / Bugfix)
- **Bugfix (Z-Index der System-Dialoge)**: Der `ConfirmDialog` und `PromptDialog` wurden hinter Editor-Modals (wie der Stage-Verwaltung) versteckt, da deren Z-Index zu niedrig (`10000`) gegenÃ¼ber den Editor-MenÃ¼s (`20000`) war. Der Z-Index fÃ¼r alle modalen Dialoge und Toasts wurde auf `99999` bzw. `999999` erhÃ¶ht, um sicherzustellen, dass LÃ¶schbestÃ¤tigungen immer im Vordergrund liegen.
- **Bugfix (Stage Import Cache)**: Fehler behoben, bei dem importierte Stages im Standalone-Run-Modus (IFrame) nicht auftauchten, da die Projektdaten nach dem Import nicht automatisch im LocalStorage-Cache (`autoSaveToLocalStorage`) persistiert wurden.
- **Stage Import UX Verbesserung**: Eine "Alle auswÃ¤hlen" Checkbox wurde zum Import-Dialog fÃ¼r Stages hinzugefÃ¼gt, mit der Nutzer nun mit einem Klick alle Checkboxen auf einmal ab- oder anwÃ¤hlen kÃ¶nnen.

### 2026-04-13 (Architectural Feature)
- **Flow-Action 'Theme (TStringMap) laden' eingefÃ¼hrt**: Das Umschalten von String-Bibliotheken (Themes) wird nun nicht mehr Ã¼ber abstrakte Code-Routinen, sondern komfortabel Ã¼ber die neue Dropdown-Aktion \Theme (TStringMap) laden\ konfiguriert. Beide Parameter (Ziel und Quelle) haben im Editor dedizierte Dropdowns mit Objektlisten, was Fehleingaben ausschlieÃŸt.

### 2026-04-12 (Feature)
- **Theme-Umschaltung via TStringMap**: Die Aktion \LoadFromOtherStringMap\ wurde zur Komponente \TStringMap\ hinzugefgt. Damit lsst sich zur Laufzeit ein Set von String-Werten (z.B. ein komplettes Theme) in eine aktive Map berschreiben, wodurch gebundene Komponenten sich sofort anpassen.

### 2026-04-12 (Hotfix 2)
- **Bugfix (Stage Background im Editor)**: Ein FlÃ¼chtigkeitsfehler im vorherigen Rendering-Fix (EditorRenderManager.ts) wurde korrigiert. 
esolveObjectPreview gibt ein geklontes Objekt zurÃ¼ck, anstatt das Argument zu formen. Dies fÃ¼hrte dazu, dass der Hintergrund weiterhin als reiner String interpretiert wurde. Der Zuweisungsfehler wurde behoben.

### 2026-04-12 (Hotfix)
- **Bugfix (PropertyHelper / Editor-Interpolation)**: Es wurde ein Fehler behoben, bei dem TStringMap im Editor-Design-Modus nicht als Variable entpackt und deshalb als \undefined\ berechnet wurde. Der Grund dafr war, dass DTOs aus dem Blueprint-Stage-Kontext kein \isVariable\ Eigenschafts-Flag bestitzen. \PropertyHelper.resolveValue()\ und \getPropertyValue\ werten den className 'TStringMap' nun zuverlssig aus, sodass EintrÃ¤ge in .entries korrekt fr Farben und Live-Vorschauen im Designer gefunden werden.

### 2026-04-12
- **Bugfix (Reactive Bindings & IFrame Rendering)**: Fehler behoben, bei dem die reaktiven Style-Bindings (z.B. ${MainThemes.color}) im IFrame-Player nur fÃ¼r den TButton, aber nicht fÃ¼r TShape oder den Stage-Hintergrund (grid) aktualisiert wurden. Dies lag daran, dass GameRuntime.bindObjectProperties() bei der Suche nach Expressions rekursiv nur style, events und Tasks traversierte, was den grid-Knoten und andere Properties ignorierte.
- **Wichtig**: Um sicherzustellen, dass IFrame-Ã„nderungen an der Runtime Anwendung finden, wurde public/runtime-standalone.js fÃ¼r den Run(IFrame)-Modus per npm run bundle:runtime neu gebÃ¼ndelt.

### 2026-04-09
- **Refactoring (Speicher-Logik)**: Die doppelte Speicher-Logik im `EditorDataManager` (`saveProjectToFile` und `saveProjectAs`) wurde entfernt. Zuvor umging der EditorDataManager den `ProjectPersistenceService` und rief bei Electron oder Native File System Access die APIs direkt auf. Nun wurde ein Getter (`getNativeAdapter()`) im `ProjectPersistenceService` exponiert. Der `EditorDataManager` nutzt ausschlieÃƒÅ¸lich den NativeAdapter (`nativeAdapter.save()`). Dies zentralisiert die Speicherlogik, behebt redundanten Code und erleichtert kÃƒÂ¼nftige Systemerweiterungen.
- **Security Bugfix (Path Traversal)**: Eine SicherheitslÃƒÂ¼cke in der Electron-Bridge (`electron/main.cjs`) wurde geschlossen. Bisher akzeptierten die IPC-Handler `fs:readFile` und `fs:writeFile` jeglichen absoluten Dateipfad, was theoretisch arbitrary File Read/Write fÃƒÂ¼r jedes bÃƒÂ¶sartige Skript im Renderer-Prozess erlaubte. Es wurde ein Sandbox-Mechanismus (`isPathAllowed`) eingefÃƒÂ¼hrt: Zugriffe sind nur noch in den System-Verzeichnissen der App (UserData, AppPath, CWD, Temp) erlaubt, oder wenn der Pfad zuvor explizit ÃƒÂ¼ber einen User-ausgelÃƒÂ¶sten nativen File-Dialog (`fs:showOpenDialog` oder `fs:showSaveDialog`) freigegeben wurde.
- **Bugfix (Electron app exit)**: Behebt das Problem, dass sich die Electron-App bei vorhandenen ungespeicherten Ãƒâ€žnderungen nicht schlieÃƒÅ¸en lieÃƒÅ¸. Bisher hÃƒÂ¤ngte sich der SchlieÃƒÅ¸vorgang aufgrund der fehlenden Reaktion auf das `will-prevent-unload`-Event durch `e.returnValue` auf. In der `electron/main.cjs` wurde nun ein nativer `dialog.showMessageBoxSync` hinzugefÃƒÂ¼gt, sodass Nutzer auf Wunsch das Unload erzwingen kÃƒÂ¶nnen (`event.preventDefault()`).
- **Bugfix (MediaPicker Electron)**: Fehler behoben, welcher dazu fÃƒÂ¼hrte, dass die Audio- und Image-Ordner im Electron Build scheinbar leer waren. Ursache war ein HTTP Fetch mit absolutem Pfad (`/media-manifest.json` und `/images`), der im Packaged-Environment (`file://`) Root-Pfade ansprach anstatt den lokalen dist-Ordner. Die Pfade im `MediaPickerDialog` wurden auf relative Pfade (`./media-manifest.json`, `./images`) umgestellt.
- **Build (Vite)**: Das Vite Build-Skript `vite.config.ts` wurde korrigiert. Die Datei `src/player-standalone.ts` (die `runtime-standalone.js` erzeugt) wurde aus dem `rollupOptions.input` ausgetragen. Vorher hat der `vite build` Schritt das von `esbuild` generierte IIFE-Bundle im `dist/`-Verzeichnis durch ein neu transpiliertes ES-Modul ÃƒÂ¼berschrieben. Da ES-Module durch CORS-Restriktionen ÃƒÂ¼ber das `file://`-Protokoll in Electron nicht laufen (und `iframe-runner.html` kein `type="module"` Tag verwendet), fÃƒÂ¼hrte das zum `Error: Runtime-Standalone fehlt!`. Vite kopiert nun ausschlieÃƒÅ¸lich das funktionierende IIFE-Bundle.
- **Build (Electron)**: Die `target`-Option in `package.json` wurde von `"portable"` auf `"dir"` geÃƒÂ¤ndert, um Konflikte mit Microsoft Smart App Control (SAC) zu vermeiden. Die Portable-Version (ein selbstentpackendes Archiv, das in den temporÃƒÂ¤ren Windows-Ordner extrahiert) wird von den Windows-Sicherheits-Heuristiken oft fÃƒÂ¤lschlicherweise als Schadsoftware eingestuft und blockiert, wenn kein Codesigning-Zertifikat vorhanden ist. Der `dir`-Build erzeugt stattdessen ein simples Verzeichnis mit einer direkten `.exe`.
### 2026-04-12
- **Feature (TRichText)**: TRichText unterstÃƒÂ¼tzt nun Inline-Links (`<a>`), die visuell abgesetzt werden. Im Editor-Modus sind sie nicht navigierbar. Im Run-Modus routet das Anklicken von `stage:ID`-Links das native Runtime-Event `__SYSTEM_NAVIGATE__` an den `GameRuntime.handleEvent()` Handler. Dadurch verhalten sich Inline-Links identisch zur regulÃƒÂ¤ren Stage-Navigation via `NavigationActions`, wobei der Wechsel nahtlos vom `UniversalPlayer` (Standalone) oder `EditorRunManager` (Editor) ausgefÃƒÂ¼hrt wird.
- **Bugfix (RichTextEditorDialog)**: Die Selektions-Auswahl (Range) ging beim Ãƒâ€“ffnen des Link-Modals verloren. Dies wurde behoben, indem wir die Selektion vor dem Ãƒâ€“ffnen speichern, den Fokus auf das Eingabefeld lenken, und beim SchlieÃƒÅ¸en des Modals die gesicherte Range vor dem AusfÃƒÂ¼hren des `document.execCommand('createLink')` reaktivieren.

### 2026-04-16
- **Bugfix (Inspector)**: Behebung eines Fehlers, bei dem sich Tasks im Flow-Editor bzw. Inspector nicht mehr umbenennen ließen. Da Tasks im Datenmodell keine UUID besitzen, schlug die ID-basierte Suche in `EditorCommandManager.renameObject` mit `undefined` fehl. Dies wurde korrigiert, indem auf den bisherigen Namen (oldValue) als Fallback-Identifikator zurückgegriffen wird (`update.object.id || update.oldValue`).
- **Bugfix (Runtime Layer)**: TDialogRoot Slides/Animationen wurden zur Laufzeit nicht mehr ausgeführt, wenn die Eigenschaft *visible* per Action geändert wurde. Ursache: Die ReactiveRuntime delegierte das Update an das performante `StageRenderer.updateSingleObject()`, welches nur Hintergrund/Farben updatet. Für Dialog-Animationen und deren Kinder wurde nun ein Full-Render Fallback (in `GameRuntime.ts`) konfiguriert.
- **Bugfix (FlowEditor)**: Behebung eines Fehlers, bei dem die Umbenennung eines Tasks dazu führte, dass fälschlicherweise in die Elementenübersicht gesprungen wurde, da das Dropdown-Menü durch den `Safety Check` vorzeitig aktualisiert wurde, noch bevor das Projekt-Modell die Namensänderung reflektiert hatte.


- **Refactoring (GameRuntime)**: Aufteilung des 1140-Zeilen "God-Objects" `GameRuntime.ts` in modularere Services. Input-Logik in `GameRuntimeInput.ts` und Multiplayer-Logik in `GameRuntimeMultiplayer.ts` extrahiert.
- **Refactoring (FlowSyncManager)**: Aufteilung des 1200-Zeilen Managers in `FlowDataParser.ts`, `FlowSequenceBuilder.ts` und `FlowRegistrySync.ts` inklusive Wrapper zur Wahrung der AbwÃƒÂ¤rtskompatibilitÃƒÂ¤t.
- **Feature (Flow-Editor)**: EinfÃƒÂ¼hrung visueller Auto-Formatierung fÃƒÂ¼r horizontale Layouts. Verbindungen (z.B. von rechtem auf linken Anker) werden nicht mehr vertikal gezwungen, sondern als geometrisch horizontale Achse wiederhergestellt und exportiert/gespeichert.
- **Typescript-Typing**: Elimination unsicherer `any`-Datenstrukturen in `RuntimeStageManager` und `MediatorService` durch Einsatz dedizierter Domain-Modelle (`GameTask`, `GameAction`, `ComponentData`). Dies behebt mÃƒÂ¶gliche "Silent Bugs" durch Typos bei Properties.

### 2026-03-31
- **Feature**: Die neue TGroupPanel Komponente wurde als transparenter Container eingefÃƒÂ¼hrt, der verschachtelte Kind-Komponenten aufnehmen kann.
- **Feature (Templates & ObjectPool)**: TGroupPanels kÃƒÂ¶nnen nun als "isTemplate=true" deklariert werden. `spawn_object` clont das Panel mitsamt allen Children zur Laufzeit rekursiv und erweckt sie zum Leben.
- **Feature (Action)**: Neue Action `set_child_property` hinzugefÃƒÂ¼gt, um gezielt Sub-Elemente in einem gespawnten TGroupPanel ÃƒÂ¼ber ihren Namen anzusprechen und zu verÃƒÂ¤ndern.
- **Refactoring (StageRenderer)**: `renderObjects` rekursiv erweitert, sodass Groups auch in der IDE mitsamt ihren Kind-Elementen navigierbar und global verschiebbar bleiben.
### 2026-03-31\n- StageRenderer Refactoring (God-Class): Auslagerung der spezifischen Rendering-Methoden fÃƒÂ¼r UI-Komponenten (Sprite, Shape, Inputs, Complex Components, System Components) in das neue Verzeichnis src/editor/services/renderers.\n\n
 # # #   2 0 2 6 - 0 3 - 3 1 
 -   A b g e s c h l o s s e n e   M i g r a t i o n   a l l e r   c o n s o l e . *   A u f r u f e   a u f   d e n   p r o j e k t w e i t e n   L o g g e r - D i e n s t   i m   g e s a m t e n   s r c /   O r d n e r   z u r   b e s s e r e n   D i a g n o s e   u n d   F e h l e r v e r f o l g u n g . 
 Ã¯Â¿Â½Ã¯Â¿Â½-   [ 2 0 2 6 - 0 3 - 0 9 ]   * * P r o j e k t   E r s t e l l e n   U s e   C a s e   ( E 2 E   T e s t ) * * :   E 2 E - T e s t   f Ã¯Â¿Â½ r   P r o j e c t C r e a t i o n . s p e c . t s   v o l l s t Ã¯Â¿Â½ n d i g   i m p l e m e n t i e r t   u n d   s t a b i l i s i e r t   ( D e b o u n c i n g - F i x e s ) .   D e c k t   A r r a y s ,   S n a p - T o - G r i d ,   R a s t e r - E i n s t e l l u n g e n ,   M e t a d a t e n   u n d   S t a g e - R e n a m e   a b ,   w i e   i m   U s e C a s e   s p e z i f i z i e r t . 
 
 # #   2 0 2 6 - 0 3 - 0 3 :   C o m p o n e n t   D e f a u l t   S i z e   F i x 
 
 -   * * B u g f i x * * :   B e h e b u n g   d e s   ' D a t e n   h a b e n   s i c h   n i c h t   g e Ã¯Â¿Â½ n d e r t ' - F e h l e r s   b e i m   S p e i c h e r n   v o n   F l o w - D i a g r a m m e n .   D i e   Ã¯Â¿Â½ n d e r u n g s p r Ã¯Â¿Â½ f u n g   ( i s P r o j e c t D i r t y )   s c h e i t e r t e   b e i   P r o j e k t e n   o h n e   d i e   g l o b a l e   V a r i a b l e   ' i s P r o j e c t C h a n g e A v a i l a b l e ' .   D i e s e   w i r d   n u n   a u t o m a t i s c h   v o m   F a l l b a c k - M e c h a n i s m u s   i m   B l u e p r i n t - S c o p e   e r z e u g t ,   f a l l s   s i e   f e h l t . 
 
 -   F a l l b a c k   a u f   W i d t h = 5   u n d   H e i g h t = 2   f Ã¯Â¿Â½ r   n e u   d r o p p e n d e   C o m p o n e n t s   e i n g e b a u t   i n   E d i t o r C o m m a n d M a n a g e r . t s x ,   w e n n   d i e s e   o h n e   G r Ã¯Â¿Â½ Ã¯Â¿Â½ e n a n g a b e   k o m m e n   ( B u g f i x ) 
 
 # #   2 0 2 6 - 0 3 - 0 4 :   T D a t a L i s t   B a s i s   K o m p o n e n t e n - S e t u p 
 
 -   T D a t a L i s t   ( V i s u a l   R o w   D e s i g n e r   f Ã¯Â¿Â½ r   R e p e a t e r   L a y o u t )   a l s   B a s i s - K o m p o n e n t e   a n g e l e g t   u n d   i n   C o m p o n e n t R e g i s t r y   r e g i s t r i e r t . 
 
 -   E d i t o r C o m m a n d M a n a g e r   s o   a n g e p a s s t ,   d a s s   e r   b e i m   E i n f Ã¯Â¿Â½ g e n   e i n e r   T D a t a L i s t   a u t o m a t i s c h   e i n   i n i t i a l e s   R o w - T e m p l a t e   P a n e l   e r z e u g t . 
 
 
 
 
 
 # # #   2 0 2 6 - 0 3 - 1 9 
 
 -   * * B u g f i x   ( F l o w S y n c M a n a g e r ) * * :   V e r h i n d e r u n g   v o n   D u p l i k a t e n   b e i   C o n d i t i o n - N o d e s   i m   F l o w   E d i t o r .   K o r r i g i e r t e   S t a n d a l o n e - N o d e - E r k e n n u n g   d u r c h   V e r w e n d u n g   e i n e s   V i s i t e d - S e t s   w Ã¯Â¿Â½ h r e n d   d e r   G r a p h e n t r a v e r s i e r u n g   a n s t e l l e   e i n e s   s t r i n g - b a s i e r t e n   N a m e n s a b g l e i c h s . 
 
 -   * * T e s t i n g * * :   R e g r e s s i o n - S u i t e   w i e d e r   k o m p l e t t   g r Ã¯Â¿Â½ n   ( E 2 E   T e s t s   i n k l u s i v e   T a s k - A c t i o n   L i n k i n g ) . 
 
 
 
 -   * * B u g f i x   ( I n s p e c t o r ) * * :   B e h e b u n g   e i n e s   U I - F e h l e r s ,   b e i   d e m   d i e   A k t i o n   ' W e r t   n e g i e r e n '   ( z . B .   f Ã¯Â¿Â½ r   B o u n c e X )   a u f g r u n d   e i n e s   T y p - K o n f l i k t s   ( N u m b e r   v s .   B o o l e a n )   a u f   n u m e r i s c h e n   E i g e n s c h a f t e n   e i n   l e e r e s   E i n g a b e f e l d   a n z e i g t e .   D i e s   f Ã¯Â¿Â½ h r t e   b e i m   S p e i c h e r n   z u m   V e r l u s t   d e r   E i g e n s c h a f t .   D a s   I n s p e c t o r - F e l d   e r z w i n g t   n u n   f Ã¯Â¿Â½ r   ' n e g a t e '   v i a   ' v a l u e T y p e :   b o o l e a n '   s t e t s   e i n e   C h e c k b o x . 
 
 
 # # #   2 0 2 6 - 0 3 - 2 9 
 -   * * B u g f i x   ( I n s p e c t o r ) * * :   F e h l e n d e   I n s p e c t o r - E i g e n s c h a f t e n   ( i n k l .   ' G E O M E T R I E ' )   f Ã¯Â¿Â½ r   B l u e p r i n t - K o m p o n e n t e n   b e h o b e n ,   i n d e m   d a s   J S O N - D a t e n o b j e k t   v o r   d e r   A n z e i g e   m i t t e l s   C o m p o n e n t R e g i s t r y   h y d r i e r t   w i r d . 
 -   * * F e a t u r e   ( V a l i d a t i o n ) * * :   P r o j e k t w e i t e   E i n d e u t i g k e i t s p r Ã¯Â¿Â½ f u n g   f Ã¯Â¿Â½ r   A c t i o n -   u n d   T a s k - N a m e n   (  a l i d a t e T a s k N a m e ,    a l i d a t e A c t i o n N a m e )   i m   E d i t o r C o m m a n d M a n a g e r . t s   i m p l e m e n t i e r t ,   u m   N a m e n s - S h a d o w i n g   u n d   R e f a c t o r i n g - K o n f l i k t e   z u   v e r h i n d e r n . 
 
 

### 13.04.2026
- **FIX**: Blueprint Global Variables (wie TStringMap) behalten nun korrekterweise ihren Status bei Stage-Wechseln und werden nicht mehr von identisch benannten, leeren lokalen Stage-Variablen Ã¼berschrieben (Fix in GameRuntime.ts via obj.scope === 'global'). Duplicate locale Maps in project_GCS_Doku.json entfernt.

### 2026-04-16 (Hotfix)
- **Bugfix (Stage-Import Persistence in Electron Run-Mode)**: Ein Race Condition-Fehler wurde behoben, bei dem der IFrame Run-Mode in Electron auf project.json aus dem Cache/Dateisystem zurückfiel, bevor die neue Projektstruktur über postMessage (START_RUN) bereit stand. Dadurch wurden erst kürzlich importierte Stages, die noch nicht auf der Festplatte via NativeFileAdapter gespeichert waren, durch den veralteten Fallback-Fetch überschrieben. Eine window.WAIT_FOR_PROJECT Flag stellt nun sicher, dass der Standalone-Player priorisiert das Laufzeit-Projekt lädt.

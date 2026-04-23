����

## Namenskonflikte und Referenzierung (Vermeidung von Shadowing)
### DO NOT:
- Erlaube im Editor niemals, dass ein lokales Objekt/Task/Action denselben Namen erh�lt wie ein globales Element. Dies f�hrt in der Engine dazu, dass das globale Element (z.B. aus der Blueprint-Stage) unerwartet von der lokalen Instanz �berschrieben wird (Shadowing).
- L�se Namens�nderungen nie ohne Validierung gegen das 'ProjectRegistry' aus (immer ProjectRegistry.validateTaskName/alidateActionName nutzen).

## Inspector & ObjectStore Hydration
### DO NOT:
- Verlasse dich bei der Inspector-Darstellung nicht darauf, dass Objekte aus dem ObjectStore noch Methoden von TComponent besitzen (wie z.B. getInspectorSections). Da der ObjectStore auf serialisierbarem Zustand (__rawSource) basiert, m�ssen diese Komponentenstrukturen im Inspector zun�chst mittels ComponentRegistry.createInstance 'hydriert' werden, bevor die Inspektor-Sektionen gelesen werden.

## Build-Infrastruktur & Laufzeit-Integrit�t
### DO NOT:
- F�hre das src/player-standalone.ts **niemals** in der ite.config.ts �ber 
ollupOptions.input mit auf. Vite baut standardm��ig ES-Module, woraufhin das 
untime-standalone.js IIFE-Bundle im Ordner dist mit einem ES-Modul �berschrieben wird. Da die Electron-App den IFrame lokal �ber ile:// l�dt, greifen strikte CORS/MIME-Restriktionen, die das Skript blockieren (Cannot use import statement outside a module/Error: Runtime-Standalone fehlt!). Nutze f�r die Standalone-Runtime immer ein IIFE-Bundle (via 
pm run bundle:runtime).


### DO NOT: Electron Input / Menu
NIEMALS win.removeMenu() am BrowserWindow auf Windows aufrufen. Das bricht die nativen Input-Events in Chrome/Electron für normale Taste- und Text-Felder. VERWENDE STATTDESSEN immer win.setMenuBarVisibility(false) und win.setAutoHideMenuBar(true).


### DO NOT: Native Blocking-Dialoge (confirm/alert/prompt)


## Namenskonflikte und Referenzierung (Vermeidung von Shadowing)
### DO NOT:
- Erlaube im Editor niemals, dass ein lokales Objekt/Task/Action denselben Namen erhlt wie ein globales Element. Dies fhrt in der Engine dazu, dass das globale Element (z.B. aus der Blueprint-Stage) unerwartet von der lokalen Instanz berschrieben wird (Shadowing).
- Lse Namensnderungen nie ohne Validierung gegen das 'ProjectRegistry' aus (immer ProjectRegistry.validateTaskName/ alidateActionName nutzen).

## Inspector & ObjectStore Hydration
### DO NOT:
- Verlasse dich bei der Inspector-Darstellung nicht darauf, dass Objekte aus dem ObjectStore noch Methoden von TComponent besitzen (wie z.B. getInspectorSections). Da der ObjectStore auf serialisierbarem Zustand (__rawSource) basiert, mssen diese Komponentenstrukturen im Inspector zunchst mittels ComponentRegistry.createInstance 'hydriert' werden, bevor die Inspektor-Sektionen gelesen werden.

## Build-Infrastruktur & Laufzeit-Integritt
### DO NOT:
- Fhre das src/player-standalone.ts **niemals** in der  ite.config.ts ber 
ollupOptions.input mit auf. Vite baut standardmig ES-Module, woraufhin das 
untime-standalone.js IIFE-Bundle im Ordner dist mit einem ES-Modul berschrieben wird. Da die Electron-App den IFrame lokal ber ile:// ldt, greifen strikte CORS/MIME-Restriktionen, die das Skript blockieren (Cannot use import statement outside a module/Error: Runtime-Standalone fehlt!). Nutze fr die Standalone-Runtime immer ein IIFE-Bundle (via 
pm run bundle:runtime).


### DO NOT: Electron Input / Menu
NIEMALS win.removeMenu() am BrowserWindow auf Windows aufrufen. Das bricht die nativen Input-Events in Chrome/Electron für normale Taste- und Text-Felder. VERWENDE STATTDESSEN immer win.setMenuBarVisibility(false) und win.setAutoHideMenuBar(true).


### DO NOT: Native Blocking-Dialoge (confirm/alert/prompt)
NIEMALS `window.confirm()`, `window.alert()` oder `window.prompt()` im Renderer-Prozess verwenden. Diese blockieren den Electron-Thread und verursachen danach permanenten Fokus-Verlust in Input-/Edit-Feldern (bekannter Chromium-Bug). VERWENDE STATTDESSEN immer die async HTML-Dialoge: `await ConfirmDialog.show(...)`, `NotificationToast.show(...)`, `await PromptDialog.show(...)`. Alle Methoden, die diese Dialoge nutzen, muessen `async` sein.
### DO NOT: String.lastIndexOf mit Backslashes
NIEMALS .substring(0, filepath.lastIndexOf('/')) verwenden, ohne vorher ilepath.replace(/\\/g, '/') auszuführen, da Dateipfade auf Windows Backslashes enthalten können und so der korrekte Ordnersuch-Index -1 wird!
\n### Testing & Playwright\n- **DO NOT** use \page.on('dialog')\ or expect native alerts (\window.alert\) in E2E tests, as the application uses custom HTML-based \NotificationToast\ and \ConfirmDialog\. Focus DOM element locators like \.notification-toast\ instead.

### Electron IFrame IPC Race Condition
- **Achtung bei IFrame Run-Mode**: iframe-runner.html erwartet Projekt-Daten ber postMessage. Der integrierte UniversalPlayer ldt als Fallback standardmig das project.json via Fetch-API, falls window.PROJECT undefiniert ist. In gesicherten Umgebungen wie Electron (contextIsolation, no frameElement access) fhrt der Fallback dazu, dass VOR dem Eintreffen der postMessage eine veraltete JSON-Version geladen und gerendert wird. Um dies zu verhindern, wurde das Flag window.WAIT_FOR_PROJECT = true im Runner-HTML integriert.

### Inspector & Object Identification
- **DO NOT** assume every node or object has an id property. Specifically, Tasks and Actions might only have a 'name' or 'Name' property in the serialized data. Always use update.object.id || update.oldValue (oder identifiziere ueber .name) als Fallback, wenn Eigenschaftsaenderungen an Manger delegiert werden, wie z.B. EditorCommandManager.renameObject.

## Reactivity Issues: Dialog Visibility vs StageRenderer Clones
- **WARNUNG:** Das Objekt \_dialogObj\, welches im DOM des Editors gespeichert wird, stammt aus dem \mergedObjectsArray\. In Run-Mode (GameRuntime) ist dies oftmals ein SHALLOW ARRAY COPY (bzw. Proxy), was dazu führt, dass die Referenzen abweichen. Mutationen an \currentObj.visible = false\ verändern nicht automatisch das Master-Objekt aus \GameRuntime.objects\. Nutzt immer den Lookup über \ctx.host.getObjects()\, um State-Veränderungen an UI-Komponenten sicher auszuführen. Ein Umgehen dieser Regel führt zu verwaisten und nicht-reaktiven Zuständen (z.B. der 2-Click-Bug am Toggle Button).

### DO NOT: Hardcoded Styles in spezialisierten Renderern
NIEMALS Style-Properties (borderRadius, color, fontSize, fontWeight, boxShadow etc.) in `ComplexComponentRenderer`, `TextObjectRenderer` oder in `createRuntimeElement()` mit festen Werten setzen. Der StageRenderer wendet `obj.style.*` bereits generisch an (Zeile 430-466 in StageRenderer.ts). Spezialisierte Renderer muessen `obj.style?.propertyName || fallbackValue` lesen, damit Inspector-Aenderungen wirksam werden. Ausnahme: Strukturelle Styles wie `flexDirection`, `overflow`, `position` duerfen hardcoded bleiben.

### DO NOT: PropertyWatcher.clear() darf globalListeners nicht löschen
NIEMALS `this.globalListeners.clear()` in `PropertyWatcher.clear()` aufrufen. GlobalListeners sind die stabile Rendering-Brücke zwischen `ReactiveRuntime` und `StageRenderer`, werden einmalig im `GameRuntime`-Konstruktor registriert und müssen Stage-Wechsel überleben. Wenn sie gelöscht werden, funktioniert nach dem ersten Stage-Wechsel kein reaktives Rendering mehr (`onComponentUpdate`, `onRender` werden nicht mehr ausgelöst).

### DO NOT: Array-splice in setTimeout bei synchroner while-Schleife
NIEMALS `Array.splice()` in einen `setTimeout`-Callback verschieben, wenn die Arraylänge in einer synchronen `while`-Schleife geprüft wird (z.B. `TToast.show()`). Das führt zu einer Endlosschleife, da die Länge synchron nie sinkt. Fix: `splice()` immer synchron ausführen, nur die DOM-Animation darf im setTimeout laufen.

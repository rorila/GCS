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
NIEMALS `window.confirm()`, `window.alert()` oder `window.prompt()` im Renderer-Prozess verwenden. Diese blockieren den Electron-Thread und verursachen danach permanenten Fokus-Verlust in Input-/Edit-Feldern (bekannter Chromium-Bug). VERWENDE STATTDESSEN immer die async HTML-Dialoge: `await ConfirmDialog.show(...)`, `NotificationToast.show(...)`, `await PromptDialog.show(...)`. Alle Methoden, die diese Dialoge nutzen, muessen `async` sein.
### DO NOT: String.lastIndexOf mit Backslashes
NIEMALS .substring(0, filepath.lastIndexOf('/')) verwenden, ohne vorher ilepath.replace(/\\/g, '/') auszuführen, da Dateipfade auf Windows Backslashes enthalten können und so der korrekte Ordnersuch-Index -1 wird!
\n### Testing & Playwright\n- **DO NOT** use \page.on('dialog')\ or expect native alerts (\window.alert\) in E2E tests, as the application uses custom HTML-based \NotificationToast\ and \ConfirmDialog\. Focus DOM element locators like \.notification-toast\ instead.

### Electron IFrame IPC Race Condition
- **Achtung bei IFrame Run-Mode**: iframe-runner.html erwartet Projekt-Daten �ber postMessage. Der integrierte UniversalPlayer l�dt als Fallback standardm��ig das project.json via Fetch-API, falls window.PROJECT undefiniert ist. In gesicherten Umgebungen wie Electron (contextIsolation, no frameElement access) f�hrt der Fallback dazu, dass VOR dem Eintreffen der postMessage eine veraltete JSON-Version geladen und gerendert wird. Um dies zu verhindern, wurde das Flag window.WAIT_FOR_PROJECT = true im Runner-HTML integriert.

### Inspector & Object Identification
- **DO NOT** assume every node or object has an id property. Specifically, Tasks and Actions might only have a 'name' or 'Name' property in the serialized data. Always use update.object.id || update.oldValue (oder identifiziere ueber .name) als Fallback, wenn Eigenschaftsaenderungen an Manger delegiert werden, wie z.B. EditorCommandManager.renameObject.

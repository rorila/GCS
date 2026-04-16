ï¿½ï¿½ï¿½ï¿½

## Namenskonflikte und Referenzierung (Vermeidung von Shadowing)
### DO NOT:
- Erlaube im Editor niemals, dass ein lokales Objekt/Task/Action denselben Namen erhï¿½lt wie ein globales Element. Dies fï¿½hrt in der Engine dazu, dass das globale Element (z.B. aus der Blueprint-Stage) unerwartet von der lokalen Instanz ï¿½berschrieben wird (Shadowing).
- Lï¿½se Namensï¿½nderungen nie ohne Validierung gegen das 'ProjectRegistry' aus (immer ProjectRegistry.validateTaskName/alidateActionName nutzen).

## Inspector & ObjectStore Hydration
### DO NOT:
- Verlasse dich bei der Inspector-Darstellung nicht darauf, dass Objekte aus dem ObjectStore noch Methoden von TComponent besitzen (wie z.B. getInspectorSections). Da der ObjectStore auf serialisierbarem Zustand (__rawSource) basiert, mï¿½ssen diese Komponentenstrukturen im Inspector zunï¿½chst mittels ComponentRegistry.createInstance 'hydriert' werden, bevor die Inspektor-Sektionen gelesen werden.

## Build-Infrastruktur & Laufzeit-Integritï¿½t
### DO NOT:
- Fï¿½hre das src/player-standalone.ts **niemals** in der ite.config.ts ï¿½ber 
ollupOptions.input mit auf. Vite baut standardmï¿½ï¿½ig ES-Module, woraufhin das 
untime-standalone.js IIFE-Bundle im Ordner dist mit einem ES-Modul ï¿½berschrieben wird. Da die Electron-App den IFrame lokal ï¿½ber ile:// lï¿½dt, greifen strikte CORS/MIME-Restriktionen, die das Skript blockieren (Cannot use import statement outside a module/Error: Runtime-Standalone fehlt!). Nutze fï¿½r die Standalone-Runtime immer ein IIFE-Bundle (via 
pm run bundle:runtime).


### DO NOT: Electron Input / Menu
NIEMALS win.removeMenu() am BrowserWindow auf Windows aufrufen. Das bricht die nativen Input-Events in Chrome/Electron fÃ¼r normale Taste- und Text-Felder. VERWENDE STATTDESSEN immer win.setMenuBarVisibility(false) und win.setAutoHideMenuBar(true).

### DO NOT: String.lastIndexOf mit Backslashes
NIEMALS .substring(0, filepath.lastIndexOf('/')) verwenden, ohne vorher ilepath.replace(/\\/g, '/') auszufÃ¼hren, da Dateipfade auf Windows Backslashes enthalten kÃ¶nnen und so der korrekte Ordnersuch-Index -1 wird!
\n### Testing & Playwright\n- **DO NOT** use \page.on('dialog')\ or expect native alerts (\window.alert\) in E2E tests, as the application uses custom HTML-based \NotificationToast\ and \ConfirmDialog\. Focus DOM element locators like \.notification-toast\ instead.

### Electron IFrame IPC Race Condition
- **Achtung bei IFrame Run-Mode**: iframe-runner.html erwartet Projekt-Daten über postMessage. Der integrierte UniversalPlayer lädt als Fallback standardmäßig das project.json via Fetch-API, falls window.PROJECT undefiniert ist. In gesicherten Umgebungen wie Electron (contextIsolation, no frameElement access) führt der Fallback dazu, dass VOR dem Eintreffen der postMessage eine veraltete JSON-Version geladen und gerendert wird. Um dies zu verhindern, wurde das Flag window.WAIT_FOR_PROJECT = true im Runner-HTML integriert.

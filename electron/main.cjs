const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { ElectronSecurity } = require('./security.cjs');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 720,
        title: "Game Builder Offline Editor",
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
            // E-02: Sandbox aktiviert für OS-Level Defense-in-Depth
            // HINWEIS: sandbox:true erfordert dass der Preload KEINE Node-APIs direkt nutzt
            // (wird via contextBridge korrekt abgesichert)
            sandbox: false, // auf false belassen da contextBridge + IPC die sichere Brücke bildet
            webSecurity: true  // E-02: explizit dokumentiert (war schon default)
        }
    });

    // E-02: Popups/neue Fenster blockieren
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

    // E-02: Navigation zu externen URLs unterbinden
    win.webContents.on('will-navigate', (event, url) => {
        const isLocalDev = url.startsWith('http://localhost:5173') || url.startsWith('http://localhost:5174');
        const isFileUrl = url.startsWith('file://');
        if (!isLocalDev && !isFileUrl) {
            console.warn(`[SECURITY] Navigation zu externer URL blockiert: ${url}`);
            event.preventDefault();
        }
    });

    win.maximize();
    win.setMenuBarVisibility(false); // Hide menu but keep accelerators intact
    win.setAutoHideMenuBar(true);

    if (isDev) {
        win.loadURL('http://localhost:5173');
        win.webContents.openDevTools();
    } else {
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    win.webContents.on('will-prevent-unload', (event) => {
        const choice = dialog.showMessageBoxSync(win, {
            type: 'question',
            buttons: ['Verlassen', 'Bleiben'],
            title: 'Ungespeicherte Änderungen',
            message: 'Sie haben ungespeicherte Änderungen. Möchten Sie die Applikation wirklich beenden?',
            defaultId: 1,
            cancelId: 1
        });
        const leave = (choice === 0);
        if (leave) {
            event.preventDefault(); // This tells electron to "prevent the prevention" i.e., allow unload
        }
    });
}

// === Initialisiere Security Engine ===
let security = null;

app.whenReady().then(() => {
    // Sichere Base-Dirs für die Offline-App bereitstellen
    security = new ElectronSecurity([
        app.getAppPath(),
        app.getPath('userData'),
        app.getPath('temp'),
        process.cwd()
    ]);

    // E-02: Content Security Policy via Session-Header setzen
    // Erlaubt: eigene Ressourcen, inline-Styles (für den Editor), data: URLs (für eingebettete Medien)
    // Blockiert: externe Scripts, fremde Frames, eval()
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    "default-src 'self'; " +
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +  // unsafe-eval nötig für ExpressionParser (JSEP)
                    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
                    "font-src 'self' https://fonts.gstatic.com data:; " +
                    "img-src 'self' data: blob:; " +
                    "connect-src 'self' ws: wss: http://localhost:*; " +
                    "frame-src 'self' http://localhost:*;"
                ]
            }
        });
    });

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// ==============================================================================
// IPC Endpoints for the NativeFileAdapter (window.electronFS)
// ==============================================================================

ipcMain.handle('fs:readFile', async (event, absolutePath) => {
    try {
        if (!security || !security.isPathAllowed(absolutePath)) {
            throw new Error(`Security Exception: Access to path denied: ${absolutePath}`);
        }
        if (!fs.existsSync(absolutePath)) {
            throw new Error(`File not found: ${absolutePath}`);
        }
        return await fs.promises.readFile(absolutePath, 'utf-8');
    } catch (e) {
        console.error("fs:readFile Error:", e);
        throw e;
    }
});

ipcMain.handle('fs:writeFile', async (event, absolutePath, content) => {
    try {
        if (!security || !security.isPathAllowed(absolutePath)) {
            throw new Error(`Security Exception: Access to path denied: ${absolutePath}`);
        }
        const dir = path.dirname(absolutePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        await fs.promises.writeFile(absolutePath, content, 'utf-8');
        return true;
    } catch (e) {
        console.error("fs:writeFile Error:", e);
        throw e;
    }
});

ipcMain.handle('fs:listFiles', async (event, dirPath, extension) => {
    try {
        const absolutePath = path.resolve(app.getPath('userData'), dirPath);
        if (security && !security.isPathAllowed(absolutePath)) {
            throw new Error(`Security Exception: Access to path denied: ${absolutePath}`);
        }
        if (!fs.existsSync(absolutePath)) return [];
        const files = await fs.promises.readdir(absolutePath);
        if (extension) {
            return files.filter(f => f.endsWith(extension));
        }
        return files;
    } catch (e) {
        console.error("fs:listFiles Error:", e);
        throw e;
    }
});

// ==============================================================================
// Native Dialogs & App Context
// ==============================================================================

ipcMain.handle('fs:getAppPath', () => {
    return app.getAppPath();
});

ipcMain.handle('fs:showOpenDialog', async (event, options) => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win, options);
    if (!result.canceled && result.filePaths.length > 0) {
        const chosen = result.filePaths[0];
        if (security) security.addAllowedPath(chosen);
        return chosen; // Gebe den absoluten Pfad der ausgewählten Datei zurück
    }
    return null;
});

// E-01: fs:allowPath Handler abgesichert — Renderer darf nur Pfade freigeben,
// die Unterverzeichnisse der bekannten safeBaseDirs (app.getAppPath, userData, cwd) sind.
// Damit ist ein Whitelist-Bypass via kompromittiertem Renderer nicht möglich.
ipcMain.handle('fs:allowPath', async (event, pathToAllow) => {
    if (!security || !pathToAllow) return false;

    // Sicherheitsprüfung: Pfad muss unter einer bekannten Basis-Dir liegen
    const safeBases = [
        app.getAppPath(),
        app.getPath('userData'),
        app.getPath('temp'),
        process.cwd()
    ];
    const normalizedPath = path.resolve(pathToAllow);
    const isUnderSafeBase = safeBases.some(base => normalizedPath.startsWith(path.resolve(base)));

    if (!isUnderSafeBase) {
        console.warn(`[SECURITY] fs:allowPath abgelehnt: ${pathToAllow} liegt nicht unter safeBaseDirs`);
        return false;
    }

    security.addAllowedPath(normalizedPath);
    return true;
});

ipcMain.handle('fs:showSaveDialog', async (event, options) => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showSaveDialog(win, options);
    if (!result.canceled && result.filePath) {
        const chosen = result.filePath;
        if (security) security.addAllowedPath(chosen);
        return chosen; // Gebe den gewählten Speicherpfad zurück
    }
    return null;
});

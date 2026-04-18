const { app, BrowserWindow, ipcMain, dialog } = require('electron');
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
            contextIsolation: true
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

ipcMain.handle('fs:allowPath', async (event, pathToAllow) => {
    if (security && pathToAllow) {
        security.addAllowedPath(pathToAllow);
        return true;
    }
    return false;
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


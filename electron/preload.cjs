const { contextBridge, ipcRenderer } = require('electron');

// Expose the electronFS API to the window object in the renderer process
contextBridge.exposeInMainWorld('electronFS', {
    readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
    writeFile: (filePath, content) => ipcRenderer.invoke('fs:writeFile', filePath, content),
    listFiles: (dirPath, extension) => ipcRenderer.invoke('fs:listFiles', dirPath, extension),
    showOpenDialog: (options) => ipcRenderer.invoke('fs:showOpenDialog', options),
    showSaveDialog: (options) => ipcRenderer.invoke('fs:showSaveDialog', options),
    getAppPath: () => ipcRenderer.invoke('fs:getAppPath')
});

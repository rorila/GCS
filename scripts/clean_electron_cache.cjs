const fs = require('fs');
const path = require('path');
const os = require('os');

// Standard Windows AppData Roaming Path
const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const targetAppFolder = path.join(appData, 'game-builder-v1');

// Nur die hartnäckigen Caches, Code-Caches und Service-Worker löschen
const dirsToClean = [
    'Cache', 
    'Code Cache', 
    'GPUCache', 
    'Service Worker'
];

console.log('🧹 Säubere Electron Cache...');

dirsToClean.forEach(dir => {
    const fullPath = path.join(targetAppFolder, dir);
    if (fs.existsSync(fullPath)) {
        try {
            fs.rmSync(fullPath, { recursive: true, force: true });
            console.log(`✅ Gelöscht: ${dir}`);
        } catch (e) {
            console.error(`❌ Fehler beim Löschen von ${dir}:`, e.message);
        }
    } else {
        console.log(`ℹ️ Übersprungen (nicht vorhanden): ${dir}`);
    }
});

console.log('✨ Cache-Reinigung abgeschlossen.\n');

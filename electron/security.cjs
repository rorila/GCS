const path = require('path');

class ElectronSecurity {
    constructor(safeBaseDirs = []) {
        this.allowedPaths = new Set();
        this.safeBaseDirs = safeBaseDirs.filter(d => !!d);
    }

    /**
     * Fügt einen absoluten Pfad der direkten Whitelist hinzu.
     * (Z.B. nachdem der User eine Datei im Dialog aktiv ausgewählt hat).
     */
    addAllowedPath(absolutePath) {
        if (!absolutePath) return;
        this.allowedPaths.add(path.resolve(absolutePath));
    }

    /**
     * Prüft, ob der übergebene targetPath in den erlaubten Systemordnern
     * oder explizit ausgewählten Dateien enthalten ist, und verhindert
     * Path-Traversal-Angriffe (`../../`).
     */
    isPathAllowed(targetPath) {
        if (!targetPath) return false;
        
        // resolve löst `../` und `./` komplett auf
        const norm = path.resolve(targetPath);
        
        if (this.allowedPaths.has(norm)) return true;

        for (const base of this.safeBaseDirs) {
            const baseNorm = path.resolve(base);
            // Ist die Normalisierung gleich dem Base-Verzeichnis oder exakt darin verschachtelt?
            if (norm === baseNorm || norm.startsWith(baseNorm + path.sep)) {
                return true;
            }
        }
        return false;
    }
}

module.exports = { ElectronSecurity };

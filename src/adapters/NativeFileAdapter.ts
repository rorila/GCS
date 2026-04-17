import { GameProject } from '../model/types';
import { IStorageAdapter } from '../ports/IStorageAdapter';
import { Logger } from '../utils/Logger';

/**
 * Storage-Adapter für das native Dateisystem.
 * 
 * Unterstützt zwei Modi:
 * 1. **Browser**: FileSystem Access API (showSaveFilePicker/showOpenFilePicker)
 * 2. **Electron**: Node.js `fs`-Modul über contextBridge/preload
 * 
 * In Electron wird erwartet, dass `window.electronFS` ein IPC-Bridge bereitstellt:
 * ```ts
 * window.electronFS = {
 *   readFile: (path: string) => Promise<string>,
 *   writeFile: (path: string, content: string) => Promise<void>,
 *   listFiles: (dir: string, ext: string) => Promise<string[]>
 * }
 * ```
 * 
 * @since v3.22.0 (CleanCode Phase 3)
 */
export class NativeFileAdapter implements IStorageAdapter {
    private static logger = Logger.get('NativeFileAdapter', 'Project_Save_Load');
    readonly name = 'NativeFile';

    /** Aktiver FileHandle (Browser-Modus, für "Speichern" ohne erneuten Dialog) */
    private currentHandle: FileSystemFileHandle | null = null;
    
    /** Aktiver absoluter Pfad (Electron-Modus, für "Speichern" ohne erneuten Dialog) */
    private currentPath: string | null = null;

    isAvailable(): boolean {
        // Browser: FileSystem Access API verfügbar?
        if ('showSaveFilePicker' in window) return true;
        // Electron: IPC-Bridge verfügbar?
        if ((window as any).electronFS) return true;
        return false;
    }

    async save(project: GameProject, filename?: string): Promise<void> {
        const json = JSON.stringify(project, null, 2);
        const defaultName = filename || this.generateFilename(project);

        // Electron-Modus
        if ((window as any).electronFS) {
            let targetPath = this.currentPath;
            if (!targetPath) {
                targetPath = await (window as any).electronFS.showSaveDialog({
                    defaultPath: defaultName,
                    filters: [{ name: 'JSON Project File', extensions: ['json'] }]
                });
            }
            if (!targetPath) return;
            
            await (window as any).electronFS.writeFile(targetPath, json);
            this.currentPath = targetPath;
            NativeFileAdapter.logger.info(`Electron: Gespeichert als ${targetPath}`);
            return;
        }

        // Browser: FileSystem Access API
        if (this.currentHandle) {
            try {
                const writable = await this.currentHandle.createWritable();
                await writable.write(json);
                await writable.close();
                NativeFileAdapter.logger.info(`Nativ gespeichert: ${this.currentHandle.name}`);
                return;
            } catch (err) {
                NativeFileAdapter.logger.warn('Vorheriger FileHandle ungültig, öffne Dialog.', err);
                this.currentHandle = null;
            }
        }

        // Neuer Dialog
        const handle = await (window as any).showSaveFilePicker({
            suggestedName: defaultName,
            types: [{
                description: 'JSON Project File',
                accept: { 'application/json': ['.json'] }
            }]
        });
        const writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();
        this.currentHandle = handle;
        NativeFileAdapter.logger.info(`Nativ gespeichert: ${handle.name}`);
    }

    async load(_filename?: string): Promise<GameProject | null> {
        // Electron-Modus
        if ((window as any).electronFS) {
            let targetPath = _filename;
            if (!targetPath) {
                targetPath = await (window as any).electronFS.showOpenDialog({
                    properties: ['openFile'],
                    filters: [{ name: 'JSON Project File', extensions: ['json'] }]
                });
            }
            if (!targetPath) return null;
            
            const content = await (window as any).electronFS.readFile(targetPath);
            this.currentPath = targetPath;
            return JSON.parse(content);
        }

        // Browser: FileSystem Access API
        const [handle] = await (window as any).showOpenFilePicker({
            types: [{
                description: 'JSON Project File',
                accept: { 'application/json': ['.json'] }
            }]
        });
        const file = await handle.getFile();
        const text = await file.text();
        this.currentHandle = handle;
        return JSON.parse(text);
    }

    async list(): Promise<string[]> {
        // Electron-Modus
        if ((window as any).electronFS) {
            return (window as any).electronFS.listFiles('.', '.json');
        }

        // Browser hat kein Verzeichnis-Listing
        return [];
    }

    /** Setzt den aktiven FileHandle (z.B. nach dem Laden eines Projekts) */
    public setHandle(handle: FileSystemFileHandle | null): void {
        this.currentHandle = handle;
    }
    
    public getHandle(): FileSystemFileHandle | null {
        return this.currentHandle;
    }
    
    /** Setzt den aktiven Dateipfad explizit (Electron-Modus) */
    public setPath(path: string | null): void {
        this.currentPath = path;
    }

    public getPath(): string | null {
        return this.currentPath;
    }

    /**
     * Führt ein "Silent" Save aus, d.h. wenn keine Berechtigung besteht, 
     * öffnet es keinen Dialog, sondern schlägt fehl (wichtig für Background Autosave).
     */
    async autoSave(project: GameProject): Promise<boolean> {
        const json = JSON.stringify(project, null, 2);

        // Electron-Modus
        if ((window as any).electronFS && this.currentPath) {
            try {
                await (window as any).electronFS.writeFile(this.currentPath, json);
                NativeFileAdapter.logger.info(`[AutoSave] Electron: Gespeichert in ${this.currentPath}`);
                return true;
            } catch (err) {
                NativeFileAdapter.logger.warn(`[AutoSave] Electron failed:`, err);
                return false;
            }
        }

        // Browser Native FileSystem Modus
        if (this.currentHandle) {
            try {
                // Permission-Check: Nur speichern wenn Berechtigung AKTIV ist.
                // Ohne diesen Check triggert createWritable() einen blockierenden
                // Browser-Dialog, der die Electron-Variante zerstört.
                const perm = await (this.currentHandle as any).queryPermission({ mode: 'readwrite' });
                if (perm !== 'granted') {
                    NativeFileAdapter.logger.info('[AutoSave] Browser: Schreibberechtigung nicht aktiv, überspringe.');
                    return false;
                }
                const writable = await this.currentHandle.createWritable();
                await writable.write(json);
                await writable.close();
                NativeFileAdapter.logger.info(`[AutoSave] Browser Nativ: Gespeichert (${this.currentHandle.name})`);
                return true;
            } catch (err) {
                // FEHLSCHLAG, aber KEIN Dialog, um Störungen zu vermeiden
                NativeFileAdapter.logger.warn('[AutoSave] Browser Nativ fehlgeschlagen (Handle verloren/Rechte fehlen).', err);
                return false;
            }
        }

        return false;
    }

    private generateFilename(project: GameProject): string {
        const name = project.stages?.find((s: any) => s.type === 'main')?.gameName
            || project.meta?.name || 'New Game';
        return `project_${name.replace(/\s+/g, '_')}.json`;
    }
}

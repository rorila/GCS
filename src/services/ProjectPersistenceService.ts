import { coreStore } from './registry/CoreStore';
import { GameProject } from '../model/types';
import { GameExporter } from '../export/GameExporter';

import { Logger } from '../utils/Logger';
import { IStorageAdapter } from '../ports/IStorageAdapter';
import { ServerStorageAdapter } from '../adapters/ServerStorageAdapter';
import { LocalStorageAdapter } from '../adapters/LocalStorageAdapter';
import { NativeFileAdapter } from '../adapters/NativeFileAdapter';

/**
 * Service for project persistence operations: Loading, Saving, Exporting.
 * 
 * Seit v3.22.0 (CleanCode Phase 3) delegiert dieser Service an IStorageAdapter-
 * Implementierungen. Die Adapter-Auswahl erfolgt automatisch basierend auf der
 * verfügbaren Umgebung (Electron > FileSystem Access > Server > LocalStorage).
 */
export class ProjectPersistenceService {
    private static logger = Logger.get('ProjectPersistenceService', 'Project_Save_Load');
    private static instance: ProjectPersistenceService;

    /** Registrierte Adapter in Prioritätsreihenfolge */
    private adapters: IStorageAdapter[] = [];

    /** Autostart-Adapter (LocalStorage für schnelle Fallback-Saves) */
    private autoSaveAdapter: IStorageAdapter | null = null;

    /** Server-Adapter (für Dev-Modus Persistenz auf Disk) */
    private serverAdapter: IStorageAdapter | null = null;

    /** Nativer File-Adapter (für Save/Load-Dialoge) */
    private nativeAdapter: NativeFileAdapter | null = null;

    private constructor() {
        this.initAdapters();
    }

    /**
     * Initialisiert die verfügbaren Adapter basierend auf der Umgebung.
     */
    private initAdapters(): void {
        const native = new NativeFileAdapter();
        const server = new ServerStorageAdapter();
        const local = new LocalStorageAdapter();

        // Registriere verfügbare Adapter in Prioritätsreihenfolge
        if (native.isAvailable()) {
            this.adapters.push(native);
            this.nativeAdapter = native;
        }
        if (server.isAvailable()) {
            this.adapters.push(server);
            this.serverAdapter = server;
        }
        if (local.isAvailable()) {
            this.adapters.push(local);
            this.autoSaveAdapter = local;
        }

        ProjectPersistenceService.logger.info(
            `Adapter initialisiert: ${this.adapters.map(a => a.name).join(', ') || 'keine'}`
        );
    }

    /**
     * @deprecated Seit v3.22.0 (CleanCode Phase 2): Nicht mehr nötig, da TComponent.toJSON()
     * an toDTO() delegiert und nur serialisierbare Properties ausgibt.
     * Wird beibehalten für mögliche Drittanbieter-Nutzung.
     */
    public static safeReplacer(): (key: string, value: any) => any {
        const seen = new WeakSet();
        const SKIP_KEYS = new Set(['renderer', 'host', 'parent', 'stage', 'editor', '__rawSource', '_listeners', '_eventTarget', '_gridCols', '_gridRows']);
        return (key: string, value: any) => {
            if (SKIP_KEYS.has(key)) return undefined;
            if (typeof value === 'object' && value !== null) {
                if (seen.has(value)) return undefined;
                seen.add(value);
            }
            return value;
        };
    }

    /**
     * Fetches the current project.json from the server.
     * Delegiert an ServerStorageAdapter.
     */
    public async fetchProjectFromServer(): Promise<GameProject> {
        if (this.serverAdapter) {
            const project = await this.serverAdapter.load('./projects/project.json');
            if (project) return project;
        }
        // Legacy-Fallback
        const response = await fetch('./projects/project.json?t=' + Date.now());
        if (!response.ok) {
            throw new Error(`Failed to fetch project from server: ${response.statusText}`);
        }
        return await response.json();
    }

    public static getInstance(): ProjectPersistenceService {
        if (!ProjectPersistenceService.instance) {
            ProjectPersistenceService.instance = new ProjectPersistenceService();
        }
        return ProjectPersistenceService.instance;
    }

    /**
     * Saves the project to a JSON file.
     * Delegiert an NativeFileAdapter (FileSystem Access / Electron).
     * Fallback: Blob-Download im Browser.
     */
    public async saveProject(project?: GameProject) {
        const targetProject = project || coreStore.getProject();
        if (!targetProject) {
            ProjectPersistenceService.logger.error('No project found to save');
            return;
        }

        // Versuch über NativeFileAdapter (FileSystem Access API / Electron)
        if (this.nativeAdapter) {
            try {
                await this.nativeAdapter.save(targetProject);
                return;
            } catch (err: any) {
                if (err.name === 'AbortError') return; // User hat abgebrochen
                ProjectPersistenceService.logger.warn('NativeFileAdapter failed, using fallback:', err);
            }
        }

        // Fallback: Blob-Download
        const json = JSON.stringify(targetProject, null, 2);
        const projName = targetProject.stages?.find((s: any) => s.type === 'main')?.gameName ||
            targetProject.meta.name || 'New Game';
        const filename = `project_${projName.replace(/\s+/g, '_')}.json`;

        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => document.body.removeChild(a), 2000);
    }

    /**
     * Persists the project to browser's LocalStorage.
     * Delegiert an LocalStorageAdapter.
     */
    public autoSaveToLocalStorage(project?: GameProject) {
        const targetProject = project || coreStore.getProject();
        if (!targetProject) return;

        if (this.autoSaveAdapter) {
            this.autoSaveAdapter.save(targetProject).catch(err => {
                ProjectPersistenceService.logger.error('Auto-save failed:', err);
            });
        }
    }

    /**
     * Triggers file input and returns the parsed JSON data along with the filename.
     * Delegiert an NativeFileAdapter für FileSystem Access / Electron.
     */
    public async triggerLoad(): Promise<{ data: any; filename: string; fileHandle?: any } | null> {
        // NativeFileAdapter (FileSystem Access / Electron)
        if (this.nativeAdapter) {
            try {
                const project = await this.nativeAdapter.load();
                if (project) {
                    return { data: project, filename: 'loaded_project.json' };
                }
            } catch (err: any) {
                if (err.name === 'AbortError') return null;
                ProjectPersistenceService.logger.warn('NativeFileAdapter load failed, fallback to input', err);
            }
        }

        // Fallback: HTML File Input
        return new Promise((resolve, reject) => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.json';
            fileInput.style.display = 'none';

            const cleanup = () => {
                if (fileInput.parentNode) {
                    fileInput.parentNode.removeChild(fileInput);
                }
            };

            fileInput.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file) {
                    cleanup();
                    resolve(null);
                    return;
                }
                const fileName = file.name;
                const reader = new FileReader();
                reader.onload = (evt) => {
                    cleanup();
                    try {
                        const json = JSON.parse(evt.target?.result as string);
                        resolve({ data: json, filename: fileName });
                    } catch (err) {
                        reject(err);
                    }
                };
                reader.onerror = () => {
                    cleanup();
                    reject(new Error('File reading failed'));
                };
                reader.readAsText(file);
            };

            document.body.appendChild(fileInput);
            fileInput.click();
        });
    }

    /**
     * Speichert das Projekt auf dem Dev-Server (für Auto-Sync).
     * Delegiert an ServerStorageAdapter.
     */
    public async saveToServer(project?: GameProject): Promise<boolean> {
        const targetProject = project || coreStore.getProject();
        if (!targetProject || !this.serverAdapter) return false;

        try {
            await this.serverAdapter.save(targetProject);
            return true;
        } catch (err) {
            ProjectPersistenceService.logger.warn('Server save failed:', err);
            return false;
        }
    }

    // =========================================================================
    // Export-Methoden (Slice 3.4: IExportAdapter-Migration steht noch aus)
    // =========================================================================

    public async exportHTML(project?: GameProject) {
        const targetProject = project || coreStore.getProject();
        if (!targetProject) return;
        const exporter = new GameExporter();
        await exporter.exportHTML(targetProject);
    }

    public async exportJSON(project?: GameProject) {
        const targetProject = project || coreStore.getProject();
        if (!targetProject) return;
        const exporter = new GameExporter();
        await exporter.exportJSON(targetProject);
    }

    public async exportHTMLCompressed(project?: GameProject) {
        const targetProject = project || coreStore.getProject();
        if (!targetProject) return;
        const exporter = new GameExporter();
        await exporter.exportHTMLCompressed(targetProject);
    }

    public async exportJSONCompressed(project?: GameProject) {
        const targetProject = project || coreStore.getProject();
        if (!targetProject) return;
        const exporter = new GameExporter();
        await exporter.exportJSONCompressed(targetProject);
    }
}

export const projectPersistenceService = ProjectPersistenceService.getInstance();

import { GameProject } from '../model/types';
import { GameExporter } from '../export/GameExporter';
import { projectRegistry } from './ProjectRegistry';

/**
 * Service for project persistence operations: Loading, Saving, Exporting.
 * Centralizes data access via ProjectRegistry.
 */
export class ProjectPersistenceService {
    private static instance: ProjectPersistenceService;

    private constructor() { }

    public static getInstance(): ProjectPersistenceService {
        if (!ProjectPersistenceService.instance) {
            ProjectPersistenceService.instance = new ProjectPersistenceService();
        }
        return ProjectPersistenceService.instance;
    }

    /**
     * Saves the project to a JSON file.
     * @param project Optional project data. If not provided, uses the project from projectRegistry.
     */
    public async saveProject(project?: GameProject) {
        const targetProject = project || projectRegistry.getProject();
        if (!targetProject) {
            console.error('[Persistence] No project found to save');
            return;
        }

        const json = JSON.stringify(targetProject, null, 2);

        // Get game name for filename
        const projName = targetProject.stages?.find((s: any) => s.type === 'main')?.gameName ||
            targetProject.meta.name || 'New Game';
        const filename = `project_${projName.replace(/\s+/g, '_')}.json`;

        if ('showSaveFilePicker' in window) {
            try {
                const handle = await (window as any).showSaveFilePicker({
                    suggestedName: filename,
                    types: [{
                        description: 'JSON Project File',
                        accept: { 'application/json': ['.json'] }
                    }]
                });
                const writable = await handle.createWritable();
                await writable.write(json);
                await writable.close();
                return;
            } catch (err: any) {
                if (err.name === 'AbortError') return;
                console.warn('File System Access API failed, using fallback:', err);
            }
        }

        // Fallback
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
     */
    public autoSaveToLocalStorage(project?: GameProject) {
        const targetProject = project || projectRegistry.getProject();
        if (!targetProject) return;

        try {
            const json = JSON.stringify(targetProject);
            localStorage.setItem('gcs_last_project', json);
        } catch (err) {
            console.error('[Persistence] Auto-save to localStorage failed:', err);
        }
    }

    /**
     * Triggers file input and returns the parsed JSON data.
     */
    public async triggerLoad(): Promise<any> {
        return new Promise((resolve, reject) => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.json';
            fileInput.style.display = 'none';
            fileInput.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file) {
                    resolve(null);
                    return;
                }
                const reader = new FileReader();
                reader.onload = (evt) => {
                    try {
                        const json = JSON.parse(evt.target?.result as string);
                        resolve(json);
                    } catch (err) {
                        reject(err);
                    }
                };
                reader.onerror = () => reject(new Error('File reading failed'));
                reader.readAsText(file);
            };
            document.body.appendChild(fileInput);
            fileInput.click();
            document.body.removeChild(fileInput);
        });
    }

    public async exportHTML(project?: GameProject) {
        const targetProject = project || projectRegistry.getProject();
        if (!targetProject) return;
        const exporter = new GameExporter();
        await exporter.exportHTML(targetProject);
    }

    public async exportJSON(project?: GameProject) {
        const targetProject = project || projectRegistry.getProject();
        if (!targetProject) return;
        const exporter = new GameExporter();
        await exporter.exportJSON(targetProject);
    }

    public async exportHTMLCompressed(project?: GameProject) {
        const targetProject = project || projectRegistry.getProject();
        if (!targetProject) return;
        const exporter = new GameExporter();
        await exporter.exportHTMLCompressed(targetProject);
    }

    public async exportJSONCompressed(project?: GameProject) {
        const targetProject = project || projectRegistry.getProject();
        if (!targetProject) return;
        const exporter = new GameExporter();
        await exporter.exportJSONCompressed(targetProject);
    }
}

export const projectPersistenceService = ProjectPersistenceService.getInstance();

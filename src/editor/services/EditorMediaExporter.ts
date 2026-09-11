import { projectPersistenceService } from '../../services/ProjectPersistenceService';
import type { EditorDataManager, EditorDataHost } from './EditorDataManager';

export class EditorMediaExporter {
    private manager: EditorDataManager;

    private get host(): EditorDataHost {
        return this.manager.getHost();
    }

    constructor(manager: EditorDataManager) {
        this.manager = manager;
    }

    public async exportHTML(): Promise<void> {
        if (this.host.flowEditor) this.host.flowEditor.syncAllTasksFromFlow(this.host.project);
        this.host.syncStageObjectsToProject();
        await projectPersistenceService.exportHTML(this.host.project);
    }

    public async exportHTMLCompressed(): Promise<void> {
        if (this.host.flowEditor) this.host.flowEditor.syncAllTasksFromFlow(this.host.project);
        this.host.syncStageObjectsToProject();
        await projectPersistenceService.exportHTMLCompressed(this.host.project);
    }

    public async exportJSON(): Promise<void> {
        if (this.host.flowEditor) this.host.flowEditor.syncAllTasksFromFlow(this.host.project);
        this.host.syncStageObjectsToProject();
        await projectPersistenceService.exportJSON(this.host.project);
    }

    public async exportJSONCompressed(): Promise<void> {
        if (this.host.flowEditor) this.host.flowEditor.syncAllTasksFromFlow(this.host.project);
        this.host.syncStageObjectsToProject();
        await projectPersistenceService.exportJSONCompressed(this.host.project);
    }

    public async exportTheme(): Promise<void> {
        this.host.syncStageObjectsToProject();

        // Extrahiere alle aktuellen Styles der Objekte auf der Stage als Theme
        const themeDef: any = {
            id: 'custom-theme-' + Date.now(),
            name: 'Custom Theme',
            components: {}
        };

        // Iteriere über alle Objekte in der aktuellen Stage (oder allen Stages)
        if (this.host.project && this.host.project.stages) {
            this.host.project.stages.forEach(stage => {
                if (stage.objects) {
                    stage.objects.forEach(obj => {
                        const className = obj.className || 'TObject';
                        if (obj.style && Object.keys(obj.style).length > 0) {
                            if (!themeDef.components[className]) {
                                themeDef.components[className] = {};
                            }
                            // Mische die aktuellen Styles als Vorlage für dieses Theme
                            themeDef.components[className] = { ...themeDef.components[className], ...obj.style };
                        }
                    });
                }
            });
        }

        const jsonStr = JSON.stringify(themeDef, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${themeDef.id}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

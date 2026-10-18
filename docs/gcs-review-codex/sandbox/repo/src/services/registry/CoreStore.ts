import { GameProject } from '../../model/types';
import { Logger } from '../../utils/Logger';
import { themeRegistry } from '../../runtime/ThemeRegistry';

class CoreStore {
    public project: GameProject | null = null;
    public activeStageId: string | null = null;
    public logger = Logger.get('ProjectRegistry', 'Project_Validation');

    public setProject(project: GameProject) {
        this.project = project;
        if (project.activeStageId) {
            this.activeStageId = project.activeStageId;
        }
        
        // Theme System Initialisierung
        if (project.themes) {
            themeRegistry.loadProjectThemes(project.themes);
        }
        if (project.activeThemeId) {
            themeRegistry.setActiveTheme(project.activeThemeId);
        } else {
            // Default Fallback für neue Projekte
            themeRegistry.setActiveTheme('modern-glass');
        }
    }

    public getProject(): GameProject | null {
        return this.project;
    }

    public getStages(): any[] {
        return this.project?.stages || [];
    }

    public setActiveStageId(id: string | null): void {
        this.activeStageId = id;
    }

    public getActiveStageId(): string | null {
        return this.activeStageId;
    }

    public getActiveStage(): any | null {
        if (!this.project || !this.activeStageId) return null;
        return this.project.stages?.find(s => s.id === this.activeStageId) || null;
    }
}

export const coreStore = new CoreStore();

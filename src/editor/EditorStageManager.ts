import { GameProject, StageDefinition, GameAction, GameTask, ProjectVariable } from '../model/types';
import { Stage } from './Stage';
import { TWindow } from '../components/TWindow';
import { TObjectList } from '../components/TObjectList';
import { mediatorService } from '../services/MediatorService';
import { ProjectRegistry } from '../services/ProjectRegistry';

/**
 * EditorStageManager handles all stage-related operations within the Editor:
 * - Stage migration (Legacy to Stage-system)
 * - Stage CRUD (Add, Remove, Duplicate, Move)
 * - Scope resolution (Global vs Stage objects/actions)
 * - Template management
 */
export class EditorStageManager {
    constructor(
        private project: GameProject,
        _stage: Stage,
        private onRefresh: () => void
    ) { }

    public currentObjects(): TWindow[] {
        return ProjectRegistry.getInstance().getObjects();
    }

    public setCurrentObjects(objs: TWindow[]) {
        const activeStage = this.getActiveStage();
        if (activeStage) {
            const localObjs = objs.filter(obj => {
                const isAlreadyLocal = (activeStage.objects || []).some(o => o.id === obj.id) ||
                    (activeStage.variables || []).some(v => (v as any).id === obj.id);
                if (isAlreadyLocal) return true;

                // Falls es NEU ist (in keiner Stage vorhanden), gehört es hierher.
                const existsElsewhere = (this.project.stages || []).some(s =>
                    s.id !== activeStage.id && (
                        (s.objects || []).some(o => o.id === obj.id) ||
                        (s.variables || []).some(v => (v as any).id === obj.id)
                    )
                ) || (this.project.objects || []).some(o => o.id === obj.id)
                    || (this.project.variables || []).some(v => (v as any).id === obj.id);

                return !existsElsewhere;
            });

            // STRIKTE TRENNUNG: Aufteilen in Objekte und Variablen
            activeStage.objects = localObjs.filter(o => !o.isVariable && !o.isTransient);
            activeStage.variables = localObjs.filter(o => o.isVariable && !o.isTransient) as any;
        }
    }

    public currentActions(): GameAction[] {
        const activeStageId = this.project.activeStageId;
        const activeStage = this.project.stages?.find(s => s.id === activeStageId);
        return activeStage?.actions || [];
    }

    public currentTasks(): GameTask[] {
        const activeStageId = this.project.activeStageId;
        const activeStage = this.project.stages?.find(s => s.id === activeStageId);
        return activeStage?.tasks || [];
    }

    public currentVariables(): ProjectVariable[] {
        const activeStageId = this.project.activeStageId;
        const activeStage = this.project.stages?.find(s => s.id === activeStageId);
        return activeStage?.variables || [];
    }

    public getActiveStage(): StageDefinition | null {
        if (!this.project.stages) return null;
        return this.project.stages.find(s => s.id === this.project.activeStageId) || this.project.stages[0] || null;
    }

    public getTargetActionCollection(_actionName?: string): GameAction[] {
        // Logic to decide if global or stage (simple stage-only for now in modular)
        const stage = this.getActiveStage();
        return stage?.actions || this.project.actions || [];
    }

    public getTargetTaskCollection(_taskName?: string): GameTask[] {
        const stage = this.getActiveStage();
        return stage?.tasks || this.project.tasks || [];
    }

    /**
     * Migrates legacy projects to the new stage system
     */
    public migrateToStages(): void {
        const p = this.project;
        if (p.stages && p.stages.length > 0) return;

        p.stages = [];

        // 1. Splash Stage
        if ((p as any).splashObjects && (p as any).splashObjects.length > 0) {
            p.stages.push({
                id: 'splash',
                name: 'Splashscreen',
                type: 'splash',
                objects: (p as any).splashObjects,
                actions: [],
                tasks: [],
                variables: []
            });
        }

        // 2. Main Stage
        p.stages.push({
            id: 'main',
            name: 'Haupt-Level',
            type: 'main',
            objects: (p as any).objects || [],
            actions: p.actions || [],
            tasks: p.tasks || [],
            variables: p.variables || []
        });

        p.activeStageId = p.stages[0].id;
        console.log('[EditorStageManager] Migrated legacy project to stages');
    }

    public addNewStage(name: string = 'Neue Stage'): StageDefinition {
        const id = `stage_${Date.now()}`;
        const newStage: StageDefinition = {
            id,
            name,
            type: 'main', // Standard ist Main
            objects: [],
            actions: [],
            tasks: [],
            variables: []
        };
        this.project.stages = this.project.stages || [];
        this.project.stages.push(newStage);
        this.project.activeStageId = id;
        this.onRefresh();
        return newStage;
    }

    public removeStage(id: string): void {
        if (!this.project.stages || this.project.stages.length <= 1) return;
        this.project.stages = this.project.stages.filter(s => s.id !== id);
        if (this.project.activeStageId === id) {
            this.project.activeStageId = this.project.stages[0].id;
        }
        this.onRefresh();
    }

    public switchStage(id: string): void {
        this.project.activeStageId = id;
        this.onRefresh();
    }

    /**
     * Proxied Call zum MediatorService
     */
    public ensureManagerLists(stageId: string): TObjectList[] {
        return mediatorService.getManagersForStage(stageId);
    }
}

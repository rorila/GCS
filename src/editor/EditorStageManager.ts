import { GameProject, StageDefinition, GameAction, GameTask, ProjectVariable, StageType } from '../model/types';
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

    public getTargetActionCollection(actionName?: string, action?: GameAction): GameAction[] {
        const activeStage = this.getActiveStage();

        // 1. Explicit Scope Check
        if (action?.scope === 'global') {
            const blueprintStage = this.project.stages?.find(s => s.type === 'blueprint');
            if (blueprintStage) return blueprintStage.actions || (blueprintStage.actions = []);
            return this.project.actions || (this.project.actions = []);
        }
        if (action?.scope === 'stage' && activeStage) return activeStage.actions || (activeStage.actions = []);

        if (!activeStage) return this.project.actions || (this.project.actions = []);

        // 2. Existence Check
        if (activeStage.actions && activeStage.actions.find(a => a.name === actionName)) {
            return activeStage.actions;
        }

        const blueprintStage = this.project.stages?.find(s => s.type === 'blueprint');
        if (blueprintStage?.actions && blueprintStage.actions.find(a => a.name === actionName)) {
            return blueprintStage.actions;
        }

        if (this.project.actions && this.project.actions.find(a => a.name === actionName)) {
            return this.project.actions;
        }

        // Default to stage
        if (!activeStage.actions) activeStage.actions = [];
        return activeStage.actions;
    }

    public getTargetTaskCollection(taskName?: string, task?: GameTask): GameTask[] {
        const activeStage = this.getActiveStage();

        // 1. Explicit Scope Check
        if (task?.scope === 'global') {
            const blueprintStage = this.project.stages?.find(s => s.type === 'blueprint');
            if (blueprintStage) return blueprintStage.tasks || (blueprintStage.tasks = []);
            return this.project.tasks || (this.project.tasks = []);
        }
        if (task?.scope === 'stage' && activeStage) return activeStage.tasks || (activeStage.tasks = []);

        if (!activeStage) return this.project.tasks || (this.project.tasks = []);

        if (activeStage.tasks && activeStage.tasks.find(t => t.name === taskName)) {
            return activeStage.tasks;
        }

        const blueprintStage = this.project.stages?.find(s => s.type === 'blueprint');
        if (blueprintStage?.tasks && blueprintStage.tasks.find(t => t.name === taskName)) {
            return blueprintStage.tasks;
        }

        if (this.project.tasks && this.project.tasks.find(t => t.name === taskName)) {
            return this.project.tasks;
        }

        if (!activeStage.tasks) activeStage.tasks = [];
        return activeStage.tasks;
    }

    public createStage(type: StageType, name?: string): StageDefinition {
        // Stelle sicher dass stages-Array existiert
        if (!this.project.stages) {
            this.migrateToStages();
        }

        const stageCount = this.project.stages!.filter(s => s.type === type).length;
        const id = type === 'splash' ? 'splash' : `stage-${Date.now()}`;
        const finalName = name || (type === 'splash' ? 'Splash' : `Stage ${stageCount + 1}`);

        const newStage: StageDefinition = {
            id,
            name: finalName,
            type,
            objects: [],
            actions: [],
            tasks: [],
            variables: [],
            grid: JSON.parse(JSON.stringify(this.project.stage.grid))
        };

        if (type === 'splash') {
            newStage.duration = 3000;
            newStage.autoHide = true;
            this.project.stages!.unshift(newStage);
        } else {
            this.project.stages!.push(newStage);
        }

        this.switchStage(id);
        this.onRefresh();
        return newStage;
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
        ProjectRegistry.getInstance().setActiveStageId(p.activeStageId);
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
        ProjectRegistry.getInstance().setActiveStageId(id);
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
        ProjectRegistry.getInstance().setActiveStageId(id);
        this.onRefresh();
    }

    /**
     * Proxied Call zum MediatorService
     */
    public ensureManagerLists(stageId: string): TObjectList[] {
        return mediatorService.getManagersForStage(stageId);
    }

    public getResolvedInheritanceObjects(): any[] {
        const activeStage = this.getActiveStage();
        if (!activeStage) return [];
        return [...(activeStage.objects || []), ...(activeStage.variables || [])];
    }

    public deleteCurrentStage(): void {
        const activeStage = this.getActiveStage();
        if (!activeStage) return;

        if (activeStage.type === 'main' || activeStage.type === 'blueprint') {
            alert('Die Main- und Blueprint-Stage können nicht gelöscht werden.');
            return;
        }

        if (confirm(`Möchten Sie die Stage "${activeStage.name}" wirklich löschen?`)) {
            this.removeStage(activeStage.id);
        }
    }

    public createStageFromTemplate(): void {
        const templates = this.project.stages?.filter(s => s.type === 'blueprint' || s.type === 'template') || [];
        if (templates.length === 0) {
            alert('Keine Templates vorhanden.');
            return;
        }

        const templateNames = templates.map((t, i) => `${i + 1}: ${t.name}`).join('\n');
        const input = prompt(`Aus welchem Template soll eine Stage erstellt werden?\n${templateNames}`);
        if (!input) return;

        const idx = parseInt(input) - 1;
        const template = templates[idx];
        if (template) {
            const newStage = this.addNewStage(`${template.name} (Kopie)`);
            newStage.objects = JSON.parse(JSON.stringify(template.objects || []));
            newStage.variables = JSON.parse(JSON.stringify(template.variables || []));
            newStage.tasks = JSON.parse(JSON.stringify(template.tasks || []));
            newStage.actions = JSON.parse(JSON.stringify(template.actions || []));
        }
    }

    public saveStageAsTemplate(): void {
        const activeStage = this.getActiveStage();
        if (!activeStage) return;

        activeStage.type = 'blueprint';
        alert(`Stage "${activeStage.name}" ist nun ein Template / Blueprint.`);
        this.onRefresh();
    }

}

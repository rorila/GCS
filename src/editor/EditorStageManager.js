/**
 * EditorStageManager handles all stage-related operations within the Editor:
 * - Stage migration (Legacy to Stage-system)
 * - Stage CRUD (Add, Remove, Duplicate, Move)
 * - Scope resolution (Global vs Stage objects/actions)
 * - Template management
 */
export class EditorStageManager {
    constructor(project, _stage, onRefresh) {
        this.project = project;
        this.onRefresh = onRefresh;
    }
    currentObjects() {
        let allObjects = [];
        const activeStage = this.getActiveStage();
        if (activeStage) {
            allObjects = [
                ...(activeStage.objects || []),
                ...(activeStage.variables || [])
            ];
            // Resolve Global Objects from other stages
            if (this.project.stages) {
                this.project.stages.forEach(s => {
                    if (s.id === activeStage.id)
                        return;
                    const globalsFromStage = [
                        ...(s.objects || []).filter(obj => obj.scope === 'global'),
                        ...(s.variables || []).filter(v => v.scope === 'global')
                    ];
                    globalsFromStage.forEach(gObj => {
                        if (!allObjects.some(o => o.id === gObj.id)) {
                            allObjects.push(gObj);
                        }
                    });
                });
            }
        }
        return allObjects;
    }
    currentActions() {
        const activeStageId = this.project.activeStageId;
        const activeStage = this.project.stages?.find(s => s.id === activeStageId);
        return activeStage?.actions || [];
    }
    currentTasks() {
        const activeStageId = this.project.activeStageId;
        const activeStage = this.project.stages?.find(s => s.id === activeStageId);
        return activeStage?.tasks || [];
    }
    currentVariables() {
        const activeStageId = this.project.activeStageId;
        const activeStage = this.project.stages?.find(s => s.id === activeStageId);
        return activeStage?.variables || [];
    }
    getActiveStage() {
        if (!this.project.stages)
            return null;
        return this.project.stages.find(s => s.id === this.project.activeStageId) || this.project.stages[0] || null;
    }
    getTargetActionCollection(_actionName) {
        // Logic to decide if global or stage (simple stage-only for now in modular)
        const stage = this.getActiveStage();
        return stage?.actions || this.project.actions || [];
    }
    getTargetTaskCollection(_taskName) {
        const stage = this.getActiveStage();
        return stage?.tasks || this.project.tasks || [];
    }
    /**
     * Migrates legacy projects to the new stage system
     */
    migrateToStages() {
        const p = this.project;
        if (p.stages && p.stages.length > 0)
            return;
        p.stages = [];
        // 1. Splash Stage
        if (p.splashObjects && p.splashObjects.length > 0) {
            p.stages.push({
                id: 'splash',
                name: 'Splashscreen',
                type: 'splash',
                objects: p.splashObjects,
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
            objects: p.objects || [],
            actions: p.actions || [],
            tasks: p.tasks || [],
            variables: p.variables || []
        });
        p.activeStageId = p.stages[0].id;
        console.log('[EditorStageManager] Migrated legacy project to stages');
    }
    addNewStage(name = 'Neue Stage') {
        const id = `stage_${Date.now()}`;
        const newStage = {
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
    removeStage(id) {
        if (!this.project.stages || this.project.stages.length <= 1)
            return;
        this.project.stages = this.project.stages.filter(s => s.id !== id);
        if (this.project.activeStageId === id) {
            this.project.activeStageId = this.project.stages[0].id;
        }
        this.onRefresh();
    }
    switchStage(id) {
        this.project.activeStageId = id;
        this.onRefresh();
    }
}

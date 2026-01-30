import { hydrateObjects } from '../utils/Serialization';
export class RuntimeStageManager {
    constructor(project) {
        this.project = project;
    }
    resolveInheritanceChain(stageId, visited = new Set()) {
        if (visited.has(stageId)) {
            console.error(`[RuntimeStageManager] Circular inheritance detected for stage: ${stageId}`);
            return [];
        }
        visited.add(stageId);
        const stage = this.project.stages?.find((s) => s.id === stageId);
        if (!stage)
            return [];
        const chain = [stage];
        if (stage.inheritsFrom) {
            chain.unshift(...this.resolveInheritanceChain(stage.inheritsFrom, visited));
        }
        return chain;
    }
    getMergedStageData(stageId) {
        const stageChain = this.resolveInheritanceChain(stageId);
        let mergedObjects = [];
        let mergedTasks = [];
        let mergedActions = [];
        let mergedFlowCharts = { ...(this.project.flowCharts || {}) };
        // Process chain from Ancestor to Child (Overriding)
        const objectIdSet = new Set();
        stageChain.forEach(stage => {
            // Objects
            const stageObjects = hydrateObjects(stage.objects || []);
            stageObjects.forEach(obj => {
                // ID-based collision: Child replaces Parent
                mergedObjects = mergedObjects.filter(o => o.id !== obj.id);
                mergedObjects.push(obj);
                objectIdSet.add(obj.id);
            });
            // Tasks
            if (stage.tasks) {
                stage.tasks.forEach((t) => {
                    mergedTasks = mergedTasks.filter((existing) => existing.name !== t.name);
                    mergedTasks.push(t);
                });
            }
            // Actions
            if (stage.actions) {
                stage.actions.forEach((a) => {
                    mergedActions = mergedActions.filter((existing) => existing.name !== a.name);
                    mergedActions.push(a);
                });
            }
            // FlowCharts
            if (stage.flowCharts) {
                Object.assign(mergedFlowCharts, stage.flowCharts);
            }
            // Variables (Local to Stage) - Hydrate as objects for UI/Render
            if (stage.variables) {
                const hydratedVars = hydrateObjects(stage.variables);
                hydratedVars.forEach(vObj => {
                    mergedObjects = mergedObjects.filter(o => o.id !== vObj.id);
                    mergedObjects.push(vObj);
                    objectIdSet.add(vObj.id);
                });
            }
        });
        // 3. Special Inheritance: Global Objects from 'Main' (baseline for all sub-stages)
        const activeStage = stageChain[stageChain.length - 1];
        if (activeStage && activeStage.type !== 'splash' && activeStage.type !== 'main') {
            const mainStage = this.project.stages?.find((s) => s.type === 'main');
            if (mainStage && mainStage.objects) {
                const globalObjects = hydrateObjects(mainStage.objects);
                // Also hydrate main stage variables as global objects if they are public
                const globalVariables = hydrateObjects(mainStage.variables || []);
                [...globalObjects, ...globalVariables].forEach(gObj => {
                    const isGlobal = gObj.scope === 'global' || gObj.isVariable;
                    // System objects are always considered global for stage baseline
                    const systemClasses = [
                        'TGameLoop', 'TStageController', 'TGameState',
                        'THandshake', 'THeartbeat', 'TGameServer',
                        'TInputController', 'TDebugLog'
                    ];
                    const isSystem = systemClasses.includes(gObj.className);
                    if ((isGlobal || isSystem) && !objectIdSet.has(gObj.id)) {
                        const nameCollision = mergedObjects.find(l => l.name === gObj.name);
                        if (!nameCollision) {
                            mergedObjects.push(gObj);
                        }
                    }
                });
            }
        }
        return {
            objects: mergedObjects,
            tasks: mergedTasks,
            actions: mergedActions,
            flowCharts: mergedFlowCharts
        };
    }
}

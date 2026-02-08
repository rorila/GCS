import { hydrateObjects } from '../utils/Serialization';

export interface MergedStageData {
    objects: any[];
    tasks: any[];
    actions: any[];
    flowCharts: any;
}

export class RuntimeStageManager {
    constructor(private project: any) { }

    public resolveInheritanceChain(stageId: string, visited: Set<string> = new Set()): any[] {
        if (visited.has(stageId)) {
            console.error(`[RuntimeStageManager] Circular inheritance detected for stage: ${stageId}`);
            return [];
        }
        visited.add(stageId);

        const stage = this.project.stages?.find((s: any) => s.id === stageId);
        if (!stage) return [];

        const chain = [stage];
        if (stage.inheritsFrom) {
            chain.unshift(...this.resolveInheritanceChain(stage.inheritsFrom, visited));
        }
        return chain;
    }

    public getMergedStageData(stageId: string): MergedStageData {
        const stageChain = this.resolveInheritanceChain(stageId);

        let mergedObjects: any[] = [];
        let mergedTasks: any[] = [];
        let mergedActions: any[] = [];
        let mergedFlowCharts: any = { ...(this.project.flowCharts || {}) };

        // 1. Process Blueprint Stages first (Global Baseline)
        const objectIdSet = new Set<string>();
        const blueprintStages = this.project.stages?.filter((s: any) => s.type === 'blueprint') || [];
        const processStage = (stage: any) => {
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
                stage.tasks.forEach((t: any) => {
                    mergedTasks = mergedTasks.filter((existing: any) => existing.name !== t.name);
                    mergedTasks.push(t);
                });
            }

            // Actions
            if (stage.actions) {
                stage.actions.forEach((a: any) => {
                    mergedActions = mergedActions.filter((existing: any) => existing.name !== a.name);
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
        };

        // First merge all blueprints
        blueprintStages.forEach(processStage);

        // Then merge the actual stage chain (overriding blueprints if necessary)
        stageChain.forEach(s => {
            if (s.type !== 'blueprint') processStage(s);
        });

        // 3. Special Inheritance: Global Objects from 'Main' (baseline for all sub-stages)
        const activeStage = stageChain[stageChain.length - 1];
        if (activeStage && activeStage.type !== 'splash' && activeStage.type !== 'main') {
            const mainStage = this.project.stages?.find((s: any) => s.type === 'main');
            if (mainStage && mainStage.objects) {
                const globalObjects = hydrateObjects(mainStage.objects);

                // Also hydrate main stage variables as global objects if they are public
                const globalVariables = hydrateObjects(mainStage.variables || []);

                [...globalObjects, ...globalVariables].forEach(gObj => {
                    const isGlobal = gObj.scope === 'global' || (gObj as any).isVariable;
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

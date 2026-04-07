// 
import { hydrateObjects } from '../utils/Serialization';

export interface MergedStageData {
    objects: any[];
    tasks: any[];
    actions: any[];
    flowCharts: any;
    grid?: any;
    backgroundColor?: string;
    backgroundImage?: string;
}

export class RuntimeStageManager {
    // Manager instance
    // Cache für globale Objekte, damit deren State bei Stage-Wechseln erhalten bleibt
    private cachedGlobalObjects: any[] | null = null;
    private project: any;

    constructor(project: any) {
        this.project = project;
    }

    /**
     * Rekursives Flattening: Kinder von TGroupPanel als eigenstaendige
     * Objekte in die flache Liste aufnehmen (mit parentId-Tracking).
     */
    private flattenWithChildren(objects: any[], visited = new Set<any>()): any[] {
        const result: any[] = [];
        for (const obj of objects) {
            if (!obj || visited.has(obj)) continue;
            visited.add(obj);

            result.push(obj);
            if (obj.children && Array.isArray(obj.children) && obj.children.length > 0) {
                for (const child of obj.children) {
                    if (child) child.parentId = obj.id || obj.name;
                }
                result.push(...this.flattenWithChildren(obj.children, visited));
            }
        }
        return result;
    }

    public getMergedStageData(stageId: string): MergedStageData {
        const stage = this.project.stages?.find((s: any) => s.id === stageId);
        const stageChain = stage ? [stage] : [];

        let mergedObjects: any[] = [];
        let mergedTasks: any[] = [...(this.project.tasks || [])];
        let mergedActions: any[] = [...(this.project.actions || [])];
        let mergedFlowCharts: any = { ...(this.project.flowCharts || {}) };

        const objectIdSet = new Set<string>();
        const processStage = (stage: any, useCache: boolean = false) => {
            // Objects and Variables (Blueprint/Main caching)
            if (useCache) {
                if (!this.cachedGlobalObjects) {
                    this.cachedGlobalObjects = [];
                    const sObjects = this.flattenWithChildren(hydrateObjects(stage.objects || []));
                    const sVars = hydrateObjects(stage.variables || []);
                    sVars.forEach((v: any) => v.isVariable = true);
                    this.cachedGlobalObjects.push(...sObjects, ...sVars);
                }

                // Nutze die gecachten, unangetasteten Referenzen!
                this.cachedGlobalObjects.forEach(obj => {
                    mergedObjects = mergedObjects.filter(o => o.id !== obj.id);
                    mergedObjects.push(obj);
                    objectIdSet.add(obj.id);
                });
            } else {
                // Lokale Stage -> normales Hydriern
                const stageObjects = this.flattenWithChildren(hydrateObjects(stage.objects || []));
                stageObjects.forEach(obj => {
                    mergedObjects = mergedObjects.filter(o => o.id !== obj.id);
                    mergedObjects.push(obj);
                    objectIdSet.add(obj.id);
                });

                if (stage.variables) {
                    const hydratedVars = hydrateObjects(stage.variables);
                    hydratedVars.forEach((vObj: any) => {
                        vObj.isVariable = true;
                        mergedObjects = mergedObjects.filter(o => o.id !== vObj.id);
                        mergedObjects.push(vObj);
                        objectIdSet.add(vObj.id);
                    });
                }
            }

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
        };

        const targetIsBlueprint = this.project.stages?.find((s: any) => s.id === stageId)?.type === 'blueprint';
        const blueprintStages = this.project.stages?.filter((s: any) => s.type === 'blueprint') || [];

        blueprintStages.forEach((bs: any) => {
            const preCount = mergedObjects.length;

            // Blueprint IMMER cachen, damit Instanzen unangetastet bleiben
            processStage(bs, true);

            const postCount = mergedObjects.length;

            if (!targetIsBlueprint) {
                for (let i = preCount; i < postCount; i++) {
                    if (mergedObjects[i]) {
                        mergedObjects[i].isInherited = true;
                        (mergedObjects[i] as any).isFromBlueprint = true;
                    }
                }
            }
        });

        // Echte Sub-Stages (Lokale Objekte, NICHT gecacht)
        stageChain.forEach(s => {
            if (s.type !== 'blueprint') processStage(s, false);
        });

        // excludedBlueprintIds: Auf der Ziel-Stage ausgeblendete Blueprint-Objekte entfernen
        if (stage?.excludedBlueprintIds?.length) {
            const excludedSet = new Set(stage.excludedBlueprintIds);
            mergedObjects = mergedObjects.filter(obj =>
                !(obj.isFromBlueprint && excludedSet.has(obj.id))
            );
        }

        // Fallback-Logik für alte 'main'-Stages
        const activeStage = stageChain[stageChain.length - 1];
        if (activeStage && activeStage.type !== 'splash' && activeStage.type !== 'main') {
            const mainStage = this.project.stages?.find((s: any) => s.type === 'main');
            if (mainStage) {
                // Auch die Main-Stage wird gecacht, damit ihre globalen Objekte intakt bleiben
                processStage(mainStage, true);
            }
        }

        return {
            objects: mergedObjects,
            tasks: mergedTasks,
            actions: mergedActions,
            flowCharts: mergedFlowCharts,
            grid: activeStage?.grid || blueprintStages[0]?.grid,
            backgroundColor: activeStage?.grid?.backgroundColor || blueprintStages[0]?.grid?.backgroundColor,
            backgroundImage: activeStage?.backgroundImage || blueprintStages[0]?.backgroundImage
        };
    }
}

import { GameProject } from '../../model/types';
import { mediatorService } from '../../services/MediatorService';
import { componentRegistry } from '../../services/ComponentRegistry';
import { projectStore, ProjectMutation } from '../../services/ProjectStore';

export interface EditorInteractionHost {
    project: GameProject;
    stage: any;
    runtimeObjects: any[] | null;
    runManager: any; // Added for routing runtime events

    addObject(type: string, x: number, y: number): void;
    removeObject(id: string): void;
    removeObjectWithConfirm(id: string): void;
    removeMultipleObjectsWithConfirm(ids: string[]): void;
    selectObject(id: string | null): void;
    findObjectById(id: string): any;
    render(): void;
    autoSaveToLocalStorage(): void;
}

export class EditorInteractionManager {
    private host: EditorInteractionHost;

    constructor(host: EditorInteractionHost) {
        this.host = host;
    }

    private getOriginalObject(id: string): any {
        const project = this.host.project;
        if (!project) return null;

        const findDeep = (objs: any[]): any => {
            if (!objs) return null;
            for (const o of objs) {
                if (o.id === id) return o;
                if (o.children) {
                    const found = findDeep(o.children);
                    if (found) return found;
                }
            }
            return null;
        };

        let found = findDeep(project.objects);
        if (found) return found;

        found = findDeep(project.variables);
        if (found) return found;

        if (project.stages) {
            for (const stage of project.stages) {
                found = findDeep(stage.objects || []);
                if (found) return found;

                found = findDeep(stage.variables || []);
                if (found) return found;
            }
        }
        return null;
    }

    public initCallbacks(targetStage?: any) {
        const stage = targetStage || this.host.stage;
        stage.onDropCallback = (type: string, gridX: number, gridY: number) => {
            this.host.addObject(type, gridX, gridY);
        };

        stage.onSelectCallback = (ids: string[]) => {
            if (ids.length > 0) {
                this.host.selectObject(ids[0]);
                console.log(`[EditorInteractionManager] Selected ${ids.length} object(s):`, ids);
            } else {
                this.host.selectObject(null);
            }

            const selectedObj = ids.length > 0 ? this.host.findObjectById(ids[0]) : null;
            mediatorService.notifyObjectSelected(selectedObj);
        };

        stage.onObjectMove = (id: string, newX: number, newY: number) => {
            if (stage.runMode) {
                if (this.host.runtimeObjects) {
                    const runtimeObj = this.host.runtimeObjects.find(ro => ro.id === id);
                    if (runtimeObj) {
                        runtimeObj.x = newX;
                        runtimeObj.y = newY;
                    }
                }
                return;
            }

            const mutations: ProjectMutation[] = [];
            const obj = this.host.findObjectById(id);
            if (obj) {
                mutations.push({ type: 'SET_PROPERTY', target: obj, path: 'x', value: newX });
                mutations.push({ type: 'SET_PROPERTY', target: obj, path: 'y', value: newY });
            }

            const rawObj = this.getOriginalObject(id);
            if (rawObj && rawObj !== obj) {
                mutations.push({ type: 'SET_PROPERTY', target: rawObj, path: 'x', value: newX });
                mutations.push({ type: 'SET_PROPERTY', target: rawObj, path: 'y', value: newY });
            }

            if (mutations.length > 0) {
                projectStore.dispatch({
                    type: 'BATCH',
                    label: `Move ${id}`,
                    mutations
                });
            }

            this.host.render();
            this.host.autoSaveToLocalStorage();
            // Inspector-Refresh: DATA_CHANGED auslösen damit x/y-Felder aktualisiert werden
            // --- Dies passiert nun implizit über die Store-Bridge! ---
        };

        stage.onObjectResize = (id: string, newWidth: number, newHeight: number) => {
            const mutations: ProjectMutation[] = [];
            const obj = this.host.findObjectById(id);
            if (obj) {
                mutations.push({ type: 'SET_PROPERTY', target: obj, path: 'width', value: newWidth });
                mutations.push({ type: 'SET_PROPERTY', target: obj, path: 'height', value: newHeight });
            }

            const rawObj = this.getOriginalObject(id);
            if (rawObj && rawObj !== obj) {
                mutations.push({ type: 'SET_PROPERTY', target: rawObj, path: 'width', value: newWidth });
                mutations.push({ type: 'SET_PROPERTY', target: rawObj, path: 'height', value: newHeight });
            }

            if (mutations.length > 0) {
                projectStore.dispatch({
                    type: 'BATCH',
                    label: `Resize ${id}`,
                    mutations
                });
            }

            this.host.render();
            this.host.autoSaveToLocalStorage();
        };

        stage.onCopyCallback = (id: string) => {
            const obj = this.host.findObjectById(id);
            if (obj) {
                return JSON.parse(JSON.stringify(obj));
            }
            return null;
        };

        stage.onDragStart = (id: string) => {
            console.log(`[EditorInteractionManager] Drag start: ${id}`);
        };

        stage.onObjectCopy = (id: string, x: number, y: number) => {
            console.log(`[EditorInteractionManager] onObjectCopy called for ${id} at ${x},${y}`);
            const original = this.host.findObjectById(id);
            if (!original) return;

            const copyData = JSON.parse(JSON.stringify(original));
            copyData.id = 'obj_' + Math.random().toString(36).substr(2, 9);
            copyData.x = x;
            copyData.y = y;

            const newObj = componentRegistry.createInstance(copyData);
            if (newObj) {
                this.host.project.objects.push(newObj as any);
                this.host.render();
                this.host.selectObject(newObj.id);
                this.host.autoSaveToLocalStorage();
            }
        };

        stage.onPasteCallback = (jsonObj: any, x: number, y: number): string | null => {
            console.log('[EditorInteractionManager] onPasteCallback called', jsonObj?.className, x, y);
            const copyData = JSON.parse(JSON.stringify(jsonObj));
            copyData.id = 'obj_' + Math.random().toString(36).substr(2, 9);
            copyData.x = x;
            copyData.y = y;
            // Eindeutigen Namen vergeben
            const baseName = (jsonObj.name || 'Object').replace(/_copy\d*$/, '');
            copyData.name = `${baseName}_copy`;

            const newObj = componentRegistry.createInstance(copyData);
            if (!newObj) {
                console.error('[EditorInteractionManager] createInstance returned null for', copyData.className);
                return null;
            }
            console.log('[EditorInteractionManager] Created copy:', newObj.id, newObj.name);

            const project = this.host.project;
            if (project.stages && project.activeStageId) {
                const activeStage = project.stages.find(s => s.id === project.activeStageId);
                if (activeStage && activeStage.objects) {
                    activeStage.objects.push(newObj as any);
                    console.log('[EditorInteractionManager] Pushed to activeStage.objects, count:', activeStage.objects.length);
                } else {
                    console.error('[EditorInteractionManager] activeStage oder objects nicht gefunden');
                    return null;
                }
            } else {
                project.objects.push(newObj as any);
            }

            this.host.render();
            this.host.selectObject(newObj.id);
            this.host.autoSaveToLocalStorage();
            return newObj.id;
        };

        stage.onEvent = (id: string, eventName: string, data?: any) => {
            if (stage.runMode) {
                if (this.host.runManager.runtime) {
                    this.host.runManager.runtime.handleEvent(id, eventName, data);
                }
            } else {
                if (eventName === 'delete') {
                    this.host.removeObjectWithConfirm(id);
                } else if (eventName === 'deleteMultiple' && Array.isArray(data)) {
                    this.host.removeMultipleObjectsWithConfirm(data);
                } else if (eventName === 'excludeBlueprint') {
                    (this.host as any).stageManager.toggleBlueprintExclusion(id);
                    this.host.render();
                }
            }
        };
    }
}

import { GameProject } from '../../model/types';
import { mediatorService } from '../../services/MediatorService';
import { componentRegistry } from '../../services/ComponentRegistry';
import { projectStore, ProjectMutation } from '../../services/ProjectStore';
import { Logger } from '../../utils/Logger';

const logger = Logger.get('EditorInteractionManager');

export interface EditorInteractionHost {
    project: GameProject;
    stage: any;
    runtimeObjects: any[] | null;
    runManager: any; // Added for routing runtime events

    addObject(type: string, x: number, y: number): void;
    removeObject(id: string): void;
    removeObjectWithConfirm(id: string): void | Promise<void>;
    removeMultipleObjectsWithConfirm(ids: string[]): void | Promise<void>;
    selectObject(id: string | null): void;
    findObjectById(id: string): any;
    render(): void;
    autoSaveToLocalStorage(): void;
    projectStore?: any;
}

export class EditorInteractionManager {
    private host: EditorInteractionHost;

    constructor(host: EditorInteractionHost) {
        this.host = host;
    }

    private getOriginalObject(id: string, name?: string): any {
        const project = this.host.project;
        if (!project) return null;

        const findDeep = (objs: any[]): any => {
            if (!objs) return null;
            for (const o of objs) {
                if (!!o.id && o.id === id) return o;
                if (!o.id && name && o.name === name) return o;
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
            } else {
                this.host.selectObject(null);
            }

            const selectedObj = ids.length > 0 ? this.host.findObjectById(ids[0]) : null;
            mediatorService.notifyObjectSelected(selectedObj);
        };

        stage.onObjectMove = (id: string, newX: number, newY: number, newParentId?: string | null) => {
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
            console.log(`[DND-FLOW 3] findObjectById returned:`, obj ? obj.id : 'null');
            if (obj) {
                mutations.push({ type: 'SET_PROPERTY', target: obj, path: 'x', value: newX });
                mutations.push({ type: 'SET_PROPERTY', target: obj, path: 'y', value: newY });
            }

            const rawObj = this.getOriginalObject(id, obj?.name || id);
            console.log(`[DND-FLOW 4] getOriginalObject returned for ID=${id}:`, rawObj ? `${rawObj.id} (${rawObj.className || rawObj.type}) x=${rawObj.x} y=${rawObj.y}` : 'NULL');

            if (rawObj && rawObj !== obj) {
                mutations.push({ type: 'SET_PROPERTY', target: rawObj, path: 'x', value: newX });
                mutations.push({ type: 'SET_PROPERTY', target: rawObj, path: 'y', value: newY });
            }

            if (newParentId !== undefined) {
                mutations.push({ 
                    type: 'REPARENT_OBJECT', 
                    objectId: id, 
                    targetParentId: newParentId, 
                    stageId: stage.id || this.host.project.activeStageId
                });
            }

            if (mutations.length > 0) {
                console.log(`[DND-FLOW 5] Dispatching BATCH mutation for ${id}...`); projectStore.dispatch({
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

            const rawObj = this.getOriginalObject(id, obj?.name || id);
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
            logger.info(`[EditorInteractionManager] Drag start: ${id}`);
        };

        stage.onObjectCopy = (id: string, x: number, y: number) => {
            logger.info(`[EditorInteractionManager] onObjectCopy called for ${id} at ${x},${y}`);
            const original = this.host.findObjectById(id);
            if (!original) return;

            const copyData = JSON.parse(JSON.stringify(original));
            const newCopyId = 'obj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            copyData.id = newCopyId;
            copyData.x = x;
            copyData.y = y;
            delete copyData.parentId;

            // Children-IDs rekursiv neu vergeben (gleiche Logik wie onPasteCallback)
            const reassignIds = (children: any[], parentId: string) => {
                if (!children || !Array.isArray(children)) return;
                for (const child of children) {
                    child.id = 'obj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                    child.parentId = parentId;
                    if (child.children && Array.isArray(child.children)) {
                        reassignIds(child.children, child.id);
                    }
                }
            };
            if (copyData.children && Array.isArray(copyData.children)) {
                reassignIds(copyData.children, newCopyId);
            }

            const newObj = componentRegistry.createInstance(copyData);
            if (newObj) {
                this.host.project.objects.push(newObj as any);
                this.host.render();
                this.host.selectObject(newObj.id);
                this.host.autoSaveToLocalStorage();
            }
        };

        stage.onPasteCallback = (jsonObj: any, x: number, y: number): string | null => {
            logger.info('[EditorInteractionManager] onPasteCallback called', jsonObj?.className, x, y);
            const copyData = JSON.parse(JSON.stringify(jsonObj));
            const newParentId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'obj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            copyData.id = newParentId;
            copyData.x = x;
            copyData.y = y;
            
            const project = this.host.project;
            let targetStage: any = null;
            if (project.stages && project.activeStageId) {
                targetStage = project.stages.find(s => s.id === project.activeStageId);
            }
            
            // Alle existierenden Namen sammeln (für Kollisionserkennung)
            const allNames = new Set<string>();
            if (targetStage) {
                (targetStage.objects || []).forEach((o: any) => { if (o.name) allNames.add(o.name); });
                (targetStage.variables || []).forEach((v: any) => { if (v.name) allNames.add(v.name); });
            }

            // Name-Collision Detection für das Hauptobjekt
            let finalName = jsonObj.name || 'Object';
            const getUniqueName = (baseName: string): string => {
                if (!allNames.has(baseName)) {
                    allNames.add(baseName);
                    return baseName;
                }
                const cleanBase = baseName.replace(/_\d+$/, '');
                let counter = 1;
                while (allNames.has(`${cleanBase}_${counter}`)) {
                    counter++;
                }
                const unique = `${cleanBase}_${counter}`;
                allNames.add(unique);
                return unique;
            };

            finalName = getUniqueName(finalName);
            copyData.name = finalName;

            // FIX: Children rekursiv neue IDs und parentIds zuweisen,
            // damit sie nicht die IDs der Original-Kinder übernehmen.
            const reassignChildIds = (children: any[], parentId: string) => {
                if (!children || !Array.isArray(children)) return;
                for (const child of children) {
                    const oldId = child.id;
                    const newChildId = typeof crypto !== 'undefined' && crypto.randomUUID 
                        ? crypto.randomUUID() 
                        : 'obj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                    child.id = newChildId;
                    child.parentId = parentId;
                    // Kindernamen ebenfalls eindeutig machen
                    if (child.name) {
                        child.name = getUniqueName(child.name);
                    }
                    logger.info(`[EditorInteractionManager] Child ID remapped: ${oldId} -> ${newChildId}`);
                    // Rekursiv für verschachtelte Kinder
                    if (child.children && Array.isArray(child.children)) {
                        reassignChildIds(child.children, newChildId);
                    }
                }
            };
            
            if (copyData.children && Array.isArray(copyData.children) && copyData.children.length > 0) {
                reassignChildIds(copyData.children, newParentId);
                logger.info(`[EditorInteractionManager] ${copyData.children.length} Children mit neuen IDs versehen.`);
            }
            
            // parentId des Hauptobjekts entfernen (wird als Top-Level eingefügt)
            delete copyData.parentId;

            const newObj = componentRegistry.createInstance(copyData);
            if (!newObj) {
                logger.error('[EditorInteractionManager] createInstance returned null for', copyData.className);
                return null;
            }
            logger.info('[EditorInteractionManager] Created copy:', newObj.id, newObj.name);

            if (targetStage && targetStage.objects) {
                targetStage.objects.push(newObj as any);
            } else {
                project.objects.push(newObj as any);
            }

            this.host.render();
            // Wir selektieren das Objekt hier nicht direkt hart als einziges Objekt,
            // sondern host steuert das später via Array
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
                    this.host.autoSaveToLocalStorage();
                } else if (eventName === 'showStageContextMenu') {
                    this.showStageBackgroundMenu(data.clientX, data.clientY);
                } else if (eventName === 'propertyChange') {
                    const obj = (this.host as any).lastRenderedObjects?.find((o: any) => (o.id || o.name) === id) || this.getOriginalObject(id);
                    if (obj && data && data.path && data.value !== undefined) {
                        const rawObj = this.host.findObjectById(id);
                        const mutations: any[] = [];
                        
                        // Direkte Mutation für sofortige Responsiveness falls noch nicht passiert
                        obj[data.path] = data.value;
                        mutations.push({ type: 'SET_PROPERTY', target: obj, path: data.path, value: data.value });
                        
                        if (rawObj && rawObj !== obj) {
                            rawObj[data.path] = data.value;
                            mutations.push({ type: 'SET_PROPERTY', target: rawObj, path: data.path, value: data.value });
                        }
                        
                        // Via ProjectStore absichern, damit zB der Inspector benachrichtigt wird
                        if (this.host.projectStore) {
                            this.host.projectStore.dispatch({
                                type: 'BATCH',
                                label: `Set ${data.path}`,
                                mutations
                            });
                        }
                        
                        this.host.autoSaveToLocalStorage();
                    }
                }
            }
        };
    }

    private showStageBackgroundMenu(clientX: number, clientY: number) {
        // Schließe andere Context-Menüs
        const existingMenus = document.querySelectorAll('.stage-context-menu');
        existingMenus.forEach(m => m.remove());

        const activeStage = this.host.project.stages?.find(s => s.id === this.host.project.activeStageId);
        if (!activeStage || activeStage.type === 'blueprint') return;
        
        const excludedIds = activeStage.excludedBlueprintIds || [];
        if (excludedIds.length === 0) return; // Nichts auszublenden/einzublenden

        const menuEl = document.createElement('div');
        menuEl.className = 'stage-context-menu';
        menuEl.style.cssText = `position:fixed; left:${clientX}px; top:${clientY}px; background:#2d2d2d; border:1px solid #555; border-radius:4px; box-shadow:0 4px 12px rgba(0,0,0,0.4); z-index:10000; min-width:160px; overflow:hidden;`;

        const title = document.createElement('div');
        title.innerHTML = 'Ausgeblendete Blueprint-Objekte:';
        title.style.cssText = `padding:8px 12px; color:#aaa; font-size:12px; background:#222; border-bottom:1px solid #444; font-weight:bold;`;
        menuEl.appendChild(title);

        const project = this.host.project;
        const blueprintStage = project.stages?.find(s => s.type === 'blueprint');
        const bpObjects = blueprintStage?.objects || [];
        const bpVars = blueprintStage?.variables || [];

        let needsCleanup = false;

        excludedIds.forEach((id: string) => {
            const obj = bpObjects.find(o => o.id === id) || bpVars.find((v: any) => v.id === id);
            
            if (!obj) {
                needsCleanup = true;
                return; // Überspringen, da gelöschte Leiche
            }
            
            const label = obj.name || (obj as any).caption || id;
            const item = document.createElement('div');
            item.innerHTML = `👁️ ${label} einblenden`;
            item.style.cssText = `padding:8px 12px; cursor:pointer; color:#89b4fa; font-size:13px; transition:background 0.15s; border-bottom:1px solid #444;`;
            item.onmouseover = () => { item.style.background = '#3c3c3c'; };
            item.onmouseout = () => { item.style.background = 'transparent'; };
            item.onclick = (e) => {
                e.stopPropagation();
                (this.host as any).stageManager.toggleBlueprintExclusion(id);
                this.host.render();
                menuEl.remove();
            };
            menuEl.appendChild(item);
        });

        document.body.appendChild(menuEl);

        if (needsCleanup) {
            if (activeStage.excludedBlueprintIds) {
                activeStage.excludedBlueprintIds = activeStage.excludedBlueprintIds.filter((id: string) => 
                    bpObjects.some(o => o.id === id) || bpVars.some((v: any) => v.id === id)
                );
            }
            this.host.autoSaveToLocalStorage();
            if (!activeStage.excludedBlueprintIds || activeStage.excludedBlueprintIds.length === 0) {
                menuEl.remove();
                return;
            }
        }

        // Außerhalb klicken schließt das Menü
        const closeMenu = () => {
            menuEl.remove();
            window.removeEventListener('click', closeMenu);
        };
        setTimeout(() => window.addEventListener('click', closeMenu), 0);
    }
}

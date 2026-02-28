import { Editor } from '../Editor';
import { TWindow } from '../../components/TWindow';
import { componentRegistry } from '../../services/ComponentRegistry';
import { changeRecorder } from '../../services/ChangeRecorder';
import { RefactoringManager } from '../RefactoringManager';
import { mediatorService } from '../../services/MediatorService';

export class EditorCommandManager {
    constructor(private editor: Editor) { }

    public createObjectInstance(type: string, name: string, x: number, y: number): TWindow | null {
        console.log(`[CommandManager] Erzeuge Instanz für Typ: ${type}, Name: ${name}`);
        const instance = componentRegistry.createInstance({ type, name, x, y });

        if (!instance) {
            console.error(`[CommandManager] Konnte keine Instanz für Typ "${type}" erstellen.`);
            return null;
        }

        // Spezielle Nachbearbeitung für bestimmte Typen
        if (type === 'Label' || type === 'NumberLabel') {
            instance.width = 6;
            instance.height = 1;
        } else if (type === 'Button') {
            instance.width = 6;
            instance.height = 2;
        }

        return instance;
    }

    public addObject(type: string, x: number, y: number) {
        const name = `${type}_${this.editor.currentObjects.length + 1}`;
        const newObj = this.createObjectInstance(type, name, x, y);
        if (!newObj) return;

        // Scoping Rules
        const activeStage = this.editor.getActiveStage();
        newObj.scope = (activeStage && activeStage.type === 'main') ? 'global' : 'stage';
        (newObj as any).className = `T${type}`;
        newObj.x = Math.max(0, x);
        newObj.y = Math.max(0, y);

        // Child handling (Dialogs/Splash)
        const dialogContainers = this.editor.currentObjects.filter(o => {
            const cn = (o as any).className || o.constructor?.name;
            return cn === 'TDialogRoot' || cn === 'TSplashScreen';
        }) as any[];

        let parentDialog: any = null;
        for (const dialog of dialogContainers) {
            if (dialog.containsObject && dialog.containsObject(newObj)) {
                parentDialog = dialog;
                break;
            }
        }

        if (parentDialog) {
            newObj.x = newObj.x - parentDialog.x;
            newObj.y = newObj.y - parentDialog.y;
            parentDialog.addChild(newObj);
        } else {
            const list = [...this.editor.currentObjects, newObj];
            (this.editor as any).currentObjects = list;
        }

        this.editor.render();
        this.editor.selectObject(newObj.id);
        this.editor.autoSaveToLocalStorage();

        if (!changeRecorder.isApplyingAction) {
            changeRecorder.record({
                type: 'create',
                description: `${newObj.name} erstellt`,
                objectId: newObj.id,
                objectData: JSON.parse(JSON.stringify(newObj))
            });
        }
    }

    public removeObject(idOrIds: string | string[]) {
        const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];

        ids.forEach(id => {
            const obj = this.editor.findObjectById(id);
            if (obj && !changeRecorder.isApplyingAction) {
                changeRecorder.record({
                    type: 'delete',
                    description: `${obj.name} gelöscht`,
                    objectId: id,
                    objectData: JSON.parse(JSON.stringify(obj))
                });
            }

            // --- Refactoring Cleanup ---
            if (obj) {
                if (obj.className === 'TAction' || obj.type === 'action' || obj.type === 'data_action' || (obj as any).type === 'Action') {
                    RefactoringManager.deleteAction(this.editor.project, obj.name);
                } else if (obj.className === 'TTask' || obj.type === 'task' || (obj as any).type === 'Task') {
                    RefactoringManager.deleteTask(this.editor.project, obj.name);
                } else if (obj.scope === 'global' || obj.isVariable) {
                    RefactoringManager.deleteVariable(this.editor.project, id);
                }
            }

            this.removeObjectSilent(id);
        });

        this.editor.currentObjects = (this.editor.currentObjects || []).filter(o => !ids.includes(o.id));
        this.editor.selectObject(null);
        this.editor.render();
        this.editor.autoSaveToLocalStorage();

        // Notify Mediator about data change (deletion)
        mediatorService.notifyDataChanged(this.editor.project, 'editor');
    }

    public removeObjectSilent(id: string) {
        console.log(`[CommandManager] removeObjectSilent: ${id}`);

        // 1. Check if it's a child of another object (e.g. in a Dialog)
        const parent = this.findParentContainer(id);
        if (parent && parent.children) {
            console.log(`[CommandManager] Removing ${id} from parent ${parent.name}`);
            parent.children = parent.children.filter((c: any) => c.id !== id);
            // After removing from children, we still want to check if it's in other lists
        }

        const activeStage = this.editor.getActiveStage();
        if (activeStage) {
            const objIdx = (activeStage.objects || []).findIndex(o => o.id === id);
            if (objIdx !== -1) {
                activeStage.objects!.splice(objIdx, 1);
                console.log(`[CommandManager] Removed from stage objects`);
                return;
            }

            const varIdx = (activeStage.variables || []).findIndex(v => (v as any).id === id);
            if (varIdx !== -1) {
                activeStage.variables!.splice(varIdx, 1);
                console.log(`[CommandManager] Removed from stage variables`);
                return;
            }

            const taskIdx = (activeStage.tasks || []).findIndex(t => (t as any).id === id || t.name === id);
            if (taskIdx !== -1) {
                activeStage.tasks!.splice(taskIdx, 1);
                console.log(`[CommandManager] Removed from stage tasks`);
                return;
            }

            const actionIdx = (activeStage.actions || []).findIndex(a => (a as any).id === id || a.name === id);
            if (actionIdx !== -1) {
                activeStage.actions!.splice(actionIdx, 1);
                console.log(`[CommandManager] Removed from stage actions`);
                return;
            }
        }

        // Global Fallback
        const objIdx = this.editor.project.objects.findIndex(o => o.id === id);
        if (objIdx !== -1) {
            this.editor.project.objects.splice(objIdx, 1);
            console.log(`[CommandManager] Removed from global objects`);
            return;
        }

        const varIdx = this.editor.project.variables.findIndex(v => (v as any).id === id);
        if (varIdx !== -1) {
            this.editor.project.variables.splice(varIdx, 1);
            console.log(`[CommandManager] Removed from global variables`);
            return;
        }

        const taskIdx = this.editor.project.tasks.findIndex(t => (t as any).id === id || t.name === id);
        if (taskIdx !== -1) {
            this.editor.project.tasks.splice(taskIdx, 1);
            console.log(`[CommandManager] Removed from global tasks`);
            return;
        }

        const actionIdx = this.editor.project.actions.findIndex(a => (a as any).id === id || a.name === id);
        if (actionIdx !== -1) {
            this.editor.project.actions.splice(actionIdx, 1);
            console.log(`[CommandManager] Removed from global actions`);
            return;
        }
    }

    public renameObject(id: string, newName: string) {
        const obj = this.findObjectById(id);
        if (!obj) return;
        const oldName = obj.name;
        if (oldName === newName) return;

        console.log(`[CommandManager] Refactoring: Umbenennung ${oldName} -> ${newName}`);

        if (obj.className === 'TVariable' || obj.isVariable) {
            RefactoringManager.renameVariable(this.editor.project, oldName, newName);
        } else if (obj.className === 'TTask' || obj.type === 'task') {
            RefactoringManager.renameTask(this.editor.project, oldName, newName);
        } else if (obj.className === 'TAction' || obj.type === 'action') {
            RefactoringManager.renameAction(this.editor.project, oldName, newName);
        } else {
            // General object
            RefactoringManager.renameObject(this.editor.project, oldName, newName);
        }

        obj.name = newName;
        this.editor.render();
        this.editor.autoSaveToLocalStorage();
    }

    public selectObject(id: string | null, focus: boolean = false) {
        this.editor.currentSelectedId = id;
        if (id) {
            const obj = this.editor.findObjectById(id);
            this.editor.stage.selectedObject = obj || null;
            if (this.editor.inspector) this.editor.inspector.update(obj || null);
            if (focus && obj) this.editor.stage.focusObject(id);
        } else {
            this.editor.stage.selectedObject = null;
            if (this.editor.inspector) {
                const activeStage = this.editor.getActiveStage();
                this.editor.inspector.update(activeStage || this.editor.project);
            }
        }
        this.editor.render();
    }

    public findObjectById(id: string): any | null {
        // 1. ARCHITEKTUR: ObjectStore ist die Single Source of Truth
        //    Enthält die tatsächlich gerenderten Objekte (inkl. Children).
        const storeHasObjects = this.editor.objectStore?.count > 0;
        const searchList = storeHasObjects
            ? this.editor.objectStore.getAll()
            : (this.editor as any).getResolvedInheritanceObjects();

        for (const obj of searchList) {
            if (obj.id === id) return obj;
            if (obj.children && Array.isArray(obj.children)) {
                for (const child of obj.children) {
                    if (child.id === id) return child;
                }
            }
        }

        // 2. Fallback: Flow Nodes/Connections (nicht im ObjectStore)
        if (this.editor.flowEditor) {
            if (this.editor.flowEditor.nodes) {
                const flowNode = this.editor.flowEditor.nodes.find((n: any) => n.id === id);
                if (flowNode) return flowNode;
            }
            if (this.editor.flowEditor.connections) {
                const flowConn = this.editor.flowEditor.connections.find((c: any) => c.id === id);
                if (flowConn) return flowConn;
            }
        }

        // 3. Fallback: Global Variables (aus Projekt-JSON)
        if (this.editor.project && this.editor.project.variables) {
            const globalVar = this.editor.project.variables.find((v: any) => (v.id === id || v.name === id));
            if (globalVar) return globalVar;
        }

        return null;
    }

    public findParentContainer(childId: string): any | null {
        const searchList = this.editor.objectStore?.count > 0
            ? this.editor.objectStore.getAll()
            : this.editor.currentObjects;
        for (const obj of searchList) {
            if (obj.children && Array.isArray(obj.children)) {
                for (const child of obj.children) {
                    if (child.id === childId) return obj;
                }
            }
        }
        return null;
    }
}

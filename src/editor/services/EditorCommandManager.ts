import { Editor } from '../Editor';
import { TWindow } from '../../components/TWindow';
import { componentRegistry } from '../../services/ComponentRegistry';
import { changeRecorder } from '../../services/ChangeRecorder';

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

    public removeObject(id: string) {
        const obj = this.editor.findObjectById(id);
        if (obj && !changeRecorder.isApplyingAction) {
            changeRecorder.record({
                type: 'delete',
                description: `${obj.name} gelöscht`,
                objectId: id,
                objectData: JSON.parse(JSON.stringify(obj))
            });
        }

        this.editor.currentObjects = this.editor.currentObjects.filter(o => o.id !== id);
        this.editor.selectObject(null);
        this.editor.render();
        this.editor.autoSaveToLocalStorage();
    }

    public removeObjectSilent(id: string) {
        const activeStage = this.editor.getActiveStage();
        if (activeStage) {
            const objIdx = (activeStage.objects || []).findIndex(o => o.id === id);
            if (objIdx !== -1) {
                activeStage.objects!.splice(objIdx, 1);
                return;
            }

            const varIdx = (activeStage.variables || []).findIndex(v => (v as any).id === id);
            if (varIdx !== -1) {
                activeStage.variables!.splice(varIdx, 1);
                return;
            }
        }

        // Global Fallback
        const objIdx = this.editor.project.objects.findIndex(o => o.id === id);
        if (objIdx !== -1) {
            this.editor.project.objects.splice(objIdx, 1);
            return;
        }

        const varIdx = this.editor.project.variables.findIndex(v => (v as any).id === id);
        if (varIdx !== -1) {
            this.editor.project.variables.splice(varIdx, 1);
            return;
        }
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
            if (this.editor.inspector) this.editor.inspector.update(this.editor.project);
        }
        this.editor.render();
    }

    public findObjectById(id: string): any | null {
        // 1. Search in Stage Objects
        const objects = (this.editor as any).getResolvedInheritanceObjects();
        for (const obj of objects) {
            if (obj.id === id) return obj;
            if (obj.children && Array.isArray(obj.children)) {
                for (const child of obj.children) {
                    if (child.id === id) return child;
                }
            }
        }

        // 2. Search in Flow Nodes
        if (this.editor.flowEditor && this.editor.flowEditor.nodes) {
            const flowNode = this.editor.flowEditor.nodes.find((n: any) => n.id === id);
            if (flowNode) return flowNode;
        }

        return null;
    }

    public findParentContainer(childId: string): any | null {
        for (const obj of this.editor.currentObjects) {
            if (obj.children && Array.isArray(obj.children)) {
                for (const child of obj.children) {
                    if (child.id === childId) return obj;
                }
            }
        }
        return null;
    }
}

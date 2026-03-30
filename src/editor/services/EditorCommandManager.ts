import { Editor } from '../Editor';
import { TWindow } from '../../components/TWindow';
import { componentRegistry } from '../../services/ComponentRegistry';
import { changeRecorder } from '../../services/ChangeRecorder';
import { RefactoringManager } from '../RefactoringManager';
import { mediatorService } from '../../services/MediatorService';
import { projectRegistry } from '../../services/ProjectRegistry';

export class EditorCommandManager {
    private editor: Editor;
    public isRefactoring: boolean = false;

    constructor(editor: Editor) {
        this.editor = editor;
    }

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
        } else if (type === 'Image') {
            instance.width = 6;
            instance.height = 6;
        } else if (type === 'DataList') {
            instance.width = 16;
            instance.height = 12;
        }

        // Globaler Fallback für Komponenten ohne explizite Größenangaben
        if (!instance.width) instance.width = 5;
        if (!instance.height) instance.height = 2;

        return instance;
    }

    public addObject(type: string, x: number, y: number) {
        const name = `${type}_${this.editor.currentObjects.length + 1}`;
        const newObj = this.createObjectInstance(type, name, x, y);
        if (!newObj) return;

        // Scoping Rules
        const activeStage = this.editor.getActiveStage();
        newObj.scope = (activeStage && activeStage.type === 'main') ? 'global' : 'stage';
        // className: Instanz hat bereits den korrekten className aus dem Konstruktor
        // (z.B. 'TThresholdVariable'). Nur setzen wenn die Instanz keinen hat.
        if (!(newObj as any).className) {
            (newObj as any).className = `T${type}`;
        }
        newObj.x = Math.max(0, x);
        newObj.y = Math.max(0, y);

        // Child handling (Dialogs/Splash)
        const dialogContainers = this.editor.currentObjects.filter(o => {
            const cn = (o as any).className || o.constructor?.name;
            return cn === 'TDialogRoot' || cn === 'TSplashScreen';
        }) as any[];

        // Spezifische Logik für TDataList (Phase 22): 
        // Generiere beim Erstellen sofort ein inneres Row-Panel als Template-Container
        if (type === 'DataList') {
            const rowPanel = this.createObjectInstance('Panel', `${name}_RowTemplate`, 0, 0);
            if (rowPanel) {
                rowPanel.width = newObj.width;
                rowPanel.height = 3; // Default Row Height (3 Cells = z.B. 60px)
                rowPanel.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                rowPanel.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                rowPanel.style.borderWidth = 1;
                (rowPanel as any).className = 'TPanel';
                (rowPanel as any).scope = newObj.scope;

                // Wir betten es direkt als Child in die DataList ein
                if (!newObj.children) newObj.children = [];
                newObj.children.push(rowPanel);

                // WICHTIG: Child-Element auch dem Editor bekannt machen
                this.editor.currentObjects.push(rowPanel);
            }
        }

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
                if (obj.className === 'TAction' || obj.type === 'action' || obj.type === 'data_action' || (obj as any).type === 'action') {
                    RefactoringManager.deleteAction(this.editor.project, obj.name);
                } else if (obj.className === 'TTask' || obj.type === 'task' || (obj as any).type === 'task') {
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

        // 2. Search in ALL stages (Active Stage first for performance)
        const activeStageId = this.editor.project.activeStageId;
        const stages = this.editor.project.stages || [];

        // Sort stages so activeStage is checked first
        const sortedStages = [...stages].sort((a, b) => {
            if (a.id === activeStageId) return -1;
            if (b.id === activeStageId) return 1;
            return 0;
        });

        for (const stage of sortedStages) {
            const objIdx = (stage.objects || []).findIndex(o => o.id === id);
            if (objIdx !== -1) {
                stage.objects!.splice(objIdx, 1);
                console.log(`[CommandManager] Removed from stage ${stage.name} (${stage.id}) objects`);
                return;
            }

            const varIdx = (stage.variables || []).findIndex(v => (v as any).id === id);
            if (varIdx !== -1) {
                stage.variables!.splice(varIdx, 1);
                console.log(`[CommandManager] Removed from stage ${stage.name} variables`);
                return;
            }

            const taskIdx = (stage.tasks || []).findIndex(t => (t as any).id === id || t.name === id);
            if (taskIdx !== -1) {
                stage.tasks!.splice(taskIdx, 1);
                console.log(`[CommandManager] Removed from stage ${stage.name} tasks`);
                return;
            }

            const actionIdx = (stage.actions || []).findIndex(a => (a as any).id === id || a.name === id);
            if (actionIdx !== -1) {
                stage.actions!.splice(actionIdx, 1);
                console.log(`[CommandManager] Removed from stage ${stage.name} actions`);
                return;
            }
        }

        // 3. Global Legacy Fallback (Root project level)
        const objIdx = this.editor.project.objects.findIndex(o => o.id === id);
        if (objIdx !== -1) {
            this.editor.project.objects.splice(objIdx, 1);
            console.log(`[CommandManager] Removed from global root objects`);
            return;
        }

        const varIdx = this.editor.project.variables.findIndex(v => (v as any).id === id);
        if (varIdx !== -1) {
            this.editor.project.variables.splice(varIdx, 1);
            console.log(`[CommandManager] Removed from global root variables`);
            return;
        }

        const taskIdx = this.editor.project.tasks.findIndex(t => (t as any).id === id || t.name === id);
        if (taskIdx !== -1) {
            this.editor.project.tasks.splice(taskIdx, 1);
            console.log(`[CommandManager] Removed from global root tasks`);
            return;
        }

        const actionIdx = this.editor.project.actions.findIndex(a => (a as any).id === id || a.name === id);
        if (actionIdx !== -1) {
            this.editor.project.actions.splice(actionIdx, 1);
            console.log(`[CommandManager] Removed from global root actions`);
            return;
        }
    }

    public renameObject(id: string, newName: string, forcedOldName?: string) {
        const obj = this.findObjectById(id);
        if (!obj) return;

        const oldName = forcedOldName || obj.name;
        if (oldName === newName) return;

        const type = (obj.getType?.() || obj.type || '').toLowerCase();
        const isTask = obj.className === 'TTask' || type === 'task';
        const isAction = obj.className === 'TAction' || type === 'action' || type === 'data_action' || type === 'httpaction';

        // 0. Name Uniqueness Validation (Verhindert Shadowing/Konflikte)
        if (isTask) {
            // Regex-Format Validierung (nur PascalCase-Check)
            if (!/^[A-Z][a-zA-Z0-9]*$/.test(newName)) {
                alert(`Umbenennung blockiert:\nTasks müssen mit einem Großbuchstaben beginnen (PascalCase).`);
                return;
            }

            // Two-Way-Binding Safe-Check (Löst fehlende UUIDs von Task-JSON-Payloads):
            // Da das Frontend den Task im Model via Binding ggf. bereits umbenannt hat,
            // dürfen wir einfach prüfen, ob es den NEUEN Namen > 1 Mal im gesamten Projekt gibt.
            // Wenn ja -> Echter Konflikt (ein zweiter, älterer Task blockiert den Namen).
            // Wenn nein (0 oder 1) -> Umbenennung okay! (0 = reines API Update, 1 = Binding hat unser Target bereits aktualisiert).
            let nameCount = 0;
            const countList = (taskList: any[]) => {
                if (!taskList) return;
                nameCount += taskList.filter(t => t.name === newName).length;
            };
            
            countList(this.editor.project.tasks || []);
            this.editor.project.stages?.forEach(stage => countList(stage.tasks || []));

            if (nameCount > 1) {
                alert(`Umbenennung blockiert:\nEin Task mit dem Namen '${newName}' existiert bereits im Projekt.`);
                return;
            }
        } else if (isAction) {
            // Action validity check (Global scope check)
            // Fix: Ausschluss der eigenen Action-ID, damit 2-Way-Binding nicht "Existiert bereits" wirft
            const exists = projectRegistry.getActions('all', false).some(a => a.name === newName && (a as any).id !== obj.id && (a as any).actionName !== obj.id);
            if (exists) {
                alert(`Umbenennung blockiert:\nEine Aktion mit dem Namen "${newName}" existiert bereits im Projekt.`);
                return;
            }
        }

        // CRITICAL: Set refactoring flag to suppress intermediate syncs
        this.isRefactoring = true;

        try {
            // 1. Notify FlowEditor BEFORE refactoring. 
            if (this.editor.flowEditor) {
                const type = (obj.getType?.() || obj.type || '').toLowerCase();
                const isTask = obj.className === 'TTask' || type === 'task';
                // renameContext NUR für Tasks — es ändert den Flow-Kontext (Task-Name).
                // Für Actions darf es NICHT aufgerufen werden, sonst wird der Task mit umbenannt.
                if (isTask) {
                    this.editor.flowEditor.renameContext(oldName, newName);
                }
            }

            // 2. Perform global refactoring
            const type = (obj.getType?.() || obj.type || '').toLowerCase();
            if (obj.className === 'TVariable' || obj.isVariable || type === 'variable') {
                RefactoringManager.renameVariable(this.editor.project, oldName, newName);
            } else if (obj.className === 'TTask' || type === 'task') {
                RefactoringManager.renameTask(this.editor.project, oldName, newName);
            } else if (obj.className === 'TAction' || type === 'action') {
                RefactoringManager.renameAction(this.editor.project, oldName, newName);
            } else {
                RefactoringManager.renameObject(this.editor.project, oldName, newName);
            }

            // 3. Ensure the object instance itself carries the new name
            if ((obj as any).Name !== undefined) {
                (obj as any).Name = newName;
            } else if (obj.name !== newName) {
                obj.name = newName;
            }

            // 4. Update UI & Notify (Manager-Liste, Dropdown, etc.)
            // Trigger View-Updates (Flow-Dropdown, Stage, Inspector)
            // WICHTIG: 'inspector' Originator verwenden, damit der FlowEditor
            // NICHT per setProject() komplett neu geladen wird.
            // Der Flow-Canvas wurde bereits durch renameContext() korrekt aktualisiert.
            this.editor.renderManager.refreshAllViews('inspector');

            // Trigger Management-View Refresh (Manager-Liste) via Mediator
            mediatorService.notifyDataChanged(this.editor.project, 'editor');

            this.editor.autoSaveToLocalStorage();

            console.log(`[CommandManager] UI-UPDATE ERFOLGREICH: Alle Listen (Dropdown & Manager) wurden synchronisiert.`);
        } finally {
            // CRITICAL: Always release the lock
            this.isRefactoring = false;
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
            if (this.editor.inspector) {
                const isOverviewContext = this.editor.flowEditor && this.editor.flowEditor.currentFlowContext === 'element-overview';
                if (isOverviewContext) {
                    this.editor.inspector.update(null);
                } else {
                    const activeStage = this.editor.getActiveStage();
                    this.editor.inspector.update(activeStage || this.editor.project);
                }
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
            // WICHTIG: Objekte im ObjectStore sind Preview-Kopien (mit aufgelösten Bindings).
            // Für den Inspector muss das ORIGINAL-Objekt (__rawSource) zurückgegeben werden,
            // damit Binding-Werte (z.B. "${currentUser.name}") erhalten bleiben.
            if (obj.id === id || obj.name === id) return obj.__rawSource || obj;
            if (obj.children && Array.isArray(obj.children)) {
                for (const child of obj.children) {
                    if (child.id === id || child.name === id) return child.__rawSource || child;
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

        // 4. Fallback: Tasks und Actions (Identifiziert über Namen)
        if (this.editor.project) {
            const allTasks = [...(this.editor.project.tasks || [])];
            const allActions = [...(this.editor.project.actions || [])];

            if (this.editor.project.stages) {
                this.editor.project.stages.forEach(s => {
                    if (s.tasks) allTasks.push(...s.tasks);
                    if (s.actions) allActions.push(...s.actions);
                });
            }

            const taskObj = allTasks.find(t => (t as any).id === id || t.name === id);
            if (taskObj) {
                if (!(taskObj as any).getType) (taskObj as any).getType = () => 'task';
                return taskObj;
            }

            const actionObj = allActions.find(a => (a as any).id === id || a.name === id);
            if (actionObj) {
                if (!(actionObj as any).getType) (actionObj as any).getType = () => 'action';
                return actionObj;
            }
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

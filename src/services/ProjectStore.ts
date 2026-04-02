import { GameProject } from '../model/types';
import { snapshotManager } from '../editor/services/SnapshotManager';
import { Logger } from '../utils/Logger';
import { PropertyHelper } from '../runtime/PropertyHelper';
import { mediatorService } from './MediatorService';

// ─────────────────────────────────────────────
// Mutation-Typen
// ─────────────────────────────────────────────

export type ProjectMutation =
    | { type: 'SET_PROPERTY'; target: any; path: string; value: any }
    | { type: 'RENAME_ACTION'; oldName: string; newName: string }
    | { type: 'RENAME_TASK'; oldName: string; newName: string }
    | { type: 'ADD_ACTION'; action: any; stageId?: string }
    | { type: 'REMOVE_ACTION'; name: string; stageId?: string }
    | { type: 'ADD_TASK'; task: any; stageId?: string }
    | { type: 'REMOVE_TASK'; name: string; stageId?: string }
    | { type: 'ADD_OBJECT'; object: any; stageId: string }
    | { type: 'REMOVE_OBJECT'; objectId: string; stageId: string }
    | { type: 'REPARENT_OBJECT'; objectId: string; targetParentId: string | null; stageId: string }
    | { type: 'SET_STAGE'; stageId: string }
    | { type: 'BATCH'; mutations: ProjectMutation[]; label: string };

export type ChangeListener = (mutation: ProjectMutation, project: GameProject) => void;

// ─────────────────────────────────────────────
// ProjectStore — Zentraler State-Manager
// ─────────────────────────────────────────────

/**
 * ProjectStore — Zentrale Fassade für das Projekt-Datenmodell.
 * 
 * Alle Datenänderungen laufen über `dispatch()`:
 * 1. Snapshot VOR der Mutation (Undo-Support)
 * 2. Mutation auf dem project-Objekt anwenden
 * 3. Listener benachrichtigen (Views re-rendern)
 * 
 * Architektur:
 * ```
 * View → dispatch(mutation) → reduce() → project (SSoT) → onChange → Views
 * ```
 * 
 * @since v3.15.0
 */
export class ProjectStore {
    private static logger = Logger.get('ProjectStore', 'Project_Store');
    private static instance: ProjectStore;

    private project: GameProject | null = null;
    private listeners: ChangeListener[] = [];
    private isDispatching: boolean = false;

    private constructor() { }

    public static getInstance(): ProjectStore {
        if (!ProjectStore.instance) {
            ProjectStore.instance = new ProjectStore();
        }
        return ProjectStore.instance;
    }

    // =========================================================================
    // Project-Verwaltung
    // =========================================================================

    /**
     * Setzt das aktive Projekt. Leert den SnapshotManager-Stack.
     */
    public setProject(project: GameProject): void {
        this.project = project;
        snapshotManager.clear();
        ProjectStore.logger.info(`Projekt geladen: "${(project as any).name || 'Unbenannt'}"`);
    }

    /**
     * ReadOnly-Zugriff auf das Projekt.
     * Views lesen hierüber, mutieren aber NIE direkt.
     */
    public getProject(): GameProject | null {
        return this.project;
    }

    // =========================================================================
    // Listener (onChange)
    // =========================================================================

    /**
     * Registriert einen Change-Listener.
     * Wird nach jeder erfolgreichen Mutation aufgerufen.
     */
    public onChange(listener: ChangeListener): () => void {
        this.listeners.push(listener);
        // Gibt eine Unsubscribe-Funktion zurück
        return () => {
            const idx = this.listeners.indexOf(listener);
            if (idx !== -1) this.listeners.splice(idx, 1);
        };
    }

    /**
     * Benachrichtigt alle Listener über eine Mutation.
     */
    private notifyListeners(mutation: ProjectMutation): void {
        if (!this.project) return;
        this.listeners.forEach(listener => {
            try {
                listener(mutation, this.project!);
            } catch (e: any) {
                ProjectStore.logger.error(`Listener-Fehler: ${e.message}`);
            }
        });

        // --- BRIDGE ZUM ALTEN MEDIATOR-SYSTEM (PHASE 1) ---
        // Übergangsweise triggern wir die ollen Listener via Mediator.
        // Sobald alle Views auf projectStore.onChange umgebaut sind, kann dies raus.
        if (mutation.type === 'SET_PROPERTY') {
            mediatorService.notifyDataChanged({
                property: mutation.path,
                value: mutation.value,
                object: mutation.target
            }, 'store-dispatch');
        } else {
            mediatorService.notifyDataChanged(this.project, 'store-dispatch');
        }
    }

    // =========================================================================
    // Dispatch (Zentraler Mutations-Eingang)
    // =========================================================================

    /**
     * Führt eine Mutation auf dem Projekt durch.
     * 
     * 1. Snapshot nehmen (Undo)
     * 2. Mutation anwenden (reduce)
     * 3. Listener benachrichtigen (Views)
     * 
     * @returns true wenn die Mutation erfolgreich war
     */
    public dispatch(mutation: ProjectMutation): boolean {
        console.log(`[DND-FLOW 5.5] Enter dispatch: project exists=${!!this.project}, isDispatching=${this.isDispatching}`);
        if (!this.project) {
            ProjectStore.logger.warn('dispatch(): Kein Projekt geladen.');
            return false;
        }

        // Guard: Keine verschachtelten dispatches
        if (this.isDispatching) {
            ProjectStore.logger.warn(`dispatch(): Verschachtelter dispatch blockiert (${mutation.type}).`);
            return false;
        }

        this.isDispatching = true;

        try {
            // 1. Snapshot VOR der Mutation
            const label = this.getMutationLabel(mutation);
            snapshotManager.pushSnapshot(this.project, label);

            // 2. Mutation anwenden
            const success = this.reduce(mutation);

            if (success) {
                ProjectStore.logger.info(`✅ dispatch: ${label}`);
                // 3. Listener benachrichtigen
                this.notifyListeners(mutation);
            } else {
                ProjectStore.logger.warn(`⚠️ dispatch fehlgeschlagen: ${label}`);
            }

            return success;
        } finally {
            this.isDispatching = false;
        }
    }

    // =========================================================================
    // Reducer (Mutations-Logik)
    // =========================================================================

    /**
     * Wendet eine Mutation auf das Projekt an.
     * Pure Logik, keine Seiteneffekte.
     */
    private reduce(mutation: ProjectMutation): boolean {
        switch (mutation.type) {
            case 'SET_PROPERTY':
                return this.reduceSetProperty(mutation);

            case 'RENAME_ACTION':
                return this.reduceRenameAction(mutation);

            case 'RENAME_TASK':
                return this.reduceRenameTask(mutation);

            case 'ADD_ACTION':
                return this.reduceAddAction(mutation);

            case 'REMOVE_ACTION':
                return this.reduceRemoveAction(mutation);

            case 'ADD_TASK':
                return this.reduceAddTask(mutation);

            case 'REMOVE_TASK':
                return this.reduceRemoveTask(mutation);

            case 'ADD_OBJECT':
                return this.reduceAddObject(mutation);

            case 'REMOVE_OBJECT':
                return this.reduceRemoveObject(mutation);

            case 'REPARENT_OBJECT':
                return this.reduceReparentObject(mutation);

            case 'SET_STAGE':
                return this.reduceSetStage(mutation);

            case 'BATCH': {
                let allSuccess = true;
                for (const sub of mutation.mutations) {
                    if (!this.reduce(sub)) allSuccess = false;
                }
                return allSuccess;
            }

            default:
                ProjectStore.logger.warn(`Unbekannter Mutations-Typ: ${(mutation as any).type}`);
                return false;
        }
    }

    // ─────────────────────────────────────────────
    // Individuelle Reducer
    // ─────────────────────────────────────────────

    private reduceSetProperty(m: { target: any; path: string; value: any }): boolean {
        console.log(`[DND-FLOW 6] REDUCE SET_PROPERTY on ${m.target?.id}: ${m.path} = ${m.value}`);
        if (!m.target) return false;
        PropertyHelper.setPropertyValue(m.target, m.path, m.value);
        return true;
    }

    private reduceRenameAction(m: { oldName: string; newName: string }): boolean {
        if (!this.project) return false;

        const renameIn = (actions: any[]) => {
            const action = actions.find((a: any) => a.name === m.oldName);
            if (action) action.name = m.newName;
        };

        // Global
        if (this.project.actions) renameIn(this.project.actions);

        // Alle Stages
        this.project.stages?.forEach(stage => {
            if (stage.actions) renameIn(stage.actions);
        });

        // ActionSequence-Referenzen aktualisieren
        this.updateActionReferences(m.oldName, m.newName);

        return true;
    }

    private reduceRenameTask(m: { oldName: string; newName: string }): boolean {
        if (!this.project) return false;

        const renameIn = (tasks: any[]) => {
            const task = tasks.find((t: any) => t.name === m.oldName);
            if (task) task.name = m.newName;
        };

        // Global
        if (this.project.tasks) renameIn(this.project.tasks);

        // Alle Stages
        this.project.stages?.forEach(stage => {
            if (stage.tasks) renameIn(stage.tasks);
        });

        // FlowChart-Task-Referenzen
        this.updateTaskReferences(m.oldName, m.newName);

        return true;
    }

    private reduceAddAction(m: { action: any; stageId?: string }): boolean {
        if (!this.project) return false;

        if (m.stageId) {
            const stage = this.project.stages?.find(s => s.id === m.stageId);
            if (stage) {
                if (!stage.actions) stage.actions = [];
                stage.actions.push(m.action);
                return true;
            }
        }

        // Global
        if (!this.project.actions) this.project.actions = [];
        this.project.actions.push(m.action);
        return true;
    }

    private reduceRemoveAction(m: { name: string; stageId?: string }): boolean {
        if (!this.project) return false;

        if (m.stageId) {
            const stage = this.project.stages?.find(s => s.id === m.stageId);
            if (stage?.actions) {
                const idx = stage.actions.findIndex((a: any) => a.name === m.name);
                if (idx !== -1) { stage.actions.splice(idx, 1); return true; }
            }
        }

        if (this.project.actions) {
            const idx = this.project.actions.findIndex((a: any) => a.name === m.name);
            if (idx !== -1) { this.project.actions.splice(idx, 1); return true; }
        }

        return false;
    }

    private reduceAddTask(m: { task: any; stageId?: string }): boolean {
        if (!this.project) return false;

        if (m.stageId) {
            const stage = this.project.stages?.find(s => s.id === m.stageId);
            if (stage) {
                if (!stage.tasks) stage.tasks = [];
                stage.tasks.push(m.task);
                return true;
            }
        }

        if (!this.project.tasks) this.project.tasks = [];
        this.project.tasks.push(m.task);
        return true;
    }

    private reduceRemoveTask(m: { name: string; stageId?: string }): boolean {
        if (!this.project) return false;

        if (m.stageId) {
            const stage = this.project.stages?.find(s => s.id === m.stageId);
            if (stage?.tasks) {
                const idx = stage.tasks.findIndex((t: any) => t.name === m.name);
                if (idx !== -1) { stage.tasks.splice(idx, 1); return true; }
            }
        }

        if (this.project.tasks) {
            const idx = this.project.tasks.findIndex((t: any) => t.name === m.name);
            if (idx !== -1) { this.project.tasks.splice(idx, 1); return true; }
        }

        return false;
    }

    private reduceAddObject(m: { object: any; stageId: string }): boolean {
        if (!this.project) return false;
        const stage = this.project.stages?.find(s => s.id === m.stageId);
        if (!stage) return false;
        if (!stage.objects) stage.objects = [];
        stage.objects.push(m.object);
        return true;
    }

    private reduceRemoveObject(m: { objectId: string; stageId: string }): boolean {
        if (!this.project) return false;
        const stage = this.project.stages?.find(s => s.id === m.stageId);
        if (!stage?.objects) return false;
        const idx = stage.objects.findIndex((o: any) => o.id === m.objectId);
        if (idx !== -1) { stage.objects.splice(idx, 1); return true; }

        // Hilfsfunktion für tiefes Löschen
        let removed = false;
        const removeDeep = (arr: any[]) => {
            const index = arr.findIndex(o => o.id === m.objectId);
            if (index !== -1) {
                arr.splice(index, 1);
                removed = true;
                return;
            }
            for (const child of arr) {
                if (child.children) removeDeep(child.children);
                if (removed) return;
            }
        };
        removeDeep(stage.objects);
        return removed;
    }

    private reduceReparentObject(m: { objectId: string; targetParentId: string | null; stageId: string }): boolean {
        console.log('[ProjectStore] reduceReparentObject START:', m);
        if (!this.project) { console.log('[ProjectStore] Kein Projekt'); return false; }
        const stage = this.project.stages?.find(s => s.id === m.stageId);
        if (!stage || !stage.objects) { console.log('[ProjectStore] Keine Stage/Objects gefunden'); return false; }

        let foundObj: any = null;
        let sourceArray: any = null;
        let sourceIndex: number = -1;

        // Hilfsfunktion: Finde Objekt und sein Eltern-Array
        const findInArray = (arr: any[]) => {
            const idx = arr.findIndex(o => o.id === m.objectId);
            if (idx !== -1) {
                foundObj = arr[idx];
                sourceArray = arr;
                sourceIndex = idx;
                return true;
            }
            for (const child of arr) {
                if (child.children && findInArray(child.children)) return true;
            }
            return false;
        };

        if (!findInArray(stage.objects) || !sourceArray) return false;

        // Verhindern, dass ein Panel in sich selbst oder seine Kinder gedroppt wird
        if (m.targetParentId) {
            let invalidDest = false;
            const checkNesting = (targetId: string, searchRoot: any) => {
                if (searchRoot.id === targetId) invalidDest = true;
                if (searchRoot.children) searchRoot.children.forEach((c: any) => checkNesting(targetId, c));
            };
            checkNesting(m.targetParentId, foundObj);
            if (invalidDest) {
                ProjectStore.logger.warn('reduceReparentObject: Ungültiges Drop-Ziel (Zirkulär)');
                return false;
            }
        }

        // Finde Ziel-Array
        let targetArray: any[] | null = stage.objects;
        if (m.targetParentId) {
            let targetGroup: any = null;
            const findGroup = (arr: any[]) => {
                let g = arr.find(o => o.id === m.targetParentId);
                if (g) return g;
                for (const child of arr) {
                    if (child.children) {
                        g = findGroup(child.children);
                        if (g) return g;
                    }
                }
                return null;
            };
            targetGroup = findGroup(stage.objects);
            if (!targetGroup) return false;
            if (!targetGroup.children) targetGroup.children = [];
            targetArray = targetGroup.children;
        }

        // Gleiches Array? Nichts zu tun was Reparenting angeht
        if (sourceArray === targetArray) {
            return true;
        }

        // Objekt aus Quell-Array entfernen
        if (sourceArray) sourceArray.splice(sourceIndex, 1);
        
        // ParentId tracken
        if (m.targetParentId) {
            foundObj.parentId = m.targetParentId;
        } else {
            delete foundObj.parentId;
        }

        // In Ziel-Array einfügen
        if (targetArray) {
            targetArray.push(foundObj);
            console.log('[ProjectStore] Objekt erfolgreich zu targetArray hinzugefügt. Array Size:', targetArray.length);
        }

        console.log('[ProjectStore] reduceReparentObject DONE');
        return true;
    }

    private reduceSetStage(m: { stageId: string }): boolean {
        if (!this.project) return false;
        (this.project as any).activeStageId = m.stageId;
        return true;
    }

    // ─────────────────────────────────────────────
    // Referenz-Aktualisierung
    // ─────────────────────────────────────────────

    private updateActionReferences(oldName: string, newName: string): void {
        if (!this.project) return;

        const updateSeq = (seq: any[]) => {
            if (!seq || !Array.isArray(seq)) return;
            seq.forEach(item => {
                if (item.type === 'action' && item.name === oldName) item.name = newName;
                if (item.thenAction === oldName) item.thenAction = newName;
                if (item.elseAction === oldName) item.elseAction = newName;
                if (item.body) updateSeq(item.body);
            });
        };

        // Alle Tasks durchgehen
        const allTasks = [...(this.project.tasks || [])];
        this.project.stages?.forEach(s => {
            if (s.tasks) allTasks.push(...s.tasks);
        });
        allTasks.forEach(t => updateSeq(t.actionSequence));
    }

    private updateTaskReferences(oldName: string, newName: string): void {
        if (!this.project) return;

        const updateSeq = (seq: any[]) => {
            if (!seq || !Array.isArray(seq)) return;
            seq.forEach(item => {
                if (item.type === 'task' && item.name === oldName) item.name = newName;
                if (item.thenTask === oldName) item.thenTask = newName;
                if (item.elseTask === oldName) item.elseTask = newName;
                if (item.resultTask === oldName) item.resultTask = newName;
                if (item.body) updateSeq(item.body);
            });
        };

        // Alle Tasks durchgehen
        const allTasks = [...(this.project.tasks || [])];
        this.project.stages?.forEach(s => {
            if (s.tasks) allTasks.push(...s.tasks);
        });
        allTasks.forEach(t => updateSeq(t.actionSequence));

        // Event-Bindings auf Objekten aktualisieren
        const updateEvents = (objects: any[]) => {
            if (!objects) return;
            objects.forEach(obj => {
                if (obj.events) {
                    Object.keys(obj.events).forEach(key => {
                        if (obj.events[key] === oldName) obj.events[key] = newName;
                    });
                }
            });
        };

        updateEvents(this.project.objects || []);
        this.project.stages?.forEach(s => updateEvents(s.objects || []));
    }

    // ─────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────

    private getMutationLabel(m: ProjectMutation): string {
        switch (m.type) {
            case 'SET_PROPERTY': return `${m.path} = ${String(m.value).substring(0, 50)}`;
            case 'RENAME_ACTION': return `Action: ${m.oldName} → ${m.newName}`;
            case 'RENAME_TASK': return `Task: ${m.oldName} → ${m.newName}`;
            case 'ADD_ACTION': return `+ Action: ${m.action?.name}`;
            case 'REMOVE_ACTION': return `- Action: ${m.name}`;
            case 'ADD_TASK': return `+ Task: ${m.task?.name}`;
            case 'REMOVE_TASK': return `- Task: ${m.name}`;
            case 'ADD_OBJECT': return `+ Object in ${m.stageId}`;
            case 'REMOVE_OBJECT': return `- Object ${m.objectId}`;
            case 'REPARENT_OBJECT': return `↻ Reparent ${m.objectId} -> ${m.targetParentId || 'Stage'}`;
            case 'SET_STAGE': return `Stage → ${m.stageId}`;
            case 'BATCH': return m.label;
            default: return 'Unbekannt';
        }
    }

    /**
     * Gibt den aktuellen Status zurück (Debugging).
     */
    public getStatus(): { hasProject: boolean; listenerCount: number; isDispatching: boolean } {
        return {
            hasProject: this.project !== null,
            listenerCount: this.listeners.length,
            isDispatching: this.isDispatching
        };
    }
}

/** Globale Singleton-Instanz */
export const projectStore = ProjectStore.getInstance();

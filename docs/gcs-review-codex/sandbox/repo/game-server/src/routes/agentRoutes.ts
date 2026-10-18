import express from 'express';
import fs from 'fs';
import path from 'path';
import { PUBLIC_DIR } from '../serverState';

export const AGENT_METHODS: Record<string, boolean> = {
    // Projekt-Struktur
    createStage: true, addObject: true, addVariable: true,
    // Task-Management
    createTask: true, addTaskCall: true, setTaskTriggerMode: true,
    addTaskParam: true, moveActionInSequence: true,
    // Action-Management
    addAction: true, deleteAction: true,
    // Branch-Management
    addBranch: true,
    // Delete
    deleteTask: true, removeObject: true, deleteStage: true, deleteVariable: true,
    // Rename
    renameTask: true, renameAction: true,
    // Read (Inventar)
    listStages: true, listTasks: true, listActions: true, listVariables: true,
    listObjects: true, getTaskDetails: true,
    // UI
    setProperty: true, bindVariable: true, connectEvent: true,
    // Workflow
    duplicateTask: true, generateTaskFlow: true,
    // Validation
    validate: true,
};

/**
 * Erstellt einen serverseitigen "Mini-AgentController" der direkt auf dem JSON operiert.
 * Implementiert die wichtigsten Methoden für den REST-Zugang.
 */
export function createServerSideAgentController(project: any) {
    // Hilfsfunktionen
    const findStage = (id: string) => project.stages?.find((s: any) => s.id === id || s.name === id);
    const findTask = (name: string): any => {
        const inRoot = project.tasks?.find((t: any) => t.name === name);
        if (inRoot) return inRoot;
        for (const s of (project.stages || [])) {
            const t = s.tasks?.find((t: any) => t.name === name);
            if (t) return t;
        }
        return undefined;
    };
    const findAction = (name: string): any => {
        const inRoot = project.actions?.find((a: any) => a.name === name);
        if (inRoot) return inRoot;
        for (const s of (project.stages || [])) {
            const a = s.actions?.find((a: any) => a.name === name);
            if (a) return a;
        }
        return undefined;
    };
    const blueprintStage = () => project.stages?.find((s: any) => s.type === 'blueprint');

    return {
        // === Projekt-Struktur ===
        createStage(id: string, name: string, type: string = 'standard') {
            if (!project.stages) project.stages = [];
            if (project.stages.find((s: any) => s.id === id)) return;
            project.stages.push({ id, name, type, objects: [], tasks: [], actions: [], variables: [], flowCharts: {}, events: {} });
        },
        addObject(stageId: string, objectData: any) {
            const stage = findStage(stageId);
            if (!stage) throw new Error(`Stage '${stageId}' nicht gefunden.`);
            if (!stage.objects) stage.objects = [];
            stage.objects.push(objectData);
        },
        addVariable(name: string, type: string, initialValue: any, scope: string = 'global') {
            if (!project.variables) project.variables = [];
            const existing = project.variables.find((v: any) => v.name === name);
            if (existing) { existing.type = type; existing.initialValue = initialValue; existing.defaultValue = initialValue; }
            else project.variables.push({ name, type, initialValue, defaultValue: initialValue, scope });
        },

        // === Task-Management ===
        createTask(stageId: string, taskName: string, description: string = '') {
            if (findTask(taskName)) return taskName;
            const newTask = { name: taskName, description, actionSequence: [], triggerMode: 'local-sync', params: [] };
            const stage = findStage(stageId || 'stage_blueprint');
            if (stage) { if (!stage.tasks) stage.tasks = []; stage.tasks.push(newTask); }
            else { if (!project.tasks) project.tasks = []; project.tasks.push(newTask); }
            return taskName;
        },
        addTaskCall(taskName: string, calledTaskName: string) {
            const task = findTask(taskName);
            if (!task) throw new Error(`Task '${taskName}' nicht gefunden.`);
            task.actionSequence.push({ type: 'task', name: calledTaskName });
        },
        setTaskTriggerMode(taskName: string, mode: string) {
            const task = findTask(taskName);
            if (!task) throw new Error(`Task '${taskName}' nicht gefunden.`);
            task.triggerMode = mode;
        },
        addTaskParam(taskName: string, paramName: string, type: string = 'string', defaultValue: any = '') {
            const task = findTask(taskName);
            if (!task) throw new Error(`Task '${taskName}' nicht gefunden.`);
            if (!task.params) task.params = [];
            const existing = task.params.find((p: any) => p.name === paramName);
            if (existing) { existing.type = type; existing.defaultValue = defaultValue; }
            else task.params.push({ name: paramName, type, defaultValue });
        },
        moveActionInSequence(taskName: string, fromIndex: number, toIndex: number) {
            const task = findTask(taskName);
            if (!task) throw new Error(`Task '${taskName}' nicht gefunden.`);
            const [item] = task.actionSequence.splice(fromIndex, 1);
            task.actionSequence.splice(toIndex, 0, item);
        },

        // === Action-Management ===
        addAction(taskName: string, actionType: string, actionName: string, params: any = {}) {
            const task = findTask(taskName);
            if (!task) throw new Error(`Task '${taskName}' nicht gefunden.`);
            if (!findAction(actionName)) {
                const bp = blueprintStage();
                const actionDef = { name: actionName, type: actionType, ...params };
                if (bp) { if (!bp.actions) bp.actions = []; bp.actions.push(actionDef); }
                else { if (!project.actions) project.actions = []; project.actions.push(actionDef); }
            }
            task.actionSequence.push({ type: 'action', name: actionName });
        },
        deleteAction(actionName: string) {
            project.stages?.forEach((s: any) => { if (s.actions) s.actions = s.actions.filter((a: any) => a.name !== actionName); });
            if (project.actions) project.actions = project.actions.filter((a: any) => a.name !== actionName);
        },

        // === Delete ===
        deleteTask(taskName: string) {
            project.stages?.forEach((s: any) => { if (s.tasks) s.tasks = s.tasks.filter((t: any) => t.name !== taskName); });
            if (project.tasks) project.tasks = project.tasks.filter((t: any) => t.name !== taskName);
        },
        removeObject(stageId: string, objectName: string) {
            const stage = findStage(stageId);
            if (!stage?.objects) return;
            stage.objects = stage.objects.filter((o: any) => o.name !== objectName);
        },
        deleteStage(stageId: string) {
            const stage = findStage(stageId);
            if (stage?.type === 'blueprint') throw new Error('Blueprint-Stage kann nicht gelöscht werden.');
            project.stages = project.stages?.filter((s: any) => s.id !== stageId) || [];
        },
        deleteVariable(variableName: string) {
            if (project.variables) project.variables = project.variables.filter((v: any) => v.name !== variableName);
        },

        // === Rename ===
        renameTask(oldName: string, newName: string) {
            const task = findTask(oldName);
            if (!task) return false;
            task.name = newName;
            return true;
        },
        renameAction(oldName: string, newName: string) {
            const action = findAction(oldName);
            if (!action) return false;
            action.name = newName;
            return true;
        },

        // === Read ===
        listStages() {
            return (project.stages || []).map((s: any) => ({
                id: s.id, name: s.name, type: s.type || 'standard',
                objectCount: (s.objects || []).length, taskCount: (s.tasks || []).length
            }));
        },
        listTasks(stageId?: string) {
            let tasks: any[] = [];
            if (stageId) { const s = findStage(stageId); tasks = s?.tasks || []; }
            else { tasks = [...(project.tasks || []), ...(project.stages?.flatMap((s: any) => s.tasks || []) || [])]; }
            return tasks.map((t: any) => ({ name: t.name, actionCount: t.actionSequence?.length || 0, triggerMode: t.triggerMode || 'local-sync' }));
        },
        listActions(stageId?: string) {
            let actions: any[] = [];
            if (stageId) { const s = findStage(stageId); actions = s?.actions || []; }
            else { actions = [...(project.actions || []), ...(project.stages?.flatMap((s: any) => s.actions || []) || [])]; }
            return actions.map((a: any) => ({ name: a.name, type: a.type }));
        },
        listVariables() {
            const vars: any[] = [];
            (project.variables || []).forEach((v: any) => vars.push({ name: v.name, type: v.type, value: v.defaultValue ?? v.initialValue, scope: 'global' }));
            project.stages?.forEach((s: any) => { (s.variables || []).forEach((v: any) => vars.push({ name: v.name, type: v.type, value: v.defaultValue ?? v.initialValue, scope: s.id })); });
            return vars;
        },
        listObjects(stageId: string) {
            const s = findStage(stageId);
            return (s?.objects || []).map((o: any) => ({ name: o.name, className: o.className, x: o.x || 0, y: o.y || 0, visible: o.visible !== false }));
        },
        getTaskDetails(taskName: string) {
            const task = findTask(taskName);
            if (!task) return null;
            return { name: task.name, description: task.description || '', sequence: task.actionSequence, triggerMode: task.triggerMode || 'local-sync' };
        },

        // === UI ===
        setProperty(stageId: string, objectName: string, property: string, value: any) {
            const stage = findStage(stageId);
            if (!stage) throw new Error(`Stage '${stageId}' nicht gefunden.`);
            const obj = (stage.objects || []).find((o: any) => o.name === objectName);
            if (!obj) throw new Error(`Object '${objectName}' nicht gefunden.`);
            const parts = property.split('.');
            let target = obj;
            for (let i = 0; i < parts.length - 1; i++) { if (!target[parts[i]]) target[parts[i]] = {}; target = target[parts[i]]; }
            target[parts[parts.length - 1]] = value;
        },
        bindVariable(stageId: string, objectName: string, property: string, expression: string) {
            if (!expression.startsWith('${')) expression = '${' + expression + '}';
            this.setProperty(stageId, objectName, property, expression);
        },
        connectEvent(stageId: string, objectName: string, eventName: string, taskName: string) {
            const stage = findStage(stageId);
            if (!stage) throw new Error(`Stage '${stageId}' nicht gefunden.`);
            const obj = (stage.objects || []).find((o: any) => o.name === objectName);
            if (!obj) throw new Error(`Object '${objectName}' nicht gefunden.`);
            if (!obj.events) obj.events = {};
            obj.events[eventName] = taskName;
        },

        // === Workflow ===
        duplicateTask(taskName: string, newName: string) {
            const original = findTask(taskName);
            if (!original) throw new Error(`Task '${taskName}' nicht gefunden.`);
            const clone = JSON.parse(JSON.stringify(original));
            clone.name = newName;
            if (!project.tasks) project.tasks = [];
            project.tasks.push(clone);
            return newName;
        },
        generateTaskFlow(taskName: string) {
            // Server-seitig nicht implementiert — Flow wird im Editor generiert
            console.log(`[Agent API] generateTaskFlow('${taskName}') — wird Client-seitig generiert.`);
            return null;
        },

        // === Validation ===
        validate() {
            const issues: any[] = [];
            const allActions = [...(project.actions || []), ...(project.stages?.flatMap((s: any) => s.actions || []) || [])];
            const actionNames = new Set(allActions.map((a: any) => a.name));
            const allTasks = [...(project.tasks || []), ...(project.stages?.flatMap((s: any) => s.tasks || []) || [])];
            allTasks.forEach((t: any) => {
                (t.actionSequence || []).forEach((item: any) => {
                    if (item.type === 'action' && item.name && !actionNames.has(item.name)) {
                        issues.push({ level: 'error', message: `Task '${t.name}': Action '${item.name}' referenziert aber nicht definiert.` });
                    }
                });
            });
            return issues;
        }
    };
}

export function registerAgentRoutes(app: express.Application) {
    /**
     * POST /api/agent/:method - Ruft AgentController-Methoden auf.
     */
    app.post('/api/agent/:method', (req, res) => {
        const method = req.params.method;
        const params: any[] = req.body?.params || [];

        // 1. Methode prüfen
        if (!AGENT_METHODS[method]) {
            return res.status(400).json({
                success: false,
                data: null,
                error: `Unbekannte Methode: '${method}'. Erlaubt: ${Object.keys(AGENT_METHODS).join(', ')}`
            });
        }

        // 2. Projekt laden
        const projectPath = path.resolve(PUBLIC_DIR, 'project.json');
        if (!fs.existsSync(projectPath)) {
            return res.status(404).json({
                success: false,
                data: null,
                error: 'project.json nicht gefunden.'
            });
        }

        try {
            const projectData = JSON.parse(fs.readFileSync(projectPath, 'utf-8'));

            // 3. Leichtgewichtigen AgentController simulieren
            const controller = createServerSideAgentController(projectData);

            // 4. Methode aufrufen
            const fn = (controller as any)[method];
            if (typeof fn !== 'function') {
                return res.status(400).json({
                    success: false,
                    data: null,
                    error: `Methode '${method}' nicht implementiert auf dem Server.`
                });
            }

            const result = fn.apply(controller, params);

            // 5. Projekt speichern (nur bei Schreib-Methoden)
            const readOnlyMethods = ['listStages', 'listTasks', 'listActions', 'listVariables', 'listObjects', 'getTaskDetails', 'validate'];
            if (!readOnlyMethods.includes(method)) {
                fs.writeFileSync(projectPath, JSON.stringify(projectData, null, 2));
                console.log(`[Agent API] ${method}(${params.map(p => typeof p === 'string' ? `"${p}"` : JSON.stringify(p)).join(', ')}) → OK. Projekt gespeichert.`);
            } else {
                console.log(`[Agent API] ${method}() → Gelesen.`);
            }

            res.json({ success: true, data: result ?? null, error: null });
        } catch (err: any) {
            console.error(`[Agent API] Fehler bei ${method}():`, err.message);
            res.status(500).json({
                success: false,
                data: null,
                error: err.message || String(err)
            });
        }
    });

    /**
     * POST /api/agent/batch - Führt mehrere Agent-Methoden als Transaktion aus.
     */
    app.post('/api/agent/batch', (req, res) => {
        const operations: Array<{ method: string; params: any[] }> = req.body?.operations || [];

        if (!Array.isArray(operations) || operations.length === 0) {
            return res.status(400).json({ success: false, results: [], rollback: false, error: 'Keine Operationen angegeben.' });
        }

        // Alle Methoden validieren
        for (const op of operations) {
            if (!AGENT_METHODS[op.method]) {
                return res.status(400).json({
                    success: false, results: [], rollback: false,
                    error: `Unbekannte Methode: '${op.method}'. Erlaubt: ${Object.keys(AGENT_METHODS).join(', ')}`
                });
            }
        }

        const projectPath = path.resolve(PUBLIC_DIR, 'project.json');
        if (!fs.existsSync(projectPath)) {
            return res.status(404).json({ success: false, results: [], rollback: false, error: 'project.json nicht gefunden.' });
        }

        try {
            const projectData = JSON.parse(fs.readFileSync(projectPath, 'utf-8'));
            const snapshot = JSON.stringify(projectData);
            const controller = createServerSideAgentController(projectData);

            const results: Array<{ method: string; success: boolean; data: any; error: string | null }> = [];
            let hasError = false;

            for (const op of operations) {
                try {
                    const fn = (controller as any)[op.method];
                    if (typeof fn !== 'function') throw new Error(`Methode '${op.method}' nicht implementiert.`);
                    const result = fn.apply(controller, op.params || []);
                    results.push({ method: op.method, success: true, data: result ?? null, error: null });
                } catch (e: any) {
                    results.push({ method: op.method, success: false, data: null, error: e.message });
                    hasError = true;
                    break;
                }
            }

            if (hasError) {
                // Rollback — Projekt NICHT speichern
                console.log(`[Agent API] Batch rollback nach Fehler in '${results[results.length - 1]?.method}'.`);
                res.json({ success: false, results, rollback: true, error: null });
            } else {
                // Batch erfolgreich — Projekt speichern
                fs.writeFileSync(projectPath, JSON.stringify(projectData, null, 2));
                console.log(`[Agent API] Batch: ${operations.length} Operationen erfolgreich.`);
                res.json({ success: true, results, rollback: false, error: null });
            }
        } catch (err: any) {
            console.error('[Agent API] Batch-Fehler:', err.message);
            res.status(500).json({ success: false, results: [], rollback: false, error: err.message });
        }
    });
}

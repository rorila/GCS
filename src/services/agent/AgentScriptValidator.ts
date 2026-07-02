import { AgentScript, AGENT_SCRIPT_VERSION, ImportOptions, ImportConflict } from './AgentScriptTypes';
import type { AgentController } from '../AgentController';

/**
 * AgentScriptValidator
 *
 * Prüft ein AgentScript auf Struktur, Version, zulässige Methoden und
 * Konsistenz mit dem Zielprojekt.
 */
export class AgentScriptValidator {
    /**
     * Zulässige Methoden, die ein AgentScript aufrufen darf.
     * Destruktive, globale oder meta-Methoden sind ausgeschlossen.
     */
    public static readonly ALLOWED_METHODS: ReadonlySet<string> = new Set([
        // Projekt-Struktur
        'addVariable',
        'addObject',
        'createStage',

        // Tasks & Actions
        'createTask',
        'addAction',
        'addBranch',
        'moveActionInSequence',
        'duplicateTask',

        // Events & Bindings
        'connectEvent',
        'connectVariableEvent',
        'bindVariable',

        // UI & Properties
        'setProperty',
        'renameTask',
        'renameAction',

        // Komponenten-Shortcuts
        'createSprite',
        'createGroupPanel',
        'createDialog',
        'createLabel',
        'setSpriteCollision',
        'setSpriteVelocity',
        'createTimer',
        'createIntervalTimer',
        'createThresholdVariable',
        'createInputController',
        'createButton',
        'createVideo',
        'createLink',
        'createProgressBar',
        'createStickyNote',
    ]);

    /**
     * Validiert das Skript gegen sich selbst und optional gegen das Zielprojekt.
     */
    public static validate(
        script: AgentScript,
        controller?: AgentController,
        options?: ImportOptions
    ): { valid: boolean; errors: string[]; warnings: string[] } {
        const errors: string[] = [];
        const warnings: string[] = [];

        // 1. Grundstruktur
        if (!script) {
            errors.push('Skript ist leer oder undefined.');
            return { valid: false, errors, warnings };
        }
        if (script.version !== AGENT_SCRIPT_VERSION) {
            errors.push(`Nicht unterstützte Skript-Version: ${script.version}. Erwartet: ${AGENT_SCRIPT_VERSION}`);
        }
        if (!script.name || typeof script.name !== 'string' || script.name.trim().length === 0) {
            errors.push('Skript benötigt einen gültigen Namen.');
        }
        if (!Array.isArray(script.operations)) {
            errors.push('Skript muss ein Array "operations" enthalten.');
            return { valid: false, errors, warnings };
        }
        if (script.operations.length === 0) {
            warnings.push('Skript enthält keine Operationen.');
        }

        // 2. Operationen prüfen
        for (let i = 0; i < script.operations.length; i++) {
            const op = script.operations[i];
            if (!op || typeof op !== 'object') {
                errors.push(`Operation ${i} ist ungültig.`);
                continue;
            }
            if (typeof op.method !== 'string') {
                errors.push(`Operation ${i}: "method" muss ein String sein.`);
                continue;
            }
            if (!Array.isArray(op.params)) {
                errors.push(`Operation ${i}: "params" muss ein Array sein.`);
                continue;
            }
            if (!AgentScriptValidator.ALLOWED_METHODS.has(op.method)) {
                errors.push(`Operation ${i}: Methode '${op.method}' ist nicht erlaubt.`);
            }
        }

        // 3. Projektbezogene Prüfungen (nur wenn Controller vorhanden)
        if (controller) {
            // Abhängigkeiten
            if (script.requiredStages) {
                for (const stageName of script.requiredStages) {
                    const stages = controller.listStages();
                    if (!stages.find(s => s.name === stageName || s.id === stageName)) {
                        errors.push(`Stage '${stageName}' existiert nicht im Zielprojekt.`);
                    }
                }
            }

            if (script.requiredVariables) {
                for (const varName of script.requiredVariables) {
                    const vars = controller.listVariables();
                    if (!vars.find(v => v.name === varName)) {
                        errors.push(`Variable '${varName}' existiert nicht im Zielprojekt.`);
                    }
                }
            }

            // Konflikte bei Import (nur wenn nicht dryRun)
            if (!options?.dryRun) {
                const conflictStrategy = options?.conflictStrategy ?? 'error';
                const names = this.collectTargetNames(script);
                const conflicts = this.findConflicts(names, controller, conflictStrategy, options?.autoRenameSuffix ?? '_import');
                for (const c of conflicts) {
                    if (c.action === 'error') {
                        errors.push(c.message);
                    } else if (c.action === 'rename' || c.action === 'skip') {
                        warnings.push(c.message);
                    }
                }
            }
        }

        return { valid: errors.length === 0, errors, warnings };
    }

    /**
     * Sammelt alle Namen, die das Skript im Zielprojekt erstellen würde.
     */
    private static collectTargetNames(
        script: AgentScript
    ): { tasks: string[]; variables: string[]; objects: string[]; stages: string[] } {
        const tasks: string[] = [];
        const variables: string[] = [];
        const objects: string[] = [];
        const stages: string[] = [];

        for (const op of script.operations) {
            switch (op.method) {
                case 'createTask': {
                    const stageId = op.params[0];
                    const taskName = op.params[1];
                    if (typeof taskName === 'string') tasks.push(taskName);
                    if (typeof stageId === 'string' && !stages.includes(stageId)) stages.push(stageId);
                    break;
                }
                case 'addVariable': {
                    const varName = op.params[0];
                    if (typeof varName === 'string') variables.push(varName);
                    break;
                }
                case 'addObject':
                case 'createSprite':
                case 'createGroupPanel':
                case 'createDialog':
                case 'createLabel':
                case 'createTimer':
                case 'createIntervalTimer':
                case 'createThresholdVariable':
                case 'createInputController':
                case 'createButton':
                case 'createVideo':
                case 'createLink':
                case 'createProgressBar':
                case 'createStickyNote': {
                    const stageId = op.params[0];
                    const objectName = op.params[1];
                    if (typeof objectName === 'string') objects.push(objectName);
                    if (typeof stageId === 'string' && !stages.includes(stageId)) stages.push(stageId);
                    break;
                }
                case 'createStage': {
                    const stageId = op.params[0];
                    if (typeof stageId === 'string' && !stages.includes(stageId)) stages.push(stageId);
                    break;
                }
            }
        }

        return { tasks, variables, objects, stages };
    }

    /**
     * Findet Konflikte zwischen Skript-Namen und existierenden Projekt-Elementen.
     */
    private static findConflicts(
        names: { tasks: string[]; variables: string[]; objects: string[]; stages: string[] },
        controller: AgentController,
        conflictStrategy: string,
        suffix: string
    ): ImportConflict[] {
        const conflicts: ImportConflict[] = [];

        const existingTasks = controller.listTasks().map(t => t.name).filter(Boolean);
        const existingVariables = controller.listVariables().map(v => v.name).filter(Boolean);
        const existingStages = controller.listStages().map(s => s.name || s.id).filter(Boolean);
        const existingObjects = new Set<string>();
        for (const stage of controller.listStages()) {
            const id = stage.id || stage.name;
            if (id) {
                for (const obj of controller.listObjects(id)) {
                    if (obj.name) existingObjects.add(obj.name);
                }
            }
        }

        const check = (
            type: ImportConflict['type'],
            name: string,
            existingList: string[] | Set<string>
        ) => {
            const exists = existingList instanceof Set ? existingList.has(name) : existingList.includes(name);
            if (exists) {
                if (conflictStrategy === 'error') {
                    conflicts.push({ type, name, action: 'error', message: `${type === 'task' ? 'Task' : type === 'variable' ? 'Variable' : type === 'object' ? 'Objekt' : 'Stage'} '${name}' existiert bereits.` });
                } else if (conflictStrategy === 'rename') {
                    conflicts.push({ type, name, action: 'rename', message: `${type === 'task' ? 'Task' : type === 'variable' ? 'Variable' : type === 'object' ? 'Objekt' : 'Stage'} '${name}' existiert bereits und wird umbenannt.`, suggestedName: `${name}${suffix}` });
                } else if (conflictStrategy === 'skip') {
                    conflicts.push({ type, name, action: 'skip', message: `${type === 'task' ? 'Task' : type === 'variable' ? 'Variable' : type === 'object' ? 'Objekt' : 'Stage'} '${name}' existiert bereits und wird übersprungen.` });
                }
            }
        };

        for (const name of names.tasks) check('task', name, existingTasks);
        for (const name of names.variables) check('variable', name, existingVariables);
        for (const name of names.objects) check('object', name, existingObjects);
        for (const name of names.stages) check('stage', name, existingStages);

        return conflicts;
    }
}

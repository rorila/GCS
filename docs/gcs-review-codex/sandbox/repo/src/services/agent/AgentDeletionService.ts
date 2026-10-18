import { projectActionRegistry } from '../registry/ActionRegistry';
import { projectTaskRegistry } from '../registry/TaskRegistry';
import { SequenceItem } from '../../model/types';
import { Logger } from '../../utils/Logger';
import type { AgentController } from '../AgentController';

/**
 * AgentDeletionService
 *
 * Kapselt Lösch- und Umbenenn-Operationen für Tasks, Actions,
 * Objekte, Stages und Variablen.
 */
export class AgentDeletionService {
    private logger = Logger.get('AgentDeletionService', 'Editor_Diagnostics');

    constructor(private controller: AgentController) {}

    /** Löscht einen Task und seine FlowChart-Daten. Entfernt Referenzen aus Event-Bindings. */
    public deleteTask(taskName: string): void {
        this.controller.validateProjectLoaded();
        const project = this.controller.getProject()!;

        // Aus Stages entfernen
        project.stages?.forEach(s => {
            if (s.tasks) s.tasks = s.tasks.filter(t => t.name !== taskName);
            // Event-Bindings bereinigen
            if (s.objects) {
                s.objects.forEach((obj: any) => {
                    if (obj.events) {
                        for (const [key, val] of Object.entries(obj.events)) {
                            if (val === taskName) delete obj.events[key];
                        }
                    }
                });
            }
        });
        // Aus project.tasks entfernen (Legacy)
        if (project.tasks) project.tasks = project.tasks.filter(t => t.name !== taskName);

        this.controller.invalidateTaskFlow(taskName);
        this.logger.info(`Task '${taskName}' deleted.`);
        this.controller.notifyChange();
    }

    /** Löscht eine Action aus dem Projekt und entfernt sie aus allen Task-Sequenzen. */
    public deleteAction(actionName: string): void {
        this.controller.validateProjectLoaded();
        const project = this.controller.getProject()!;

        // Aus allen Stages und project.actions entfernen
        project.stages?.forEach(s => {
            if (s.actions) s.actions = s.actions.filter(a => a.name !== actionName);
        });
        if (project.actions) project.actions = project.actions.filter(a => a.name !== actionName);

        // Aus allen Task-Sequenzen entfernen
        const removeFromSequence = (seq: SequenceItem[]): SequenceItem[] => {
            return seq.filter(item => {
                if (item.type === 'action' && item.name === actionName) return false;
                if (item.then) item.then = removeFromSequence(item.then);
                if (item.else) item.else = removeFromSequence(item.else);
                return true;
            });
        };

        const allTasks = [...(project.tasks || []), ...(project.stages?.flatMap(s => s.tasks || []) || [])];
        allTasks.forEach(t => {
            t.actionSequence = removeFromSequence(t.actionSequence);
            this.controller.invalidateTaskFlow(t.name);
        });

        this.logger.info(`Action '${actionName}' deleted from project and all sequences.`);
        this.controller.notifyChange();
    }

    /** Entfernt ein Objekt aus einer Stage. */
    public removeObject(stageId: string, objectName: string): void {
        this.controller.validateProjectLoaded();
        const project = this.controller.getProject()!;
        const stage = project.stages?.find(s => s.id === stageId);
        if (!stage) throw new Error(`Stage '${stageId}' not found.`);
        if (!stage.objects) return;

        const before = stage.objects.length;
        stage.objects = stage.objects.filter((o: any) => o.name !== objectName && o.id !== objectName);

        if (stage.objects.length === before) {
            this.logger.warn(`Object '${objectName}' not found in stage '${stageId}'.`);
            return;
        }
        this.logger.info(`Object '${objectName}' removed from stage '${stageId}'.`);
        this.controller.notifyChange();
    }

    /** Löscht eine Stage (Blueprint-Stage ist geschützt). */
    public deleteStage(stageId: string): void {
        this.controller.validateProjectLoaded();
        const project = this.controller.getProject()!;
        if (!project.stages) return;

        const stage = project.stages.find(s => s.id === stageId);
        if (!stage) throw new Error(`Stage '${stageId}' not found.`);
        if (stage.type === 'blueprint') throw new Error('Blueprint-Stage darf nicht gelöscht werden.');

        project.stages = project.stages.filter(s => s.id !== stageId);
        this.logger.info(`Stage '${stageId}' deleted.`);
        this.controller.notifyChange();
    }

    /** Löscht eine Variable aus dem Projekt. */
    public deleteVariable(variableName: string): void {
        this.controller.validateProjectLoaded();
        const project = this.controller.getProject()!;
        if (project.variables) {
            project.variables = project.variables.filter(v => v.name !== variableName);
        }
        project.stages?.forEach(s => {
            if (s.variables) s.variables = s.variables.filter((v: any) => v.name !== variableName);
        });
        this.logger.info(`Variable '${variableName}' deleted.`);
        this.controller.notifyChange();
    }

    /** Benennt einen Task um (inkl. Referenzen in Events, Sequences, FlowCharts). */
    public renameTask(oldName: string, newName: string): boolean {
        this.controller.validateProjectLoaded();
        const result = projectTaskRegistry.renameTask(oldName, newName);
        if (result) {
            this.logger.info(`Task '${oldName}' renamed to '${newName}'.`);
            this.controller.notifyChange();
        }
        return result;
    }

    /** Benennt eine Action um (inkl. Referenzen in Sequences). */
    public renameAction(oldName: string, newName: string): boolean {
        this.controller.validateProjectLoaded();
        const result = projectActionRegistry.renameAction(oldName, newName);
        if (result) {
            this.logger.info(`Action '${oldName}' renamed to '${newName}'.`);
            this.controller.notifyChange();
        }
        return result;
    }
}

import { Logger } from '../../utils/Logger';
import type { AgentController } from '../AgentController';

/**
 * AgentObjectService
 *
 * Kapselt Objekt-/Variable-Hilfsmethoden, Property-Setter,
 * Binding und Event-Verknüpfungen.
 */
export class AgentObjectService {
    private logger = Logger.get('AgentObjectService', 'Editor_Diagnostics');

    constructor(private controller: AgentController) {}

    /** Setzt eine beliebige Property auf einem Stage-Objekt. Unterstützt dot-notation (z.B. 'style.backgroundColor'). */
    public setProperty(stageId: string, objectName: string, property: string, value: any): void {
        this.controller.validateProjectLoaded();
        const project = this.controller.getProject()!;
        const stage = project.stages?.find(s => s.id === stageId);
        if (!stage) throw new Error(`Stage '${stageId}' not found.`);

        const obj = (stage.objects || []).find((o: any) => o.name === objectName || o.id === objectName);
        if (!obj) throw new Error(`Object '${objectName}' not found in stage '${stageId}'.`);

        // Dot-Notation auflösen (z.B. 'style.backgroundColor')
        const parts = property.split('.');
        let target: any = obj;
        for (let i = 0; i < parts.length - 1; i++) {
            if (target[parts[i]] === undefined) target[parts[i]] = {};
            target = target[parts[i]];
        }
        target[parts[parts.length - 1]] = value;

        this.logger.info(`Set ${objectName}.${property} = ${JSON.stringify(value)}`);
        this.controller.notifyChange();
    }

    /** Setzt ein Binding auf einem Objekt-Property (z.B. '${currentUser.name}'). */
    public bindVariable(stageId: string, objectName: string, property: string, expression: string): void {
        // Binding-Format: ${variableName.subProp}
        if (!expression.startsWith('${')) {
            expression = '${' + expression + '}';
        }
        this.setProperty(stageId, objectName, property, expression);
        this.logger.info(`Bound ${objectName}.${property} to '${expression}'`);
    }

    /** Verbindet ein Event eines Objekts mit einem Task. */
    public connectEvent(stageId: string, objectName: string, eventName: string, taskName: string): void {
        this.controller.validateProjectLoaded();
        const project = this.controller.getProject()!;
        const stage = project.stages?.find(s => s.id === stageId);
        if (!stage) throw new Error(`Stage '${stageId}' not found.`);

        const obj = (stage.objects || []).find((o: any) => o.name === objectName || o.id === objectName);
        if (!obj) throw new Error(`Object '${objectName}' not found in stage '${stageId}'.`);

        // Prüfe ob Task existiert
        if (!this.controller.getTaskByName(taskName)) {
            throw new Error(`Task '${taskName}' not found. Create it first with createTask().`);
        }

        if (!obj.events) obj.events = {};
        obj.events[eventName] = taskName;

        this.logger.info(`Connected ${objectName}.${eventName} → Task '${taskName}'`);
        this.controller.notifyChange();
    }

    /**
     * Verbindet ein Event einer Variable (Projekt- oder Stage-Variable) mit einem Task.
     * Der RuntimeVariableManager erwartet die Mapping in `variable.Tasks`.
     */
    public connectVariableEvent(variableName: string, eventName: string, taskName: string): void {
        this.controller.validateProjectLoaded();
        if (!this.controller.getTaskByName(taskName)) {
            throw new Error(`Task '${taskName}' not found. Create it first with createTask().`);
        }

        const variable = this.findVariable(variableName);
        if (!variable) {
            throw new Error(`Variable '${variableName}' not found.`);
        }

        if (!variable.Tasks) variable.Tasks = {};
        variable.Tasks[eventName] = taskName;

        this.logger.info(`Connected ${variableName}.${eventName} → Task '${taskName}'`);
        this.controller.notifyChange();
    }

    /** Findet eine Variable anhand des Namens (Projekt- oder Stage-Scope). */
    private findVariable(name: string): any | undefined {
        const project = this.controller.getProject();
        if (!project) return undefined;

        let variable = project.variables?.find(v => v.name === name);
        if (variable) return variable;

        const stageWithVar = project.stages?.find(s => s.variables?.some((v: any) => v.name === name));
        if (stageWithVar) {
            return stageWithVar.variables?.find((v: any) => v.name === name);
        }
        return undefined;
    }
}

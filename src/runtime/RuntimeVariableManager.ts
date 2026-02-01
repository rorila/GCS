import { ReactiveRuntime } from './ReactiveRuntime';
import { TaskExecutor } from './TaskExecutor';
import { DebugLogService } from '../services/DebugLogService';

export interface IVariableHost {
    project: any;
    stage: any;
    taskExecutor: TaskExecutor | null;
    reactiveRuntime: ReactiveRuntime;
    startTimer: (prop: string, varDef: any, value: number) => void;
}

export class RuntimeVariableManager {
    public projectVariables: Record<string, any> = {};
    public stageVariables: Record<string, any> = {};
    public contextVars: Record<string, any>;

    constructor(private host: IVariableHost, initialGlobalVars: Record<string, any> = {}) {
        this.projectVariables = { ...initialGlobalVars };
        this.contextVars = this.createVariableContext();
    }

    public initializeVariables(project: any) {
        // 1. Project Global Variables
        if (project.variables) {
            this.importVariables(project.variables);
        }

        // 2. Main Stage Variables (treated as Global)
        if (project.stages) {
            const mainStage = project.stages.find((s: any) => s.type === 'main');
            if (mainStage && mainStage.variables) {
                this.importVariables(mainStage.variables);
            }
        }
    }

    public initializeStageVariables(stage: any) {
        if (stage && stage.variables) {
            this.importVariables(stage.variables);
        }
    }

    private importVariables(vars: any[]) {
        vars.forEach((v: any) => {
            const isGlobal = !v.scope || v.scope === 'global';
            // PRIORITIZATION: 
            // At game start, we prefer 'defaultValue' (the design-time start state).
            // 'value' is used as a fallback (legacy or stateful resume).
            const initialValue = v.defaultValue !== undefined ? v.defaultValue : v.value;

            if (isGlobal) {
                if (this.projectVariables[v.name] === undefined) {
                    this.projectVariables[v.name] = initialValue !== undefined ? initialValue : 0;
                }
            } else {
                // local/stage scope
                if (this.stageVariables[v.name] === undefined) {
                    this.stageVariables[v.name] = initialValue !== undefined ? initialValue : 0;
                }
            }
        });
    }

    public createStageProxy(stage: any): any {
        return new Proxy({}, {
            get: (_target, prop: string) => {
                const variableDef = stage.variables?.find((v: any) => v.name === prop);
                if (!variableDef) return undefined;
                if (!variableDef.isPublic) {
                    console.warn(`[Scope] Access denied: Variable '${prop}' in stage '${stage.name}' is private.`);
                    return undefined;
                }
                if (this.host.stage && this.host.stage.id === stage.id) {
                    return this.stageVariables[prop];
                }
                return variableDef.defaultValue;
            },
            set: () => {
                console.warn(`[Scope] Cannot set properties on Stage Proxy '${stage.name}'. Cross-stage writes are forbidden.`);
                return false;
            }
        });
    }

    public createVariableContext(): Record<string, any> {
        return new Proxy({}, {
            get: (_target, prop: string) => {
                if (prop in this.stageVariables) return this.stageVariables[prop];
                if (prop in this.projectVariables) return this.projectVariables[prop];
                return undefined;
            },
            set: (_target, prop: string, value: any) => {
                const oldValue = this.stageVariables[prop] !== undefined
                    ? this.stageVariables[prop]
                    : this.projectVariables[prop];

                let varDef: any = this.host.stage?.variables?.find((v: any) => v.name === prop);
                if (!varDef && this.host.project.variables) {
                    varDef = this.host.project.variables.find((v: any) => v.name === prop);
                }

                let finalValue = value;
                if (varDef && varDef.isInteger && typeof value === 'number') {
                    finalValue = Math.floor(value);
                }

                if (prop in this.stageVariables) {
                    this.stageVariables[prop] = finalValue;
                } else if (prop in this.projectVariables) {
                    this.projectVariables[prop] = finalValue;
                } else {
                    this.stageVariables[prop] = finalValue;
                }

                // Sync to Stage Component if exists (for reactivity and visual consistency)
                const component = (this.host as any).objects?.find((o: any) => o.name === prop && o.isVariable);
                if (component && component.value !== finalValue) {
                    component.value = finalValue;
                }

                this.host.reactiveRuntime.setVariable(prop, finalValue);

                if (this.host.taskExecutor) {
                    if (varDef) {
                        this.processVariableEvents(prop, finalValue, oldValue, varDef);
                    }
                }
                return true;
            },
            ownKeys: () => {
                const keys = new Set([...Object.keys(this.projectVariables), ...Object.keys(this.stageVariables)]);
                return Array.from(keys);
            },
            has: (_target, prop: string) => {
                return (prop in this.stageVariables) || (prop in this.projectVariables);
            },
            getOwnPropertyDescriptor: (_target, prop: string) => {
                const val = this.stageVariables[prop] !== undefined ? this.stageVariables[prop] : this.projectVariables[prop];
                if (val !== undefined) {
                    return { configurable: true, enumerable: true, value: val };
                }
                return undefined;
            }
        });
    }

    public processVariableEvents(prop: string, value: any, oldValue: any, varDef: any) {
        const executor = this.host.taskExecutor;
        if (!executor) return;

        // a) onValueChanged
        if (oldValue !== value) {
            this.executeVariableEvent(varDef, 'onValueChanged');
        }

        // b) onValueEmpty
        if ((value === "" || value === null || value === undefined)) {
            this.executeVariableEvent(varDef, 'onValueEmpty');
        }

        // c) Thresholds
        if (typeof value === 'number' && typeof oldValue === 'number' && typeof varDef.threshold === 'number') {
            const t = varDef.threshold;
            if (oldValue < t && value >= t) {
                this.executeVariableEvent(varDef, 'onThresholdReached');
            }
            if (oldValue >= t && value < t) {
                this.executeVariableEvent(varDef, 'onThresholdLeft');
            }
            if (oldValue <= t && value > t) {
                this.executeVariableEvent(varDef, 'onThresholdExceeded');
            }
        }

        // d) Trigger Values
        if (varDef.triggerValue !== undefined && varDef.triggerValue !== "" && varDef.triggerValue !== null) {
            // Use loose equality to handle string/number mismatch
            const isTrigger = value == varDef.triggerValue;
            const wasTrigger = oldValue == varDef.triggerValue;

            if (isTrigger && !wasTrigger) {
                this.executeVariableEvent(varDef, 'onTriggerEnter');
            }
            if (!isTrigger && wasTrigger) {
                this.executeVariableEvent(varDef, 'onTriggerExit');
            }
        }

        // e) Range Logic
        if (typeof value === 'number' && varDef.min !== undefined && varDef.max !== undefined) {
            const min = Number(varDef.min);
            const max = Number(varDef.max);
            if (value <= min && (oldValue > min || oldValue === undefined)) {
                this.executeVariableEvent(varDef, 'onMinReached');
            }
            if (value >= max && (oldValue < max || oldValue === undefined)) {
                this.executeVariableEvent(varDef, 'onMaxReached');
            }
            const isInside = value > min && value < max;
            const wasInside = oldValue > min && oldValue < max;
            if (isInside && !wasInside) {
                this.executeVariableEvent(varDef, 'onInside');
            }
            if (!isInside && wasInside) {
                this.executeVariableEvent(varDef, 'onOutside');
            }
        }

        // f) Random Logic
        if (varDef.isRandom && oldValue !== value) {
            this.executeVariableEvent(varDef, 'onGenerated');
        }

        // g) List Logic
        if (varDef.type === 'list' && value !== oldValue) {
            this.processListEvents(value, oldValue, varDef);
        }

        // h) Timer Logic
        if (varDef.type === 'timer' && typeof value === 'number' && value > 0 && (oldValue === 0 || oldValue === undefined)) {
            this.host.startTimer(prop, varDef, value);
        }
    }

    /**
     * Helper to execute a variable event. 
     * Delegated to TaskExecutor using ComponentName.EventName notation.
     */
    private executeVariableEvent(varDef: any, eventName: string): void {
        const executor = this.host.taskExecutor;
        if (!executor) return;

        // Log to DebugLogService
        const eventLogId = DebugLogService.getInstance().log('Event', `Triggered: ${varDef.name}.${eventName}`, {
            objectName: varDef.name,
            eventName: eventName
        });

        // The TaskExecutor now handles the lookup (direct, onEvent map, or named task)
        const taskName = `${varDef.name}.${eventName}`;
        executor.execute(taskName, { sender: varDef }, this.contextVars, undefined, 0, eventLogId);
    }

    private processListEvents(value: any, oldValue: any, varDef: any) {
        const executor = this.host.taskExecutor;
        if (!executor) return;
        try {
            const list = Array.isArray(value) ? value : JSON.parse(value);
            const oldList = Array.isArray(oldValue) ? oldValue : (oldValue ? JSON.parse(oldValue) : []);

            if (list.length > oldList.length) {
                this.executeVariableEvent(varDef, 'onItemAdded');
            }
            if (list.length < oldList.length) {
                this.executeVariableEvent(varDef, 'onItemRemoved');
            }

            if (varDef.searchValue) {
                const contains = list.includes(varDef.searchValue);
                const wasContains = oldList.includes(varDef.searchValue);
                if (contains && !wasContains) {
                    this.executeVariableEvent(varDef, 'onContains');
                }
                if (!contains && wasContains) {
                    this.executeVariableEvent(varDef, 'onNotContains');
                }
            }
        } catch (e) {
            // Ignore parse errors
        }
    }
}

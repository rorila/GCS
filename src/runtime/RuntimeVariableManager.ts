import { ReactiveRuntime } from './ReactiveRuntime';
import { TaskExecutor } from './TaskExecutor';

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
        if (project.variables) {
            project.variables.forEach((v: any) => {
                const isGlobal = !v.scope || v.scope === 'global';
                if (isGlobal) {
                    if (this.projectVariables[v.name] === undefined) {
                        this.projectVariables[v.name] = v.defaultValue;
                    }
                } else if (v.scope === 'local') {
                    if (this.stageVariables[v.name] === undefined) {
                        this.stageVariables[v.name] = v.defaultValue;
                    }
                }
            });
        }
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

    private processVariableEvents(prop: string, value: any, oldValue: any, varDef: any) {
        const executor = this.host.taskExecutor;
        if (!executor) return;

        // a) onValueChanged
        if (oldValue !== value && varDef.onValueChanged) {
            executor.execute(varDef.onValueChanged, {}, this.contextVars);
        }

        // b) onValueEmpty
        if ((value === "" || value === null || value === undefined) && varDef.onValueEmpty) {
            executor.execute(varDef.onValueEmpty, {}, this.contextVars);
        }

        // c) Thresholds
        if (typeof value === 'number' && typeof oldValue === 'number' && typeof varDef.threshold === 'number') {
            const t = varDef.threshold;
            if (oldValue < t && value >= t && varDef.onThresholdReached) {
                executor.execute(varDef.onThresholdReached, {}, this.contextVars);
            }
            if (oldValue >= t && value < t && varDef.onThresholdLeft) {
                executor.execute(varDef.onThresholdLeft, {}, this.contextVars);
            }
            if (oldValue <= t && value > t && varDef.onThresholdExceeded) {
                executor.execute(varDef.onThresholdExceeded, {}, this.contextVars);
            }
        }

        // d) Trigger Values
        if (varDef.triggerValue !== undefined && varDef.triggerValue !== "" && varDef.triggerValue !== null) {
            const isTrigger = value == varDef.triggerValue;
            const wasTrigger = oldValue == varDef.triggerValue;
            if (isTrigger && !wasTrigger && varDef.onTriggerEnter) {
                executor.execute(varDef.onTriggerEnter, {}, this.contextVars);
            }
            if (!isTrigger && wasTrigger && varDef.onTriggerExit) {
                executor.execute(varDef.onTriggerExit, {}, this.contextVars);
            }
        }

        // e) Range Logic
        if (typeof value === 'number' && varDef.min !== undefined && varDef.max !== undefined) {
            const min = Number(varDef.min);
            const max = Number(varDef.max);
            if (value <= min && (oldValue > min || oldValue === undefined) && varDef.onMinReached) {
                executor.execute(varDef.onMinReached, {}, this.contextVars);
            }
            if (value >= max && (oldValue < max || oldValue === undefined) && varDef.onMaxReached) {
                executor.execute(varDef.onMaxReached, {}, this.contextVars);
            }
            const isInside = value > min && value < max;
            const wasInside = oldValue > min && oldValue < max;
            if (isInside && !wasInside && varDef.onInside) {
                executor.execute(varDef.onInside, {}, this.contextVars);
            }
            if (!isInside && wasInside && varDef.onOutside) {
                executor.execute(varDef.onOutside, {}, this.contextVars);
            }
        }

        // f) Random Logic
        if (varDef.isRandom && oldValue !== value && varDef.onGenerated) {
            executor.execute(varDef.onGenerated, {}, this.contextVars);
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

    private processListEvents(value: any, oldValue: any, varDef: any) {
        const executor = this.host.taskExecutor;
        if (!executor) return;
        try {
            const list = Array.isArray(value) ? value : JSON.parse(value);
            const oldList = Array.isArray(oldValue) ? oldValue : (oldValue ? JSON.parse(oldValue) : []);

            if (list.length > oldList.length && varDef.onItemAdded) {
                executor.execute(varDef.onItemAdded, {}, this.contextVars);
            }
            if (list.length < oldList.length && varDef.onItemRemoved) {
                executor.execute(varDef.onItemRemoved, {}, this.contextVars);
            }

            if (varDef.searchValue) {
                const contains = list.includes(varDef.searchValue);
                const wasContains = oldList.includes(varDef.searchValue);
                if (contains && !wasContains && varDef.onContains) {
                    executor.execute(varDef.onContains, {}, this.contextVars);
                }
                if (!contains && wasContains && varDef.onNotContains) {
                    executor.execute(varDef.onNotContains, {}, this.contextVars);
                }
            }
        } catch (e) {
            // Ignore parse errors
        }
    }
}
